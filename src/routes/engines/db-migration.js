const { createEngineRouter } = require('../../utils/engineHandler');

const router = createEngineRouter({
  slug: 'db-migration',
  name: 'EC Engine DB: Database Auto-Migration',
  description: 'Automated database schema migration and versioning'
});

module.exports = router;
