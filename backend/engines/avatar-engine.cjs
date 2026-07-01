const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const ffmpeg = require("fluent-ffmpeg");
const crypto = require("crypto");
const https = require("https");
const http = require("http");

// ---------- CONSTANTS ----------

const VIDEO_WIDTH = 720;
const VIDEO_HEIGHT = 1280;

const SCENE_TYPES = {
  HOOK: 'hook',
  STORY: 'story',
  CTA: 'cta',
  TRANSITION: 'transition',
};

const AVATAR_CACHE_DIR = path.join(__dirname, "../../temp/avatars");

// Uploads + public directories for fallback avatar lookup
const UPLOADS_DIR = path.join(__dirname, "../../uploads");
const PUBLIC_DIR = path.join(__dirname, "../../public");

// Avatar presets — no placeholder text. If no real image is found,
// the engine returns null and the scene is rendered WITHOUT an avatar.
const AVATAR_PRESETS = {
  default: {
    bg: '0x1a1a2e',
    text: '',
    textColor: 'white',
    fontSize: 48,
  },
  hook: {
    bg: '0x1a1a2e',
    text: '',
    textColor: '0xFFAA33',
    fontSize: 48,
    accent: '0xFFAA33',
  },
  story: {
    bg: '0x16213e',
    text: '',
    textColor: 'white',
    fontSize: 48,
    accent: '0x0f3460',
  },
  cta: {
    bg: '0x0f3460',
    text: '',
    textColor: '0x33AAFF',
    fontSize: 48,
    accent: '0x33AAFF',
  },
};

// Scene-type Ken Burns parameters
const KEN_BURNS_PARAMS = {
  hook: {
    zoomSpeed: 0.004,   // Faster zoom for dramatic hook
    maxZoom: 1.3,
    fadeIn: 0.5,
    fadeOut: 0.3,
  },
  story: {
    zoomSpeed: 0.001,   // Gentle pan for story scenes
    maxZoom: 1.1,
    fadeIn: 1.0,
    fadeOut: 0.5,
  },
  cta: {
    zoomSpeed: 0.003,   // Moderate zoom for urgency
    maxZoom: 1.2,
    fadeIn: 0.5,
    fadeOut: 0.3,
  },
  default: {
    zoomSpeed: 0.002,
    maxZoom: 1.5,
    fadeIn: 1.0,
    fadeOut: 1.0,
  },
};

// ---------- GPU DETECTION ----------

let _gpuAvailable = null;

function hasGpuEncoder() {
  if (_gpuAvailable !== null) return _gpuAvailable;

  try {
    const { execSync } = require("child_process");
    // Test actual encoding capability, not just encoder listing
    const testResult = execSync(
      'ffmpeg -y -f lavfi -i "color=c=black:s=64x64:d=0.1" -c:v h264_nvenc -f null /dev/null 2>&1',
      { encoding: "utf-8", timeout: 8000 }
    );
    _gpuAvailable = !testResult.includes("Error") && !testResult.includes("Cannot load");
    if (_gpuAvailable) {
      console.log("[AvatarEngine] GPU acceleration available (nvenc verified)");
    } else {
      console.log("[AvatarEngine] nvenc listed but not functional — using CPU");
    }
    return _gpuAvailable;
  } catch {
    _gpuAvailable = false;
    console.log("[AvatarEngine] GPU not available — using CPU encoding");
    return false;
  }
}

// ---------- HELPERS ----------

function runFFmpeg(command, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const child = exec(command, { timeout, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`FFmpeg failed: ${err.message}`));
      } else {
        resolve(stdout);
      }
    });
    child.on("timeout", () => {
      child.kill();
      reject(new Error("FFmpeg command timed out"));
    });
  });
}

function getAudioDuration(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return resolve(0);
      resolve(metadata.format.duration || 0);
    });
  });
}

/**
 * Hash an image source for cache key generation
 */
function hashImageSource(imageSource) {
  if (!imageSource) return "default";
  return crypto.createHash("md5").update(imageSource).digest("hex").substring(0, 12);
}

// ---------- CACHE SYSTEM ----------

/**
 * Get cached avatar video path if available
 */
function getCachedAvatar(cacheKey) {
  try {
    const cachePath = path.join(AVATAR_CACHE_DIR, `${cacheKey}.mp4`);
    if (fs.existsSync(cachePath)) {
      const stat = fs.statSync(cachePath);
      // Cache valid for 24 hours
      if (Date.now() - stat.mtimeMs < 86400000) {
        console.log(`[AvatarEngine] Cache hit: ${cacheKey}`);
        return cachePath;
      }
      // Expired — remove
      fs.unlinkSync(cachePath);
    }
  } catch (err) {
    // Cache miss — not an error
  }
  return null;
}

/**
 * Store avatar video in cache
 */
function cacheAvatar(cacheKey, videoPath) {
  try {
    fs.mkdirSync(AVATAR_CACHE_DIR, { recursive: true });
    const cachePath = path.join(AVATAR_CACHE_DIR, `${cacheKey}.mp4`);
    if (fs.existsSync(videoPath) && videoPath !== cachePath) {
      fs.copyFileSync(videoPath, cachePath);
      console.log(`[AvatarEngine] Cached avatar: ${cacheKey}`);
    }
  } catch (err) {
    console.warn(`[AvatarEngine] Cache store failed:`, err.message);
  }
}

// ---------- AVATAR GENERATION ----------

/**
 * Download a remote image URL to a local file path. Supports http/https.
 * Used by auto-generated avatar pipeline (Replicate returns a URL).
 */
function downloadImageUrl(url, destPath, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    try {
      const client = url.startsWith("https") ? https : http;
      const file = fs.createWriteStream(destPath);
      const req = client.get(url, { timeout: timeoutMs }, (res) => {
        if (res.statusCode !== 200) {
          file.close();
          try { fs.unlinkSync(destPath); } catch (e) { /* ignore */ }
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close(() => resolve(destPath));
        });
      });
      req.on("error", (err) => {
        try { fs.unlinkSync(destPath); } catch (e) { /* ignore */ }
        reject(err);
      });
      req.on("timeout", () => {
        req.destroy(new Error("Image download timed out"));
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Auto-generate a professional headshot avatar via Replicate.
 *
 * Uses black-forest-labs/flux-schnell — a proper text-to-image model that
 * produces a photorealistic headshot in ~1-2 seconds. The prompt is built
 * from the script + brand so the generated face matches the video's topic.
 *
 * Returns a local file path to a downloaded JPG, or null on any failure
 * (missing token, network error, timeout, model rejection). The caller
 * MUST handle null gracefully — never generate a gradient/placeholder.
 *
 * Results are cached on disk for 7 days so a single generation serves
 * the whole session (and avoids burning Replicate credits on retries).
 */
async function generateAvatarViaReplicate({ script = "", brandName = null, sceneType = "default", tempDir, jobId = null }) {
  if (!tempDir) return null;
  if (!process.env.REPLICATE_API_TOKEN) {
    console.log("[AvatarEngine] REPLICATE_API_TOKEN not set — skipping auto-generation");
    return null;
  }

  // Cache key: brand + scene + script length bucket
  const cacheKey = `auto_${hashImageSource((brandName || "") + "_" + sceneType + "_" + (script || "").slice(0, 200))}`;
  const cachePath = path.join(AVATAR_CACHE_DIR, `${cacheKey}.jpg`);

  try {
    if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 0) {
      const ageMs = Date.now() - fs.statSync(cachePath).mtimeMs;
      if (ageMs < 7 * 86400000) {
        console.log(`[AvatarEngine] Replicate cache hit: ${cacheKey}`);
        return cachePath;
      }
      try { fs.unlinkSync(cachePath); } catch (e) { /* ignore */ }
    }
  } catch (e) { /* ignore cache check errors */ }

  // Build a high-quality portrait prompt
  const topic = (script || "").trim().split(/[.!?]/)[0] || "professional person";
  const mood = sceneType === "hook" ? "confident" : sceneType === "cta" ? "friendly and inviting" : "approachable";
  const prompt = [
    `Professional cinematic portrait headshot, ${mood} expression,`,
    `looking directly at camera, soft studio lighting,`,
    `shallow depth of field, 85mm lens, high-end photography,`,
    `for ${brandName || "modern brand"} campaign about: ${topic.slice(0, 120)}`,
    `photorealistic, natural skin texture, vertical 9:16 framing`
  ].join(" ");

  console.log(`[AvatarEngine] Auto-generating headshot via Replicate flux-schnell (jobId=${jobId || "n/a"})...`);

  try {
    const submitRes = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.REPLICATE_API_TOKEN,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: "9:16",
          output_format: "jpg",
          output_quality: 90,
          go_fast: true,
          num_inference_steps: 4,
        },
      }),
    });

    if (!submitRes.ok) {
      console.warn(`[AvatarEngine] Replicate submit HTTP ${submitRes.status}`);
      return null;
    }

    const data = await submitRes.json();

    let imageUrl = null;
    if (data.status === "succeeded" && data.output) {
      imageUrl = Array.isArray(data.output) ? data.output[0] : data.output;
    } else if (data.id && data.status !== "failed") {
      // Poll for completion (max 60s — we cap below)
      const deadline = Date.now() + 60000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 3000));
        const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${data.id}`, {
          headers: { Authorization: "Bearer " + process.env.REPLICATE_API_TOKEN },
        });
        if (!pollRes.ok) continue;
        const poll = await pollRes.json();
        if (poll.status === "succeeded" && poll.output) {
          imageUrl = Array.isArray(poll.output) ? poll.output[0] : poll.output;
          break;
        }
        if (poll.status === "failed" || poll.status === "canceled") {
          console.warn(`[AvatarEngine] Replicate prediction ${poll.status}`);
          return null;
        }
      }
    }

    if (!imageUrl) {
      console.warn("[AvatarEngine] Replicate returned no image URL (timeout or no output)");
      return null;
    }

    // Download to cache
    fs.mkdirSync(AVATAR_CACHE_DIR, { recursive: true });
    await downloadImageUrl(imageUrl, cachePath, 30000);
    const stat = fs.statSync(cachePath);
    if (stat.size < 1024) {
      throw new Error(`Downloaded image too small (${stat.size} bytes)`);
    }
    console.log(`[AvatarEngine] Auto-generated avatar cached: ${cachePath} (${stat.size} bytes)`);
    return cachePath;
  } catch (err) {
    console.warn(`[AvatarEngine] Replicate avatar generation failed: ${err.message}`);
    return null;
  }
}

/**
 * Fallback avatar generation using black-forest-labs FLUX.1 [pro] via Replicate.
 * Generates a photorealistic professional headshot. Same caching semantics
 * as generateAvatarViaReplicate (7-day disk cache, never returns a gradient).
 * Returns local JPG path or null on any failure.
 */
async function generateAvatarViaFlux({ script = "", brandName = null, sceneType = "default", tempDir, jobId = null }) {
  if (!tempDir) return null;
  if (!process.env.REPLICATE_API_TOKEN) return null;

  const cacheKey = `flux_${hashImageSource((brandName || "") + "_" + sceneType + "_" + (script || "").slice(0, 200))}`;
  const cachePath = path.join(AVATAR_CACHE_DIR, `${cacheKey}.jpg`);

  try {
    if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 0) {
      const ageMs = Date.now() - fs.statSync(cachePath).mtimeMs;
      if (ageMs < 7 * 86400000) {
        console.log(`[AvatarEngine] FLUX cache hit: ${cacheKey}`);
        return cachePath;
      }
      try { fs.unlinkSync(cachePath); } catch (e) { /* ignore */ }
    }
  } catch (e) { /* ignore */ }

  const topic = (script || "").trim().split(/[.!?]/)[0] || "professional person";
  const mood = sceneType === "hook" ? "confident and intense" : sceneType === "cta" ? "friendly, inviting warmth" : "approachable, thoughtful";
  const prompt = [
    `Professional cinematic headshot, ${mood} expression, looking directly at camera,`,
    `soft studio key lighting, shallow depth of field, 85mm f/1.4 lens,`,
    `high-end editorial photography, natural skin texture,`,
    `for ${brandName || "modern brand"} campaign about ${topic.slice(0, 100)},`,
    `square headshot composition, clean background, 9:16 vertical format, photorealistic, sharp focus`,
  ].join(" ");

  console.log(`[AvatarEngine] Generating headshot via FLUX (jobId=${jobId || "n/a"})...`);

  try {
    const submitRes = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-1-pro/predictions", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.REPLICATE_API_TOKEN, "Content-Type": "application/json", Prefer: "wait" },
      body: JSON.stringify({ input: { prompt, aspect_ratio: "9:16", output_format: "jpg", safety_tolerance: 2 } }),
    });

    if (!submitRes.ok) {
      console.warn(`[AvatarEngine] FLUX submit HTTP ${submitRes.status}`);
      return null;
    }

    const data = await submitRes.json();
    let imageUrl = null;

    if (data.status === "succeeded" && data.output) {
      imageUrl = Array.isArray(data.output) ? data.output[0] : data.output;
    } else if (data.id && data.status !== "failed" && data.status !== "canceled") {
      const deadline = Date.now() + 90000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 3000));
        const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${data.id}`, {
          headers: { Authorization: "Bearer " + process.env.REPLICATE_API_TOKEN },
        });
        if (!pollRes.ok) continue;
        const poll = await pollRes.json();
        if (poll.status === "succeeded" && poll.output) {
          imageUrl = Array.isArray(poll.output) ? poll.output[0] : poll.output;
          break;
        }
        if (poll.status === "failed" || poll.status === "canceled") {
          console.warn(`[AvatarEngine] FLUX prediction ${poll.status}`);
          return null;
        }
      }
    }

    if (!imageUrl) {
      console.warn("[AvatarEngine] FLUX returned no image URL");
      return null;
    }

    fs.mkdirSync(AVATAR_CACHE_DIR, { recursive: true });
    await downloadImageUrl(imageUrl, cachePath, 30000);
    const stat = fs.statSync(cachePath);
    if (stat.size < 1024) throw new Error(`Downloaded FLUX image too small (${stat.size} bytes)`);
    console.log(`[AvatarEngine] FLUX avatar cached: ${cachePath} (${stat.size} bytes)`);
    return cachePath;
  } catch (err) {
    console.warn(`[AvatarEngine] FLUX avatar generation failed: ${err.message}`);
    return null;
  }
}

/**
 * Fallback avatar generation using NVIDIA NIM image generation API.
 * Uses the step-1-flash (or compatible) model served by integrate.api.nvidia.com.
 * Returns a local JPG path or null on any failure.
 */
async function generateAvatarViaNvidiaNim({ script = "", brandName = null, sceneType = "default", tempDir, jobId = null }) {
  if (!tempDir) return null;
  const apiKey = process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY;
  if (!apiKey || apiKey.includes("YOUR-")) {
    console.log("[AvatarEngine] NVIDIA_NIM_API_KEY not set — skipping NIM auto-generation");
    return null;
  }

  const cacheKey = `nim_${hashImageSource((brandName || "") + "_" + sceneType + "_" + (script || "").slice(0, 200))}`;
  const cachePath = path.join(AVATAR_CACHE_DIR, `${cacheKey}.jpg`);

  try {
    if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 0) {
      const ageMs = Date.now() - fs.statSync(cachePath).mtimeMs;
      if (ageMs < 7 * 86400000) {
        console.log(`[AvatarEngine] NVIDIA NIM cache hit: ${cacheKey}`);
        return cachePath;
      }
      try { fs.unlinkSync(cachePath); } catch (e) { /* ignore */ }
    }
  } catch (e) { /* ignore */ }

  const topic = (script || "").trim().split(/[.!?]/)[0] || "professional person";
  const mood = sceneType === "hook" ? "confident" : sceneType === "cta" ? "friendly" : "approachable";
  const prompt = [
    `Professional cinematic portrait headshot, ${mood} expression,`,
    `looking directly at camera, soft studio lighting,`,
    `shallow depth of field, 85mm lens, vertical 9:16 framing,`,
    `for ${brandName || "modern brand"} campaign about: ${topic.slice(0, 100)}`,
    `photorealistic, natural skin texture, sharp focus`,
  ].join(" ");

  console.log(`[AvatarEngine] Generating headshot via NVIDIA NIM (jobId=${jobId || "n/a"})...`);

  try {
    // NVIDIA NIM uses the OpenAI-compatible /images/generations endpoint.
    // The model "stabilityai/stable-diffusion-xl" is available free on NIM.
    const submitRes = await fetch("https://integrate.api.nvidia.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "stabilityai/stable-diffusion-xl",
        prompt,
        cfg_scale: 5,
        steps: 25,
        width: 768,
        height: 1344,
        seed: Math.floor(Math.random() * 1_000_000),
      }),
    });

    if (!submitRes.ok) {
      console.warn(`[AvatarEngine] NVIDIA NIM submit HTTP ${submitRes.status}`);
      return null;
    }

    const data = await submitRes.json();
    let imageUrl = null;
    if (data.data && Array.isArray(data.data) && data.data[0]) {
      imageUrl = data.data[0].url || null;
      if (!imageUrl && data.data[0].b64_json) {
        // Save base64 directly
        const buf = Buffer.from(data.data[0].b64_json, "base64");
        if (buf.length >= 1024) {
          fs.mkdirSync(AVATAR_CACHE_DIR, { recursive: true });
          fs.writeFileSync(cachePath, buf);
          const stat = fs.statSync(cachePath);
          console.log(`[AvatarEngine] NIM avatar (b64) cached: ${cachePath} (${stat.size} bytes)`);
          return cachePath;
        }
      }
    }

    if (!imageUrl) {
      console.warn("[AvatarEngine] NVIDIA NIM returned no image URL");
      return null;
    }

    fs.mkdirSync(AVATAR_CACHE_DIR, { recursive: true });
    await downloadImageUrl(imageUrl, cachePath, 30000);
    const stat = fs.statSync(cachePath);
    if (stat.size < 1024) throw new Error(`Downloaded NIM image too small (${stat.size} bytes)`);
    console.log(`[AvatarEngine] NIM avatar cached: ${cachePath} (${stat.size} bytes)`);
    return cachePath;
  } catch (err) {
    console.warn(`[AvatarEngine] NVIDIA NIM avatar generation failed: ${err.message}`);
    return null;
  }
}

/**
 * Locate a real portrait/avatar image for the job, or return null.
 *
 * Priority:
 *  1. <UPLOADS_DIR>/<jobId>/avatar.jpg
 *  2. <UPLOADS_DIR>/<jobId>/avatar.png
 *  3. <UPLOADS_DIR>/<jobId>/portrait.jpg
 *  4. <PUBLIC_DIR>/default-avatar.jpg
 *
 * NEVER generates a gradient or placeholder — the caller is expected to
 * skip avatar rendering entirely when this returns null.
 */
function getFallbackAvatarFrame(jobId) {
  const candidates = [
    path.join(UPLOADS_DIR, jobId, 'avatar.jpg'),
    path.join(UPLOADS_DIR, jobId, 'avatar.png'),
    path.join(UPLOADS_DIR, jobId, 'portrait.jpg'),
    path.join(PUBLIC_DIR, 'default-avatar.jpg'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile() && fs.statSync(p).size > 0) {
        console.log(`[AvatarEngine] Found fallback avatar: ${p}`);
        return p;
      }
    } catch (e) {
      // ignore — keep scanning
    }
  }
  return null;
}

/**
 * Create avatar from user-uploaded image (base64 data URI, URL, or local path).
 * Returns PNG path suitable for Ken Burns processing, or null if no image
 * could be resolved (caller should then skip avatar rendering entirely).
 */
async function createUserAvatarImage(imageSource, tempDir) {
  if (!imageSource) return null;

  const outputPath = path.join(tempDir, `user_avatar_${Date.now()}.png`);

  try {
    if (imageSource.startsWith("data:")) {
      // Base64 data URI — decode to file
      const base64Data = imageSource.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      if (buffer.length === 0) return null;
      fs.writeFileSync(outputPath, buffer);
      console.log("[AvatarEngine] Decoded user avatar from base64");
      return outputPath;
    }

    if (imageSource.startsWith("http")) {
      // URL — download to file
      const axios = require("axios");
      const response = await axios.get(imageSource, {
        responseType: "stream",
        timeout: 15000,
      });
      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });
      console.log("[AvatarEngine] Downloaded user avatar from URL");
      return outputPath;
    }

    // Assume it's a file path
    if (fs.existsSync(imageSource)) {
      const stat = fs.statSync(imageSource);
      if (!stat.isFile() || stat.size === 0) return null;
      fs.copyFileSync(imageSource, outputPath);
      console.log("[AvatarEngine] Copied user avatar from file");
      return outputPath;
    }
  } catch (err) {
    console.warn("[AvatarEngine] Failed to process user avatar:", err.message);
  }

  return null;
}

/**
 * Apply Ken Burns effect to avatar image — produces MP4
 * Accepts sceneType for emotion-driven parameters
 */
async function applyKenBurns(imagePath, sceneType, duration, tempDir) {
  const params = KEN_BURNS_PARAMS[sceneType] || KEN_BURNS_PARAMS.default;
  const totalFrames = Math.ceil(duration * 30); // 30fps
  const videoPath = path.join(tempDir, `avatar_kb_${sceneType}_${Date.now()}.mp4`);

  const vf = `zoompan=z='if(lte(zoom,${params.maxZoom}),zoom+${params.zoomSpeed},${params.maxZoom})':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)',fade=t=in:st=0:d=${params.fadeIn},fade=t=out:st=${Math.max(0, duration - params.fadeOut)}:d=${params.fadeOut}`;

  // Use GPU encoder if available
  const encoder = hasGpuEncoder()
    ? `-c:v h264_nvenc -preset p4 -pix_fmt yuv420p`
    : `-c:v libx264 -pix_fmt yuv420p`;

  await runFFmpeg(
    `ffmpeg -y -loop 1 -i "${imagePath}" ` +
    `-vf "${vf}" ` +
    `-t ${duration} ${encoder} -r 30 "${videoPath}"`
  );

  return videoPath;
}

/**
 * Main entry point: Create avatar video
 *
 * Priority chain:
 *  1. User-uploaded image (data URI / URL / file path)
 *  2. Job-scoped fallback (uploads/<jobId>/avatar.{jpg,png} or portrait.jpg)
 *  3. Replicate auto-generation — a real headshot generated from the script
 *     topic and brand. Cached for 7 days. Returns null if Replicate is not
 *     configured or generation fails.
 *  4. NONE — return null. Never generate a gradient or text placeholder.
 *
 * @param {Object} options
 * @param {string} options.sceneType - hook/story/cta/default
 * @param {string} [options.avatarImage] - User image (base64/URL/file path)
 * @param {string} [options.jobId] - Job id, used to locate fallback portrait
 * @param {number}  [options.duration] - Target duration in seconds
 * @param {string}  [options.tempDir] - Temp directory for output
 * @returns {string|null} Path to avatar video MP4, or null if no image exists
 */
async function createAvatarVideo(options) {
  const {
    script = "",
    sceneType = "default",
    avatarImage = null,
    jobId = null,
    duration = 5,
    brandName = null,
    brandKit = null,
    tempDir,
  } = options;

  if (!tempDir) throw new Error("tempDir is required");

  let avatarImagePath = null;

  // 1. Try user-uploaded image
  if (avatarImage) {
    avatarImagePath = await createUserAvatarImage(avatarImage, tempDir);
  }

  // 2. Try job-scoped + public fallbacks
  if (!avatarImagePath && jobId) {
    const fallback = getFallbackAvatarFrame(jobId);
    if (fallback) {
      avatarImagePath = await createUserAvatarImage(fallback, tempDir);
    }
  }

  // 3. No image at all — try to auto-generate one via Replicate → FLUX → NVIDIA NIM
  //    (only if the caller opted in via the script being non-empty and
  //    at least one provider token is configured). This gives every video a
  //    real face without forcing the user to upload a portrait first.
  if (!avatarImagePath && script && script.trim().length > 0) {
    // 3a. Replicate flux-schnell (fast, ~1-2s)
    try {
      const generated = await generateAvatarViaReplicate({
        script,
        brandName,
        sceneType,
        tempDir,
        jobId,
      });
      if (generated) {
        avatarImagePath = await createUserAvatarImage(generated, tempDir);
      }
    } catch (genErr) {
      console.warn(`[AvatarEngine] Replicate generation threw, continuing: ${genErr.message}`);
    }

    // 3b. FLUX.1 [pro] (higher quality, ~5-10s)
    if (!avatarImagePath) {
      try {
        const fluxResult = await generateAvatarViaFlux({
          script,
          brandName,
          sceneType,
          tempDir,
          jobId,
        });
        if (fluxResult) {
          avatarImagePath = await createUserAvatarImage(fluxResult, tempDir);
        }
      } catch (fluxErr) {
        console.warn(`[AvatarEngine] FLUX generation threw, continuing: ${fluxErr.message}`);
      }
    }

    // 3c. NVIDIA NIM SDXL (free, no Replicate credits burned)
    if (!avatarImagePath) {
      try {
        const nimResult = await generateAvatarViaNvidiaNim({
          script,
          brandName,
          sceneType,
          tempDir,
          jobId,
        });
        if (nimResult) {
          avatarImagePath = await createUserAvatarImage(nimResult, tempDir);
        }
      } catch (nimErr) {
        console.warn(`[AvatarEngine] NVIDIA NIM generation threw, continuing: ${nimErr.message}`);
      }
    }
  }

  // 4. No image at all — return null so the caller can skip avatar
  if (!avatarImagePath) {
    console.log(`[AvatarEngine] No avatar image available — avatar will be skipped (jobId=${jobId || "n/a"})`);
    return null;
  }

  // Cache key is now safe to compute (we have a real image)
  const cacheKey = `avatar_${hashImageSource(avatarImage || avatarImagePath)}_${sceneType}_${Math.round(duration)}`;
  const cached = getCachedAvatar(cacheKey);
  if (cached) return cached;

  // 4. Apply Ken Burns to produce MP4
  const videoPath = await applyKenBurns(avatarImagePath, sceneType, duration, tempDir);

  // Cache for future renders
  cacheAvatar(cacheKey, videoPath);

  return videoPath;
}

/**
 * Create avatar video for a specific scene (convenience wrapper)
 * Used by engine4-video.cjs scene distribution
 */
async function createSceneAvatar(scene, avatarImage, brandName, tempDir, brandKit = null, jobId = null) {
  return createAvatarVideo({
    sceneType: scene.sceneType || "story",
    avatarImage,
    jobId,
    duration: Math.max(5, scene.duration || 5),
    brandName,
    brandKit,
    tempDir,
  });
}

/**
 * Create vertical avatar frame for scene rendering
 * Crops avatar to sidebar dimensions for 9:16 layout.
 *
 * If no avatar video exists, the scene is marked avatarEnabled = false and
 * the function exits early — no placeholder text is ever rendered.
 *
 * @param {Object} scene - Scene object with sceneType, duration, sceneId
 * @param {string} avatarVideoPath - Path to avatar video (may be null)
 * @param {string} tempDir - Temp directory
 * @returns {Object} Modified scene with verticalAvatar and background assets
 */
async function createVerticalAvatarFrame(scene, avatarVideoPath, tempDir) {
  try {
    console.log(`[AvatarEngine] Creating vertical avatar frame for scene ${scene.sceneId}`);

    // 1. If we have a real avatar video, crop to sidebar
    if (avatarVideoPath && fs.existsSync(avatarVideoPath)) {
      const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(avatarVideoPath, (err, metadata) => {
          if (err) return reject(err);
          resolve(metadata);
        });
      });

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      if (videoStream) {
        const { height: sourceHeight } = videoStream;
        const sidebarWidth = Math.min(VIDEO_WIDTH / 3, Math.floor(sourceHeight * 0.25));
        const sidebarHeight = Math.min(VIDEO_HEIGHT, sourceHeight);
        const avatarPath = path.join(tempDir, `vertical_avatar_${scene.sceneId}.mp4`);

        // BLACK-SCREEN FIX: previous build used `pad=...` with no color
        // AND a non-alpha pix_fmt, so the top/bottom black bars from the
        // aspect-ratio mismatch showed through the overlay as a literal
        // black rectangle in the lower-left of every scene. We now:
        //   1) crop a wider square region of the source (so the face is
        //      visible top-to-bottom after scaling), and
        //   2) encode the avatar as yuva420p with TRANSPARENT padding
        //      (color=black@0.0) so any residual letterbox area shows
        //      the b-roll through it instead of a black bar.
        // The overlay uses `format=auto` so the alpha is respected.
        const preset = AVATAR_PRESETS[scene.sceneType] || AVATAR_PRESETS.default;
        const padColor = preset.bg || '0x1a1a2e';

        // Take a square crop of the source so the face fills the height
        // after we scale. The source is landscape (e.g. 1280x720), so we
        // crop a centered square and then scale it up to the sidebar.
        const squareCropSize = Math.min(sourceHeight, VIDEO_HEIGHT);
        const squareCropX = 0; // take the left part of the source — face is usually center-left
        const squareCropY = 0;

        const useTransparentPad = true; // safest: avatar letterbox = transparent
        const padSpec = useTransparentPad
          ? `pad=${sidebarWidth}:${VIDEO_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black@0.0`
          : `pad=${sidebarWidth}:${VIDEO_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=${padColor}`;

        const encoder = hasGpuEncoder()
          ? `-c:v h264_nvenc -preset p4 -pix_fmt yuv420p`
          : `-c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p`;

        const pixFmt = useTransparentPad ? `yuva420p` : `yuv420p`;

        await runFFmpeg(
          `ffmpeg -y -i "${avatarVideoPath}" ` +
          `-vf "crop=${squareCropSize}:${squareCropSize}:${squareCropX}:${squareCropY},scale=${sidebarWidth}:${VIDEO_HEIGHT},${padSpec},format=${pixFmt}" ` +
          `${encoder} ` +
          `-t ${scene.duration} "${avatarPath}"`
        );

        scene.addAsset('verticalAvatar', avatarPath);
        scene.avatarEnabled = true;
      }
    } else {
      // No avatar — mark the scene so the renderer knows to skip overlay
      scene.avatarEnabled = false;
      console.log(`[AvatarEngine] Scene ${scene.sceneId} has no avatar — avatar overlay will be skipped`);
      return scene;
    }

    // 2. Background: only emit a solid-color fallback when the renderer
    //    did NOT already provide a b-roll. Previously this function
    //    unconditionally overwrote scene.background with a 1-frame JPG
    //    of dark navy, which caused the entire scene to render as a
    //    solid dark frame even when a real b-roll was assigned upstream
    //    (the cropped b-roll MP4 was being discarded here).
    const existingBg = scene.getAsset && scene.getAsset('background');
    if (!existingBg || !fs.existsSync(existingBg)) {
      const bgPath = path.join(tempDir, `avatar_bg_${scene.sceneId}.jpg`);
      const preset = AVATAR_PRESETS[scene.sceneType] || AVATAR_PRESETS.default;
      const bgColor = preset.bg || '0x1a1a2e';

      await runFFmpeg(
        `ffmpeg -y -f lavfi -i "color=c=${bgColor}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:d=1,format=rgb24" ` +
        `-frames:v 1 "${bgPath}"`
      );

      scene.addAsset('background', bgPath);
    } else {
      console.log(`[AvatarEngine] Scene ${scene.sceneId} already has b-roll background — keeping it`);
    }
    return scene;
  } catch (error) {
    console.error('[AvatarEngine] Vertical frame creation failed:', error.message);
    scene.avatarEnabled = false;
    return scene;
  }
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  try {
    if (!fs.existsSync(AVATAR_CACHE_DIR)) return { count: 0, size: 0 };
    const files = fs.readdirSync(AVATAR_CACHE_DIR).filter(f => f.endsWith('.mp4'));
    let totalSize = 0;
    for (const f of files) {
      totalSize += fs.statSync(path.join(AVATAR_CACHE_DIR, f)).size;
    }
    return { count: files.length, size: totalSize };
  } catch {
    return { count: 0, size: 0 };
  }
}

/**
 * Clear expired cache entries (older than 24h)
 */
function clearExpiredCache() {
  try {
    if (!fs.existsSync(AVATAR_CACHE_DIR)) return 0;
    const files = fs.readdirSync(AVATAR_CACHE_DIR).filter(f => f.endsWith('.mp4'));
    let cleared = 0;
    for (const f of files) {
      const filePath = path.join(AVATAR_CACHE_DIR, f);
      const stat = fs.statSync(filePath);
      if (Date.now() - stat.mtimeMs > 86400000) {
        fs.unlinkSync(filePath);
        cleared++;
      }
    }
    return cleared;
  } catch {
    return 0;
  }
}

// ---------- EXPORTS ----------

module.exports = {
  // Constants
  AVATAR_PRESETS,
  KEN_BURNS_PARAMS,
  AVATAR_CACHE_DIR,
  UPLOADS_DIR,
  PUBLIC_DIR,

  // Core functions
  createAvatarVideo,
  createSceneAvatar,
  createVerticalAvatarFrame,
  createUserAvatarImage,
  getFallbackAvatarFrame,
  applyKenBurns,
  generateAvatarViaReplicate,
  generateAvatarViaFlux,
  generateAvatarViaNvidiaNim,

  // GPU
  hasGpuEncoder,

  // Cache
  getCachedAvatar,
  cacheAvatar,
  getCacheStats,
  clearExpiredCache,
  hashImageSource,

  // Helpers
  runFFmpeg,
};
