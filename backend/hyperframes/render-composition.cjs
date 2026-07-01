/**
 * HyperFrames Render Composition Wrapper
 *
 * Safely executes HyperFrames rendering from a composition-generator output.
 * Manages Chrome lifecycle, timeouts, memory, and cleanup.
 *
 * This module is ISOLATED — it does NOT modify engine4-video.cjs or the
 * worker queue. It provides a drop-in render function for future integration.
 *
 * Usage:
 *   const { renderComposition } = require('./backend/hyperframes/render-composition.cjs');
 *   const result = await renderComposition({
 *     projectDir: '/tmp/render-project',
 *     htmlPath: '/tmp/render-project/index.html',
 *     outputDir: '/tmp/render-output',
 *     options: {
 *       fps: 30,
 *       quality: 'standard',
 *       workers: 1,
 *       timeoutMs: 900000,
 *     }
 *   });
 *
 * Returns:
 *   {
 *     success: true,
 *     outputPath: '/tmp/render-output/rendered.mp4',
 *     duration: 22.5,
 *     fileSize: 2289934,
 *     renderTimeMs: 140580,
 *     memoryPeakMB: 256,
 *   }
 */

const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { getRenderFunctions } = require("./hyperframes-loader.cjs");
const CHROME_PATH =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  "/home/ubuntu/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome";
const { checkMemoryUsage, TIMEOUTS } = require("../config/timeouts.cjs");

// ---------- CONSTANTS ----------

const DEFAULT_RENDER_TIMEOUT = TIMEOUTS.CINEMATIC_RENDER; // 15 minutes
const DEFAULT_FPS = 30;
const DEFAULT_QUALITY = "standard";
const DEFAULT_WORKERS = 1;

// ---------- CLEANUP UTILITIES ----------

/**
 * Safely remove a file or directory, ignoring errors
 */
function safeRemove(targetPath) {
  if (!targetPath || typeof targetPath !== "string") return;
  try {
    if (fs.existsSync(targetPath)) {
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(targetPath);
      }
    }
  } catch (e) {
    console.warn(`[HyperFrames Render] Failed to cleanup ${targetPath}:`, e.message);
  }
}

/**
 * Clean up HyperFrames work directories left by the producer
 * Pattern: work-<uuid> directories in the output path parent
 */
function cleanupWorkDirs(baseDir) {
  if (!baseDir || !fs.existsSync(baseDir)) return 0;

  let cleaned = 0;
  try {
    const entries = fs.readdirSync(baseDir);
    for (const entry of entries) {
      if (entry.startsWith("work-")) {
        const fullPath = path.join(baseDir, entry);
        safeRemove(fullPath);
        cleaned++;
      }
    }
  } catch (e) {
    console.warn("[HyperFrames Render] Failed to scan for work dirs:", e.message);
  }
  return cleaned;
}

/**
 * Kill any lingering chrome-headless-shell processes
 * Returns count of processes killed
 */
function cleanupChromeProcesses() {
  try {
    const result = execSync(
      "pgrep -f 'chrome-headless-shell' 2>/dev/null || true",
      { encoding: "utf-8" }
    ).trim();

    if (!result) return 0;

    const pids = result.split("\n").filter(Boolean);
    for (const pid of pids) {
      try {
        process.kill(parseInt(pid), "SIGTERM");
      } catch (e) {
        // Process may have already exited
      }
    }
    return pids.length;
  } catch (e) {
    console.warn("[HyperFrames Render] Failed to check Chrome processes:", e.message);
    return 0;
  }
}

/**
 * Verify no Chrome zombie processes remain
 */
function verifyChromeCleanup() {
  try {
    const count = parseInt(
      execSync("pgrep -c chrome 2>/dev/null || echo 0", { encoding: "utf-8" }).trim()
    );
    return count === 0;
  } catch (e) {
    return true; // If we can't check, assume clean
  }
}

/**
 * Full cleanup after render — always called on success or failure
 */
function fullCleanup(paths) {
  const { workDir, outputDir, projectDir, keepProject, outputPath } = paths;

  // Clean work directories from the project dir (where HyperFrames creates them)
  const workCleaned = cleanupWorkDirs(projectDir || workDir);

  // Clean Chrome processes
  const chromeKilled = cleanupChromeProcesses();

  // Clean project directory only if not keeping it
  // But NEVER remove the outputPath or its parent outputDir
  if (projectDir && !keepProject) {
    // Ensure we don't accidentally remove the output directory
    const absOutputDir = outputDir ? path.resolve(outputDir) : null;
    const absProjectDir = path.resolve(projectDir);
    // Only remove projectDir if outputDir is not inside it
    if (!absOutputDir || !absOutputDir.startsWith(absProjectDir)) {
      safeRemove(projectDir);
    }
  }

  return {
    workDirsCleaned: workCleaned,
    chromeProcessesKilled: chromeKilled,
    projectDirKept: keepProject || (outputDir && path.resolve(outputDir).startsWith(path.resolve(projectDir || ''))),
  };
}

// ---------- RENDER EXECUTION ----------

/**
 * Execute HyperFrames render with full safety guarantees
 *
 * @param {Object} config
 * @param {string} config.projectDir - Directory containing index.html and assets/
 * @param {string} [config.htmlPath] - Path to index.html (defaults to projectDir/index.html)
 * @param {string} config.outputDir - Directory for output MP4
 * @param {string} [config.outputFilename] - Output filename (default: rendered.mp4)
 * @param {Object} [config.options] - Render options
 * @param {number} [config.options.fps] - Frames per second (default: 30)
 * @param {string} [config.options.quality] - Quality preset (default: 'standard')
 * @param {number} [config.options.workers] - Chrome workers (default: 1)
 * @param {number} [config.options.timeoutMs] - Render timeout in ms (default: 900000)
 * @param {boolean} [config.options.keepProject] - Keep project dir after render (default: false)
 * @param {boolean} [config.options.debug] - Enable debug logging (default: false)
 * @returns {Object} Render result or error
 */
async function renderComposition(config) {
  const {
    projectDir,
    htmlPath,
    outputDir,
    outputFilename = "rendered.mp4",
    options = {},
  } = config;

  const fps = options.fps || DEFAULT_FPS;
  const quality = options.quality || DEFAULT_QUALITY;
  const workers = options.workers || DEFAULT_WORKERS;
  const timeoutMs = options.timeoutMs || DEFAULT_RENDER_TIMEOUT;
  const keepProject = options.keepProject || false;
  const debug = options.debug || false;

  const actualHtmlPath = htmlPath || path.join(projectDir, "index.html");
  const actualOutputPath = path.join(outputDir, outputFilename);

  // Validate inputs
  if (!projectDir || !fs.existsSync(projectDir)) {
    return normalizeError("projectDir not found", projectDir);
  }
  if (!fs.existsSync(actualHtmlPath)) {
    return normalizeError("Composition HTML not found", actualHtmlPath);
  }

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  const startTime = Date.now();
  const memBefore = checkMemoryUsage();

  console.log(`[HyperFrames Render] Starting render`);
  console.log(`[HyperFrames Render] Project: ${projectDir}`);
  console.log(`[HyperFrames Render] Output: ${actualOutputPath}`);
  console.log(`[HyperFrames Render] Options: fps=${fps}, quality=${quality}, workers=${workers}`);
  console.log(`[HyperFrames Render] Timeout: ${timeoutMs / 1000}s`);
  console.log(`[HyperFrames Render] Memory before: ${memBefore.heapUsedMB}MB`);

  let timeoutHandle = null;
  let renderAborted = false;

  try {
      // Create render job (HyperFrames producer is ESM-only; load via loader)
      const { createRenderJob: createJobFn } = await getRenderFunctions();
      const job = createJobFn({
        input: actualHtmlPath,
        output: actualOutputPath,
        fps: { num: fps, den: 1 },
        quality,
        workers,
        debug,
      });

    console.log(`[HyperFrames Render] Job created: ${job.id}`);

    // Set up timeout
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        renderAborted = true;
        reject(new Error(`Render timeout after ${timeoutMs / 1000}s`));
      }, timeoutMs);
    });

      // Execute render with timeout race
      const { executeRenderJob: executeJob } =
        await getRenderFunctions();
      await Promise.race([
        executeJob(job, projectDir, actualOutputPath),
        timeoutPromise,
      ]);

    // Clear timeout
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }

    if (renderAborted) {
      return normalizeError("Render was aborted due to timeout", actualOutputPath);
    }

    // Verify output
    if (!fs.existsSync(actualOutputPath)) {
      return normalizeError("Render completed but output file not found", actualOutputPath);
    }

    const stats = fs.statSync(actualOutputPath);
    const duration = getVideoDuration(actualOutputPath);
    const memAfter = checkMemoryUsage();
    const elapsed = Date.now() - startTime;

    console.log(`[HyperFrames Render] Render completed in ${elapsed}ms`);
    console.log(`[HyperFrames Render] Output: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
    console.log(`[HyperFrames Render] Duration: ${duration}s`);
    console.log(`[HyperFrames Render] Memory after: ${memAfter.heapUsedMB}MB (delta: ${memAfter.heapUsedMB - memBefore.heapUsedMB}MB)`);

    return {
      success: true,
      outputPath: actualOutputPath,
      duration,
      fileSize: stats.size,
      renderTimeMs: elapsed,
      memoryBeforeMB: memBefore.heapUsedMB,
      memoryAfterMB: memAfter.heapUsedMB,
      memoryDeltaMB: memAfter.heapUsedMB - memBefore.heapUsedMB,
      jobId: job.id,
    };
  } catch (error) {
    // Clear timeout
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }

    const elapsed = Date.now() - startTime;
    const memAfter = checkMemoryUsage();

    console.error(`[HyperFrames Render] Render failed after ${elapsed}ms:`, error.message);
    console.error(`[HyperFrames Render] Memory after failure: ${memAfter.heapUsedMB}MB`);

    // Clean up partial output file
    if (fs.existsSync(actualOutputPath)) {
      try {
        const partialStats = fs.statSync(actualOutputPath);
        if (partialStats.size === 0) {
          safeRemove(actualOutputPath);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    return normalizeError(error.message, actualOutputPath, elapsed);
  } finally {
    // Always cleanup
    const cleanupResult = fullCleanup({
      workDir: outputDir,
      outputDir,
      outputPath: actualOutputPath,
      projectDir: keepProject ? null : projectDir,
      keepProject,
    });

    console.log(`[HyperFrames Render] Cleanup: ${cleanupResult.workDirsCleaned} work dirs, ${cleanupResult.chromeProcessesKilled} Chrome processes`);

    // Final Chrome verification
    const chromeClean = verifyChromeCleanup();
    if (!chromeClean) {
      console.warn("[HyperFrames Render] WARNING: Chrome processes still running after cleanup");
      // Second attempt
      cleanupChromeProcesses();
    }
  }
}

// ---------- HELPERS ----------

/**
 * Get video duration via ffprobe
 */
function getVideoDuration(videoPath) {
  try {
    const output = execSync(
      `ffprobe -v quiet -print_format json -show_format "${videoPath}"`,
      { encoding: "utf-8" }
    );
    const data = JSON.parse(output);
    return parseFloat(data.format.duration) || 0;
  } catch (e) {
    return 0;
  }
}

/**
 * Normalize error into consistent result format
 */
function normalizeError(message, outputPath, elapsedMs = 0) {
  return {
    success: false,
    error: message,
    outputPath: outputPath || null,
    renderTimeMs: elapsedMs,
    memoryBeforeMB: checkMemoryUsage().heapUsedMB,
    memoryAfterMB: checkMemoryUsage().heapUsedMB,
    memoryDeltaMB: 0,
  };
}

// ---------- EXPORTS ----------

module.exports = {
  renderComposition,
  fullCleanup,
  cleanupWorkDirs,
  cleanupChromeProcesses,
  verifyChromeCleanup,
  safeRemove,
  getVideoDuration,
  DEFAULT_RENDER_TIMEOUT,
  DEFAULT_FPS,
  DEFAULT_QUALITY,
  DEFAULT_WORKERS,
};
