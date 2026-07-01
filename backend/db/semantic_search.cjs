require('../initEnv.cjs');
const pool = require('./client.cjs');
const { getEmbedding } = require('../ai/embeddings.cjs');

async function searchMemories(query, limit = 5) {
  if (!pool) throw new Error('Database disabled');
  const embedding = await getEmbedding(query);
  const res = await pool.query(
    `SELECT id, brand_id, type, data FROM memory ORDER BY embedding <=> $1 LIMIT $2`,
    [embedding, limit]
  );
  return res.rows;
}

module.exports = { searchMemories };
