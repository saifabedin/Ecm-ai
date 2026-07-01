const fs = require('fs');
const path = require('path');

const CAPTURE_STATE_DIR = '/tmp/ecm-knowledge-brain';

function ensureStateDir() {
  if (!fs.existsSync(CAPTURE_STATE_DIR)) {
    fs.mkdirSync(CAPTURE_STATE_DIR, { recursive: true });
  }
}

function getJobCapturePath(jobId) {
  return path.join(CAPTURE_STATE_DIR, `captured-${jobId}`);
}

async function isJobCaptured(jobId) {
  try {
    ensureStateDir();
    return fs.existsSync(getJobCapturePath(jobId));
  } catch {
    return false;
  }
}

async function markJobCaptured(jobId) {
  try {
    ensureStateDir();
    fs.writeFileSync(getJobCapturePath(jobId), new Date().toISOString(), 'utf-8');
  } catch (err) {
    console.error('[KnowledgeBrain] markJobCaptured error:', err.message);
  }
}

async function getRecentCapturedJobIds(maxAgeMs = 86400000) {
  try {
    ensureStateDir();
    const now = Date.now();
    const files = fs.readdirSync(CAPTURE_STATE_DIR);
    const recent = [];
    for (const file of files) {
      if (!file.startsWith('captured-')) continue;
      const fp = path.join(CAPTURE_STATE_DIR, file);
      const stat = fs.statSync(fp);
      if (now - stat.mtimeMs < maxAgeMs) {
        recent.push(file.replace('captured-', ''));
      }
    }
    return recent;
  } catch {
    return [];
  }
}

module.exports = {
  isJobCaptured,
  markJobCaptured,
  getRecentCapturedJobIds,
  CAPTURE_STATE_DIR,
};
