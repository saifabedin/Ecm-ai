const jwt = require('jsonwebtoken');
const pool = require('../db/client.cjs');
const logger = require('../utils/logger.cjs');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in environment variables');
}

const {
  getUserPlan,
  getUserUsage,
  checkUserPlan,
  limitUsage,
  logUsage,
  getUserStats,
} = require("./multiTenant.cjs");

function verifyToken(req, res, next) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn(`[Auth] No token provided`, {
        correlationId: req.correlationId,
        metadata: { function: 'verifyToken', type: 'no_token', path: req.path },
      });
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach user and tenant to request
    req.user = {
      id: decoded.user_id,
      tenant_id: decoded.tenant_id,
      role: decoded.role,
      is_super_admin: decoded.is_super_admin || false
    };

    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logger.warn(`[Auth] Invalid token`, {
        correlationId: req.correlationId,
        metadata: { function: 'verifyToken', type: 'invalid_token', path: req.path },
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      logger.warn(`[Auth] Token expired`, {
        correlationId: req.correlationId,
        metadata: { function: 'verifyToken', type: 'token_expired', path: req.path },
      });
      return res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    }

    logger.error(`[Auth] Auth middleware error: ${error.message}`, {
      correlationId: req.correlationId,
      stack: error.stack,
      metadata: { function: 'verifyToken', type: 'error', path: req.path },
    });
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

module.exports = {
  verifyToken,
  getUserPlan,
  getUserUsage,
  checkUserPlan,
  limitUsage,
  logUsage,
  getUserStats,
};
