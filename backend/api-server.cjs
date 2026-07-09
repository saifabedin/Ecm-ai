#!/usr/bin/env node
'use strict';

// ━━ LOAD ENV VARIABLES FIRST ━━━━━━━━━━━━━━━━━━━━━━━━
require('dotenv').config();

// ━━ VALIDATE ENV BEFORE ANYTHING ELSE ━━━━━━━━━━━━━
const { validateEnv } = require('./middleware/validateEnv.cjs');
try {
  validateEnv();
} catch (err) {
  console.error('❌ Startup failed:', err.message);
  process.exit(1);
}

// ━━ IMPORT DEPENDENCIES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

// ━━ IMPORT MIDDLEWARE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const { authenticateJWT } = require('./middleware/authenticateJWT.cjs');
const { requireBrandId } = require('./middleware/requireBrandId.cjs');
const { errorHandler } = require('./middleware/errorHandler.cjs');

// ━━ IMPORT SERVICES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const { HealthChecker } = require('./services/healthCheck.cjs');

// ━━ INITIALIZE LOGGER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ecm-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});

// ━━ CREATE EXPRESS APP ━━━━━━━━━━━━━━━━━━━━━━━━━━━
const app = express();
const PORT = process.env.PORT || 4000;

logger.info('🚀 ECM-AI Backend Initializing...');

// ━━ INITIALIZE HEALTH CHECKER ━━━━━━━━━━━━━━━━━━━━
let healthChecker = null;
(async () => {
  healthChecker = new HealthChecker();
  await healthChecker.initialize();
  logger.info('✅ Health checker initialized');
})();

// ═══════════════════════════════════════════════════════════════
// ━━ MIDDLEWARE STACK ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ═══════════════════════════════════════════════════════════════

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Brand-ID']
}));

// Body parser
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    body: req.body ? { ...req.body, password: '[REDACTED]' } : undefined
  });
  next();
});

// ════════════════════════���══════════════════════════════════════
// ━━ PUBLIC ROUTES (No authentication required) ━━━━━━━━━━━━━━━
// ═══════════════════════════════════════════════════════════════

/**
 * GET /health
 * Check system health status
 * Response includes DB, Redis, Queue status
 */
app.get('/health', async (req, res, next) => {
  try {
    if (!healthChecker) {
      return res.status(503).json({
        status: 'unavailable',
        message: 'Health checker not initialized',
        timestamp: new Date().toISOString()
      });
    }

    const health = await healthChecker.getHealth();
    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (err) {
    logger.error('Health check failed:', err);
    res.status(503).json({
      status: 'error',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /status
 * Alias for /health
 */
app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━ AUTH ROUTES (Public, rate-limited) ━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * POST /auth/register
 * Register new user
 * Body: { email, password, brand_name }
 */
app.post('/auth/register', async (req, res, next) => {
  try {
    const { email, password, brand_name } = req.body;

    // Validation
    if (!email || !password || !brand_name) {
      return res.status(400).json({
        success: false,
        error_code: 'VALIDATION_ERROR',
        message: 'Missing required fields: email, password, brand_name',
        timestamp: new Date().toISOString()
      });
    }

    // TODO: Save to database
    const brand_id = uuidv4();
    const user_id = uuidv4();

    logger.info(`👤 New registration: ${email} (brand: ${brand_id})`);

    res.status(201).json({
      success: true,
      data: {
        user_id,
        email,
        brand_id,
        brand_name
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/login
 * User login
 * Body: { email, password }
 * Returns: { access_token, expires_in }
 */
app.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error_code: 'VALIDATION_ERROR',
        message: 'Missing email or password',
        timestamp: new Date().toISOString()
      });
    }

    // TODO: Verify credentials in database
    const user_id = uuidv4();
    const brand_id = uuidv4(); // In real app, fetch from DB

    // Generate JWT token
    const token = jwt.sign(
      {
        user_id,
        email,
        brand_id,
        role: 'admin'
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRY || '24h',
        algorithm: 'HS256'
      }
    );

    logger.info(`✅ Login successful: ${email}`);

    res.json({
      success: true,
      data: {
        access_token: token,
        token_type: 'Bearer',
        expires_in: 86400
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

// ════���══════════════════════════════════════════════════════════
// ━━ PROTECTED ROUTES (Authentication required) ━━━━━━━━━━━━━━━
// ═══════════════════════════════════════════════════════════════

// Apply JWT authentication to all /api routes
app.use('/api', authenticateJWT);

/**
 * GET /api/me
 * Get current user info
 */
app.get('/api/me', (req, res) => {
  res.json({
    success: true,
    data: req.user,
    timestamp: new Date().toISOString()
  });
});

// ━━ PROTECTED ROUTES WITH BRAND_ID ━━━━━━━━━━━━━━━
app.use('/api', requireBrandId);

/**
 * POST /api/engines/:engine_slug/run
 * Trigger an AI engine
 * Body: { brand_id, input, options }
 */
app.post('/api/engines/:engine_slug/run', async (req, res, next) => {
  try {
    const { engine_slug } = req.params;
    const { input, options } = req.body;
    const brand_id = req.brandId;

    // Validation
    if (!input) {
      return res.status(400).json({
        success: false,
        error_code: 'VALIDATION_ERROR',
        message: 'Missing input payload',
        timestamp: new Date().toISOString()
      });
    }

    const job_id = uuidv4();

    logger.info(`📤 Engine job queued: ${engine_slug}`, {
      job_id,
      brand_id
    });

    // TODO: Queue job with BullMQ
    res.status(202).json({
      success: true,
      data: {
        job_id,
        engine_id: engine_slug,
        brand_id,
        status: 'queued',
        estimated_seconds: 30
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/engines/:job_id/status
 * Check engine job status
 * Query: { brand_id }
 */
app.get('/api/engines/:job_id/status', async (req, res, next) => {
  try {
    const { job_id } = req.params;
    const brand_id = req.brandId;

    // TODO: Fetch job from BullMQ
    res.json({
      success: true,
      data: {
        job_id,
        brand_id,
        status: 'pending',
        progress: 0,
        result: null
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════
// ━━ 404 HANDLER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ═══════════════════════════════════════════════════════════════

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error_code: 'NOT_FOUND',
    message: `Route not found: ${req.method} ${req.path}`,
    timestamp: new Date().toISOString()
  });
});

// ═══════════════════════════════════════════════════════════════
// ━━ ERROR HANDLER (must be last) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ═══════════════════════════════════════════════════════════════

app.use(errorHandler(logger));

// ═══════════════════════════════════════════════════════════════
// ━━ START SERVER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ═══════════════════════════════════════════════════════════════

const server = app.listen(PORT, () => {
  logger.info(`✅ ECM-AI Backend running on http://localhost:${PORT}`);
  logger.info(`💚 Health: http://localhost:${PORT}/health`);
});

// ━━ GRACEFUL SHUTDOWN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const gracefulShutdown = async (signal) => {
  logger.info(`📍 ${signal} received, shutting down gracefully...`);

  server.close(async () => {
    logger.info('🛑 HTTP server closed');
    if (healthChecker) await healthChecker.close();
    logger.info('✅ Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
