/**
 * Runtime Timeout & Resource Constants
 *
 * Centralized configuration for job timeouts, lock durations,
 * and memory thresholds. Used by jobQueue.cjs, worker.cjs, and
 * ecosystem configs to ensure consistent timeout behavior.
 *
 * All values in milliseconds unless noted otherwise.
 */

const TIMEOUTS = {
  // Default job timeout for standard AI pipeline jobs (research, content, image)
  DEFAULT_JOB: 5 * 60 * 1000,       // 5 minutes

  // Extended timeout for cinematic video rendering jobs
  // Covers: Avatar generation (5s) + Pexels b-roll fetch (30s) +
  //         HyperFrames composition gen (15s) + Chrome render (300s) +
  //         FFmpeg encode + master (60s) + buffer
  CINEMATIC_RENDER: 15 * 60 * 1000, // 15 minutes

  // Timeout for publish/delayed jobs
  PUBLISH: 3 * 60 * 1000,           // 3 minutes

  // Maximum processing timeout enforced by engine4-video.cjs
  ENGINE4_MAX_PROCESSING: 10 * 60 * 1000, // 10 minutes
};

const LOCK_DURATIONS = {
  // Default lock duration for standard jobs
  DEFAULT: 10 * 60 * 1000,          // 10 minutes

  // Extended lock for cinematic render jobs to prevent stalled detection
  // Must exceed TIMEOUTS.CINEMATIC_RENDER to avoid premature stall
  CINEMATIC_RENDER: 16 * 60 * 1000, // 16 minutes (1 min buffer over render timeout)
};

const STALLED_INTERVALS = {
  // How often to check for stalled jobs
  DEFAULT: 60 * 1000,               // 60 seconds
};

const MEMORY = {
  // PM2 worker max_memory_restart for standard jobs
  WORKER_STANDARD: '1G',

  // PM2 worker max_memory_restart when Chrome/Puppeteer rendering is active
  // Chrome headless-shell ~256MB + Node.js heap ~200MB + frame buffers ~500MB
  WORKER_RENDERING: '3G',

  // Heap usage warning threshold (bytes) — log when exceeded
  HEAP_WARN_THRESHOLD: 1.5 * 1024 * 1024 * 1024, // 1.5GB

  // Heap usage critical threshold (bytes) — fail job to prevent OOM
  HEAP_CRITICAL_THRESHOLD: 2.5 * 1024 * 1024 * 1024, // 2.5GB
};

const CONCURRENCY = {
  // Default worker concurrency for mixed job types
  DEFAULT: 5,

  // Recommended concurrency when cinematic rendering is active
  // Each render spawns a Chrome process (~256MB), so limit to avoid OOM
  WITH_RENDERING: 2,
};

/**
 * Get the appropriate timeout for a job type
 */
function getJobTimeout(jobType) {
  if (jobType === 'video' || jobType === 'cinematic') {
    return TIMEOUTS.CINEMATIC_RENDER;
  }
  return TIMEOUTS.DEFAULT_JOB;
}

/**
 * Get the appropriate lock duration for a job type
 */
function getLockDuration(jobType) {
  if (jobType === 'video' || jobType === 'cinematic') {
    return LOCK_DURATIONS.CINEMATIC_RENDER;
  }
  return LOCK_DURATIONS.DEFAULT;
}

/**
 * Check if current heap usage exceeds warning threshold
 */
function checkMemoryUsage() {
  const usage = process.memoryUsage();
  const heapUsed = usage.heapUsed;
  const heapTotal = usage.heapTotal;
  const rss = usage.rss;

  const status = {
    heapUsedMB: Math.round(heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(heapTotal / 1024 / 1024),
    rssMB: Math.round(rss / 1024 / 1024),
    externalMB: Math.round(usage.external / 1024 / 1024),
    isWarning: heapUsed > MEMORY.HEAP_WARN_THRESHOLD,
    isCritical: heapUsed > MEMORY.HEAP_CRITICAL_THRESHOLD,
  };

  return status;
}

module.exports = {
  TIMEOUTS,
  LOCK_DURATIONS,
  STALLED_INTERVALS,
  MEMORY,
  CONCURRENCY,
  getJobTimeout,
  getLockDuration,
  checkMemoryUsage,
};
