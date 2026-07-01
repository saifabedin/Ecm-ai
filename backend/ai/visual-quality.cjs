/**
 * Visual Quality Engine
 *
 * Automatically enhances every generated video with cinematic effects,
 * color grading, camera motion, film effects, and scene-aware logic.
 *
 * Integrates with:
 *   - HyperFrames (composition-generator.cjs) via CSS filters + GSAP animations
 *   - FFmpeg fallback (engine4-video.cjs) via filter_complex chains
 *
 * Scene-aware processing:
 *   HOOK:   aggressive zoom, stronger contrast
 *   STORY:  smoother motion, balanced grading
 *   PEAK:   stronger highlights, more motion energy
 *   CTA:    cleaner image, brighter grade
 */

const fs = require('fs');
const path = require('path');

// ─── COLOR GRADING PROFILES ───────────────────────────────────────────────────
// Each profile defines FFmpeg eq values and CSS filter equivalents.

const COLOR_GRADING_PROFILES = {
  cinematic: {
    label: 'Cinematic',
    ffmpeg: {
      brightness: 0.02,
      contrast: 1.15,
      saturation: 1.05,
      gamma: 0.95,
    },
    css: {
      filter: 'contrast(1.15) saturate(1.05) brightness(1.02) gamma(0.95)',
      overlay: 'linear-gradient(180deg, rgba(20,10,40,0.15) 0%, transparent 40%, transparent 60%, rgba(10,20,50,0.2) 100%)',
    },
  },
  corporate: {
    label: 'Corporate',
    ffmpeg: {
      brightness: 0.04,
      contrast: 1.08,
      saturation: 0.92,
      gamma: 1.02,
    },
    css: {
      filter: 'contrast(1.08) saturate(0.92) brightness(1.04)',
      overlay: 'linear-gradient(180deg, rgba(10,20,40,0.08) 0%, transparent 50%, rgba(10,20,40,0.08) 100%)',
    },
  },
  social: {
    label: 'Social',
    ffmpeg: {
      brightness: 0.05,
      contrast: 1.18,
      saturation: 1.25,
      gamma: 0.92,
    },
    css: {
      filter: 'contrast(1.18) saturate(1.25) brightness(1.05)',
      overlay: 'linear-gradient(180deg, rgba(255,100,50,0.06) 0%, transparent 50%, rgba(50,100,255,0.06) 100%)',
    },
  },
  luxury: {
    label: 'Luxury',
    ffmpeg: {
      brightness: -0.02,
      contrast: 1.22,
      saturation: 0.88,
      gamma: 0.88,
    },
    css: {
      filter: 'contrast(1.22) saturate(0.88) brightness(0.98) sepia(0.08)',
      overlay: 'linear-gradient(180deg, rgba(30,20,10,0.18) 0%, transparent 40%, rgba(20,10,30,0.22) 100%)',
    },
  },
  dramatic: {
    label: 'Dramatic',
    ffmpeg: {
      brightness: -0.04,
      contrast: 1.35,
      saturation: 0.95,
      gamma: 0.82,
    },
    css: {
      filter: 'contrast(1.35) saturate(0.95) brightness(0.96)',
      overlay: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, transparent 35%, transparent 65%, rgba(0,0,0,0.3) 100%)',
    },
  },
};

// ─── CAMERA MOTION EFFECTS ────────────────────────────────────────────────────
// Each effect generates GSAP animation targets for #camera-container.

const CAMERA_MOTION_EFFECTS = {
  slow_push_in: {
    label: 'Slow Push-In',
    gsap: (duration, width, height) => ({
      from: { scale: 1.0, x: 0, y: 0 },
      to: { scale: 1.08, x: -(width * 0.02), y: -(height * 0.015) },
      duration,
      ease: 'power1.out',
    }),
  },
  dynamic_zoom: {
    label: 'Dynamic Zoom',
    gsap: (duration, width, height) => ({
      from: { scale: 1.02 },
      to: { scale: 1.18 },
      duration,
      ease: 'power2.inOut',
    }),
  },
  micro_shake: {
    label: 'Micro Shake',
    gsap: (duration, width, height) => ({
      type: 'shake',
      amplitude: 2,
      frequency: 12,
      duration,
    }),
  },
  parallax_motion: {
    label: 'Parallax Motion',
    gsap: (duration, width, height) => ({
      from: { x: width * 0.04, y: 0 },
      to: { x: -(width * 0.04), y: -(height * 0.01) },
      duration,
      ease: 'none',
    }),
  },
};

// ─── FILM EFFECTS ─────────────────────────────────────────────────────────────
// Film effects for both CSS (HyperFrames) and FFmpeg (fallback).

const FILM_EFFECTS = {
  film_grain: {
    label: 'Film Grain',
    css: {
      noise: true,
      opacity: 0.06,
      blendMode: 'overlay',
    },
    ffmpeg: 'noise=c0s=8:allf=t',
  },
  light_leaks: {
    label: 'Light Leaks',
    css: {
      gradient: 'radial-gradient(ellipse at 75% 20%, rgba(255,200,100,0.18) 0%, transparent 50%)',
      blendMode: 'screen',
    },
    ffmpeg: null,
  },
  vignette: {
    label: 'Vignette',
    css: {
      gradient: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)',
      blendMode: 'multiply',
    },
    ffmpeg: 'vignette=PI/4:0.4',
  },
  soft_bloom: {
    label: 'Soft Bloom',
    css: {
      filter: 'blur(0.5px) brightness(1.08)',
      opacity: 0.15,
      blendMode: 'screen',
    },
    ffmpeg: 'gblur=sigma=1.5,curves=all=0/0 0.5/0.55 1/1',
  },
};

// ─── SCENE-AWARE EFFECT PRESETS ───────────────────────────────────────────────
// Maps scene types to specific visual quality settings.

const SCENE_EFFECT_MAP = {
  hook: {
    description: 'Aggressive zoom, stronger contrast — grab attention',
    colorGrading: 'dramatic',
    cameraMotion: 'dynamic_zoom',
    filmEffects: ['vignette', 'light_leaks'],
    contrastBoost: 1.25,
    saturationBoost: 1.15,
    motionIntensity: 'high',
  },
  story: {
    description: 'Smoother motion, balanced grading — tell the story',
    colorGrading: 'cinematic',
    cameraMotion: 'slow_push_in',
    filmEffects: ['soft_bloom', 'vignette'],
    contrastBoost: 1.0,
    saturationBoost: 1.0,
    motionIntensity: 'low',
  },
  peak: {
    description: 'Stronger highlights, more motion energy — emotional peak',
    colorGrading: 'dramatic',
    cameraMotion: 'parallax_motion',
    filmEffects: ['film_grain', 'light_leaks', 'vignette'],
    contrastBoost: 1.3,
    saturationBoost: 1.2,
    motionIntensity: 'high',
  },
  cta: {
    description: 'Cleaner image, brighter grade — call to action',
    colorGrading: 'corporate',
    cameraMotion: 'slow_push_in',
    filmEffects: ['vignette'],
    contrastBoost: 1.05,
    saturationBoost: 0.95,
    motionIntensity: 'medium',
  },
};

// ─── EXPORT PROFILES ──────────────────────────────────────────────────────────
// Platform-specific visual quality presets.

const EXPORT_PROFILES = {
  youtube_shorts: {
    label: 'YouTube Shorts',
    colorGrading: 'cinematic',
    filmEffects: ['vignette', 'soft_bloom'],
    cameraMotion: 'slow_push_in',
    resolution: '1080x1920',
    fps: 30,
    crf: 18,
    preset: 'slow',
    maxBitrate: '5000k',
    audioSampleRate: 48000,
  },
  instagram_reels: {
    label: 'Instagram Reels',
    colorGrading: 'social',
    filmEffects: ['vignette', 'light_leaks'],
    cameraMotion: 'dynamic_zoom',
    resolution: '1080x1920',
    fps: 30,
    crf: 18,
    preset: 'medium',
    maxBitrate: '3500k',
    audioSampleRate: 48000,
  },
  tiktok: {
    label: 'TikTok',
    colorGrading: 'social',
    filmEffects: ['vignette', 'light_leaks'],
    cameraMotion: 'parallax_motion',
    resolution: '1080x1920',
    fps: 30,
    crf: 18,
    preset: 'medium',
    maxBitrate: '3000k',
    audioSampleRate: 44100,
  },
  premium: {
    label: 'Premium',
    colorGrading: 'luxury',
    filmEffects: ['film_grain', 'vignette', 'soft_bloom', 'light_leaks'],
    cameraMotion: 'slow_push_in',
    resolution: '1080x1920',
    fps: 30,
    crf: 15,
    preset: 'veryslow',
    maxBitrate: '6000k',
    audioSampleRate: 48000,
  },
};

// ─── CSS FILTER BUILDER (HyperFrames) ─────────────────────────────────────────

/**
 * Build CSS filter string for a color grading profile.
 */
function buildCssFilter(colorGradingProfile) {
  const profile = COLOR_GRADING_PROFILES[colorGradingProfile] || COLOR_GRADING_PROFILES.cinematic;
  return profile.css.filter;
}

/**
 * Build CSS overlay gradients for color grading + film effects.
 */
function buildCssOverlays(colorGradingProfile, filmEffects = []) {
  const overlays = [];
  const profile = COLOR_GRADING_PROFILES[colorGradingProfile] || COLOR_GRADING_PROFILES.cinematic;

  if (profile.css.overlay) {
    overlays.push({
      type: 'gradient',
      gradient: profile.css.overlay,
      blendMode: 'normal',
      zIndex: 50,
    });
  }

  for (const fxName of filmEffects) {
    const fx = FILM_EFFECTS[fxName];
    if (!fx || !fx.css) continue;

    if (fx.css.gradient) {
      overlays.push({
        type: 'gradient',
        gradient: fx.css.gradient,
        blendMode: fx.css.blendMode || 'screen',
        zIndex: 51,
      });
    }
  }

  return overlays;
}

/**
 * Build CSS noise overlay for film grain.
 */
function buildFilmGrainCss(filmEffects = []) {
  const hasGrain = filmEffects.includes('film_grain');
  if (!hasGrain) return '';

  const grainConfig = FILM_EFFECTS.film_grain.css;
  return `
    .vq-film-grain {
      position: absolute;
      inset: 0;
      z-index: 55;
      opacity: ${grainConfig.opacity};
      mix-blend-mode: ${grainConfig.blendMode};
      pointer-events: none;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
      background-size: 256px 256px;
      animation: grain 0.5s steps(6) infinite;
    }
    @keyframes grain {
      0%, 100% { transform: translate(0, 0); }
      10% { transform: translate(-5%, -10%); }
      20% { transform: translate(-15%, 5%); }
      30% { transform: translate(7%, -25%); }
      40% { transform: translate(-5%, 25%); }
      50% { transform: translate(-15%, 10%); }
      60% { transform: translate(15%, 0%); }
      70% { transform: translate(0%, 15%); }
      80% { transform: translate(3%, 35%); }
      90% { transform: translate(-10%, 10%); }
    }
  `;
}

// ─── GSAP CAMERA MOTION BUILDER (HyperFrames) ────────────────────────────────

/**
 * Generate GSAP camera motion code for a scene.
 */
function buildCameraMotionGsap(sceneType, sceneDuration, options = {}) {
  const width = options.width || 720;
  const height = options.height || 1280;

  const effectName = SCENE_EFFECT_MAP[sceneType]?.cameraMotion || 'slow_push_in';
  const effect = CAMERA_MOTION_EFFECTS[effectName];
  if (!effect) return '';

  const motion = effect.gsap(sceneDuration, width, height);

  if (motion.type === 'shake') {
    // Micro-shake: generate procedural shake keyframes
    const steps = Math.floor(sceneDuration * motion.frequency);
    let code = `// Camera: ${sceneType} ${effect.label} [0s-${sceneDuration.toFixed(2)}s]\n`;
    code += `tl.fromTo("#camera-container", { x: 0, y: 0 }, {\n`;
    code += `  x: "random(-${motion.amplitude}, ${motion.amplitude})",\n`;
    code += `  y: "random(-${motion.amplitude * 0.6}, ${motion.amplitude * 0.6})",\n`;
    code += `  duration: ${sceneDuration.toFixed(2)},\n`;
    code += `  ease: "none",\n`;
    code += `  repeatRefresh: true,\n`;
    code += `}, 0);\n`;
    return code;
  }

  let code = `// Camera: ${sceneType} ${effect.label} [0s-${sceneDuration.toFixed(2)}s]\n`;
  code += `tl.fromTo("#camera-container", {\n`;
  code += `  scale: ${motion.from.scale || 1.0},\n`;
  if (motion.from.x !== undefined) code += `  x: ${Math.round(motion.from.x)},\n`;
  if (motion.from.y !== undefined) code += `  y: ${Math.round(motion.from.y)},\n`;
  code += `}, {\n`;
  code += `  scale: ${motion.to.scale || 1.0},\n`;
  if (motion.to.x !== undefined) code += `  x: ${Math.round(motion.to.x)},\n`;
  if (motion.to.y !== undefined) code += `  y: ${Math.round(motion.to.y)},\n`;
  code += `  duration: ${sceneDuration.toFixed(2)},\n`;
  code += `  ease: "${motion.ease || 'none'}",\n`;
  code += `}, 0);\n`;
  return code;
}

// ─── FFMPEG FILTER BUILDER (Fallback) ────────────────────────────────────────

/**
 * Build FFmpeg -vf filter chain for color grading.
 */
function buildFfmpegColorFilter(colorGradingProfile, sceneType = null, directorVisual = null) {
  // Director Plan: override color grading if specified
  const profileName = directorVisual
    ? (directorVisual.colorGrading || (sceneType ? SCENE_EFFECT_MAP[sceneType]?.colorGrading : null) || colorGradingProfile)
    : (sceneType ? (SCENE_EFFECT_MAP[sceneType]?.colorGrading || colorGradingProfile) : colorGradingProfile);

  const profile = COLOR_GRADING_PROFILES[profileName] || COLOR_GRADING_PROFILES.cinematic;
  const sceneConfig = SCENE_EFFECT_MAP[sceneType] || {};

  // Director Plan: use director's contrast/saturation boosts if available
  const contrastBoost = directorVisual ? (directorVisual.contrastBoost || sceneConfig.contrastBoost || 1.0) : (sceneConfig.contrastBoost || 1.0);
  const saturationBoost = directorVisual ? (directorVisual.saturationBoost || sceneConfig.saturationBoost || 1.0) : (sceneConfig.saturationBoost || 1.0);

  const brightness = profile.ffmpeg.brightness + (contrastBoost > 1.2 ? -0.02 : 0);
  const contrast = profile.ffmpeg.contrast * contrastBoost;
  const saturation = profile.ffmpeg.saturation * saturationBoost;
  const gamma = profile.ffmpeg.gamma;

  return `eq=brightness=${brightness.toFixed(3)}:contrast=${contrast.toFixed(3)}:saturation=${saturation.toFixed(3)}:gamma=${gamma.toFixed(3)}`;
}

/**
 * Build FFmpeg -vf filter chain for film effects.
 */
function buildFfmpegFilmEffects(filmEffects = []) {
  const filters = [];

  for (const fxName of filmEffects) {
    const fx = FILM_EFFECTS[fxName];
    if (!fx || !fx.ffmpeg) continue;
    filters.push(fx.ffmpeg);
  }

  return filters.length > 0 ? filters.join(',') : null;
}

/**
 * Build complete FFmpeg -vf filter chain for a scene.
 */
function buildFfmpegFilterChain(sceneType, colorGradingProfile, filmEffects = []) {
  const parts = [];

  const colorFilter = buildFfmpegColorFilter(colorGradingProfile, sceneType);
  if (colorFilter) parts.push(colorFilter);

  const filmFilter = buildFfmpegFilmEffects(filmEffects);
  if (filmFilter) parts.push(filmFilter);

  // Add unsharp for subtle sharpening
  parts.push('unsharp=lx=3:ly=3:la=0.3');

  return parts.join(',');
}

/**
 * Build FFmpeg mastering filter for final video.
 */
function buildFfmpegMasteringFilter(colorGradingProfile, filmEffects = []) {
  const profile = COLOR_GRADING_PROFILES[colorGradingProfile] || COLOR_GRADING_PROFILES.cinematic;
  const parts = [];

  // Color grading
  parts.push(
    `eq=brightness=${(profile.ffmpeg.brightness * 0.5).toFixed(3)}:contrast=${profile.ffmpeg.contrast.toFixed(3)}:saturation=${profile.ffmpeg.saturation.toFixed(3)}:gamma=${profile.ffmpeg.gamma.toFixed(3)}`
  );

  // Vignette
  if (filmEffects.includes('vignette')) {
    parts.push('vignette=PI/5:0.35');
  }

  // Subtle sharpening
  parts.push('unsharp=lx=5:ly=5:la=0.5');

  // Scale with full range
  parts.push('scale=in_range=full:out_range=full');

  return parts.join(',');
}

// ─── SCENE-AWARE SELECTOR ─────────────────────────────────────────────────────

/**
 * Get visual quality configuration for a scene type.
 */
function getSceneVisualConfig(sceneType) {
  const normalizedType = (sceneType || 'story').toLowerCase();
  return SCENE_EFFECT_MAP[normalizedType] || SCENE_EFFECT_MAP.story;
}

/**
 * Get the appropriate color grading profile for a scene type.
 */
function getColorGradingForScene(sceneType) {
  const config = getSceneVisualConfig(sceneType);
  return config.colorGrading;
}

/**
 * Get film effects for a scene type.
 */
function getFilmEffectsForScene(sceneType) {
  const config = getSceneVisualConfig(sceneType);
  return config.filmEffects;
}

/**
 * Get export profile configuration.
 */
function getExportProfile(profileName) {
  return EXPORT_PROFILES[profileName] || EXPORT_PROFILES.instagram_reels;
}

// ─── HYPERFRAMES INTEGRATION ──────────────────────────────────────────────────

/**
 * Generate HyperFrames-compatible visual enhancement data for a scene.
 *
 * Returns an object with:
 *   - cssFilter: CSS filter string for #camera-container
 *   - overlays: Array of overlay configurations
 *   - filmGrainCss: Film grain CSS if needed
 *   - cameraGsap: GSAP camera motion code
 */
function buildHyperFramesEnhancement(sceneType, sceneDuration, options = {}) {
  const config = getSceneVisualConfig(sceneType);

  // Director Plan: apply visual overrides if available in options
  const directorVisual = options.directorVisual || null;
  const colorProfile = directorVisual ? (directorVisual.colorGrading || config.colorGrading) : config.colorGrading;
  const filmEffects = directorVisual ? (directorVisual.filmEffects || config.filmEffects) : config.filmEffects;

  // Override contrast/saturation if director specifies them
  let enhancedConfig = config;
  if (directorVisual) {
    enhancedConfig = {
      ...config,
      contrastBoost: directorVisual.contrastBoost || config.contrastBoost,
      saturationBoost: directorVisual.saturationBoost || config.saturationBoost,
    };
  }

  return {
    cssFilter: buildCssFilter(colorProfile),
    overlays: buildCssOverlays(colorProfile, filmEffects),
    filmGrainCss: buildFilmGrainCss(filmEffects),
    cameraGsap: buildCameraMotionGsap(sceneType, sceneDuration, options),
    colorProfile,
    filmEffects,
    contrastBoost: enhancedConfig.contrastBoost,
    saturationBoost: enhancedConfig.saturationBoost,
  };
}

/**
 * Generate complete HyperFrames CSS additions for visual quality.
 *
 * Called once per composition — returns CSS to inject into <style>.
 */
function generateHyperFramesVisualQualityCss(options = {}) {
  const allFilmEffects = options.filmEffects || ['vignette', 'soft_bloom'];
  return buildFilmGrainCss(allFilmEffects);
}

// ─── FFMPEG FALLBACK INTEGRATION ──────────────────────────────────────────────

/**
 * Get the FFmpeg filter chain for rendering a single scene.
 *
 * @param {string} sceneType - hook, story, peak, cta
 * @param {string} colorGradingProfile - cinematic, corporate, social, luxury, dramatic
 * @param {string[]} filmEffects - film_grain, light_leaks, vignette, soft_bloom
 * @returns {string} FFmpeg -vf filter string
 */
function getSceneFfmpegFilter(sceneType, colorGradingProfile, filmEffects) {
  return buildFfmpegFilterChain(sceneType, colorGradingProfile, filmEffects);
}

/**
 * Get the FFmpeg mastering filter for the final video.
 *
 * @param {string} colorGradingProfile
 * @param {string[]} filmEffects
 * @returns {string} FFmpeg -vf filter string
 */
function getMasteringFfmpegFilter(colorGradingProfile, filmEffects) {
  return buildFfmpegMasteringFilter(colorGradingProfile, filmEffects);
}

// ─── ANALYSIS ─────────────────────────────────────────────────────────────────

/**
 * Analyze a script to recommend visual quality settings.
 *
 * @param {string} script - Full script text
 * @returns {Object} Recommended settings
 */
function analyzeScriptForVisualQuality(script) {
  if (!script || typeof script !== 'string') {
    return {
      colorGrading: 'cinematic',
      exportProfile: 'instagram_reels',
      filmEffects: ['vignette', 'soft_bloom'],
      cameraMotion: 'slow_push_in',
    };
  }

  const lower = script.toLowerCase();

  // Detect tone
  if (lower.match(/luxury|premium|exclusive|elite|vip|high-end/)) {
    return {
      colorGrading: 'luxury',
      exportProfile: 'premium',
      filmEffects: ['film_grain', 'vignette', 'light_leaks'],
      cameraMotion: 'slow_push_in',
    };
  }

  if (lower.match(/dramatic|intense|powerful|bold|fierce|epic/)) {
    return {
      colorGrading: 'dramatic',
      exportProfile: 'youtube_shorts',
      filmEffects: ['film_grain', 'vignette', 'light_leaks'],
      cameraMotion: 'dynamic_zoom',
    };
  }

  if (lower.match(/fun|trendy|viral|hot|fire|amazing|wow/)) {
    return {
      colorGrading: 'social',
      exportProfile: 'tiktok',
      filmEffects: ['vignette', 'light_leaks'],
      cameraMotion: 'parallax_motion',
    };
  }

  if (lower.match(/professional|business|corporate|company|brand|trust/)) {
    return {
      colorGrading: 'corporate',
      exportProfile: 'youtube_shorts',
      filmEffects: ['vignette'],
      cameraMotion: 'slow_push_in',
    };
  }

  // Default: cinematic
  return {
    colorGrading: 'cinematic',
    exportProfile: 'instagram_reels',
    filmEffects: ['vignette', 'soft_bloom'],
    cameraMotion: 'slow_push_in',
  };
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
  // Constants
  COLOR_GRADING_PROFILES,
  CAMERA_MOTION_EFFECTS,
  FILM_EFFECTS,
  SCENE_EFFECT_MAP,
  EXPORT_PROFILES,

  // CSS builders (HyperFrames)
  buildCssFilter,
  buildCssOverlays,
  buildFilmGrainCss,
  generateHyperFramesVisualQualityCss,

  // GSAP builders (HyperFrames)
  buildCameraMotionGsap,

  // FFmpeg builders (Fallback)
  buildFfmpegColorFilter,
  buildFfmpegFilmEffects,
  buildFfmpegFilterChain,
  buildFfmpegMasteringFilter,

  // Scene-aware selectors
  getSceneVisualConfig,
  getColorGradingForScene,
  getFilmEffectsForScene,
  getExportProfile,

  // Integration points
  buildHyperFramesEnhancement,
  getSceneFfmpegFilter,
  getMasteringFfmpegFilter,

  // Analysis
  analyzeScriptForVisualQuality,
};
