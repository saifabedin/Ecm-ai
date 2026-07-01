// SECURITY: validate critical env vars at startup.
// Logs warnings for missing keys (NEVER logs values).
const logger = require('./logger.cjs');

const REQUIRED_ENV = {
  // Auth & data (REQUIRED)
  DATABASE_URL: { required: true,  label: 'Neon PostgreSQL connection string' },
  REDIS_HOST:   { required: true,  label: 'Redis host' },
  REDIS_PORT:   { required: false, label: 'Redis port' },
  JWT_SECRET:   { required: true,  label: 'JWT signing secret' },

  // AI providers (WARN — engine may degrade gracefully)
  OPENAI_API_KEY:       { required: false, label: 'OpenAI' },
  ANTHROPIC_API_KEY:    { required: false, label: 'Anthropic Claude' },
  ELEVENLABS_API_KEY:   { required: false, label: 'ElevenLabs TTS' },
  DID_API_KEY:          { required: false, label: 'D-ID avatar' },
  PEXELS_API_KEY:       { required: false, label: 'Pexels stock footage' },
  REPLICATE_API_TOKEN:  { required: false, label: 'Replicate' },

  // Integrations (WARN — features may fail)
  N8N_WEBHOOK_BASE_URL: { required: false, label: 'n8n webhook base URL' },
  ALLOWED_ORIGINS:      { required: false, label: 'CORS allowed origins' },
};

function validateRequiredEnv() {
  const missing = [];
  const warnings = [];

  for (const [key, spec] of Object.entries(REQUIRED_ENV)) {
    if (!process.env[key] || process.env[key].trim() === '') {
      const msg = `Missing env var: ${key} (${spec.label})`;
      if (spec.required) {
        missing.push(msg);
        logger.error(msg, { metadata: { type: 'env_validation', severity: 'critical', envVar: key } });
      } else {
        warnings.push(msg);
        logger.warn(msg,  { metadata: { type: 'env_validation', severity: 'warning', envVar: key } });
      }
    }
  }

  return { missing, warnings, ok: missing.length === 0 };
}

module.exports = { validateRequiredEnv, REQUIRED_ENV };
