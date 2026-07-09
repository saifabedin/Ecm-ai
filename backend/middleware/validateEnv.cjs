'use strict';

/**
 * Environment Validation Middleware
 * RUNS ON STARTUP - Prevents broken deployments
 * 
 * Purpose: Ensure all required env vars exist before API starts
 * If missing → process exits with error message
 */

const REQUIRED_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'NODE_ENV'
];

const OPTIONAL_VARS_WITH_DEFAULTS = {
  'PORT': '4000',
  'LOG_LEVEL': 'info',
  'JWT_EXPIRY': '24h',
  'JWT_REFRESH_EXPIRY': '30d',
  'RATE_LIMIT_WINDOW_MS': '900000',
  'RATE_LIMIT_MAX': '100',
  'NODE_ENV': 'development',
  'REDIS_URL': 'redis://localhost:6379'
};

function validateEnv() {
  console.log('🔍 Validating environment variables...');
  
  const missing = [];

  // ━━ CHECK REQUIRED VARS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  REQUIRED_VARS.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });

  // ━━ FAIL FAST IF MISSING ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (missing.length > 0) {
    const errorMsg = `\n❌ FATAL: Missing required environment variables:\n   ${missing.join('\n   ')}\n\nPlease add these to your .env file\n`;
    console.error(errorMsg);
    process.exit(1);
  }

  // ━━ SET OPTIONAL DEFAULTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Object.entries(OPTIONAL_VARS_WITH_DEFAULTS).forEach(([varName, defaultValue]) => {
    if (!process.env[varName]) {
      process.env[varName] = defaultValue;
      console.log(`   ℹ️  ${varName} = ${defaultValue} (default)`);
    }
  });

  // ━━ VALIDATE FORMATS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (!['development', 'staging', 'production'].includes(process.env.NODE_ENV)) {
    const error = `NODE_ENV must be 'development', 'staging', or 'production', got: ${process.env.NODE_ENV}`;
    console.error(`❌ ${error}`);
    process.exit(1);
  }

  if (isNaN(parseInt(process.env.PORT))) {
    const error = `PORT must be a number, got: ${process.env.PORT}`;
    console.error(`❌ ${error}`);
    process.exit(1);
  }

  console.log('✅ Environment validation passed\n');
  return true;
}

module.exports = { validateEnv };
