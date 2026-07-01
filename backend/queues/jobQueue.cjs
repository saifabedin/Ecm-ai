const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const { getJobTimeout, TIMEOUTS } = require('../config/timeouts.cjs');
const logger = require('../utils/logger.cjs');

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
});

const aiJobsQueue = new Queue('ai-jobs', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    timeout: TIMEOUTS.DEFAULT_JOB,
    removeOnComplete: {
      count: 1000,
      age: 24 * 3600,
    },
    removeOnFail: {
      count: 5000,
    },
  },
});

async function addJob(jobType, data) {
  const jobId = data.jobId || `job_${Date.now()}`;

  logger.info(`[JobQueue] ENTER addJob jobType=${jobType}`, {
    jobId,
    metadata: { function: 'addJob', type: 'enter', jobType },
  });

  try {
    const jobTimeout = getJobTimeout(jobType);

    const job = await aiJobsQueue.add(jobType, data, {
      jobId: data.jobId || `job_${Date.now()}`,
      timeout: jobTimeout,
    });

    logger.info(`[JobQueue] Job added: ${job.id} (${jobType}, timeout: ${jobTimeout / 1000}s)`, {
      jobId: job.id,
      metadata: { function: 'addJob', type: 'success', jobType, timeout: jobTimeout },
    });

    return {
      success: true,
      jobId: job.id,
      jobType,
    };
  } catch (error) {
    logger.error(`[JobQueue] Error adding job: ${error.message}`, {
      jobId,
      stack: error.stack,
      metadata: { function: 'addJob', type: 'error', jobType },
    });
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getJobStatus(jobId) {
  logger.info(`[JobQueue] ENTER getJobStatus jobId=${jobId}`, {
    jobId,
    metadata: { function: 'getJobStatus', type: 'enter' },
  });

  try {
    const job = await aiJobsQueue.getJob(jobId);

    if (!job) {
      logger.warn(`[JobQueue] Job not found: ${jobId}`, {
        jobId,
        metadata: { function: 'getJobStatus', type: 'not_found' },
      });
      return {
        success: false,
        error: 'Job not found',
      };
    }

    const state = await job.getState();

    logger.info(`[JobQueue] Job status retrieved: ${jobId}`, {
      jobId,
      state,
      metadata: { function: 'getJobStatus', type: 'success' },
    });

    return {
      success: true,
      jobId,
      state,
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
      progress: job.progress,
    };
  } catch (error) {
    logger.error(`[JobQueue] Error getting job status: ${error.message}`, {
      jobId,
      stack: error.stack,
      metadata: { function: 'getJobStatus', type: 'error' },
    });
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  aiJobsQueue,
  addJob,
  getJobStatus,
};