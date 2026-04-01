const { Router } = require('express');
const { authenticateJWT } = require('../middleware/auth');
const { requireBrandId, verifyBrandOwnership } = require('../middleware/brandId');
const { engineRateLimiter } = require('../middleware/rateLimiter');
const { triggerWorkflow } = require('./n8n');
const { success, createError } = require('./response');
const { query } = require('../config/db');

/**
 * Factory: returns an Express router for a given engine config.
 * All engine routes share the same middleware stack and response shape.
 *
 * @param {object} config
 * @param {string} config.slug       - engine slug (e.g. 'brand-knowledge')
 * @param {string} config.name       - display name (e.g. 'EC Engine 1: Brand Knowledge')
 * @param {string} config.description
 */
function createEngineRouter(config) {
  const router = Router();
  const stack = [authenticateJWT, requireBrandId, verifyBrandOwnership, engineRateLimiter];

  // POST /api/engines/:slug/run
  router.post('/run', ...stack, async (req, res, next) => {
    try {
      const { input = {}, options = {} } = req.body;
      const brand_id = req.brand_id;

      const { job_id } = await triggerWorkflow(config.slug, brand_id, { input, options });

      // Persist job to DB for status tracking
      await query(
        `INSERT INTO engine_jobs (job_id, brand_id, engine_slug, status, created_at)
         VALUES ($1, $2, $3, 'queued', NOW())
         ON CONFLICT (job_id) DO NOTHING`,
        [job_id, brand_id, config.slug]
      ).catch(() => {}); // Non-fatal — DB may not be migrated yet

      return success(res, {
        brand_id,
        engine_id: config.slug,
        engine_name: config.name,
        job_id,
        status: 'queued',
        estimated_seconds: 30
      }, 202);
    } catch (err) {
      next(createError('ENGINE_RUN_FAILED', err.message, 502));
    }
  });

  // GET /api/engines/:slug/status/:job_id
  router.get('/status/:job_id', ...stack, async (req, res, next) => {
    try {
      const { job_id } = req.params;
      const brand_id = req.brand_id;

      const result = await query(
        `SELECT job_id, brand_id, engine_slug, status, result, error, created_at, updated_at
         FROM engine_jobs WHERE job_id = $1 AND brand_id = $2`,
        [job_id, brand_id]
      );

      if (!result.rows.length) {
        return next(createError('JOB_NOT_FOUND', `Job ${job_id} not found for this brand`, 404));
      }

      const job = result.rows[0];
      return success(res, {
        brand_id,
        engine_id: job.engine_slug,
        job_id: job.job_id,
        status: job.status,
        result: job.result || null,
        error: job.error || null,
        created_at: job.created_at,
        updated_at: job.updated_at
      });
    } catch (err) {
      next(createError('STATUS_FETCH_FAILED', err.message, 500));
    }
  });

  return router;
}

module.exports = { createEngineRouter };
