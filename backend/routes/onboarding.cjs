const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.cjs');
const { saveNiche, saveConnections, completeOnboarding, getOnboardingStatus } = require('../controllers/onboarding.cjs');

router.use(verifyToken);

router.get('/status',       getOnboardingStatus);
router.post('/niche',       saveNiche);
router.post('/connections', saveConnections);
router.post('/complete',    completeOnboarding);

module.exports = router;
