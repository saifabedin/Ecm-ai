/**
 * Performance Analytics & Feedback Loop Engine
 *
 * Closed-loop learning system that tracks video performance after publishing,
 * discovers viral patterns, and feeds optimization recommendations back into
 * the rendering pipeline.
 *
 * Capabilities:
 *   1. Video Performance Tracking — views, watch time, completion rate, CTR, engagement
 *   2. Retention Curve Analysis — drop-off at 3s, 5s, 10s, 25%, 50%, 75%, 100%
 *   3. Viral Pattern Discovery — best hooks, CTAs, pacing, subtitle styles, shot types
 *   4. Recommendation Engine — hook, CTA, visual improvements per platform
 *   5. Learning Database — stores successful patterns with weighted scores
 *   6. Multi-Platform Support — YouTube, TikTok, Instagram with per-platform optimization
 *   7. Feedback API — performanceScore, optimizationSuggestions, winningPatterns
 *   8. Dashboard Data — aggregated metrics for SaaS dashboard integration
 *
 * IMPORTANT: This module is ASYNCHRONOUS and ISOLATED.
 * - All DB writes are fire-and-forget (non-blocking)
 * - Does NOT modify engine4-video.cjs, worker queue, or orchestrator
 * - Analytics data flows FROM the rendering pipeline, never INTO it
 *
 * Usage:
 *   const { PerformanceEngine } = require('./backend/analytics/performance-engine.cjs');
 *   const engine = new PerformanceEngine({ dbPool: pool });
 *   await engine.trackVideoPerformance(videoId, metrics);
 *   const report = await engine.getFeedbackReport(videoId);
 */

const pool = require('../db/client.cjs');

// ---------- CONSTANTS ----------

const PLATFORMS = ['youtube', 'tiktok', 'instagram'];

const RETENTION_CHECKPOINTS = [
  { id: '3s', label: '3 Second', seconds: 3 },
  { id: '5s', label: '5 Second', seconds: 5 },
  { id: '10s', label: '10 Second', seconds: 10 },
  { id: '25pct', label: '25%', percent: 25 },
  { id: '50pct', label: '50%', percent: 50 },
  { id: '75pct', label: '75%', percent: 75 },
  { id: '100pct', label: '100%', percent: 100 },
];

const PATTERN_CATEGORIES = [
  'hook_style',
  'cta_style',
  'pacing',
  'subtitle_style',
  'shot_type',
  'music_mood',
  'transition_type',
  'color_grading',
  'sfx_type',
  'emotional_trigger',
];

const MIN_SAMPLES_FOR_PATTERN = 3;

// ---------- PERFORMANCE ENGINE ----------

class PerformanceEngine {
  constructor(options = {}) {
    this.db = options.dbPool !== undefined ? options.dbPool : pool;
    this.minSamples = options.minSamples || MIN_SAMPLES_FOR_PATTERN;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 1. VIDEO PERFORMANCE TRACKING
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Track a video's performance metrics after publishing.
   * Runs asynchronously — does NOT block the caller.
   *
   * @param {string} videoId - Unique video identifier (UUID or job_id)
   * @param {Object} metrics - Performance metrics
   * @param {string} metrics.platform - 'youtube' | 'tiktok' | 'instagram'
   * @param {number} metrics.views - Total views
   * @param {number} metrics.watchTimeSeconds - Total watch time in seconds
   * @param {number} metrics.completionRate - 0-1 ratio
   * @param {number} metrics.ctr - Click-through rate 0-1
   * @param {number} metrics.likes - Like count
   * @param {number} metrics.shares - Share count
   * @param {number} metrics.comments - Comment count
   * @param {number} metrics.saves - Save count (IG/TikTok)
   * @param {string} [metrics.tenantId] - Tenant for multi-tenancy
   * @param {Object} [metrics.scriptMeta] - Script metadata for pattern learning
   * @param {Object} [metrics.renderMeta] - Render metadata (shots, effects, etc.)
   * @returns {Promise<Object>} Tracking confirmation
   */
  async trackVideoPerformance(videoId, metrics) {
    if (!videoId || !metrics || !this.db) {
      return { success: false, error: !this.db ? 'No database' : 'videoId and metrics required' };
    }

    const platform = metrics.platform || 'unknown';
    const views = metrics.views || 0;
    const watchTime = metrics.watchTimeSeconds || 0;
    const completionRate = Math.min(1, Math.max(0, metrics.completionRate || 0));
    const ctr = Math.min(1, Math.max(0, metrics.ctr || 0));
    const likes = metrics.likes || 0;
    const shares = metrics.shares || 0;
    const comments = metrics.comments || 0;
    const saves = metrics.saves || 0;
    const tenantId = metrics.tenantId || 'default';

    // Calculate composite performance score (0-100)
    const performanceScore = this.calculatePerformanceScore({
      views, watchTime, completionRate, ctr, likes, shares, comments, saves, platform
    });

    // Engagement rate
    const engagementRate = views > 0
      ? Math.min(1, (likes + shares + comments + saves) / views)
      : 0;

    // Average watch time per view
    const avgWatchTime = views > 0 ? watchTime / views : 0;

    // Fire-and-forget DB write
    this._asyncQuery(`
      INSERT INTO video_performance (
        video_id, platform, tenant_id,
        views, watch_time_seconds, completion_rate, ctr,
        likes, shares, comments, saves,
        engagement_rate, avg_watch_time, performance_score,
        script_meta, render_meta, recorded_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
      ON CONFLICT (video_id) DO UPDATE SET
        views = EXCLUDED.views,
        watch_time_seconds = EXCLUDED.watch_time_seconds,
        completion_rate = EXCLUDED.completion_rate,
        ctr = EXCLUDED.ctr,
        likes = EXCLUDED.likes,
        shares = EXCLUDED.shares,
        comments = EXCLUDED.comments,
        saves = EXCLUDED.saves,
        engagement_rate = EXCLUDED.engagement_rate,
        avg_watch_time = EXCLUDED.avg_watch_time,
        performance_score = EXCLUDED.performance_score,
        script_meta = EXCLUDED.script_meta,
        render_meta = EXCLUDED.render_meta,
        recorded_at = NOW()
    `, [
      videoId, platform, tenantId,
      views, watchTime, completionRate, ctr,
      likes, shares, comments, saves,
      engagementRate, avgWatchTime, performanceScore,
      JSON.stringify(metrics.scriptMeta || {}),
      JSON.stringify(metrics.renderMeta || {}),
    ]);

    // Trigger pattern learning asynchronously
    this._learnFromVideo(videoId, metrics, performanceScore).catch(() => {});

    return {
      success: true,
      videoId,
      performanceScore,
      engagementRate: Math.round(engagementRate * 1000) / 1000,
      avgWatchTime: Math.round(avgWatchTime * 10) / 10,
    };
  }

  /**
   * Calculate composite performance score (0-100) from raw metrics.
   * Weights vary by platform.
   */
  calculatePerformanceScore(metrics) {
    const { views, watchTime, completionRate, ctr, likes, shares, comments, saves, platform } = metrics;

    const weights = this._getPlatformWeights(platform);

    // Normalize each metric to 0-1
    const normViews = this._normalizeLog(views, 10000);        // log scale, 10k = 1.0
    const normCompletion = completionRate;                      // already 0-1
    const normCTR = Math.min(1, ctr * 10);                     // 10% CTR = 1.0
    const normEngagement = this._normalizeLog(likes + shares + comments + saves, 1000);

    // Watch time ratio (vs completion)
    const normWatchTime = this._normalizeLog(watchTime, 3600);  // 1 hour = 1.0

    const score = (
      normViews * weights.views +
      normCompletion * weights.completion +
      normCTR * weights.ctr +
      normEngagement * weights.engagement +
      normWatchTime * weights.watchTime
    );

    return Math.round(Math.min(100, Math.max(0, score * 100)));
  }

  /**
   * Get platform-specific metric weights.
   */
  _getPlatformWeights(platform) {
    const weightMap = {
      youtube: { views: 0.20, completion: 0.30, ctr: 0.20, engagement: 0.15, watchTime: 0.15 },
      tiktok:  { views: 0.25, completion: 0.25, ctr: 0.15, engagement: 0.25, watchTime: 0.10 },
      instagram: { views: 0.20, completion: 0.20, ctr: 0.15, engagement: 0.30, watchTime: 0.15 },
    };
    return weightMap[platform] || weightMap.youtube;
  }

  _normalizeLog(value, midpoint) {
    if (value <= 0) return 0;
    return Math.min(1, Math.log10(value + 1) / Math.log10(midpoint + 1));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. RETENTION CURVE ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Store retention curve data for a video.
   *
   * @param {string} videoId - Video identifier
   * @param {Object} curve - Retention data points
   * @param {number} curve.totalDuration - Video duration in seconds
   * @param {Object} curve.dropoffs - { '3s': 0.95, '5s': 0.88, '10s': 0.75, '25pct': 0.65, ... }
   * @param {number[]} [curve.rawPercentages] - Full retention curve array (0-1 per second)
   * @returns {Promise<Object>}
   */
  async trackRetentionCurve(videoId, curve) {
    if (!videoId || !curve || !this.db) {
      return { success: false, error: !this.db ? 'No database' : 'videoId and curve required' };
    }

    const totalDuration = curve.totalDuration || 60;
    const dropoffs = curve.dropoffs || {};

    // Calculate derived metrics
    const retention3s = dropoffs['3s'] || 0;
    const retention5s = dropoffs['5s'] || 0;
    const retention10s = dropoffs['10s'] || 0;
    const retention25 = dropoffs['25pct'] || 0;
    const retention50 = dropoffs['50pct'] || 0;
    const retention75 = dropoffs['75pct'] || 0;
    const retention100 = dropoffs['100pct'] || 0;

    // Hook retention (first 3 seconds) — most critical
    const hookRetention = retention3s;

    // Mid-video retention
    const midRetention = (retention25 + retention50 + retention75) / 3;

    // Retention quality score (0-100)
    const retentionQuality = this._scoreRetentionQuality({
      hookRetention, midRetention, retention100
    });

    // Identify biggest drop-off zone
    const dropoffZone = this._findBiggestDropoff(dropoffs, totalDuration);

    // Fire-and-forget
    this._asyncQuery(`
      INSERT INTO retention_curves (
        video_id, total_duration,
        retention_3s, retention_5s, retention_10s,
        retention_25pct, retention_50pct, retention_75pct, retention_100pct,
        hook_retention, mid_retention, retention_quality,
        biggest_dropoff_zone, raw_curve, recorded_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
      ON CONFLICT (video_id) DO UPDATE SET
        total_duration = EXCLUDED.total_duration,
        retention_3s = EXCLUDED.retention_3s,
        retention_5s = EXCLUDED.retention_5s,
        retention_10s = EXCLUDED.retention_10s,
        retention_25pct = EXCLUDED.retention_25pct,
        retention_50pct = EXCLUDED.retention_50pct,
        retention_75pct = EXCLUDED.retention_75pct,
        retention_100pct = EXCLUDED.retention_100pct,
        hook_retention = EXCLUDED.hook_retention,
        mid_retention = EXCLUDED.mid_retention,
        retention_quality = EXCLUDED.retention_quality,
        biggest_dropoff_zone = EXCLUDED.biggest_dropoff_zone,
        raw_curve = EXCLUDED.raw_curve,
        recorded_at = NOW()
    `, [
      videoId, totalDuration,
      retention3s, retention5s, retention10s,
      retention25, retention50, retention75, retention100,
      hookRetention, midRetention, retentionQuality,
      dropoffZone, JSON.stringify(curve.rawPercentages || []),
    ]);

    return {
      success: true,
      videoId,
      hookRetention,
      midRetention,
      retentionQuality,
      biggestDropoff: dropoffZone,
    };
  }

  /**
   * Score retention quality from curve data (0-100).
   */
  _scoreRetentionQuality({ hookRetention, midRetention, retention100 }) {
    let score = 0;

    // Hook retention (0-40) — most important
    score += hookRetention * 40;

    // Mid retention (0-30)
    score += midRetention * 30;

    // Full completion (0-30)
    score += retention100 * 30;

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  /**
   * Find the biggest drop-off zone between checkpoints.
   */
  _findBiggestDropoff(dropoffs, totalDuration) {
    const checkpoints = [
      { id: 'hook', pct: 0, value: dropoffs['3s'] || 1 },
      { id: 'early', pct: 8, value: dropoffs['5s'] || dropoffs['3s'] || 1 },
      { id: 'intro', pct: 18, value: dropoffs['10s'] || dropoffs['5s'] || 1 },
      { id: 'first_quarter', pct: 25, value: dropoffs['25pct'] || 1 },
      { id: 'midpoint', pct: 50, value: dropoffs['50pct'] || 1 },
      { id: 'third_quarter', pct: 75, value: dropoffs['75pct'] || 1 },
      { id: 'end', pct: 100, value: dropoffs['100pct'] || 0 },
    ];

    let maxDrop = 0;
    let worstZone = 'unknown';

    for (let i = 1; i < checkpoints.length; i++) {
      const drop = checkpoints[i - 1].value - checkpoints[i].value;
      if (drop > maxDrop) {
        maxDrop = drop;
        worstZone = `${checkpoints[i - 1].id}_to_${checkpoints[i].id}`;
      }
    }

    return worstZone;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. VIRAL PATTERN DISCOVERY
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Internal learning: extract patterns from a video and store if high-performing.
   */
  async _learnFromVideo(videoId, metrics, performanceScore) {
    if (!this.db) return;

    const scriptMeta = metrics.scriptMeta || {};
    const renderMeta = metrics.renderMeta || {};
    const platform = metrics.platform || 'unknown';

    // Only learn from videos with above-average performance
    if (performanceScore < 50) return;

    const patterns = [];

    // Extract hook pattern
    if (scriptMeta.hookText) {
      patterns.push({
        category: 'hook_style',
        pattern: this._normalizeText(scriptMeta.hookText),
        raw_value: scriptMeta.hookText,
        score: performanceScore,
        confidence: this._calculateConfidence(views, performanceScore),
      });
    }

    // Extract CTA pattern
    if (scriptMeta.ctaText) {
      patterns.push({
        category: 'cta_style',
        pattern: this._normalizeText(scriptMeta.ctaText),
        raw_value: scriptMeta.ctaText,
        score: performanceScore,
        confidence: this._calculateConfidence(views, performanceScore),
      });
    }

    // Extract pacing
    if (scriptMeta.pacing) {
      patterns.push({
        category: 'pacing',
        pattern: scriptMeta.pacing,
        raw_value: scriptMeta.pacing,
        score: performanceScore,
        confidence: this._calculateConfidence(views, performanceScore),
      });
    }

    // Extract subtitle style
    if (renderMeta.subtitlePreset) {
      patterns.push({
        category: 'subtitle_style',
        pattern: renderMeta.subtitlePreset,
        raw_value: renderMeta.subtitlePreset,
        score: performanceScore,
        confidence: this._calculateConfidence(views, performanceScore),
      });
    }

    // Extract dominant shot type
    if (renderMeta.dominantShotType) {
      patterns.push({
        category: 'shot_type',
        pattern: renderMeta.dominantShotType,
        raw_value: renderMeta.dominantShotType,
        score: performanceScore,
        confidence: this._calculateConfidence(views, performanceScore),
      });
    }

    // Extract music mood
    if (renderMeta.musicMood) {
      patterns.push({
        category: 'music_mood',
        pattern: renderMeta.musicMood,
        raw_value: renderMeta.musicMood,
        score: performanceScore,
        confidence: this._calculateConfidence(views, performanceScore),
      });
    }

    // Extract transition type
    if (renderMeta.transitionType) {
      patterns.push({
        category: 'transition_type',
        pattern: renderMeta.transitionType,
        raw_value: renderMeta.transitionType,
        score: performanceScore,
        confidence: this._calculateConfidence(views, performanceScore),
      });
    }

    // Extract color grading
    if (renderMeta.colorGrading) {
      patterns.push({
        category: 'color_grading',
        pattern: renderMeta.colorGrading,
        raw_value: renderMeta.colorGrading,
        score: performanceScore,
        confidence: this._calculateConfidence(views, performanceScore),
      });
    }

    // Extract emotional triggers
    if (scriptMeta.emotionalTriggers && Array.isArray(scriptMeta.emotionalTriggers)) {
      for (const trigger of scriptMeta.emotionalTriggers) {
        patterns.push({
          category: 'emotional_trigger',
          pattern: trigger,
          raw_value: trigger,
          score: performanceScore,
          confidence: this._calculateConfidence(views, performanceScore),
        });
      }
    }

    // Extract SFX type
    if (renderMeta.sfxType) {
      patterns.push({
        category: 'sfx_type',
        pattern: renderMeta.sfxType,
        raw_value: renderMeta.sfxType,
        score: performanceScore,
        confidence: this._calculateConfidence(views, performanceScore),
      });
    }

    // Store each pattern
    for (const p of patterns) {
      await this._upsertPattern(p.category, p.pattern, p.raw_value, p.score, p.confidence, platform);
    }

    // Record pattern usage for this video
    for (const p of patterns) {
      this._asyncQuery(`
        INSERT INTO pattern_usage (video_id, pattern_category, pattern_value, platform, performance_score, recorded_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `, [videoId, p.category, p.pattern, platform, performanceScore]);
    }
  }

  /**
   * Upsert a pattern into the learning database.
   * Uses exponential moving average to update score.
   */
  async _upsertPattern(category, pattern, rawValue, newScore, confidence, platform) {
    if (!this.db) return;

    try {
      const existing = await this.db.query(
        `SELECT id, avg_score, sample_count, confidence as existing_confidence
         FROM viral_patterns
         WHERE category = $1 AND pattern = $2 AND platform = $3`,
        [category, pattern, platform]
      );

      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        const n = row.sample_count;
        const alpha = 0.3; // EMA smoothing factor
        const updatedScore = row.avg_score * (1 - alpha) + newScore * alpha;
        const updatedConfidence = Math.min(1, (row.existing_confidence + confidence) / 2);
        const updatedCount = n + 1;

        await this.db.query(
          `UPDATE viral_patterns
           SET avg_score = $1, sample_count = $2, confidence = $3,
               last_seen = NOW(), updated_at = NOW()
           WHERE id = $4`,
          [updatedScore, updatedCount, updatedConfidence, row.id]
        );
      } else {
        await this.db.query(
          `INSERT INTO viral_patterns (category, pattern, raw_value, avg_score, sample_count, confidence, platform, first_seen, last_seen)
           VALUES ($1, $2, $3, $4, 1, $5, $6, NOW(), NOW())`,
          [category, pattern, rawValue, newScore, confidence, platform]
        );
      }
    } catch (err) {
      // Non-blocking — pattern learning is best-effort
    }
  }

  _calculateConfidence(views, score) {
    if (!views) return 0.1;
    const volumeFactor = Math.min(1, Math.log10(views + 1) / 5); // 100k views = 1.0
    const scoreFactor = score / 100;
    return Math.round(volumeFactor * scoreFactor * 100) / 100;
  }

  _normalizeText(text) {
    return (text || '').toLowerCase().trim().replace(/\s+/g, ' ').substring(0, 200);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. RECOMMENDATION ENGINE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get optimization recommendations for a new video script.
   * Uses learned patterns to recommend improvements.
   *
   * @param {Object} context - Video context
   * @param {string} context.platform - Target platform
   * @param {string} [context.topic] - Video topic/niche
   * @param {string} [context.currentHook] - Current hook text
   * @param {string} [context.currentCTA] - Current CTA text
   * @returns {Promise<Object>} Recommendations
   */
  async getRecommendations(context = {}) {
    if (!this.db) return { recommendations: [], patterns: [] };

    const platform = context.platform || 'youtube';

    try {
      // Get winning hooks for this platform
      const topHooks = await this.db.query(
        `SELECT pattern, raw_value, avg_score, sample_count, confidence
         FROM viral_patterns
         WHERE category = 'hook_style' AND platform = $1 AND sample_count >= $2
         ORDER BY avg_score DESC, confidence DESC
         LIMIT 5`,
        [platform, this.minSamples]
      );

      // Get winning CTAs
      const topCTAs = await this.db.query(
        `SELECT pattern, raw_value, avg_score, sample_count, confidence
         FROM viral_patterns
         WHERE category = 'cta_style' AND platform = $1 AND sample_count >= $2
         ORDER BY avg_score DESC, confidence DESC
         LIMIT 5`,
        [platform, this.minSamples]
      );

      // Get winning pacing
      const topPacing = await this.db.query(
        `SELECT pattern, avg_score, sample_count
         FROM viral_patterns
         WHERE category = 'pacing' AND platform = $1 AND sample_count >= $2
         ORDER BY avg_score DESC
         LIMIT 3`,
        [platform, this.minSamples]
      );

      // Get winning subtitle styles
      const topSubtitles = await this.db.query(
        `SELECT pattern, avg_score, sample_count
         FROM viral_patterns
         WHERE category = 'subtitle_style' AND platform = $1 AND sample_count >= $2
         ORDER BY avg_score DESC
         LIMIT 3`,
        [platform, this.minSamples]
      );

      // Get winning shot types
      const topShots = await this.db.query(
        `SELECT pattern, avg_score, sample_count
         FROM viral_patterns
         WHERE category = 'shot_type' AND platform = $1 AND sample_count >= $2
         ORDER BY avg_score DESC
         LIMIT 5`,
        [platform, this.minSamples]
      );

      // Build recommendations
      const recommendations = [];

      if (topHooks.rows.length > 0) {
        recommendations.push({
          category: 'hook',
          priority: 'high',
          message: `Top performing hook styles on ${platform}:`,
          alternatives: topHooks.rows.map(r => ({
            text: r.raw_value,
            score: Math.round(r.avg_score),
            samples: r.sample_count,
          })),
        });
      }

      if (topCTAs.rows.length > 0) {
        recommendations.push({
          category: 'cta',
          priority: 'high',
          message: `Top performing CTA styles on ${platform}:`,
          alternatives: topCTAs.rows.map(r => ({
            text: r.raw_value,
            score: Math.round(r.avg_score),
            samples: r.sample_count,
          })),
        });
      }

      if (topPacing.rows.length > 0) {
        recommendations.push({
          category: 'pacing',
          priority: 'medium',
          message: `Best performing pacing on ${platform}:`,
          options: topPacing.rows.map(r => ({
            value: r.pattern,
            score: Math.round(r.avg_score),
          })),
        });
      }

      if (topSubtitles.rows.length > 0) {
        recommendations.push({
          category: 'subtitles',
          priority: 'medium',
          message: `Best subtitle preset on ${platform}:`,
          options: topSubtitles.rows.map(r => ({
            value: r.pattern,
            score: Math.round(r.avg_score),
          })),
        });
      }

      if (topShots.rows.length > 0) {
        recommendations.push({
          category: 'visual',
          priority: 'medium',
          message: `Best shot types on ${platform}:`,
          options: topShots.rows.map(r => ({
            value: r.pattern,
            score: Math.round(r.avg_score),
          })),
        });
      }

      return {
        platform,
        recommendations,
        dataPoints: await this._getTotalDataPoints(platform),
      };
    } catch (err) {
      return { recommendations: [], patterns: [], error: err.message };
    }
  }

  async _getTotalDataPoints(platform) {
    try {
      const result = await this.db.query(
        `SELECT COUNT(DISTINCT video_id) as videos, SUM(sample_count) as patterns
         FROM viral_patterns WHERE platform = $1`,
        [platform]
      );
      return result.rows[0] || { videos: 0, patterns: 0 };
    } catch {
      return { videos: 0, patterns: 0 };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 5. LEARNING DATABASE (QUERY)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get all winning patterns across platforms.
   *
   * @param {Object} [options]
   * @param {string} [options.platform] - Filter by platform
   * @param {string} [options.category] - Filter by category
   * @param {number} [options.minScore=60] - Minimum average score
   * @param {number} [options.limit=50] - Max results
   * @returns {Promise<Object[]>} Winning patterns
   */
  async getWinningPatterns(options = {}) {
    if (!this.db) return [];

    const platform = options.platform || null;
    const category = options.category || null;
    const minScore = options.minScore || 60;
    const limit = options.limit || 50;

    let query = `
      SELECT category, pattern, raw_value, avg_score, sample_count, confidence, platform,
             first_seen, last_seen
      FROM viral_patterns
      WHERE sample_count >= $1 AND avg_score >= $2
    `;
    const params = [this.minSamples, minScore];
    let paramIdx = 3;

    if (platform) {
      query += ` AND platform = $${paramIdx}`;
      params.push(platform);
      paramIdx++;
    }

    if (category) {
      query += ` AND category = $${paramIdx}`;
      params.push(category);
      paramIdx++;
    }

    query += ` ORDER BY avg_score DESC, sample_count DESC LIMIT $${paramIdx}`;
    params.push(limit);

    try {
      const result = await this.db.query(query, params);
      return result.rows;
    } catch {
      return [];
    }
  }

  /**
   * Get pattern comparison: how does a specific pattern perform vs alternatives.
   */
  async comparePatterns(category, patterns, platform) {
    if (!this.db || !patterns || patterns.length === 0) return [];

    const normalized = patterns.map(p => this._normalizeText(p));

    try {
      const result = await this.db.query(
        `SELECT pattern, raw_value, avg_score, sample_count, confidence
         FROM viral_patterns
         WHERE category = $1 AND platform = $2 AND pattern = ANY($3)
         ORDER BY avg_score DESC`,
        [category, platform, normalized]
      );

      return result.rows;
    } catch {
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 6. MULTI-PLATFORM SUPPORT
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get per-platform performance breakdown.
   */
  async getPlatformBreakdown(tenantId) {
    if (!this.db) return {};

    const tid = tenantId || 'default';

    try {
      const result = await this.db.query(
        `SELECT platform,
                COUNT(*) as total_videos,
                ROUND(AVG(views)) as avg_views,
                ROUND(AVG(completion_rate)::numeric, 3) as avg_completion,
                ROUND(AVG(ctr)::numeric, 3) as avg_ctr,
                ROUND(AVG(engagement_rate)::numeric, 3) as avg_engagement,
                ROUND(AVG(performance_score)) as avg_score,
                ROUND(AVG(avg_watch_time)::numeric, 1) as avg_watch_time,
                SUM(views) as total_views
         FROM video_performance
         WHERE tenant_id = $1
         GROUP BY platform
         ORDER BY avg_score DESC`,
        [tid]
      );

      const breakdown = {};
      for (const row of result.rows) {
        breakdown[row.platform] = {
          totalVideos: parseInt(row.total_videos),
          avgViews: parseInt(row.avg_views),
          avgCompletion: parseFloat(row.avg_completion),
          avgCTR: parseFloat(row.avg_ctr),
          avgEngagement: parseFloat(row.avg_engagement),
          avgScore: parseInt(row.avg_score),
          avgWatchTime: parseFloat(row.avg_watch_time),
          totalViews: parseInt(row.total_views),
        };
      }

      return breakdown;
    } catch {
      return {};
    }
  }

  /**
   * Get platform-specific retention comparison.
   */
  async getRetentionComparison(tenantId) {
    if (!this.db) return {};

    const tid = tenantId || 'default';

    try {
      const result = await this.db.query(
        `SELECT vp.platform,
                ROUND(AVG(rc.hook_retention)::numeric, 3) as avg_hook_retention,
                ROUND(AVG(rc.retention_25pct)::numeric, 3) as avg_retention_25,
                ROUND(AVG(rc.retention_50pct)::numeric, 3) as avg_retention_50,
                ROUND(AVG(rc.retention_75pct)::numeric, 3) as avg_retention_75,
                ROUND(AVG(rc.retention_100pct)::numeric, 3) as avg_retention_100,
                ROUND(AVG(rc.retention_quality)) as avg_quality,
                COUNT(rc.id) as sample_count
         FROM retention_curves rc
         JOIN video_performance vp ON rc.video_id = vp.video_id
         WHERE vp.tenant_id = $1
         GROUP BY vp.platform
         ORDER BY avg_quality DESC`,
        [tid]
      );

      const comparison = {};
      for (const row of result.rows) {
        comparison[row.platform] = {
          avgHookRetention: parseFloat(row.avg_hook_retention),
          avgRetention25: parseFloat(row.avg_retention_25),
          avgRetention50: parseFloat(row.avg_retention_50),
          avgRetention75: parseFloat(row.avg_retention_75),
          avgRetention100: parseFloat(row.avg_retention_100),
          avgQuality: parseInt(row.avg_quality),
          sampleCount: parseInt(row.sample_count),
        };
      }

      return comparison;
    } catch {
      return {};
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 7. FEEDBACK API
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get a full feedback report for a video.
   *
   * @param {string} videoId - Video identifier
   * @returns {Promise<Object>} Complete feedback report
   */
  async getFeedbackReport(videoId) {
    if (!this.db || !videoId) {
      return this._emptyFeedbackReport(videoId);
    }

    try {
      // Fetch performance data
      const perfResult = await this.db.query(
        `SELECT * FROM video_performance WHERE video_id = $1`,
        [videoId]
      );

      // Fetch retention curve
      const retResult = await this.db.query(
        `SELECT * FROM retention_curves WHERE video_id = $1`,
        [videoId]
      );

      // Fetch patterns used
      const patternsResult = await this.db.query(
        `SELECT * FROM pattern_usage WHERE video_id = $1`,
        [videoId]
      );

      if (perfResult.rows.length === 0) {
        return this._emptyFeedbackReport(videoId);
      }

      const perf = perfResult.rows[0];
      const ret = retResult.rows[0] || null;
      const patterns = patternsResult.rows;

      // Generate optimization suggestions
      const suggestions = this._generateSuggestions(perf, ret, patterns);

      // Get winning patterns for comparison
      const winningPatterns = await this.getWinningPatterns({
        platform: perf.platform,
        minScore: Math.max(50, perf.performance_score),
        limit: 10,
      });

      return {
        videoId,
        platform: perf.platform,
        performanceScore: perf.performance_score,
        metrics: {
          views: perf.views,
          watchTimeSeconds: perf.watch_time_seconds,
          completionRate: perf.completion_rate,
          ctr: perf.ctr,
          likes: perf.likes,
          shares: perf.shares,
          comments: perf.comments,
          saves: perf.saves,
          engagementRate: perf.engagement_rate,
          avgWatchTime: perf.avg_watch_time,
        },
        retention: ret ? {
          hookRetention: ret.hook_retention,
          midRetention: ret.mid_retention,
          retentionQuality: ret.retention_quality,
          biggestDropoff: ret.biggest_dropoff_zone,
          curve: {
            '3s': ret.retention_3s,
            '5s': ret.retention_5s,
            '10s': ret.retention_10s,
            '25pct': ret.retention_25pct,
            '50pct': ret.retention_50pct,
            '75pct': ret.retention_75pct,
            '100pct': ret.retention_100pct,
          },
        } : null,
        optimizationSuggestions: suggestions,
        winningPatterns: winningPatterns.map(p => ({
          category: p.category,
          value: p.raw_value,
          score: Math.round(p.avg_score),
          samples: p.sample_count,
        })),
        recordedAt: perf.recorded_at,
      };
    } catch (err) {
      return this._emptyFeedbackReport(videoId, err.message);
    }
  }

  /**
   * Generate optimization suggestions based on performance data.
   */
  _generateSuggestions(perf, retention, patterns) {
    const suggestions = [];
    const platform = perf.platform;

    // Hook retention suggestions
    if (retention && retention.hook_retention < 0.6) {
      suggestions.push({
        category: 'hook',
        priority: 'critical',
        message: `Hook retention is ${(retention.hook_retention * 100).toFixed(0)}% — below 60% threshold. Rewrite the first 3 seconds.`,
        impact: 'high',
      });
    } else if (retention && retention.hook_retention < 0.75) {
      suggestions.push({
        category: 'hook',
        priority: 'high',
        message: `Hook retention is ${(retention.hook_retention * 100).toFixed(0)}% — consider a stronger pattern interrupt.`,
        impact: 'medium',
      });
    }

    // Drop-off suggestions
    if (retention && retention.biggest_dropoff_zone) {
      const zone = retention.biggest_dropoff_zone;
      suggestions.push({
        category: 'pacing',
        priority: 'high',
        message: `Biggest viewer drop-off at: ${zone.replace(/_/g, ' ')}. Add a pattern interrupt or visual change here.`,
        impact: 'high',
      });
    }

    // CTR suggestions
    if (perf.ctr < 0.02) {
      suggestions.push({
        category: 'thumbnail',
        priority: 'medium',
        message: `CTR is ${(perf.ctr * 100).toFixed(1)}% — test new thumbnails or titles.`,
        impact: 'medium',
      });
    }

    // Completion rate suggestions
    if (perf.completion_rate < 0.3) {
      suggestions.push({
        category: 'duration',
        priority: 'high',
        message: `Completion rate is ${(perf.completion_rate * 100).toFixed(0)}% — video may be too long or pacing is too slow.`,
        impact: 'high',
      });
    }

    // Engagement suggestions
    if (perf.engagement_rate < 0.02) {
      suggestions.push({
        category: 'engagement',
        priority: 'medium',
        message: `Engagement rate is ${(perf.engagement_rate * 100).toFixed(1)}% — add a stronger CTA or question.`,
        impact: 'medium',
      });
    }

    // Watch time suggestions
    if (perf.avg_watch_time < 5) {
      suggestions.push({
        category: 'retention',
        priority: 'high',
        message: `Avg watch time is ${perf.avg_watch_time.toFixed(1)}s — viewers leaving before first checkpoint.`,
        impact: 'high',
      });
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    suggestions.sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3));

    return suggestions;
  }

  _emptyFeedbackReport(videoId, error) {
    return {
      videoId,
      performanceScore: 0,
      metrics: {},
      retention: null,
      optimizationSuggestions: [],
      winningPatterns: [],
      error: error || 'No data available',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 8. DASHBOARD DATA
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get aggregated dashboard metrics for SaaS frontend.
   *
   * @param {Object} [options]
   * @param {string} [options.tenantId] - Tenant filter
   * @param {string} [options.period='30d'] - Time period: '7d', '30d', '90d', 'all'
   * @returns {Promise<Object>} Dashboard-ready metrics
   */
  async getDashboardData(options = {}) {
    if (!this.db) return this._emptyDashboard();

    const tid = options.tenantId || 'default';
    const period = options.period || '30d';
    const interval = this._periodToInterval(period);

    try {
      // Overview stats
      const overview = await this.db.query(
        `SELECT
           COUNT(*) as total_videos,
           ROUND(AVG(views)) as avg_views,
           SUM(views) as total_views,
           ROUND(AVG(performance_score)) as avg_score,
           ROUND(AVG(completion_rate)::numeric, 3) as avg_completion,
           ROUND(AVG(ctr)::numeric, 3) as avg_ctr,
           ROUND(AVG(engagement_rate)::numeric, 3) as avg_engagement,
           MAX(performance_score) as top_score,
           MIN(recorded_at) as first_recorded,
           MAX(recorded_at) as last_recorded
         FROM video_performance
         WHERE tenant_id = $1
         ${interval ? `AND recorded_at >= NOW() - INTERVAL '${interval}'` : ''}`,
        [tid]
      );

      // Platform breakdown
      const platforms = await this.getPlatformBreakdown(tid);

      // Retention overview
      const retentionOverview = await this.db.query(
        `SELECT
           ROUND(AVG(hook_retention)::numeric, 3) as avg_hook_retention,
           ROUND(AVG(retention_50pct)::numeric, 3) as avg_mid_retention,
           ROUND(AVG(retention_100pct)::numeric, 3) as avg_completion,
           ROUND(AVG(retention_quality)) as avg_quality
         FROM retention_curves rc
         JOIN video_performance vp ON rc.video_id = vp.video_id
         WHERE vp.tenant_id = $1
         ${interval ? `AND vp.recorded_at >= NOW() - INTERVAL '${interval}'` : ''}`,
        [tid]
      );

      // Top performing videos
      const topVideos = await this.db.query(
        `SELECT video_id, platform, views, performance_score, completion_rate,
                engagement_rate, recorded_at
         FROM video_performance
         WHERE tenant_id = $1
         ${interval ? `AND recorded_at >= NOW() - INTERVAL '${interval}'` : ''}
         ORDER BY performance_score DESC
         LIMIT 5`,
        [tid]
      );

      // Trending patterns (highest scoring in period)
      const trendingPatterns = await this.db.query(
        `SELECT category, pattern, raw_value, avg_score, sample_count, platform
         FROM viral_patterns
         WHERE sample_count >= $1
         ORDER BY avg_score DESC, sample_count DESC
         LIMIT 10`,
        [this.minSamples]
      );

      // Performance trend (score over time)
      const trend = await this.db.query(
        `SELECT
           DATE_TRUNC('week', recorded_at) as week,
           ROUND(AVG(performance_score)) as avg_score,
           COUNT(*) as videos
         FROM video_performance
         WHERE tenant_id = $1
         ${interval ? `AND recorded_at >= NOW() - INTERVAL '${interval}'` : ''}
         GROUP BY DATE_TRUNC('week', recorded_at)
         ORDER BY week`,
        [tid]
      );

      const ov = overview.rows[0] || {};
      const retOv = retentionOverview.rows[0] || {};

      return {
        overview: {
          totalVideos: parseInt(ov.total_videos) || 0,
          totalViews: parseInt(ov.total_views) || 0,
          avgViews: parseInt(ov.avg_views) || 0,
          avgScore: parseInt(ov.avg_score) || 0,
          avgCompletion: parseFloat(ov.avg_completion) || 0,
          avgCTR: parseFloat(ov.avg_ctr) || 0,
          avgEngagement: parseFloat(ov.avg_engagement) || 0,
          topScore: parseInt(ov.top_score) || 0,
          firstRecorded: ov.first_recorded,
          lastRecorded: ov.last_recorded,
        },
        retention: {
          avgHookRetention: parseFloat(retOv.avg_hook_retention) || 0,
          avgMidRetention: parseFloat(retOv.avg_mid_retention) || 0,
          avgCompletion: parseFloat(retOv.avg_completion) || 0,
          avgQuality: parseInt(retOv.avg_quality) || 0,
        },
        platforms,
        topVideos: topVideos.rows.map(r => ({
          videoId: r.video_id,
          platform: r.platform,
          views: r.views,
          score: r.performance_score,
          completion: r.completion_rate,
          engagement: r.engagement_rate,
          recordedAt: r.recorded_at,
        })),
        trendingPatterns: trendingPatterns.rows.map(r => ({
          category: r.category,
          value: r.raw_value,
          score: Math.round(r.avg_score),
          samples: r.sample_count,
          platform: r.platform,
        })),
        trend: trend.rows.map(r => ({
          week: r.week,
          avgScore: parseInt(r.avg_score),
          videoCount: parseInt(r.videos),
        })),
        period,
        generatedAt: new Date().toISOString(),
      };
    } catch (err) {
      return { ...this._emptyDashboard(), error: err.message };
    }
  }

  _periodToInterval(period) {
    const map = { '7d': '7 days', '30d': '30 days', '90d': '90 days', 'all': null };
    return map[period] !== undefined ? map[period] : '30 days';
  }

  _emptyDashboard() {
    return {
      overview: { totalVideos: 0, totalViews: 0, avgViews: 0, avgScore: 0 },
      retention: {},
      platforms: {},
      topVideos: [],
      trendingPatterns: [],
      trend: [],
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UTILITY
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Fire-and-forget async query. Catches errors silently.
   */
  async _asyncQuery(text, params = []) {
    if (!this.db) return;
    try {
      await this.db.query(text, params);
    } catch (err) {
      // Non-blocking — analytics should never crash the pipeline
    }
  }

  /**
   * Health check — verify DB connectivity.
   */
  async healthCheck() {
    if (!this.db) return { status: 'disabled', message: 'No database' };
    try {
      await this.db.query('SELECT 1');
      return { status: 'healthy' };
    } catch (err) {
      return { status: 'unhealthy', message: err.message };
    }
  }
}

// ---------- EXPORTS ----------

module.exports = {
  PerformanceEngine,
  PLATFORMS,
  RETENTION_CHECKPOINTS,
  PATTERN_CATEGORIES,
  MIN_SAMPLES_FOR_PATTERN,
};
