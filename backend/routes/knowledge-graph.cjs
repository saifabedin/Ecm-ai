const express = require('express');
const fs = require('fs');
const path = require('path');
const { verifyToken } = require('../middleware/auth.cjs');

const router = express.Router();

const VAULT_PATH = process.env.VAULT_PATH || '/home/ubuntu/ecm-ai-os-v2/vault/ECM-Knowledge-Brain';
const WIKILINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g;

function walk(dir, base = dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, base, out);
    else if (e.isFile() && e.name.endsWith('.md')) {
      out.push(path.relative(base, full));
    }
  }
  return out;
}

function stripExt(p) { return p.replace(/\.md$/, ''); }

function buildGraph() {
  const files = walk(VAULT_PATH);
  const nodes = new Map();
  const links = [];

  for (const rel of files) {
    const id = stripExt(rel);
    const top = rel.split('/')[0];
    nodes.set(id, {
      id,
      label: path.basename(id),
      category: top,
      kind: 'document',
      path: rel,
      incoming: 0,
      outgoing: 0,
    });
  }

  for (const rel of files) {
    const src = stripExt(rel);
    let content;
    try { content = fs.readFileSync(path.join(VAULT_PATH, rel), 'utf-8'); }
    catch { continue; }
    let m;
    WIKILINK_RE.lastIndex = 0;
    while ((m = WIKILINK_RE.exec(content)) !== null) {
      let target = m[1].trim();
      const display = (m[2] || path.basename(target)).replace(/`/g, '').trim();
      if (!target.endsWith('.md')) target = target + '.md';
      const targetId = stripExt(target);
      if (targetId === src) continue;
      if (!nodes.has(targetId)) {
        const topFolder = targetId.split('/')[0];
        nodes.set(targetId, {
          id: targetId,
          label: path.basename(targetId),
          category: topFolder,
          kind: 'document',
          path: target,
          incoming: 0,
          outgoing: 0,
        });
      }
      links.push({ source: src, target: targetId, display, weight: 1 });
    }
  }

  for (const l of links) {
    const s = nodes.get(l.source); if (s) s.outgoing += 1;
    const t = nodes.get(l.target); if (t) t.incoming += 1;
  }

  return {
    nodes: Array.from(nodes.values()),
    links,
    source: VAULT_PATH,
    generatedAt: new Date().toISOString(),
  };
}

router.get('/knowledge-graph', verifyToken, (req, res) => {
try {
const data = buildGraph();
res.json({
...data,
nodeCount: data.nodes.length,
linkCount: data.links.length,
});
} catch (err) {
res.status(500).json({ error: err.message });
}
});

module.exports = router;
