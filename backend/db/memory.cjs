const pool = require('./client.cjs');
const { uuidv4 } = require('../utils/uuid.cjs');
const { getEmbedding } = require('../ai/embeddings.cjs');
const fs = require('fs');
const path = require('path');

const VAULT_ROOT = path.resolve(__dirname, '../../vault/ECM-Knowledge-Brain');

function getVaultPath(brandId, type, id) {
  const folderMap = {
    'research': '11-Research',
    'content': '11-Research',
    'image': '11-Research',
    'video': '11-Research',
    'publish': '11-Research',
    'ads': '11-Research',
    'tracking': '11-Research',
    'optimization': '11-Research',
    'delayed': '11-Research',
    'architecture': '04-Architecture',
    'deployment': '10-SOPs',
    'meeting': '09-Meetings',
    'agent': '03-Agents',
    'decision': '04-Architecture',
    'default': '12-Memory'
  };
  const folder = folderMap[type] || folderMap['default'];
  return path.join(VAULT_ROOT, folder, `${brandId || 'global'}-${type}-${id}.md`);
}

async function saveRun(jobId, input, output) {
  if (!pool) {
    console.log("⚠️ saveRun skipped (DB disabled)");
    return;
  }
  await pool.query(
    `INSERT INTO agent_runs (job_id, input, output) VALUES ($1, $2, $3)`,
    [jobId, JSON.stringify(input), JSON.stringify(output)]
  );
}

async function getMemory(tenantId, type) {
  if (!pool) {
    console.log("⚠️ getMemory skipped (DB disabled)");
    return null;
  }
  try {
    const result = await pool.query(
      `SELECT data FROM memory WHERE tenant_id = $1 AND type = $2 ORDER BY created_at DESC LIMIT 1`,
      [tenantId, type]
    );
    return result.rows.length > 0 ? result.rows[0].data : null;
  } catch (err) {
    console.error("❌ getMemory Error:", err.message);
    return null;
  }
}

async function saveMemory(tenantId, type, data) {
  if (!pool) {
    console.log("⚠️ saveMemory skipped (DB disabled)");
    return;
  }
  try {
    await pool.query(
      `INSERT INTO memory (tenant_id, type, data, key) VALUES ($1, $2, $3, $4)`,
      [tenantId, type, JSON.stringify(data), uuidv4()]
    );
    await syncMemoryToVault(tenantId, type, data);
  } catch (err) {
    console.error("❌ saveMemory Error:", err.message);
  }
}

async function syncMemoryToVault(tenantId, type, data) {
  try {
    const id = uuidv4();
    const vaultPath = getVaultPath(tenantId, type, id);
    fs.mkdirSync(path.dirname(vaultPath), { recursive: true });
    const frontmatter = `---\ntitle: "${type} Memory"\ntype: memory\nstatus: stored\ntenant_id: ${tenantId}\ncreated: ${new Date().toISOString().split('T')[0]}\ntags: [memory, ${type}]\n---\n\n`;
    const body = JSON.stringify(data, null, 2);
    fs.writeFileSync(vaultPath, frontmatter + body, 'utf-8');
  } catch (err) {
    console.error("❌ syncMemoryToVault Error:", err.message);
  }
}

module.exports = {
  saveRun,
  getMemory,
  saveMemory,
  syncMemoryToVault
};
