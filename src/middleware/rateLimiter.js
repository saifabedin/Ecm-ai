const rateLimit = require('express-rate-limit');

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 min
const max = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);

const globalRateLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers['x-brand-id'] || req.ip,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      brand_id: null,
      error_code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests — please try again later',
      timestamp: new Date().toISOString()
    });
  }
});

// Stricter limiter for engine run endpoints (10 req / 60s per brand)
const engineRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.brand_id || req.ip,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      brand_id: null,
      error_code: 'ENGINE_RATE_LIMIT',
      message: 'Engine run rate limit exceeded — max 10 runs per minute',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = { globalRateLimiter, engineRateLimiter };
