const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.cjs');
const galaxy = require('../db/galaxy.cjs');
const collab = require('../db/collaboration.cjs');
const lessons = require('../db/lessons.cjs');
const health = require('../db/system-health.cjs');
const sm = require('../db/shared-memory.cjs');
const agents = require('../agents/memory-agents/index.cjs');

// ─── KNOWLEDGE GALAXY ────────────────────────────────────────
router.get('/galaxy/nodes', verifyToken, async (req, res) => {
  try {
    const { nodeType } = req.query;
    const nodes = await galaxy.listNodes({ nodeType });
    res.json({ success: true, nodes });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/galaxy/nodes/:id', verifyToken, async (req, res) => {
  try {
    const node = await galaxy.getNode(req.params.id);
    if (!node) return res.status(404).json({ success: false, error: 'Not found' });
    const edges = await galaxy.getEdges(req.params.id);
    res.json({ success: true, node, edges });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/galaxy/nodes', verifyToken, async (req, res) => {
  try {
    const { nodeType, label, refId, description, metadata, activityScore } = req.body;
    if (!nodeType || !label) return res.status(400).json({ success: false, error: 'nodeType and label required' });
    const id = await galaxy.createNode({ nodeType, refId, label, description, metadata, activityScore });
    res.json({ success: true, id });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/galaxy/search', verifyToken, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ success: false, error: 'query required' });
    const nodes = await galaxy.searchNodes(query, 30);
    res.json({ success: true, nodes });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/galaxy/path', verifyToken, async (req, res) => {
  try {
    const { source, target } = req.query;
    if (!source || !target) return res.status(400).json({ success: false, error: 'source and target required' });
    const paths = await galaxy.tracePath(source, target);
    res.json({ success: true, paths });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/galaxy/build', verifyToken, async (req, res) => {
  try {
    const result = await galaxy.buildGalaxyFromVault();
    res.json({ success: true, ...result });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/galaxy/stats', verifyToken, async (req, res) => {
  try {
    const stats = await galaxy.getGalaxyStats();
    res.json({ success: true, stats });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/galaxy/edges/:id', verifyToken, async (req, res) => {
  try {
    const edges = await galaxy.getEdges(req.params.id);
    res.json({ success: true, ...edges });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── AGENT COLLABORATION ─────────────────────────────────────
router.post('/collaboration/chain', verifyToken, async (req, res) => {
  try {
    const { triggerMemoryId, triggerAgentId, chainName } = req.body;
    if (!triggerAgentId) return res.status(400).json({ success: false, error: 'triggerAgentId required' });
    const chainId = await collab.executeChain({ triggerMemoryId, triggerAgentId, chainName });
    res.json({ success: true, chainId });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/collaboration/chains', verifyToken, async (req, res) => {
  try {
    const { status } = req.query;
    const chains = await collab.listChains({ status });
    res.json({ success: true, chains });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/collaboration/chains/:id', verifyToken, async (req, res) => {
  try {
    const chain = await collab.getChain(req.params.id);
    if (!chain) return res.status(404).json({ success: false, error: 'Chain not found' });
    const steps = await collab.getChainSteps(req.params.id);
    res.json({ success: true, chain, steps });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/collaboration/stats', verifyToken, async (req, res) => {
  try {
    const stats = await collab.getCollaborationStats();
    res.json({ success: true, stats });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/collaboration/agents', verifyToken, async (req, res) => {
  try {
    const memStats = await sm.getStats();
    const chainStats = await collab.getCollaborationStats();
    const agentMap = {
      'agent-research': { name: 'Research Agent', icon: '🔬', color: 'blue', capabilities: ['Market research', 'Strategy', 'Analysis'] },
      'agent-developer': { name: 'Developer Agent', icon: '💻', color: 'green', capabilities: ['Implementation', 'Deployment', 'Decisions'] },
      'agent-sales': { name: 'Sales Agent', icon: '💼', color: 'purple', capabilities: ['Customer context', 'Business impact', 'ROI'] },
      'agent-automation': { name: 'Automation Agent', icon: '⚡', color: 'yellow', capabilities: ['Automation', 'Workflow', 'Efficiency'] },
      'agent-architecture': { name: 'Architecture Agent', icon: '🏗️', color: 'red', capabilities: ['Architecture', 'Decisions', 'System design'] },
    };
    const enriched = Object.entries(agentMap).map(([id, info]) => {
      const memCount = memStats.byAgent?.find(a => a.agent_id === id)?.count || 0;
      const chainCount = chainStats.agentParticipation?.find(a => a.agent_id === id)?.steps || 0;
      return { ...info, id, memoryCount: memCount, collaborationSteps: chainCount };
    });
    res.json({ success: true, agents: enriched });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── LESSONS LEARNED ─────────────────────────────────────────
router.post('/lessons', verifyToken, async (req, res) => {
  try {
    const { sourceType, sourceRefId, lessonType, title, description, evidence, confidence, tags } = req.body;
    if (!sourceType || !lessonType || !title) return res.status(400).json({ success: false, error: 'sourceType, lessonType, title required' });
    const id = await lessons.extractLesson({ sourceType, sourceRefId, lessonType, title, description, evidence, confidence, tags });
    res.json({ success: true, id });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/lessons', verifyToken, async (req, res) => {
  try {
    const { lessonType, sourceType, limit, offset } = req.query;
    const result = await lessons.listLessons({ lessonType, sourceType, limit: parseInt(limit) || 50, offset: parseInt(offset) || 0 });
    res.json({ success: true, ...result });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/lessons/detect', verifyToken, async (req, res) => {
  try {
    const patterns = await lessons.detectPatterns();
    res.json({ success: true, ...patterns });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/lessons/recommend', verifyToken, async (req, res) => {
  try {
    const recs = await lessons.generateRecommendations();
    res.json({ success: true, recommendations: recs });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/lessons/learn', verifyToken, async (req, res) => {
  try {
    const { sourceType, sourceRefId, outcome, details } = req.body;
    const result = await lessons.runLessonAgent({ sourceType, sourceRefId, outcome, details });
    res.json({ success: true, ...result });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/lessons/stats', verifyToken, async (req, res) => {
  try {
    const stats = await lessons.getLessonsStats();
    res.json({ success: true, stats });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/lessons/:id/score', verifyToken, async (req, res) => {
  try {
    const { usefulnessDelta } = req.body;
    await lessons.scoreLesson(req.params.id, usefulnessDelta || 0.05);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── SYSTEM HEALTH ───────────────────────────────────────────
router.get('/system-health', verifyToken, async (req, res) => {
  try {
    const snapshot = await health.calculateSystemHealth();
    res.json({ success: true, ...snapshot });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/system-health/latest', verifyToken, async (req, res) => {
  try {
    const latest = await health.getLatestHealth();
    res.json({ success: true, health: latest });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/system-health/history', verifyToken, async (req, res) => {
  try {
    const { limit } = req.query;
    const history = await health.getHealthHistory(parseInt(limit) || 30);
    res.json({ success: true, history });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── EXECUTIVE DASHBOARD AGGREGATE ───────────────────────────
router.get('/executive/overview', verifyToken, async (req, res) => {
  try {
    const galaxyStats = await galaxy.getGalaxyStats();
    const memStats = await sm.getStats();
    const chainStats = await collab.getCollaborationStats();
    const lessonStats = await lessons.getLessonsStats();
    const healthSnapshot = await health.calculateSystemHealth();

    res.json({
      success: true,
      overview: {
        activeAgents: 5,
        memoryGrowth: memStats.totalMemories,
        knowledgeGrowth: galaxyStats.totalNodes,
        architectureChanges: memStats.byType?.find(t => t.memory_type === 'decisions')?.count || 0,
        deploymentActivity: memStats.byType?.find(t => t.memory_type === 'deployments')?.count || 0,
        automationActivity: memStats.byType?.find(t => t.memory_type === 'automation_knowledge')?.count || 0,
        topReferencedMemories: memStats.recentReferences || 0,
        mostConnectedNodes: galaxyStats.topNodes?.slice(0, 5) || [],
        emergingClusters: lessonStats.recentLessons || 0,
      },
      health: healthSnapshot,
      galaxy: galaxyStats,
      memory: memStats,
      collaboration: chainStats,
      lessons: lessonStats,
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
