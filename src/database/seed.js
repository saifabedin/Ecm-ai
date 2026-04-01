/**
 * ECM AI Platform — Seed Data
 *
 * Inserts one test brand and one admin user for local development.
 * Safe to re-run — uses INSERT ... ON CONFLICT DO NOTHING.
 *
 * ⚠ NEVER run against production. Local / staging only.
 *
 * Run: npm run seed
 *
 * Test credentials:
 *   Brand:  ECM Test Brand  (brand_id: see TEST_BRAND_ID below)
 *   Admin:  admin@ecm.local / Admin@ECM2024!
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const { Pool } = require('pg');
const crypto = require('crypto');

const connString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
if (!connString) {
  console.error('[seed] FATAL: NEON_DATABASE_URL is not set.');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  console.error('[seed] FATAL: Refusing to seed a production database.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: connString,
  ssl: { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 10000
});

// ─── Fixed IDs (stable across re-seeds for local dev) ────────────────────────
const TEST_BRAND_ID = '00000000-0000-4000-a000-000000000001';
const TEST_USER_ID  = '00000000-0000-4000-a000-000000000002';
const TEST_PASSWORD = 'Admin@ECM2024!';

/**
 * Simple password hashing using Node.js built-in crypto (scrypt).
 * For production, replace with bcrypt in the auth routes.
 * Format: scrypt:<salt>:<hash>  — verifiable without external deps in seed context.
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const seeds = [
  {
    name: 'insert test brand',
    sql: `INSERT INTO brands (brand_id, name, domain, is_active, created_at)
          VALUES ($1, $2, $3, true, NOW())
          ON CONFLICT (brand_id) DO NOTHING`,
    params: [TEST_BRAND_ID, 'ECM Test Brand', 'test.editorschoicemedia.in']
  },
  {
    name: 'insert admin user',
    sql: `INSERT INTO users (user_id, brand_id, email, password_hash, role, created_at)
          VALUES ($1, $2, $3, $4, 'admin', NOW())
          ON CONFLICT (email) DO NOTHING`,
    params: [TEST_USER_ID, TEST_BRAND_ID, 'admin@ecm.local', hashPassword(TEST_PASSWORD)]
  }
];

// ─── Runner ───────────────────────────────────────────────────────────────────

async function seed() {
  const client = await pool.connect();
  console.log('[seed] Connected to Neon. Seeding test data...\n');

  try {
    await client.query('BEGIN');

    for (const step of seeds) {
      process.stdout.write(`  ⏳  ${step.name} ... `);
      const result = await client.query(step.sql, step.params);
      const action = result.rowCount > 0 ? 'inserted' : 'already exists (skipped)';
      process.stdout.write(`✓ ${action}\n`);
    }

    await client.query('COMMIT');

    console.log('\n[seed] ✅  Seed complete.\n');
    console.log('  Test credentials:');
    console.log(`    Brand ID : ${TEST_BRAND_ID}`);
    console.log(`    Email    : admin@ecm.local`);
    console.log(`    Password : ${TEST_PASSWORD}`);
    console.log(`    Role     : admin\n`);
    console.log('  ⚠  Do not use these credentials in production.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n[seed] ❌  Seed failed — rolled back.');
    console.error(`           ${err.message}`);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
