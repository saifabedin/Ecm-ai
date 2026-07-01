const sm = require('../../db/shared-memory.cjs');

const AGENT_ID = 'agent-automation';
const AGENT_NAME = 'Automation Agent';

async function recordAutomationKnowledge({ title, content, confidence, tags, graphNodes, tenantId }) {
  return sm.writeMemory({
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    memoryType: 'automation_knowledge',
    title,
    content,
    confidence: confidence || 0.87,
    relatedGraphNodes: graphNodes || [],
    tags: tags || ['automation'],
    tenantId,
  });
}

async function findAutomationKnowledge(query, opts = {}) {
  return sm.getRelevantMemory(query, { ...opts, memoryType: 'automation_knowledge' });
}

async function citeAutomationKnowledge(memoryId) {
  return sm.citeMemory(memoryId);
}

module.exports = { recordAutomationKnowledge, findAutomationKnowledge, citeAutomationKnowledge, AGENT_ID, AGENT_NAME };
