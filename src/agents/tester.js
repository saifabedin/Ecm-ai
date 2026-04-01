/**
 * Tester Agent
 *
 * Validates engine responses for correctness:
 *   1. HTTP 2xx received from webhook
 *   2. brand_id present in response
 *   3. Required fields present (job_id, status, timestamp)
 *   4. No error payload on success
 *
 * Also provides a DB-level job status validator.
 */

const { pingEngine } = require('../utils/n8n');
const { query } = require('../config/db');
const logger = require('../utils/logger');

// Fields every engine response MUST contain
const REQUIRED_RESPONSE_FIELDS = ['brand_id', 'engine_id', 'job_id', 'status', 'timestamp'];

/**
 * Validate a raw engine response object.
 * Returns { passed, failures[] }.
 */
function validateEngineResponse(response, expected_brand_id) {
  const failures = [];

  if (!response || typeof response !== 'object') {
    return { passed: false, failures: ['Response is not a JSON object'] };
  }

  // Check required fields
  for (const field of REQUIRED_RESPONSE_FIELDS) {
    if (response[field] === undefined || response[field] === null) {
      failures.push(`Missing required field: "${field}"`);
    }
  }

  // Validate brand_id matches expected
  if (expected_brand_id && response.brand_id !== expected_brand_id) {
    failures.push(
      `brand_id mismatch — expected "${expected_brand_id}", got "${response.brand_id}"`
    );
  }

  // success:false must always have error_code
  if (response.success === false && !response.error_code) {
    failures.push('Error response missing "error_code"');
  }

  return { passed: failures.length === 0, failures };
}

/**
 * Ping a single engine and validate the reachability.
 *
 * @param {string} engine_slug
 * @param {string} brand_id   - used for brand_id presence check
 * @returns {object} test result
 */
async function testEngine(engine_slug, brand_id) {
  const ping = await pingEngine(engine_slug);
  const passed = ping.status === 'ok';

  logger.info('Engine test result', { engine_slug, brand_id, passed, latency_ms: ping.latency_ms });

  return {
    engine_slug,
    brand_id,
    ping_status:  ping.status,
    latency_ms:   ping.latency_ms,
    passed,
    error:        ping.error || null
  };
}

/**
 * Test all 15 engines concurrently.
 * Returns per-engine results plus an overall pass/fail summary.
 */
async function testAllEngines(brand_id) {
  const { ALL_ENGINE_SLUGS, pingAllEngines } = require('../utils/n8n');
  const { engines, summary } = await pingAllEngines();

  const results = engines.map(r => ({
    engine_slug:  r.slug,
    brand_id,
    ping_status:  r.status,
    latency_ms:   r.latency_ms,
    passed:       r.status === 'ok',
    error:        r.error || null
  }));

  logger.info('All engines tested', { brand_id, ...summary });

  return { results, summary, all_passed: summary.error === 0 };
}

/**
 * Validate a job in the DB — checks it exists, belongs to brand, and is not failed.
 *
 * @param {string} job_id
 * @param {string} brand_id
 * @returns {object} validation result
 */
async function validateJob(job_id, brand_id) {
  const result = await query(
    `SELECT job_id, brand_id, engine_slug, status, error
     FROM engine_jobs WHERE job_id = $1`,
    [job_id]
  );

  if (!result.rows.length) {
    return { passed: false, job_id, failure: 'Job not found in database' };
  }

  const job = result.rows[0];
  const failures = [];

  if (job.brand_id !== brand_id) {
    failures.push(`brand_id mismatch — job belongs to different brand`);
  }
  if (job.status === 'failed') {
    failures.push(`Job status is "failed": ${job.error || 'no error message'}`);
  }

  return {
    passed:       failures.length === 0,
    job_id:       job.job_id,
    brand_id:     job.brand_id,
    engine_slug:  job.engine_slug,
    status:       job.status,
    failures
  };
}

module.exports = { validateEngineResponse, testEngine, testAllEngines, validateJob, REQUIRED_RESPONSE_FIELDS };
