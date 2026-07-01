/**
 * Brand Kit Engine
 *
 * Reusable brand system for multi-tenant video production.
 * Stores, resolves, and renders brand identities across HyperFrames
 * and FFmpeg fallback paths.
 *
 * Capabilities:
 *   - Brand profiles (logo, colors, fonts, CTA styles)
 *   - Scene branding (lower thirds, logo overlays, CTA colors, subtitle themes)
 *   - HyperFrames integration (HTML/CSS/GSAP composition)
 *   - FFmpeg fallback (logo overlay, watermark, brand colors)
 *   - Multi-tenant hierarchy (agency → client → workspace)
 *   - Theme presets (corporate, luxury, creator, fitness, real-estate, saas)
 *   - CTA templates (Book Call, Learn More, Visit Website, Claim Offer, Subscribe)
 *   - Asset caching (logos, watermarks, overlays)
 *
 * This module is ISOLATED — it does NOT modify engine4-video.cjs,
 * the worker queue, or the orchestrator flow.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ---------- CONSTANTS ----------

const CACHE_DIR = path.join(__dirname, "../../temp/brand-cache");
const MAX_CACHE_SIZE_MB = 500;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---------- DEFAULT BRAND KIT ----------

const DEFAULT_BRAND_KIT = {
  id: null,
  brandName: "ECM",
  tenantId: "default",
  isDefault: true,

  colors: {
    primary: "#e94560",
    secondary: "#533483",
    accent: "#FFD700",
    background: "#0f0c29",
    text: "#ffffff",
    textSecondary: "#e0e0e0",
  },

  logo: {
    url: null,
    position: "top-right",
    size: 60,
    opacity: 0.85,
    borderRadius: 8,
  },

  watermark: {
    enabled: false,
    opacity: 0.3,
    position: "bottom-right",
    size: 40,
  },

  typography: {
    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
    fontWeight: 700,
    headingWeight: 900,
  },

  cta: {
    style: "default",
    primaryColor: "#e94560",
    secondaryColor: "#533483",
    buttonColor: "#ffffff",
    buttonTextColor: "#e94560",
    borderRadius: 12,
    padding: "12px 24px",
    text: "Learn More",
  },

  subtitles: {
    preset: "hormozi",
    highlightColor: "#FFD700",
    glowColor: "rgba(255,215,0,0.6)",
  },

  lowerThird: {
    enabled: false,
    style: "minimal",
    backgroundColor: "rgba(0,0,0,0.7)",
    textColor: "#ffffff",
    accentColor: "#e94560",
  },

  theme: "default",
  colorGrading: null,
  source: "default",
};

// ---------- THEME PRESETS ----------

const THEME_PRESETS = {
  corporate: {
    label: "Corporate",
    colors: {
      primary: "#1a365d",
      secondary: "#2b6cb0",
      accent: "#3182ce",
      background: "#1a202c",
      text: "#ffffff",
      textSecondary: "#e0e0e0",
    },
    typography: { fontFamily: "Georgia, serif", fontWeight: 600 },
    cta: {
      style: "bordered",
      borderRadius: 4,
      buttonColor: "#3182ce",
      buttonTextColor: "#ffffff",
    },
    subtitles: { preset: "premium_corporate", highlightColor: "#63b3ed", glowColor: "rgba(99,179,237,0.4)" },
    colorGrading: "corporate",
    lowerThird: { enabled: true, style: "minimal", backgroundColor: "rgba(26,54,93,0.85)", accentColor: "#3182ce" },
  },
  luxury: {
    label: "Luxury",
    colors: {
      primary: "#b7791f",
      secondary: "#d69e2e",
      accent: "#ecc94b",
      background: "#1a1a2e",
      text: "#ffffff",
      textSecondary: "#e0e0e0",
    },
    typography: { fontFamily: "Georgia, serif", fontWeight: 400 },
    cta: {
      style: "minimal",
      borderRadius: 2,
      buttonColor: "#d69e2e",
      buttonTextColor: "#1a1a2e",
    },
    subtitles: { preset: "documentary", highlightColor: "#ecc94b", glowColor: "rgba(236,201,75,0.4)" },
    colorGrading: "luxury",
    lowerThird: { enabled: true, style: "elegant", backgroundColor: "rgba(26,26,46,0.85)", accentColor: "#d69e2e" },
  },
  creator: {
    label: "Creator",
    colors: {
      primary: "#e53e3e",
      secondary: "#dd6b20",
      accent: "#fbd38d",
      background: "#1a1a2e",
      text: "#ffffff",
      textSecondary: "#e0e0e0",
    },
    typography: { fontFamily: "-apple-system, sans-serif", fontWeight: 800 },
    cta: {
      style: "rounded",
      borderRadius: 24,
      buttonColor: "#e53e3e",
      buttonTextColor: "#ffffff",
    },
    subtitles: { preset: "hormozi", highlightColor: "#fbd38d", glowColor: "rgba(251,211,141,0.6)" },
    colorGrading: "social",
    lowerThird: { enabled: false },
  },
  fitness: {
    label: "Fitness",
    colors: {
      primary: "#2d3748",
      secondary: "#e53e3e",
      accent: "#fc8181",
      background: "#171923",
      text: "#ffffff",
      textSecondary: "#e0e0e0",
    },
    typography: { fontFamily: "Impact, sans-serif", fontWeight: 900 },
    cta: {
      style: "bold",
      borderRadius: 8,
      buttonColor: "#e53e3e",
      buttonTextColor: "#ffffff",
    },
    subtitles: { preset: "hormozi", highlightColor: "#fc8181", glowColor: "rgba(252,129,129,0.6)" },
    colorGrading: "dramatic",
    lowerThird: { enabled: true, style: "minimal", backgroundColor: "rgba(45,55,72,0.85)", accentColor: "#e53e3e" },
  },
  "real-estate": {
    label: "Real Estate",
    colors: {
      primary: "#2c5282",
      secondary: "#2b6cb0",
      accent: "#63b3ed",
      background: "#1a365d",
      text: "#ffffff",
      textSecondary: "#e0e0e0",
    },
    typography: { fontFamily: "Georgia, serif", fontWeight: 600 },
    cta: {
      style: "bordered",
      borderRadius: 6,
      buttonColor: "#2b6cb0",
      buttonTextColor: "#ffffff",
    },
    subtitles: { preset: "premium_corporate", highlightColor: "#63b3ed", glowColor: "rgba(99,179,237,0.4)" },
    colorGrading: "corporate",
    lowerThird: { enabled: true, style: "minimal", backgroundColor: "rgba(44,82,130,0.85)", accentColor: "#63b3ed" },
  },
  saas: {
    label: "SaaS",
    colors: {
      primary: "#5a67d8",
      secondary: "#667eea",
      accent: "#a3bffa",
      background: "#1a202c",
      text: "#ffffff",
      textSecondary: "#e0e0e0",
    },
    typography: { fontFamily: "-apple-system, sans-serif", fontWeight: 700 },
    cta: {
      style: "gradient",
      borderRadius: 12,
      buttonColor: "#667eea",
      buttonTextColor: "#ffffff",
    },
    subtitles: { preset: "tiktok", highlightColor: "#a3bffa", glowColor: "rgba(163,191,250,0.5)" },
    colorGrading: "cinematic",
    lowerThird: { enabled: true, style: "minimal", backgroundColor: "rgba(90,103,216,0.85)", accentColor: "#a3bffa" },
  },
};

// ---------- CTA TEMPLATES ----------

const CTA_TEMPLATES = {
  book_call: {
    label: "Book Call",
    text: "Book a Free Call",
    style: "rounded",
    urgency: "medium",
  },
  learn_more: {
    label: "Learn More",
    text: "Learn More",
    style: "bordered",
    urgency: "low",
  },
  visit_website: {
    label: "Visit Website",
    text: "Visit Our Website",
    style: "minimal",
    urgency: "low",
  },
  claim_offer: {
    label: "Claim Offer",
    text: "Claim Your Offer Now",
    style: "bold",
    urgency: "high",
  },
  subscribe: {
    label: "Subscribe",
    text: "Subscribe Today",
    style: "gradient",
    urgency: "medium",
  },
};

// ---------- HELPERS ----------

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`
    : "255,255,255";
}

function deepMerge(target, source) {
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] === null || source[key] === undefined) continue;
    if (typeof source[key] === "object" && !Array.isArray(source[key]) && source[key] !== null) {
      output[key] = deepMerge(output[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

function getPositionStyles(position, size, width, height) {
  const margin = 10;
  switch (position) {
    case "top-right":
      return `top:${margin}px; right:${margin}px`;
    case "top-left":
      return `top:${margin}px; left:${margin}px`;
    case "bottom-right":
      return `bottom:${margin}px; right:${margin}px`;
    case "bottom-left":
      return `bottom:${margin}px; left:${margin}px`;
    case "center":
      return `top:50%; left:50%; transform:translate(-50%,-50%)`;
    default:
      return `top:${margin}px; right:${margin}px`;
  }
}

// ---------- BRAND ASSET CACHE ----------

class BrandAssetCache {
  constructor() {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  generateCacheKey(brandId, assetType, assetUrl) {
    return crypto
      .createHash("md5")
      .update(`${brandId}:${assetType}:${assetUrl}`)
      .digest("hex")
      .substring(0, 12);
  }

  getCachedAsset(brandId, assetType, assetUrl) {
    const key = this.generateCacheKey(brandId, assetType, assetUrl);
    const ext = path.extname(assetUrl) || ".png";
    const cachedPath = path.join(CACHE_DIR, `${key}${ext}`);
    if (fs.existsSync(cachedPath)) {
      const stat = fs.statSync(cachedPath);
      if (Date.now() - stat.mtimeMs < CACHE_TTL_MS) {
        return cachedPath;
      }
    }
    return null;
  }

  async cacheAsset(brandId, assetType, assetUrl) {
    const existing = this.getCachedAsset(brandId, assetType, assetUrl);
    if (existing) return existing;

    try {
      const axios = require("axios");
      const key = this.generateCacheKey(brandId, assetType, assetUrl);
      const ext = path.extname(assetUrl) || ".png";
      const cachedPath = path.join(CACHE_DIR, `${key}${ext}`);

      const response = await axios({ url: assetUrl, responseType: "stream", timeout: 15000 });
      const writer = fs.createWriteStream(cachedPath);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      return cachedPath;
    } catch (err) {
      console.warn(`[BrandKit] Asset cache failed for ${assetUrl}:`, err.message);
      return null;
    }
  }

  getCacheStats() {
    try {
      const files = fs.readdirSync(CACHE_DIR);
      let totalSize = 0;
      for (const f of files) {
        totalSize += fs.statSync(path.join(CACHE_DIR, f)).size;
      }
      return { files: files.length, sizeMB: Math.round(totalSize / 1024 / 1024) };
    } catch {
      return { files: 0, sizeMB: 0 };
    }
  }
}

// ---------- BRAND KIT RESOLVER ----------

class BrandKitResolver {
  /**
   * Resolve a brand kit from database row(s) with hierarchy merge.
   */
  static resolve(dbBrandKit, parentBrandKit, themePreset) {
    let resolved = { ...DEFAULT_BRAND_KIT };

    // Layer 1: Theme preset
    if (themePreset && THEME_PRESETS[themePreset]) {
      const theme = THEME_PRESETS[themePreset];
      resolved = deepMerge(resolved, {
        colors: theme.colors,
        typography: theme.typography,
        cta: theme.cta,
        subtitles: theme.subtitles,
        colorGrading: theme.colorGrading,
        lowerThird: theme.lowerThird || resolved.lowerThird,
        theme: themePreset,
      });
    }

    // Layer 2: Parent (agency/client) overrides
    if (parentBrandKit) {
      resolved = deepMerge(resolved, BrandKitResolver.dbRowToConfig(parentBrandKit));
    }

    // Layer 3: Brand-specific overrides
    if (dbBrandKit) {
      const brandConfig = BrandKitResolver.dbRowToConfig(dbBrandKit);
      resolved = deepMerge(resolved, brandConfig);
      resolved.id = dbBrandKit.id;
      resolved.tenantId = dbBrandKit.tenant_id;
      resolved.isDefault = dbBrandKit.is_default;
      resolved.source = "brand_kits";
    }

    return resolved;
  }

  /**
   * Convert a database row to a brand config object.
   */
  static dbRowToConfig(row) {
    if (!row) return {};
    return {
      brandName: row.brand_name || undefined,
      colors: {
        primary: row.primary_color || undefined,
        secondary: row.secondary_color || undefined,
        accent: row.accent_color || undefined,
        background: row.background_color || undefined,
      },
      logo: {
        url: row.logo_url || undefined,
        position: row.logo_position || undefined,
        size: row.logo_size || undefined,
        opacity: row.logo_opacity || undefined,
      },
      watermark: {
        enabled: row.watermark_enabled || undefined,
        opacity: row.watermark_opacity || undefined,
        position: row.watermark_position || undefined,
        size: row.watermark_size || undefined,
      },
      typography: {
        fontFamily: row.font_family || undefined,
        fontWeight: row.font_weight || undefined,
      },
      cta: {
        style: row.cta_style || undefined,
        primaryColor: row.cta_primary_color || undefined,
        secondaryColor: row.cta_secondary_color || undefined,
        buttonColor: row.cta_button_color || undefined,
        buttonTextColor: row.cta_button_text_color || undefined,
        text: row.cta_text || undefined,
      },
      subtitles: {
        preset: row.subtitle_preset || undefined,
        highlightColor: row.subtitle_highlight_color || undefined,
        glowColor: row.subtitle_glow_color || undefined,
      },
      colorGrading: row.color_grading || undefined,
      lowerThird: {
        enabled: row.lower_third_enabled || undefined,
        style: row.lower_third_style || undefined,
      },
      theme: row.theme || undefined,
    };
  }
}

// ---------- BRAND KIT ENGINE ----------

class BrandKitEngine {
  constructor(options = {}) {
    this.cache = new BrandAssetCache();
    this.dbPool = options.dbPool || null;
  }

  /**
   * Resolve a brand kit from input data.
   * Tries: input.brandKit → DB lookup by brand_id/tenant_id → theme preset → defaults
   */
  async resolveFromInput(input) {
    // If brandKit is already resolved in input, use it
    if (input.brandKit && input.brandKit.source) {
      return input.brandKit;
    }

    const brandId = input.brand_id || input.brandId || null;
    const tenantId = input.tenant_id || input.tenantId || "default";
    const theme = input.theme || input.brandTheme || null;

    // Try DB lookup
    if (this.dbPool && brandId) {
      try {
        const result = await this.dbPool.query(
          "SELECT * FROM brand_kits WHERE id = $1 OR (tenant_id = $2 AND is_default = true) LIMIT 1",
          [brandId, tenantId]
        );
        if (result.rows.length > 0) {
          const dbBrand = result.rows[0];
          let parentBrand = null;

          if (dbBrand.parent_brand_id) {
            const parentResult = await this.dbPool.query(
              "SELECT * FROM brand_kits WHERE id = $1",
              [dbBrand.parent_brand_id]
            );
            parentBrand = parentResult.rows[0] || null;
          }

          const resolved = BrandKitResolver.resolve(dbBrand, parentBrand, theme || dbBrand.theme);

          // Cache logo if present
          if (resolved.logo.url) {
            const cachedLogo = await this.cache.cacheAsset(resolved.id, "logo", resolved.logo.url);
            if (cachedLogo) resolved.logo.url = cachedLogo;
          }

          return resolved;
        }
      } catch (err) {
        console.warn("[BrandKit] DB lookup failed:", err.message);
      }
    }

    // Try theme preset only
    if (theme && THEME_PRESETS[theme]) {
      return BrandKitResolver.resolve(null, null, theme);
    }

    // Defaults
    return { ...DEFAULT_BRAND_KIT, source: "default" };
  }

  /**
   * Resolve brand kit from SceneManager scenes (for use inside composition).
   */
  resolveFromScenes(scenes, options = {}) {
    // Extract brand data from scene metadata if available
    const firstScene = scenes.find(s => s.metadata && s.metadata.brandKit);
    if (firstScene && firstScene.metadata.brandKit) {
      return firstScene.metadata.brandKit;
    }
    return options.brandKit || { ...DEFAULT_BRAND_KIT, source: "default" };
  }

  // ── HYPERFRAMES INTEGRATION ──

  /**
   * Generate logo overlay HTML and GSAP for HyperFrames composition.
   */
  generateLogoOverlay(brandKit, options = {}) {
    if (!brandKit || !brandKit.logo || !brandKit.logo.url) {
      return { html: [], gsap: [] };
    }

    const { position, size, opacity, borderRadius } = brandKit.logo;
    const width = options.width || 720;
    const height = options.height || 1280;
    const posStyles = getPositionStyles(position, size, width, height);

    return {
      html: [
        `<img id="brand-logo" class="logo-overlay" src="assets/brand-logo.png"
      style="position:absolute; ${posStyles}; width:${size}px; height:auto;
      opacity:${opacity}; border-radius:${borderRadius}px;
      pointer-events:none; z-index:100;" />`,
      ],
      gsap: [
        `// Brand logo fade-in
tl.fromTo("#brand-logo", { opacity: 0, scale: 0.8 }, {
  opacity: ${opacity}, scale: 1.0, duration: 0.5, ease: "back.out(1.7)"
}, 0);`,
      ],
    };
  }

  /**
   * Generate watermark overlay HTML and GSAP for HyperFrames.
   */
  generateWatermark(brandKit, options = {}) {
    if (!brandKit || !brandKit.watermark || !brandKit.watermark.enabled) {
      return { html: [], gsap: [] };
    }

    const { position, size, opacity } = brandKit.watermark;
    const width = options.width || 720;
    const height = options.height || 1280;
    const posStyles = getPositionStyles(position, size, width, height);
    const totalDuration = options.totalDuration || 55;

    // Use logo if available, otherwise text watermark
    if (brandKit.logo.url) {
      return {
        html: [
          `<img id="brand-watermark" class="watermark-overlay" src="assets/brand-logo.png"
      style="position:absolute; ${posStyles}; width:${size}px; height:auto;
      opacity:${opacity}; pointer-events:none; z-index:90;" />`,
        ],
        gsap: [
          `// Watermark subtle pulse
tl.to("#brand-watermark", {
  opacity: ${opacity * 0.7}, duration: ${totalDuration * 0.5}, ease: "sine.inOut", yoyo: true, repeat: 1
}, 0);`,
        ],
      };
    }

    // Text watermark fallback
    return {
      html: [
        `<div id="brand-watermark" class="watermark-overlay"
      style="position:absolute; ${posStyles}; font-size:${size * 0.4}px;
      opacity:${opacity}; color:${brandKit.colors.text}; font-family:${brandKit.typography.fontFamily};
      pointer-events:none; z-index:90; letter-spacing:2px;">${brandKit.brandName}</div>`,
        ],
      gsap: [
        `// Watermark fade
tl.fromTo("#brand-watermark", { opacity: 0 }, {
  opacity: ${opacity}, duration: 1.0, ease: "power1.out"
}, 0);`,
      ],
    };
  }

  /**
   * Generate lower-third HTML and GSAP for HyperFrames.
   */
  generateLowerThird(brandKit, text, options = {}) {
    if (!brandKit || !brandKit.lowerThird || !brandKit.lowerThird.enabled) {
      return { html: [], gsap: [] };
    }

    const { colors, lowerThird, typography } = brandKit;
    const width = options.width || 720;
    const totalDuration = options.totalDuration || 55;
    const sceneStart = options.sceneStart || 0;

    return {
      html: [
        `<div id="lower-third" class="lower-third"
      style="position:absolute; bottom:280px; left:24px; right:24px;
      background:${lowerThird.backgroundColor}; border-left:3px solid ${lowerThird.accentColor};
      padding:12px 16px; border-radius:4px; z-index:50;">
      <span style="color:${lowerThird.textColor || colors.text}; font-family:${typography.fontFamily};
      font-weight:${typography.fontWeight}; font-size:16px; display:block;">${text || brandKit.brandName}</span>
    </div>`,
      ],
      gsap: [
        `// Lower third slide-in
tl.fromTo("#lower-third", { x: -200, opacity: 0 }, {
  x: 0, opacity: 1, duration: 0.4, ease: "power2.out"
}, ${sceneStart + 0.5});
tl.to("#lower-third", { x: -200, opacity: 0, duration: 0.3, ease: "power2.in" },
  ${sceneStart + totalDuration - 1});`,
      ],
    };
  }

  /**
   * Generate CTA style CSS and GSAP overrides for HyperFrames.
   */
  generateCTAStyle(brandKit, options = {}) {
    if (!brandKit || !brandKit.cta) {
      return { css: "", gsap: [] };
    }

    const { cta, colors, typography } = brandKit;

    const styleMap = {
      default: `background: linear-gradient(135deg, ${cta.primaryColor || colors.primary} 0%, ${cta.secondaryColor || colors.secondary} 100%)`,
      bordered: `background: transparent; border: 2px solid ${cta.buttonColor}; color: ${cta.buttonColor}`,
      rounded: `background: ${cta.buttonColor}; border-radius: ${cta.borderRadius * 2}px`,
      bold: `background: ${cta.buttonColor}; text-transform: uppercase; letter-spacing: 2px`,
      gradient: `background: linear-gradient(90deg, ${cta.primaryColor || colors.primary}, ${cta.secondaryColor || colors.secondary})`,
      minimal: `background: transparent; border-bottom: 2px solid ${cta.buttonColor}; border-radius: 0`,
    };

    return {
      css: `
      .cta-overlay {
        ${styleMap[cta.style] || styleMap.default} !important;
        border-radius: ${cta.borderRadius}px !important;
      }
      .cta-button {
        background: ${cta.buttonColor} !important;
        color: ${cta.buttonTextColor} !important;
        font-family: ${typography.fontFamily} !important;
        border-radius: ${cta.borderRadius}px !important;
      }
      .cta-text {
        font-family: ${typography.fontFamily} !important;
      }
    `,
      gsap: [],
    };
  }

  /**
   * Generate subtitle color overrides.
   */
  generateSubtitleOverrides(brandKit) {
    if (!brandKit || !brandKit.subtitles) {
      return null;
    }

    const { subtitles, colors } = brandKit;
    return {
      highlightColor: subtitles.highlightColor || colors.accent,
      glowColor: subtitles.glowColor || `rgba(${hexToRgb(colors.accent)},0.6)`,
      color: colors.text,
    };
  }

  /**
   * Generate CSS custom properties for brand colors.
   */
  generateCSSCustomProperties(brandKit) {
    if (!brandKit || !brandKit.colors) return "";

    return `
    :root {
      --brand-primary: ${brandKit.colors.primary};
      --brand-secondary: ${brandKit.colors.secondary};
      --brand-accent: ${brandKit.colors.accent};
      --brand-background: ${brandKit.colors.background};
      --brand-text: ${brandKit.colors.text};
      --brand-text-secondary: ${brandKit.colors.textSecondary};
      --brand-font: ${brandKit.typography.fontFamily};
      --brand-font-weight: ${brandKit.typography.fontWeight};
    }
  `;
  }

  // ── FFMPEG FALLBACK INTEGRATION ──

  /**
   * Generate FFmpeg filter for logo overlay.
   */
  generateFFmpegLogoOverlay(brandKit, options = {}) {
    if (!brandKit || !brandKit.logo || !brandKit.logo.url) return null;

    const { position, size, opacity } = brandKit.logo;
    const width = options.width || 720;
    const height = options.height || 1280;

    const posMap = {
      "top-right": `overlay=main_w-overlay_w-${size}:10`,
      "top-left": `overlay=10:10`,
      "bottom-right": `overlay=main_w-overlay_w-${size}:main_h-overlay_h-10`,
      "bottom-left": `overlay=10:main_h-overlay_h-10`,
      "center": `overlay=(main_w-overlay_w)/2:(main_h-overlay_h)/2`,
    };

    const overlayPos = posMap[position] || posMap["top-right"];

    return {
      input: `-i "${brandKit.logo.url}"`,
      filter: `overlay=${overlayPos}:format=auto:alpha=1`,
    };
  }

  /**
   * Generate FFmpeg filter for watermark overlay.
   */
  generateFFmpegWatermark(brandKit, options = {}) {
    if (!brandKit || !brandKit.watermark || !brandKit.watermark.enabled) return null;

    const { position, size, opacity } = brandKit.watermark;

    // Watermark uses logo image if available
    if (brandKit.logo.url) {
      const posMap = {
        "top-right": `overlay=main_w-overlay_w-${size}:10`,
        "top-left": `overlay=10:10`,
        "bottom-right": `overlay=main_w-overlay_w-${size}:main_h-overlay_h-10`,
        "bottom-left": `overlay=10:main_h-overlay_h-10`,
      };

      return {
        input: `-i "${brandKit.logo.url}"`,
        filter: `overlay=${posMap[position] || posMap["bottom-right"]}:format=auto:alpha=1`,
      };
    }

    // Text watermark via drawtext
    return {
      input: null,
      filter: `drawtext=text='${brandKit.brandName}':fontsize=${size * 0.4}:fontcolor=white@${opacity}:x=w-tw-10:y=h-th-10`,
    };
  }

  /**
   * Generate FFmpeg color grading filter for brand.
   */
  generateFFmpegBrandFilter(brandKit, baseFilter) {
    if (!brandKit || !brandKit.colorGrading) return baseFilter || null;
    // Brand color grading is applied via visual-quality.cjs integration
    // This is a passthrough for brand-specific tinting
    return baseFilter;
  }
}

// ---------- EXPORTS ----------

module.exports = {
  BrandKitEngine,
  BrandKitResolver,
  BrandAssetCache,
  DEFAULT_BRAND_KIT,
  THEME_PRESETS,
  CTA_TEMPLATES,
  hexToRgb,
  deepMerge,
};
