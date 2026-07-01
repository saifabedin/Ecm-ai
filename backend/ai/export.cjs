const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const QUALITY_PRESETS = {
  low: { video_bitrate: '800k', audio_bitrate: '96k', crf: 28, preset: 'fast', resolution: '720x1280', description: 'Low quality, fast export' },
  medium: { video_bitrate: '1500k', audio_bitrate: '128k', crf: 23, preset: 'medium', resolution: '720x1280', description: 'Medium quality, balanced' },
  high: { video_bitrate: '2500k', audio_bitrate: '192k', crf: 18, preset: 'slow', resolution: '1080x1920', description: 'High quality, slower export' },
  ultra: { video_bitrate: '4000k', audio_bitrate: '256k', crf: 15, preset: 'veryslow', resolution: '1080x1920', description: 'Ultra quality, slowest export' }
};

const PLATFORM_SETTINGS = {
  instagram: { format: 'mp4', codec: 'h264', profile: 'high', level: '4.0', pixel_format: 'yuv420p', movflags: '+faststart', max_bitrate: '3500k', bufsize: '7000k', audio_codec: 'aac', audio_sample_rate: 48000, description: 'Instagram Reels optimized' },
  tiktok: { format: 'mp4', codec: 'h264', profile: 'high', level: '4.0', pixel_format: 'yuv420p', movflags: '+faststart', max_bitrate: '3000k', bufsize: '6000k', audio_codec: 'aac', audio_sample_rate: 44100, description: 'TikTok optimized' },
  youtube: { format: 'mp4', codec: 'h264', profile: 'high', level: '4.2', pixel_format: 'yuv420p', movflags: '+faststart', max_bitrate: '5000k', bufsize: '10000k', audio_codec: 'aac', audio_sample_rate: 48000, description: 'YouTube Shorts optimized' },
  facebook: { format: 'mp4', codec: 'h264', profile: 'main', level: '3.1', pixel_format: 'yuv420p', movflags: '+faststart', max_bitrate: '2500k', bufsize: '5000k', audio_codec: 'aac', audio_sample_rate: 44100, description: 'Facebook Reels optimized' }
};

const EXPORT_FORMATS = {
  mp4: { container: 'mp4', video_codec: 'libx264', audio_codec: 'aac', extension: '.mp4', description: 'Standard MP4 format' },
  webm: { container: 'webm', video_codec: 'libvpx-vp9', audio_codec: 'libopus', extension: '.webm', description: 'WebM format for web' },
  mov: { container: 'mov', video_codec: 'libx264', audio_codec: 'aac', extension: '.mov', description: 'QuickTime MOV format' }
};

function runFFmpeg(command) {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) {
        console.error("❌ FFmpeg Error:", stderr);
        reject(stderr);
      } else {
        resolve(stdout);
      }
    });
  });
}

function getVideoDuration(videoPath) {
  const ffmpeg = require('fluent-ffmpeg');
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

async function exportWithPreset(inputPath, outputPath, preset = 'medium') {
  try {
    const config = QUALITY_PRESETS[preset] || QUALITY_PRESETS.medium;
    console.log(`[Export] Exporting with preset '${preset}': ${config.description}`);

    await runFFmpeg(
      `ffmpeg -y -i "${inputPath}" ` +
      `-c:v libx264 -preset ${config.preset} -crf ${config.crf} ` +
      `-b:v ${config.video_bitrate} -maxrate ${config.video_bitrate} -bufsize ${parseInt(config.video_bitrate) * 2}k ` +
      `-c:a aac -b:a ${config.audio_bitrate} ` +
      `-pix_fmt yuv420p -movflags +faststart "${outputPath}"`
    );

    return outputPath;
  } catch (error) {
    console.error('[Export] Failed to export with preset:', error.message);
    throw error;
  }
}

async function exportForPlatform(inputPath, outputPath, platform = 'instagram', quality = 'medium') {
  try {
    const settings = PLATFORM_SETTINGS[platform] || PLATFORM_SETTINGS.instagram;
    const preset = QUALITY_PRESETS[quality] || QUALITY_PRESETS.medium;
    console.log(`[Export] Exporting for platform '${platform}': ${settings.description}`);

    await runFFmpeg(
      `ffmpeg -y -i "${inputPath}" ` +
      `-c:v libx264 -profile:v ${settings.profile} -level ${settings.level} ` +
      `-preset ${preset.preset} -crf ${preset.crf} ` +
      `-b:v ${settings.max_bitrate} -maxrate ${settings.max_bitrate} -bufsize ${settings.bufsize} ` +
      `-c:a ${settings.audio_codec} -ar ${settings.audio_sample_rate} -b:a ${preset.audio_bitrate} ` +
      `-pix_fmt ${settings.pixel_format} -movflags ${settings.movflags} "${outputPath}"`
    );

    return outputPath;
  } catch (error) {
    console.error(`[Export] Failed to export for platform '${platform}':`, error.message);
    throw error;
  }
}

async function exportMultipleFormats(inputPath, outputDir, baseName, formats = ['mp4'], quality = 'medium') {
  try {
    const results = [];

    for (const format of formats) {
      const formatConfig = EXPORT_FORMATS[format];
      if (!formatConfig) {
        console.warn(`[Export] Unknown format: ${format}`);
        continue;
      }

      const outputPath = path.join(outputDir, `${baseName}_${format}${formatConfig.extension}`);
      console.log(`[Export] Exporting to ${format.toUpperCase()} format...`);

      await runFFmpeg(
        `ffmpeg -y -i "${inputPath}" ` +
        `-c:v ${formatConfig.video_codec} -c:a ${formatConfig.audio_codec} ` +
        `-pix_fmt yuv420p -movflags +faststart "${outputPath}"`
      );

      results.push({ format, path: outputPath, size: fs.statSync(outputPath).size });
    }

    return results;
  } catch (error) {
    console.error('[Export] Failed to export multiple formats:', error.message);
    throw error;
  }
}

async function exportWithSettings(inputPath, outputPath, settings) {
  try {
    console.log('[Export] Exporting with custom settings...');
    let command = `ffmpeg -y -i "${inputPath}" `;

    if (settings.video_codec) command += `-c:v ${settings.video_codec} `;
    if (settings.preset) command += `-preset ${settings.preset} `;
    if (settings.crf) command += `-crf ${settings.crf} `;
    if (settings.bitrate) command += `-b:v ${settings.bitrate} `;
    if (settings.resolution) command += `-s ${settings.resolution} `;
    if (settings.audio_codec) command += `-c:a ${settings.audio_codec} `;
    if (settings.audio_bitrate) command += `-b:a ${settings.audio_bitrate} `;
    if (settings.sample_rate) command += `-ar ${settings.sample_rate} `;

    command += `-pix_fmt yuv420p -movflags +faststart "${outputPath}"`;

    await runFFmpeg(command);
    return outputPath;
  } catch (error) {
    console.error('[Export] Failed to export with custom settings:', error.message);
    throw error;
  }
}

function estimateFileSize(duration, videoBitrate, audioBitrate) {
  const videoBytesPerSec = parseInt(videoBitrate) / 8;
  const audioBytesPerSec = parseInt(audioBitrate) / 8;
  const totalBytesPerSec = videoBytesPerSec + audioBytesPerSec;
  const totalBytes = totalBytesPerSec * duration;
  return {
    bytes: totalBytes,
    mb: (totalBytes / (1024 * 1024)).toFixed(2),
    gb: (totalBytes / (1024 * 1024 * 1024)).toFixed(2)
  };
}

function validateExportSettings(settings) {
  const errors = [];
  if (settings.video_codec && !['libx264', 'libvpx-vp9', 'libx265'].includes(settings.video_codec)) {
    errors.push(`Invalid video codec: ${settings.video_codec}`);
  }
  if (settings.audio_codec && !['aac', 'libopus', 'mp3'].includes(settings.audio_codec)) {
    errors.push(`Invalid audio codec: ${settings.audio_codec}`);
  }
  if (settings.preset && !['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'].includes(settings.preset)) {
    errors.push(`Invalid preset: ${settings.preset}`);
  }
  if (settings.crf && (settings.crf < 0 || settings.crf > 51)) {
    errors.push(`Invalid CRF: ${settings.crf} (must be 0-51)`);
  }
  return { valid: errors.length === 0, errors };
}

function getRecommendedSettings(platform, quality) {
  const platformSettings = PLATFORM_SETTINGS[platform] || PLATFORM_SETTINGS.instagram;
  const qualityPreset = QUALITY_PRESETS[quality] || QUALITY_PRESETS.medium;

  return {
    video_codec: platformSettings.codec,
    audio_codec: platformSettings.audio_codec,
    preset: qualityPreset.preset,
    crf: qualityPreset.crf,
    bitrate: platformSettings.max_bitrate,
    audio_bitrate: qualityPreset.audio_bitrate,
    sample_rate: platformSettings.audio_sample_rate,
    pixel_format: platformSettings.pixel_format,
    movflags: platformSettings.movflags
  };
}

module.exports = {
  QUALITY_PRESETS,
  PLATFORM_SETTINGS,
  EXPORT_FORMATS,
  exportWithPreset,
  exportForPlatform,
  exportMultipleFormats,
  exportWithSettings,
  estimateFileSize,
  validateExportSettings,
  getRecommendedSettings,
  getVideoDuration
};
