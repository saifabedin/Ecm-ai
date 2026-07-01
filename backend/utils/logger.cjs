const winston = require('winston');
const { format } = require('logform');
const fs = require('fs');
const path = require('path');

// Ensure logs/ directory exists before transports try to open files.
// Silent on success; loud on permission errors so misconfigured deploys
// fail fast at startup instead of silently dropping log lines.
const LOG_DIR = path.resolve(process.env.LOG_DIR || path.join(__dirname, '..', 'logs'));
try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (err) {
  // Use console (winston not yet initialized)
  console.error(`[logger] FATAL: cannot create logs directory at ${LOG_DIR}: ${err.message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Structured format for file transports (JSON with jobId/correlationId support)
// ---------------------------------------------------------------------------
const jsonFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  format.errors({ stack: true }),
  format.splat(),
  format.json()
);

// ---------------------------------------------------------------------------
// Console format with colors + metadata (dev-friendly)
// ---------------------------------------------------------------------------
const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'service'] }),
  format.printf((info) => {
    const meta = info.metadata && Object.keys(info.metadata).length > 0
      ? ` | meta: ${JSON.stringify(info.metadata)}`
      : '';
    const job = info.jobId ? ` | jobId: ${info.jobId}` : '';
    const corr = info.correlationId ? ` | corrId: ${info.correlationId}` : '';
    return `${info.timestamp} ${info.level}: ${info.message}${job}${corr}${meta}`;
  })
);

// ---------------------------------------------------------------------------
// Build transports array based on environment
// ---------------------------------------------------------------------------
const transports = [
  // File transport for errors (always enabled)
  new winston.transports.File({
    filename: path.join(LOG_DIR, 'error.log'),
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    format: jsonFormat,
  }),
  // File transport for all logs (always enabled)
  new winston.transports.File({
    filename: path.join(LOG_DIR, 'combined.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    format: jsonFormat,
  }),
];

// Console transport for development (colorized, structured)
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// ---------------------------------------------------------------------------
// Create the logger instance
// ---------------------------------------------------------------------------
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'ecm-ai-os' },
  transports,
});

// ---------------------------------------------------------------------------
// Helper: Wrap functions with entry/exit logging + jobId/correlationId
// ---------------------------------------------------------------------------
function createTracer(moduleName) {
  return {
    logEnter: (functionName, meta = {}) => {
      const { jobId, correlationId, ...rest } = meta;
      logger.debug(`[${moduleName}] ENTER: ${functionName}`, {
        jobId,
        correlationId,
        metadata: { ...rest, module: moduleName, function: functionName, type: 'enter' },
      });
    },
    logExit: (functionName, meta = {}) => {
      const { jobId, correlationId, ...rest } = meta;
      logger.debug(`[${moduleName}] EXIT: ${functionName}`, {
        jobId,
        correlationId,
        metadata: { ...rest, module: moduleName, function: functionName, type: 'exit' },
      });
    },
    logInfo: (message, meta = {}) => {
      const { jobId, correlationId, ...rest } = meta;
      if (jobId) {
        logger.info(`[${moduleName}] ${message}`, {
          jobId,
          correlationId,
          metadata: { ...rest, module: moduleName },
        });
      } else {
        logger.info(`[${moduleName}] ${message}`, {
          correlationId,
          metadata: { ...rest, module: moduleName },
        });
      }
    },
    logError: (message, error, meta = {}) => {
      const { jobId, correlationId, ...rest } = meta;
      logger.error(`[${moduleName}] ${message}: ${error?.message || error}`, {
        jobId,
        correlationId,
        metadata: { ...rest, module: moduleName, stack: error?.stack },
      });
    },
    logWarn: (message, meta = {}) => {
      const { jobId, correlationId, ...rest } = meta;
      if (jobId) {
        logger.warn(`[${moduleName}] ${message}`, {
          jobId,
          correlationId,
          metadata: { ...rest, module: moduleName },
        });
      } else {
        logger.warn(`[${moduleName}] ${message}`, {
          correlationId,
          metadata: { ...rest, module: moduleName },
        });
      }
    },
  };
}

module.exports = logger;
module.exports.createTracer = createTracer;