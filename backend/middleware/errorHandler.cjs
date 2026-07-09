'use strict';

/**
 * Global Error Handler Middleware
 * Catches all errors and returns consistent JSON response
 * 
 * Must be registered LAST in Express app
 * app.use(errorHandler(logger))
 */

function errorHandler(logger) {
  return (err, req, res, next) => {
    // ━━ LOG THE ERROR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const errorContext = {
      message: err.message,
      code: err.code || 'UNKNOWN_ERROR',
      method: req.method,
      path: req.path,
      brand_id: req.brandId || 'unknown',
      user_id: req.user?.user_id || 'anonymous',
      timestamp: new Date().toISOString()
    };

    // Include stack trace in development only
    if (process.env.NODE_ENV === 'development') {
      errorContext.stack = err.stack;
    }

    logger.error('API Error:', errorContext);

    // ━━ DETERMINE STATUS CODE ━━━━━━━━━━━━━━━━━━━━━━━━
    let statusCode = err.statusCode || 500;
    let errorCode = err.code || 'INTERNAL_ERROR';

    // Map error types to HTTP status codes
    if (err.name === 'ValidationError') {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
    } else if (err.name === 'UnauthorizedError') {
      statusCode = 401;
      errorCode = 'UNAUTHORIZED';
    } else if (err.name === 'ForbiddenError') {
      statusCode = 403;
      errorCode = 'FORBIDDEN';
    } else if (err.name === 'NotFoundError') {
      statusCode = 404;
      errorCode = 'NOT_FOUND';
    } else if (statusCode >= 500) {
      // Log 500+ errors as warnings
      logger.warn(`Server error (${statusCode}): ${err.message}`);
    }

    // ━━ SEND RESPONSE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    res.status(statusCode).json({
      success: false,
      error_code: errorCode,
      message: err.message,
      timestamp: new Date().toISOString()
    });
  };
}

module.exports = { errorHandler };
