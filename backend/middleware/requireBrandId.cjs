'use strict';

/**
 * Tenant Isolation Middleware
 * CRITICAL: Multi-tenant data segregation
 * 
 * Purpose: Extract and validate brand_id from request
 * If missing/invalid → returns 400/403
 */

function requireBrandId(req, res, next) {
  // ━━ EXTRACT BRAND_ID FROM REQUEST ━━━━━━━━━━━━━━━━━━━━
  // Try to find brand_id in: body → query → params
  const brand_id = req.body?.brand_id || req.query?.brand_id || req.params?.brand_id;

  if (!brand_id) {
    return res.status(400).json({
      success: false,
      error_code: 'MISSING_BRAND_ID',
      message: 'brand_id is required in request body, query, or params',
      timestamp: new Date().toISOString()
    });
  }

  // ━━ VALIDATE UUID V4 FORMAT ━━━━━━━━━━━━━━━━━━━━━━━━━━
  // UUID v4 pattern: 550e8400-e29b-41d4-a716-446655440000
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!uuidV4Regex.test(brand_id)) {
    return res.status(400).json({
      success: false,
      error_code: 'INVALID_BRAND_ID_FORMAT',
      message: `brand_id must be a valid UUID v4, got: ${brand_id}`,
      timestamp: new Date().toISOString()
    });
  }

  // ━━ VERIFY USER OWNS THIS BRAND ━━━━━━━━━━━━━━━━━━━━
  // JWT should only contain brands the user owns
  // If JWT has brand_id field, it must match request brand_id
  if (req.user && req.user.brand_id && req.user.brand_id !== brand_id) {
    return res.status(403).json({
      success: false,
      error_code: 'FORBIDDEN_BRAND_ACCESS',
      message: `User does not own brand: ${brand_id}`,
      timestamp: new Date().toISOString()
    });
  }

  // ━━ ATTACH TO REQUEST ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  req.brandId = brand_id;
  req.brand_id = brand_id; // Both formats for compatibility

  next();
}

module.exports = { requireBrandId };
