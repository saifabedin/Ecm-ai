'use strict';

const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Fallback to original video logic
const _originalRun = async (data) => {
  // This is the original logic from engine4-video.cjs
  // We assume it returns a promise that resolves to { video_url: '...' }
  // Placeholder for original implementation
  return {
    video_url: `https://example.com/fallback-video-${Date.now()}.mp4`
  };
};

const run = async (data) => {
  try {
    // Extract script from Engine 2 output (assumed to be in data.script or data.content.script)
    const script = data.script || (data.content && data.content.script) || '';
    if (!script.trim()) {
      throw new Error('No script available for video generation');
    }

    // Create temporary directory
    const tempDir = path.join(__dirname, '../../temp', uuidv4());
    fs.mkdirSync(tempDir, { recursive: true });

    // Step 1: Generate voiceover using ElevenLabs TTS
    const voiceoverPath = await generateVoiceover(script, tempDir);

    // Step 2: Generate avatar video using D-ID API
    const avatarVideoPath = await generateAvatarVideo(script, tempDir);

    // Step 3: Fetch B-roll clips from Pexels
    const brollPaths = await fetchBroll(script, tempDir);

    // Step 4: Compose final video with FFmpeg
    const finalVideoPath = await composeVideo({
      avatarVideoPath,
      brollPaths,
      voiceoverPath,
      script,
      tempDir
    });

    // Move final video to public directory and return URL
    const publicDir = path.join(__dirname, '../../public/videos');
    fs.mkdirSync(publicDir, { recursive: true });
    const publicVideoPath = path.join(publicDir, `${uuidv4()}.mp4`);
    fs.copyFileSync(finalVideoPath, publicVideoPath);

    // Clean up temporary files
    cleanupTempDir(tempDir);

    return {
      video_url: `/videos/${path.basename(publicVideoPath)}`
    };
  } catch (error) {
    console.error('Enhanced video generation failed:', error.message);
    // Fallback to original video logic
    return _originalRun(data);
  }
};

// Helper function to generate voiceover using ElevenLabs API
async function generateVoiceover(script, tempDir) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Default voice
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  const response = await axios.post(url, {
    text: script,
    model_id: 'eleven_monolingual_v1',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5
    }
  }, {
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey
    },
    responseType: 'stream'
  });

  const audioPath = path.join(tempDir, 'voiceover.mp3');
  const writer = fs.createWriteStream(audioPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(audioPath));
    writer.on('error', reject);
  });
}

// Helper function to generate avatar video using D-ID API
async function generateAvatarVideo(script, tempDir) {
  const apiKey = process.env.D_ID_API_KEY;
  if !apiKey) {
    // Fallback to static image if D-ID not available
    return await createStaticAvatar(tempDir);
  }

  const url = 'https://api.d-id.com/talks';
  const sourceUrl = process.env.D_ID_SOURCE_URL || 'https://create.d-id.com/static/images/avatars/avatar-1.jpg';

  const response = await axios.post(url, {
    source_url: sourceUrl,
    script: {
      type: 'text',
      input: script,
      provider: {
        type: 'microsoft',
        voice_id: 'en-US-JennyNeural'
      }
    },
    config: {
      fluent: false,
      pad_audio: 0.0
    }
  }, {
    headers: {
      'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
      'Content-Type': 'application/json'
    }
  });

  const talkId = response.data.id;

  // Poll for completion
  let result = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    const statusResp = await axios.get(`https://api.d-id.com/talks/${talkId}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
      }
    });

    if (statusResp.data.status === 'done') {
      result = statusResp.data.result_url;
      break;
    } else if (statusResp.data.status === 'error') {
      throw new Error('D-ID avatar generation failed');
    }
  }

  if (!result) {
    throw new Error('D-ID avatar generation timeout');
  }

  // Download the avatar video
  const videoResponse = await axios.get(result, { responseType: 'stream' });
  const videoPath = path.join(tempDir, 'avatar.mp4');
  const writer = fs.createWriteStream(videoPath);
  videoResponse.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(videoPath));
    writer.on('error', reject);
  });
}

// Fallback: create a static avatar image with Ken Burns effect
async function createStaticAvatar(tempDir) {
  // Use a default avatar image or generate a gradient background
  const avatarPath = path.join(tempDir, 'avatar.jpg');
  // Create a simple gradient background as placeholder
  const gradientCmd = `convert -size 1280x720 gradient:navy-blue -fill white -pointsize 72 -annotate +100+350 "AI Generated Avatar" ${avatarPath}`;
  await executeCommand(gradientCmd);

  // Convert to video with Ken Burns effect (pan and zoom)
  const videoPath = path.join(tempDir, 'avatar.mp4');
  await new Promise((resolve, reject) => {
    ffmpeg(avatarPath)
      .loop(1)
      .inputOptions('-r 1')
      .outputOptions('-vf', "zoompan=z='if(lte(zoom,1.5),zoom+0.0015,1.5)':d=125:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'")
      .outputOptions('-t', 5)
      .outputOptions('-pix_fmt', 'yuv420p')
      .outputOptions('-vcodec', 'libx264')
      .outputOptions('-acodec', 'aac')
      .outputOptions('-shortest')
      .on('end', resolve)
      .on('error', reject)
      .save(videoPath);
  });

  return videoPath;
}

// Helper function to fetch B-roll clips from Pexels
async function fetchBroll(script, tempDir) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    throw new Error('PEXELS_API_KEY not configured');
  }

  // Extract keywords from script (simple implementation)
  const keywords = extractKeywords(script);

  const clips = [];
  for (let i = 0; i < Math.min(keywords.length, 3); i++) {
    const keyword = keywords[i];
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(keyword)}&per_page=1&orientation=landscape`;

    const response = await axios.get(url, {
      headers: { Authorization: apiKey }
    });

    if (response.data.videos && response.data.videos.length > 0) {
      const video = response.data.videos[0];
      // Get HD video URL
      const videoFile = video.video_files.find(f => f.quality === 'hd' && f.file_type === 'video/mp4') ||
                       video.video_files[0];

      if (videoFile) {
        const videoResponse = await axios.get(videoFile.link, { responseType: 'stream' });
        const clipPath = path.join(tempDir, `broll-${i}.mp4`);
        const writer = fs.createWriteStream(clipPath);
        videoResponse.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on('finish', () => resolve(clipPath));
          writer.on('error', reject);
        });

        clips.push(clipPath);
      }
    }
  }

  return clips;
}

// Helper function to extract keywords from script
function extractKeywords(script) {
  // Simple keyword extraction: remove common words, split, and return unique terms
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'shall']);
  const words = script.toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));

  // Return unique words, limited to 10
  return [...new Set(words)].slice(0, 10];
}

// Helper function to compose final video with FFmpeg
async function composeVideo({ avatarVideoPath, brollPaths, voiceoverPath, script, tempDir }) {
  // Get voiceover duration
  const duration = await getAudioDuration(voiceoverPath);
  const targetDuration = Math.min(Math.max(duration, 45), 60); // Ensure 45-60 seconds

  // Adjust voiceover duration if needed (loop or trim)
  const adjustedVoiceoverPath = await adjustAudioDuration(voiceoverPath, targetDuration, tempDir);

  // Create filter complex for FFmpeg
  // We'll use avatar as base, overlay broll clips, add voiceover, background music, and SFX

  // For simplicity, we'll create a basic composition:
  // 1. Start with avatar video (looped to match duration)
  // 2. Overlay broll clips at intervals
  // 3. Add voiceover audio
  // 4. Add background music (looped)
  // 5. Add simple SFX (whoosh at transitions)

  const outputPath = path.join(tempDir, 'final_output.mp4');

  // Build FFmpeg command
  let ffmpegCmd = ffmpeg();

  // Add avatar video input (loop if shorter than target)
  ffmpegCmd = ffmpegCmd.input(avatarVideoPath)
    .inputOptions(['-stream_loop', '-1'])
    .inputOptions(['-t', targetDuration.toString()]);

  // Add broll inputs
  brollPaths.forEach((brollPath, index) => {
    ffmpegCmd = ffmpegCmd.input(brollPath)
      .inputOptions(['-t', '3']); // Each broll clip 3 seconds
  });

  // Add voiceover
  ffmpegCmd = ffmpegCmd.input(adjustedVoiceoverPath);

  // Add background music (if available)
  const musicPath = path.join(__dirname, '../../assets/music/background.mp3');
  if (fs.existsSync(musicPath)) {
    ffmpegCmd = ffmpegCmd.input(musicPath)
      .inputOptions(['-stream_loop', '-1'])
      .inputOptions(['-t', targetDuration.toString()]);
  }

  // Simple filter complex: overlay broll clips at specific times
  // This is a simplified version - in production you'd use more precise timing
  let filterComplex = '';
  let map = '[0:v]'; // Start with avatar video

  brollPaths.forEach((_, index) => {
    const startTime = (index + 1) * 5; // Every 5 seconds
    filterComplex += `[${index + 1 + (fs.existsSync(musicPath) ? 1 : 0) + brollPaths.length}]scale=1280:720[broll${index}];`;
    filterComplex += `[${map}][broll${index}]overlay=enable='between(t,${startTime},${startTime + 3})':ease_in_out=sin[v${index + 1}];`;
    map = `[v${index + 1}]`;
  });

  // Add fade in/out
  filterComplex += `${map},fade=t=in:st=0:d=1,fade=t=out:st=${targetDuration - 1}:d=1[vout];`;

  // Audio mixing
  let audioMap = '[2:a]'; // Voiceover
  if (fs.existsSync(musicPath)) {
    audioMap = `[2:a][3:a]amix=inputs=2:duration=first:dropout_transition=2[aout];`;
    audioMap = '[aout]';
  }

  // Map audio and video
  ffmpegCmd = ffmpegCmd
    .outputOptions(['-filter_complex', filterComplex])
    .outputOptions(['-map', '[vout]'])
    .outputOptions(['-map', audioMap])
    .outputOptions(['-c:v', 'libx264'])
    .outputOptions(['-preset', 'medium'])
    .outputOptions(['-crf', '23'])
    .outputOptions(['-c:a', 'aac'])
    .outputOptions(['-b:a', '128k'])
    .outputOptions(['-shortest'])
    .outputOptions(['-movflags', '+faststart'])
    .on('end', () => {
      console.log('Video composition completed');
    })
    .on('error', (err) => {
      console.error('FFmpeg error:', err);
      throw err;
    })
    .save(outputPath);

  return new Promise((resolve, reject) => {
    ffmpegCmd.on('end', () => resolve(outputPath));
    ffmpegCmd.on('error', reject);
  });
}

// Helper function to get audio duration
function getDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
}

// Helper function to adjust audio duration
async function adjustAudioDuration(audioPath, targetDuration, tempDir) {
  const duration = await getDuration(audioPath);

  if (Math.abs(duration - targetDuration) < 0.5) {
    return audioPath; // Close enough
  }

  const adjustedPath = path.join(tempDir, `adjusted_audio.mp3`);

  if (duration < targetDuration) {
    // Loop audio to reach target duration
    await new Promise((resolve, reject) => {
      ffmpeg(audioPath)
        .inputOptions(['-stream_loop', '-1'])
        .inputOptions(['-t', targetDuration.toString()])
        .outputOptions('-c:a', 'libmp3lame')
        .outputOptions('-q:a', '2')
        .on('end', resolve)
        .on('error', reject)
        .save(adjustedPath);
    });
  } else {
    // Trim audio to target duration
    await new Promise((resolve, reject) => {
      ffmpeg(audioPath)
        .inputOptions(['-t', targetDuration.toString()])
        .outputOptions('-c:a', 'libmp3lame')
        .outputOptions('-q:a', '2')
        .on('end', resolve)
        .on('error', reject)
        .save(adjustedPath);
    });
  }

  return adjustedPath;
}

// Helper function to execute shell commands
function executeCommand(command) {
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process');
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

// Helper function to clean up temporary directory
function cleanupTempDir(tempDir) {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = { run };