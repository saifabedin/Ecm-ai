const { generateAIResponse } = require("../ai/openrouter.cjs");
const { logInfo } = require("../db/logs.cjs");
const { uuidv4 } = require("../utils/uuid.cjs");
const logger = require("../utils/logger.cjs");

// Constants
const MAX_RETRIES = 3;
const MAX_AD_VARIANTS = 3;

// Generate AI-powered ad campaigns
async function generateAdCampaigns(input) {
  logger.info("[Engine6] Generating AI-powered ad campaigns...");

  const research = input.research || {};
  // Engine 2 merges hooks/adCopies at the top level of state; fall back to a
  // nested `content` object just in case. Stringify any object entries so the
  // prompt never gets a literal "[object Object]".
  const toText = (arr) => (Array.isArray(arr) ? arr : [])
    .map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
    .join(", ");
  const hooks = toText(input.hooks || input.content?.hooks);
  const adCopies = toText(input.adCopies || input.content?.adCopies);
  const business = input.businessName || input.business || 'Unknown Business';
  const platform = input.platform || 'instagram';
  const goal = input.goal || 'Increase brand awareness';

  const adPrompt = `You are a world-class digital advertising strategist. Generate comprehensive ad campaigns for:

Business: ${business}
Platform: ${platform}
Goal: ${goal}

Use this research data:
- Target Audience: ${JSON.stringify(research.TargetAudiencePsychology || {})}
- Competitor Strategy: ${JSON.stringify(research.CompetitorStrategy || {})}
- High-Converting Ad Angles: ${JSON.stringify(research.HighConvertingAdAngles || [])}

Available hooks: ${hooks}
Available ad copies: ${adCopies}

Return ONLY valid JSON with this exact structure:
{
  "metaAds": {
    "campaignName": "campaign name",
    "objective": "awareness/conversion/traffic",
    "budget": {
      "daily": 50,
      "lifetime": 1500,
      "currency": "USD"
    },
    "adSets": [
      {
        "name": "ad set name",
        "targeting": {
          "age": ["18-24", "25-34", "35-44"],
          "gender": ["male", "female"],
          "interests": ["interest1", "interest2"],
          "behaviors": ["behavior1"],
          "locations": ["location1"]
        },
        "budget": {
          "daily": 25
        },
        "schedule": {
          "startDate": "2026-04-29",
          "endDate": "2026-05-29"
        }
      }
    ],
    "creatives": [
      {
        "name": "creative name",
        "format": "image/video/carousel",
        "headline": "headline text",
        "primaryText": "main ad copy",
        "callToAction": "Learn More/Shop Now/Sign Up",
        "imageUrl": "image_url",
        "thumbnailUrl": "thumbnail_url"
      }
    ]
  },
  "googleAds": {
    "campaignName": "campaign name",
    "type": "Search/Display/Video",
    "budget": {
      "daily": 50,
      "currency": "USD"
    },
    "adGroups": [
      {
        "name": "ad group name",
        "keywords": ["keyword1", "keyword2", "keyword3"],
        "negativeKeywords": ["negative1", "negative2"],
        "maxCPC": 2.50
      }
    ],
    "ads": [
      {
        "type": "Responsive Search Ad",
        "headlines": ["headline1", "headline2", "headline3"],
        "descriptions": ["description1", "description2"],
        "displayUrl": "example.com",
        "finalUrl": "https://example.com"
      }
    ]
  },
  "optimization": {
    "suggestedABTests": [
      {
        "testName": "test name",
        "variants": ["variant1", "variant2"],
        "metric": "CTR/Conversion/Cost",
        "duration": "7 days"
      }
    ],
    "budgetRecommendations": {
      "initial": 50,
      "scaling": "Increase by 20% if ROAS > 3.0",
      "reduction": "Decrease by 15% if ROAS < 1.5"
    },
    "targetingAdjustments": {
      "expand": ["audience1", "audience2"],
      "exclude": ["audience3"]
    }
  }
}

Requirements:
- Campaign names should be catchy and relevant
- Targeting should be specific to the business
- Budgets should be realistic for the business size
- A/B tests should focus on key performance metrics
- Include specific optimization recommendations

Do NOT include markdown, backticks, or any explanation. Return ONLY the JSON.`;

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.info(`[Engine6] Sending ad generation request to AI (attempt ${attempt}/${MAX_RETRIES})...`);
      const aiResponse = await generateAIResponse({
        prompt: adPrompt,
        model: "openai/gpt-4o-mini",
        temperature: 0.7
      });
      logger.info(`[Engine6] AI ad response received, length: ${aiResponse?.length}`);

      // Parse AI response safely
      const startIdx = aiResponse.indexOf('{');
      const endIdx = aiResponse.lastIndexOf('}') + 1;

      if (startIdx === -1 || endIdx === 0) {
        throw new Error("No JSON found in AI response");
      }

      const cleaned = aiResponse.substring(startIdx, endIdx).trim();
      const parsed = JSON.parse(cleaned);

      // Validate structure
      if (!parsed.metaAds || !parsed.googleAds) {
        throw new Error("Invalid AI response structure - missing required fields");
      }

      logger.info("[Engine6] AI ad campaigns generated successfully");
      logger.info(`[Engine6] Generated campaigns for: ${Object.keys(parsed).join(', ')}`);

      return parsed;

    } catch (error) {
      lastError = error;
      logger.error(`[Engine6] AI ad generation attempt ${attempt} failed: ${error.message}`);
    }
  }

  logger.error(`[Engine6] AI ad generation failed after ${MAX_RETRIES} attempts`);
  throw lastError;
}

// Generate optimization suggestions based on performance metrics
function generateOptimizationSuggestions(metrics) {
  logger.info("[Engine6] Analyzing performance metrics for optimization...");

  const suggestions = [];

  // CTR Analysis
  if (metrics.ctr < 1.0) {
    suggestions.push({
      type: "creative",
      priority: "high",
      issue: "Low CTR detected",
      recommendation: "Test new hooks and headlines",
      actionItems: [
        "Create 3 new headline variants",
        "A/B test different call-to-actions",
        "Refresh ad creative with new images"
      ]
    });
  }

  // Engagement Analysis
  if (metrics.engagementRate < 2.0) {
    suggestions.push({
      type: "creative",
      priority: "medium",
      issue: "Low engagement rate",
      recommendation: "Improve ad creative quality",
      actionItems: [
        "Use higher-quality images",
        "Add video content",
        "Test carousel formats"
      ]
    });
  }

  // Conversion Analysis
  if (metrics.conversionRate < 1.5) {
    suggestions.push({
      type: "landing",
      priority: "high",
      issue: "Low conversion rate",
      recommendation: "Optimize landing page",
      actionItems: [
        "Improve page load speed",
        "Simplify form fields",
        "Add social proof elements"
      ]
    });
  }

  // CPC Analysis
  if (metrics.cpc > metrics.targetCPC * 1.5) {
    suggestions.push({
      type: "targeting",
      priority: "medium",
      issue: "High CPC detected",
      recommendation: "Refine audience targeting",
      actionItems: [
        "Exclude low-performing audiences",
        "Test narrower audience segments",
        "Adjust bid strategy"
      ]
    });
  }

  // ROAS Analysis
  if (metrics.roas < 1.5) {
    suggestions.push({
      type: "budget",
      priority: "high",
      issue: "Low ROAS detected",
      recommendation: "Adjust budget allocation",
      actionItems: [
        "Reduce budget for underperforming ads",
        "Increase budget for top performers",
        "Pause ads with ROAS < 1.0"
      ]
    });
  }

  logger.info(`[Engine6] Generated ${suggestions.length} optimization suggestions`);
  return suggestions;
}

// Validate input and add defaults
async function validateInput(input) {
  logger.debug(`[Engine6] Input received: ${JSON.stringify(input)}`);

  // Prefer real performance metrics from Engine 7 (state.campaignMetrics),
  // then any explicitly-passed metrics, then conservative defaults. Using the
  // real numbers means optimization suggestions reflect actual performance
  // instead of always firing on hardcoded low values.
  const m = { ...(input.campaignMetrics || {}), ...(input.metrics || {}) };
  const num = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : d);

  // Add default values for missing fields
  const defaults = {
    brandId: input.brandId || "default-brand",
    businessName: input.businessName || input.business || "Default Business",
    platform: input.platform || "instagram",
    goal: input.goal || "Increase brand awareness",
    metrics: {
      ctr: num(m.ctr, 0.5),
      engagementRate: num(m.engagementRate, 1.0),
      conversionRate: num(m.conversionRate, 1.0),
      cpc: num(m.cpc, 2.0),
      targetCPC: num(m.targetCPC, 1.5),
      roas: num(m.roas, 1.0)
    }
  };

  // Merge defaults with input
  Object.assign(input, defaults);

  logger.debug(`[Engine6] Validated input: ${JSON.stringify(input)}`);
  return input;
}

// Main engine function
async function runEngine6(input) {
  const jobId = uuidv4();
  const engine = "engine6-ads";

  try {
    logger.info(`[Engine6] Starting execution with jobId: ${jobId}`);

    // Input Validation with defaults
    const validatedInput = await validateInput(input);

    // Generate AI-powered ad campaigns
    let adCampaigns;
    try {
      logger.info("[Engine6] Attempting AI ad campaign generation...");
      adCampaigns = await generateAdCampaigns(validatedInput);
      logger.info("[Engine6] AI ad campaigns generated successfully");
    } catch (aiError) {
      logger.warn(`[Engine6] AI ad generation failed, using fallback campaigns: ${aiError.message}`);
      logger.info("[Engine6] Fallback trigger: AI ad generation error");

      // Fallback ad campaigns
      adCampaigns = {
        metaAds: {
          campaignName: `${validatedInput.businessName} - Brand Awareness`,
          objective: "awareness",
          budget: {
            daily: 50,
            lifetime: 1500,
            currency: "USD"
          },
          adSets: [
            {
              name: "Core Audience - 18-34",
              targeting: {
                age: ["18-24", "25-34"],
                gender: ["male", "female"],
                interests: ["food", "dining", "restaurants"],
                behaviors: ["engaged_shoppers"],
                locations: ["United States"]
              },
              budget: {
                daily: 25
              },
              schedule: {
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
              }
            },
            {
              name: "Lookalike Audience",
              targeting: {
                age: ["25-44"],
                gender: ["male", "female"],
                interests: ["local businesses", "food delivery"],
                behaviors: ["mobile purchasers"],
                locations: ["United States"]
              },
              budget: {
                daily: 25
              },
              schedule: {
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
              }
            }
          ],
          creatives: [
            {
              name: "Hero Image - Product Showcase",
              format: "image",
              headline: "Experience the Best",
              primaryText: "Discover amazing products that will transform your life. Limited time offer!",
              callToAction: "Shop Now",
              imageUrl: validatedInput.images?.[0] || null,
              thumbnailUrl: validatedInput.images?.[0] || null
            },
            {
              name: "Carousel - Product Collection",
              format: "carousel",
              headline: "Our Best Sellers",
              primaryText: "Explore our top-rated products loved by thousands of customers.",
              callToAction: "Learn More",
              imageUrl: validatedInput.images?.[1] || validatedInput.images?.[0] || null,
              thumbnailUrl: validatedInput.images?.[1] || validatedInput.images?.[0] || null
            }
          ]
        },
        googleAds: {
          campaignName: `${validatedInput.businessName} - Search Campaign`,
          type: "Search",
          budget: {
            daily: 50,
            currency: "USD"
          },
          adGroups: [
            {
              name: "Brand Keywords",
              keywords: ["best products", "quality products", "top rated products"],
              negativeKeywords: ["free", "cheap", "discount"],
              maxCPC: 2.50
            },
            {
              name: "Competitor Keywords",
              keywords: ["alternatives to competitors", "better than competitors"],
              negativeKeywords: ["reviews", "complaints"],
              maxCPC: 3.00
            }
          ],
          ads: [
            {
              type: "Responsive Search Ad",
              headlines: [
                "Best Products Online",
                "Quality You Can Trust",
                "Shop with Confidence"
              ],
              descriptions: [
                "Discover our amazing collection of products",
                "Free shipping on orders over $50",
                "Rated 5 stars by our customers"
              ],
              displayUrl: "example.com/products",
              finalUrl: "https://example.com/products"
            }
          ]
        },
        optimization: {
          suggestedABTests: [
            {
              testName: "Headline A/B Test",
              variants: ["Experience the Best", "Discover Quality"],
              metric: "CTR",
              duration: "7 days"
            },
            {
              testName: "Creative Format Test",
              variants: ["Single Image", "Carousel"],
              metric: "Conversion",
              duration: "14 days"
            }
          ],
          budgetRecommendations: {
            initial: 50,
            scaling: "Increase by 20% if ROAS > 3.0",
            reduction: "Decrease by 15% if ROAS < 1.5"
          },
          targetingAdjustments: {
            expand: ["Lookalike audiences", "Interest-based targeting"],
            exclude: ["Low-engagement segments"]
          }
        }
      };
    }

    // Generate optimization suggestions based on metrics
    const optimizationSuggestions = generateOptimizationSuggestions(validatedInput.metrics);

    // Combine campaigns with optimization suggestions
    const finalOutput = {
      ...adCampaigns,
      performanceAnalysis: {
        currentMetrics: validatedInput.metrics,
        optimizationSuggestions: optimizationSuggestions,
        nextSteps: optimizationSuggestions.map(s => s.actionItems).flat()
      }
    };

    // Log Success (non-blocking)
    logInfo({
      jobId,
      engine,
      status: "success",
      tenant_id: validatedInput.brandId,
      input: validatedInput,
      output: finalOutput,
    }).catch(err => {
      logger.error(`[Engine6] Failed to log success: ${err.message}`);
    });

    logger.info("[Engine6] Execution completed successfully");
    logger.info(`[Engine6] Generated ${optimizationSuggestions.length} optimization suggestions`);

    // Standardized Output
    return {
      success: true,
      engine,
      jobId,
      data: finalOutput,
      error: null,
    };
  } catch (error) {
    logger.error(`[Engine6] Error: ${error.message}`);

    // Log Error Event (non-blocking)
    logInfo({
      jobId,
      engine,
      status: "error",
      tenant_id: input.brandId || "default-brand",
      input,
      error: error.message,
    }).catch(err => {
      logger.error(`[Engine6] Failed to log error: ${err.message}`);
    });

    // Return fallback data to keep pipeline running, but flag the degradation
    // so callers/logs don't mistake an empty fallback for a real success.
    logger.warn("[Engine6] Returning fallback ad campaigns (DEGRADED) to keep pipeline running");
    return {
      success: false,
      degraded: true,
      engine,
      jobId,
      error: error.message,
      data: {
        metaAds: {
          campaignName: "Fallback Campaign",
          objective: "awareness",
          budget: { daily: 25, lifetime: 750, currency: "USD" },
          adSets: [],
          creatives: []
        },
        googleAds: {
          campaignName: "Fallback Google Campaign",
          type: "Search",
          budget: { daily: 25, currency: "USD" },
          adGroups: [],
          ads: []
        },
        optimization: {
          suggestedABTests: [],
          budgetRecommendations: {},
          targetingAdjustments: {}
        },
        performanceAnalysis: {
          currentMetrics: {},
          optimizationSuggestions: [],
          nextSteps: []
        }
      },
    };
  }
}

module.exports = runEngine6;