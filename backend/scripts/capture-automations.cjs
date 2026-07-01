const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VAULT_ROOT = path.resolve(__dirname, '../../vault/ECM-Knowledge-Brain');

const FOLDER_MAP = {
  research: '11-Research',
  content: '11-Research',
  image: '11-Research',
  video: '11-Research',
  publish: '11-Research',
  ads: '11-Research',
  tracking: '11-Research',
  optimization: '11-Research',
  delayed: '11-Research',
  architecture: '04-Architecture',
  deployment: '10-SOPs',
  meeting: '09-Meetings',
  agent: '03-Agents',
  decision: '04-Architecture',
  error: '04-Architecture',
  automation: '05-Automations',
  default: '12-Memory',
};

function getVaultPath(type, subfolder) {
  const folder = FOLDER_MAP[type] || FOLDER_MAP['default'];
  const sub = subfolder ? `_${subfolder}` : '';
  return path.join(VAULT_ROOT, folder, `${type}${sub}.md`);
}

function ensureVaultDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function writeVaultNote(filePath, frontmatterObj, body) {
  try {
    ensureVaultDir(filePath);
    const now = new Date().toISOString();
    const fmLines = Object.entries(frontmatterObj)
      .map(([k, v]) => typeof v === 'string' ? `${k}: ${v}` : `${k}: ${JSON.stringify(v)}`)
      .join('\n');
    const content = `---\n${fmLines}\n---\n\n${body}\n`;
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  } catch (err) {
    console.error('[Capture] write error:', err.message);
    return null;
  }
}

async function captureJobToVault(jobId, jobType, result, tenantId) {
  const filePath = getVaultPath('job', jobType);
  const status = result.success ? 'completed' : 'failed';
  const body = [
    `# Job ${jobId} — ${jobType}`,
    ``,
    `- **Job ID:** ${jobId}`,
    `- **Type:** ${jobType}`,
    `- **Status:** ${status}`,
    `- **Tenant:** ${tenantId || 'default'}`,
    `- **Captured:** ${new Date().toISOString()}`,
    ``,
    result.success ? '✅ Completed successfully.' : `❌ Error: ${result.error || 'Unknown'}`,
    ``,
    `**Output:**`,
    '```json',
    JSON.stringify(result, null, 2).slice(0, 2000),
    '```',
    ``,
    `## Related`,
    `- [[../../05-Automations/Automation Registry]]`,
  ].join('\n');
  return writeVaultNote(filePath, {
    title: `Job ${jobId}`,
    type: 'job-log',
    job_id: jobId,
    job_type: jobType,
    status,
    tenant_id: tenantId,
    created: new Date().toISOString().split('T')[0],
    tags: ['automated', 'capture', jobType],
  }, body);
}

async function captureAgentToVault(engineId, jobId, result, tenantId) {
  const filePath = getVaultPath('agent', engineId);
  const status = result.success ? 'completed' : 'failed';
  const body = [
    `# ${engineId} — ${status}`,
    ``,
    `- **Engine:** ${engineId}`,
    `- **Job ID:** ${jobId}`,
    `- **Status:** ${status}`,
    `- **Tenant:** ${tenantId || 'default'}`,
    `- **Captured:** ${new Date().toISOString()}`,
    ``,
    result.success ? '✅ Completed successfully.' : `❌ Error: ${result.error || 'Unknown'}`,
    ``,
    `**Result:**`,
    '```json',
    JSON.stringify(result).slice(0, 1500),
    '```',
    ``,
    `## Related`,
    `- [[../../03-Agents/Agent Registry]]`,
  ].join('\n');
  return writeVaultNote(filePath, {
    title: `${engineId} run ${jobId}`,
    type: 'agent-log',
    job_id: jobId,
    engine: engineId,
    status,
    tenant_id: tenantId,
    created: new Date().toISOString().split('T')[0],
    tags: ['automated', 'agent', engineId],
  }, body);
}

async function captureErrorToVault(jobId, error, jobType, tenantId) {
  const safeName = error.name || 'Error';
  const filePath = getVaultPath('error', safeName.replace(/\s+/g, '-'));
  const body = [
    `# Error: ${safeName}`,
    ``,
    `- **Job ID:** ${jobId}`,
    `- **Type:** ${jobType || 'unknown'}`,
    `- **Tenant:** ${tenantId || 'default'}`,
    `- **Captured:** ${new Date().toISOString()}`,
    ``,
    `**Error Message:**`,
    '```',
    (error.message || String(error)).slice(0, 1000),
    '```',
    ``,
    error.stack ? `**Stack Trace:**\n\`\`\`\n${error.stack.slice(0, 2000)}\n\`\`\`` : '',
    ``,
    `## Resolution Notes`,
    '',
    '',
    `## Related`,
    `- [[../../04-Architecture/System Architecture]]`,
  ].join('\n');
  return writeVaultNote(filePath, {
    title: `Error ${safeName}`,
    type: 'error-log',
    job_id: jobId,
    job_type: jobType,
    error_name: safeName,
    tenant_id: tenantId,
    created: new Date().toISOString().split('T')[0],
    tags: ['automated', 'error'],
  }, body);
}

async function captureDecisionToVault(title, description, impact) {
  const date = new Date().toISOString().split('T')[0];
  const filePath = getVaultPath('decision', date);
  const body = [
    `# ${date}: ${title}`,
    ``,
    `**Impact:** ${impact || 'unknown'}`,
    `**Status:** Accepted`,
    ``,
    `## Description`,
    description || '(no description)',
    ``,
    `## Related`,
    `- [[../../04-Architecture/System Architecture]]`,
  ].join('\n');
  return writeVaultNote(filePath, {
    title,
    type: 'decision-log',
    status: 'accepted',
    impact,
    created: date,
    tags: ['automated', 'decision'],
  }, body);
}

async function captureAutomationToVault(name, description, trigger) {
  const filePath = getVaultPath('automation', name.replace(/\s+/g, '-'));
  const body = [
    `# ${name}`,
    ``,
    `- **Trigger:** ${trigger || 'unknown'}`,
    `- **Description:** ${description || ''}`,
    `- **Captured:** ${new Date().toISOString()}`,
    ``,
    `## Related`,
    `- [[../../05-Automations/Automation Registry]]`,
  ].join('\n');
  return writeVaultNote(filePath, {
    title: name,
    type: 'automation-registry',
    trigger,
    status: 'active',
    created: new Date().toISOString().split('T')[0],
    tags: ['automated', 'automation'],
  }, body);
}

module.exports = {
  captureJobToVault,
  captureAgentToVault,
  captureErrorToVault,
  captureDecisionToVault,
  captureAutomationToVault,
};
