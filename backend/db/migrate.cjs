const dotenv = require('dotenv');
const { join } = require('path');

// Load .env from backend directory FIRST
dotenv.config({ path: join(__dirname, '../.env') });

const pool = require('./client.cjs');

async function migrate() {
  if (!pool) {
    console.log("⚠️ Database disabled - skipping migration");
    return;
  }

  try {
    console.log("🔄 Running database migration...");

    // Create agent_runs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_runs (
        id SERIAL PRIMARY KEY,
        job_id TEXT NOT NULL,
        input JSONB,
        output JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create memory table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS memory (
        id SERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        type TEXT NOT NULL,
        data JSONB,
        key TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
// Create logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        job_id TEXT NOT NULL,
        engine TEXT NOT NULL,
        status TEXT NOT NULL,
        tenant_id TEXT DEFAULT 'default',
        input JSONB,
        output JSONB,
        error TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Add tenant_id column if it doesn't exist (for existing tables)
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='logs' AND column_name='tenant_id') THEN
          ALTER TABLE logs ADD COLUMN tenant_id TEXT DEFAULT 'default';
        END IF;
      END $$;
    `);
    
    // Create scheduled_posts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scheduled_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        platform VARCHAR(50) NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'facebook')),
        caption TEXT NOT NULL,
        scheduled_date DATE NOT NULL,
        scheduled_time TIME NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'published', 'failed', 'cancelled')),
        media_url TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    // Create content_drafts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS content_drafts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        platform VARCHAR(50) NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'facebook')),
        caption TEXT NOT NULL,
        hook TEXT,
        body TEXT,
        cta TEXT,
        hashtags TEXT,
        script TEXT,
        hook_variations JSONB DEFAULT '[]',
        clinic_name VARCHAR(255),
        location VARCHAR(255),
        audience VARCHAR(50),
        goal VARCHAR(50),
        tone VARCHAR(50),
        avatar_image TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'archived')),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create indexes for scheduled_posts
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_date ON scheduled_posts(user_id, scheduled_date);
      CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status);
      CREATE INDEX IF NOT EXISTS idx_scheduled_posts_platform ON scheduled_posts(platform);
    `);

    // Create campaigns table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        platform VARCHAR(50) NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'facebook', 'google')),
        budget DECIMAL(10, 2) DEFAULT 0.00,
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
        start_date DATE,
        end_date DATE,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create indexes for campaigns
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_campaigns_user_status ON campaigns(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_campaigns_platform ON campaigns(platform);
      CREATE INDEX IF NOT EXISTS idx_campaigns_created ON campaigns(created_at DESC);
    `);

    console.log("✅ Migration completed successfully");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    throw err;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { migrate };
