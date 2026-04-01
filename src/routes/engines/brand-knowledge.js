const { createEngineRouter } = require('../../utils/engineHandler');

const router = createEngineRouter({
  slug: 'brand-knowledge',
  name: 'EC Engine 1: Brand Knowledge',
  description: 'Brand knowledge base management and contextual retrieval'
});

module.exports = router;
