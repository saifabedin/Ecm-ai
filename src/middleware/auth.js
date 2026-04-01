const jwt = require('jsonwebtoken');
const { createError } = require('../utils/response');

function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(createError('UNAUTHORIZED', 'Missing or invalid Authorization header', 401));
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { user_id, brand_id, role, iat, exp }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(createError('TOKEN_EXPIRED', 'Access token has expired', 401));
    }
    return next(createError('INVALID_TOKEN', 'Access token is invalid', 401));
  }
}

function requireAdmin(req, _res, next) {
  if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
    return next(createError('FORBIDDEN', 'Admin role required', 403));
  }
  next();
}

module.exports = { authenticateJWT, requireAdmin };
