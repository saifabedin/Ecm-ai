'use strict';

const jwt = require('jsonwebtoken');

/**
 * JWT Authentication Middleware
 * Validates Bearer token from Authorization header
 * 
 * Header format: Authorization: Bearer <token>
 */

function authenticateJWT(req, res, next) {
  // ━━ EXTRACT TOKEN FROM HEADER ━━━━━━━━━━━━━━━━━━━━━━━━
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error_code: 'NO_AUTH_HEADER',
      message: 'Authorization header missing',
      timestamp: new Date().toISOString()
    });
  }

  // Format: "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      success: false,
      error_code: 'INVALID_AUTH_FORMAT',
      message: 'Authorization header must be: Bearer <token>',
      timestamp: new Date().toISOString()
    });
  }

  const token = parts[1];

  // ━━ VERIFY TOKEN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256', 'RS256']
    });
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      error_code: 'INVALID_TOKEN',
      message: `Token verification failed: ${err.message}`,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = { authenticateJWT };
