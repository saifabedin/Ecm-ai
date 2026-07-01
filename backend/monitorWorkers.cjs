// BullMQ worker monitoring - additive, non-destructive
const { Queue } = require('bullmq');
const { v4: uuidv4 } = require('uuid');
const logger = require('./utils/logger.cjs');

// Monitor worker health
async function checkWorkerHealth() {
  try {
    // Try to connect to Redis and check queues
    const redis = require('ioredis');
    const redisClient = new redis({
      host: '127.0.0.1',
      port: 6379
    });
    
    // Ping Redis
    await redisClient.ping();
    
    // Get basic queue info (if Queue class is available)
    let queueInfo = {};
    try {
      // This is a simplified check - in production you'd want more detailed monitoring
      queueInfo = {
        redis_connected: true,
        timestamp: new Date().toISOString()
      };
    } catch (queueError) {
      logger.warn('Could not get detailed queue info:', queueError.message);
      queueInfo = {
        redis_connected: true,
        queue_error: queueError.message,
        timestamp: new Date().toISOString()
      };
    }
    
    await redisClient.quit();
    return { status: 'healthy', ...queueInfo };
  } catch (error) {
    logger.error('Worker health check failed:', error);
    return { status: 'unhealthy', error: error.message };
  }
}

// Health check extension for workers
async function workerHealthCheck() {
  const health = await checkWorkerHealth();
  return health;
}

module.exports = { checkWorkerHealth, workerHealthCheck };
