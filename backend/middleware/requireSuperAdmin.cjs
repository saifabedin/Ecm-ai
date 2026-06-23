const logger = require('../utils/logger.cjs');

function requireSuperAdmin(req, res, next) {
  if (!req.user || !req.user.is_super_admin) {
    logger.warn('[Admin] Unauthorized admin access attempt', {
      correlationId: req.correlationId,
      metadata: { userId: req.user?.id, path: req.path },
    });
    return res.status(403).json({ success: false, error: 'Forbidden: Super admin only' });
  }
  next();
}

module.exports = requireSuperAdmin;
