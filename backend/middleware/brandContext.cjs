'use strict';
// Brand context middleware — attaches brandId from header or JWT to req
function attachBrandContext(req, res, next) {
  req.brandId = req.user?.tenant_id || req.headers['x-brand-id'] || 'default';
  next();
}

module.exports = { attachBrandContext };
