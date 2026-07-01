const { Queue } = require("bullmq");
const IORedis = require("ioredis");
const { uuidv4 } = require("../utils/uuid.cjs");
const logger = require("../utils/logger.cjs");

// Use existing Redis connection from worker.cjs pattern
const connection = new IORedis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

// Use existing queue name from worker.cjs to avoid creating new queue
const aiJobsQueue = new Queue("ai-jobs", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      count: 1000,
      age: 24 * 3600,
    },
    removeOnFail: {
      count: 5000,
    },
  },
});

// Main engine function
async function runEngine9(input) {
  const jobId = uuidv4();
  const engine = "engine9-delayed-jobs";

  try {
    logger.info(`[Engine9] Starting execution with jobId: ${jobId}`, {
      jobId,
    });

    // Validate input - expects recommendations with delay option
    const { recommendations, delayMs = 0 } = input;

    if (!recommendations || !Array.isArray(recommendations)) {
      throw new Error("Invalid input: recommendations array required");
    }

    // Create a single delayed job that contains all recommendations
    // This follows the pattern of using the existing ai-jobs queue
    const delayedJob = await aiJobsQueue.add(
      `engine9-processing-${Date.now()}`,
      {
        engine9JobId: jobId,
        recommendations: recommendations,
        delayMs: delayMs,
        processedAt: new Date(Date.now() + delayMs),
        sourceEngine: "engine8-optimization"
      },
      {
        delay: delayMs, // Delay in milliseconds
        priority: delayMs > 0 ? 2 : 1, // Lower priority for delayed jobs
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000
        }
      }
    );

    logger.info({
      jobId,
      engine,
      status: "success",
      message: `Created delayed job for ${recommendations.length} recommendations with ${delayMs}ms delay`,
    });

    return {
      success: true,
      engine,
      jobId,
      data: {
        message: `Successfully created delayed job for ${recommendations.length} recommendations`,
        delayedJobId: delayedJob.id,
        delayMs: delayMs,
        executionTimestamp: new Date(Date.now() + delayMs).toISOString()
      },
      error: null
    };

  } catch (error) {
    logger.error(`[Engine9] Error: ${error.message}`, {
      jobId,
      error: error.message,
    });

    logger.error(`[Engine9] Failed to enqueue job: ${error.message}`);
    return {
      success: false,
      engine,
      jobId,
      error: error.message,
      scheduledFor: new Date(Date.now() + (input.delayMs || 0)).toISOString()
    };
  }
}

async function close() {
  try {
    await aiJobsQueue.close();
    await connection.quit();
  } catch (e) {
    logger.warn(`[Engine9] Error during cleanup: ${e.message}`);
  }
}

module.exports = { runEngine9, close };