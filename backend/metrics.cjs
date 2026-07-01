// Prometheus metrics endpoint - additive, non-destructive
const express = require('express');
const router = express.Router();
const { verifyToken } = require('./middleware/auth.cjs');

// Simple metrics collection (in production, use prom-client)
let metrics = {
  requests_total: 0,
  requests_duration_seconds: 0,
  errors_total: 0,
  active_connections: 0
};

// Middleware to collect metrics
function metricsMiddleware(req, res, next) {
  metrics.requests_total++;
  metrics.active_connections++;
  
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000; // Convert to seconds
    metrics.requests_duration_seconds += duration;
    metrics.active_connections--;
    
    if (res.statusCode >= 400) {
      metrics.errors_total++;
    }
  });
  
  next();
}

// Metrics endpoint
router.get('/metrics', verifyToken, (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`
# HELP ecm_requests_total Total number of HTTP requests
# TYPE ecm_requests_total counter
ecm_requests_total ${metrics.requests_total}

# HELP ecm_requests_duration_seconds HTTP request duration in seconds
# TYPE ecm_requests_duration_seconds gauge
ecm_requests_duration_seconds ${metrics.requests_duration_seconds}

# HELP ecm_errors_total Total number of errors
# TYPE ecm_errors_total counter
ecm_errors_total ${metrics.errors_total}

# HELP ecm_active_connections Number of active connections
# TYPE ecm_active_connections gauge
ecm_active_connections ${metrics.active_connections}
`);
});

module.exports = { metricsMiddleware, router };
