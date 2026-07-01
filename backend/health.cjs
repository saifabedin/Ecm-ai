const express = require('express');
const dbPool = require('./db/client.cjs');
const redis = require('ioredis');

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'ecm-api',
    version: '1.0.0'
  });
});

// Readiness check endpoint
router.get('/ready', async (req, res) => {
  const results = {
    database: 'unknown',
    redis: 'unknown'
  };

  try {
    // Check database connection using shared client
    if (dbPool) {
      try {
        await dbPool.query('SELECT NOW()');
        results.database = 'connected';
      } catch (dbError) {
        console.error('Database check failed:', dbError.message);
        results.database = 'error';
      }
    } else {
      results.database = 'disabled';
    }

    // Check Redis connection (basic)
    let redisClient;
    try {
      redisClient = new redis({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379
      });
      await redisClient.ping();
      results.redis = 'connected';
    } catch (redisError) {
      console.error('Redis check failed:', redisError.message);
      results.redis = 'error';
    } finally {
      if (redisClient) {
        await redisClient.quit().catch(() => {});
      }
    }

    const allHealthy = results.database !== 'error' && results.redis !== 'error';

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'ready' : 'not ready',
      timestamp: new Date().toISOString(),
      checks: results
    });
  } catch (error) {
    console.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;
