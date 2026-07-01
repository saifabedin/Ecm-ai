const dotenv = require('dotenv');
const { join } = require('path');

// Load .env from backend directory FIRST
dotenv.config({ path: join(__dirname, '../.env') });

const pool = require('./client.cjs');

async function migrateAuth() {
  if (!pool) {
    console.log("⚠️ Database disabled - skipping auth migration");
    return;
  }

  try {
    console.log("🔄 Running auth database migration...");

    // Check if tenants table exists
    const tenantCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'tenants'
      )
    `);

    if (!tenantCheck.rows[0].exists) {
      // Create tenants table
      await pool.query(`
        CREATE TABLE tenants (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      console.log("✅ Created tenants table");
    } else {
      console.log("✅ Tenants table already exists");
    }

    // Check if users table exists
    const userCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'users'
      )
    `);

    if (!userCheck.rows[0].exists) {
      // Create users table
      await pool.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'admin',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      console.log("✅ Created users table");
    } else {
      console.log("✅ Users table already exists");
    }

    // Create index on email for faster lookups
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
      `);
      console.log("✅ Created email index");
    } catch (err) {
      console.log("⚠️ Email index may already exist:", err.message);
    }

    // Create plans table
    const plansCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'plans'
      )
    `);

    if (!plansCheck.rows[0].exists) {
      await pool.query(`
        CREATE TABLE plans (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          plan_id VARCHAR(50) UNIQUE NOT NULL,
          monthly_requests INTEGER DEFAULT 100,
          cost DECIMAL(10, 2) DEFAULT 0.00,
          features JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await pool.query(`
        INSERT INTO plans (name, plan_id, monthly_requests)
        VALUES ('Free Plan', 'free', 100)
      `);
      console.log("✅ Created plans table");
    } else {
      console.log("✅ Plans table already exists");
    }

// Create usage_logs table
    const usageCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'usage_logs'
      )
    `);

    if (!usageCheck.rows[0].exists) {
      await pool.query(`
        CREATE TABLE usage_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT NOT NULL,
          job_type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'completed',
          tokens_used INTEGER DEFAULT 0,
          cost DECIMAL(10, 2) DEFAULT 0.00,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      console.log("✅ Created usage_logs table");
    } else {
      console.log("✅ Usage logs table already exists");
    }

// Create index on tenant_id for faster lookups
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id)
      `);
      console.log("✅ Created tenant_id index");
    } catch (err) {
      console.log("⚠️ tenant_id index may already exist:", err.message);
    }

    console.log("✅ Auth migration completed successfully");
  } catch (err) {
    console.error("❌ Auth migration failed:", err.message);
    throw err;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateAuth()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { migrateAuth };
