const fs = require('fs');
const path = require('path');

const VAULT_ROOT = path.resolve(__dirname, '../../vault/ECM-Knowledge-Brain');

function walkNotes(dir, depth = 0, maxDepth = 10, results = []) {
  if (depth > maxDepth) return results;
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && !['node_modules', 'workflows'].includes(entry.name)) {
      walkNotes(full, depth + 1, maxDepth, results);
    } else if (entry.isFile() && entry.name.endsWith('.md') && !['HOME.md'].includes(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

function extractLinks(content) {
  const wikiRegex = /\[\[([^\[\]|]+)(?:\|[^\]]+)?\]\]/g;
  const links = [];
  let m;
  while ((m = wikiRegex.exec(content)) !== null) {
    links.push(m[1]);
  }
  return links;
}

function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };
  const fm = {};
  const fmBlock = match[1];
  const currentMultiline = [];
  let currentKey = null;
  for (const line of fmBlock.split('\n')) {
    const m = line.match(/^([^:]+):\s*(.*)$/);
    if (m && !currentKey) {
      const [, key, raw] = m;
      if (raw.startsWith('[') || raw.startsWith('{')) {
        try { fm[key] = JSON.parse(raw); } catch { fm[key] = raw; }
      } else if (raw === '') {
        currentKey = key;
        currentMultiline = [];
      } else {
        fm[key] = raw.replace(/^["']|["']$/g, '');
      }
      currentKey = key;
      currentMultiline = [raw];
    } else if (currentKey) {
      currentMultiline.push(line);
      try { fm[currentKey] = JSON.parse(currentMultiline.join('\n')); } catch { fm[currentKey] = currentMultiline.join('\n').trim(); }
      if (line.trim() === '' || line.match(/^[a-zA-Z]/)) {
        currentKey = null;
        currentMultiline = [];
      }
    }
  }
  return { frontmatter: fm, body: match[2] || '' };
}

function relativePathToVault(fullPath) {
  const rel = path.relative(VAULT_ROOT, fullPath);
  return rel.replace(/\\/g, '/').replace(/\.md$/i, '');
}

function titleFromPath(relPath) {
  const parts = relPath.split('/');
  return parts[parts.length - 1].replace(/[-_]/g, ' ');
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function generateBacklinks(notes, targetRelPath) {
  const backlinks = [];
  for (const note of notes) {
    const content = fs.readFileSync(note, 'utf-8');
    const relTarget = relativePathToVault(targetRelPath);
    const linkTarget = relTarget.endsWith('.md') ? relTarget.slice(0, -3) : relTarget;
    const wikiRegex = new RegExp(`\\[\\[${linkTarget}(?:\\|[^\\]]+)?\\]\\]`, 'i');
    if (wikiRegex.test(content)) {
      backlinks.push(relativePathToVault(note));
    }
  }
  return backlinks;
}

function findRelatedNotes(notes, note) {
  const { frontmatter, body } = extractFrontmatter(fs.readFileSync(note, 'utf-8'));
  const tags = new Set();
  if (Array.isArray(frontmatter.tags)) {
    frontmatter.tags.forEach(t => tags.add(typeof t === 'string' ? t : ''));
  }
  if (frontmatter.type) tags.add(typeof frontmatter.type === 'string' ? frontmatter.type : '');
  const linkTargets = new Set(extractLinks(body));

  const scored = [];
  for (const other of notes) {
    if (path.resolve(other) === path.resolve(note)) continue;
    let score = 0;
    const content = fs.readFileSync(other, 'utf-8');
    const { frontmatter: ofm } = extractFrontmatter(content);
    if (Array.isArray(ofm.tags)) {
      ofm.tags.forEach(t => { if (tags.has(typeof t === 'string' ? t : '')) score += 2; });
    }
    if (ofm.type && tags.has(typeof ofm.type === 'string' ? ofm.type : '')) score += 2;
    for (const link of extractLinks(content)) {
      if (linkTargets.has(link)) score += 3;
    }
    for (const link of extractLinks(body)) {
      const relOther = relativePathToVault(other).replace(/\.md$/i, '');
      if (link.toLowerCase() === relOther.toLowerCase()) score += 3;
    }
    if (score > 0) {
      scored.push({ path: relativePathToVault(other), score, title: titleFromPath(relativePathToVault(other)) });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 10);
}

function updateBacklinksSection(notePaths) {
  for (const notePath of notePaths) {
    if (!fs.existsSync(notePath)) continue;
    let content = fs.readFileSync(notePath, 'utf-8');
    const relPath = relativePathToVault(notePath);
    const backlinks = generateBacklinks(notePaths, notePath);

    const backlinksBlock = backlinks.length > 0
      ? '\n## Backlinks\n\n' + backlinks.map(b => `- [[${b}]]`).join('\n') + '\n'
      : '';

    const fmEnd = content.indexOf('---', 3);
    if (fmEnd === -1) continue;
    const afterFm = content.slice(fmEnd + 3);

    let trimmed = afterFm.replace(/^## Backlinks\n[\s\S]*/m, '').trimStart();
    content = content.slice(0, fmEnd + 3) + '\n' + trimmed.trimStart() + backlinksBlock;

    fs.writeFileSync(notePath, content, 'utf-8');
  }
}

function updateDependencyMap(notePaths) {
  const mapPath = path.join(VAULT_ROOT, '13-Knowledge-Graph', 'Dependency Map.md');
  const entries = [];
  const summary = { [new Date().toISOString().split('T')[0]]: 0 };
  for (const note of notePaths) {
    const content = fs.readFileSync(note, 'utf-8');
    const links = extractLinks(content);
    const rel = relativePathToVault(note);
    const title = titleFromPath(rel);
    if (links.length === 0) continue;
    summary[new Date().toISOString().split('T')[0]]++;
    entries.push(`- [[${rel}]] → ${links.map(l => `[[${l}]]`).join(', ')}`);
  }
  const body = [
    `# Project Dependency Map`,
    ``,
    `> Auto-generated knowledge graph. Using pgvector semantic search for relationship inference is recommended.`,
    ``,
    `## Links`,
    ...entries,
    ``,
    `## Related`,
    `- [[PROJECTS]]`,
  ].join('\n');
  const frontmatter = {
    title: 'Project Dependency Map',
    type: 'graph',
    updated: new Date().toISOString().split('T')[0],
    tags: ['graph', 'dependencies'],
  };
  writeVaultNote(mapPath, frontmatter, body);
}

function writeVaultNote(filePath, frontmatterObj, body) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const fmLines = Object.entries(frontmatterObj)
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join('\n');
    fs.writeFileSync(filePath, `---\n${fmLines}\n---\n\n${body}\n`, 'utf-8');
  } catch (err) {
    console.error('[Graph] update error:', err.message);
  }
}

function rebuildKnowledgeGraph() {
  try {
    const notes = walkNotes(VAULT_ROOT);
    updateBacklinksSection(notes);
    updateDependencyMap(notes);
    return { noteCount: notes.length, ok: true };
  } catch (err) {
    console.error('[Graph] rebuild error:', err.message);
    return { ok: false, error: err.message };
  }
}

function getRelatedNotes(queryRelPath) {
  try {
    const queryPath = path.join(VAULT_ROOT, queryRelPath.replace(/^\.\//, '') + '.md');
    if (!fs.existsSync(queryPath)) return [];
    const notes = walkNotes(VAULT_ROOT);
    return findRelatedNotes(notes, queryPath);
  } catch (err) {
    console.error('[Graph] getRelated error:', err.message);
    return [];
  }
}

module.exports = {
  rebuildKnowledgeGraph,
  getRelatedNotes,
  generateBacklinks,
  walkNotes,
  extractLinks,
};
