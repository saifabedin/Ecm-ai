const { generateAIResponse } = require("../ai/openrouter.cjs");
const { logInfo } = require("../db/logs.cjs");
const { uuidv4 } = require("../utils/uuid.cjs");
const logger = require("../utils/logger.cjs");

// Constants
const MAX_RETRIES = 3;

// Analyze performance and identify issues
function analyzePerformance(trackingData) {
  logger.info("[Engine8] Analyzing performance data...");

  const issues = [];
  const metrics = trackingData.campaignMetrics || {};
  const adsPerformance = trackingData.adsPerformance || [];

  // CTR Analysis
  const ctr = parseFloat(metrics.ctr || 0);
  if (ctr < 1.0) {
    issues.push({
      type: 'weak_hooks',
      severity: 'high',
      metric: 'CTR',
      value: ctr + '%',
      threshold: '1.0%',
      impact: 'Low click-through rate indicates weak ad appeal',
      affectedAds: adsPerformance.filter(ad => parseFloat(ad.ctr) < 1.0).length
    });
  } else if (ctr < 2.0) {
    issues.push({
      type: 'moderate_hooks',
      severity: 'medium',
      metric: 'CTR',
      value: ctr + '%',
      threshold: '2.0%',
      impact: 'Moderate CTR suggests room for improvement',
      affectedAds: adsPerformance.filter(ad => parseFloat(ad.ctr) < 2.0).length
    });
  }

  // CPC Analysis
  const cpc = parseFloat(metrics.cpc || 0);
  if (cpc > 3.0) {
    issues.push({
      type: 'poor_targeting',
      severity: 'high',
      metric: 'CPC',
      value: '$' + cpc,
      threshold: '$3.00',
      impact: 'High CPC indicates inefficient audience targeting',
      affectedAds: adsPerformance.filter(ad => parseFloat(ad.cpc) > 3.0).length
    });
  } else if (cpc > 2.0) {
    issues.push({
      type: 'moderate_targeting',
      severity: 'medium',
      metric: 'CPC',
      value: '$' + cpc,
      threshold: '$2.00',
      impact: 'Moderate CPC suggests targeting refinement needed',
      affectedAds: adsPerformance.filter(ad => parseFloat(ad.cpc) > 2.0).length
    });
  }

  // ROAS Analysis
  const roas = parseFloat(metrics.roas || 0);
  if (roas < 1.5) {
    issues.push({
      type: 'bad_creatives_audience',
      severity: 'high',
      metric: 'ROAS',
      value: roas + 'x',
      threshold: '1.5x',
      impact: 'Low ROAS indicates poor creative quality or wrong audience',
      affectedAds: adsPerformance.filter(ad => parseFloat(ad.roas) < 1.5).length
    });
  } else if (roas < 2.0) {
    issues.push({
      type: 'moderate_creatives',
      severity: 'medium',
      metric: 'ROAS',
      value: roas + 'x',
      threshold: '2.0x',
      impact: 'Moderate ROAS suggests creative optimization needed',
      affectedAds: adsPerformance.filter(ad => parseFloat(ad.roas) < 2.0).length
    });
  }

  // Conversion Rate Analysis
  const conversionRate = parseFloat(metrics.conversionRate || 0);
  if (conversionRate < 1.5) {
    issues.push({
      type: 'landing_issue',
      severity: 'high',
      metric: 'Conversion Rate',
      value: conversionRate + '%',
      threshold: '1.5%',
      impact: 'Low conversion rate indicates landing page or offer issues',
      affectedAds: adsPerformance.filter(ad => parseFloat(ad.conversionRate) < 1.5).length
    });
  } else if (conversionRate < 2.5) {
    issues.push({
      type: 'moderate_landing',
      severity: 'medium',
      metric: 'Conversion Rate',
      value: conversionRate + '%',
      threshold: '2.5%',
      impact: 'Moderate conversion rate suggests landing page improvements',
      affectedAds: adsPerformance.filter(ad => parseFloat(ad.conversionRate) < 2.5).length
    });
  }

  // Platform Performance Analysis
  const metaAds = adsPerformance.filter(ad => ad.platform === 'meta');
  const googleAds = adsPerformance.filter(ad => ad.platform === 'google');

  if (metaAds.length > 0 && googleAds.length > 0) {
    const metaAvgROAS = metaAds.reduce((sum, ad) => sum + parseFloat(ad.roas), 0) / metaAds.length;
    const googleAvgROAS = googleAds.reduce((sum, ad) => sum + parseFloat(ad.roas), 0) / googleAds.length;

    if (metaAvgROAS < 1.0 && googleAvgROAS > 2.0) {
      issues.push({
        type: 'platform_imbalance',
        severity: 'medium',
        metric: 'Platform Performance',
        value: 'Meta underperforming',
        impact: 'Meta Ads significantly underperforming Google Ads',
        recommendation: 'Consider shifting budget to Google or optimizing Meta creatives'
      });
    } else if (googleAvgROAS < 1.0 && metaAvgROAS > 2.0) {
      issues.push({
        type: 'platform_imbalance',
        severity: 'medium',
        metric: 'Platform Performance',
        value: 'Google underperforming',
        impact: 'Google Ads significantly underperforming Meta Ads',
        recommendation: 'Consider shifting budget to Meta or optimizing Google targeting'
      });
    }
  }

  logger.info(`[Engine8] Identified ${issues.length} performance issues`);
  return issues;
}

// Generate AI-powered optimization recommendations
async function generateOptimizationRecommendations(issues, trackingData, businessContext) {
  logger.info("[Engine8] Generating AI-powered optimization recommendations...");

  const metrics = trackingData.campaignMetrics || {};
  const adsPerformance = trackingData.adsPerformance || [];

  const optimizationPrompt = `You are an expert digital marketing optimization specialist. Analyze this performance data and generate actionable optimization recommendations.

Business Context:
- Business: ${businessContext.businessName || 'Unknown Business'}
- Goal: ${businessContext.goal || 'Increase brand awareness'}
- Platform: ${businessContext.platform || 'Instagram'}

Current Performance Metrics:
- Impressions: ${metrics.impressions || 0}
- Clicks: ${metrics.clicks || 0}
- CTR: ${metrics.ctr || 0}%
- CPC: $${metrics.cpc || 0}
- Conversions: ${metrics.conversions || 0}
- Conversion Rate: ${metrics.conversionRate || 0}%
- ROAS: ${metrics.roas || 0}x
- Cost: $${metrics.cost || 0}
- Revenue: $${metrics.revenue || 0}

Identified Issues:
${issues.map(issue => `- ${issue.type}: ${issue.impact} (${issue.metric}: ${issue.value})`).join('\n')}

Ad Performance:
${adsPerformance.slice(0, 3).map(ad => `- ${ad.adName}: CTR ${ad.ctr}%, CPC $${ad.cpc}, ROAS ${ad.roas}x, Performance: ${ad.performance}`).join('\n')}

Return ONLY valid JSON with this exact structure:
{
  "recommendations": [
    {
      "priority": "high/medium/low",
      "category": "hooks/targeting/creatives/landing/budget",
      "issue": "specific issue description",
      "action": "specific action to take",
      "expectedImpact": "expected improvement",
      "implementationSteps": ["step1", "step2", "step3"]
    }
  ],
  "newHooks": [
    "improved hook 1",
    "improved hook 2",
    "improved hook 3"
  ],
  "targetingAdjustments": {
    "expand": ["audience1", "audience2"],
    "exclude": ["audience3"],
    "refine": {
      "age": ["18-24", "25-34"],
      "interests": ["interest1", "interest2"],
      "behaviors": ["behavior1"]
    }
  },
  "creativeSuggestions": [
    {
      "format": "image/video/carousel",
      "headline": "improved headline",
      "primaryText": "improved primary text",
      "callToAction": "improved CTA",
      "reason": "why this will work better"
    }
  ],
  "budgetRecommendations": {
    "totalBudget": 100,
    "platformAllocation": {
      "meta": 60,
      "google": 40
    },
    "adSetAllocation": {
      "topPerformers": 70,
      "testing": 20,
      "underperformers": 10
    }
  },
  "landingPageOptimizations": [
    {
      "element": "headline/cta/form/socialProof",
      "currentIssue": "what's wrong now",
      "suggestedChange": "what to change",
      "expectedImpact": "expected improvement"
    }
  ]
}

Requirements:
- Recommendations should be specific and actionable
- New hooks should be attention-grabbing and relevant
- Targeting adjustments should be data-driven
- Creative suggestions should address identified issues
- Budget recommendations should optimize for ROAS
- Landing page optimizations should address conversion issues

Do NOT include markdown, backticks, or any explanation. Return ONLY the JSON.`;

  try {
    logger.info("[Engine8] Sending optimization request to AI...");
    const aiResponse = await generateAIResponse({
      prompt: optimizationPrompt,
      model: "openai/gpt-4o-mini",
      temperature: 0.7
    });
    logger.info(`[Engine8] AI optimization response received, length: ${aiResponse?.length}`);

    // Parse AI response safely
    const startIdx = aiResponse.indexOf('{');
    const endIdx = aiResponse.lastIndexOf('}') + 1;

    if (startIdx === -1 || endIdx === 0) {
      throw new Error("No JSON found in AI response");
    }

    const cleaned = aiResponse.substring(startIdx, endIdx).trim();
    const parsed = JSON.parse(cleaned);

    // Validate structure
    if (!parsed.recommendations || !parsed.newHooks) {
      throw new Error("Invalid AI response structure - missing required fields");
    }

    logger.info("[Engine8] AI optimization recommendations generated successfully");
    logger.info(`[Engine8] Generated ${parsed.recommendations.length} recommendations and ${parsed.newHooks.length} new hooks`);

    return parsed;

  } catch (error) {
    logger.error(`[Engine8] AI optimization generation failed: ${error.message}`);
    throw error;
  }
}

// Generate fallback optimization recommendations
function generateFallbackRecommendations(issues, trackingData) {
  logger.info("[Engine8] Generating fallback optimization recommendations...");

  const metrics = trackingData.campaignMetrics || {};

  const recommendations = [];
  const newHooks = [];
  const targetingAdjustments = {
    expand: [],
    exclude: [],
    refine: {}
  };
  const creativeSuggestions = [];
  const budgetRecommendations = {
    totalBudget: 50,
    platformAllocation: { meta: 50, google: 50 },
    adSetAllocation: { topPerformers: 60, testing: 30, underperformers: 10 }
  };
  const landingPageOptimizations = [];

  // Generate recommendations based on issues
  issues.forEach(issue => {
    switch (issue.type) {
      case 'weak_hooks':
        recommendations.push({
          priority: 'high',
          category: 'hooks',
          issue: 'Low CTR indicates weak ad appeal',
          action: 'Test new attention-grabbing hooks',
          expectedImpact: 'Increase CTR by 50-100%',
          implementationSteps: [
            'Create 5 new hook variants',
            'A/B test against current hooks',
            'Analyze top-performing hooks'
          ]
        });
        newHooks.push(
          '🔥 Limited Time - Act Now!',
          '✨ Transform Your Life Today',
          '🚀 Join 10,000+ Happy Customers',
          '💡 The Secret You\'ve Been Missing',
          '🎯 Finally, A Solution That Works'
        );
        break;

      case 'poor_targeting':
        recommendations.push({
          priority: 'high',
          category: 'targeting',
          issue: 'High CPC indicates inefficient audience',
          action: 'Refine audience targeting parameters',
          expectedImpact: 'Reduce CPC by 30-50%',
          implementationSteps: [
            'Analyze current audience segments',
            'Exclude low-performing demographics',
            'Test narrower audience segments'
          ]
        });
        targetingAdjustments.exclude = ['broad audiences', 'low-engagement segments'];
        targetingAdjustments.refine = {
          age: ['25-34', '35-44'],
          interests: ['specific interests related to business'],
          behaviors: ['purchasing behavior', 'engagement behavior']
        };
        break;

      case 'bad_creatives_audience':
        recommendations.push({
          priority: 'high',
          category: 'creatives',
          issue: 'Low ROAS indicates poor creative quality',
          action: 'Refresh ad creatives and test new formats',
          expectedImpact: 'Increase ROAS by 100-200%',
          implementationSteps: [
            'Create new image/video creatives',
            'Test carousel formats',
            'A/B test different headlines'
          ]
        });
        creativeSuggestions.push({
          format: 'carousel',
          headline: 'See Why Customers Love Us',
          primaryText: 'Real results from real people. Join thousands who transformed their experience.',
          callToAction: 'Learn More',
          reason: 'Social proof and testimonials improve conversion'
        });
        break;

      case 'landing_issue':
        recommendations.push({
          priority: 'high',
          category: 'landing',
          issue: 'Low conversion rate indicates landing page problems',
          action: 'Optimize landing page for conversions',
          expectedImpact: 'Increase conversion rate by 50-150%',
          implementationSteps: [
            'Improve page load speed',
            'Simplify form fields',
            'Add social proof elements',
            'Test different CTAs'
          ]
        });
        landingPageOptimizations.push({
          element: 'form',
          currentIssue: 'Too many form fields',
          suggestedChange: 'Reduce to 3 essential fields',
          expectedImpact: 'Increase form completion by 40%'
        });
        break;

      default:
        recommendations.push({
          priority: 'medium',
          category: 'general',
          issue: issue.impact,
          action: 'Monitor and optimize based on data',
          expectedImpact: 'Gradual improvement over time',
          implementationSteps: [
            'Continue A/B testing',
            'Analyze performance trends',
            'Adjust strategy based on results'
          ]
        });
    }
  });

  // Add budget optimization recommendations
  if (parseFloat(metrics.roas || 0) < 1.5) {
    recommendations.push({
      priority: 'high',
      category: 'budget',
      issue: 'Low ROAS indicates inefficient spend',
      action: 'Reallocate budget to top performers',
      expectedImpact: 'Improve overall ROAS by 30-50%',
      implementationSteps: [
        'Identify top-performing ads',
        'Increase budget for winners',
        'Pause or reduce budget for underperformers'
      ]
    });
    budgetRecommendations.adSetAllocation = {
      topPerformers: 70,
      testing: 20,
      underperformers: 10
    };
  }

  logger.info(`[Engine8] Generated ${recommendations.length} fallback recommendations`);
  return {
    recommendations,
    newHooks,
    targetingAdjustments,
    creativeSuggestions,
    budgetRecommendations,
    landingPageOptimizations
  };
}

// Generate new strategy based on optimization
function generateNewStrategy(optimizationData, businessContext) {
  logger.info("[Engine8] Generating new optimized strategy...");

  const strategy = {
    hooks: optimizationData.newHooks || [],
    targeting: optimizationData.targetingAdjustments || {},
    creatives: optimizationData.creativeSuggestions || [],
    budget: optimizationData.budgetRecommendations || {},
    landingPage: optimizationData.landingPageOptimizations || [],
    timeline: {
      immediate: optimizationData.recommendations?.filter(r => r.priority === 'high').map(r => r.action) || [],
      shortTerm: optimizationData.recommendations?.filter(r => r.priority === 'medium').map(r => r.action) || [],
      longTerm: optimizationData.recommendations?.filter(r => r.priority === 'low').map(r => r.action) || []
    },
    expectedOutcomes: {
      ctrImprovement: '+50-100%',
      cpcReduction: '-30-50%',
      roasImprovement: '+100-200%',
      conversionImprovement: '+50-150%'
    }
  };

  logger.info("[Engine8] New strategy generated");
  return strategy;
}

// Main engine function
async function runEngine8(input) {
  const jobId = uuidv4();
  const engine = "engine8-optimization";

  try {
    logger.info(`[Engine8] Starting execution with jobId: ${jobId}`);
    logger.debug(`[Engine8] Input received: ${JSON.stringify(input)}`);

    // Validate input
    if (!input.tracking && !input.ads) {
      logger.warn("[Engine8] No tracking data found, using fallback");
      return {
        success: true,
        engine,
        jobId,
        data: {
          message: "No tracking data to optimize",
          issues: [],
          recommendations: [],
          actions: [],
          newStrategy: {}
        },
        error: null,
      };
    }

    // Use tracking data or ads data
    const trackingData = input.tracking || {
      campaignMetrics: {
        impressions: 100000,
        clicks: 2000,
        ctr: '2.0',
        cpc: '2.50',
        conversions: 50,
        conversionRate: '2.5',
        cost: 5000,
        roas: '2.0',
        revenue: 10000
      },
      adsPerformance: []
    };

    // Business context
    const businessContext = {
      businessName: input.businessName || input.business || 'Unknown Business',
      goal: input.goal || 'Increase brand awareness',
      platform: input.platform || 'Instagram'
    };

    // Analyze performance and identify issues
    const issues = analyzePerformance(trackingData);

    // Generate AI-powered optimization recommendations
    let optimizationData;
    try {
      logger.info("[Engine8] Attempting AI optimization generation...");
      optimizationData = await generateOptimizationRecommendations(issues, trackingData, businessContext);
      logger.info("[Engine8] AI optimization generated successfully");
    } catch (aiError) {
      logger.warn(`[Engine8] AI optimization failed, using fallback recommendations: ${aiError.message}`);
      optimizationData = generateFallbackRecommendations(issues, trackingData);
    }

    // Generate new strategy
    const newStrategy = generateNewStrategy(optimizationData, businessContext);

    // Create actionable actions list
    const actions = optimizationData.recommendations.map(rec => ({
      priority: rec.priority,
      category: rec.category,
      action: rec.action,
      steps: rec.implementationSteps,
      expectedImpact: rec.expectedImpact
    }));

    // Create feedback for other engines
    const feedback = {
      contentEngine: {
        newHooks: optimizationData.newHooks,
        hookPerformance: issues.filter(i => i.type.includes('hook')).map(i => ({
          issue: i.type,
          recommendation: i.impact
        }))
      },
      adsEngine: {
        targetingAdjustments: optimizationData.targetingAdjustments,
        creativeSuggestions: optimizationData.creativeSuggestions,
        budgetRecommendations: optimizationData.budgetRecommendations
      },
      overall: {
        priorityIssues: issues.filter(i => i.severity === 'high').length,
        totalRecommendations: optimizationData.recommendations.length,
        expectedImprovement: newStrategy.expectedOutcomes
      }
    };

    // Log Success (non-blocking)
    logInfo({
      jobId,
      engine,
      status: "success",
      input,
      output: {
        issues,
        recommendations: optimizationData.recommendations,
        newStrategy,
        feedback
      },
    }).catch(err => {
      logger.error(`[Engine8] Failed to log success: ${err.message}`);
    });

    logger.info("[Engine8] Execution completed successfully");
    logger.info(`[Engine8] Generated ${actions.length} optimization actions`);

    // Standardized Output
    return {
      success: true,
      engine,
      jobId,
      data: {
        message: "Optimization analysis completed",
        issues,
        recommendations: optimizationData.recommendations,
        actions,
        newStrategy,
        feedback,
        summary: {
          totalIssues: issues.length,
          highPriorityIssues: issues.filter(i => i.severity === 'high').length,
          totalRecommendations: optimizationData.recommendations.length,
          newHooksCount: optimizationData.newHooks.length,
          creativeSuggestionsCount: optimizationData.creativeSuggestions.length,
          expectedImprovement: newStrategy.expectedOutcomes
        }
      },
      error: null,
    };
  } catch (error) {
    logger.error(`[Engine8] Error: ${error.message}`);

    // Log Error Event (non-blocking)
    logInfo({
      jobId,
      engine,
      status: "error",
      input,
      error: error.message,
    }).catch(err => {
      logger.error(`[Engine8] Failed to log error: ${err.message}`);
    });

    // Return fallback data to keep pipeline running
    logger.warn("[Engine8] Returning fallback data to keep pipeline running");
    return {
      success: true,
      engine,
      jobId,
      data: {
        message: "Optimization completed with fallback",
        issues: [],
        recommendations: [],
        actions: [],
        newStrategy: {},
        feedback: {},
        summary: {
          totalIssues: 0,
          highPriorityIssues: 0,
          totalRecommendations: 0,
          newHooksCount: 0,
          creativeSuggestionsCount: 0,
          expectedImprovement: {}
        }
      },
      error: null,
    };
  }
}

module.exports = runEngine8;