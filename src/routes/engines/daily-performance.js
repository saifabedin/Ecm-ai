const { createEngineRouter } = require('../../utils/engineHandler');

const router = createEngineRouter({
  slug: 'daily-performance',
  name: 'EC Engine 8b: Ads Daily Performance',
  description: 'Daily ad performance reporting and insights'
});

module.exports = router;
