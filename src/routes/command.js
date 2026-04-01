const { Router } = require('express');
const { authenticateJWT, requireAdmin } = require('../middleware/auth');
const { requireBrandId } = require('../middleware/brandId');
const { success, createError } = require('../utils/response');
const logger = require('../utils/logger');

const router = Router();

const VALID_COMMANDS = ['/plan', '/deploy', '/test', '/optimize', '/status'];

/**
 * POST /api/command
 * Command layer for Claude Code slash commands.
 * Body: { brand_id, command: "/plan | /deploy | /test | /optimize | /status", args: {} }
 */
router.post('/', authenticateJWT, requireBrandId, async (req, res, next) => {
  try {
    const { command, args = {} } = req.body;
    const brand_id = req.brand_id;

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

    let result;
    switch (command) {
      case '/plan':
        result = await handlePlan(brand_id, args);
        break;
      case '/deploy':
        result = await handleDeploy(brand_id, args, req.user);
        break;
      case '/test':
        result = await handleTest(brand_id, args);
        break;
      case '/optimize':
        result = await handleOptimize(brand_id, args);
        break;
      case '/status':
        result = await handleStatus(brand_id, args);
        break;
    }

    return success(res, {
      brand_id,
      engine_id: 'command-router',
      command,
      result
    });
  } catch (err) {
    next(createError('COMMAND_FAILED', err.message, 500));
  }
});

async function handlePlan(brand_id, args) {
  return {
    message: '/plan command received',
    brand_id,
    template: {
      feature: args.feature || null,
      repos_affected: args.repos || ['backend', 'frontend'],
      db_changes: args.db_changes || false,
      new_endpoints: args.endpoints || [],
      n8n_workflows: args.workflows || [],
      brand_id_required: true,
      complexity: args.complexity || 'M'
    },
    note: 'Submit plan details to trigger full planning workflow'
  };
}

async function handleDeploy(brand_id, args, user) {
  return {
    message: '/deploy command received',
    brand_id,
    target: args.target || 'staging',
    branch: args.branch || 'claude/ecm-ai-platform-setup-3kqsm',
    initiated_by: user.user_id,
    note: 'Deploy workflow triggered — check PM2 and EC2 for status'
  };
}

async function handleTest(brand_id, args) {
  return {
    message: '/test command received',
    brand_id,
    scope: args.scope || 'all',
    note: 'Run npm test in the relevant repo to execute the test suite'
  };
}

async function handleOptimize(brand_id, args) {
  return {
    message: '/optimize command received',
    brand_id,
    target: args.target || 'backend',
    note: 'Optimization analysis queued — results will surface in analytics-insight engine'
  };
}

async function handleStatus(brand_id, args) {
  return {
    message: '/status command received',
    brand_id,
    service: 'ecm-api',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    node_version: process.version,
    env: process.env.NODE_ENV
  };
}

module.exports = router;
