// backend/routes/billing.cjs
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.cjs');
const { getPlans, createSubscription, handleWebhook, getBillingStatus } = require('../controllers/billing.cjs');

// Public routes (no JWT required)
router.get('/plans', getPlans);
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Authenticated routes
router.use(verifyToken);
router.post('/subscribe', createSubscription);
router.get('/status',     getBillingStatus);

module.exports = router;
