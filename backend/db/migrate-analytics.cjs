const dotenv = require('dotenv');
const { join } = require('path');

dotenv.config({ path: join(__dirname, '../.env') });

const pool = require('./client.cjs');

async function migrateAnalytics() {
  if (!pool) {
    console.log("[Analytics] Database disabled — skipping analytics migration");
    return;
  }

  try {
    console.log("[Analytics] Running analytics tables migration...");

    // ── video_performance ──
    // Stores per-video metrics after publishing
    await pool.query(`
      CREATE TABLE IF NOT EXISTS video_performance (
        id SERIAL PRIMARY KEY,
        video_id TEXT UNIQUE NOT NULL,
        platform VARCHAR(50) NOT NULL DEFAULT 'unknown',
        tenant_id TEXT DEFAULT 'default',

        views BIGINT DEFAULT 0,
        watch_time_seconds BIGINT DEFAULT 0,
        completion_rate DECIMAL(5,4) DEFAULT 0,
        ctr DECIMAL(5,4) DEFAULT 0,

        likes INTEGER DEFAULT 0,
        shares INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        saves INTEGER DEFAULT 0,

        engagement_rate DECIMAL(5,4) DEFAULT 0,
        avg_watch_time DECIMAL(8,2) DEFAULT 0,
        performance_score INTEGER DEFAULT 0,

        script_meta JSONB DEFAULT '{}',
        render_meta JSONB DEFAULT '{}',

        recorded_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── retention_curves ──
    // Stores retention curve data per video
    await pool.query(`
      CREATE TABLE IF NOT EXISTS retention_curves (
        id SERIAL PRIMARY KEY,
        video_id TEXT UNIQUE NOT NULL,
        total_duration DECIMAL(6,2) DEFAULT 60,

        retention_3s DECIMAL(5,4) DEFAULT 0,
        retention_5s DECIMAL(5,4) DEFAULT 0,
        retention_10s DECIMAL(5,4) DEFAULT 0,
        retention_25pct DECIMAL(5,4) DEFAULT 0,
        retention_50pct DECIMAL(5,4) DEFAULT 0,
        retention_75pct DECIMAL(5,4) DEFAULT 0,
        retention_100pct DECIMAL(5,4) DEFAULT 0,

        hook_retention DECIMAL(5,4) DEFAULT 0,
        mid_retention DECIMAL(5,4) DEFAULT 0,
        retention_quality INTEGER DEFAULT 0,

        biggest_dropoff_zone VARCHAR(50),
        raw_curve JSONB DEFAULT '[]',

        recorded_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── viral_patterns ──
    // Stores learned winning patterns (the learning database)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS viral_patterns (
        id SERIAL PRIMARY KEY,
        category VARCHAR(50) NOT NULL,
        pattern TEXT NOT NULL,
        raw_value TEXT,
        avg_score DECIMAL(5,2) DEFAULT 0,
        sample_count INTEGER DEFAULT 0,
        confidence DECIMAL(3,2) DEFAULT 0,
        platform VARCHAR(50) NOT NULL DEFAULT 'youtube',

        first_seen TIMESTAMPTZ DEFAULT NOW(),
        last_seen TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),

        UNIQUE(category, pattern, platform)
      )
    `);

    // ── pattern_usage ──
    // Tracks which patterns were used in which videos (for correlation analysis)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pattern_usage (
        id SERIAL PRIMARY KEY,
        video_id TEXT NOT NULL,
        pattern_category VARCHAR(50) NOT NULL,
        pattern_value TEXT NOT NULL,
        platform VARCHAR(50) NOT NULL DEFAULT 'unknown',
        performance_score INTEGER DEFAULT 0,
        recorded_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── INDEXES ──

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_vp_platform ON video_performance(platform);
      CREATE INDEX IF NOT EXISTS idx_vp_tenant ON video_performance(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_vp_score ON video_performance(performance_score DESC);
      CREATE INDEX IF NOT EXISTS idx_vp_recorded ON video_performance(recorded_at DESC);
      CREATE INDEX IF NOT EXISTS idx_vp_tenant_platform ON video_performance(tenant_id, platform);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_rc_video ON retention_curves(video_id);
      CREATE INDEX IF NOT EXISTS idx_rc_quality ON retention_curves(retention_quality DESC);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_vp_cat ON viral_patterns(category);
      CREATE INDEX IF NOT EXISTS idx_vp_platform ON viral_patterns(platform);
      CREATE INDEX IF NOT EXISTS idx_vp_score ON viral_patterns(avg_score DESC);
      CREATE INDEX IF NOT EXISTS idx_vp_cat_platform ON viral_patterns(category, platform);
      CREATE INDEX IF NOT EXISTS idx_vp_samples ON viral_patterns(sample_count DESC);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pu_video ON pattern_usage(video_id);
      CREATE INDEX IF NOT EXISTS idx_pu_category ON pattern_usage(pattern_category);
      CREATE INDEX IF NOT EXISTS idx_pu_platform ON pattern_usage(platform);
    `);

    console.log("[Analytics] Analytics tables migration complete");
    console.log("[Analytics] Tables: video_performance, retention_curves, viral_patterns, pattern_usage");

  } catch (err) {
    console.error("[Analytics] Migration failed:", err.message);
    throw err;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateAnalytics()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { migrateAnalytics };
