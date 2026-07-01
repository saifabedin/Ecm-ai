const sm = require('../../db/shared-memory.cjs');

const AGENT_ID = 'agent-architecture';
const AGENT_NAME = 'Architecture Agent';

async function recordArchitecture({ title, content, confidence, tags, graphNodes, tenantId }) {
  return sm.writeMemory({
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    memoryType: 'architecture',
    title,
    content,
    confidence: confidence || 0.92,
    relatedGraphNodes: graphNodes || [],
    tags: tags || ['architecture'],
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
    confidence: confidence || 0.90,
    relatedGraphNodes: graphNodes || [],
    tags: tags || ['decision', 'architecture'],
    tenantId,
  });
}

async function findArchitecture(query, opts = {}) {
  return sm.getRelevantMemory(query, { ...opts, memoryType: 'architecture' });
}

async function findDecisions(query, opts = {}) {
  return sm.getRelevantMemory(query, { ...opts, memoryType: 'decisions' });
}

async function citeArchitecture(memoryId) {
  return sm.citeMemory(memoryId);
}

module.exports = { recordArchitecture, recordDecision, findArchitecture, findDecisions, citeArchitecture, AGENT_ID, AGENT_NAME };
