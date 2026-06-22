const pool = require('./client.cjs');
const { uuidv4 } = require('../utils/uuid.cjs');
const { getEmbedding } = require('../ai/embeddings.cjs');
const fs = require('fs');
const path = require('path');

const VAULT_ROOT = path.resolve(__dirname, '../../vault/ECM-Knowledge-Brain');

const VAULT_FOLDER_MAP = {
  decisions: '04-Architecture',
  research: '11-Research',
  architecture: '04-Architecture',
  deployments: '10-SOPs',
  customer_context: '02-Clients',
  automation_knowledge: '05-Automations',
};

// ─── WRITE MEMORY ───────────────────────────────────────────────
async function writeMemory({
  agentId,
  agentName,
  memoryType,
  title,
  content,
  confidence = 0.80,
  relatedGraphNodes = [],
  tags = [],
  parentId = null,
  tenantId = 'global',
}) {
  if (!pool) throw new Error('Database disabled');

  const id = uuidv4();
  let embedding = null;
  try {
    embedding = await getEmbedding(`${title} ${JSON.stringify(content)}`);
  } catch (e) {
    console.warn('⚠️ Embedding generation failed, storing without vector:', e.message);
  }

  await pool.query(
    `INSERT INTO shared_memory
      (id, agent_id, agent_name, memory_type, title, content, confidence,
       related_graph_nodes, tags, parent_id, embedding, tenant_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [id, agentId, agentName, memoryType, title, JSON.stringify(content),
     confidence, relatedGraphNodes, tags, parentId, embedding ? JSON.stringify(embedding) : null, tenantId]
  );

  // Sync to vault
  await syncToVault({ id, agentId, agentName, memoryType, title, content, confidence, relatedGraphNodes, tags, tenantId });

  // Auto-detect conflicts
  const conflicts = await detectConflicts(id, memoryType, content, tenantId);

  return { id, conflicts };
}

// ─── READ MEMORY ────────────────────────────────────────────────
async function readMemory(memoryId) {
  if (!pool) throw new Error('Database disabled');
  const res = await pool.query(
    `SELECT * FROM shared_memory WHERE id = $1`, [memoryId]
  );
  return res.rows[0] || null;
}

async function listMemory({ agentId, memoryType, tenantId = 'global', limit = 50, offset = 0 }) {
  if (!pool) throw new Error('Database disabled');
  let query = `SELECT * FROM shared_memory WHERE tenant_id = $1`;
  const params = [tenantId];
  let idx = 2;

  if (agentId) { query += ` AND agent_id = $${idx++}`; params.push(agentId); }
  if (memoryType) { query += ` AND memory_type = $${idx++}`; params.push(memoryType); }

  query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(limit, offset);

  const res = await pool.query(query, params);
  let countQuery = `SELECT COUNT(*) FROM shared_memory WHERE tenant_id = $1`;
  const countParams = [tenantId];
  let countIdx = 2;
  if (agentId) { countQuery += ` AND agent_id = $${countIdx++}`; countParams.push(agentId); }
  if (memoryType) { countQuery += ` AND memory_type = $${countIdx++}`; countParams.push(memoryType); }
  const countRes = await pool.query(countQuery, countParams);
  return { memories: res.rows, total: parseInt(countRes.rows[0].count) };
}

// ─── SEARCH MEMORY (semantic) ──────────────────────────────────
async function searchMemory(query, { tenantId = 'global', limit = 10, memoryType, agentId } = {}) {
  if (!pool) throw new Error('Database disabled');

  let embedding;
  try {
    embedding = await getEmbedding(query);
  } catch (e) {
    // Fallback: keyword search
    let q = `SELECT * FROM shared_memory WHERE tenant_id = $1 AND (title ILIKE $2 OR content::text ILIKE $2)`;
    const params = [tenantId, `%${query}%`];
    if (memoryType) { q += ` AND memory_type = $3`; params.push(memoryType); }
    q += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    const res = await pool.query(q, params);
    return res.rows;
  }

  let q = `
    SELECT *, 1 - (embedding <=> $1::vector) AS relevance_score
    FROM shared_memory
    WHERE tenant_id = $2 AND embedding IS NOT NULL
  `;
  const params = [JSON.stringify(embedding), tenantId];
  let idx = 3;

  if (memoryType) { q += ` AND memory_type = $${idx++}`; params.push(memoryType); }
  if (agentId) { q += ` AND agent_id = $${idx++}`; params.push(agentId); }

  q += ` ORDER BY embedding <=> $1::vector LIMIT $${idx}`;
  params.push(limit);

  const res = await pool.query(q, params);
  return res.rows;
}

// ─── REFERENCE MEMORY ──────────────────────────────────────────
async function referenceMemory(sourceId, referencedId, referenceType, context = null) {
  if (!pool) throw new Error('Database disabled');
  const id = uuidv4();
  await pool.query(
    `INSERT INTO memory_references (id, source_memory_id, referenced_memory_id, reference_type, context)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT (source_memory_id, referenced_memory_id, reference_type) DO NOTHING`,
    [id, sourceId, referencedId, referenceType, context]
  );
  return id;
}

async function getReferences(memoryId) {
  if (!pool) throw new Error('Database disabled');
  const outgoing = await pool.query(
    `SELECT mr.*, sm.title as ref_title, sm.agent_name as ref_agent, sm.memory_type as ref_type
     FROM memory_references mr JOIN shared_memory sm ON sm.id = mr.referenced_memory_id
     WHERE mr.source_memory_id = $1`, [memoryId]
  );
  const incoming = await pool.query(
    `SELECT mr.*, sm.title as ref_title, sm.agent_name as ref_agent, sm.memory_type as ref_type
     FROM memory_references mr JOIN shared_memory sm ON sm.id = mr.source_memory_id
     WHERE mr.referenced_memory_id = $1`, [memoryId]
  );
  return { outgoing: outgoing.rows, incoming: incoming.rows };
}

// ─── CITATION ──────────────────────────────────────────────────
async function citeMemory(memoryId) {
  const mem = await readMemory(memoryId);
  if (!mem) return null;
  return {
    citation: `[${mem.agent_name}, ${mem.memory_type}, ${new Date(mem.created_at).toISOString().split('T')[0]}] "${mem.title}" (confidence: ${mem.confidence})`,
    memory: mem,
  };
}

// ─── UTILITY: TEXT SIMILARITY ──────────────────────────────────
function calculateSimilarity(a, b) {
  if (!a || !b) return 0;
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

// ─── CONFLICT DETECTION ────────────────────────────────────────
async function detectConflicts(newMemoryId, memoryType, content, tenantId) {
  if (!pool) return [];

  // Find potential conflicts: same type, similar title, different agent
  const newMem = await readMemory(newMemoryId);
  if (!newMem) return [];

  const candidates = await pool.query(
    `SELECT id, agent_id, title, content, confidence FROM shared_memory
     WHERE memory_type = $1 AND tenant_id = $2 AND id != $3
     ORDER BY created_at DESC LIMIT 20`,
    [memoryType, tenantId, newMemoryId]
  );

  const conflicts = [];
  for (const c of candidates.rows) {
    const titleSimilarity = calculateSimilarity(newMem.title, c.title);
    if (titleSimilarity > 0.7) {
      const conflictType = titleSimilarity > 0.9 ? 'duplication' : 'contradiction';
      const conflictId = uuidv4();
      await pool.query(
        `INSERT INTO memory_conflicts (id, memory_a_id, memory_b_id, conflict_type, severity)
         VALUES ($1,$2,$3,$4,$5)`,
        [conflictId, newMemoryId, c.id, conflictType, titleSimilarity > 0.9 ? 'high' : 'medium']
      );
      conflicts.push({ id: conflictId, type: conflictType, with: c.id, title: c.title, similarity: titleSimilarity });
    }
  }
  return conflicts;
}

async function listConflicts({ tenantId = 'global', severity, unresolved = true } = {}) {
  if (!pool) throw new Error('Database disabled');
  let q = `
    SELECT mc.*, sm1.title as title_a, sm1.agent_name as agent_a,
           sm2.title as title_b, sm2.agent_name as agent_b
    FROM memory_conflicts mc
    JOIN shared_memory sm1 ON sm1.id = mc.memory_a_id
    JOIN shared_memory sm2 ON sm2.id = mc.memory_b_id
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;
  if (unresolved) { q += ` AND mc.resolved_at IS NULL`; }
  if (severity) { q += ` AND mc.severity = $${idx++}`; params.push(severity); }
  q += ` ORDER BY mc.created_at DESC LIMIT 50`;
  const res = await pool.query(q, params);
  return res.rows;
}

async function resolveConflict(conflictId, resolution, resolvedBy) {
  if (!pool) throw new Error('Database disabled');
  await pool.query(
    `UPDATE memory_conflicts SET resolution = $1, resolved_by = $2, resolved_at = NOW() WHERE id = $3`,
    [resolution, resolvedBy, conflictId]
  );
}

// ─── RELEVANCE SCORING ─────────────────────────────────────────
async function scoreRelevance(memoryId, contextQuery) {
  if (!pool) throw new Error('Database disabled');
  const mem = await readMemory(memoryId);
  if (!mem) return 0;

  let score = 0;

  // Factor 1: Confidence weight (30%)
  score += parseFloat(mem.confidence) * 0.3;

  // Factor 2: Recency (20%)
  const ageMs = Date.now() - new Date(mem.created_at).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  score += Math.max(0, 1 - ageDays / 30) * 0.2;

  // Factor 3: Citation count (20%)
  const refCount = await pool.query(
    `SELECT COUNT(*) FROM memory_references WHERE referenced_memory_id = $1`, [memoryId]
  );
  score += Math.min(parseInt(refCount.rows[0].count) / 10, 1) * 0.2;

  // Factor 4: Semantic similarity (30%)
  if (contextQuery && mem.embedding) {
    try {
      const queryEmb = await getEmbedding(contextQuery);
      const simRes = await pool.query(
        `SELECT 1 - (embedding <=> $1::vector) AS sim FROM shared_memory WHERE id = $2`,
        [JSON.stringify(queryEmb), memoryId]
      );
      if (simRes.rows[0]) score += parseFloat(simRes.rows[0].sim) * 0.3;
    } catch (e) { /* skip semantic factor */ }
  } else {
    score += 0.15; // neutral if no query
  }

  return Math.min(Math.round(score * 100) / 100, 1);
}

async function getRelevantMemory(query, { tenantId = 'global', memoryType, limit = 5 } = {}) {
  const results = await searchMemory(query, { tenantId, limit: limit * 2, memoryType });
  const scored = [];
  for (const mem of results) {
    const score = await scoreRelevance(mem.id, query);
    scored.push({ ...mem, relevance_score: score });
  }
  return scored.sort((a, b) => b.relevance_score - a.relevance_score).slice(0, limit);
}

// ─── VAULT SYNC ────────────────────────────────────────────────
async function syncToVault({ id, agentId, agentName, memoryType, title, content, confidence, relatedGraphNodes, tags, tenantId }) {
  try {
    const folder = VAULT_FOLDER_MAP[memoryType] || '12-Memory';
    const fileName = `${agentId}-${memoryType}-${id}.md`;
    const vaultPath = path.join(VAULT_ROOT, folder, fileName);
    fs.mkdirSync(path.dirname(vaultPath), { recursive: true });

    const frontmatter = [
      '---',
      `title: "${title}"`,
      `type: shared-memory`,
      `memory_type: ${memoryType}`,
      `agent_id: ${agentId}`,
      `agent_name: ${agentName}`,
      `confidence: ${confidence}`,
      `status: active`,
      `tenant_id: ${tenantId}`,
      `created: ${new Date().toISOString().split('T')[0]}`,
      `tags: [${tags.join(', ')}]`,
      `related_nodes: [${relatedGraphNodes.join(', ')}]`,
      '---',
      '',
    ].join('\n');

    const body = [
      `# ${title}`,
      '',
      `**Agent:** ${agentName} (${agentId})`,
      `**Type:** ${memoryType}`,
      `**Confidence:** ${(confidence * 100).toFixed(0)}%`,
      `**Created:** ${new Date().toISOString()}`,
      '',
      '## Content',
      '',
      typeof content === 'object' ? JSON.stringify(content, null, 2) : content,
      '',
    ];

    if (relatedGraphNodes.length > 0) {
      body.push('## Related Graph Nodes');
      relatedGraphNodes.forEach(n => body.push(`- [[${n}]]`));
      body.push('');
    }

    fs.writeFileSync(vaultPath, frontmatter + body.join('\n'), 'utf-8');
  } catch (err) {
    console.error('❌ syncToVault error:', err.message);
  }
}

// ─── STATS ─────────────────────────────────────────────────────
async function getStats(tenantId = 'global') {
  if (!pool) throw new Error('Database disabled');

  const total = await pool.query(`SELECT COUNT(*) FROM shared_memory WHERE tenant_id = $1`, [tenantId]);
  const byAgent = await pool.query(
    `SELECT agent_id, agent_name, COUNT(*) as count FROM shared_memory WHERE tenant_id = $1 GROUP BY agent_id, agent_name ORDER BY count DESC`, [tenantId]
  );
  const byType = await pool.query(
    `SELECT memory_type, COUNT(*) as count FROM shared_memory WHERE tenant_id = $1 GROUP BY memory_type ORDER BY count DESC`, [tenantId]
  );
  const unresolvedConflicts = await pool.query(
    `SELECT COUNT(*) FROM memory_conflicts WHERE resolved_at IS NULL`
  );
  const recentRefs = await pool.query(
    `SELECT COUNT(*) FROM memory_references WHERE created_at > NOW() - INTERVAL '24 hours'`
  );

  return {
    totalMemories: parseInt(total.rows[0].count),
    byAgent: byAgent.rows,
    byType: byType.rows,
    unresolvedConflicts: parseInt(unresolvedConflicts.rows[0].count),
    recentReferences: parseInt(recentRefs.rows[0].count),
  };
}

module.exports = {
  writeMemory,
  readMemory,
  listMemory,
  searchMemory,
  referenceMemory,
  getReferences,
  citeMemory,
  detectConflicts,
  listConflicts,
  resolveConflict,
  scoreRelevance,
  getRelevantMemory,
  getStats,
  syncToVault,
};
