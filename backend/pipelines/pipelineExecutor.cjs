async function runPipeline(plan, input) {
  let context = { ...input };
  const results = {};

  const engineMap = {
    research: require("../engines/engine1-research.cjs"),
    content: require("../engines/engine2-content.cjs"),
    image: require("../engines/engine3-image.cjs"),
    video: require("../engines/engine4-video.cjs"),
    publish: require("../engines/engine5-publish.cjs"),
    ads: require("../engines/engine6-ads.cjs"),
    tracking: require("../engines/engine7-tracking.cjs"),
    optimization: require("../engines/engine8-optimization.cjs"),
  };

  for (const step of plan.steps) {
    const engineFn = engineMap[step.action];

    if (!engineFn) continue;

    const res = await engineFn(context);

    // `degraded` engines (e.g. ads fallback) return success:false but still
    // emit usable fallback data — don't abort the whole pipeline for those.
    if (!res.success && !res.degraded) {
      throw new Error(`Failed at ${step.action}`);
    }

    context = { ...context, [step.action]: res.data };
    results[step.action] = res.data;
  }

  return results;
}

module.exports = {
  runPipeline
};