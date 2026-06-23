// backend/db/migrate-saas.cjs
const dotenv = require('dotenv');
const { join } = require('path');
dotenv.config({ path: join(__dirname, '../.env') });

const pool = require('./client.cjs');

async function migrateSaas() {
  if (!pool) {
    console.log('⚠️ Database disabled - skipping migration');
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add columns to tenants
    await client.query(`
      ALTER TABLE tenants
        ADD COLUMN IF NOT EXISTS business_name TEXT,
        ADD COLUMN IF NOT EXISTS niche TEXT DEFAULT 'general'
          CHECK (niche IN ('dental','real_estate','agency','general')),
        ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
        ADD COLUMN IF NOT EXISTS cal_link TEXT,
        ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial'
          CHECK (subscription_status IN ('trial','active','cancelled','suspended')),
        ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT,
        ADD COLUMN IF NOT EXISTS plan_id TEXT DEFAULT 'starter',
        ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days')
    `);

    // Add is_super_admin to users
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE
    `);

    // Plans table (idempotent)
    await client.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        plan_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        price_monthly INTEGER NOT NULL,
        razorpay_plan_id TEXT,
        features JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Subscriptions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        plan_id TEXT NOT NULL,
        razorpay_subscription_id TEXT UNIQUE,
        status TEXT NOT NULL DEFAULT 'created',
        start_date TIMESTAMPTZ,
        end_date TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Billing events (webhook log)
    await client.query(`
      CREATE TABLE IF NOT EXISTS billing_events (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
        event_type TEXT NOT NULL,
        razorpay_event_id TEXT UNIQUE,
        payload JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_billing_events_tenant ON billing_events(tenant_id)`);

    await client.query('COMMIT');
    console.log('✅ SaaS migration completed');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ SaaS migration failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  migrateSaas().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { migrateSaas };
