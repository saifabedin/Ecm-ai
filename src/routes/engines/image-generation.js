const { createEngineRouter } = require('../../utils/engineHandler');

const router = createEngineRouter({
  slug: 'image-generation',
  name: 'EC Engine 5: Image Generation',
  description: 'AI image generation for campaigns and creatives'
});

module.exports = router;
