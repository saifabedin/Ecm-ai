// Request logging middleware with correlation IDs
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger.cjs');

function requestLogger(req, res, next) {
  // Generate correlation ID for request tracing
  const correlationId = req.headers['x-request-id'] || uuidv4();

  // Add correlation ID to request object
  req.correlationId = correlationId;

  // Set response header for client-side tracing
  res.setHeader('X-Request-ID', correlationId);

  // Log request start
  const startTime = Date.now();
  logger.info(`[Request] ${req.method} ${req.path} - STARTED`, {
    correlationId,
    metadata: { method: req.method, path: req.path, ip: req.ip, type: 'request_start' },
  });

  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(`[Request] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`, {
      correlationId,
      jobId: req.jobId,
      metadata: { method: req.method, path: req.path, statusCode: res.statusCode, duration, type: 'request_end' },
    });
  });

  next();
}

module.exports = requestLogger;
