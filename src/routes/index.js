const { Router } = require('express');
const authRoutes = require('./auth');
const commandRoutes = require('./command');

// Engine routes
const dbMigration = require('./engines/db-migration');
const brandKnowledge = require('./engines/brand-knowledge');
const marketIntelligence = require('./engines/market-intelligence');
const strategyPlanning = require('./engines/strategy-planning');
const contentGeneration = require('./engines/content-generation');
const imageGeneration = require('./engines/image-generation');
const videoGeneration = require('./engines/video-generation');
const publishingSpider = require('./engines/publishing-spider');
const adsManagement = require('./engines/ads-management');
const campaignCreator = require('./engines/campaign-creator');
const dailyPerformance = require('./engines/daily-performance');
const campaignActivate = require('./engines/campaign-activate');
const perfTracking = require('./engines/perf-tracking');
const optimizationSpider = require('./engines/optimization-spider');
const orchestratorBrain = require('./engines/orchestrator-brain');

const router = Router();

// ─── Auth (Level 0 — no brand_id required) ───────────────────────────────────
router.use('/auth', authRoutes);

// ─── Command Layer (Level 1+) ─────────────────────────────────────────────────
router.use('/command', commandRoutes);

// ─── Engine Routes (Level 2 — brand-scoped) ──────────────────────────────────
router.use('/engines/db-migration',        dbMigration);
router.use('/engines/brand-knowledge',     brandKnowledge);
router.use('/engines/market-intelligence', marketIntelligence);
router.use('/engines/strategy-planning',   strategyPlanning);
router.use('/engines/content-generation',  contentGeneration);
router.use('/engines/image-generation',    imageGeneration);
router.use('/engines/video-generation',    videoGeneration);
router.use('/engines/publishing-spider',   publishingSpider);
router.use('/engines/ads-management',      adsManagement);
router.use('/engines/campaign-creator',    campaignCreator);
router.use('/engines/daily-performance',   dailyPerformance);
router.use('/engines/campaign-activate',   campaignActivate);
router.use('/engines/perf-tracking',       perfTracking);
router.use('/engines/optimization-spider', optimizationSpider);
router.use('/engines/orchestrator-brain',  orchestratorBrain);

// ─── Engine Index (list all available engines) ────────────────────────────────
router.get('/engines', (_req, res) => {
  res.json({
    success: true,
    engines: [
      { slug: 'db-migration',        name: 'EC Engine DB: Database Auto-Migration' },
      { slug: 'brand-knowledge',     name: 'EC Engine 1: Brand Knowledge' },
      { slug: 'market-intelligence', name: 'EC Engine 2: Market Intelligence' },
      { slug: 'strategy-planning',   name: 'EC Engine 3: Strategy & Content Planning' },
      { slug: 'content-generation',  name: 'EC Engine 4: Content Generation' },
      { slug: 'image-generation',    name: 'EC Engine 5: Image Generation' },
      { slug: 'video-generation',    name: 'EC Engine 6: Video Generation Professional 2-Stage' },
      { slug: 'publishing-spider',   name: 'EC Engine 7: Publishing Spider Web' },
      { slug: 'ads-management',      name: 'EC Engine 8: Ads Management' },
      { slug: 'campaign-creator',    name: 'EC Engine 8a: Ads Campaign Creator' },
      { slug: 'daily-performance',   name: 'EC Engine 8b: Ads Daily Performance' },
      { slug: 'campaign-activate',   name: 'EC Engine 8c: Ads Campaign Activate' },
      { slug: 'perf-tracking',       name: 'EC Engine 9: Performance Tracking Spider' },
      { slug: 'optimization-spider', name: 'EC Engine 10: Optimization Spider' },
      { slug: 'orchestrator-brain',  name: 'EC Engine 11: Orchestrator Brain' }
    ],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
