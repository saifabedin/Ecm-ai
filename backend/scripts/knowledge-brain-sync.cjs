const fs = require('fs');
const path = require('path');

const VAULT_ROOT = path.resolve(__dirname, '../../vault/ECM-Knowledge-Brain');
const API_BASE = process.env.API_BASE || 'http://localhost:5000';
const POLL_INTERVAL = 300000; // 5 min

const HOME_PATH = path.join(VAULT_ROOT, 'HOME.md');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`health ${res.status}`);
    return await res.json();
  } catch {
    return null;
  }
}

function readNotesInDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'HOME.md');
}

function extractFrontmatterVal(content, key) {
  const m = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return m ? m[1].replace(/^["']|["']$/g, '') : null;
}

function readNotesMetadata(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'HOME.md');
  return files.map(f => {
    const content = fs.readFileSync(path.join(dir, f), 'utf-8');
    return {
      name: f,
      title: extractFrontmatterVal(content, 'title') || f,
      type: extractFrontmatterVal(content, 'type') || 'unknown',
      created: extractFrontmatterVal(content, 'created') || '',
    };
  });
}

function renderHome(health) {
  const now = new Date().toISOString();
  const apiOk = !!health;
  const apiStatus = apiOk ? '✅ Online' : '❌ Unreachable';
  const memoryMB = health && typeof health.memory === 'object' ? `${Math.round(health.memory.heapUsedMB || 0)} MB` : '—';
  const uptime = health && health.uptime ? `${Math.round(health.uptime)}s` : '—';

  const projectsDir = path.join(VAULT_ROOT, '01-Projects');
  const agentsDir = path.join(VAULT_ROOT, '03-Agents');
  const archDir = path.join(VAULT_ROOT, '04-Architecture');
  const memoryDir = path.join(VAULT_ROOT, '12-Memory');

  const projects = readNotesMetadata(projectsDir);
  const agents = readNotesMetadata(agentsDir);
  const architecture = readNotesMetadata(archDir);
  const memories = readNotesMetadata(memoryDir);

  const activeProjects = projects.filter(p => p.type === 'projects' || p.type === 'project').slice(0, 5);
  const activeAgents = agents.filter(a => a.type === 'agents' || a.type === 'agent').slice(0, 5);
  const recentDecisions = [...architecture].sort((a, b) => (b.created || '').localeCompare(a.created || '')).slice(0, 5);
  const recentMemories = [...memories].sort((a, b) => (b.created || '').localeCompare(a.created || '')).slice(0, 8);
  const pendingTasks = projects.filter(p => p.type === 'tasks').slice(0, 8);

  const activeProjectsBlock = activeProjects.length
    ? activeProjects.map(p => `- [[01-Projects/${p.name}|\`${p.title}\`]] — ${p.created || ''}`).join('\n')
    : '- _No active project notes found_';
  const activeAgentsBlock = activeAgents.length
    ? activeAgents.map(a => `- [[03-Agents/${a.name}|\`${a.title}\`]] — ${a.type || ''}`).join('\n')
    : '- _No active agent notes found_';
  const recentDecisionsBlock = recentDecisions.length
    ? recentDecisions.map(d => `- [[04-Architecture/${d.name}|\`${d.title}\`]] — ${d.created || ''}`).join('\n')
    : '- _No decisions found_';
  const recentMemoriesBlock = recentMemories.length
    ? recentMemories.map(m => `- [[12-Memory/${m.name}|\`${m.title}\`]] — ${m.created || ''}`).join('\n')
    : '- _No memory entries yet_';
  const pendingTasksBlock = pendingTasks.length
    ? pendingTasks.map(t => `- [[01-Projects/${t.name}|\`${t.title}\`]]`).join('\n')
    : '- _No pending tasks_';

  const content = [
    '---',
    'title: HOME',
    'type: dashboard',
    `updated: ${now}`,
    'tags: [home, dashboard, auto]',
    '---',
    '',
    '# 🏠 ECM-AI-OS Knowledge Brain — Home',
    '',
    '> **Auto-generated dashboard** | Last updated: ' + now,
    '',
    '## 📊 System Status',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| **API Health** | ${apiStatus} |`,
    `| **Heap Used** | ${memoryMB} |`,
    `| **Uptime** | ${uptime} |`,
    `| **Vault Path** | ${VAULT_ROOT} |`,
    '',
    '## 🚀 Active Projects',
    '',
    activeProjectsBlock,
    '',
    '## 🤖 Active Agents',
    '',
    activeAgentsBlock,
    '',
    '## 📝 Recent Decisions',
    '',
    recentDecisionsBlock,
    '',
    '## 🧠 Recent Memory Entries',
    '',
    recentMemoriesBlock,
    '',
    '## ⚡ Pending Tasks',
    '',
    pendingTasksBlock,
    '',
    '## 🔗 Quick Links',
    '',
    '- System [[04-Architecture/System Architecture]]',
    '- Database [[04-Architecture/Database Architecture]]',
    '- MCP [[04-Architecture/MCP Infrastructure]]',
    '- Memory [[12-Memory/Memory System]]',
    '- Architecture [[13-Knowledge-Graph/ARCHITECTURE]]',
    '- Business [[06-Business/Business Roadmap]]',
    '',
    '> Last auto-generated: ' + now,
  ].join('\n');

  fs.writeFileSync(HOME_PATH, content, 'utf-8');
  return HOME_PATH;
}

async function runUpdate() {
  try {
    const health = await fetchHealth();
    renderHome(health);
  } catch (err) {
    console.error('[Dashboard] update failed:', err.message);
    renderHome(null);
  }
}

async function bootstrap() {
  console.log('[Dashboard] Starting (5 min poll)...');
  if (typeof runUpdate === 'function') {
    await runUpdate();
  }
  while (true) {
    await sleep(POLL_INTERVAL);
    await runUpdate();
  }
}

if (require.main === module) {
  bootstrap().catch(err => {
    console.error('[Dashboard] Fatal:', err);
    process.exit(1);
  });
}

module.exports = { runUpdate, bootstrap };
