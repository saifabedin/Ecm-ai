const { addJob, getJobStatus } = require('../queues/jobQueue.cjs');
const logger = require('../utils/logger.cjs');
const { captureDecisionToVault } = require('../scripts/capture-automations.cjs');

// SECURITY: allowlist of supported job types — reject unknown values early.
const ALLOWED_JOB_TYPES = new Set([
  'research', 'content', 'image', 'video', 'publish', 'ads', 'tracking', 'optimization',
]);

// SECURITY: tenant_id from header must be a short identifier, no shell metachars.
function sanitizeTenantId(raw) {
  if (typeof raw !== 'string') return 'default';
  const trimmed = raw.trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(trimmed)) {
    logger.warn(`[Orchestrator] Rejected unsafe tenant_id, falling back to 'default'`, {
      metadata: { type: 'input_validation', field: 'tenant_id' },
    });
    return 'default';
  }
  return trimmed;
}

async function runOrchestrator(req, res) {
  const jobId = `job_${Date.now()}`;
  const correlationId = req.correlationId || `corr_${Date.now()}`;
  req.jobId = jobId; // Make jobId available to downstream middleware (e.g., request logger)

  // SECURITY: sanitize tenant_id from header (user.tenant_id comes from JWT — already trusted)
  const rawTenantId = req.user?.tenant_id || req.headers['x-tenant-id'] || 'default';
  const tenantId = req.user?.tenant_id ? rawTenantId : sanitizeTenantId(rawTenantId);

  const input = {
    ...req.body,
    jobId,
    correlationId,
    tenant_id: tenantId, // Add tenant_id to the job data
  };

  // Log entry into this function
  logger.info(`[Orchestrator] ENTER runOrchestrator`, {
    jobId,
    correlationId,
    tenantId,
    metadata: { function: 'runOrchestrator', type: 'enter' },
  });

  try {
    const jobType = req.body.jobType || 'research';
    if (!ALLOWED_JOB_TYPES.has(jobType)) {
      logger.error(`[Orchestrator] Rejected unknown jobType: ${jobType}`, {
        jobId,
        correlationId,
        metadata: { type: 'input_validation', field: 'jobType' },
      });
      return res.status(400).json({ success: false, error: 'Unknown jobType' });
    }

    const queueResult = await addJob(jobType, input);

    if (!queueResult.success) {
      logger.error(`[Orchestrator] Failed to queue job: ${queueResult.error}`, {
        jobId,
        correlationId,
        metadata: { function: 'runOrchestrator', type: 'error' },
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to queue job',
      });
    }

    if ((req.body.context || '').toLowerCase().includes('architecture')) {
  captureDecisionToVault(
    `Job Queued: ${jobType}`,
    `Queued job ${jobId} of type ${jobType} via orchestrator.`,
    'medium'
  );
}

logger.info(`[Orchestrator] Job queued successfully`, {
      jobId: queueResult.jobId,
      correlationId,
      metadata: { function: 'runOrchestrator', type: 'queued' },
    });

    return res.status(202).json({
      success: true,
      message: 'Job queued successfully',
      jobId: queueResult.jobId,
      status: 'queued',
    });
  } catch (error) {
    logger.error(`[Orchestrator] Error in runOrchestrator: ${error.message}`, {
      jobId,
      correlationId,
      stack: error.stack,
      metadata: { function: 'runOrchestrator', type: 'error' },
    });
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

async function getJobResult(req, res) {
  const { jobId } = req.params;
  const correlationId = req.correlationId || `corr_${Date.now()}`;

  logger.info(`[Orchestrator] ENTER getJobResult for jobId=${jobId}`, {
    jobId,
    correlationId,
    metadata: { function: 'getJobResult', type: 'enter' },
  });

  try {
    const result = await getJobStatus(jobId);

    if (!result.success) {
      logger.warn(`[Orchestrator] Job not found: ${jobId}`, {
        jobId,
        correlationId,
        metadata: { function: 'getJobResult', type: 'not_found' },
      });
      return res.status(404).json({
        success: false,
        error: 'Job not found',
        ...(correlationId && { correlationId }),
      });
    }

    logger.info(`[Orchestrator] Job status retrieved: ${jobId}`, {
      jobId,
      correlationId,
      state: result.state,
      metadata: { function: 'getJobResult', type: 'success' },
    });

    return res.status(200).json(result);
  } catch (error) {
    logger.error(`[Orchestrator] Error getting job result: ${error.message}`, {
      jobId,
      correlationId,
      stack: error.stack,
      metadata: { function: 'getJobResult', type: 'error' },
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to get job status',
    });
  }
}

module.exports = {
  runOrchestrator,
  getJobResult,
};