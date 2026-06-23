// backend/scripts/seed-super-admin.cjs
const dotenv = require('dotenv');
const { join } = require('path');
dotenv.config({ path: join(__dirname, '../.env') });

const bcrypt = require('bcrypt');
const pool = require('../db/client.cjs');

async function seedSuperAdmin() {
  const email    = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name     = process.env.SUPER_ADMIN_NAME || 'Platform Owner';

  if (!email || !password) {
    throw new Error('Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in .env');
  }

  const hash = await bcrypt.hash(password, 10);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create a tenant for the super admin (idempotent: SELECT first)
    let tenantId;
    const existingTenant = await client.query('SELECT id FROM tenants WHERE name = $1 LIMIT 1', [name]);
    if (existingTenant.rows.length > 0) {
      tenantId = existingTenant.rows[0].id;
    } else {
      const tenantRes = await client.query(
        `INSERT INTO tenants (name, business_name, niche, subscription_status, onboarding_complete)
         VALUES ($1, $2, 'general', 'active', TRUE)
         RETURNING id`,
        [name, name]
      );
      tenantId = tenantRes.rows[0].id;
    }

    await client.query(`
      INSERT INTO users (name, email, password_hash, role, tenant_id, is_super_admin)
      VALUES ($1, $2, $3, 'user', $4, TRUE)
      ON CONFLICT (email) DO UPDATE
        SET is_super_admin = TRUE, role = 'user'
    `, [name, email.toLowerCase(), hash, tenantId]);

    await client.query('COMMIT');
    console.log(`✅ Super admin created: ${email}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seedSuperAdmin().catch(e => { console.error(e.message); process.exit(1); });
