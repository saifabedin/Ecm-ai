/**
 * Standard success response — every response includes brand_id, engine_id, timestamp.
 */
function success(res, data, status = 200) {
  return res.status(status).json({
    success: true,
    ...data,
    timestamp: new Date().toISOString()
  });
}

/**
 * Create a structured error object for use with next(err).
 */
function createError(error_code, message, status = 500) {
  const err = new Error(message);
  err.error_code = error_code;
  err.status = status;
  return err;
}

module.exports = { success, createError };
