const { createError } = require('../utils/response');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Extracts brand_id from body, query, params, or x-brand-id header.
 * Validates UUID v4 format. Attaches to req.brand_id.
 * MANDATORY on all /api/* routes except /api/auth/*
 */
function requireBrandId(req, _res, next) {
  const brand_id =
    req.body?.brand_id ||
    req.query?.brand_id ||
    req.params?.brand_id ||
    req.headers['x-brand-id'];

  if (!brand_id) {
    return next(createError('BRAND_ID_REQUIRED', 'brand_id is required on all API calls', 400));
  }
  if (!UUID_RE.test(brand_id)) {
    return next(createError('BRAND_ID_INVALID', 'brand_id must be a valid UUID v4', 400));
  }

  req.brand_id = brand_id;
  next();
}

/**
 * Verifies that the authenticated user owns the brand_id in the request.
 * Must run after authenticateJWT and requireBrandId.
 */
function verifyBrandOwnership(req, _res, next) {
  if (!req.user) {
    return next(createError('UNAUTHORIZED', 'Authentication required', 401));
  }
  // Super admins can access any brand
  if (req.user.role === 'super_admin') return next();

  if (req.user.brand_id !== req.brand_id) {
    return next(createError('FORBIDDEN', 'You do not have access to this brand', 403));
  }
  next();
}

module.exports = { requireBrandId, verifyBrandOwnership };
