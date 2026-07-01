require('../initEnv.cjs');
const pool = require('./client.cjs');

async function addColumn() {
  if (!pool) return;
  await pool.query(
    `ALTER TABLE memory ADD COLUMN IF NOT EXISTS embedding vector(1536);`
  );
  console.log('✅ embedding column added');
  await pool.end();
}

addColumn().catch(err => console.error('❌ addColumn error:', err.message));
