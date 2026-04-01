const { createEngineRouter } = require('../../utils/engineHandler');

const router = createEngineRouter({
  slug: 'perf-tracking',
  name: 'EC Engine 9: Performance Tracking Spider',
  description: 'Cross-channel performance tracking and attribution'
});

module.exports = router;
