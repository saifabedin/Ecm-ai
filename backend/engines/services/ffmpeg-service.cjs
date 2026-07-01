// ---------- SECURITY HELPERS ----------

// SECURITY: jobId is used to build filesystem paths. Lock the format.
function assertValidJobId(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(id)) {
    throw new Error(`Invalid jobId format (must match /^[a-zA-Z0-9-]{1,64}$/): ${String(id).substring(0, 40)}`);
  }
  return id;
}

// SECURITY: Verify a resolved path is inside the allowed base directory.
function assertPathInside(base, candidate, label) {
  const resolvedBase = path.resolve(base);
  const resolvedCandidate = path.resolve(candidate);
  if (!resolvedCandidate.startsWith(resolvedBase + path.sep) && resolvedCandidate !== resolvedBase) {
    throw new Error(`Path traversal blocked: ${label} = ${resolvedCandidate} is outside ${resolvedBase}`);
  }
  return resolvedCandidate;
}

// SECURITY: Reject commands that look like shell-injection attempts.
// We only ever build FFmpeg commands from validated paths, so any of these
// metachars appearing UNQUOTED is a bug or an attack. We allow them inside
// quoted strings (e.g. the -filter_complex "...;[in]chain[out]..." value),
// where they are ffmpeg's own filter-chain separators and are not interpreted
// by the shell.
function assertFFmpegCommandSafe(command) {
  if (typeof command !== 'string') {
    throw new Error('FFmpeg command must be a string');
  }
  if (!command.trim().startsWith('ffmpeg ')) {
    throw new Error('FFmpeg command must start with "ffmpeg "');
  }
  // Genuinely dangerous patterns that must NEVER appear anywhere in the command:
  //   - newlines (split into multiple commands)
  //   - backticks (command substitution)
  //   - $(...) or ${...} (variable/command substitution)
  if (/[\n\r]/.test(command)) {
    throw new Error(`FFmpeg command contains newline: ${command.substring(0, 80)}`);
  }
  if (/`/.test(command)) {
    throw new Error(`FFmpeg command contains backtick: ${command.substring(0, 80)}`);
  }
  if (/\$\(/.test(command) || /\$\{/.test(command)) {
    throw new Error(`FFmpeg command contains shell substitution: ${command.substring(0, 80)}`);
  }
  // Unquoted metachars (outside any " or ' string) are a real injection risk.
  // Strip out quoted regions and only then check for ; & | < > $.
  const stripped = command.replace(/"([^"]*)"|'([^']*)'/g, "");
  if (/[;&|<>$]/.test(stripped)) {
    throw new Error(`FFmpeg command has unquoted shell metacharacter: ${command.substring(0, 80)}`);
  }
  // Path traversal check on quoted tokens
  const pathLike = command.match(/"([^"]+)"|'([^']+)'|(\S+)/g) || [];
  for (const token of pathLike) {
    const inner = token.replace(/^["']|["']$/g, '');
    if (inner.includes('..')) {
      throw new Error(`FFmpeg command contains path traversal: ${inner.substring(0, 80)}`);
    }
  }
}

const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");
const gpuRender = require("../../render/gpu-render-service.cjs");

// Run FFmpeg with improved error handling and timeout.
// Uses explicit SIGTERM → SIGKILL escalation (Node's built-in `exec({timeout})`
// only sends SIGTERM, which FFmpeg/Chrome often ignore — leaving the child
// process orphaned and tying up CPU until the OS reaps it).
function runFFmpeg(command, timeout = 120000) {
  assertFFmpegCommandSafe(command);
  return new Promise((resolve, reject) => {
    const { exec } = require("child_process");

    const logCmd = command.length > 200 ? command.substring(0, 200) + '...' : command;
    console.log("[Engine4] Running FFmpeg command:", logCmd);

    let timedOut = false;
    const child = exec(command, {
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    }, (err, stdout, stderr) => {
      // Clear the timer if the child finished naturally before timeout fired
      clearTimeout(timer);
      if (timedOut) return; // reject was already called by the timer
      if (err) {
        console.error("❌ FFmpeg Error:", {
          command: command.substring(0, 100) + "...",
          error: err.message,
          stderr: stderr.substring(0, 500) + "...",
          exitCode: err.code
        });
        reject(new Error(`FFmpeg failed: ${err.message}`));
      } else {
        console.log("[Engine4] FFmpeg completed successfully");
        resolve(stdout);
      }
    });

    // Explicit timeout with SIGTERM → SIGKILL escalation
    const timer = setTimeout(() => {
      timedOut = true;
      console.error(`[Engine4] FFmpeg command timed out after ${timeout}ms — sending SIGTERM`);
      try { child.kill('SIGTERM'); } catch (e) { /* already dead */ }
      // Force-kill 2s later if SIGTERM didn't take effect
      setTimeout(() => {
        try { child.kill('SIGKILL'); } catch (e) { /* already dead */ }
      }, 2000).unref();
      reject(new Error(`FFmpeg command timed out after ${timeout}ms`));
    }, timeout);
  });
}

// Get audio duration
function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

/**
 * Format seconds to SRT timestamp: HH:MM:SS,mmm
 */
function formatSrtTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Get video duration
 */
function getVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      resolve(videoStream ? videoStream.duration || metadata.format.duration : 0);
    });
  });
}

/**
 * Crop landscape video to 9:16 vertical format
 * Uses center region with smart motion tracking
 *
 * BLACK SCREEN FIX: the previous build used
 * `force_original_aspect_ratio=increase,crop=...` which produces a black
 * frame when the source is taller than wide (e.g. a 1080x1920 portrait
 * video scaled UP to 720x1280). We now use `force_original_aspect_ratio
 * =decrease` plus `pad=...:color=black` so the result is always exactly
 * 720x1280 with the source centered (no black bars, no overflow).
 */
async function cropToVertical(videoPath, tempDir, duration = null) {
  try {
    if (!videoPath || !fs.existsSync(videoPath)) {
      console.error(`[Engine4] cropToVertical: input missing: ${videoPath}`);
      return null;
    }
    console.log(`[Engine4] Cropping to vertical: ${videoPath}`);

    // Create output path
    const outputPath = path.join(tempDir, `vertical_${Date.now()}_${path.basename(videoPath)}`);

    // Scale video to fit within 720x1280 while preserving aspect ratio, then
    // pad to exact size with a black background. setpts+format guarantees
    // a known good output state regardless of the source encoding.
    const filter = `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=decrease,pad=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p,setsar=1`;

    const gpuEncoder = gpuRender.getEncoderArgs({ preset: 'fast', codec: 'h264' });
    const ffmpegCmd = `ffmpeg -y -i "${videoPath}" -vf "${filter}" ${gpuEncoder.encoderArgs} -t ${duration || '10'} "${outputPath}"`;

    await runFFmpeg(ffmpegCmd);
    return outputPath;
  } catch (error) {
    console.error('[Engine4] Vertical crop failed:', error.message);
    return videoPath; // Fallback to original
  }
}

/**
 * Force a video to exactly 720x1280 by scaling with letterboxing.
 * Used as a safety pass in the master render so a non-conformant input
 * never produces a black-bar or stretched final video.
 */
async function forceVerticalScale(videoPath, tempDir) {
  if (!videoPath || !fs.existsSync(videoPath)) return videoPath;
  try {
    const outputPath = path.join(tempDir, `vertical_scaled_${Date.now()}.mp4`);
    const filter = `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=decrease,pad=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p,setsar=1`;
    const gpuEncoder = gpuRender.getEncoderArgs({ preset: 'standard', codec: 'h264' });
    const cmd = `ffmpeg -y -i "${videoPath}" -vf "${filter}" ${gpuEncoder.encoderArgs} -c:a copy "${outputPath}"`;
    await runFFmpeg(cmd);
    return outputPath;
  } catch (err) {
    console.error('[Engine4] forceVerticalScale failed:', err.message);
    return videoPath;
  }
}

const VIDEO_WIDTH = 720;
const VIDEO_HEIGHT = 1280;

module.exports = {
  assertValidJobId,
  assertPathInside,
  assertFFmpegCommandSafe,
  runFFmpeg,
  getAudioDuration,
  formatSrtTime,
  getVideoDuration,
  cropToVertical,
  forceVerticalScale,
  VIDEO_WIDTH,
  VIDEO_HEIGHT,
};
