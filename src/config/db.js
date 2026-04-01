const { Pool } = require('pg');
const logger = require('../utils/logger');

if (!process.env.DATABASE_URL) {
  logger.error('DATABASE_URL is not set. Neon connection will fail.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  // Neon serverless: keep connections minimal
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000
});

pool.on('error', (err) => {
  logger.error('Unexpected Neon pool error', { error: err.message });
});

/**
 * Run a parameterised SQL query scoped to a brand_id.
 * Every query MUST include brand_id in the WHERE clause.
 */
async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

/**
 * Run multiple queries in a single transaction.
 */
async function transaction(queries) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = [];
    for (const { sql, params } of queries) {
      results.push(await client.query(sql, params || []));
    }
    await client.query('COMMIT');
    return results;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, transaction, pool };
