const REQUIRED = [
  'DATABASE_URL',
  'JWT_SECRET',
  'N8N_WEBHOOK_BASE_URL'
];

function validateEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = { validateEnv };
