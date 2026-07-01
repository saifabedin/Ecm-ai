const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.cjs');
const galaxy = require('../db/galaxy.cjs');
const collab = require('../db/collaboration.cjs');
const sm = require('../db/shared-memory.cjs');
const lessons = require('../db/lessons.cjs');
const health = require('../db/system-health.cjs');

const agentInfo = {
  'agent-research': { id: 'agent-research', name: 'Research Agent', icon: '🔬', color: 'blue', capabilities: ['Market research', 'Strategy analysis', 'Trend detection'] },
  'agent-developer': { id: 'agent-developer', name: 'Developer Agent', icon: '💻', color: 'green', capabilities: ['Implementation', 'Deployment', 'Architecture decisions'] },
  'agent-sales': { id: 'agent-sales', name: 'Sales Agent', icon: '💼', color: 'purple', capabilities: ['Customer context', 'Business impact', 'Revenue analysis'] },
  'agent-automation': { id: 'agent-automation', name: 'Automation Agent', icon: '⚡', color: 'yellow', capabilities: ['Workflow automation', 'Efficiency optimization', 'Process improvement'] },
  'agent-architecture': { id: 'agent-architecture', name: 'Architecture Agent', icon: '🏗️', color: 'red', capabilities: ['System design', 'Architecture decisions', 'Technical strategy'] },
};

function getAgentInfo(id) { return agentInfo[id] || { id, name: id, icon: '🤖', color: 'gray', capabilities: [] }; }

// ─── AGENT CONTEXT ───────────────────────────────────────────
router.get('/agents/context/:agentId', verifyToken, async (req, res) => {
  try {
    const { agentId } = req.params;
    const info = getAgentInfo(agentId);

    // Memories
    const memRes = await sm.listMemory({ agentId, limit: 20 });
    // References
    const references = [];
    for (const m of memRes.memories) {
      const refs = await sm.getReferences(m.id);
      if (refs.outgoing.length > 0 || refs.incoming.length > 0) references.push({ memory: m, refs });
    }

    res.json({ success: true, agent: info, memories: memRes.memories, references, totalMemories: memRes.total });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── AGENT ACTIONS ───────────────────────────────────────────
router.post('/agents/action', verifyToken, async (req, res) => {
  try {
    const { agentId, action, content, memoryType, context } = req.body;
    if (!agentId || !action) return res.status(400).json({ success: false, error: 'agentId and action required' });

    const info = getAgentInfo(agentId);
    let result;

    switch (action) {
      case 'write':
        result = await sm.writeMemory({
          agentId, agentName: info.name,
          memoryType: memoryType || 'research',
          title: content.title || 'Agent write',
          content: content.data || {},
          confidence: content.confidence || 0.85,
          relatedGraphNodes: context?.graphNodes || [],
          tags: content.tags || [],
        });
        break;
      case 'search':
        result = await sm.searchMemory(content.query, { agentId, limit: 10 });
        break;
      case 'collaborate':
        result = await collab.executeChain({
          triggerAgentId: agentId,
          triggerMemoryId: context?.memoryId,
          chainName: context?.chainName || `Auto-chain from ${info.name}`,
        });
        break;
      case 'cite':
        result = await sm.citeMemory(content.memoryId);
        break;
      default:
        return res.status(400).json({ success: false, error: 'Unknown action' });
    }

    res.json({ success: true, result });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── AGENT ACTIVITY FEED ─────────────────────────────────────
router.get('/agents/activity', verifyToken, async (req, res) => {
  try {
    const { limit } = req.query;
    const memories = await sm.listMemory({ limit: parseInt(limit) || 20 });
    const recentChains = await collab.listChains({ limit: 10 });
    const recentLessons = await lessons.listLessons({ limit: 10 });

    const activities = [
      ...memories.memories.map(m => ({ type: 'memory', agent: m.agent_name, title: m.title, timestamp: m.created_at, info: m })),
      ...recentChains.map(c => ({ type: 'collaboration', agent: c.trigger_agent_id, title: c.chain_name, timestamp: c.created_at, info: c })),
      ...recentLessons.lessons.map(l => ({ type: 'lesson', agent: 'Lesson Agent', title: l.title, timestamp: l.created_at, info: l })),
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 30);

    res.json({ success: true, activities });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
