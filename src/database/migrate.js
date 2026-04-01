/**
 * ECM AI Platform — Neon PostgreSQL Migration
 *
 * Uses NEON_DATABASE_URL (direct connection) not DATABASE_URL (pooler).
 * Pooler connections do not support DDL reliably — always migrate via direct.
 *
 * Run: npm run migrate
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const { Pool } = require('pg');

const connString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
if (!connString) {
  console.error('[migrate] FATAL: NEON_DATABASE_URL is not set.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: connString,
  ssl: { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 10000
});

// ─── Migration Steps ──────────────────────────────────────────────────────────
// Executed in order inside a single transaction. All idempotent (IF NOT EXISTS).

const steps = [

  // ── Extensions ──────────────────────────────────────────────────────────────
  {
    name: 'enable pgcrypto',
    sql: `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`
  },

  // ── ENUM Types ───────────────────────────────────────────────────────────────
  {
    name: 'create enum user_role',
    sql: `DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('admin', 'user');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  },
  {
    name: 'create enum job_status',
    sql: `DO $$ BEGIN
      CREATE TYPE job_status AS ENUM ('queued', 'running', 'done', 'failed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  },

  // ── Table: brands ────────────────────────────────────────────────────────────
  // Root tenant anchor. Every other table FKs to this.
  {
    name: 'create table brands',
    sql: `CREATE TABLE IF NOT EXISTS brands (
      brand_id   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      name       VARCHAR(255) NOT NULL,
      domain     VARCHAR(255),
      is_active  BOOLEAN      NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )`
  },

  // ── Table: users ─────────────────────────────────────────────────────────────
  // Platform users scoped to a brand. Email is globally unique.
  {
    name: 'create table users',
    sql: `CREATE TABLE IF NOT EXISTS users (
      user_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      brand_id      UUID        NOT NULL REFERENCES brands(brand_id) ON DELETE CASCADE,
      email         VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT        NOT NULL,
      role          user_role   NOT NULL DEFAULT 'user',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  },

  // ── Table: engine_jobs ───────────────────────────────────────────────────────
  // Tracks every async engine run. Updated by n8n callback webhook.
  {
    name: 'create table engine_jobs',
    sql: `CREATE TABLE IF NOT EXISTS engine_jobs (
      job_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      brand_id    UUID        NOT NULL REFERENCES brands(brand_id) ON DELETE CASCADE,
      engine_slug VARCHAR(100) NOT NULL,
      status      job_status  NOT NULL DEFAULT 'queued',
      payload     JSONB,
      result      JSONB,
      error       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  },

  // ── Table: agent_logs ────────────────────────────────────────────────────────
  // Stores every agent invocation: input, output, token usage.
  {
    name: 'create table agent_logs',
    sql: `CREATE TABLE IF NOT EXISTS agent_logs (
      log_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      brand_id    UUID        NOT NULL REFERENCES brands(brand_id) ON DELETE CASCADE,
      agent_type  VARCHAR(100) NOT NULL,
      input       JSONB,
      output      JSONB,
      tokens_used INT         NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  },

  // ── Table: commands ──────────────────────────────────────────────────────────
  // Audit trail for all /plan /deploy /test /optimize /status invocations.
  {
    name: 'create table commands',
    sql: `CREATE TABLE IF NOT EXISTS commands (
      cmd_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      brand_id   UUID        NOT NULL REFERENCES brands(brand_id) ON DELETE CASCADE,
      command    VARCHAR(50) NOT NULL,
      args       JSONB,
      status     VARCHAR(50) NOT NULL DEFAULT 'pending',
      result     JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  },

  // ── Trigger: engine_jobs updated_at ──────────────────────────────────────────
  {
    name: 'create update_updated_at function',
    sql: `CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$`
  },
  {
    name: 'create engine_jobs updated_at trigger',
    sql: `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'engine_jobs_updated_at'
          AND tgrelid = 'engine_jobs'::regclass
      ) THEN
        CREATE TRIGGER engine_jobs_updated_at
          BEFORE UPDATE ON engine_jobs
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      END IF;
    END $$`
  },

  // ── Indexes: brands ──────────────────────────────────────────────────────────
  {
    name: 'index brands(created_at)',
    sql: `CREATE INDEX IF NOT EXISTS idx_brands_created_at ON brands(created_at DESC)`
  },
  {
    name: 'index brands(is_active)',
    sql: `CREATE INDEX IF NOT EXISTS idx_brands_is_active ON brands(is_active)`
  },

  // ── Indexes: users ───────────────────────────────────────────────────────────
  {
    name: 'index users(brand_id)',
    sql: `CREATE INDEX IF NOT EXISTS idx_users_brand_id ON users(brand_id)`
  },
  {
    name: 'index users(brand_id, created_at)',
    sql: `CREATE INDEX IF NOT EXISTS idx_users_brand_created_at ON users(brand_id, created_at DESC)`
  },
  {
    name: 'index users(email)',
    sql: `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`
  },

  // ── Indexes: engine_jobs ─────────────────────────────────────────────────────
  {
    name: 'index engine_jobs(brand_id)',
    sql: `CREATE INDEX IF NOT EXISTS idx_engine_jobs_brand_id ON engine_jobs(brand_id)`
  },
  {
    name: 'index engine_jobs(brand_id, created_at)',
    sql: `CREATE INDEX IF NOT EXISTS idx_engine_jobs_brand_created_at ON engine_jobs(brand_id, created_at DESC)`
  },
  {
    name: 'index engine_jobs(status)',
    sql: `CREATE INDEX IF NOT EXISTS idx_engine_jobs_status ON engine_jobs(status)`
  },
  {
    name: 'index engine_jobs(engine_slug)',
    sql: `CREATE INDEX IF NOT EXISTS idx_engine_jobs_engine_slug ON engine_jobs(engine_slug)`
  },
  {
    name: 'index engine_jobs(brand_id, status)',
    sql: `CREATE INDEX IF NOT EXISTS idx_engine_jobs_brand_status ON engine_jobs(brand_id, status)`
  },

  // ── Indexes: agent_logs ──────────────────────────────────────────────────────
  {
    name: 'index agent_logs(brand_id)',
    sql: `CREATE INDEX IF NOT EXISTS idx_agent_logs_brand_id ON agent_logs(brand_id)`
  },
  {
    name: 'index agent_logs(brand_id, created_at)',
    sql: `CREATE INDEX IF NOT EXISTS idx_agent_logs_brand_created_at ON agent_logs(brand_id, created_at DESC)`
  },
  {
    name: 'index agent_logs(brand_id, agent_type)',
    sql: `CREATE INDEX IF NOT EXISTS idx_agent_logs_brand_agent ON agent_logs(brand_id, agent_type)`
  },

  // ── Indexes: commands ────────────────────────────────────────────────────────
  {
    name: 'index commands(brand_id)',
    sql: `CREATE INDEX IF NOT EXISTS idx_commands_brand_id ON commands(brand_id)`
  },
  {
    name: 'index commands(brand_id, created_at)',
    sql: `CREATE INDEX IF NOT EXISTS idx_commands_brand_created_at ON commands(brand_id, created_at DESC)`
  },
  {
    name: 'index commands(brand_id, status)',
    sql: `CREATE INDEX IF NOT EXISTS idx_commands_brand_status ON commands(brand_id, status)`
  }

];

// ─── Runner ───────────────────────────────────────────────────────────────────

async function migrate() {
  const client = await pool.connect();
  console.log('[migrate] Connected to Neon (direct). Running migrations...\n');

  try {
    await client.query('BEGIN');

    for (const step of steps) {
      process.stdout.write(`  ⏳  ${step.name} ... `);
      await client.query(step.sql);
      process.stdout.write('✓\n');
    }

    await client.query('COMMIT');
    console.log(`\n[migrate] ✅  ${steps.length} steps completed successfully.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n[migrate] ❌  Migration failed — rolled back.');
    console.error(`           Step: ${err.hint || ''}`);
    console.error(`           ${err.message}`);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
