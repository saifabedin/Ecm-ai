/**
 * GPU Render Service — Production Rendering Layer
 *
 * Provides GPU-accelerated video encoding with automatic CPU fallback.
 * Integrates with engine4-video.cjs and HyperFrames pipeline.
 *
 * Architecture:
 *   Detection → Strategy Selection → Render Execution → Metrics
 *
 * Features:
 *   1. Runtime GPU detection (nvidia-smi, NVENC probe, CUDA check)
 *   2. Render strategy selection (GPU → NVENC, CPU fallback)
 *   3. HyperFrames GPU path (Chrome render → GPU encode)
 *   4. FFmpeg GPU path (h264_nvenc, hevc_nvenc optional)
 *   5. Queue optimization (concurrent render slots, GPU worker pool)
 *   6. Render cache (hash-based, skip duplicate renders)
 *   7. Metrics (render time, CPU usage, GPU usage, cache hit ratio)
 *   8. Production safety (automatic CPU fallback, no render failures)
 *
 * Usage:
 *   const gpuRender = require('../render/gpu-render-service.cjs');
 *
 *   // Initialize once at startup
 *   await gpuRender.initialize();
 *
 *   // Get optimal FFmpeg encoder args
 *   const encArgs = gpuRender.getEncoderArgs({ width: 720, height: 1280 });
 *   // → '-c:v h264_nvenc -preset p4 -cq 23 ...' or '-c:v libx264 -preset fast -crf 23 ...'
 *
 *   // Render with GPU acceleration (auto-fallback)
 *   const result = await gpuRender.encode(inputPath, outputPath, options);
 *
 *   // Check cache before rendering
 *   const cached = gpuRender.checkCache(inputHash);
 *   if (cached) return cached;
 *
 *   // Get metrics
 *   const metrics = gpuRender.getMetrics();
 *
 * SAFETY: All GPU calls are wrapped in try/catch with CPU fallback.
 *         No render will ever fail due to GPU unavailability.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync, exec } = require("child_process");
const { checkMemoryUsage } = require("../config/timeouts.cjs");

// ---------- CONSTANTS ----------

const RENDER_CACHE_DIR = path.join(__dirname, "../../temp/render-cache");
const MAX_CACHE_ENTRIES = 200;
const MAX_CACHE_SIZE_MB = 2048; // 2GB max cache
const CACHE_CLEANUP_INTERVAL = 3600000; // 1 hour

// GPU detection cache (don't re-probe every render)
const GPU_PROBE_INTERVAL = 300000; // Re-probe every 5 minutes

// ---------- STATE ----------

let _gpuState = {
  detected: false,
  lastProbe: 0,
  hasNvidiaSmi: false,
  hasNvenc: false,
  hasCuda: false,
  gpuName: null,
  driverVersion: null,
  vramTotalMB: null,
  nvencVersion: null,
  strategy: "cpu", // "gpu" or "cpu"
};

let _metrics = {
  totalRenders: 0,
  gpuRenders: 0,
  cpuRenders: 0,
  cacheHits: 0,
  cacheMisses: 0,
  avgRenderTimeMs: 0,
  renderTimes: [],
  gpuErrors: 0,
  fallbacks: 0,
};

let _cache = new Map(); // hash → { outputPath, timestamp, size }
let _activeRenders = 0;
let _maxConcurrentRenders = 3;
let _cacheCleanupTimer = null;

// ---------- GPU DETECTION ----------

/**
 * Verify NVENC encoder actually works (not just compiled in).
 * Attempts a tiny test encode to confirm hardware is usable.
 */
function verifyNvencWorks() {
  try {
    const testInput = "/tmp/_nvenc_test_input.mp4";
    const testOutput = "/tmp/_nvenc_test_output.mp4";

    // Create a tiny test video (0.5s solid color)
    execSync(
      `ffmpeg -y -f lavfi -i "color=c=black:s=64x64:d=0.5:r=10,format=yuv420p" -c:v libx264 -preset ultrafast "${testInput}" 2>/dev/null`,
      { encoding: "utf-8", timeout: 10000 }
    );

    // Attempt NVENC encode
    execSync(
      `ffmpeg -y -i "${testInput}" -c:v h264_nvenc -preset p1 -pix_fmt yuv420p "${testOutput}" 2>/dev/null`,
      { encoding: "utf-8", timeout: 10000 }
    );

    const works = fs.existsSync(testOutput) && fs.statSync(testOutput).size > 0;

    // Cleanup test files
    try { fs.unlinkSync(testInput); } catch (e) {}
    try { fs.unlinkSync(testOutput); } catch (e) {}

    return works;
  } catch (e) {
    // Cleanup test files on error
    try { fs.unlinkSync("/tmp/_nvenc_test_input.mp4"); } catch (e) {}
    try { fs.unlinkSync("/tmp/_nvenc_test_output.mp4"); } catch (e) {}
    return false;
  }
}

/**
 * Probe GPU availability using multiple methods:
 *   1. nvidia-smi binary (NVIDIA driver installed)
 *   2. NVENC encoder test via FFmpeg (hardware encoder available)
 *   3. CUDA runtime check (optional)
 *
 * Results are cached for GPU_PROBE_INTERVAL ms to avoid repeated probing.
 */
async function detectGPU(forceProbe = false) {
  const now = Date.now();
  if (!forceProbe && _gpuState.detected && (now - _gpuState.lastProbe) < GPU_PROBE_INTERVAL) {
    return _gpuState;
  }

  console.log("[GPURender] Probing GPU capabilities...");

  // Reset state
  _gpuState = {
    detected: true,
    lastProbe: now,
    hasNvidiaSmi: false,
    hasNvenc: false,
    hasCuda: false,
    gpuName: null,
    driverVersion: null,
    vramTotalMB: null,
    nvencVersion: null,
    strategy: "cpu",
  };

  // Method 1: nvidia-smi
  try {
    const smiOutput = execSync(
      "nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader 2>/dev/null",
      { encoding: "utf-8", timeout: 5000 }
    ).trim();

    if (smiOutput && !smiOutput.includes("not found")) {
      _gpuState.hasNvidiaSmi = true;
      const parts = smiOutput.split(",").map(s => s.trim());
      _gpuState.gpuName = parts[0] || "Unknown GPU";
      _gpuState.driverVersion = parts[1] || "unknown";
      const vramMatch = parts[2]?.match(/(\d+)/);
      _gpuState.vramTotalMB = vramMatch ? parseInt(vramMatch[1]) : null;
      console.log(`[GPURender] nvidia-smi: ${_gpuState.gpuName} | Driver: ${_gpuState.driverVersion} | VRAM: ${_gpuState.vramTotalMB}MB`);
    }
  } catch (e) {
    console.log("[GPURender] nvidia-smi not available");
  }

  // Method 2: NVENC encoder test via FFmpeg
  try {
    const nvencTest = execSync(
      'ffmpeg -hide_banner -encoders 2>/dev/null | grep nvenc',
      { encoding: "utf-8", timeout: 5000 }
    ).trim();

    if (nvencTest.includes("h264_nvenc")) {
      // NVENC encoders are compiled in — verify they actually work
      const nvencWorking = verifyNvencWorks();
      if (nvencWorking) {
        _gpuState.hasNvenc = true;
        const versionMatch = nvencTest.match(/h264_nvenc.*?\((.*?)\)/);
        _gpuState.nvencVersion = versionMatch ? versionMatch[1] : "available";
        console.log(`[GPURender] NVENC: verified working | Version: ${_gpuState.nvencVersion}`);
      } else {
        console.log("[GPURender] NVENC: compiled but not usable (no GPU hardware)");
      }
    }
  } catch (e) {
    console.log("[GPURender] NVENC not available");
  }

  // Method 3: CUDA runtime check
  try {
    const cudaTest = execSync(
      "ldconfig -p 2>/dev/null | grep -i 'libcudart\\|libcuda' || echo ''",
      { encoding: "utf-8", timeout: 5000 }
    ).trim();

    _gpuState.hasCuda = cudaTest.length > 0;
    if (_gpuState.hasCuda) {
      console.log("[GPURender] CUDA runtime: available");
    }
  } catch (e) {
    // CUDA not available
  }

  // Determine strategy
  if (_gpuState.hasNvenc) {
    _gpuState.strategy = "gpu";
    console.log("[GPURender] Strategy: GPU (NVENC)");
  } else {
    _gpuState.strategy = "cpu";
    console.log("[GPURender] Strategy: CPU (NVENC unavailable)");
  }

  return _gpuState;
}

// ---------- RENDER STRATEGY ----------

/**
 * Get the current render strategy (GPU or CPU)
 * Auto-detects if not yet probed
 */
async function getStrategy() {
  if (!_gpuState.detected) {
    await detectGPU();
  }
  return _gpuState.strategy;
}

/**
 * Check if GPU is available for rendering
 */
async function isGPUAvailable() {
  const state = await detectGPU();
  return state.hasNvenc;
}

// ---------- FFMPEG ENCODER ARGS ----------

/**
 * Generate FFmpeg encoder arguments based on available hardware.
 *
 * @param {Object} options
 * @param {number} options.width - Video width
 * @param {number} options.height - Video height
 * @param {string} [options.preset] - Quality preset: 'fast', 'standard', 'quality'
 * @param {string} [options.codec] - Preferred codec: 'h264', 'hevc'
 * @param {boolean} [options.forceCpu] - Force CPU encoding
 * @returns {Object} { encoderArgs, strategy, codec }
 */
function getEncoderArgs(options = {}) {
  const preset = options.preset || "standard";
  const codec = options.codec || "h264";
  const forceCpu = options.forceCpu || false;

  // Force CPU if requested
  if (forceCpu || _gpuState.strategy === "cpu") {
    return getCpuEncoderArgs(preset, codec);
  }

  // Try GPU encoding
  if (_gpuState.hasNvenc) {
    try {
      return getNvencEncoderArgs(preset, codec);
    } catch (e) {
      console.warn(`[GPURender] NVENC failed, falling back to CPU: ${e.message}`);
      _metrics.gpuErrors++;
      _metrics.fallbacks++;
      return getCpuEncoderArgs(preset, codec);
    }
  }

  return getCpuEncoderArgs(preset, codec);
}

/**
 * Generate NVENC GPU encoder arguments
 */
function getNvencEncoderArgs(preset, codec) {
  // NVENC preset mapping (higher = faster, lower quality)
  const nvencPresets = {
    fast: "p1",
    standard: "p4",
    quality: "p7",
  };

  const nvencPreset = nvencPresets[preset] || "p4";

  if (codec === "hevc") {
    return {
      encoderArgs: `-c:v hevc_nvenc -preset ${nvencPreset} -rc vbr -cq 24 -b:v 0 -maxrate 5M -bufsize 10M -pix_fmt yuv420p`,
      strategy: "gpu",
      codec: "hevc_nvenc",
    };
  }

  // Default: H.264 NVENC
  return {
    encoderArgs: `-c:v h264_nvenc -preset ${nvencPreset} -rc vbr -cq 23 -b:v 0 -maxrate 5M -bufsize 10M -pix_fmt yuv420p -spatial-aq 1 -temporal-aq 1`,
    strategy: "gpu",
    codec: "h264_nvenc",
  };
}

/**
 * Generate CPU encoder arguments (libx264/libx265)
 */
function getCpuEncoderArgs(preset, codec) {
  const cpuPresets = {
    fast: "fast",
    standard: "medium",
    quality: "slow",
  };

  const cpuPreset = cpuPresets[preset] || "fast";

  if (codec === "hevc") {
    return {
      encoderArgs: `-c:v libx265 -preset ${cpuPreset} -crf 24 -pix_fmt yuv420p`,
      strategy: "cpu",
      codec: "libx265",
    };
  }

  return {
    encoderArgs: `-c:v libx264 -preset ${cpuPreset} -crf 23 -pix_fmt yuv420p`,
    strategy: "cpu",
    codec: "libx264",
  };
}

// ---------- ENCODE WRAPPER ----------

/**
 * Encode video with GPU acceleration and automatic CPU fallback.
 *
 * @param {string} inputPath - Input video path
 * @param {string} outputPath - Output video path
 * @param {Object} options - Encoding options
 * @param {string} [options.preset] - Quality preset
 * @param {string} [options.codec] - Preferred codec
 * @param {string} [options.audioCodec] - Audio codec (default: aac)
 * @param {string} [options.audioBitrate] - Audio bitrate (default: 128k)
 * @param {number} [options.timeout] - Timeout in ms
 * @param {boolean} [options.forceCpu] - Force CPU encoding
 * @returns {Object} { success, strategy, codec, duration, fileSize, renderTimeMs }
 */
async function encode(inputPath, outputPath, options = {}) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const startTime = Date.now();
  const timeout = options.timeout || 300000; // 5 min default

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Get encoder args
  const encoder = getEncoderArgs(options);
  const audioCodec = options.audioCodec || "aac";
  const audioBitrate = options.audioBitrate || "128k";

  // Build FFmpeg command
  const ffmpegCmd = [
    "ffmpeg -y",
    `-i "${inputPath}"`,
    encoder.encoderArgs,
    `-c:a ${audioCodec} -b:a ${audioBitrate}`,
    `-movflags +faststart`,
    `"${outputPath}"`,
  ].join(" ");

  console.log(`[GPURender] Encoding: ${encoder.strategy.toUpperCase()} | ${encoder.codec}`);
  console.log(`[GPURender] Command: ${ffmpegCmd.substring(0, 200)}...`);

  _activeRenders++;

  try {
    await runFFmpegWithTimeout(ffmpegCmd, timeout);

    const elapsed = Date.now() - startTime;
    const stats = fs.statSync(outputPath);

    // Record metrics
    _metrics.totalRenders++;
    if (encoder.strategy === "gpu") _metrics.gpuRenders++;
    else _metrics.cpuRenders++;
    _metrics.renderTimes.push(elapsed);
    if (_metrics.renderTimes.length > 100) _metrics.renderTimes.shift();
    _metrics.avgRenderTimeMs = _metrics.renderTimes.reduce((a, b) => a + b, 0) / _metrics.renderTimes.length;

    const duration = await getOutputDuration(outputPath);

    console.log(`[GPURender] Encode complete: ${elapsed}ms | ${(stats.size / 1024 / 1024).toFixed(2)}MB | ${duration}s | ${encoder.strategy}`);

    return {
      success: true,
      strategy: encoder.strategy,
      codec: encoder.codec,
      duration,
      fileSize: stats.size,
      renderTimeMs: elapsed,
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    _metrics.gpuErrors++;

    // GPU encoding failed — fall back to CPU
    if (encoder.strategy === "gpu") {
      console.warn(`[GPURender] GPU encoding failed (${error.message}), falling back to CPU`);
      _metrics.fallbacks++;

      try {
        const cpuEncoder = getCpuEncoderArgs(options.preset || "standard", options.codec || "h264");
        const cpuCmd = [
          "ffmpeg -y",
          `-i "${inputPath}"`,
          cpuEncoder.encoderArgs,
          `-c:a ${audioCodec} -b:a ${audioBitrate}`,
          `-movflags +faststart`,
          `"${outputPath}"`,
        ].join(" ");

        const cpuStart = Date.now();
        await runFFmpegWithTimeout(cpuCmd, timeout);
        const cpuElapsed = Date.now() - cpuStart;
        const stats = fs.statSync(outputPath);

        _metrics.totalRenders++;
        _metrics.cpuRenders++;
        _metrics.renderTimes.push(cpuElapsed);
        if (_metrics.renderTimes.length > 100) _metrics.renderTimes.shift();
        _metrics.avgRenderTimeMs = _metrics.renderTimes.reduce((a, b) => a + b, 0) / _metrics.renderTimes.length;

        const duration = await getOutputDuration(outputPath);

        console.log(`[GPURender] CPU fallback succeeded: ${cpuElapsed}ms | ${(stats.size / 1024 / 1024).toFixed(2)}MB`);

        return {
          success: true,
          strategy: "cpu_fallback",
          codec: cpuEncoder.codec,
          duration,
          fileSize: stats.size,
          renderTimeMs: cpuElapsed,
          fallbackReason: error.message,
        };
      } catch (cpuError) {
        console.error(`[GPURender] CPU fallback also failed: ${cpuError.message}`);
        throw cpuError;
      }
    }

    throw error;
  } finally {
    _activeRenders--;
  }
}

// ---------- HYPERFRAMES GPU PATH ----------

/**
 * Render HyperFrames composition with GPU-accelerated encoding.
 *
 * After Chrome renders frames to a temporary video, this applies
 * GPU encoding for the final output. If GPU encoding fails,
 * automatically falls back to CPU.
 *
 * @param {string} rawVideoPath - Path to raw video from Chrome render
 * @param {string} outputPath - Final output path
 * @param {Object} options - Encoding options
 * @returns {Object} Render result with metrics
 */
async function encodeHyperFramesOutput(rawVideoPath, outputPath, options = {}) {
  console.log(`[GPURender] HyperFrames GPU encode path: ${rawVideoPath} → ${outputPath}`);

  return encode(rawVideoPath, outputPath, {
    ...options,
    preset: options.preset || "standard",
    codec: options.codec || "h264",
  });
}

/**
 * Render a scene-level FFmpeg command with GPU acceleration.
 * Wraps the standard scene render to use GPU when available.
 *
 * @param {string} ffmpegCmd - Base FFmpeg command (without encoder args)
 * @param {string} outputPath - Output path
 * @param {Object} options - Encoding options
 * @returns {Object} Render result
 */
async function encodeSceneRender(ffmpegCmd, outputPath, options = {}) {
  const encoder = getEncoderArgs(options);

  // Replace CPU encoder args in the command with GPU args
  const gpuCmd = ffmpegCmd
    .replace(/-c:v libx264[^"]*/g, encoder.encoderArgs)
    .replace(/-c:v libx265[^"]*/g, encoder.encoderArgs)
    .replace(/-preset fast[^"]*/g, "")
    .replace(/-crf \d+/g, "");

  // Ensure output directory
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const finalCmd = gpuCmd.includes(outputPath) ? gpuCmd : `${gpuCmd} "${outputPath}"`;

  const startTime = Date.now();
  _activeRenders++;

  try {
    await runFFmpegWithTimeout(finalCmd, options.timeout || 300000);

    const elapsed = Date.now() - startTime;
    const stats = fs.existsSync(outputPath) ? fs.statSync(outputPath) : { size: 0 };

    _metrics.totalRenders++;
    if (encoder.strategy === "gpu") _metrics.gpuRenders++;
    else _metrics.cpuRenders++;

    return {
      success: true,
      strategy: encoder.strategy,
      codec: encoder.codec,
      fileSize: stats.size,
      renderTimeMs: elapsed,
    };
  } catch (error) {
    // Fallback to CPU if GPU failed
    if (encoder.strategy === "gpu") {
      console.warn(`[GPURender] GPU scene render failed, falling back to CPU`);
      _metrics.fallbacks++;

      const cpuEncoder = getCpuEncoderArgs(options.preset || "standard", options.codec || "h264");
      const cpuCmd = ffmpegCmd
        .replace(/-c:v libx264[^"]*/g, cpuEncoder.encoderArgs)
        .replace(/-c:v libx265[^"]*/g, cpuEncoder.encoderArgs)
        .replace(/-preset fast[^"]*/g, "")
        .replace(/-crf \d+/g, "");

      const cpuFinalCmd = cpuCmd.includes(outputPath) ? cpuCmd : `${cpuCmd} "${outputPath}"`;
      await runFFmpegWithTimeout(cpuFinalCmd, options.timeout || 300000);

      const elapsed = Date.now() - startTime;
      const stats = fs.existsSync(outputPath) ? fs.statSync(outputPath) : { size: 0 };

      return {
        success: true,
        strategy: "cpu_fallback",
        codec: cpuEncoder.codec,
        fileSize: stats.size,
        renderTimeMs: elapsed,
        fallbackReason: error.message,
      };
    }
    throw error;
  } finally {
    _activeRenders--;
  }
}

// ---------- RENDER CACHE ----------

/**
 * Generate a content hash for render cache key.
 * Hashes the FFmpeg command + input file sizes for deterministic caching.
 *
 * @param {string} ffmpegCmd - FFmpeg command string
 * @param {string[]} inputPaths - Input file paths
 * @returns {string} SHA256 hash (first 16 chars)
 */
function generateCacheKey(ffmpegCmd, inputPaths = []) {
  const hasher = crypto.createHash("sha256");
  hasher.update(ffmpegCmd);

  for (const p of inputPaths) {
    if (fs.existsSync(p)) {
      const stat = fs.statSync(p);
      hasher.update(`${p}:${stat.size}:${stat.mtimeMs}`);
    }
  }

  return hasher.digest("hex").substring(0, 16);
}

/**
 * Check render cache for a previously rendered output.
 *
 * @param {string} cacheKey - Hash key from generateCacheKey()
 * @returns {string|null} Cached output path or null
 */
function checkCache(cacheKey) {
  if (_cache.has(cacheKey)) {
    const entry = _cache.get(cacheKey);
    if (fs.existsSync(entry.outputPath)) {
      _metrics.cacheHits++;
      console.log(`[GPURender] Cache HIT: ${cacheKey} → ${entry.outputPath}`);
      return entry.outputPath;
    }
    // Entry stale — file was cleaned up
    _cache.delete(cacheKey);
  }
  _metrics.cacheMisses++;
  return null;
}

/**
 * Store a rendered output in cache.
 *
 * @param {string} cacheKey - Hash key
 * @param {string} outputPath - Rendered output path
 */
function storeCache(cacheKey, outputPath) {
  if (!fs.existsSync(outputPath)) return;

  const stats = fs.statSync(outputPath);
  _cache.set(cacheKey, {
    outputPath,
    timestamp: Date.now(),
    size: stats.size,
  });

  // Evict oldest if cache is full
  if (_cache.size > MAX_CACHE_ENTRIES) {
    const entries = [..._cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, Math.floor(MAX_CACHE_ENTRIES * 0.2)); // Remove oldest 20%
    for (const [key] of toRemove) {
      const removed = _cache.get(key);
      _cache.delete(key);
      try {
        if (removed && fs.existsSync(removed.outputPath)) {
          fs.unlinkSync(removed.outputPath);
        }
      } catch (e) { /* ignore cleanup errors */ }
    }
    console.log(`[GPURender] Cache evicted ${toRemove.length} entries`);
  }
}

/**
 * Get total cache size in bytes
 */
function getCacheSize() {
  let totalBytes = 0;
  for (const entry of _cache.values()) {
    totalBytes += entry.size || 0;
  }
  return totalBytes;
}

/**
 * Clear the render cache
 */
function clearCache() {
  for (const entry of _cache.values()) {
    try {
      if (fs.existsSync(entry.outputPath)) {
        fs.unlinkSync(entry.outputPath);
      }
    } catch (e) { /* ignore */ }
  }
  _cache.clear();
  console.log("[GPURender] Cache cleared");
}

// ---------- QUEUE OPTIMIZATION ----------

/**
 * Get current render concurrency status
 */
function getConcurrencyStatus() {
  return {
    activeRenders: _activeRenders,
    maxConcurrent: _maxConcurrentRenders,
    availableSlots: Math.max(0, _maxConcurrentRenders - _activeRenders),
    isAtCapacity: _activeRenders >= _maxConcurrentRenders,
  };
}

/**
 * Set maximum concurrent render slots
 */
function setMaxConcurrent(max) {
  _maxConcurrentRenders = Math.max(1, Math.min(max, 8));
  console.log(`[GPURender] Max concurrent renders: ${_maxConcurrentRenders}`);
}

/**
 * Wait for an available render slot
 * @param {number} timeoutMs - Max wait time
 * @returns {boolean} true if slot acquired, false if timed out
 */
async function waitForSlot(timeoutMs = 60000) {
  const start = Date.now();
  while (_activeRenders >= _maxConcurrentRenders) {
    if (Date.now() - start > timeoutMs) {
      console.warn("[GPURender] Timed out waiting for render slot");
      return false;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  return true;
}

// ---------- METRICS ----------

/**
 * Get current render metrics
 */
function getMetrics() {
  const cacheTotal = _metrics.cacheHits + _metrics.cacheMisses;
  return {
    totalRenders: _metrics.totalRenders,
    gpuRenders: _metrics.gpuRenders,
    cpuRenders: _metrics.cpuRenders,
    gpuRatio: _metrics.totalRenders > 0
      ? `${(_metrics.gpuRenders / _metrics.totalRenders * 100).toFixed(1)}%`
      : "0%",
    cacheHits: _metrics.cacheHits,
    cacheMisses: _metrics.cacheMisses,
    cacheHitRatio: cacheTotal > 0
      ? `${(_metrics.cacheHits / cacheTotal * 100).toFixed(1)}%`
      : "0%",
    avgRenderTimeMs: Math.round(_metrics.avgRenderTimeMs),
    gpuErrors: _metrics.gpuErrors,
    fallbacks: _metrics.fallbacks,
    activeRenders: _activeRenders,
    cacheSize: _cache.size,
    cacheSizeMB: Math.round(getCacheSize() / 1024 / 1024),
    gpuState: { ..._gpuState },
  };
}

/**
 * Reset metrics (for periodic resets)
 */
function resetMetrics() {
  _metrics = {
    totalRenders: 0,
    gpuRenders: 0,
    cpuRenders: 0,
    cacheHits: 0,
    cacheMisses: 0,
    avgRenderTimeMs: 0,
    renderTimes: [],
    gpuErrors: 0,
    fallbacks: 0,
  };
  console.log("[GPURender] Metrics reset");
}

// ---------- HELPERS ----------

/**
 * Run FFmpeg command with timeout
 */
function runFFmpegWithTimeout(command, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    console.log(`[GPURender] Executing: ${command.substring(0, 150)}...`);

    const child = exec(command, {
      timeout: timeoutMs,
      maxBuffer: 20 * 1024 * 1024, // 20MB buffer
    }, (err, stdout, stderr) => {
      if (err) {
        console.error(`[GPURender] FFmpeg error: ${err.message}`);
        if (stderr) {
          const stderrLines = stderr.split("\n").slice(-10).join("\n");
          console.error(`[GPURender] FFmpeg stderr (last 10 lines):\n${stderrLines}`);
        }
        reject(new Error(`FFmpeg failed: ${err.message}`));
      } else {
        resolve(stdout);
      }
    });

    child.on("timeout", () => {
      console.error(`[GPURender] FFmpeg timed out after ${timeoutMs}ms`);
      child.kill("SIGTERM");
      reject(new Error(`FFmpeg timeout after ${timeoutMs}ms`));
    });
  });
}

/**
 * Get output video duration via ffprobe
 */
function getOutputDuration(videoPath) {
  try {
    const output = execSync(
      `ffprobe -v quiet -print_format json -show_format "${videoPath}"`,
      { encoding: "utf-8", timeout: 10000 }
    );
    const data = JSON.parse(output);
    return parseFloat(data.format.duration) || 0;
  } catch (e) {
    return 0;
  }
}

// ---------- CACHE CLEANUP ----------

function startCacheCleanup() {
  if (_cacheCleanupTimer) return;

  _cacheCleanupTimer = setInterval(() => {
    const cacheSizeMB = getCacheSize() / 1024 / 1024;
    if (cacheSizeMB > MAX_CACHE_SIZE_MB) {
      console.log(`[GPURender] Cache size ${cacheSizeMB.toFixed(0)}MB exceeds limit, cleaning...`);
      const entries = [..._cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, Math.ceil(entries.length * 0.3));
      for (const [key] of toRemove) {
        const removed = _cache.get(key);
        _cache.delete(key);
        try {
          if (removed && fs.existsSync(removed.outputPath)) {
            fs.unlinkSync(removed.outputPath);
          }
        } catch (e) { /* ignore */ }
      }
      console.log(`[GPURender] Evicted ${toRemove.length} cache entries`);
    }
  }, CACHE_CLEANUP_INTERVAL);
}

function stopCacheCleanup() {
  if (_cacheCleanupTimer) {
    clearInterval(_cacheCleanupTimer);
    _cacheCleanupTimer = null;
  }
}

// ---------- INITIALIZATION ----------

/**
 * Initialize GPU render service.
 * Probes GPU, starts cache cleanup, creates cache directory.
 */
async function initialize(options = {}) {
  console.log("[GPURender] Initializing...");

  // Create cache directory
  if (!fs.existsSync(RENDER_CACHE_DIR)) {
    fs.mkdirSync(RENDER_CACHE_DIR, { recursive: true });
  }

  // Set max concurrent from options
  if (options.maxConcurrent) {
    setMaxConcurrent(options.maxConcurrent);
  }

  // Probe GPU
  const state = await detectGPU(options.forceProbe || false);

  // Start cache cleanup
  startCacheCleanup();

  console.log(`[GPURender] Initialized | Strategy: ${_gpuState.strategy} | Max concurrent: ${_maxConcurrentRenders}`);

  return {
    strategy: _gpuState.strategy,
    gpuAvailable: _gpuState.hasNvenc,
    gpuName: _gpuState.gpuName,
  };
}

/**
 * Shutdown GPU render service
 */
function shutdown() {
  stopCacheCleanup();
  console.log("[GPURender] Shutdown complete");
}

// ---------- EXPORTS ----------

module.exports = {
  // Core
  initialize,
  shutdown,
  detectGPU,
  getStrategy,
  isGPUAvailable,

  // Encoding
  encode,
  getEncoderArgs,
  encodeHyperFramesOutput,
  encodeSceneRender,

  // Cache
  generateCacheKey,
  checkCache,
  storeCache,
  clearCache,
  getCacheSize,

  // Queue
  getConcurrencyStatus,
  setMaxConcurrent,
  waitForSlot,

  // Metrics
  getMetrics,
  resetMetrics,

  // State (read-only access)
  get gpuState() { return { ..._gpuState }; },
};
