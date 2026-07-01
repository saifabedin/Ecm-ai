const fs = require("fs");
const path = require("path");

// Mood-based music categories
const MUSIC_MOODS = {
  HOOK: {
    keywords: ['energetic', 'upbeat', 'exciting', 'catchy', 'attention'],
    fallback: 'energetic'
  },
  STORY: {
    keywords: ['calm', 'inspiring', 'emotional', 'storytelling', 'narrative'],
    fallback: 'inspiring'
  },
  CTA: {
    keywords: ['urgent', 'motivational', 'action', 'driving', 'uplifting'],
    fallback: 'motivational'
  },
  TRANSITION: {
    keywords: ['smooth', 'transition', 'subtle', 'fade', 'whoosh'],
    fallback: 'smooth'
  }
};

// Music file metadata structure
// bpm is stored as [min, max] range array — never use arithmetic (120-140 = -20)
const MUSIC_METADATA = {
  energetic: { bpm: [120, 140], energy: 'high', mood: 'upbeat' },
  inspiring: { bpm: [80, 100], energy: 'medium', mood: 'emotional' },
  motivational: { bpm: [110, 130], energy: 'high', mood: 'uplifting' },
  smooth: { bpm: [60, 80], energy: 'low', mood: 'calm' },
  calm: { bpm: [60, 80], energy: 'low', mood: 'relaxed' },
  upbeat: { bpm: [120, 140], energy: 'high', mood: 'happy' }
};

// Get background music files from assets directory
function getBackgroundMusicFiles() {
  const musicDir = path.join(__dirname, '../assets/music');
  if (fs.existsSync(musicDir)) {
    try {
      const files = fs.readdirSync(musicDir)
        .filter(file => file.endsWith('.mp3') || file.endsWith('.wav'))
        .map(file => path.join(musicDir, file));
      return files;
    } catch (err) {
      console.error("[Music] Error reading music directory:", err.message);
      return [];
    }
  }
  return [];
}

// Get music file by mood
function getMusicByMood(mood = 'energetic') {
  const musicFiles = getBackgroundMusicFiles();

  if (musicFiles.length === 0) {
    console.warn("[Music] No music files found in assets/music");
    return null;
  }

  const moodFile = musicFiles.find(file =>
    file.toLowerCase().includes(mood.toLowerCase())
  );

  if (moodFile) {
    console.log(`[Music] Found music for mood '${mood}': ${path.basename(moodFile)}`);
    return moodFile;
  }

  console.log(`[Music] No music found for mood '${mood}', using fallback`);
  return musicFiles[0];
}

// Select music based on scene type
function selectMusicForScene(sceneType = 'STORY') {
  const moodConfig = MUSIC_MOODS[sceneType] || MUSIC_MOODS.STORY;
  return getMusicByMood(moodConfig.fallback);
}

// Analyze script to determine mood
function analyzeScriptMood(script) {
  if (!script || typeof script !== 'string') return 'energetic';

  const lowerScript = script.toLowerCase();

  if (lowerScript.match(/exciting|amazing|incredible|wow|awesome/)) return 'energetic';
  if (lowerScript.match(/calm|peaceful|relax|enjoy|comfort/)) return 'calm';
  if (lowerScript.match(/inspire|dream|hope|future|vision/)) return 'inspiring';
  if (lowerScript.match(/action|now|today|urgent|quick/)) return 'motivational';
  if (lowerScript.match(/happy|joy|celebrate|fun|great/)) return 'upbeat';

  return 'energetic';
}

// Get music duration using ffprobe
function getMusicDuration(musicPath) {
  const ffmpeg = require('fluent-ffmpeg');
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(musicPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

// Adjust music duration to match target
async function adjustMusicDuration(musicPath, targetDuration, tempDir) {
  try {
    const duration = await getMusicDuration(musicPath);

    if (Math.abs(duration - targetDuration) < 0.5) {
      return musicPath;
    }

    const adjustedPath = path.join(tempDir, `adjusted_music_${Date.now()}.mp3`);

    if (duration < targetDuration) {
      const loopsNeeded = Math.ceil(targetDuration / duration);
      await new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        exec(
          `ffmpeg -y -stream_loop ${loopsNeeded} -i "${musicPath}" -t ${targetDuration} -c:a libmp3lame -q:a 2 "${adjustedPath}"`,
          (err, stdout, stderr) => {
            if (err) reject(stderr);
            else resolve(stdout);
          }
        );
      });
    } else {
      await new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        exec(
          `ffmpeg -y -i "${musicPath}" -t ${targetDuration} -c:a libmp3lame -q:a 2 "${adjustedPath}"`,
          (err, stdout, stderr) => {
            if (err) reject(stderr);
            else resolve(stdout);
          }
        );
      });
    }

    return adjustedPath;
  } catch (error) {
    console.warn("[Music] Music adjustment failed, using original:", error.message);
    return musicPath;
  }
}

// Add background music to video with ducking
async function addBackgroundMusic(videoPath, musicPath, outputPath, duckingLevel = 0.3) {
  try {
    const { exec } = require('child_process');

    await exec(
      `ffmpeg -y -i "${videoPath}" -i "${musicPath}" ` +
      `-filter_complex "[1:a]volume=${duckingLevel}[music];[0:a][music]amix=inputs=2:duration=first[aout]" ` +
      `-map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 128k "${outputPath}"`,
      (err, stdout, stderr) => {
        if (err) throw new Error(stderr);
      }
    );

    return outputPath;
  } catch (error) {
    console.error("[Music] Failed to add background music:", error.message);
    return videoPath;
  }
}

// Apply volume ducking to background music
function applyMusicDucking(musicPath, voicePath, duckingLevel = 0.3, attack = 0.02, release = 0.5) {
  const filter = `[1:a]volume=${duckingLevel}[music];[0:a][music]sidechaincompress=threshold=0.0125:ratio=20:attack=${attack}:release=${release}[aout]`;

  return {
    filter,
    musicPath,
    voicePath,
    duckingLevel
  };
}

/**
 * ALWAYS-ON background music + SFX adder.
 *
 * Called by the orchestrator after the main composition pass to guarantee
 * every video has:
 *   - Background music (any track from /assets/music, looped to duration)
 *   - Ducked under voiceover when voice is present
 *   - At least one SFX (e.g. "whoosh" at midpoint) if SFX assets exist
 *
 * The function NEVER fails the call: if music is missing, SFX are missing,
 * or ffmpeg errors out, it returns the original video path unchanged so
 * the render still completes.
 *
 * @param {string} videoPath - Path to the composed video
 * @param {Object} options
 * @param {string} [options.tempDir] - Temp directory (for adjusted music + sfx mixes)
 * @param {string} [options.mood] - 'energetic'|'inspiring'|'motivational'|'smooth'|'calm'|'upbeat'
 * @param {Array}  [options.sfxPlacements] - [{ sfxPath, startTime, volume }] from retention-sfx
 * @param {boolean}[options.hasVoice] - When true, music is ducked to 0.158 (~-16dB)
 * @returns {Promise<string>} Path to the new video (or original on failure)
 */
async function addBackgroundMusicAndSFX(videoPath, options = {}) {
  if (!videoPath || !fs.existsSync(videoPath)) {
    console.warn("[Music] addBackgroundMusicAndSFX: videoPath missing, skipping");
    return videoPath;
  }

  const { tempDir, mood, sfxPlacements = [], hasVoice = true } = options;
  const workDir = tempDir || path.dirname(videoPath);
  fs.mkdirSync(workDir, { recursive: true });

  const musicFiles = getBackgroundMusicFiles();
  let musicPath = null;
  if (mood) {
    musicPath = getMusicByMood(mood);
  }
  if (!musicPath && musicFiles.length > 0) {
    musicPath = musicFiles[0];
    console.log(`[Music] addBackgroundMusicAndSFX: mood match missed, using first available: ${path.basename(musicPath)}`);
  }

  // Adjust music length to video length (loop or trim)
  if (musicPath) {
    try {
      const targetDuration = await getMusicDuration(videoPath);
      const adjusted = await adjustMusicDuration(musicPath, targetDuration, workDir);
      musicPath = adjusted;
    } catch (err) {
      console.warn(`[Music] Music duration adjust failed (non-fatal): ${err.message}`);
    }
  }

  // Filter up to 4 distinct SFX placements (dedupe by path)
  const seen = new Set();
  const validSfx = (sfxPlacements || [])
    .filter(p => p && p.sfxPath && fs.existsSync(p.sfxPath))
    .filter(p => {
      if (seen.has(p.sfxPath)) return false;
      seen.add(p.sfxPath);
      return true;
    })
    .slice(0, 4);

  // If no SFX provided, fabricate a midpoint "whoosh" so the track is never silent
  if (validSfx.length === 0) {
    const whoosh = getSfxFallback();
    if (whoosh) {
      validSfx.push({ sfxPath: whoosh, startTime: 0.5, volume: 0.25, label: "default_intro" });
      const duration = await getMusicDuration(videoPath);
      if (duration > 3) {
        validSfx.push({ sfxPath: whoosh, startTime: duration / 2, volume: 0.18, label: "default_mid" });
      }
    }
  }

  const musicVolume = hasVoice ? 0.158 : 0.45;
  const sfxVolume = hasVoice ? 0.3 : 0.5;

  const inputs = [`-i "${videoPath}"`];
  if (musicPath) inputs.push(`-i "${musicPath}"`);
  const sfxBaseIndex = 1 + (musicPath ? 1 : 0);
  for (const sp of validSfx) {
    inputs.push(`-i "${sp.sfxPath}"`);
  }

  // Build filter graph
  const chains = [];
  if (musicPath) {
    chains.push(`[1:a]volume=${musicVolume},afade=t=in:st=0:d=0.5,afade=t=out:st=999:d=0[m]`);
  }
  const sfxLabels = [];
  validSfx.forEach((sp, i) => {
    const idx = sfxBaseIndex + i;
    const delayMs = Math.max(0, Math.round((sp.startTime || 0) * 1000));
    const vol = sp.volume || sfxVolume;
    chains.push(`[${idx}:a]adelay=${delayMs}|${delayMs},volume=${vol}[s${i}]`);
    sfxLabels.push(`[s${i}]`);
  });

  const mixLabels = [];
  if (musicPath) mixLabels.push("[m]");
  sfxLabels.forEach(l => mixLabels.push(l));

  if (mixLabels.length === 0) {
    // No music, no SFX — nothing to do
    console.log("[Music] addBackgroundMusicAndSFX: no music and no SFX available, returning original");
    return videoPath;
  }

  // Mix into the existing video audio track (input 0)
  // We use amix with dropout_transition to avoid clipping the voiceover.
  // The first amix combines music + SFX (dropout_transition=2 keeps the
  // music from clipping when SFX blip in). The second amix then mixes
  // the pre-existing voice track with that music/SFX mix at full volume.
  // Note: [v] is the voice label — it must be included in the FIRST amix
  // label list so input count and label count match, OR we keep them
  // separate. The safer approach: keep voice separate, mix music+SFX in
  // the first amix, then mix voice with that result in the second amix.
  const voiceLabel = "[v]";
  const firstAmixInputCount = mixLabels.length; // only music + SFX
  const firstAmix = `${mixLabels.join("")}amix=inputs=${firstAmixInputCount}:duration=first:dropout_transition=2[mix]`;
  const secondAmix = `${voiceLabel}[mix]amix=inputs=2:duration=first:dropout_transition=0[aout]`;
  const mixFilter = `${chains.join(";")};[0:a]volume=1.0${voiceLabel};${firstAmix};${secondAmix}`;

  const outPath = path.join(workDir, `with_audio_${Date.now()}.mp4`);
  const cmd = `ffmpeg -y ${inputs.join(" ")} -filter_complex "${mixFilter}" -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -ar 48000 -movflags +faststart "${outPath}"`;

  try {
    const { exec } = require("child_process");
    await new Promise((resolve, reject) => {
      exec(cmd, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (err, _stdout, stderr) => {
        if (err) {
          console.warn(`[Music] addBackgroundMusicAndSFX ffmpeg failed: ${err.message}`);
          return reject(err);
        }
        resolve();
      });
    });

    // Replace original with new (atomic copy + delete)
    fs.copyFileSync(outPath, videoPath);
    try { fs.unlinkSync(outPath); } catch (e) { /* ignore */ }
    console.log(`[Music] addBackgroundMusicAndSFX: applied music=${!!musicPath} sfx=${validSfx.length}`);
    return videoPath;
  } catch (err) {
    console.warn(`[Music] addBackgroundMusicAndSFX failed, returning original: ${err.message}`);
    try { fs.existsSync(outPath) && fs.unlinkSync(outPath); } catch (e) { /* ignore */ }
    return videoPath;
  }
}

// Helper: get a fallback SFX file (used when no SFX placements provided)
function getSfxFallback() {
  const dir = path.join(__dirname, "../assets/sfx");
  if (!fs.existsSync(dir)) return null;
  const candidates = ["whoosh sfx.mp3", "ding sfx.mp3", "computer click.mp3", "success slick sfx.mp3"];
  for (const name of candidates) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  const all = fs.readdirSync(dir).filter(f => f.endsWith(".mp3") || f.endsWith(".wav"));
  return all.length > 0 ? path.join(dir, all[0]) : null;
}

// Generate FFmpeg filter for audio mixing with ducking
function generateAudioMixFilter(voiceIndex, musicIndex, duckingLevel = 0.3) {
  return `[${voiceIndex}:a]volume=1.0[voice];[${musicIndex}:a]volume=${duckingLevel}[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=2[audio]`;
}

// Get music recommendations based on script analysis
function getMusicRecommendations(script) {
  const mood = analyzeScriptMood(script);
  const metadata = MUSIC_METADATA[mood] || MUSIC_METADATA.energetic;

  return {
    mood,
    bpm: Array.isArray(metadata.bpm) ? metadata.bpm : [metadata.bpm, metadata.bpm],
    bpmAvg: Array.isArray(metadata.bpm) ? Math.round((metadata.bpm[0] + metadata.bpm[1]) / 2) : metadata.bpm,
    energy: metadata.energy,
    recommendedFile: getMusicByMood(mood),
    alternatives: Object.keys(MUSIC_MOODS).map(key => MUSIC_MOODS[key].fallback)
  };
}

module.exports = {
  getBackgroundMusicFiles,
  getMusicByMood,
  selectMusicForScene,
  analyzeScriptMood,
  getMusicDuration,
  adjustMusicDuration,
  addBackgroundMusic,
  addBackgroundMusicAndSFX,
  applyMusicDucking,
  generateAudioMixFilter,
  getMusicRecommendations,
  getSfxFallback,
  MUSIC_MOODS,
  MUSIC_METADATA
};
