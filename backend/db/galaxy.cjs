const pool = require('./client.cjs');
const { uuidv4 } = require('../utils/uuid.cjs');
const { getEmbedding } = require('../ai/embeddings.cjs');
const fs = require('fs');
const path = require('path');

const VAULT_ROOT = path.resolve(__dirname, '../../vault/ECM-Knowledge-Brain');

// ─── NODE OPERATIONS ──────────────────────────────────────────
async function createNode({ nodeType, refId, label, description, metadata, activityScore }) {
  if (!pool) throw new Error('DB disabled');
  const id = uuidv4();
  await pool.query(
    `INSERT INTO galaxy_nodes (id, node_type, ref_id, label, description, metadata, activity_score)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, nodeType, refId || null, label, description || '', JSON.stringify(metadata || {}), activityScore || 0]
  );
  return id;
}

async function getNode(id) {
  if (!pool) throw new Error('DB disabled');
  const res = await pool.query(`SELECT * FROM galaxy_nodes WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

async function findNode(nodeType, refId) {
  if (!pool) throw new Error('DB disabled');
  const res = await pool.query(`SELECT * FROM galaxy_nodes WHERE node_type = $1 AND ref_id = $2`, [nodeType, refId]);
  return res.rows[0] || null;
}

async function listNodes({ nodeType, limit = 200 } = {}) {
  if (!pool) throw new Error('DB disabled');
  let q = `SELECT * FROM galaxy_nodes`;
  const params = [];
  if (nodeType) { q += ` WHERE node_type = $1`; params.push(nodeType); }
  q += ` ORDER BY connection_count DESC, activity_score DESC LIMIT $${params.length + 1}`;
  params.push(limit);
  const res = await pool.query(q, params);
  return res.rows;
}

async function searchNodes(query, limit = 20) {
  if (!pool) throw new Error('DB disabled');
  const res = await pool.query(
    `SELECT * FROM galaxy_nodes WHERE label ILIKE $1 OR description ILIKE $1 ORDER BY activity_score DESC LIMIT $2`,
    [`%${query}%`, limit]
  );
  return res.rows;
}

async function updateNodeActivity(id) {
  if (!pool) throw new Error('DB disabled');
  await pool.query(
    `UPDATE galaxy_nodes SET last_active = NOW(), activity_score = LEAST(activity_score + 1, 100) WHERE id = $1`, [id]
  );
}

// ─── EDGE OPERATIONS ──────────────────────────────────────────
async function createEdge(sourceId, targetId, edgeType = 'related', weight = 1.0, metadata = {}) {
  if (!pool) throw new Error('DB disabled');
  const id = uuidv4();
  try {
    await pool.query(
      `INSERT INTO galaxy_edges (id, source_id, target_id, edge_type, weight, metadata)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (source_id, target_id, edge_type) DO UPDATE SET weight = $5`,
      [id, sourceId, targetId, edgeType, weight, JSON.stringify(metadata)]
    );
    // Update connection counts
    await pool.query(`UPDATE galaxy_nodes SET connection_count = connection_count + 1 WHERE id IN ($1, $2)`, [sourceId, targetId]);
    return id;
  } catch (e) { return null; }
}

async function getEdges(nodeId) {
  if (!pool) throw new Error('DB disabled');
  const outgoing = await pool.query(
    `SELECT ge.*, gn.label as target_label, gn.node_type as target_type
     FROM galaxy_edges ge JOIN galaxy_nodes gn ON gn.id = ge.target_id
     WHERE ge.source_id = $1 ORDER BY ge.weight DESC`, [nodeId]
  );
  const incoming = await pool.query(
    `SELECT ge.*, gn.label as source_label, gn.node_type as source_type
     FROM galaxy_edges ge JOIN galaxy_nodes gn ON gn.id = ge.source_id
     WHERE ge.target_id = $1 ORDER BY ge.weight DESC`, [nodeId]
  );
  return { outgoing: outgoing.rows, incoming: incoming.rows };
}

async function tracePath(sourceId, targetId, maxDepth = 5) {
  if (!pool) throw new Error('DB disabled');
  const visited = new Set();
  const paths = [];
  async function dfs(current, path) {
    if (path.length > maxDepth) return;
    if (current === targetId) { paths.push([...path]); return; }
    visited.add(current);
    const edges = await pool.query(
      `SELECT target_id FROM galaxy_edges WHERE source_id = $1 UNION SELECT source_id FROM galaxy_edges WHERE target_id = $1`, [current]
    );
    for (const row of edges.rows) {
      const next = row.target_id || row.source_id;
      if (!visited.has(next)) { visited.add(next); await dfs(next, [...path, next]); visited.delete(next); }
    }
  }
  await dfs(sourceId, [sourceId]);
  return paths;
}

// ─── BUILD GALAXY FROM VAULT ──────────────────────────────────
async function buildGalaxyFromVault() {
  if (!pool) throw new Error('DB disabled');

  const vaultFiles = [];
  function walk(dir, base = dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, base);
      else if (e.isFile() && e.name.endsWith('.md')) vaultFiles.push(path.relative(base, full));
    }
  }
  walk(VAULT_ROOT);

  // Create root node
  const rootId = await createNode({ nodeType: 'root', label: 'ECM Knowledge Brain', description: 'Central knowledge hub', activityScore: 10 });
  const nodeMap = new Map();

  // Map folder types
  const typeMap = {
    '01-Projects': 'project', '02-Clients': 'client', '03-Agents': 'agent',
    '04-Architecture': 'architecture', '05-Automations': 'automation',
    '11-Research': 'research', '12-Memory': 'memory', '13-Knowledge-Graph': 'architecture',
    '10-SOPs': 'sop', '09-Meetings': 'sop',
  };

  for (const rel of vaultFiles) {
    const parts = rel.split('/');
    const folder = parts[0];
    const nodeType = typeMap[folder] || 'memory';
    const label = path.basename(rel, '.md');
    const id = await createNode({ nodeType, refId: rel, label, description: `Vault: ${rel}` });
    nodeMap.set(rel, id);

    // Connect to root
    await createEdge(rootId, id, 'contains', 0.5);

    // Connect siblings in same folder
    for (const [otherRel, otherId] of nodeMap) {
      if (otherRel !== rel && otherRel.split('/')[0] === folder) {
        await createEdge(id, otherId, 'sibling', 0.3);
      }
    }
  }

  // Build edges from wikilinks in vault files
  const WIKILINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g;
  for (const rel of vaultFiles) {
    const srcId = nodeMap.get(rel);
    if (!srcId) continue;
    let content;
    try { content = fs.readFileSync(path.join(VAULT_ROOT, rel), 'utf-8'); } catch { continue; }
    let m;
    WIKILINK_RE.lastIndex = 0;
    while ((m = WIKILINK_RE.exec(content)) !== null) {
      let target = m[1].trim();
      if (!target.endsWith('.md')) target += '.md';
      const targetId = nodeMap.get(target);
      if (targetId && targetId !== srcId) {
        await createEdge(srcId, targetId, 'references', 0.7);
      }
    }
  }

  // Connect shared memory nodes
  const memRes = await pool.query(`SELECT id, agent_id, agent_name, memory_type, title FROM shared_memory LIMIT 100`);
  for (const mem of memRes.rows) {
    const memLabel = `[${mem.agent_name}] ${mem.title}`;
    const memId = await createNode({ nodeType: 'memory', refId: mem.id, label: memLabel, description: mem.memory_type });
    // Connect to agent node
    for (const [rel, nid] of nodeMap) {
      if (rel.includes('agent') || rel.includes('Agent')) {
        await createEdge(memId, nid, 'authored_by', 0.8);
        break;
      }
    }
  }

  return { nodeCount: nodeMap.size + memRes.rows.length + 1, edgeCount: vaultFiles.length * 2 };
}

// ─── GALAXY STATS ─────────────────────────────────────────────
async function getGalaxyStats() {
  if (!pool) throw new Error('DB disabled');
  const totalNodes = await pool.query(`SELECT COUNT(*) FROM galaxy_nodes`);
  const totalEdges = await pool.query(`SELECT COUNT(*) FROM galaxy_edges`);
  const byType = await pool.query(`SELECT node_type, COUNT(*) as count FROM galaxy_nodes GROUP BY node_type ORDER BY count DESC`);
  const topNodes = await pool.query(`SELECT id, label, node_type, connection_count, activity_score FROM galaxy_nodes ORDER BY activity_score DESC LIMIT 10`);
  const recentActivity = await pool.query(`SELECT * FROM galaxy_nodes ORDER BY last_active DESC LIMIT 10`);
  return {
    totalNodes: parseInt(totalNodes.rows[0].count),
    totalEdges: parseInt(totalEdges.rows[0].count),
    byType: byType.rows,
    topNodes: topNodes.rows,
    recentActivity: recentActivity.rows,
  };
}

module.exports = {
  createNode, getNode, findNode, listNodes, searchNodes, updateNodeActivity,
  createEdge, getEdges, tracePath, buildGalaxyFromVault, getGalaxyStats,
};
