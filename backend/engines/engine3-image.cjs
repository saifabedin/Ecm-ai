const { generateImage } = require("../ai/replicate.cjs");
const { uuidv4 } = require("../utils/uuid.cjs");
const logger = require("../utils/logger.cjs");

// Constants
const MAX_RETRIES = 3;
const MAX_IMAGES = 3;

// Generate real AI images from Engine2's art-directed imagePlan.
// Each plan item carries its own detailed, designer-written prompt + metadata
// (type: social_post|ad, platform, linkedCaptionIndex). We send the prompt
// to Replicate as-is — Engine2 already authored it; we do NOT re-wrap it.
async function generateImages(plan) {
  const items = plan.slice(0, MAX_IMAGES);
  logger.info(`[Engine3] Generating ${items.length} images from imagePlan`);

  const results = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const prompt = item.imagePrompt;
    try {
      logger.info(`[Engine3] Image ${i + 1}/${items.length} [${item.type}/${item.platform}]: ${prompt.substring(0, 90)}...`);

      const imageUrl = await generateImage(prompt);

      logger.info(`[Engine3] Image ${i + 1} ready: ${imageUrl}`);
      results.push({
        prompt,
        type: item.type,
        platform: item.platform,
        linkedCaptionIndex: item.linkedCaptionIndex,
        imageUrl,
        index: i,
      });
    } catch (error) {
      logger.warn(`[Engine3] Image ${i + 1} failed: ${error.message}`);
      logger.info(`[Engine3] Using fallback placeholder for image ${i + 1}`);
      results.push({
        prompt,
        type: item.type,
        platform: item.platform,
        linkedCaptionIndex: item.linkedCaptionIndex,
        imageUrl: `https://placehold.co/1024x1024/4CAF50/white/png?text=${encodeURIComponent((item.type || "image").toUpperCase())}`,
        index: i,
        fallback: true,
      });
    }
  }

  logger.info(`[Engine3] Generated ${results.length} images (${results.filter(r => !r.fallback).length} real, ${results.filter(r => r.fallback).length} fallback)`);
  return results;
}

// Turn a list of hooks/strings into a minimal valid imagePlan (legacy fallback
// for when Engine2 didn't supply one).
function planFromHooks(hooks) {
  return hooks.slice(0, MAX_IMAGES).map((h, i) => ({
    type: i === 0 ? "social_post" : "ad",
    platform: "Instagram",
    linkedCaptionIndex: i,
    imagePrompt:
      `High-quality commercial marketing image for: ${h}. Photorealistic, ` +
      `cinematic lighting, rule-of-thirds composition with clean negative space ` +
      `for headline text, vibrant on-brand colors, 1:1 square, 4K, sharp focus, ` +
      `advertising quality.`,
  }));
}

async function validateInput(input) {
  logger.debug("[Engine3] Input received");

  // Preferred path: Engine2's art-directed imagePlan.
  let plan = [];
  const src = (input.content && input.content.imagePlan) || (input.data && input.data.imagePlan);
  if (Array.isArray(src) && src.length > 0) {
    plan = src
      .filter((p) => p && (p.imagePrompt || p.prompt))
      .map((p, i) => ({
        type: p.type === "ad" ? "ad" : "social_post",
        platform: p.platform || "Instagram",
        linkedCaptionIndex: Number.isInteger(p.linkedCaptionIndex) ? p.linkedCaptionIndex : i,
        imagePrompt: String(p.imagePrompt || p.prompt).trim(),
      }));
    logger.info(`[Engine3] Using imagePlan from Engine2: ${plan.length} images`);
  }

  // Legacy fallback: derive a plan from hooks / captions / defaults.
  if (plan.length === 0) {
    let hooks = [];
    if (input.content && Array.isArray(input.content.hooks) && input.content.hooks.length) {
      hooks = input.content.hooks;
    } else if (input.data && Array.isArray(input.data.hooks) && input.data.hooks.length) {
      hooks = input.data.hooks;
    } else if (input.content && Array.isArray(input.content.captions)) {
      hooks = input.content.captions.slice(0, MAX_IMAGES);
    }
    if (hooks.length === 0) {
      hooks = ["Best in town 🔥", "Limited time offer", "Try now and save!"];
    }
    plan = planFromHooks(hooks);
    logger.info(`[Engine3] No imagePlan — derived ${plan.length} images from hooks`);
  }

  if (!input.data) input.data = {};
  input.data.imagePlan = plan.slice(0, MAX_IMAGES);
  return input;
}

async function runEngine3(input) {
  const jobId = uuidv4();
  const engine = "engine3-image";

  try {
    logger.info(`[Engine3] Starting execution with jobId: ${jobId}`);

    // Input Validation with fallback
    const validatedInput = await validateInput(input);

    // Extract the art-directed image plan (Engine2 → Engine3)
    const plan = validatedInput.data.imagePlan.slice(0, MAX_IMAGES);
    logger.info(`[Engine3] Processing ${plan.length} planned images`);

    // Generate real AI images from the detailed prompts
    logger.info("[Engine3] Starting real AI image generation...");
    const results = await generateImages(plan);

    // Ensure we have at least some images
    if (results.length === 0) {
      logger.warn("[Engine3] No images generated, using fallback images");
      results.push({
        prompt: "Default marketing visual",
        imageUrl: "https://via.placeholder.com/1024x1024/4CAF50/white?text=Marketing+Visual",
        fallback: true
      });
    }

    logger.info(`[Engine3] Complete — ${results.length} images ready`);

    // Standardized Output
    return {
      success: true,
      engine,
      jobId,
      data: {
        images: results.map(r => r.imageUrl),
        socialPosts: results.filter(r => r.type === "social_post"),
        ads: results.filter(r => r.type === "ad"),
        thumbnails: results,
      },
      error: null,
    };
  } catch (error) {
    logger.error(`[Engine3] Error: ${error.message}`, { stack: error.stack });

    // Return fallback data instead of failure to keep pipeline running
    logger.warn("[Engine3] Returning fallback images to keep pipeline running");
    return {
      success: true,
      engine,
      jobId,
      data: {
        images: [
          "https://via.placeholder.com/1024x1024/4CAF50/white?text=Marketing+Image+1",
          "https://via.placeholder.com/1024x1024/2196F3/white?text=Marketing+Image+2",
          "https://via.placeholder.com/1024x1024/FF9800/white?text=Marketing+Image+3"
        ],
        thumbnails: [
          { prompt: "Marketing Image 1", imageUrl: "https://via.placeholder.com/1024x1024/4CAF50/white?text=Marketing+Image+1", fallback: true },
          { prompt: "Marketing Image 2", imageUrl: "https://via.placeholder.com/1024x1024/2196F3/white?text=Marketing+Image+2", fallback: true },
          { prompt: "Marketing Image 3", imageUrl: "https://via.placeholder.com/1024x1024/FF9800/white?text=Marketing+Image+3", fallback: true }
        ]
      },
      error: null,
    };
  }
}
module.exports = runEngine3;