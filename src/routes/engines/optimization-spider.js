const { createEngineRouter } = require('../../utils/engineHandler');

const router = createEngineRouter({
  slug: 'optimization-spider',
  name: 'EC Engine 10: Optimization Spider',
  description: 'A/B testing, iteration, and automated optimization'
});

module.exports = router;
