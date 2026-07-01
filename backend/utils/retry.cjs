// Reusable retry helper with exponential backoff.
// Used for external API calls (ElevenLabs, Pexels, D-ID).
const logger = require('./logger.cjs');

async function retryWithBackoff(fn, options = {}) {
  const {
    attempts = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
    label = 'operation',
    correlationId,
  } = options;

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        const wait = delayMs * Math.pow(backoffMultiplier, attempt - 1);
        logger.warn(`[Retry] ${label} attempt ${attempt}/${attempts} failed: ${err.message} — retrying in ${wait}ms`, {
          correlationId: correlationId || 'SYSTEM',
          metadata: { type: 'retry', attempt, totalAttempts: attempts, waitMs: wait, label },
        });
        await new Promise(resolve => setTimeout(resolve, wait));
      }
    }
  }

  logger.error(`[Retry] ${label} failed after ${attempts} attempts: ${lastError.message}`, {
    correlationId: correlationId || 'SYSTEM',
    metadata: { type: 'retry_exhausted', totalAttempts: attempts, label },
  });
  throw lastError;
}

module.exports = { retryWithBackoff };
