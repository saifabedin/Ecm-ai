const { Router } = require('express');
const { authenticateJWT } = require('../middleware/auth');
const { requireBrandId } = require('../middleware/brandId');
const { success, createError } = require('../utils/response');
const { triggerWorkflow, pingAllEngines } = require('../utils/n8n');
const { query } = require('../config/db');
const planner = require('../agents/planner');
const logger = require('../utils/logger');

const router = Router();

const VALID_COMMANDS = ['/plan', '/deploy', '/test', '/optimize', '/status'];

/**
 * POST /api/command
 * Unified command layer — maps slash commands to agent/engine actions.
 *
 * Body:
 *   brand_id  : UUID v4 (required)
 *   command   : '/plan' | '/deploy' | '/test' | '/optimize' | '/status'
 *   args      : command-specific payload (see each handler below)
 */
router.post('/', authenticateJWT, requireBrandId, async (req, res, next) => {
  const { command, args = {} } = req.body;
  const brand_id = req.brand_id;
  const cmd_start = Date.now();

  if (!command) {
    return next(createError('COMMAND_REQUIRED', 'command is required', 400));
  }
  if (!VALID_COMMANDS.includes(command)) {
    return next(createError(
      'UNKNOWN_COMMAND',
      `Unknown command "${command}". Valid: ${VALID_COMMANDS.join(', ')}`,
      400
    ));
  }

  logger.info('Command received', { command, brand_id, user_id: req.user.user_id });

  try {
    let result;
    switch (command) {
      case '/plan':     result = await handlePlan(brand_id, args, req.user);     break;
      case '/deploy':   result = await handleDeploy(brand_id, args, req.user);   break;
      case '/test':     result = await handleTest(brand_id, args);               break;
      case '/optimize': result = await handleOptimize(brand_id, args);           break;
      case '/status':   result = await handleStatus(brand_id);                   break;
    }

    // Persist command to audit log
    await query(
      `INSERT INTO commands (brand_id, command, args, status, result, created_at)
       VALUES ($1, $2, $3, 'completed', $4, NOW())`,
      [brand_id, command, JSON.stringify(args), JSON.stringify(result)]
    ).catch(err => logger.warn('Command audit log failed', { error: err.message }));

    return success(res, {
      brand_id,
      engine_id: 'command-router',
      command,
      duration_ms: Date.now() - cmd_start,
      result
    });
  } catch (err) {
    // Persist failed command
    await query(
      `INSERT INTO commands (brand_id, command, args, status, result, created_at)
       VALUES ($1, $2, $3, 'failed', $4, NOW())`,
      [brand_id, command, JSON.stringify(args), JSON.stringify({ error: err.message })]
    ).catch(() => {});

    next(createError('COMMAND_FAILED', err.message, 500));
  }
});

// ─── /plan ────────────────────────────────────────────────────────────────────
// Delegates to Planner Agent which breaks the goal into subtasks and
// triggers the orchestrator-brain engine via n8n.
//
// args: { goal: string, context?: object }
async function handlePlan(brand_id, args, user) {
  if (!args.goal) throw new Error('/plan requires args.goal');

  // Run planner agent — logs to agent_logs, triggers orchestrator webhook
  const plan = await planner.run({
    brand_id,
    goal: args.goal,
    context: args.context || {},
    user_id: user.user_id
  });

  return {
    command:  '/plan',
    brand_id,
    goal:     args.goal,
    plan
  };
}

// ─── /deploy ─────────────────────────────────────────────────────────────────
// Triggers a specific engine webhook directly (deploy = run engine in prod).
//
// args: { engine_id: string, input?: object }
async function handleDeploy(brand_id, args, user) {
  if (!args.engine_id) throw new Error('/deploy requires args.engine_id');

  const { job_id, webhook_url } = await triggerWorkflow(
    args.engine_id,
    brand_id,
    { input: args.input || {}, triggered_by: user.user_id, mode: 'deploy' }
  );

  return {
    command:     '/deploy',
    brand_id,
    engine_id:   args.engine_id,
    job_id,
    webhook_url,
    status:      'queued',
    note:        `Engine "${args.engine_id}" triggered. Poll /api/engines/${args.engine_id}/status/${job_id} for result.`
  };
}

// ─── /test ────────────────────────────────────────────────────────────────────
// Runs a test ping on a specific engine (or all engines if no engine_id given).
// Validates that: HTTP 2xx received AND response contains brand_id.
//
// args: { engine_id?: string }
async function handleTest(brand_id, args) {
  const { pingEngine, pingAllEngines } = require('../utils/n8n');

  if (args.engine_id) {
    const result = await pingEngine(args.engine_id);
    return {
      command:   '/test',
      brand_id,
      engine_id: args.engine_id,
      ping:      result,
      passed:    result.status === 'ok'
    };
  }

  // No engine_id → test all 15
  const { engines, summary } = await pingAllEngines();
  return {
    command:  '/test',
    brand_id,
    summary,
    engines,
    passed:   summary.error === 0
  };
}

// ─── /optimize ────────────────────────────────────────────────────────────────
// Calls optimization-spider (engine-10) with the last 24hr agent_logs context.
//
// args: {} (optional context)
async function handleOptimize(brand_id, args) {
  // Fetch last 24hr agent_logs for this brand to give optimizer context
  const logsResult = await query(
    `SELECT agent_type, input, output, tokens_used, created_at
     FROM agent_logs
     WHERE brand_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'
     ORDER BY created_at DESC
     LIMIT 50`,
    [brand_id]
  );

  const { job_id } = await triggerWorkflow('optimization-spider', brand_id, {
    agent_logs:    logsResult.rows,
    context:       args.context || {},
    analysis_mode: 'auto',
    triggered_by:  '/optimize command'
  });

  return {
    command:           '/optimize',
    brand_id,
    engine_id:         'optimization-spider',
    job_id,
    logs_analyzed:     logsResult.rows.length,
    status:            'queued',
    note:              'Optimization analysis running. Results will be written to engine_jobs.'
  };
}

// ─── /status ─────────────────────────────────────────────────────────────────
// Health check: pings all 15 engines concurrently, returns per-engine status.
// Also returns process stats and recent job counts from the DB.
async function handleStatus(brand_id) {
  // Run engine pings + DB stats concurrently
  const [pingData, jobStats] = await Promise.all([
    pingAllEngines(),
    query(
      `SELECT status, COUNT(*) AS count
       FROM engine_jobs
       WHERE brand_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'
       GROUP BY status`,
      [brand_id]
    ).catch(() => ({ rows: [] }))
  ]);

  const jobSummary = {};
  for (const row of jobStats.rows) {
    jobSummary[row.status] = parseInt(row.count, 10);
  }

  return {
    command:  '/status',
    brand_id,
    service:  'ecm-api',
    process: {
      uptime_s:     Math.round(process.uptime()),
      memory_mb:    Math.round(process.memoryUsage().rss / 1024 / 1024),
      node_version: process.version,
      env:          process.env.NODE_ENV
    },
    engines: pingData,
    jobs_last_24h: jobSummary
  };
}

module.exports = router;
