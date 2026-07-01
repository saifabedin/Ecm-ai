const OpenAI = require('openai');
require('../initEnv.cjs'); // ensure env loaded

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function getEmbedding(text) {
  try {
    const res = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: text,
    });
    return res.data[0].embedding;
  } catch (err) {
    // Fallback: generate deterministic pseudo-embedding based on text hash
    const hash = Array.from(text).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const dim = 1536; // typical embedding dimension
    const vector = new Array(dim).fill(0).map((_, i) => ((hash + i) % 100) / 100);
    return vector;
  }
}

module.exports = { getEmbedding };
