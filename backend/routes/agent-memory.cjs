const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.cjs');
const sm = require('../db/shared-memory.cjs');
const agents = require('../agents/memory-agents/index.cjs');

// ─── WRITE MEMORY ──────────────────────────────────────────────
router.post('/shared-memory', verifyToken, async (req, res) => {
  try {
    const { agentId, memoryType, title, content, confidence, tags, graphNodes, tenantId } = req.body;
    if (!agentId || !memoryType || !title || !content) {
      return res.status(400).json({ success: false, error: 'agentId, memoryType, title, content required' });
    }
    const agentNames = {
      'agent-research': 'Research Agent',
      'agent-developer': 'Developer Agent',
      'agent-sales': 'Sales Agent',
      'agent-automation': 'Automation Agent',
      'agent-architecture': 'Architecture Agent',
    };
    const result = await sm.writeMemory({
      agentId,
      agentName: agentNames[agentId] || agentId,
      memoryType,
      title,
      content,
      confidence,
      relatedGraphNodes: graphNodes || [],
      tags: tags || [],
      tenantId: tenantId || 'global',
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── READ MEMORY ───────────────────────────────────────────────
router.get('/shared-memory', verifyToken, async (req, res) => {
  try {
    const { agentId, memoryType, tenantId, limit, offset } = req.query;
    const result = await sm.listMemory({
      agentId,
      memoryType,
      tenantId: tenantId || 'global',
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/shared-memory/:id', verifyToken, async (req, res) => {
  try {
    const mem = await sm.readMemory(req.params.id);
    if (!mem) return res.status(404).json({ success: false, error: 'Not found' });
    const refs = await sm.getReferences(req.params.id);
    res.json({ success: true, memory: mem, references: refs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── SEARCH MEMORY ─────────────────────────────────────────────
router.post('/shared-memory/search', verifyToken, async (req, res) => {
  try {
    const { query, tenantId, memoryType, agentId, limit } = req.body;
    if (!query) return res.status(400).json({ success: false, error: 'query required' });
    const results = await sm.searchMemory(query, {
      tenantId: tenantId || 'global',
      memoryType,
      agentId,
      limit: limit || 10,
    });
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── RELEVANT MEMORY (scored) ─────────────────────────────────
router.post('/shared-memory/relevant', verifyToken, async (req, res) => {
  try {
    const { query, tenantId, memoryType, limit } = req.body;
    if (!query) return res.status(400).json({ success: false, error: 'query required' });
    const results = await sm.getRelevantMemory(query, {
      tenantId: tenantId || 'global',
      memoryType,
      limit: limit || 5,
    });
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── REFERENCE MEMORY ──────────────────────────────────────────
router.post('/shared-memory/reference', verifyToken, async (req, res) => {
  try {
    const { sourceId, referencedId, referenceType, context } = req.body;
    if (!sourceId || !referencedId || !referenceType) {
      return res.status(400).json({ success: false, error: 'sourceId, referencedId, referenceType required' });
    }
    const refId = await sm.referenceMemory(sourceId, referencedId, referenceType, context);
    res.json({ success: true, id: refId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── CITATION ──────────────────────────────────────────────────
router.get('/shared-memory/:id/cite', verifyToken, async (req, res) => {
  try {
    const citation = await sm.citeMemory(req.params.id);
    if (!citation) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, ...citation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── CONFLICTS ─────────────────────────────────────────────────
router.get('/shared-memory-conflicts', verifyToken, async (req, res) => {
  try {
    const { severity, unresolved } = req.query;
    const result = await sm.listConflicts({
      severity,
      unresolved: unresolved !== 'false',
    });
    res.json({ success: true, conflicts: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/shared-memory-conflicts/:id/resolve', verifyToken, async (req, res) => {
  try {
    const { resolution, resolvedBy } = req.body;
    await sm.resolveConflict(req.params.id, resolution, resolvedBy || 'user');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── STATS ─────────────────────────────────────────────────────
router.get('/shared-memory-stats', verifyToken, async (req, res) => {
  try {
    const stats = await sm.getStats(req.query.tenantId || 'global');
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── AGENT-SPECIFIC SHORTCUTS ──────────────────────────────────
router.post('/agent-memory/research', verifyToken, async (req, res) => {
  try {
    const result = await agents.research.recordResearch(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/agent-memory/deployment', verifyToken, async (req, res) => {
  try {
    const result = await agents.developer.recordDeployment(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/agent-memory/customer-context', verifyToken, async (req, res) => {
  try {
    const result = await agents.sales.recordCustomerContext(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/agent-memory/automation', verifyToken, async (req, res) => {
  try {
    const result = await agents.automation.recordAutomationKnowledge(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/agent-memory/architecture', verifyToken, async (req, res) => {
  try {
    const result = await agents.architecture.recordArchitecture(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
