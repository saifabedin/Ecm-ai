const sm = require('../../db/shared-memory.cjs');

const AGENT_ID = 'agent-sales';
const AGENT_NAME = 'Sales Agent';

async function recordCustomerContext({ title, content, confidence, tags, graphNodes, tenantId }) {
  return sm.writeMemory({
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    memoryType: 'customer_context',
    title,
    content,
    confidence: confidence || 0.82,
    relatedGraphNodes: graphNodes || [],
    tags: tags || ['customer', 'sales'],
    tenantId,
  });
}

async function findCustomerContext(query, opts = {}) {
  return sm.getRelevantMemory(query, { ...opts, memoryType: 'customer_context' });
}

async function citeCustomerContext(memoryId) {
  return sm.citeMemory(memoryId);
}

module.exports = { recordCustomerContext, findCustomerContext, citeCustomerContext, AGENT_ID, AGENT_NAME };
