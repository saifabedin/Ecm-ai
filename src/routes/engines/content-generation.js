const { createEngineRouter } = require('../../utils/engineHandler');

const router = createEngineRouter({
  slug: 'content-generation',
  name: 'EC Engine 4: Content Generation',
  description: 'Long-form, social, and email content generation'
});

module.exports = router;
