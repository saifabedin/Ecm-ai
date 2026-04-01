const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

// ─── Webhook Route Map ────────────────────────────────────────────────────────
// Maps each engine slug to its exact n8n webhook path.
// Base URL comes from N8N_BASE_URL env var.
const WEBHOOK_MAP = {
  'db-migration':        '/webhook/engine-db',
  'brand-knowledge':     '/webhook/engine-1',
  'market-intelligence': '/webhook/engine-2',
  'strategy-planning':   '/webhook/engine-3',
  'content-generation':  '/webhook/engine-4',
  'image-generation':    '/webhook/engine-5',
  'video-generation':    '/webhook/engine-6',
  'publishing-spider':   '/webhook/engine-7',
  'ads-management':      '/webhook/engine-8',
  'campaign-creator':    '/webhook/engine-8a',
  'daily-performance':   '/webhook/engine-8b',
  'campaign-activate':   '/webhook/engine-8c',
  'perf-tracking':       '/webhook/engine-9',
  'optimization-spider': '/webhook/engine-10',
  'orchestrator-brain':  '/webhook/engine-11'
};

// All known engine slugs in definition order
const ALL_ENGINE_SLUGS = Object.keys(WEBHOOK_MAP);

/**
 * Resolve the full webhook URL for a given engine slug.
 * Throws if the slug is unknown or the base URL is not configured.
 */
function resolveWebhookUrl(slug) {
  const baseUrl = process.env.N8N_BASE_URL || process.env.N8N_WEBHOOK_BASE_URL;
  if (!baseUrl) throw new Error('N8N_BASE_URL is not configured');

  const path = WEBHOOK_MAP[slug];
  if (!path) throw new Error(`Unknown engine slug: "${slug}". Not in WEBHOOK_MAP.`);

  return `${baseUrl}${path}`;
}

/**
 * Build standard n8n headers including optional API key auth.
 */
function buildHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.N8N_API_KEY) {
    headers['X-N8N-API-KEY'] = process.env.N8N_API_KEY;
  }
  return headers;
}

/**
 * Trigger an n8n workflow by engine slug.
 *
 * Always sends: brand_id, engine_id, job_id, payload, timestamp.
 * n8n responses are async — caller receives job_id for status polling.
 *
 * @param {string} slug      - engine slug from WEBHOOK_MAP
 * @param {string} brand_id  - UUID v4 of the brand
 * @param {object} payload   - engine-specific input data
 * @returns {{ job_id, webhook_url, n8n_response }}
 */
async function triggerWorkflow(slug, brand_id, payload = {}) {
  const webhookUrl = resolveWebhookUrl(slug);
  const job_id = uuidv4();

  const body = {
    brand_id,
    engine_id:  slug,
    job_id,
    payload,
    timestamp:  new Date().toISOString()
  };

  try {
    const response = await axios.post(webhookUrl, body, {
      headers: buildHeaders(),
      timeout: 15000
    });
    logger.info('n8n workflow triggered', { slug, brand_id, job_id, url: webhookUrl });
    return { job_id, webhook_url: webhookUrl, n8n_response: response.data };
  } catch (err) {
    logger.error('n8n webhook failed', { slug, brand_id, job_id, error: err.message });
    throw new Error(`Engine "${slug}" trigger failed: ${err.message}`);
  }
}

/**
 * Ping a single engine's webhook to check reachability.
 * Sends a lightweight test payload; expects HTTP 2xx.
 *
 * @returns {{ slug, status: 'ok'|'error', latency_ms, error? }}
 */
async function pingEngine(slug) {
  const start = Date.now();
  let webhookUrl;
  try {
    webhookUrl = resolveWebhookUrl(slug);
    await axios.post(webhookUrl, {
      brand_id:  '00000000-0000-4000-a000-000000000000',
      engine_id: slug,
      job_id:    uuidv4(),
      payload:   { _ping: true },
      timestamp: new Date().toISOString()
    }, {
      headers: buildHeaders(),
      timeout: 8000
    });
    return { slug, status: 'ok', latency_ms: Date.now() - start, url: webhookUrl };
  } catch (err) {
    return {
      slug,
      status:     'error',
      latency_ms: Date.now() - start,
      url:        webhookUrl || null,
      error:      err.message
    };
  }
}

/**
 * Ping all 15 engines concurrently.
 * Returns array of ping results sorted by slug.
 */
async function pingAllEngines() {
  const results = await Promise.all(ALL_ENGINE_SLUGS.map(pingEngine));
  const ok    = results.filter(r => r.status === 'ok').length;
  const error = results.filter(r => r.status === 'error').length;
  return { engines: results, summary: { total: results.length, ok, error } };
}

module.exports = { triggerWorkflow, pingEngine, pingAllEngines, WEBHOOK_MAP, ALL_ENGINE_SLUGS };
