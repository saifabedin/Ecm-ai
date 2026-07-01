require('../initEnv.cjs');
const pool = require('./client.cjs');

async function fix() {
  if (!pool) {
    console.log('⚠️ Database disabled, cannot fix memory columns');
    return;
  }
  await pool.query(`DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='memory' AND column_name='type') THEN
      ALTER TABLE memory ADD COLUMN type TEXT NOT NULL DEFAULT 'default';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='memory' AND column_name='data') THEN
      ALTER TABLE memory ADD COLUMN data JSONB;
    END IF;
  END $$;`);
  console.log('✅ Memory columns ensured');
  await pool.end();
}
fix().catch(err => console.error('❌ Fix memory failed:', err.message));
