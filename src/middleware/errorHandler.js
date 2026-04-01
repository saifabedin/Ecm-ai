const logger = require('../utils/logger');

function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const brand_id = req.brand_id || req.body?.brand_id || null;

  logger.error(`${err.error_code || 'SERVER_ERROR'}: ${err.message}`, {
    path: req.path,
    method: req.method,
    brand_id,
    stack: status === 500 ? err.stack : undefined
  });

  res.status(status).json({
    success: false,
    brand_id,
    error_code: err.error_code || 'INTERNAL_SERVER_ERROR',
    message: status === 500 ? 'An unexpected error occurred' : err.message,
    timestamp: new Date().toISOString()
  });
}

module.exports = { errorHandler };
