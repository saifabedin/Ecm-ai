/**
 * Retention Quality Score
 *
 * Master scoring engine that combines all retention subsystems
 * into a single 0-100 score. This is the "retention grade" that
 * every video receives before rendering.
 *
 * Scoring dimensions (weighted):
 *   1. Hook Quality (25%) — from hook-scoring.cjs
 *   2. Arc Quality (25%) — from story-arc.cjs assessArcQuality()
 *   3. Curiosity Gap Density (15%) — from curiosity-gap.cjs
 *   4. Pattern Interrupt Coverage (15%) — from pattern-interrupt-scheduler.cjs
 *   5. Retention Risk (10%) — from retention-sfx.cjs analyzeRetentionRisk()
 *   6. Emotional Intensity (10%) — from story-arc.cjs intensity curve
 *
 * A score >= 70 is "production ready".
 * A score < 50 triggers automatic script optimization suggestions.
 */

const { scoreHook } = require('./hook-scoring.cjs');
const { analyzeCuriosityGaps } = require('./curiosity-gap.cjs');
const { scheduleInterrupts } = require('./pattern-interrupt-scheduler.cjs');
const { analyzeArc, assessArcQuality } = require('./story-arc.cjs');
const { analyzeRetentionRisk } = require('./retention-sfx.cjs');

// ---------- SCORING WEIGHTS ----------

const WEIGHTS = {
  hookQuality: 0.25,
  arcQuality: 0.25,
  curiosityGaps: 0.15,
  patternInterrupts: 0.15,
  retentionRisk: 0.10,
  emotionalIntensity: 0.10,
};

// ---------- GRADE THRESHOLDS ----------

const GRADES = [
  { min: 90, grade: 'A+', label: 'Exceptional', color: '#00FF88' },
  { min: 80, grade: 'A', label: 'Excellent', color: '#44FF44' },
  { min: 70, grade: 'B+', label: 'Strong', color: '#88FF44' },
  { min: 60, grade: 'B', label: 'Good', color: '#CCFF44' },
  { min: 50, grade: 'C+', label: 'Average', color: '#FFCC00' },
  { min: 40, grade: 'C', label: 'Below Average', color: '#FF8800' },
  { min: 30, grade: 'D', label: 'Weak', color: '#FF4400' },
  { min: 0, grade: 'F', label: 'Critical', color: '#FF0000' },
];

// ---------- MAIN SCORING FUNCTION ----------

/**
 * Calculate the master retention quality score for a script.
 *
 * @param {string} script - The full video script
 * @param {Object} [options] - Scoring options
 * @param {Object[]} [options.scenes] - Pre-computed scenes (from SceneManager)
 * @param {number} [options.targetDuration=55] - Target video duration
 * @param {boolean} [options.detailed=false] - Include full breakdown
 * @returns {Object} Master retention score with breakdown and recommendations
 */
function calculateRetentionScore(script, options = {}) {
  if (!script || typeof script !== 'string' || script.trim().length === 0) {
    return buildResult(0, 'F', 'No script provided', {}, ['Write a script to begin']);
  }

  const targetDuration = options.targetDuration || 55;
  const detailed = options.detailed || false;

  // ── Dimension 1: Hook Quality (25%) ──
  const hookResult = scoreHook(script);
  const hookScore = hookResult.score;

  // ── Dimension 2: Arc Quality (25%) ──
  const arc = analyzeArc(script);
  const arcScore = arc.arcQuality;

  // ── Dimension 3: Curiosity Gap Density (15%) ──
  const gapResult = analyzeCuriosityGaps(script);
  const gapScore = gapResult.score;

  // ── Dimension 4: Pattern Interrupt Coverage (15%) ──
  // Create mock scenes from arc for scheduling if no scenes provided
  const scenesForScheduling = options.scenes || createScenesFromArc(arc);
  const interruptResult = scheduleInterrupts(scenesForScheduling, { targetDuration });
  const interruptScore = interruptResult.retentionScore;

  // ── Dimension 5: Retention Risk (10%) ──
  const risks = analyzeRetentionRisk(script);
  const riskScore = calculateRiskScore(risks, script);

  // ── Dimension 6: Emotional Intensity (10%) ──
  const intensityScore = calculateIntensityScore(arc);

  // ── Weighted Total ──
  const weightedTotal = (
    hookScore * WEIGHTS.hookQuality +
    arcScore * WEIGHTS.arcQuality +
    gapScore * WEIGHTS.curiosityGaps +
    interruptScore * WEIGHTS.patternInterrupts +
    riskScore * WEIGHTS.retentionRisk +
    intensityScore * WEIGHTS.emotionalIntensity
  );

  const finalScore = Math.round(Math.min(100, Math.max(0, weightedTotal)));

  // Determine grade
  const gradeInfo = GRADES.find(g => finalScore >= g.min) || GRADES[GRADES.length - 1];

  // Collect all recommendations
  const allRecommendations = [
    ...hookResult.recommendations.map(r => `[Hook] ${r}`),
    ...gapResult.recommendations.map(r => `[Curiosity] ${r}`),
    ...generateArcRecommendations(arc),
    ...generateRiskRecommendations(risks),
  ];

  // Build result
  const result = {
    score: finalScore,
    grade: gradeInfo.grade,
    gradeLabel: gradeInfo.label,
    gradeColor: gradeInfo.color,
    isProductionReady: finalScore >= 70,
    needsOptimization: finalScore < 50,
    recommendations: allRecommendations,
  };

  if (detailed) {
    result.breakdown = {
      hookQuality: {
        score: hookScore,
        weighted: Math.round(hookScore * WEIGHTS.hookQuality * 10) / 10,
        weight: WEIGHTS.hookQuality,
        details: hookResult,
      },
      arcQuality: {
        score: arcScore,
        weighted: Math.round(arcScore * WEIGHTS.arcQuality * 10) / 10,
        weight: WEIGHTS.arcQuality,
        details: {
          totalBeats: arc.totalBeats,
          averageIntensity: arc.averageIntensity,
          hasStrongHook: arc.hasStrongHook,
          hasStrongCTA: arc.hasStrongCTA,
        },
      },
      curiosityGaps: {
        score: gapScore,
        weighted: Math.round(gapScore * WEIGHTS.curiosityGaps * 10) / 10,
        weight: WEIGHTS.curiosityGaps,
        details: {
          totalGaps: gapResult.totalGaps,
          density: gapResult.density,
          types: gapResult.types,
          hasHookGap: gapResult.hasHookGap,
        },
      },
      patternInterrupts: {
        score: interruptScore,
        weighted: Math.round(interruptScore * WEIGHTS.patternInterrupts * 10) / 10,
        weight: WEIGHTS.patternInterrupts,
        details: {
          totalInterrupts: interruptResult.totalInterrupts,
          coverage: interruptResult.coverage,
          typeDistribution: interruptResult.typeDistribution,
        },
      },
      retentionRisk: {
        score: riskScore,
        weighted: Math.round(riskScore * WEIGHTS.retentionRisk * 10) / 10,
        weight: WEIGHTS.retentionRisk,
        details: {
          totalRisks: risks.length,
          highSeverity: risks.filter(r => r.severity === 'high').length,
          types: risks.reduce((acc, r) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc; }, {}),
        },
      },
      emotionalIntensity: {
        score: intensityScore,
        weighted: Math.round(intensityScore * WEIGHTS.emotionalIntensity * 10) / 10,
        weight: WEIGHTS.emotionalIntensity,
        details: {
          averageIntensity: arc.averageIntensity,
          peakIntensity: arc.peakIntensity,
          intensityRange: arc.intensityCurve ? Math.max(...arc.intensityCurve) - Math.min(...arc.intensityCurve) : 0,
        },
      },
    };
    result.arc = arc;
    result.interrupts = interruptResult;
    result.curiosityGaps = gapResult;
    result.risks = risks;
  }

  return result;
}

// ---------- HELPER FUNCTIONS ----------

/**
 * Create mock scenes from arc analysis for pattern interrupt scheduling.
 */
function createScenesFromArc(arc) {
  if (!arc || !arc.sceneRecommendations) return [];

  return arc.sceneRecommendations.map(rec => ({
    sceneType: rec.beat === 'hook' ? 'hook' : rec.beat === 'cta' ? 'cta' : 'story',
    duration: rec.duration,
    startTime: 0,
    emotionalIntensity: rec.intensity,
    narrativeBeat: rec.beat,
  }));
}

/**
 * Calculate risk-adjusted score (more risks = lower score).
 */
function calculateRiskScore(risks, script) {
  if (!risks || risks.length === 0) return 100;

  const sentenceCount = script.split(/[.!?]+/).filter(s => s.trim().length > 3).length;
  const riskRatio = risks.length / Math.max(1, sentenceCount);

  // More risks per sentence = lower score
  if (riskRatio <= 0.1) return 90;
  if (riskRatio <= 0.2) return 75;
  if (riskRatio <= 0.3) return 60;
  if (riskRatio <= 0.4) return 45;
  if (riskRatio <= 0.5) return 30;
  return 15;
}

/**
 * Calculate emotional intensity score from arc data.
 */
function calculateIntensityScore(arc) {
  if (!arc || !arc.intensityCurve || arc.intensityCurve.length === 0) return 50;

  const curve = arc.intensityCurve;
  let score = 0;

  // Average intensity (ideal: 6-8)
  const avg = curve.reduce((a, b) => a + b, 0) / curve.length;
  if (avg >= 6 && avg <= 8) score += 40;
  else if (avg >= 5 && avg <= 9) score += 30;
  else score += 15;

  // Intensity range (variation is good)
  const range = Math.max(...curve) - Math.min(...curve);
  if (range >= 4) score += 30;
  else if (range >= 2) score += 20;
  else score += 5;

  // Strong hook (first beat >= 7)
  if (curve[0] >= 7) score += 15;

  // Strong CTA (last beat >= 7)
  if (curve[curve.length - 1] >= 7) score += 15;

  return Math.min(100, score);
}

/**
 * Generate recommendations from arc analysis.
 */
function generateArcRecommendations(arc) {
  const recs = [];
  if (!arc.hasStrongHook) {
    recs.push('[Arc] Strengthen the hook — first beat intensity should be >= 7');
  }
  if (!arc.hasStrongCTA) {
    recs.push('[Arc] Strengthen the CTA — last beat intensity should be >= 7');
  }
  if (arc.averageIntensity < 5) {
    recs.push('[Arc] Increase overall emotional intensity — add power words');
  }
  if (arc.totalBeats < 3) {
    recs.push('[Arc] Script is too short — add more narrative beats');
  }
  return recs;
}

/**
 * Generate recommendations from risk analysis.
 */
function generateRiskRecommendations(risks) {
  const recs = [];
  const highRisks = risks.filter(r => r.severity === 'high');

  if (highRisks.length > 2) {
    recs.push('[Risk] Multiple high-severity retention risks detected — rewrite recommended');
  }
  if (risks.some(r => r.type === 'weak_cta')) {
    recs.push('[Risk] Weak CTA in final 20% — add clear call-to-action');
  }
  if (risks.some(r => r.type === 'long_sentence')) {
    recs.push('[Risk] Long sentences detected — break into shorter, punchier lines');
  }
  return recs;
}

/**
 * Build a minimal result for error/empty cases.
 */
function buildResult(score, grade, label, breakdown, recommendations) {
  return {
    score,
    grade,
    gradeLabel: label,
    gradeColor: '#FF0000',
    isProductionReady: false,
    needsOptimization: true,
    breakdown,
    recommendations,
  };
}

module.exports = {
  calculateRetentionScore,
  WEIGHTS,
  GRADES,
};
