require('dotenv').config();
const pool = require("./db/client.cjs");

async function fixLogsSchema() {
  if (!pool) {
    console.error("❌ DATABASE_URL missing — cannot fix schema");
    process.exit(1);
  }

  try {
    console.log("🔧 Fixing logs table schema...");

    // Add job_id column if it doesn't exist
    await pool.query(`
      ALTER TABLE logs
      ADD COLUMN IF NOT EXISTS job_id TEXT
    `);

    // Add tenant_id column for multi-tenancy
    await pool.query(`
      ALTER TABLE logs
      ADD COLUMN IF NOT EXISTS tenant_id TEXT
    `);

    // Add created_at if not exists (default now)
    await pool.query(`
      ALTER TABLE logs
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    `);

    console.log("✅ Schema fixed successfully — job_id and tenant_id columns added to logs table");
    process.exit(0);
  } catch (error) {
    console.error("❌ Schema fix failed:", error.message);
    process.exit(1);
  }
}

fixLogsSchema();