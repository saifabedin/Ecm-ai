const { body, validationResult } = require('express-validator');

// Validation middleware for orchestrator requests
function validateOrchestratorRequest(req, res, next) {
  // Validate required fields
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
}

// Validation rules for orchestrator endpoint
const orchestratorValidationRules = [
  body('jobType').optional().isString().trim(),
  body('brandId').optional().isString().trim(),
  body('businessName').optional().isString().trim(),
  body('content').optional().isObject(),
  body('script').optional().isString().trim()
];

module.exports = {
  validateOrchestratorRequest,
  orchestratorValidationRules
};