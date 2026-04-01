/**
 * Planner Agent
 *
 * Receives a high-level goal, breaks it into ordered subtasks,
 * logs the plan to agent_logs, and triggers orchestrator-brain
 * to coordinate execution across engines.
 *
 * Called by: POST /api/command { command: '/plan', args: { goal } }
 */

const { v4: uuidv4 } = require('uuid');
const { triggerWorkflow } = require('../utils/n8n');
const { query } = require('../config/db');
const logger = require('../utils/logger');

// Maps a goal keyword to the engine sequence required to fulfil it.
// orchestrator-brain receives this and fans out to each engine in order.
const GOAL_ENGINE_MAP = {
  'ads':            ['brand-knowledge', 'strategy-planning', 'campaign-creator'],
  'content':        ['brand-knowledge', 'strategy-planning', 'content-generation'],
  'landing-page':   ['strategy-planning', 'content-generation', 'image-generation'],
  'lead-outreach':  ['brand-knowledge', 'market-intelligence', 'strategy-planning'],
  'full-campaign':  ['brand-knowledge', 'market-intelligence', 'strategy-planning',
                     'content-generation', 'image-generation', 'campaign-creator', 'daily-performance'],
  'optimize':       ['perf-tracking', 'optimization-spider'],
  'publish':        ['publishing-spider'],
  'default':        ['brand-knowledge', 'strategy-planning', 'orchestrator-brain']
};

/**
 * Resolve which engine sequence to use for a given goal string.
 * Matches by lowercase keyword presence in the goal text.
 */
function resolveEngineSequence(goal) {
  const lower = goal.toLowerCase();
  for (const [keyword, engines] of Object.entries(GOAL_ENGINE_MAP)) {
    if (keyword !== 'default' && lower.includes(keyword)) {
      return { matched_keyword: keyword, engines };
    }
  }
  return { matched_keyword: 'default', engines: GOAL_ENGINE_MAP.default };
}

/**
 * Break a goal into subtasks.
 * Each subtask maps to one engine invocation.
 */
function buildSubtasks(goal, engines) {
  return engines.map((engine_slug, idx) => ({
    step:       idx + 1,
    engine_slug,
    description: `Run ${engine_slug} for goal: "${goal}"`,
    status:     'pending',
    depends_on: idx > 0 ? engines[idx - 1] : null
  }));
}

/**
 * Run the Planner Agent.
 *
 * @param {object} opts
 * @param {string} opts.brand_id
 * @param {string} opts.goal       - natural language goal
 * @param {object} opts.context    - additional context
 * @param {string} opts.user_id
 * @returns {object} plan
 */
async function run({ brand_id, goal, context = {}, user_id }) {
  const agent_run_id = uuidv4();
  const started_at = new Date().toISOString();

  logger.info('Planner agent started', { brand_id, goal, agent_run_id });

  const { matched_keyword, engines } = resolveEngineSequence(goal);
  const subtasks = buildSubtasks(goal, engines);

  const plan = {
    agent_run_id,
    brand_id,
    goal,
    matched_keyword,
    total_steps:  subtasks.length,
    subtasks,
    context,
    initiated_by: user_id,
    started_at
  };

  // Log plan to agent_logs (non-fatal if DB not ready)
  await query(
    `INSERT INTO agent_logs (brand_id, agent_type, input, output, tokens_used, created_at)
     VALUES ($1, 'planner', $2, $3, 0, NOW())`,
    [brand_id, JSON.stringify({ goal, context }), JSON.stringify(plan)]
  ).catch(err => logger.warn('Planner agent_logs insert failed', { error: err.message }));

  // Trigger orchestrator-brain with the full plan
  try {
    const { job_id } = await triggerWorkflow('orchestrator-brain', brand_id, {
      plan,
      mode: 'execute_plan'
    });
    plan.orchestrator_job_id = job_id;
    plan.status = 'dispatched';
  } catch (err) {
    logger.warn('Orchestrator trigger failed — plan logged only', { error: err.message });
    plan.orchestrator_job_id = null;
    plan.status = 'logged_only';
    plan.orchestrator_error = err.message;
  }

  logger.info('Planner agent complete', { brand_id, agent_run_id, status: plan.status });
  return plan;
}

module.exports = { run, resolveEngineSequence, buildSubtasks, GOAL_ENGINE_MAP };
