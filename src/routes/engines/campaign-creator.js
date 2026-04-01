const { createEngineRouter } = require('../../utils/engineHandler');

const router = createEngineRouter({
  slug: 'campaign-creator',
  name: 'EC Engine 8a: Ads Campaign Creator',
  description: 'Create new Google/Meta ad campaigns'
});

module.exports = router;
