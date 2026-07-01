const sm = require('../../db/shared-memory.cjs');

const AGENT_ID = 'agent-developer';
const AGENT_NAME = 'Developer Agent';

async function recordDeployment({ title, content, confidence, tags, graphNodes, tenantId }) {
  return sm.writeMemory({
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    memoryType: 'deployments',
    title,
    content,
    confidence: confidence || 0.90,
    relatedGraphNodes: graphNodes || [],
    tags: tags || ['deployment', 'developer'],
    tenantId,
  });
}

async function recordDecision({ title, content, confidence, tags, graphNodes, tenantId }) {
  return sm.writeMemory({
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    memoryType: 'decisions',
    title,
    content,
    confidence: confidence || 0.88,
    relatedGraphNodes: graphNodes || [],
    tags: tags || ['decision', 'developer'],
    tenantId,
  });
}

async function findDeployments(query, opts = {}) {
  return sm.getRelevantMemory(query, { ...opts, memoryType: 'deployments' });
}

async function findDecisions(query, opts = {}) {
  return sm.getRelevantMemory(query, { ...opts, memoryType: 'decisions' });
}

async function citeDecision(memoryId) {
  return sm.citeMemory(memoryId);
}

module.exports = { recordDeployment, recordDecision, findDeployments, findDecisions, citeDecision, AGENT_ID, AGENT_NAME };
