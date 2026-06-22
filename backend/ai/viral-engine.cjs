/**
 * Viral Optimization Engine
 *
 * Analyzes content BEFORE rendering and improves viral performance potential.
 * Runs after script extraction and story arc analysis, before any expensive
 * render operations. Produces a ViralReport that downstream engines consume
 * for optimized rendering decisions.
 *
 * Capabilities:
 *   1. Viral Score (0-100) — composite metric from hook, curiosity, retention, emotion, CTA, visual variety
 *   2. Hook Optimizer — detects weak hooks, generates stronger alternatives
 *   3. Viral Trigger Detection — identifies numbers, money, authority, controversy, urgency, exclusivity, transformation
 *   4. Scroll Stop Prediction — predicts probability (0-100) of stopping a scroll
 *   5. CTA Optimization — improves CTAs with FOMO, urgency, social proof
 *   6. Platform Awareness — per-platform optimization for youtube_shorts, instagram_reels, tiktok
 *   7. Optimization Report — full report with recommendations, hook/cta alternatives, risk flags
 *   8. Render Integration — passes data to Director Engine, Retention Engine, Story Arc Engine
 *
 * This module is ISOLATED — it does NOT modify engine4-video.cjs,
 * the worker queue, or the orchestrator flow.
 *
 * Usage:
 *   const { analyzeViralPotential } = require('./backend/ai/viral-engine.cjs');
 *   const report = analyzeViralPotential(script, { platform: 'tiktok', targetDuration: 55 });
 */

let scoreHook, analyzeCuriosityGaps, generateHookAlternatives, analyzeArc, assessArcQuality, calculateRetentionScore;
try { ({ scoreHook } = require('./hook-scoring.cjs')); } catch (e) { console.warn('[viral-engine] hook-scoring not available:', e.message); scoreHook = () => ({ score: 50, grade: 'C', issues: [], strengths: [] }); }
try { ({ analyzeCuriosityGaps, generateHookAlternatives } = require('./curiosity-gap.cjs')); } catch (e) { console.warn('[viral-engine] curiosity-gap not available:', e.message); analyzeCuriosityGaps = () => []; generateHookAlternatives = () => []; }
try { ({ analyzeArc, assessArcQuality } = require('./story-arc.cjs')); } catch (e) { console.warn('[viral-engine] story-arc not available:', e.message); analyzeArc = () => ({ beats: [], structure: 'unknown' }); assessArcQuality = () => ({ score: 50 }); }
try { ({ calculateRetentionScore } = require('./retention-score.cjs')); } catch (e) { console.warn('[viral-engine] retention-score not available:', e.message); calculateRetentionScore = () => ({ score: 50, factors: {} }); }

// ---------- VIRAL TRIGGER LEXICONS ----------

const VIRAL_TRIGGERS = {
  numbers: {
    label: 'Numbers & Data',
    weight: 1.8,
    patterns: [
      /\b\d+%\b/,
      /\b\$\d[\d,]*\b/,
      /\b\d+x\b/i,
      /\b\d+ (times|people|days|ways|steps|tips|reasons|things|secrets)\b/i,
      /\b(million|billion|thousand)\b/i,
      /\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i,
      /\b#\d+\b/,
      /\btop \d+/i,
      /\b\d+ minute/i,
    ],
    boostWords: ['percent', 'million', 'billion', 'thousand', 'times', 'number'],
  },
  money: {
    label: 'Money Claims',
    weight: 2.0,
    patterns: [
      /\$[\d,]+/,
      /\b(revenue|profit|earn|income|save|savings|worth|cost|price|free|cheap)\b/i,
      /\b(made|making|made me)\$?\s*\d+/i,
      /\bpassive income\b/i,
      /\b(\d+)% ROI\b/i,
      /\bfinancial freedom\b/i,
    ],
    boostWords: ['money', 'profit', 'revenue', 'income', 'save', 'worth', 'free', 'dollars'],
  },
  authority: {
    label: 'Authority & Expertise',
    weight: 1.5,
    patterns: [
      /\b(expert|guru|professional|specialist|certified|proven)\b/i,
      /\b(i've been|i have been|i spent|my experience|years of)\b/i,
      /\b(research|study|data|evidence|backed by)\b/i,
      /\b(amazon|google|tesla|apple|meta|openai)\b/i,
      /\b(millionaire|billionaire|ceo|founder)\b/i,
    ],
    boostWords: ['expert', 'proven', 'research', 'study', 'data', 'years'],
  },
  controversy: {
    label: 'Controversy & Debate',
    weight: 2.2,
    patterns: [
      /\b(controversial|debate|argument|wrong|myth|lie|scam)\b/i,
      /\b(nobody|everyone thinks|most people believe|they don't want)\b/i,
      /\b(banned|censored|suppressed|hidden|secret)\b/i,
      /\b(unpopular opinion|hot take|truth is)\b/i,
      /\b(overrated|underrated|overhyped)\b/i,
    ],
    boostWords: ['wrong', 'myth', 'lie', 'secret', 'hidden', 'banned', 'controversial'],
  },
  urgency: {
    label: 'Urgency & Scarcity',
    weight: 1.9,
    patterns: [
      /\b(now|today|immediately|right now|before it's too late)\b/i,
      /\b(limited|hurry|last chance|running out|don't wait)\b/i,
      /\b(before|deadline|expires|ending soon)\b/i,
      /\b(last|final|only \d+ left)\b/i,
    ],
    boostWords: ['now', 'today', 'hurry', 'limited', 'last chance', 'before'],
  },
  exclusivity: {
    label: 'Exclusivity & FOMO',
    weight: 1.7,
    patterns: [
      /\b(exclusive|members only|vip|insider|invite only)\b/i,
      /\b(only \d+|limited spots|limited access|private)\b/i,
      /\b(not for everyone|not everyone|rare|elite)\b/i,
      /\b(behind the scenes|uncensored|raw)\b/i,
    ],
    boostWords: ['exclusive', 'private', 'members', 'insider', 'limited', 'rare'],
  },
  transformation: {
    label: 'Transformation & Results',
    weight: 2.1,
    patterns: [
      /\b(before and after|transform|change|changed|results)\b/i,
      /\b(went from|from .* to|started with|now i)\b/i,
      /\b(broke|million|scaled|grew|doubled|tripled)\b/i,
      /\b(surprising|incredible|unbelievable|shocking)\b/i,
    ],
    boostWords: ['transform', 'results', 'changed', 'grew', 'scaled', 'broke'],
  },
};

// ---------- PLATFORM PROFILES ----------

const PLATFORM_PROFILES = {
  youtube_shorts: {
    label: 'YouTube Shorts',
    maxDuration: 60,
    idealDuration: { min: 30, max: 58 },
    hookWindow: 3,        // seconds — first 3s are critical
    aspectRatio: '9:16',
    optimalHookLength: { min: 4, max: 10 },  // words
    subtitleStyle: 'hormozi',
    ctaStyle: 'subscribe',
    algorithmFactors: {
      watchTime: 0.35,
      clickThrough: 0.25,
      engagement: 0.20,
      shares: 0.10,
      subscribers: 0.10,
    },
    contentPreferences: {
      maxPacingGap: 6,    // seconds without change
      preferredSfxIntensity: 0.6,
      maxTextOnScreen: 40, // characters
      loopOptimization: true, // end should connect to beginning
    },
    scoringModifiers: {
      hookWeight: 1.2,     // hooks matter more on YouTube
      ctaWeight: 0.9,      // CTAs matter slightly less
      retentionWeight: 1.1,
    },
  },
  instagram_reels: {
    label: 'Instagram Reels',
    maxDuration: 90,
    idealDuration: { min: 15, max: 45 },
    hookWindow: 2,
    aspectRatio: '9:16',
    optimalHookLength: { min: 3, max: 8 },
    subtitleStyle: 'hormozi',
    ctaStyle: 'follow',
    algorithmFactors: {
      watchTime: 0.30,
      shares: 0.25,
      saves: 0.20,
      comments: 0.15,
      profileVisits: 0.10,
    },
    contentPreferences: {
      maxPacingGap: 5,
      preferredSfxIntensity: 0.7,
      maxTextOnScreen: 35,
      loopOptimization: true,
      aestheticQuality: 'high', // IG users expect polished
    },
    scoringModifiers: {
      hookWeight: 1.3,     // very hook-dependent
      ctaWeight: 1.0,
      retentionWeight: 1.0,
    },
  },
  tiktok: {
    label: 'TikTok',
    maxDuration: 180,
    idealDuration: { min: 15, max: 60 },
    hookWindow: 1.5,       // TikTok is the fastest to scroll
    aspectRatio: '9:16',
    optimalHookLength: { min: 2, max: 6 },   // shorter is better
    subtitleStyle: 'bold',
    ctaStyle: 'follow',
    algorithmFactors: {
      watchTime: 0.25,
      shares: 0.30,
      comments: 0.20,
      replays: 0.15,
      profileVisits: 0.10,
    },
    contentPreferences: {
      maxPacingGap: 3,     // TikTok viewers are the fastest to scroll
      preferredSfxIntensity: 0.8,
      maxTextOnScreen: 30,
      loopOptimization: true,
      trendAlignment: 'high', // trend sounds/memes
      rawness: 'preferred',  // less polished = more authentic
    },
    scoringModifiers: {
      hookWeight: 1.4,     // TikTok hooks are everything
      ctaWeight: 0.8,
      retentionWeight: 1.2,
    },
  },
};

// ---------- CTA OPTIMIZATION TEMPLATES ----------

const CTA_OPTIMIZERS = {
  fomo: [
    "Don't miss out — {action} before it's gone",
    "Only {number} spots left — {action} now",
    "Everyone's doing it — you're next, {action}",
    "This won't last — {action} while you still can",
  ],
  urgency: [
    "{action} right now — every second counts",
    "Stop scrolling — {action} before midnight",
    "Last chance to {action} — offer ends soon",
    "Do it now or regret it later — {action}",
  ],
  socialProof: [
    "Join {number} others who already {action}",
    "See why {number} people trust this — {action}",
    "{authority} says {action} — are you next?",
    "The same method that made {result} — {action}",
  ],
  curiosity: [
    "See what happens when you {action}",
    "The secret to {result} — {action} to find out",
    "What {authority} knows that you don't — {action}",
    "Watch till the end — the {result} will surprise you",
  ],
};

// ---------- HOOK OPTIMIZATION TEMPLATES ----------

const HOOK_TEMPLATES = {
  stronger: [
    "Stop scrolling — {topic} is about to change everything",
    "Wait — this {topic} hack is insane",
    "Nobody tells you this about {topic}",
    "I can't believe {topic} actually works",
    "The {topic} secret that {experts} hide from you",
  ],
  curiosityDriven: [
    "What if everything you know about {topic} is wrong?",
    "Here's what happens when you {topic}",
    "The truth about {topic} that nobody talks about",
    "I tried {topic} for 30 days — here's what happened",
    "{number} things about {topic} that will blow your mind",
  ],
  emotional: [
    "I was about to quit {topic} — then this happened",
    "This {topic} moment changed my life forever",
    "You won't believe what {topic} did for me",
    "I was skeptical about {topic} — until I saw the results",
    "If you've ever struggled with {topic}, watch this",
  ],
};

// ---------- RISK FLAG PATTERNS ----------

const RISK_PATTERNS = [
  { id: 'weak_hook', pattern: (script) => {
    const sentences = splitSentences(script);
    const hook = sentences.slice(0, 2).join(' ');
    return hook.split(/\s+/).length > 15;
  }, severity: 'high', message: 'Hook is too long — viewers scroll within 2 seconds' },

  { id: 'no_pattern_interrupt', pattern: (script) => {
    const first = splitSentences(script).slice(0, 2).join(' ').toLowerCase();
    return !/\b(stop|wait|never|secret|listen|hey|actually|believe|imagine)\b/.test(first);
  }, severity: 'high', message: 'Hook lacks a pattern interrupt — add a scroll-stopper' },

  { id: 'weak_cta', pattern: (script) => {
    const sentences = splitSentences(script);
    const cta = sentences.slice(-2).join(' ').toLowerCase();
    return !/\b(click|tap|sign up|join|subscribe|follow|link|now|today|here)\b/.test(cta);
  }, severity: 'medium', message: 'CTA is weak or missing — add a clear call-to-action' },

  { id: 'no_emotional_triggers', pattern: (script) => {
    const lower = script.toLowerCase();
    const triggers = /\b(secret|never|insane|free|you |your |imagine|shocking|proven)\b/i;
    return !triggers.test(lower);
  }, severity: 'medium', message: 'Script lacks emotional trigger words' },

  { id: 'no_numbers', pattern: (script) => {
    return !/\d/.test(script);
  }, severity: 'low', message: 'No numbers in script — add specific data for credibility' },

  { id: 'no_direct_address', pattern: (script) => {
    return !/\b(you|your|you're|you'll)\b/i.test(script);
  }, severity: 'medium', message: 'Script does not directly address the viewer' },

  { id: 'low_sentence_variety', pattern: (script) => {
    const sentences = splitSentences(script);
    if (sentences.length < 4) return true;
    const lengths = sentences.map(s => s.split(/\s+/).length);
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLen, 2), 0) / lengths.length;
    return variance < 4;
  }, severity: 'low', message: 'Sentence length is too uniform — add punchy short lines' },

  { id: 'no_controversy_or_curiosity', pattern: (script) => {
    const lower = script.toLowerCase();
    return !/\b(wrong|myth|lie|secret|hidden|what if|actually|nobody|controversial)\b/i.test(lower);
  }, severity: 'medium', message: 'No controversy or curiosity triggers — add debate or intrigue' },
];

// ---------- MAIN ENTRY POINT ----------

/**
 * Analyze the viral potential of a script and generate a full optimization report.
 *
 * @param {string} script - The full video script
 * @param {Object} [options] - Analysis options
 * @param {string} [options.platform='tiktok'] - Target platform: 'youtube_shorts', 'instagram_reels', 'tiktok'
 * @param {number} [options.targetDuration=55] - Target video duration in seconds
 * @param {string} [options.topic=''] - Video topic for hook generation
 * @param {Object} [options.scenes] - Pre-computed scenes from story-arc.cjs
 * @param {boolean} [options.detailed=false] - Include full breakdown
 * @returns {Object} ViralReport with score, recommendations, alternatives, risk flags
 */
function analyzeViralPotential(script, options = {}) {
  if (!script || typeof script !== 'string' || script.trim().length === 0) {
    return buildEmptyReport('No script provided');
  }

  const platform = options.platform || 'tiktok';
  const targetDuration = options.targetDuration || 55;
  const topic = options.topic || extractTopic(script);
  const detailed = options.detailed || false;
  const platformProfile = PLATFORM_PROFILES[platform] || PLATFORM_PROFILES.tiktok;

  // ── 1. VIRAL SCORE ──
  const viralScoreResult = calculateViralScore(script, {
    platform: platformProfile,
    targetDuration,
    scenes: options.scenes,
  });

  // ── 2. HOOK OPTIMIZATION ──
  const hookResult = optimizeHook(script, topic, platformProfile);

  // ── 3. VIRAL TRIGGER DETECTION ──
  const triggers = detectViralTriggers(script);

  // ── 4. SCROLL STOP PREDICTION ──
  const scrollStop = predictScrollStop(script, triggers, platformProfile);

  // ── 5. CTA OPTIMIZATION ──
  const ctaOptimization = optimizeCTA(script, topic, platformProfile);

  // ── 6. PLATFORM-SPECIFIC RECOMMENDATIONS ──
  const platformRecommendations = getPlatformRecommendations(script, platformProfile, viralScoreResult);

  // ── 7. RISK FLAGS ──
  const riskFlags = detectRiskFlags(script);

  // ── 8. COMPILE REPORT ──
  const report = {
    version: '1.0',
    viralScore: viralScoreResult.score,
    grade: viralScoreResult.grade,
    platform: platform,
    platformLabel: platformProfile.label,
    topic,
    targetDuration,

    // Core metrics
    metrics: {
      hookStrength: hookResult.score,
      curiosityGapDensity: viralScoreResult.breakdown.curiosityGaps,
      retentionScore: viralScoreResult.breakdown.retentionScore,
      emotionalIntensity: viralScoreResult.breakdown.emotionalIntensity,
      ctaQuality: ctaOptimization.score,
      visualVariety: viralScoreResult.breakdown.visualVariety,
      scrollStopProbability: scrollStop.probability,
    },

    // Viral triggers detected
    triggers: triggers.detected,
    triggerScore: triggers.score,
    triggerTypes: triggers.types,

    // Optimization data
    recommendations: compileRecommendations(
      viralScoreResult, hookResult, triggers, ctaOptimization,
      platformRecommendations, riskFlags
    ),
    hookAlternatives: hookResult.alternatives,
    ctaAlternatives: ctaOptimization.alternatives,

    // Risk flags
    riskFlags: riskFlags.flags,
    riskScore: riskFlags.score,

    // Platform-specific
    platformOptimization: platformRecommendations,

    // Scroll stop
    scrollStopProbability: scrollStop.probability,
    scrollStopFactors: scrollStop.factors,

    // Production readiness
    isViralReady: viralScoreResult.score >= 70,
    needsOptimization: viralScoreResult.score < 50,
  };

  if (detailed) {
    report.breakdown = viralScoreResult.breakdown;
    report.triggerDetails = triggers.details;
    report.hookAnalysis = hookResult.analysis;
    report.ctaAnalysis = ctaOptimization.analysis;
  }

  return report;
}

// ---------- 1. VIRAL SCORE CALCULATION ----------

function calculateViralScore(script, options = {}) {
  const { platform, targetDuration, scenes } = options;

  // Sub-scores
  const hookResult = scoreHook(script);
  const curiosityResult = analyzeCuriosityGaps(script);

  let retentionResult = { score: 50 };
  let arc = { averageIntensity: 5, intensityCurve: [], arcQuality: 50 };
  try {
    retentionResult = calculateRetentionScore(script, { targetDuration, detailed: false });
  } catch (e) {
    // Fallback if story-arc has edge case with short scripts
  }
  try {
    arc = analyzeArc(script);
  } catch (e) {
    // Fallback if story-arc has edge case with short scripts
  }

  // Emotional intensity from arc
  const emotionalIntensity = arc.averageIntensity ? arc.averageIntensity * 10 : 50;

  // CTA quality
  const ctaSentences = splitSentences(script);
  const lastSentences = ctaSentences.slice(-2).join(' ');
  const ctaScore = scoreCTAQuality(lastSentences);

  // Visual variety (from arc intensity curve variance)
  const visualVariety = calculateVisualVarietyScore(arc);

  // Weighted composite with platform modifiers
  const mod = platform?.scoringModifiers || { hookWeight: 1.0, ctaWeight: 1.0, retentionWeight: 1.0 };

  const rawScore = (
    hookResult.score * 0.25 * mod.hookWeight +
    curiosityResult.score * 0.20 +
    retentionResult.score * 0.20 * mod.retentionWeight +
    emotionalIntensity * 0.15 +
    ctaScore * 0.10 * mod.ctaWeight +
    visualVariety * 0.10
  );

  // Platform duration penalty (if duration is far from ideal)
  let durationModifier = 1.0;
  if (platform?.idealDuration) {
    const { min, max } = platform.idealDuration;
    if (targetDuration >= min && targetDuration <= max) {
      durationModifier = 1.0;
    } else if (targetDuration < min) {
      durationModifier = 0.95;
    } else {
      durationModifier = 0.90;
    }
  }

  const finalScore = Math.round(Math.min(100, Math.max(0, rawScore * durationModifier)));
  const grade = scoreToGrade(finalScore);

  return {
    score: finalScore,
    grade,
    breakdown: {
      hookStrength: hookResult.score,
      curiosityGaps: curiosityResult.score,
      retentionScore: retentionResult.score,
      emotionalIntensity: Math.round(emotionalIntensity),
      ctaQuality: ctaScore,
      visualVariety,
    },
  };
}

// ---------- 2. HOOK OPTIMIZER ----------

function optimizeHook(script, topic, platformProfile) {
  const hookResult = scoreHook(script, { hookSentenceCount: 2 });
  const alternatives = [];

  if (hookResult.needsRewrite || hookResult.score < 60) {
    // Generate stronger alternatives
    for (const template of HOOK_TEMPLATES.stronger) {
      alternatives.push(fillTemplate(template, topic));
    }

    // Generate curiosity-driven alternatives
    for (const template of HOOK_TEMPLATES.curiosityDriven) {
      alternatives.push(fillTemplate(template, topic));
    }

    // Generate emotional alternatives
    for (const template of HOOK_TEMPLATES.emotional) {
      alternatives.push(fillTemplate(template, topic));
    }

    // Also include generated hook alternatives from curiosity-gap engine
    const curiosityAlts = generateHookAlternatives(topic, 3);
    alternatives.push(...curiosityAlts);
  }

  // Platform-specific hook adjustments
  let platformTip = '';
  if (platformProfile) {
    const { hookWindow, optimalHookLength } = platformProfile;
    const hookText = hookResult.hookText || '';
    const wordCount = hookText.split(/\s+/).length;

    if (wordCount > optimalHookLength.max) {
      platformTip = `Hook is too long for ${platformProfile.label} — keep it under ${optimalHookLength.max} words`;
    }
  }

  return {
    score: hookResult.score,
    grade: hookResult.grade,
    isStrong: hookResult.isStrong,
    needsRewrite: hookResult.needsRewrite,
    alternatives: [...new Set(alternatives)].slice(0, 12),
    platformTip,
    analysis: {
      patternInterrupt: hookResult.breakdown?.patternInterrupt,
      emotionalTriggers: hookResult.breakdown?.emotionalTriggers,
      curiosityGap: hookResult.breakdown?.curiosityGap,
      brevity: hookResult.breakdown?.brevity,
    },
  };
}

// ---------- 3. VIRAL TRIGGER DETECTION ----------

function detectViralTriggers(script) {
  if (!script) return { detected: [], score: 0, types: {}, details: [] };

  const lower = script.toLowerCase();
  const detected = [];
  const typeCounts = {};
  const details = [];
  let totalWeight = 0;

  for (const [type, trigger] of Object.entries(VIRAL_TRIGGERS)) {
    let matches = 0;
    const matchedPatterns = [];

    for (const pattern of trigger.patterns) {
      const m = lower.match(pattern);
      if (m) {
        matches++;
        matchedPatterns.push(m[0]);
      }
    }

    // Check boost words
    let boostMatches = 0;
    for (const word of trigger.boostWords) {
      if (lower.includes(word)) boostMatches++;
    }

    const effectiveScore = matches * trigger.weight + boostMatches * 0.5;

    if (matches > 0) {
      detected.push({
        type,
        label: trigger.label,
        matches,
        boostMatches,
        weight: trigger.weight,
        score: Math.round(effectiveScore * 10) / 10,
        examples: matchedPatterns.slice(0, 3),
      });
      typeCounts[type] = matches;
      totalWeight += effectiveScore;
      details.push({
        type,
        patternMatches: matches,
        boostMatches,
        totalScore: effectiveScore,
        matchedExamples: matchedPatterns,
      });
    }
  }

  // Normalize score to 0-100
  const maxPossibleScore = Object.values(VIRAL_TRIGGERS).reduce((sum, t) => sum + t.weight * 3, 0);
  const score = Math.round(Math.min(100, (totalWeight / maxPossibleScore) * 100));

  // Sort by strength
  detected.sort((a, b) => b.score - a.score);

  return {
    detected,
    score,
    types: typeCounts,
    totalTriggers: detected.length,
    details,
  };
}

// ---------- 4. SCROLL STOP PREDICTION ----------

function predictScrollStop(script, triggers, platformProfile) {
  const factors = [];
  let probability = 0;

  // Factor 1: Hook strength (0-30 points)
  const hookResult = scoreHook(script);
  const hookContrib = Math.round(hookResult.score * 0.30);
  probability += hookContrib;
  factors.push({ label: 'Hook Strength', score: hookResult.score, contribution: hookContrib });

  // Factor 2: Pattern interrupt presence (0-15 points)
  const hasInterrupt = /\b(stop|wait|never|secret|listen|hey|imagine|actually)\b/i.test(
    splitSentences(script).slice(0, 2).join(' ')
  );
  if (hasInterrupt) { probability += 15; factors.push({ label: 'Pattern Interrupt', score: 100, contribution: 15 }); }
  else { factors.push({ label: 'Pattern Interrupt', score: 0, contribution: 0 }); }

  // Factor 3: Viral trigger density (0-20 points)
  const triggerContrib = Math.round(triggers.score * 0.20);
  probability += triggerContrib;
  factors.push({ label: 'Viral Triggers', score: triggers.score, contribution: triggerContrib });

  // Factor 4: Curiosity gap in first 2 sentences (0-15 points)
  const sentences = splitSentences(script);
  const hook = sentences.slice(0, 2).join(' ');
  const hasCuriosity = /\?|secret|hidden|what if|imagine|nobody/i.test(hook);
  if (hasCuriosity) { probability += 15; factors.push({ label: 'Curiosity Gap', score: 100, contribution: 15 }); }
  else { factors.push({ label: 'Curiosity Gap', score: 0, contribution: 0 }); }

  // Factor 5: Brevity (0-10 points)
  const hookWords = hook.split(/\s+/).length;
  if (hookWords <= 8) { probability += 10; factors.push({ label: 'Hook Brevity', score: 100, contribution: 10 }); }
  else if (hookWords <= 12) { probability += 6; factors.push({ label: 'Hook Brevity', score: 60, contribution: 6 }); }
  else { factors.push({ label: 'Hook Brevity', score: 20, contribution: 2 }); }

  // Factor 6: Platform-specific hook window (0-10 points)
  if (platformProfile) {
    const hookTimeEstimate = Math.min(5, hookWords * 0.4); // rough estimate
    if (hookTimeEstimate <= platformProfile.hookWindow) {
      probability += 10;
      factors.push({ label: 'Platform Fit', score: 100, contribution: 10 });
    } else {
      probability += 4;
      factors.push({ label: 'Platform Fit', score: 40, contribution: 4 });
    }
  }

  return {
    probability: Math.min(100, probability),
    factors,
    assessment: probability >= 70 ? 'high' : probability >= 50 ? 'medium' : 'low',
  };
}

// ---------- 5. CTA OPTIMIZATION ----------

function optimizeCTA(script, topic, platformProfile) {
  const sentences = splitSentences(script);
  const lastSentences = sentences.slice(-2).join(' ');
  const score = scoreCTAQuality(lastSentences);

  const alternatives = [];
  if (score < 70) {
    // Generate FOMO alternatives
    for (const template of CTA_OPTIMIZERS.fomo) {
      alternatives.push(fillTemplate(template, topic));
    }

    // Generate urgency alternatives
    for (const template of CTA_OPTIMIZERS.urgency) {
      alternatives.push(fillTemplate(template, topic));
    }

    // Generate social proof alternatives
    for (const template of CTA_OPTIMIZERS.socialProof) {
      alternatives.push(fillTemplate(template, topic));
    }

    // Generate curiosity alternatives
    for (const template of CTA_OPTIMIZERS.curiosity) {
      alternatives.push(fillTemplate(template, topic));
    }
  }

  // Platform-specific CTA tip
  let platformTip = '';
  if (platformProfile) {
    platformTip = `On ${platformProfile.label}, use "${platformProfile.ctaStyle}" CTAs`;
  }

  return {
    score,
    alternatives: [...new Set(alternatives)].slice(0, 12),
    platformTip,
    analysis: {
      hasFOMO: /\b(don't miss|limited|before it's gone|only \d+|hurry)\b/i.test(lastSentences),
      hasUrgency: /\b(now|today|immediately|right now|last chance)\b/i.test(lastSentences),
      hasSocialProof: /\b(join|others|people|everyone|trusted)\b/i.test(lastSentences),
      hasDirectAction: /\b(click|tap|sign up|subscribe|follow|link|visit)\b/i.test(lastSentences),
    },
  };
}

// ---------- 6. PLATFORM RECOMMENDATIONS ----------

function getPlatformRecommendations(script, platformProfile, viralScoreResult) {
  if (!platformProfile) return [];

  const recommendations = [];
  const sentences = splitSentences(script);
  const totalWords = script.split(/\s+/).length;
  const estimatedDuration = totalWords / 2.5; // ~150 words/min = 2.5 words/sec

  // Duration recommendations
  const { min, max } = platformProfile.idealDuration;
  if (estimatedDuration > max) {
    recommendations.push({
      priority: 'high',
      category: 'duration',
      message: `Script is ~${Math.round(estimatedDuration)}s — trim to ${min}-${max}s for ${platformProfile.label}`,
    });
  } else if (estimatedDuration < min) {
    recommendations.push({
      priority: 'medium',
      category: 'duration',
      message: `Script is ~${Math.round(estimatedDuration)}s — expand to ${min}s for ${platformProfile.label}`,
    });
  }

  // Hook window
  const hook = sentences.slice(0, 2).join(' ');
  const hookWords = hook.split(/\s+/).length;
  if (hookWords > platformProfile.optimalHookLength.max) {
    recommendations.push({
      priority: 'high',
      category: 'hook',
      message: `Hook is ${hookWords} words — reduce to ${platformProfile.optimalHookLength.min}-${platformProfile.optimalHookLength.max} words for ${platformProfile.label}`,
    });
  }

  // Pacing gap
  const pacingGap = platformProfile.contentPreferences.maxPacingGap;
  if (sentences.length > 0) {
    const avgWordsPerSentence = totalWords / sentences.length;
    const avgSecondsPerSentence = avgWordsPerSentence / 2.5;
    if (avgSecondsPerSentence > pacingGap) {
      recommendations.push({
        priority: 'medium',
        category: 'pacing',
        message: `Average sentence pacing is ~${avgSecondsPerSentence.toFixed(1)}s — break into shorter lines (max ${pacingGap}s per visual change)`,
      });
    }
  }

  // Text on screen
  const longestSentence = sentences.reduce((longest, s) =>
    s.length > longest.length ? s : longest, '');
  if (longestSentence.length > platformProfile.contentPreferences.maxTextOnScreen) {
    recommendations.push({
      priority: 'low',
      category: 'text',
      message: `Longest line is ${longestSentence.length} chars — reduce to ${platformProfile.contentPreferences.maxTextOnScreen} for readability`,
    });
  }

  // Score-based
  if (viralScoreResult.score < 50) {
    recommendations.push({
      priority: 'high',
      category: 'overall',
      message: `Viral score is ${viralScoreResult.score}/100 — rewrite needed for ${platformProfile.label}`,
    });
  }

  return recommendations;
}

// ---------- 7. RISK FLAG DETECTION ----------

function detectRiskFlags(script) {
  const flags = [];

  for (const risk of RISK_PATTERNS) {
    try {
      if (risk.pattern(script)) {
        flags.push({
          id: risk.id,
          severity: risk.severity,
          message: risk.message,
        });
      }
    } catch (e) {
      // Skip malformed patterns
    }
  }

  // Calculate risk score (0-100, lower is better)
  const highRiskCount = flags.filter(f => f.severity === 'high').length;
  const medRiskCount = flags.filter(f => f.severity === 'medium').length;
  const lowRiskCount = flags.filter(f => f.severity === 'low').length;

  const riskScore = Math.max(0, 100 - (highRiskCount * 25 + medRiskCount * 15 + lowRiskCount * 5));

  return { flags, score: riskScore, total: flags.length };
}

// ---------- HELPER FUNCTIONS ----------

function splitSentences(script) {
  if (!script) return [];
  return script
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 3);
}

function extractTopic(script) {
  // Simple topic extraction: first noun-like content
  const sentences = splitSentences(script);
  if (sentences.length === 0) return 'this';
  const first = sentences[0];
  // Extract words after common openers
  const match = first.match(/(?:about|regarding|for|on)\s+(.{3,30})/i);
  return match ? match[1].trim() : first.split(/\s+/).slice(0, 5).join(' ');
}

function fillTemplate(template, topic) {
  const replacements = {
    '{topic}': topic || 'this',
    '{experts}': 'experts',
    '{number}': String(Math.floor(Math.random() * 8) + 3),
    '{action}': 'try this',
    '{result}': 'results',
    '{authority}': 'top creators',
  };

  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
  }
  return result;
}

function scoreCTAQuality(text) {
  if (!text) return 0;
  let score = 0;
  const lower = text.toLowerCase();

  // Direct action verb (+20)
  if (/\b(click|tap|sign up|subscribe|follow|join|download|visit|get|start|try)\b/i.test(lower)) score += 20;

  // Urgency word (+15)
  if (/\b(now|today|immediately|right now|hurry|before)\b/i.test(lower)) score += 15;

  // FOMO (+15)
  if (/\b(don't miss|limited|last chance|only \d+|running out|before it's gone)\b/i.test(lower)) score += 15;

  // Social proof (+10)
  if (/\b(join|others|people|everyone|trusted|million)\b/i.test(lower)) score += 10;

  // Specificity / number (+10)
  if (/\d/.test(text)) score += 10;

  // Direct address (+10)
  if (/\b(you|your|you're|you'll)\b/i.test(lower)) score += 10;

  // Brevity bonus (+10 if under 12 words)
  if (text.split(/\s+/).length <= 12) score += 10;

  // Brevity penalty (-10 if over 20 words)
  if (text.split(/\s+/).length > 20) score -= 10;

  // Exclamation mark (+5)
  if (text.includes('!')) score += 5;

  return Math.min(100, Math.max(0, score));
}

function calculateVisualVarietyScore(arc) {
  if (!arc || !arc.intensityCurve) return 50;

  const curve = arc.intensityCurve;
  if (curve.length < 2) return 40;

  // Range of intensity
  const range = Math.max(...curve) - Math.min(...curve);

  // Variety = range of intensity values (more variation = more visual variety)
  let score = 0;

  // Range score (0-40)
  if (range >= 5) score += 40;
  else if (range >= 3) score += 30;
  else if (range >= 1.5) score += 20;
  else score += 10;

  // Number of peaks (more peaks = more variety) (0-30)
  let peaks = 0;
  for (let i = 1; i < curve.length - 1; i++) {
    if (curve[i] > curve[i - 1] && curve[i] > curve[i + 1]) peaks++;
  }
  score += Math.min(30, peaks * 10);

  // Pace changes (0-30)
  let paceChanges = 0;
  for (let i = 1; i < curve.length; i++) {
    if (Math.abs(curve[i] - curve[i - 1]) >= 2) paceChanges++;
  }
  score += Math.min(30, paceChanges * 10);

  return Math.min(100, score);
}

function scoreToGrade(score) {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A+';
  if (score >= 70) return 'A';
  if (score >= 60) return 'B+';
  if (score >= 50) return 'B';
  if (score >= 40) return 'C+';
  if (score >= 30) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

function compileRecommendations(viralScore, hookResult, triggers, ctaOptimization, platformRecs, riskFlags) {
  const recs = [];

  // Hook recommendations
  if (hookResult.needsRewrite) {
    recs.push({ priority: 'high', category: 'hook', message: 'Hook needs rewriting — use generated alternatives below' });
  } else if (hookResult.score < 70) {
    recs.push({ priority: 'medium', category: 'hook', message: 'Hook could be stronger — see alternatives below' });
  }

  // Trigger recommendations
  if (triggers.totalTriggers < 2) {
    recs.push({ priority: 'high', category: 'triggers', message: 'Add more viral triggers — currently only ' + triggers.totalTriggers + ' detected' });
  }

  // CTA recommendations
  if (ctaOptimization.score < 50) {
    recs.push({ priority: 'high', category: 'cta', message: 'CTA is weak — use optimized alternatives below' });
  }

  // Platform recs
  recs.push(...platformRecs);

  // Risk-based recs
  const highRisks = riskFlags.flags.filter(f => f.severity === 'high');
  for (const risk of highRisks) {
    recs.push({ priority: 'high', category: 'risk', message: risk.message });
  }

  // Overall
  if (viralScore.score < 50) {
    recs.push({ priority: 'high', category: 'overall', message: `Viral score is ${viralScore.score}/100 — full rewrite recommended` });
  } else if (viralScore.score < 70) {
    recs.push({ priority: 'medium', category: 'overall', message: `Viral score is ${viralScore.score}/100 — apply optimizations for production readiness` });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));

  return recs;
}

function buildEmptyReport(reason) {
  return {
    version: '1.0',
    viralScore: 0,
    grade: 'F',
    platform: 'tiktok',
    platformLabel: 'TikTok',
    topic: '',
    targetDuration: 55,
    metrics: {},
    triggers: [],
    triggerScore: 0,
    triggerTypes: {},
    recommendations: [{ priority: 'high', category: 'general', message: reason }],
    hookAlternatives: [],
    ctaAlternatives: [],
    riskFlags: [],
    riskScore: 0,
    platformOptimization: [],
    scrollStopProbability: 0,
    scrollStopFactors: [],
    isViralReady: false,
    needsOptimization: true,
  };
}

// ---------- RENDER INTEGRATION ----------

/**
 * Generate a ViralReport and merge it into downstream engine inputs.
 *
 * @param {string} script - The video script
 * @param {Object} [options] - Analysis options (same as analyzeViralPotential)
 * @param {Object} [downstreamData] - Existing data to merge into
 * @returns {Object} Merged data with viral optimization attached
 */
function integrateWithRenderPipeline(script, options = {}, downstreamData = {}) {
  const report = analyzeViralPotential(script, options);

  // Merge viral data into downstream engine inputs
  const merged = { ...downstreamData };

  // Attach viral report
  merged.viralReport = report;

  // Pass hook alternatives to director engine (as scene metadata)
  if (report.hookAlternatives.length > 0 && merged.scenes) {
    const hookScene = merged.scenes.find(s =>
      s.narrativeBeat === 'hook' || s.sceneType === 'hook'
    );
    if (hookScene && !hookScene.scriptText) {
      hookScene.metadata = hookScene.metadata || {};
      hookScene.metadata.viralAlternatives = report.hookAlternatives;
    }
  }

  // Pass CTA alternatives to story arc
  if (report.ctaAlternatives.length > 0 && merged.scenes) {
    const ctaScene = merged.scenes.find(s =>
      s.narrativeBeat === 'cta' || s.sceneType === 'cta'
    );
    if (ctaScene) {
      ctaScene.metadata = ctaScene.metadata || {};
      ctaScene.metadata.viralCTAAlternatives = report.ctaAlternatives;
    }
  }

  // Pass retention adjustments to retention engine
  if (report.scrollStopProbability < 50) {
    merged.retentionBoost = {
      increasePatternInterrupts: true,
      increaseSfxIntensity: true,
      shortenScenes: true,
    };
  }

  // Pass platform info for rendering decisions
  merged.platformOptimization = report.platformOptimization;

  return merged;
}

// ---------- EXPORTS ----------

module.exports = {
  analyzeViralPotential,
  integrateWithRenderPipeline,
  detectViralTriggers,
  predictScrollStop,
  optimizeCTA,
  optimizeHook,
  calculateViralScore,
  VIRAL_TRIGGERS,
  PLATFORM_PROFILES,
  CTA_OPTIMIZERS,
  HOOK_TEMPLATES,
  RISK_PATTERNS,
  scoreCTAQuality,
};
