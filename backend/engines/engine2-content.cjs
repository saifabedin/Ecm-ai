const { generateAIResponse } = require("../ai/openrouter.cjs");
const { logInfo } = require("../db/logs.cjs");
const { uuidv4 } = require("../utils/uuid.cjs");
const logger = require("../utils/logger.cjs");

// Constants
const MAX_RETRIES = 3;
const MIN_IMAGES = 1;
const MAX_IMAGES = 4;

// Coerce whatever the AI returned into a valid, clamped (1-4) imagePlan.
// Falls back to deriving one art-directed prompt per hook if missing.
function normalizeImagePlan(plan, content = {}) {
  let items = Array.isArray(plan) ? plan : [];

  items = items
    .filter((p) => p && typeof p === "object" && (p.imagePrompt || p.prompt))
    .map((p, i) => ({
      type: p.type === "ad" ? "ad" : "social_post",
      platform: p.platform || "Instagram",
      goal: p.goal || "Drive engagement",
      linkedCaptionIndex: Number.isInteger(p.linkedCaptionIndex)
        ? p.linkedCaptionIndex
        : i,
      imagePrompt: String(p.imagePrompt || p.prompt).trim(),
    }));

  // Derive from hooks if AI gave nothing usable.
  if (items.length === 0) {
    const hooks = Array.isArray(content.hooks) && content.hooks.length
      ? content.hooks
      : ["Brand visual"];
    items = hooks.slice(0, MAX_IMAGES).map((h, i) => ({
      type: i === 0 ? "social_post" : "ad",
      platform: "Instagram",
      goal: "Drive engagement",
      linkedCaptionIndex: i,
      imagePrompt:
        `Professional commercial visual for "${h}". Photorealistic, ` +
        `cinematic key lighting, rule-of-thirds composition with clean negative ` +
        `space for headline text, vibrant on-brand color palette, 1:1 square, ` +
        `4K, sharp focus, advertising quality.`,
    }));
  }

  return items.slice(0, MAX_IMAGES); // clamp to MIN_IMAGES..MAX_IMAGES (>=1 guaranteed above)
}

// New function for real AI content generation
async function generateContent(input) {
  logger.info("[Engine2] Generating real AI content...");

  const research = input.research || {};
  const business = input.businessName || input.business || 'Unknown Business';
  const platform = input.platform || 'Instagram';
  const goal = input.goal || 'Increase brand awareness';

  const contentPrompt = `You are a world-class short-form video scriptwriter specializing in high-retention TikTok/Reels content. Generate scripts that follow a proven narrative arc structure.

Business: ${business}
Platform: ${platform}
Goal: ${goal}

Use this research data:
- Content Strategy: ${JSON.stringify(research.ContentStrategy || {})}
- Viral Content Ideas: ${JSON.stringify(research.ViralContentIdeas || [])}
- High-Converting Ad Angles: ${JSON.stringify(research.HighConvertingAdAngles || [])}
- Target Audience Pain Points: ${JSON.stringify(research.TargetAudiencePsychology?.painPoints || [])}

Return ONLY valid JSON with this exact structure:
{
  "hooks": ["hook1", "hook2", "hook3"],
  "captions": ["caption1", "caption2", "caption3"],
  "reelsScripts": ["script1", "script2", "script3"],
  "adCopies": ["adCopy1", "adCopy2", "adCopy3"],
  "ctas": ["cta1", "cta2", "cta3"],
  "imagePlan": [
    {
      "type": "social_post",
      "platform": "Instagram",
      "goal": "what this single image must achieve",
      "linkedCaptionIndex": 0,
      "imagePrompt": "the full, production-ready image-generation prompt"
    }
  ]
}

CRITICAL REQUIREMENTS FOR reelsScripts:
Each script MUST follow this 7-beat narrative arc (Hormozi-style retention structure):

1. HOOK (1-2 sentences): Pattern interrupt, bold claim, or curiosity gap. Start with "You", "Stop", "Wait", or a shocking statement. Maximum intensity.
2. CONTEXT (1-2 sentences): "Here's the thing..." or "Let me show you..." — establish why this matters to the viewer.
3. PROBLEM (1-2 sentences): Amplify the pain point. "Most people struggle with..." or "The problem is..." — make them feel the frustration.
4. ESCALATION (1-2 sentences): Build tension. "And it gets worse..." or "Until I discovered..." — raise the stakes.
5. SOLUTION (1-2 sentences): The reveal. "Here's what changed everything..." or "The secret is..." — provide the answer.
6. PEAK (1 sentence): Strongest emotional moment. Proof, results, or transformation. "This changed my life" or "$X in Y days".
7. CTA (1 sentence): Clear, urgent action. "Click the link", "Follow for more", "Try it now".

Each script should be 4-8 sentences, totaling 30-50 words (optimized for 15-30 second voiceover).
Use short, punchy sentences. No fluff. Every word must earn its place.
Include emotional trigger words: secret, proven, free, new, exclusive, limited, you, imagine.

CRITICAL REQUIREMENTS FOR imagePlan (you are now also the ART DIRECTOR):
You decide how many images this campaign needs — MINIMUM 1, MAXIMUM 4. Choose the count based on the goal and the strongest hooks; do NOT pad to 4 if fewer images tell the story better.
For EACH image decide its "type":
  - "social_post": organic feed visual — brand-building, value, story, engagement.
  - "ad": paid conversion creative — clear offer, urgency, strong focal CTA space.
At least one image should usually be a "social_post". Add an "ad" only when there is a real offer/conversion angle in the research/ad copies.
Set "linkedCaptionIndex" to the index (0-based) of the caption/adCopy this image pairs with.

Write each "imagePrompt" as a PROFESSIONAL GRAPHIC DESIGNER + EXPERT CONTENT CREATOR would brief an AI image model. Each prompt MUST be a single rich paragraph (40-80 words) and explicitly specify:
  - Subject & scene (what is literally in frame, for THIS specific business — not generic).
  - Composition & framing (rule of thirds, focal point, negative space for text/logo if it's an ad).
  - Lighting & mood (e.g. soft cinematic key light, golden hour, high-key studio).
  - Color palette (on-brand, name actual colors).
  - Style & medium (photorealistic product photography / 3D render / editorial / flat-lay etc.).
  - Aspect ratio guidance (square 1:1 for feed, 4:5 portrait, or 9:16 story/reel cover) and platform.
  - Quality tags (4K, sharp focus, commercial advertising quality).
Never write a vague prompt like "nice image of product". Be concrete, art-directed, and conversion-aware.

OTHER REQUIREMENTS:
- Hooks: Short, attention-grabbing phrases (3-5 words) — these appear as on-screen text
- Captions: Engaging Instagram captions with emojis
- Ad Copies: Compelling ad copy with clear value proposition
- CTAs: Strong call-to-action phrases (3-5 words)

Do NOT include markdown, backticks, or any explanation. Return ONLY the JSON.`;

  try {
    logger.info("[Engine2] Sending content request to AI...");
    const aiResponse = await generateAIResponse({
      prompt: contentPrompt,
      model: process.env.OPENROUTER_MODEL || "moonshotai/kimi-k2.6:free",
      temperature: 0.8
    });
    logger.info(`[Engine2] AI content response received, length: ${aiResponse?.length}`);

    // Parse AI response safely
    const startIdx = aiResponse.indexOf('{');
    const endIdx = aiResponse.lastIndexOf('}') + 1;

    if (startIdx === -1 || endIdx === 0) {
      throw new Error("No JSON found in AI response");
    }

    const cleaned = aiResponse.substring(startIdx, endIdx).trim();
    const parsed = JSON.parse(cleaned);

    // Validate structure
    if (!parsed.hooks || !parsed.captions || !parsed.reelsScripts) {
      throw new Error("Invalid AI response structure - missing required fields");
    }

    logger.info("[Engine2] Real AI content generated successfully");
    logger.info(`[Engine2] Content data keys: ${Object.keys(parsed).join(', ')}`);
    logger.info(`[Engine2] Generated ${parsed.hooks?.length} hooks, ${parsed.captions?.length} captions, ${parsed.reelsScripts?.length} scripts`);

    return parsed;

  } catch (error) {
    logger.error(`[Engine2] AI content generation failed: ${error.message}`);
    throw error;
  }
}

async function validateInput(input) {
  logger.debug(`[Engine2] Input received: ${JSON.stringify(input)}`);

  // Check for research data
  if (!input.research) {
    logger.warn("[Engine2] Research data missing, using fallback");
    input.research = {
      ContentStrategy: {
        platforms: ["Instagram", "Facebook"],
        contentTypes: ["Reels", "Stories", "Posts"],
        postingFrequency: "Daily",
        tone: "Engaging and professional"
      },
      ViralContentIdeas: [
        "Behind the scenes content",
        "Customer testimonials",
        "Interactive Q&A sessions"
      ],
      HighConvertingAdAngles: [
        "Limited-time offers",
        "Social proof",
        "Unique value proposition"
      ]
    };
  } else {
    logger.debug(`[Engine2] Research data found with keys: ${Object.keys(input.research).join(', ')}`);
  }

  // Add fallback to input for downstream use
  if (!input.data) input.data = {};

  logger.debug("[Engine2] Validation complete");
  return input;
}

async function runEngine2(input) {
  const jobId = uuidv4();
  const engine = "engine2-content";

  try {
    logger.info(`[Engine2] Starting execution with jobId: ${jobId}`);

    // Input Validation with fallback
    const validatedInput = await validateInput(input);

    // Fetch AI Response with fallback
    let normalizedData;
    try {
      logger.info("[Engine2] Attempting real AI content generation...");
      const aiContent = await generateContent(validatedInput);

      // Standardize result
      normalizedData = {
        hooks: aiContent.hooks || [],
        captions: aiContent.captions || [],
        reelsScripts: aiContent.reelsScripts || [],
        adCopies: aiContent.adCopies || [],
        ctas: aiContent.ctas || [],
        imagePlan: normalizeImagePlan(aiContent.imagePlan, aiContent)
      };

      // Validate Output Structure
      if (!normalizedData.captions.length && !normalizedData.reelsScripts.length) {
        logger.warn("[Engine2] Invalid content structure, using fallback");
        throw new Error("Invalid content structure: No captions or reels found");
      }

      logger.info("[Engine2] Real AI content generated successfully");
    } catch (aiError) {
      logger.warn(`[Engine2] Real AI content failed, using fallback content: ${aiError.message}`);
      logger.info("[Engine2] Fallback trigger: AI content generation error");

      // Fallback content data
      normalizedData = {
        hooks: [
          "Limited time offer 🔥",
          "Best in town 🏆",
          "You won't believe this 😱",
          "Try now and save! 💰",
          "Don't miss out! ⏰"
        ],
        captions: [
          "🔥 Limited time offer! Don't miss out on our amazing deals! Visit us today and taste the difference! #foodie #delicious #yummy",
          "🏆 Best in town! Our customers love us and you will too! Come experience the magic! #bestintown #amazingfood #musttry",
          "😱 You won't believe this taste! Our secret recipes will blow your mind! Book your table now! #mindblowing #secretrecipe #foodlover"
        ],
        reelsScripts: [
          "Welcome to our amazing place! Let me show you around... Here's what makes us special... You won't believe this taste!",
          "Here's what makes us special... Fresh ingredients, amazing flavors, and unforgettable experiences! Try us today!",
          "You won't believe this taste! Our signature dishes are crafted with love and served with passion. Visit us now!"
        ],
        adCopies: [
          "🎉 Get 20% off your first order! Limited time only! Use code: WELCOME20. Order now and taste the difference!",
          "⭐ Rated #1 in town! Join thousands of happy customers! Book your table today and experience excellence!",
          "🚀 Experience the difference today! Fresh ingredients, amazing flavors, unforgettable moments. Don't wait!"
        ],
        ctas: [
          "Order now! 🛒",
          "Visit us today! 📍",
          "Book your table! 📞",
          "Try our special! 🍽️",
          "Follow for more! ❤️"
        ]
      };
      normalizedData.imagePlan = normalizeImagePlan(null, normalizedData);
    }

    // Log Success (non-blocking)
    logInfo({
      jobId,
      engine,
      status: "success",
      input: validatedInput,
      output: normalizedData,
    }).catch(err => {
      logger.error(`[Engine2] Failed to log success: ${err.message}`);
    });

    logger.info("[Engine2] Execution completed successfully");

    // Ensure final data structure is present
    return {
      success: true,
      engine,
      jobId,
      data: normalizedData,
      error: null,
    };
  } catch (error) {
    logger.error(`[Engine2] Error: ${error.message}`, { stack: error.stack });

    // Log Error Event (non-blocking)
    logInfo({
      jobId,
      engine,
      status: "error",
      input,
      error: error.message,
    }).catch(err => {
      logger.error(`[Engine2] Failed to log error: ${err.message}`);
    });

    // Return fallback data instead of failure to keep pipeline running
    logger.warn("[Engine2] Returning fallback content to keep pipeline running");
    return {
      success: true,
      engine,
      jobId,
      data: {
        captions: ["Default caption 1", "Default caption 2"],
        reelsScripts: ["Default script 1", "Default script 2"],
        adCopies: ["Default ad copy 1", "Default ad copy 2"],
        hooks: ["Default hook 1", "Default hook 2"],
        ctas: ["Default CTA 1", "Default CTA 2"],
        imagePlan: normalizeImagePlan(null, { hooks: ["Default hook 1", "Default hook 2"] })
      },
      error: null,
    };
  }
}
module.exports = runEngine2;