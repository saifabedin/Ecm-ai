const { Worker } = require('bullmq');
require('../initEnv.cjs');
const IORedis = require('ioredis');
const { runMasterAgent } = require('../agents/masterAgent.cjs');
const { logJob } = require('../db/logs.cjs');
const logger = require('../utils/logger.cjs');
const { STALLED_INTERVALS, CONCURRENCY, LOCK_DURATIONS, checkMemoryUsage } = require('../config/timeouts.cjs');
const { validateRequiredEnv } = require('../utils/env-validator.cjs');
const { isJobCaptured, markJobCaptured } = require('../scripts/knowledge-brain-helper.cjs');
const { captureJobToVault, captureAgentToVault, captureErrorToVault, captureDecisionToVault, captureAutomationToVault } = require('../scripts/capture-automations.cjs');

// SECURITY: env validation at worker startup
validateRequiredEnv();

// RELIABILITY: global error handlers — prevent single async escape from killing worker.
// Mirrors api-server.cjs:31-48. A rejection that escapes a job's try/catch (e.g., from
// runMasterAgent's deep async tree) must not crash the entire worker process.
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
    correlationId: 'SYSTEM',
  });
  // Non-fatal: just log, do not exit
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', {
    message: err.message,
    stack: err.stack,
    correlationId: 'SYSTEM',
  });
  // Fatal: gracefully shutdown — worker is in an undefined state
  // (gracefulShutdown has its own isShuttingDown dedup guard)
  gracefulShutdown('uncaughtException');
});

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
  password: process.env.REDIS_PASSWORD || undefined,
});

const worker = new Worker(
  'ai-jobs',
  async (job) => {
    const { tenant_id, ...dataWithoutTenant } = job.data;
    const jobType = job.name;
    const jobId = job.id;
    const correlationId = dataWithoutTenant.correlationId || `corr_${jobId}`;
    const data = { ...dataWithoutTenant, tenant_id, correlationId };

// ENTER log
  logger.info(`[Worker] ENTER processJob jobId=${jobId} (${jobType})`, {
      jobId,
      correlationId,
      metadata: { function: 'processJob', type: 'enter', jobType },
    });

    // Log memory before processing
    const memBefore = checkMemoryUsage();
    if (memBefore.isWarning) {
      logger.warn(`[Worker] High memory before job ${jobId}: ${memBefore.heapUsedMB}MB heap used`, {
        jobId,
        correlationId,
        metadata: { type: 'memory_warning', heapUsedMB: memBefore.heapUsedMB },
      });
    }

    try {
      await logJob({
        job_id: jobId,
        job_type: jobType,
        tenant_id,
        status: 'processing',
        input: data,
      });

      job.updateProgress(10);

      // Call Master Agent which runs the full pipeline
      const result = await runMasterAgent(data);

      job.updateProgress(100);

      // Log memory after processing
      const memAfter = checkMemoryUsage();
      const memDelta = memAfter.heapUsedMB - memBefore.heapUsedMB;

      if (memAfter.isCritical) {
        logger.error(`[Worker] CRITICAL memory after job ${jobId}: ${memAfter.heapUsedMB}MB heap used`, {
          jobId,
          correlationId,
          metadata: { type: 'memory_critical', heapUsedMB: memAfter.heapUsedMB },
        });
      } else if (memAfter.isWarning || Math.abs(memDelta) > 200) {
        logger.warn(`[Worker] Memory delta for job ${jobId}: ${memDelta > 0 ? '+' : ''}${memDelta}MB (${memBefore.heapUsedMB}MB → ${memAfter.heapUsedMB}MB)`, {
          jobId,
          correlationId,
          metadata: { type: 'memory_delta', memDelta, memBefore: memBefore.heapUsedMB, memAfter: memAfter.heapUsedMB },
        });
      }

      await logJob({
        job_id: jobId,
        job_type: jobType,
        tenant_id,
        status: result.success ? 'completed' : 'failed',
        input: data,
        output: result,
        error: result.error || null,
      });

// EXIT log
logger.info(`[Worker] EXIT processJob jobId=${jobId} success=${result.success}`, {
  jobId,
  correlationId,
  metadata: { function: 'processJob', type: 'exit', jobType, success: result.success, memoryDeltaMB: memDelta },
});

// Autonomous Knowledge Capture (idempotent via jobId hash guard)
const alreadyCaptured = await isJobCaptured(jobId);
if (!alreadyCaptured) {
  try {
    const tenantId = data.tenant_id || 'default';
    await captureJobToVault(jobId, jobType, result, tenantId);
    for (const [engineId, engineResult] of Object.entries(result.engineResults || {})) {
      await captureAgentToVault(engineId, jobId, engineResult, tenantId);
    }
    if (!result.success && result.error) {
      await captureErrorToVault(jobId, result.error, jobType, tenantId);
    }
    await markJobCaptured(jobId);
  } catch (captureErr) {
    logger.error(`[Worker] Knowledge capture failed for ${jobId}: ${captureErr.message}`, {
      jobId,
      correlationId,
      metadata: { type: 'capture_error' },
    });
  }
} else {
  logger.debug(`[Worker] Job ${jobId} already captured, skipping`, {
    jobId,
    correlationId,
    metadata: { type: 'capture_skip' },
  });
}

return result;
    } catch (error) {
      // Log memory on failure too
      const memAfter = checkMemoryUsage();
      const memDelta = memAfter.heapUsedMB - memBefore.heapUsedMB;

      logger.error(`[Worker] processJob jobId=${jobId} failed: ${error.message}`, {
        jobId,
        correlationId,
        stack: error.stack,
        metadata: { function: 'processJob', type: 'error', jobType, memoryDeltaMB: memDelta },
      });

      // Nested try/catch: if the failure log itself throws (e.g., DB outage),
      // log the secondary error but ALWAYS re-throw the original job error
      // so BullMQ sees the real failure cause, not the logging side-effect.
      try {
        await logJob({
          job_id: jobId,
          job_type: jobType,
          tenant_id,
          status: 'failed',
          input: data,
          error: error.message,
        });
      } catch (logErr) {
        logger.error(`[Worker] Failed to log job failure for ${jobId}: ${logErr.message}`, {
          jobId,
          correlationId,
          stack: logErr.stack,
          metadata: { function: 'processJob', type: 'log_error', jobType },
        });
      }

      throw error;
    }
  },
  {
    connection,
    concurrency: CONCURRENCY.DEFAULT,
    limiter: {
      max: 10,
      duration: 1000,
    },
    lockDuration: LOCK_DURATIONS.DEFAULT,
    stalledInterval: STALLED_INTERVALS.DEFAULT,
  }
);

worker.on('completed', (job) => {
  logger.info(`[Worker] Job ${job.id} completed successfully`, {
    jobId: job.id,
    metadata: { type: 'worker_event', event: 'completed' },
  });
});

worker.on('failed', (job, err) => {
  logger.error(`[Worker] Job ${job?.id} failed: ${err?.message}`, {
    jobId: job?.id,
    metadata: { type: 'worker_event', event: 'failed', error: err?.message, stack: err?.stack },
  });
});

worker.on('progress', (job, progress) => {
  logger.debug(`[Worker] Job ${job.id} progress: ${progress}%`, {
    jobId: job.id,
    progress,
    metadata: { type: 'worker_event', event: 'progress' },
  });
});

let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    logger.warn(`[Worker] Shutdown already in progress, ignoring ${signal}`, {
      correlationId: 'SYSTEM',
      metadata: { type: 'shutdown_duplicate' },
    });
    return;
  }
  isShuttingDown = true;

  logger.info(`[Worker] ${signal} received, closing worker...`, {
    correlationId: 'SYSTEM',
    metadata: { type: 'shutdown', signal },
  });

  // RELIABILITY: force-exit timeout — guarantees shutdown even if worker.close() hangs.
  // Prevents PM2 from escalating to SIGKILL after its own grace period.
  const forceExitTimeout = setTimeout(() => {
    logger.error(`[Worker] Graceful shutdown timeout exceeded (30s), forcing exit`, {
      correlationId: 'SYSTEM',
      metadata: { type: 'shutdown_timeout' },
    });
    process.exit(1);
  }, 30000);
  forceExitTimeout.unref();

  try {
    const gpuRender = require('../render/gpu-render-service.cjs');
    gpuRender.shutdown();
  } catch (e) { /* GPU render not loaded */ }

  try {
    await worker.close();
    logger.info(`[Worker] Worker closed cleanly`, { correlationId: 'SYSTEM' });
  } catch (closeErr) {
    logger.error(`[Worker] worker.close() failed: ${closeErr.message}`, {
      correlationId: 'SYSTEM',
      stack: closeErr.stack,
      metadata: { type: 'shutdown_close_error' },
    });
  }

  clearTimeout(forceExitTimeout);
  logger.info(`[Worker] Graceful shutdown complete`, { correlationId: 'SYSTEM' });
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

logger.info('[Worker] AI Worker started and listening for jobs...', {
  correlationId: 'SYSTEM',
  metadata: { type: 'worker_start' },
});

module.exports = { worker };