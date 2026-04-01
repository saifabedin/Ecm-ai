/**
 * Builder Agent
 *
 * Executes a single subtask by triggering the appropriate engine webhook
 * and persisting the resulting job_id to engine_jobs + agent_logs.
 *
 * Called by: orchestrator-brain callback, or directly by other agents.
 */

const { v4: uuidv4 } = require('uuid');
const { triggerWorkflow } = require('../utils/n8n');
const { query } = require('../config/db');
const logger = require('../utils/logger');

/**
 * Execute a single subtask against one engine.
 *
 * @param {object} opts
 * @param {string} opts.brand_id
 * @param {string} opts.engine_slug  - target engine
 * @param {object} opts.input        - engine-specific input payload
 * @param {string} opts.plan_id      - parent agent_run_id for traceability
 * @param {number} opts.step         - subtask step number
 * @returns {object} execution result with job_id
 */
async function executeSubtask({ brand_id, engine_slug, input = {}, plan_id, step }) {
  const execution_id = uuidv4();
  logger.info('Builder executing subtask', { brand_id, engine_slug, step, execution_id });

  let job_id = null;
  let status = 'failed';
  let error_msg = null;

  try {
    const result = await triggerWorkflow(engine_slug, brand_id, {
      ...input,
      plan_id,
      step,
      execution_id
    });
    job_id = result.job_id;
    status = 'queued';
  } catch (err) {
    error_msg = err.message;
    logger.error('Builder subtask failed', { brand_id, engine_slug, error: err.message });
  }

  // Persist to engine_jobs
  if (job_id) {
    await query(
      `INSERT INTO engine_jobs (job_id, brand_id, engine_slug, status, payload, created_at)
       VALUES ($1, $2, $3, 'queued', $4, NOW())
       ON CONFLICT (job_id) DO NOTHING`,
      [job_id, brand_id, engine_slug, JSON.stringify({ input, plan_id, step })]
    ).catch(err => logger.warn('Builder engine_jobs insert failed', { error: err.message }));
  }

  // Log execution to agent_logs
  await query(
    `INSERT INTO agent_logs (brand_id, agent_type, input, output, tokens_used, created_at)
     VALUES ($1, 'builder', $2, $3, 0, NOW())`,
    [
      brand_id,
      JSON.stringify({ engine_slug, input, plan_id, step }),
      JSON.stringify({ execution_id, job_id, status, error: error_msg })
    ]
  ).catch(err => logger.warn('Builder agent_logs insert failed', { error: err.message }));

  return { execution_id, engine_slug, job_id, status, step, error: error_msg };
}

/**
 * Execute multiple subtasks sequentially (respects depends_on ordering).
 *
 * @param {object} opts
 * @param {string} opts.brand_id
 * @param {Array}  opts.subtasks  - ordered array from planner.buildSubtasks()
 * @param {object} opts.input     - shared input passed to every engine
 * @param {string} opts.plan_id
 * @returns {Array} execution results per step
 */
async function executeSequence({ brand_id, subtasks, input = {}, plan_id }) {
  const results = [];
  for (const subtask of subtasks) {
    const result = await executeSubtask({
      brand_id,
      engine_slug: subtask.engine_slug,
      input: { ...input, goal_context: subtask.description },
      plan_id,
      step: subtask.step
    });
    results.push(result);
    // Stop sequence on hard failure (engine unreachable)
    if (result.status === 'failed') {
      logger.warn('Sequence halted at failed step', { step: subtask.step, engine_slug: subtask.engine_slug });
      break;
    }
  }
  return results;
}

module.exports = { executeSubtask, executeSequence };
