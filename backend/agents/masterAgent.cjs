const { saveRun } = require("../db/memory.cjs");
const runEngine1 = require("../engines/engine1-research.cjs");
const runEngine2 = require("../engines/engine2-content.cjs");
const runEngine3 = require("../engines/engine3-image.cjs");
const runEngine4 = require("../engines/engine4-video.cjs");
const runEngine5 = require("../engines/engine5-publish.cjs");
const runEngine6 = require("../engines/engine6-ads.cjs");
const activateMetaCampaign = require("../engines/engine6-ads-activate.cjs");
const runEngine7 = require("../engines/engine7-tracking.cjs");
const runEngine8 = require("../engines/engine8-optimization.cjs");
const { runEngine9 } = require("../engines/engine9-delayed-jobs.cjs");

const logger = require('../utils/logger.cjs');
const { createTracer } = require('../utils/logger.cjs');
const tracer = createTracer('masterAgent');

async function runMasterAgent(input) {
  const jobId = input.jobId;
  const correlationId = input.correlationId || 'unknown';

  // Log entry
  tracer.logEnter('runMasterAgent', { jobId, correlationId });
  logger.info(`[MasterAgent] Starting job ${jobId}`, { jobId, correlationId });

  try {
    // Initialize state with the original input
    let state = { ...input };

    // Engine 1: Research
    logger.info(`[MasterAgent] Running Engine 1 (Research)`, { jobId, correlationId });
    tracer.logEnter('runEngine1', { jobId, correlationId });
    const engine1Result = await runEngine1(state);
    if (!engine1Result.success) {
      logger.error(`[MasterAgent] Engine 1 failed: ${engine1Result.error}`, { jobId, correlationId });
      throw new Error(`Engine 1 failed: ${engine1Result.error}`);
    }
    state = { ...state, ...engine1Result.data };
    logger.info(`[MasterAgent] Engine 1 completed`, { jobId, correlationId });
    tracer.logExit('runEngine1', { jobId, correlationId });

    // Engine 2: Content
    logger.info(`[MasterAgent] Running Engine 2 (Content)`, { jobId, correlationId });
    tracer.logEnter('runEngine2', { jobId, correlationId });
    const engine2Result = await runEngine2(state);
    if (!engine2Result.success) {
      logger.error(`[MasterAgent] Engine 2 failed: ${engine2Result.error}`, { jobId, correlationId });
      throw new Error(`Engine 2 failed: ${engine2Result.error}`);
    }
    state = { ...state, ...engine2Result.data };
    logger.info(`[MasterAgent] Engine 2 completed`, { jobId, correlationId });
    tracer.logExit('runEngine2', { jobId, correlationId });

    // Engine 3: Image
    logger.info(`[MasterAgent] Running Engine 3 (Image)`, { jobId, correlationId });
    tracer.logEnter('runEngine3', { jobId, correlationId });
    const engine3Result = await runEngine3(state);
    if (!engine3Result.success) {
      logger.error(`[MasterAgent] Engine 3 failed: ${engine3Result.error}`, { jobId, correlationId });
      throw new Error(`Engine 3 failed: ${engine3Result.error}`);
    }
    state = { ...state, ...engine3Result.data };
    logger.info(`[MasterAgent] Engine 3 completed`, { jobId, correlationId });
    tracer.logExit('runEngine3', { jobId, correlationId });

    // Engine 4: Video
    logger.info(`[MasterAgent] Running Engine 4 (Video)`, { jobId, correlationId });
    tracer.logEnter('runEngine4', { jobId, correlationId });
    const engine4Result = await runEngine4(state);
    if (!engine4Result.success) {
      logger.error(`[MasterAgent] Engine 4 failed: ${engine4Result.error}`, { jobId, correlationId });
      throw new Error(`Engine 4 failed: ${engine4Result.error}`);
    }
    state = { ...state, ...engine4Result.data };
    logger.info(`[MasterAgent] Engine 4 completed`, { jobId, correlationId });
    tracer.logExit('runEngine4', { jobId, correlationId });

    // Engine 5: Publish (returns post_id)
    logger.info(`[MasterAgent] Running Engine 5 (Publish)`, { jobId, correlationId });
    tracer.logEnter('runEngine5', { jobId, correlationId });
    const engine5Result = await runEngine5(state);
    if (!engine5Result.success) {
      logger.error(`[MasterAgent] Engine 5 failed: ${engine5Result.error}`, { jobId, correlationId });
      throw new Error(`Engine 5 failed: ${engine5Result.error}`);
    }
    state = { ...state, ...engine5Result.data };
    logger.info(`[MasterAgent] Engine 5 completed`, { jobId, correlationId });
    tracer.logExit('runEngine5', { jobId, correlationId });

    // Engine 7: Tracking (uses post_id from engine 5)
    logger.info(`[MasterAgent] Running Engine 7 (Tracking)`, { jobId, correlationId });
    tracer.logEnter('runEngine7', { jobId, correlationId });
    const engine7Result = await runEngine7(state);
    if (!engine7Result.success) {
      logger.error(`[MasterAgent] Engine 7 failed: ${engine7Result.error}`, { jobId, correlationId });
      throw new Error(`Engine 7 failed: ${engine7Result.error}`);
    }
    state = { ...state, ...engine7Result.data };
    logger.info(`[MasterAgent] Engine 7 completed`, { jobId, correlationId });
    tracer.logExit('runEngine7', { jobId, correlationId });

    // Engine 8: Optimization (uses tracking data from engine 7)
    logger.info(`[MasterAgent] Running Engine 8 (Optimization)`, { jobId, correlationId });
    tracer.logEnter('runEngine8', { jobId, correlationId });
    const engine8Result = await runEngine8(state);
    if (!engine8Result.success) {
      logger.error(`[MasterAgent] Engine 8 failed: ${engine8Result.error}`, { jobId, correlationId });
      throw new Error(`Engine 8 failed: ${engine8Result.error}`);
    }
    state = { ...state, ...engine8Result.data };
    logger.info(`[MasterAgent] Engine 8 completed`, { jobId, correlationId });
    tracer.logExit('runEngine8', { jobId, correlationId });

    // Engine 6: Ads Creation (if needed - we always run it as per the flow)
    logger.info(`[MasterAgent] Running Engine 6 (Ads Creation)`, { jobId, correlationId });
    tracer.logEnter('runEngine6', { jobId, correlationId });
    const engine6Result = await runEngine6(state);
    if (!engine6Result.success) {
      // Ads are non-critical: log the degradation but keep the pipeline running
      // with whatever fallback campaign data Engine 6 returned.
      logger.warn(`[MasterAgent] Engine 6 degraded (using fallback ads): ${engine6Result.error}`, { jobId, correlationId });
    }
    state = { ...state, ...engine6Result.data };
    logger.info(`[MasterAgent] Engine 6 completed`, { jobId, correlationId });
    tracer.logExit('runEngine6', { jobId, correlationId });

    // Engine 6b: Meta ads ACTIVATION (no-op unless creds configured; creates PAUSED)
    tracer.logEnter('activateMetaCampaign', { jobId, correlationId });
    const adsActivation = await activateMetaCampaign(state);
    if (adsActivation.skipped) {
      logger.info(`[MasterAgent] Ads activation skipped: ${adsActivation.reason}`, { jobId, correlationId });
    } else if (!adsActivation.success) {
      logger.warn(`[MasterAgent] Ads activation failed (non-fatal): ${adsActivation.error}`, { jobId, correlationId });
    } else {
      logger.info(`[MasterAgent] Ads activated (PAUSED): campaign ${adsActivation.campaignId}`, { jobId, correlationId });
    }
    state = { ...state, adsActivation };
    tracer.logExit('activateMetaCampaign', { jobId, correlationId });

    // Engine 9: Scheduling (if delay present in original input)
    if (input.delayMs && input.delayMs > 0) {
      logger.info(`[MasterAgent] Running Engine 9 (Scheduling) with delay: ${input.delayMs}`, { jobId, correlationId });
      tracer.logEnter('runEngine9', { jobId, correlationId });
      const engine9Input = {
        recommendations: state.recommendations || [],
        delayMs: input.delayMs
      };
      const engine9Result = await runEngine9(engine9Input);
      if (!engine9Result.success) {
        logger.error(`[MasterAgent] Engine 9 failed: ${engine9Result.error}`, { jobId, correlationId });
        throw new Error(`Engine 9 failed: ${engine9Result.error}`);
      }
      state = { ...state, ...engine9Result.data };
      logger.info(`[MasterAgent] Engine 9 completed`, { jobId, correlationId });
      tracer.logExit('runEngine9', { jobId, correlationId });
    } else {
      logger.info(`[MasterAgent] Skipping Engine 9 (no delay specified)`, { jobId, correlationId });
    }

    logger.info(`[MasterAgent] Job ${jobId} completed successfully`, { jobId, correlationId });

    // Save the run
    await saveRun(jobId, input, state);

    tracer.logExit('runMasterAgent', { jobId, correlationId });

    return {
      success: true,
      jobId,
      data: state,
    };
  } catch (error) {
    logger.error(`[MasterAgent] Job ${jobId} failed: ${error.message}`, {
      jobId,
      correlationId,
      stack: error.stack,
    });

    // Save the failed run
    await saveRun(jobId, input, { error: error.message });

    tracer.logExit('runMasterAgent', { jobId, correlationId, error: true });

    return {
      success: false,
      jobId,
      error: error.message,
    };
  }
}

module.exports = {
  runMasterAgent
};