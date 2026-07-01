const dotenv = require('dotenv');
const { join } = require('path');

dotenv.config({ path: join(__dirname, '../.env') });

const pool = require('./client.cjs');

async function migrateBrandKit() {
  if (!pool) {
    console.log("[BrandKit] Database disabled — skipping brand_kits migration");
    return;
  }

  try {
    console.log("[BrandKit] Running brand_kits table migration...");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS brand_kits (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        brand_name VARCHAR(255) NOT NULL DEFAULT 'Default Brand',
        is_default BOOLEAN DEFAULT false,

        primary_color VARCHAR(7) DEFAULT '#e94560',
        secondary_color VARCHAR(7) DEFAULT '#533483',
        accent_color VARCHAR(7) DEFAULT '#FFD700',
        background_color VARCHAR(7) DEFAULT '#0f0c29',

        logo_url TEXT,
        logo_position VARCHAR(20) DEFAULT 'top-right',
        logo_size INTEGER DEFAULT 60,
        logo_opacity DECIMAL(3,2) DEFAULT 0.85,

        watermark_enabled BOOLEAN DEFAULT false,
        watermark_opacity DECIMAL(3,2) DEFAULT 0.3,
        watermark_position VARCHAR(20) DEFAULT 'bottom-right',
        watermark_size INTEGER DEFAULT 40,

        font_family VARCHAR(100) DEFAULT '-apple-system, BlinkMacSystemFont, sans-serif',
        font_weight INTEGER DEFAULT 700,

        cta_style VARCHAR(50) DEFAULT 'default',
        cta_primary_color VARCHAR(7),
        cta_secondary_color VARCHAR(7),
        cta_button_color VARCHAR(7),
        cta_button_text_color VARCHAR(7) DEFAULT '#ffffff',
        cta_text VARCHAR(255),

        subtitle_preset VARCHAR(50) DEFAULT 'hormozi',
        subtitle_highlight_color VARCHAR(7),
        subtitle_glow_color VARCHAR(30),

        theme VARCHAR(50) DEFAULT 'default',
        color_grading VARCHAR(50),

        lower_third_enabled BOOLEAN DEFAULT false,
        lower_third_style VARCHAR(50) DEFAULT 'minimal',

        parent_brand_id INTEGER REFERENCES brand_kits(id),
        hierarchy_level VARCHAR(20) DEFAULT 'workspace'
          CHECK (hierarchy_level IN ('agency', 'client', 'workspace')),

        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_brand_kits_tenant_id ON brand_kits(tenant_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_brand_kits_parent ON brand_kits(parent_brand_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_brand_kits_default ON brand_kits(tenant_id, is_default)
        WHERE is_default = true
    `);

    console.log("[BrandKit] brand_kits table migration complete");
  } catch (err) {
    console.error("[BrandKit] Migration failed:", err.message);
  }
}

if (require.main === module) {
  migrateBrandKit().then(() => process.exit(0));
}

module.exports = migrateBrandKit;
