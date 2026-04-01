const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

/**
 * Trigger an n8n workflow by slug.
 * Always includes brand_id, engine_id, and timestamp in the payload.
 * Returns the n8n execution response (async — job tracking via job_id).
 */
async function triggerWorkflow(slug, brand_id, payload = {}) {
  const baseUrl = process.env.N8N_WEBHOOK_BASE_URL;
  if (!baseUrl) throw new Error('N8N_WEBHOOK_BASE_URL is not configured');

  const job_id = uuidv4();
  const body = {
    brand_id,
    engine_id: slug,
    job_id,
    payload,
    timestamp: new Date().toISOString()
  };

  const headers = {};
  if (process.env.N8N_API_KEY) {
    headers['X-N8N-API-KEY'] = process.env.N8N_API_KEY;
  }

  try {
    const response = await axios.post(`${baseUrl}/${slug}`, body, {
      headers,
      timeout: 10000
    });
    logger.info(`n8n workflow triggered`, { slug, brand_id, job_id });
    return { job_id, n8n_response: response.data };
  } catch (err) {
    logger.error(`n8n webhook failed`, { slug, brand_id, error: err.message });
    throw new Error(`Engine ${slug} workflow trigger failed: ${err.message}`);
  }
}

module.exports = { triggerWorkflow };
