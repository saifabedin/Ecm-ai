const sm = require('../../db/shared-memory.cjs');

const AGENT_ID = 'agent-research';
const AGENT_NAME = 'Research Agent';

async function recordResearch({ title, content, confidence, tags, graphNodes, tenantId }) {
  return sm.writeMemory({
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    memoryType: 'research',
    title,
    content,
    confidence: confidence || 0.85,
    relatedGraphNodes: graphNodes || [],
    tags: tags || ['research'],
    tenantId,
  });
}

async function findResearch(query, opts = {}) {
  return sm.getRelevantMemory(query, { ...opts, memoryType: 'research' });
}

async function citeResearch(memoryId) {
  return sm.citeMemory(memoryId);
}

async function referenceOtherMemory(sourceId, refId, type, context) {
  return sm.referenceMemory(sourceId, refId, type, context);
}

module.exports = { recordResearch, findResearch, citeResearch, referenceOtherMemory, AGENT_ID, AGENT_NAME };
