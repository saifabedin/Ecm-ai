const pool = require('./client.cjs');
const { uuidv4 } = require('../utils/uuid.cjs');

// ─── CREATE COLLABORATION CHAIN ───────────────────────────────
async function createChain({ chainName, triggerMemoryId, triggerAgentId, steps }) {
  if (!pool) throw new Error('DB disabled');
  const id = uuidv4();
  await pool.query(
    `INSERT INTO collaboration_chains (id, chain_name, trigger_memory_id, trigger_agent_id, steps)
     VALUES ($1,$2,$3,$4,$5)`,
    [id, chainName, triggerMemoryId || null, triggerAgentId, JSON.stringify(steps || [])]
  );
  return id;
}

async function getChain(id) {
  if (!pool) throw new Error('DB disabled');
  const res = await pool.query(`SELECT * FROM collaboration_chains WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

async function listChains({ status, limit = 50 } = {}) {
  if (!pool) throw new Error('DB disabled');
  let q = `SELECT * FROM collaboration_chains`;
  const params = [];
  if (status) { q += ` WHERE status = $1`; params.push(status); }
  q += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);
  const res = await pool.query(q, params);
  return res.rows;
}

async function updateChainStatus(id, status, resultSummary) {
  if (!pool) throw new Error('DB disabled');
  if (status === 'completed') {
    await pool.query(`UPDATE collaboration_chains SET status = $1, result_summary = $2, completed_at = NOW() WHERE id = $3`, [status, resultSummary || null, id]);
  } else {
    await pool.query(`UPDATE collaboration_chains SET status = $1, result_summary = $2 WHERE id = $3`, [status, resultSummary || null, id]);
  }
}

// ─── STEP LOGS ────────────────────────────────────────────────
async function logStep({ chainId, stepIndex, agentId, action, inputData, status }) {
  if (!pool) throw new Error('DB disabled');
  const id = uuidv4();
  await pool.query(
    `INSERT INTO collaboration_step_logs (id, chain_id, step_index, agent_id, action, input_data, status, started_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
    [id, chainId, stepIndex, agentId, action, JSON.stringify(inputData || {}), status || 'running']
  );
  return id;
}

async function completeStep(id, outputData, status = 'completed') {
  if (!pool) throw new Error('DB disabled');
  await pool.query(
    `UPDATE collaboration_step_logs SET output_data = $1, status = $2, completed_at = NOW() WHERE id = $3`,
    [JSON.stringify(outputData || {}), status, id]
  );
}

async function getChainSteps(chainId) {
  if (!pool) throw new Error('DB disabled');
  const res = await pool.query(
    `SELECT * FROM collaboration_step_logs WHERE chain_id = $1 ORDER BY step_index`, [chainId]
  );
  return res.rows;
}

// ─── EXECUTE COLLABORATION CHAIN ──────────────────────────────
async function executeChain({ triggerMemoryId, triggerAgentId, chainName }) {
  const sm = require('./shared-memory.cjs');

  // Define collaboration pipeline
  const pipeline = [
    { agent: 'agent-research', action: 'analyze_memory', label: 'Research Agent analyzes' },
    { agent: 'agent-developer', action: 'evaluate_impact', label: 'Developer Agent evaluates' },
    { agent: 'agent-architecture', action: 'assess_architecture', label: 'Architecture Agent assesses' },
    { agent: 'agent-automation', action: 'implement_automation', label: 'Automation Agent implements' },
    { agent: 'agent-sales', action: 'summarize_business_impact', label: 'Sales Agent summarizes' },
  ];

  const chainId = await createChain({
    chainName: chainName || `Chain from ${triggerAgentId}`,
    triggerMemoryId,
    triggerAgentId,
    steps: pipeline.map(p => ({ agent: p.agent, action: p.action, status: 'pending' })),
  });

  // Execute each step
  let context = { triggerMemoryId, triggerAgentId };
  for (let i = 0; i < pipeline.length; i++) {
    const step = pipeline[i];
    const stepLog = await logStep({ chainId, stepIndex: i, agentId: step.agent, action: step.action, inputData: context, status: 'running' });

    try {
      // Simulate agent work - in real system this would call the agent
      const output = {
        agent: step.agent,
        action: step.action,
        result: `${step.label} the memory and produced insights`,
        timestamp: new Date().toISOString(),
      };

      // Write memory from this agent
      const memResult = await sm.writeMemory({
        agentId: step.agent,
        agentName: step.agent.replace('agent-', '').replace(/\b\w/g, l => l.toUpperCase()) + ' Agent',
        memoryType: 'research',
        title: `Collaboration: ${step.label}`,
        content: output,
        confidence: 0.85,
        relatedGraphNodes: [],
        tags: ['collaboration', step.agent],
      });

      await completeStep(stepLog, { ...output, memoryId: memResult.id }, 'completed');
      context = { ...context, [`${step.agent}_output`]: output };
    } catch (e) {
      await completeStep(stepLog, { error: e.message }, 'failed');
    }
  }

  await updateChainStatus(chainId, 'completed', 'Collaboration chain completed successfully');
  return chainId;
}

// ─── COLLABORATION STATS ──────────────────────────────────────
async function getCollaborationStats() {
  if (!pool) throw new Error('DB disabled');
  const totalChains = await pool.query(`SELECT COUNT(*) FROM collaboration_chains`);
  const completedChains = await pool.query(`SELECT COUNT(*) FROM collaboration_chains WHERE status = 'completed'`);
  const activeChains = await pool.query(`SELECT COUNT(*) FROM collaboration_chains WHERE status = 'active'`);
  const totalSteps = await pool.query(`SELECT COUNT(*) FROM collaboration_step_logs`);
  const agentParticipation = await pool.query(
    `SELECT agent_id, COUNT(*) as steps FROM collaboration_step_logs GROUP BY agent_id ORDER BY steps DESC`
  );
  return {
    totalChains: parseInt(totalChains.rows[0].count),
    completedChains: parseInt(completedChains.rows[0].count),
    activeChains: parseInt(activeChains.rows[0].count),
    totalSteps: parseInt(totalSteps.rows[0].count),
    agentParticipation: agentParticipation.rows,
  };
}

module.exports = {
  createChain, getChain, listChains, updateChainStatus,
  logStep, completeStep, getChainSteps,
  executeChain, getCollaborationStats,
};
