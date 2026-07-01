const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixDatabase() {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    // Drop conflicting tables
    await client.query("DROP TABLE IF EXISTS users CASCADE");
    await client.query("DROP TABLE IF EXISTS tenants CASCADE");
    
    // Create proper auth tables
    await client.query(`
      CREATE TABLE auth_tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    await client.query(`
      CREATE TABLE auth_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    await client.query('CREATE INDEX idx_auth_users_email ON auth_users(email)');
    await client.query('CREATE INDEX idx_auth_users_tenant_id ON auth_users(tenant_id)');
    
    await client.query("COMMIT");
    console.log("✅ Database fixed successfully");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Database fix failed:", err.message);
    throw err;
  } finally {
    client.release();
  }
}

fixDatabase();
