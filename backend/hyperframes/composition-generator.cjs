/**
 * HyperFrames Composition Generator
 *
 * Generates HyperFrames-compatible HTML compositions from ECM-AI-OS
 * SceneManager scene data and asset paths.
 *
 * Supports real word-level subtitle timing from ElevenLabs alignment data.
 * Falls back to estimated timing when alignment data is unavailable.
 *
 * This module is ISOLATED — it does NOT modify engine4-video.cjs,
 * the worker queue, or the orchestrator flow.
 *
 * Usage:
 *   const { generateComposition } = require('./backend/hyperframes/composition-generator.cjs');
 *   const result = await generateComposition({
 *     scenes: [...],           // SceneManager.scenes array
 *     assets: {
 *       avatarVideo: '/path/to/avatar.mp4',
 *       brollPaths: ['/path/to/broll1.mp4', ...],
 *       voiceoverPath: '/path/to/voiceover.mp3',
 *       musicPath: '/path/to/music.mp3',
 *     },
 *     outputDir: '/tmp/render-project',
 *     options: {
 *       width: 720,
 *       height: 1280,
 *       fps: 30,
 *       subtitleStyle: 'cinematic',
 *       subtitleTimings: [       // Optional: real timing from ElevenLabs
 *         { text: 'Welcome to', start: 0.0, end: 0.5, duration: 0.5 },
 *         { text: 'our amazing', start: 0.5, end: 1.2, duration: 0.7 },
 *         ...
 *       ],
 *     }
 *   });
 */

const fs = require("fs");
const path = require("path");
const sfx = require("../ai/sfx.cjs");
const { detectEmphasisWords } = require("../ai/keyword-emphasis.cjs");
const visualQuality = require("../ai/visual-quality.cjs");
const { BrandKitEngine, DEFAULT_BRAND_KIT } = require("../ai/brand-kit-engine.cjs");

// ---------- CONSTANTS ----------

const DEFAULT_WIDTH = 720;
const DEFAULT_HEIGHT = 1280;
const DEFAULT_FPS = 30;

const SAFE_MARGIN = 24;
const AVATAR_SIDEBAR_WIDTH = 180;
const AVATAR_SIDEBAR_X = SAFE_MARGIN;
const CONTENT_X = AVATAR_SIDEBAR_X + AVATAR_SIDEBAR_WIDTH + SAFE_MARGIN;
const CONTENT_WIDTH = DEFAULT_WIDTH - CONTENT_X - SAFE_MARGIN;

const SUBTITLE_BOTTOM = DEFAULT_HEIGHT - 220;
const SUBTITLE_HEIGHT = 160;
const SUBTITLE_WIDTH = DEFAULT_WIDTH - SAFE_MARGIN * 2;

const SCENE_COLORS = {
  HOOK: { bg: '#1a1a2e', accent: '#e94560', text: '#ffffff' },
  STORY: { bg: '#16213e', accent: '#0f3460', text: '#e0e0e0' },
  CTA: { bg: '#0f3460', accent: '#533483', text: '#ffffff' },
  TRANSITION: { bg: '#000000', accent: '#333333', text: '#666666' },
};

const GSAP_CDN = 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js';

// Subtitle animation timing constants (cinematic pacing)
const SUBTITLE_FADE_IN = 0.12;    // seconds — snappy entrance
const SUBTITLE_FADE_OUT = 0.10;   // seconds — quick exit
const SUBTITLE_SLIDE_IN = 8;      // pixels — subtle upward slide
const SUBTITLE_SLIDE_OUT = 5;     // pixels — minimal exit movement
const SUBTITLE_MIN_DURATION = 0.4; // seconds — minimum display time for readability
const SUBTITLE_GAP = 0.05;        // seconds — gap between consecutive subtitles

// ---------- SUBTITLE PRESETS ----------

const SUBTITLE_PRESETS = {
  hormozi: {
    fontSize: 42,
    fontWeight: 900,
    color: '#FFFFFF',
    highlightColor: '#FFD700',
    glowColor: 'rgba(255,215,0,0.6)',
    textShadow: '0 3px 6px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.6)',
    background: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    padding: '14px 20px',
    wordsPerDisplay: 1,
    animation: 'pop-scale',
    activeWordScale: 1.15,
    letterSpacing: '1px',
    textTransform: 'uppercase',
  },
  tiktok: {
    fontSize: 36,
    fontWeight: 800,
    color: '#FFFFFF',
    highlightColor: '#00F5FF',
    glowColor: 'rgba(0,245,255,0.5)',
    textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 12px rgba(0,245,255,0.3)',
    background: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    padding: '10px 16px',
    wordsPerDisplay: 3,
    animation: 'slide-fade',
    activeWordScale: 1.0,
    letterSpacing: '0px',
    textTransform: 'none',
  },
  reels: {
    fontSize: 34,
    fontWeight: 700,
    color: '#FFFFFF',
    highlightColor: '#FF6B6B',
    glowColor: 'rgba(255,107,107,0.5)',
    textShadow: '0 2px 8px rgba(0,0,0,0.9)',
    background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.3) 100%)',
    borderRadius: 6,
    padding: '12px 18px',
    wordsPerDisplay: 4,
    animation: 'bounce-in',
    activeWordScale: 1.05,
    letterSpacing: '0px',
    textTransform: 'none',
  },
  documentary: {
    fontSize: 26,
    fontWeight: 600,
    color: '#F0F0F0',
    highlightColor: '#FFFFFF',
    glowColor: 'rgba(255,255,255,0.3)',
    textShadow: '0 1px 3px rgba(0,0,0,0.9)',
    background: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    padding: '10px 14px',
    wordsPerDisplay: 6,
    animation: 'fade-only',
    activeWordScale: 1.0,
    letterSpacing: '0.5px',
    textTransform: 'none',
  },
  premium_corporate: {
    fontSize: 28,
    fontWeight: 600,
    color: '#FFFFFF',
    highlightColor: '#4ECDC4',
    glowColor: 'rgba(78,205,196,0.4)',
    textShadow: '0 1px 4px rgba(0,0,0,0.7)',
    background: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    padding: '12px 20px',
    wordsPerDisplay: 5,
    animation: 'fade-slide',
    activeWordScale: 1.0,
    letterSpacing: '0.3px',
    textTransform: 'none',
  },
};

// ---------- VISUAL QUALITY OVERLAY GENERATION ----------

/**
 * Generate visual quality overlay elements for a composition.
 *
 * Creates:
 *   - Film grain noise overlay (animated)
 *   - Vignette gradient overlay
 *   - Light leak gradient overlay
 *   - Soft bloom overlay
 *   - Color grading gradient overlay
 *   - Per-scene camera motion GSAP code
 */
function generateVisualQualityOverlays(scenes, options) {
  const html = [];
  const gsap = [];
  const css = [];

  const colorGrading = options.colorGrading || 'cinematic';
  const filmEffects = options.filmEffects || ['vignette', 'soft_bloom'];
  const width = options.width || DEFAULT_WIDTH;
  const height = options.height || DEFAULT_HEIGHT;

  // ── Build composite overlay ──
  // Single overlay element with all film effects via CSS
  const vqConfig = visualQuality.buildHyperFramesEnhancement('story', 5, { width, height });
  const overlays = visualQuality.buildCssOverlays(colorGrading, filmEffects);

  // Build gradient stack for the overlay
  const gradients = [];
  for (const overlay of overlays) {
    if (overlay.type === 'gradient') {
      gradients.push(overlay.gradient);
    }
  }

  if (gradients.length > 0) {
    const gradientStack = gradients.join(', ');
    html.push(`<div id="vq-overlay" class="clip vq-overlay"
  data-start="0"
  data-duration="999"
  data-track-index="45"
  style="left: 0; top: 0; width: ${width}px; height: ${height}px; background: ${gradientStack}; pointer-events: none; z-index: 45;"></div>`);
  }

  // ── Film grain overlay ──
  if (filmEffects.includes('film_grain')) {
    const grainConfig = visualQuality.FILM_EFFECTS.film_grain.css;
    html.push(`<div id="vq-film-grain" class="clip vq-film-grain"
  data-start="0"
  data-duration="999"
  data-track-index="46"
  style="left: 0; top: 0; width: ${width}px; height: ${height}px; opacity: ${grainConfig.opacity}; mix-blend-mode: ${grainConfig.blendMode}; pointer-events: none; z-index: 46;"></div>`);
    css.push(visualQuality.buildFilmGrainCss(filmEffects));
  }

  // ── Apply CSS filter to camera-container ──
  const cssFilter = visualQuality.buildCssFilter(colorGrading);
  gsap.push(`// Visual Quality: Apply color grading filter to camera-container
document.getElementById("camera-container").style.filter = "${cssFilter}";`);

  // ── Per-scene camera motion ──
  let currentTime = 0;
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (scene.sceneType === 'transition') {
      currentTime += scene.duration;
      continue;
    }

    const cameraCode = visualQuality.buildCameraMotionGsap(
      scene.sceneType,
      scene.duration,
      { width, height }
    );
    if (cameraCode) {
      gsap.push(cameraCode);
    }

    currentTime += scene.duration;
  }

  return { html, gsap, css };
}

// ---------- HTML GENERATION ----------

/**
 * Generate the complete HyperFrames composition HTML
 *
 * CRITICAL STRUCTURE:
 * <body>
 *   <div id="camera-container">       ← GSAP camera motion target (wraps everything)
 *     <div id="root" data-composition-id="ecm-video" ...>
 *       [avatar, broll, subtitles, transitions, logo, CTA elements]
 *     </div>
 *   </div>
 *   <script> GSAP timeline </script>
 * </body>
 *
 * The camera-container wraps #root so that GSAP transforms on #camera-container
 * (pan, zoom, tilt) affect ALL visual layers simultaneously — avatar, b-roll,
 * subtitles, CTA, logo — just like a real camera move.
 */
function generateCompositionHtml(config) {
  const {
    scenes = [],
    assets = {},
    options = {},
  } = config;

  const width = options.width || DEFAULT_WIDTH;
  const height = options.height || DEFAULT_HEIGHT;
  const totalDuration = calculateTotalDuration(scenes);

  // Generate visual elements (inside #root)
  const { html: avatarElements, gsap: avatarAnimations } = generateAvatarElements(scenes, assets, options);
  const { html: brollElements, gsap: brollAnimations } = generateBrollElements(scenes, assets, options);
  const { html: subtitleElements, gsap: subtitleAnimations } = generateSubtitleElements(scenes, options);
  const { html: audioElements } = generateAudioElements(scenes, assets, options);
  const { html: sfxElements } = generateSfxElements(scenes, assets, options);
  const { html: transitionElements, gsap: transitionAnimations } = generateTransitionElements(scenes, options);
  const { html: logoElements, gsap: logoAnimations } = generateLogoElements(options);
  const { html: watermarkElements, gsap: watermarkAnimations } = generateWatermarkElements(options);
  const { html: lowerThirdElements, gsap: lowerThirdAnimations } = generateLowerThirdElements(scenes, options);
  const { html: ctaElements, gsap: ctaAnimations } = generateCTAElements(scenes, options);

  // Visual Quality Engine: film effects, color grading, camera motion
  const { html: vqElements, gsap: vqAnimations, css: vqCss } = generateVisualQualityOverlays(scenes, options);

  // Generate camera motion directives → GSAP timeline entries
  const { gsap: cameraAnimations } = generateCameraMotionDirectives(scenes, options);

  // Assemble all GSAP animations in correct order
  const allGsapAnimations = [
    ...cameraAnimations,    // Camera motion first (affects all layers)
    ...vqAnimations,        // Visual quality camera enhancements
    ...avatarAnimations,
    ...brollAnimations,
    ...subtitleAnimations,
    ...transitionAnimations,
    ...logoAnimations,
    ...watermarkAnimations,
    ...lowerThirdAnimations,
    ...ctaAnimations,       // CTA animations last (overlay on top)
  ].filter(Boolean).join('\n ');

  // Assemble all visual elements inside #root
  const allElements = [
    ...avatarElements,
    ...brollElements,
    ...subtitleElements,
    ...audioElements,
    ...sfxElements,
    ...transitionElements,
    ...logoElements,
    ...watermarkElements,
    ...lowerThirdElements,
    ...ctaElements,
    ...vqElements,           // Visual quality overlays
  ].join('\n ');

  const cssStyles = generateStyles(options);

  // Add visual quality CSS (film grain animation, overlays)
  const vqStyleBlock = vqCss.length > 0 ? '\n/* ── Visual Quality Engine ── */\n' + vqCss.join('\n') : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ECM-AI-OS HyperFrames Composition</title>
  <script src="${GSAP_CDN}"></script>
  <style>
${cssStyles}
${vqStyleBlock}
  </style>
</head>
<body>
  <div id="camera-container" style="position: relative; width: ${width}px; height: ${height}px; overflow: hidden; transform-origin: center center;">
    <div id="root" data-composition-id="ecm-video"
      data-start="0" data-width="${width}" data-height="${height}" data-duration="${totalDuration.toFixed(2)}">
${allElements}
    </div>
  </div>

  <script>
    const tl = gsap.timeline({ paused: true });

${allGsapAnimations}

    window.__timelines = window.__timelines || {};
    window.__timelines["ecm-video"] = tl;
  </script>
</body>
</html>`;
}

/**
 * Calculate total composition duration from scenes
 */
function calculateTotalDuration(scenes) {
  if (!scenes || scenes.length === 0) return 5;
  return scenes.reduce((total, scene) => total + (scene.duration || 5), 0);
}

/**
 * Generate avatar video HTML elements with sidebar positioning
 */
function generateAvatarElements(scenes, assets, options) {
  const html = [];
  const gsap = [];

  const avatarVideoPath = assets.avatarVideo;
  if (!avatarVideoPath) return { html: [], gsap: [] };

  const relativePath = `assets/avatar.mp4`;

  let currentTime = 0;
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (scene.sceneType === 'transition') continue;

    // Director Plan: check if avatar should be hidden for this shot
    const directorShot = scene.metadata && scene.metadata.directorShot;
    if (directorShot && directorShot.avatarVisible === false) {
      currentTime += scene.duration;
      continue;
    }

     const elementId = `avatar-scene-${i}`;
     const sceneColors = SCENE_COLORS[scene.sceneType] || SCENE_COLORS.STORY;

     // Determine avatar scale based on shot type (fallback to 1.0)
     let avatarScale = 1.0;
     const shotType = scene.shot?.type || (scene.metadata && scene.metadata.directorShot?.type);
     switch (shotType) {
       case 'avatar_closeup':
         avatarScale = 1.3;
         break;
       case 'avatar_medium':
         avatarScale = 1.0;
         break;
       case 'avatar_wide':
         avatarScale = 0.7;
         break;
       case 'testimonial_layout':
         avatarScale = 1.5;
         break;
       case 'broll_fullscreen':
         avatarScale = 0;
         break;
       default:
         avatarScale = 1.0;
     }
     // Full‑frame avatar: occupy entire width, 85% height, keep aspect via object‑fit
     const posX = 0;
     const posY = 0;
     const avatarWidth = '100%';
     const avatarHeight = '85%';

     // Blurred background copy of avatar
     html.push(`<video id="avatar-bg-${i}" class="clip avatar-video-bg"
       data-start="${currentTime.toFixed(2)}"
       data-duration="${scene.duration.toFixed(2)}"
       data-track-index="0"
       src="${relativePath}"
       muted
       playsinline
       style="left: 0; top: 0; width: ${options.width || DEFAULT_WIDTH}px; height: ${options.height || DEFAULT_HEIGHT}px; object-fit: cover; filter: blur(40px) brightness(0.5) saturate(0.7);"></video>`);

     // Full‑frame avatar video
     html.push(`<video id="${elementId}" class="clip avatar-video"
       data-start="${currentTime.toFixed(2)}"
       data-duration="${scene.duration.toFixed(2)}"
       data-track-index="0"
       src="${relativePath}"
       muted
       playsinline
       style="left: ${posX}px; top: ${posY}px; width: ${avatarWidth}; height: ${avatarHeight}; object-fit: cover; object-position: center top;"></video>`);

    gsap.push(`// Avatar scene ${i} (${scene.sceneType}) — Ken Burns zoom (scale: ${avatarScale})
    tl.fromTo("#${elementId}", {
      scale: 1.0,
    }, {
      scale: 1.08,
      duration: ${scene.duration.toFixed(2)},
      ease: "none",
    }, ${currentTime.toFixed(2)});`);

    currentTime += scene.duration;
  }

  return { html, gsap };
}

/**
 * Generate b-roll video HTML elements
 */
function generateBrollElements(scenes, assets, options) {
  const html = [];
  const gsap = [];

  const brollPaths = assets.brollPaths || [];
  if (brollPaths.length === 0) return { html: [], gsap: [] };

  const width = options.width || DEFAULT_WIDTH;
  const height = options.height || DEFAULT_HEIGHT;

  let currentTime = 0;
  let brollIndex = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (scene.sceneType === 'transition') {
      currentTime += scene.duration;
      continue;
    }

    // Director Plan: apply custom b-roll scale/opacity if available
    const directorShot = scene.metadata && scene.metadata.directorShot;
    const brollScale = directorShot ? (directorShot.brollScale || 1.0) : 1.0;
    const brollOpacity = directorShot ? (directorShot.brollOpacity !== undefined ? directorShot.brollOpacity : 1.0) : 1.0;

    const brollPath = brollPaths[brollIndex % brollPaths.length];
    const elementId = `broll-scene-${i}`;

    const brollWidth = Math.round(CONTENT_WIDTH * brollScale);
    const brollHeight = Math.round(height * brollScale);
    const brollLeft = CONTENT_X - Math.round((brollWidth - CONTENT_WIDTH) / 2);

    html.push(`<video id="${elementId}" class="clip broll-video"
      data-start="${currentTime.toFixed(2)}"
      data-duration="${scene.duration.toFixed(2)}"
      data-track-index="1"
      src="assets/broll-${brollIndex % brollPaths.length}.mp4"
      muted
      playsinline
      style="left: ${brollLeft}px; top: 0; width: ${brollWidth}px; height: ${brollHeight}px; object-fit: cover; opacity: ${brollOpacity};"></video>`);

    gsap.push(`// B-roll scene ${i} — subtle pan (scale: ${brollScale}, opacity: ${brollOpacity})
    tl.fromTo("#${elementId}", {
      x: 0,
    }, {
      x: -${Math.round(CONTENT_WIDTH * 0.05 * brollScale)},
      duration: ${scene.duration.toFixed(2)},
      ease: "none",
    }, ${currentTime.toFixed(2)});`);

    currentTime += scene.duration;
    brollIndex++;
  }

  return { html, gsap };
}

/**
 * Generate subtitle HTML elements with real word-level timing.
 *
 * When options.subtitleTimings is provided (from ElevenLabs alignment),
 * uses exact phrase timing synchronized to the voiceover.
 *
 * Falls back to estimated timing from script text when timing data
 * is unavailable.
 */
function generateSubtitleElements(scenes, options) {
  const html = [];
  const gsap = [];

  const style = options.subtitleStyle || 'cinematic';
  const subtitleTimings = options.subtitleTimings || null;
  const hasRealTiming = subtitleTimings && Array.isArray(subtitleTimings) && subtitleTimings.length > 0;

  if (hasRealTiming) {
    return generateSubtitleElementsWithTiming(subtitleTimings, options);
  }

  return generateSubtitleElementsEstimated(scenes, options);
}

/**
 * Generate subtitle elements using real ElevenLabs word-level timing.
 *
 * Supports two modes based on preset.wordsPerDisplay:
 *   - wordsPerDisplay === 1 (Hormozi): one word per element, per-word pop animation
 *   - wordsPerDisplay > 1 (TikTok/Reels/etc): phrase container with inline word spans,
 *     active word highlighted via GSAP class toggling
 *
 * Falls back to estimated timing from script text when timing data is unavailable.
 */
function generateSubtitleElementsWithTiming(phrases, options) {
  const html = [];
  const gsap = [];
  const style = options.subtitleStyle || 'cinematic';
  const preset = SUBTITLE_PRESETS[style] || SUBTITLE_PRESETS.cinematic;
  const isOneWordMode = preset.wordsPerDisplay === 1;

  console.log(`[HyperFrames] Using real subtitle timing: ${phrases.length} phrases | preset: ${style} | mode: ${isOneWordMode ? 'per-word' : 'phrase-highlight'}`);

  for (let i = 0; i < phrases.length; i++) {
    const phrase = phrases[i];
    const words = phrase.text.split(/\s+/).filter(w => w.length > 0);

    // Ensure minimum duration for readability
    const displayDuration = Math.max(phrase.duration, SUBTITLE_MIN_DURATION);

    // Add gap between consecutive subtitles
    const subStart = phrase.start + (i > 0 ? SUBTITLE_GAP : 0);
    const subEnd = Math.min(subStart + displayDuration, phrase.end);
    const actualDuration = Math.max(subEnd - subStart, SUBTITLE_MIN_DURATION);

    // Fade in/out durations (clamped to available duration)
    const fadeInDur = Math.min(SUBTITLE_FADE_IN, actualDuration * 0.3);
    const fadeOutDur = Math.min(SUBTITLE_FADE_OUT, actualDuration * 0.25);
    const fadeOutStart = subStart + actualDuration - fadeOutDur;

    if (isOneWordMode && words.length > 1) {
      // ── HORMOZI MODE: one <span> per word, shown sequentially ──
      const wordDuration = actualDuration / words.length;
      const emphasisMap = detectEmphasisWords(phrase.text);

      for (let w = 0; w < words.length; w++) {
        const wordStart = subStart + (w * wordDuration);
        const wordId = `sub-w-${i}-${w}`;
        const wordFadeIn = Math.min(0.08, wordDuration * 0.2);
        const wordFadeOut = Math.min(0.06, wordDuration * 0.15);
        const wordFadeOutStart = wordStart + wordDuration - wordFadeOut;
        const emphInfo = emphasisMap.get(w);
        const emphClass = emphInfo ? ' emphasis' : '';

        const inlineStyle = [
          `left: ${SAFE_MARGIN}px`,
          `top: ${SUBTITLE_BOTTOM}px`,
          `width: ${SUBTITLE_WIDTH}px`,
          `height: ${SUBTITLE_HEIGHT}px`,
          `--hl-color: ${preset.highlightColor}`,
          `--glow-color: ${preset.glowColor}`,
          `--active-scale: ${preset.activeWordScale}`,
        ].join('; ');

        html.push(`<span id="${wordId}" class="clip subtitle-word ${style}${emphClass}"
          data-start="${wordStart.toFixed(3)}"
          data-duration="${wordDuration.toFixed(3)}"
          data-track-index="10"
          style="${inlineStyle}">
          ${escapeHtml(words[w])}
        </span>`);

        gsap.push(`// Hormozi word ${wordId} [${wordStart.toFixed(2)}s-${(wordStart + wordDuration).toFixed(2)}s]
    tl.fromTo("#${wordId}", {
      opacity: 0,
      scale: 0.3,
    }, {
      opacity: 1,
      scale: 1,
      duration: ${wordFadeIn.toFixed(3)},
      ease: "back.out(2)",
    }, ${wordStart.toFixed(3)});
    tl.to("#${wordId}", {
      opacity: 0,
      scale: 0.8,
      duration: ${wordFadeOut.toFixed(3)},
      ease: "power2.in",
    }, ${wordFadeOutStart.toFixed(3)});`);
      }

    } else if (!isOneWordMode && words.length > 1) {
      // ── HIGHLIGHT MODE: phrase container with word spans, active-word toggling ──
      const phraseId = `sub-phrase-${i}`;
      const emphasisMap = detectEmphasisWords(phrase.text);

      const containerStyle = [
        `left: ${SAFE_MARGIN}px`,
        `top: ${SUBTITLE_BOTTOM}px`,
        `width: ${SUBTITLE_WIDTH}px`,
        `height: ${SUBTITLE_HEIGHT}px`,
        `--hl-color: ${preset.highlightColor}`,
        `--glow-color: ${preset.glowColor}`,
        `--active-scale: ${preset.activeWordScale}`,
      ].join('; ');

      const wordSpans = words.map((word, wIdx) => {
        const emphInfo = emphasisMap.get(wIdx);
        const emphClass = emphInfo ? ' emphasis' : '';
        return `<span class="subtitle-word ${style}${emphClass}" data-word-index="${wIdx}">${escapeHtml(word)}</span>`;
      }).join(' ');

      html.push(`<div id="${phraseId}" class="clip subtitle-text subtitle-phrase ${style}"
        data-start="${subStart.toFixed(3)}"
        data-duration="${actualDuration.toFixed(3)}"
        data-track-index="10"
        style="${containerStyle}">
        ${wordSpans}
      </div>`);

      // Phrase container fade in/out
      gsap.push(`// Subtitle phrase ${phraseId} — [${subStart.toFixed(2)}s-${(subStart + actualDuration).toFixed(2)}s]
    tl.fromTo("#${phraseId}", {
      opacity: 0,
      y: ${SUBTITLE_SLIDE_IN},
    }, {
      opacity: 1,
      y: 0,
      duration: ${fadeInDur.toFixed(3)},
      ease: "power2.out",
    }, ${subStart.toFixed(3)});
    tl.to("#${phraseId}", {
      opacity: 0,
      y: -${SUBTITLE_SLIDE_OUT},
      duration: ${fadeOutDur.toFixed(3)},
      ease: "power2.in",
    }, ${fadeOutStart.toFixed(3)});`);

      // Per-word active highlight toggling
      const wordDuration = actualDuration / words.length;
      for (let w = 0; w < words.length; w++) {
        const wordStart = subStart + (w * wordDuration);
        gsap.push(`// Highlight word ${w} in phrase ${phraseId}
    tl.add(() => {
      const phrase = document.getElementById("${phraseId}");
      if (!phrase) return;
      const wordEls = phrase.querySelectorAll(".subtitle-word");
      wordEls.forEach(el => el.classList.remove("active"));
      if (wordEls[${w}]) wordEls[${w}].classList.add("active");
    }, ${wordStart.toFixed(3)});`);
      }

    } else {
      // ── SINGLE WORD or CINEMATIC MODE: standard block rendering ──
      const elementId = `sub-real-${i}`;

      html.push(`<div id="${elementId}" class="clip subtitle-text ${style}"
        data-start="${subStart.toFixed(3)}"
        data-duration="${actualDuration.toFixed(3)}"
        data-track-index="10"
        style="left: ${SAFE_MARGIN}px; top: ${SUBTITLE_BOTTOM}px; width: ${SUBTITLE_WIDTH}px; height: ${SUBTITLE_HEIGHT}px; --hl-color: ${preset.highlightColor}; --glow-color: ${preset.glowColor};">
        ${escapeHtml(phrase.text)}
      </div>`);

      gsap.push(`// Subtitle ${elementId} — real timing [${subStart.toFixed(2)}s-${(subStart + actualDuration).toFixed(2)}s]
    tl.fromTo("#${elementId}", {
      opacity: 0,
      y: ${SUBTITLE_SLIDE_IN},
    }, {
      opacity: 1,
      y: 0,
      duration: ${fadeInDur.toFixed(3)},
      ease: "power2.out",
    }, ${subStart.toFixed(3)});
    tl.to("#${elementId}", {
      opacity: 0,
      y: -${SUBTITLE_SLIDE_OUT},
      duration: ${fadeOutDur.toFixed(3)},
      ease: "power2.in",
    }, ${fadeOutStart.toFixed(3)});`);
    }
  }

  return { html, gsap };
}

/**
 * Generate subtitle elements using estimated timing from script text.
 * Legacy fallback when ElevenLabs timing data is unavailable.
 */
function generateSubtitleElementsEstimated(scenes, options) {
  const html = [];
  const gsap = [];

  const style = options.subtitleStyle || 'cinematic';
  const preset = SUBTITLE_PRESETS[style] || SUBTITLE_PRESETS.cinematic;
  const isOneWordMode = preset.wordsPerDisplay === 1;

  let currentTime = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (scene.sceneType === 'transition') {
      currentTime += scene.duration;
      continue;
    }

    const scriptText = scene.scriptText || '';
    const words = scriptText.split(/\s+/).filter(w => w.length > 0);
    const wordsPerSubtitle = isOneWordMode ? 1 : preset.wordsPerDisplay;
    const wordDuration = scene.duration / Math.max(1, Math.ceil(words.length / wordsPerSubtitle));

    let subtitleIndex = 0;
    for (let w = 0; w < words.length; w += wordsPerSubtitle) {
      const chunk = words.slice(w, w + wordsPerSubtitle);
      const chunkText = chunk.join(' ');
      const elementId = `sub-scene${i}-line${subtitleIndex}`;
      const subStart = currentTime + (subtitleIndex * wordDuration);
      const subDuration = Math.min(wordDuration, scene.duration - (subtitleIndex * wordDuration));

      if (subDuration <= 0) break;

      if (isOneWordMode && chunk.length === 1) {
        // ── HORMOZI estimated: single word pop ──
        const wordFadeIn = Math.min(0.08, subDuration * 0.2);
        const wordFadeOut = Math.min(0.06, subDuration * 0.15);
        const emphasisMap = detectEmphasisWords(chunkText);
        const emphClass = emphasisMap.has(0) ? ' emphasis' : '';

        const inlineStyle = [
          `left: ${SAFE_MARGIN}px`,
          `top: ${SUBTITLE_BOTTOM}px`,
          `width: ${SUBTITLE_WIDTH}px`,
          `height: ${SUBTITLE_HEIGHT}px`,
          `--hl-color: ${preset.highlightColor}`,
          `--glow-color: ${preset.glowColor}`,
          `--active-scale: ${preset.activeWordScale}`,
        ].join('; ');

        html.push(`<span id="${elementId}" class="clip subtitle-word ${style}${emphClass}"
          data-start="${subStart.toFixed(2)}"
          data-duration="${subDuration.toFixed(2)}"
          data-track-index="10"
          style="${inlineStyle}">
          ${escapeHtml(chunkText)}
        </span>`);

        gsap.push(`// Hormozi word ${elementId} — estimated timing
    tl.fromTo("#${elementId}", {
      opacity: 0,
      scale: 0.3,
    }, {
      opacity: 1,
      scale: 1,
      duration: ${wordFadeIn.toFixed(3)},
      ease: "back.out(2)",
    }, ${subStart.toFixed(2)});
    tl.to("#${elementId}", {
      opacity: 0,
      scale: 0.8,
      duration: ${wordFadeOut.toFixed(3)},
      ease: "power2.in",
    }, ${(subStart + subDuration - wordFadeOut).toFixed(3)});`);

      } else {
        // ── Standard phrase rendering (TikTok/Reels/doc/corporate/cinematic) ──
        html.push(`<div id="${elementId}" class="clip subtitle-text ${style}"
          data-start="${subStart.toFixed(2)}"
          data-duration="${subDuration.toFixed(2)}"
          data-track-index="10"
          style="left: ${SAFE_MARGIN}px; top: ${SUBTITLE_BOTTOM}px; width: ${SUBTITLE_WIDTH}px; height: ${SUBTITLE_HEIGHT}px; --hl-color: ${preset.highlightColor}; --glow-color: ${preset.glowColor};">
          ${escapeHtml(chunkText)}
        </div>`);

        gsap.push(`// Subtitle ${elementId} — estimated timing
    tl.fromTo("#${elementId}", {
      opacity: 0,
      y: ${SUBTITLE_SLIDE_IN},
    }, {
      opacity: 1,
      y: 0,
      duration: ${Math.min(0.3, subDuration * 0.2).toFixed(2)},
      ease: "power2.out",
    }, ${subStart.toFixed(2)});
    tl.to("#${elementId}", {
      opacity: 0,
      y: -${SUBTITLE_SLIDE_OUT},
      duration: ${Math.min(0.2, subDuration * 0.15).toFixed(2)},
      ease: "power2.in",
    }, ${(subStart + subDuration - Math.min(0.2, subDuration * 0.15)).toFixed(2)});`);
      }

      subtitleIndex++;
    }

    currentTime += scene.duration;
  }

  return { html, gsap };
}

/**
 * Generate audio elements (voiceover + background music)
 */
function generateAudioElements(scenes, assets, options) {
  const html = [];
  const totalDuration = calculateTotalDuration(scenes);

  if (assets.voiceoverPath) {
    html.push(`<audio id="voiceover"
      data-start="0"
      data-duration="${totalDuration.toFixed(2)}"
      data-track-index="20"
      data-volume="1.0"
      src="assets/voiceover.mp3"></audio>`);
  }

  if (assets.musicPath) {
    html.push(`<audio id="bg-music"
      data-start="0"
      data-duration="${totalDuration.toFixed(2)}"
      data-track-index="21"
      data-volume="0.25"
      src="assets/music.mp3"></audio>`);
  }

  return { html };
}

/**
 * Generate SFX audio elements for each scene
 */
function generateSfxElements(scenes, assets, options = {}) {
  const html = [];
  let trackIndex = 30;
  const sfxDir = path.join(__dirname, '../assets/sfx');

  let currentTime = 0;
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (scene.sceneType === 'transition') {
      currentTime += scene.duration;
      continue;
    }

    const sceneType = scene.sceneType || 'story';
    const sfxConfig = sfx.SCENE_SFX_MAP[sceneType] || sfx.SCENE_SFX_MAP.story;
    const sfxFile = sfx.getSfxByName(sfxConfig.primary);
    if (!sfxFile) { currentTime += scene.duration; continue; }

    const sfxFileName = path.basename(sfxFile);
    const elementId = `sfx-${i}`;

    // SFX placement: start of scene for hook/cta, midpoint for story
    let sfxStart = currentTime;
    if (sceneType === 'story') {
      sfxStart = currentTime + scene.duration * 0.5;
    }

    // Retention keyword SFX
    const retentionSfxList = sfx.getRetentionSfx(scene.scriptText || '');
    for (let r = 0; r < retentionSfxList.length; r++) {
      const rs = retentionSfxList[r];
      const retElementId = `sfx-ret-${i}-${r}`;
      const retStart = currentTime + scene.duration * 0.3;
      const retSfxFile = path.basename(rs.sfxPath);
      const retDuration = 1.5;

      html.push(`<audio id="${retElementId}"
  data-start="${retStart.toFixed(2)}"
  data-duration="${retDuration.toFixed(2)}"
  data-track-index="${trackIndex}"
  data-volume="${rs.volume}"
  data-label="${rs.label}"
  src="assets/${retSfxFile}"></audio>`);
      trackIndex++;
    }

    const duration = sfx.estimateSfxDuration(sfxFile);
    html.push(`<audio id="${elementId}"
  data-start="${sfxStart.toFixed(2)}"
  data-duration="${duration.toFixed(2)}"
  data-track-index="${trackIndex}"
  data-volume="${sfxConfig.volume}"
  data-label="${sceneType}_primary"
  src="assets/${sfxFileName}"></audio>`);
    trackIndex++;

    currentTime += scene.duration;
  }

  return { html };
}

/**
 * Generate transition placeholder elements
 */
function generateTransitionElements(scenes, options) {
  const html = [];
  const gsap = [];

  let currentTime = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (scene.sceneType !== 'transition') {
      currentTime += scene.duration;
      continue;
    }

    const elementId = `transition-${i}`;
    const transitionType = scene.customTransition || 'fade';

    html.push(`<div id="${elementId}" class="clip transition-overlay"
      data-start="${currentTime.toFixed(2)}"
      data-duration="${scene.duration.toFixed(2)}"
      data-track-index="5"
      style="left: 0; top: 0; width: ${options.width || DEFAULT_WIDTH}px; height: ${options.height || DEFAULT_HEIGHT}px;"></div>`);

    gsap.push(`// Transition ${transitionType} at ${currentTime.toFixed(2)}s
    tl.fromTo("#${elementId}", {
      opacity: 0,
    }, {
      opacity: 1,
      duration: ${(scene.duration * 0.5).toFixed(2)},
      ease: "power2.inOut",
    }, ${currentTime.toFixed(2)});
    tl.to("#${elementId}", {
      opacity: 0,
      duration: ${(scene.duration * 0.5).toFixed(2)},
      ease: "power2.inOut",
    }, ${(currentTime + scene.duration * 0.5).toFixed(2)});`);

    currentTime += scene.duration;
  }

  return { html, gsap };
}

/**
 * Generate logo overlay placeholder
 */
function generateLogoElements(options) {
  const html = [];
  const gsap = [];
  const width = options.width || DEFAULT_WIDTH;
  const height = options.height || DEFAULT_HEIGHT;
  const totalDuration = calculateTotalDuration(options.scenes || []);
  const brandKit = options.brandKit;

  // Brand Kit: use brand logo if available
  if (brandKit && brandKit.logo && brandKit.logo.url) {
    const { position, size, opacity, borderRadius } = brandKit.logo;
    const margin = SAFE_MARGIN;
    const posMap = {
      "top-right": `left: ${width - size - margin}px; top: ${margin}px`,
      "top-left": `left: ${margin}px; top: ${margin}px`,
      "bottom-right": `left: ${width - size - margin}px; top: ${height - size - margin}px`,
      "bottom-left": `left: ${margin}px; top: ${height - size - margin}px`,
      "center": `left: ${(width - size) / 2}px; top: ${(height - size) / 2}px`,
    };
    const posStyle = posMap[position] || posMap["top-right"];

    html.push(`<img id="brand-logo" class="clip logo-overlay" src="assets/brand-logo.png"
  data-start="0"
  data-duration="${totalDuration.toFixed(2)}"
  data-track-index="15"
  style="position:absolute; ${posStyle}; width: ${size}px; height: auto;
  opacity: ${opacity}; border-radius: ${borderRadius}px; pointer-events: none;" />`);

    gsap.push(`// Brand logo fade-in
tl.fromTo("#brand-logo", { opacity: 0, scale: 0.8 }, {
  opacity: ${opacity}, scale: 1.0, duration: 0.5, ease: "back.out(1.7)"
}, 0);`);

    return { html, gsap };
  }

  // Fallback: placeholder logo
  if (!options.showLogo) return { html: [], gsap: [] };

  const logoDuration = Math.min(3, totalDuration);
  const logoSize = 60;

  html.push(`<div id="logo-overlay" class="clip logo-overlay"
  data-start="0"
  data-duration="${logoDuration.toFixed(2)}"
  data-track-index="15"
  style="left: ${width - logoSize - SAFE_MARGIN}px; top: ${SAFE_MARGIN}px; width: ${logoSize}px; height: ${logoSize}px; background: rgba(255,255,255,0.15); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.6); font-size: 10px; text-align: center;">
  LOGO
  </div>`);

  gsap.push(`// Logo overlay — fade in and out
tl.fromTo("#logo-overlay", {
  opacity: 0,
  scale: 0.8,
}, {
  opacity: 1,
  scale: 1,
  duration: 0.5,
  ease: "power2.out",
}, 0);
tl.to("#logo-overlay", {
  opacity: 0,
  duration: 0.5,
  ease: "power2.in",
}, ${(logoDuration - 0.5).toFixed(2)});`);

  return { html, gsap };
}

/**
 * Generate brand watermark overlay elements.
 * Uses brand logo image or text fallback with configurable position and opacity.
 */
function generateWatermarkElements(options) {
  const html = [];
  const gsap = [];
  const width = options.width || DEFAULT_WIDTH;
  const height = options.height || DEFAULT_HEIGHT;
  const totalDuration = calculateTotalDuration(options.scenes || []);
  const brandKit = options.brandKit;

  if (!brandKit || !brandKit.watermark || !brandKit.watermark.enabled) {
    return { html: [], gsap: [] };
  }

  const { position, size, opacity } = brandKit.watermark;
  const margin = SAFE_MARGIN;
  const posMap = {
    "top-right": `left: ${width - size - margin}px; top: ${margin}px`,
    "top-left": `left: ${margin}px; top: ${margin}px`,
    "bottom-right": `left: ${width - size - margin}px; top: ${height - size - margin}px`,
    "bottom-left": `left: ${margin}px; top: ${height - size - margin}px`,
  };
  const posStyle = posMap[position] || posMap["bottom-right"];

  if (brandKit.logo.url) {
    html.push(`<img id="brand-watermark" class="clip watermark-overlay" src="assets/brand-logo.png"
  data-start="0"
  data-duration="${totalDuration.toFixed(2)}"
  data-track-index="16"
  style="position:absolute; ${posStyle}; width: ${size}px; height: auto;
  opacity: ${opacity}; pointer-events: none;" />`);
  } else {
    html.push(`<div id="brand-watermark" class="clip watermark-overlay"
  data-start="0"
  data-duration="${totalDuration.toFixed(2)}"
  data-track-index="16"
  style="position:absolute; ${posStyle}; font-size: ${size * 0.4}px;
  opacity: ${opacity}; color: ${brandKit.colors.text}; font-family: ${brandKit.typography.fontFamily};
  letter-spacing: 2px; pointer-events: none;">${brandKit.brandName}</div>`);
  }

  gsap.push(`// Brand watermark subtle pulse
tl.fromTo("#brand-watermark", { opacity: 0 }, {
  opacity: ${opacity}, duration: 1.0, ease: "power1.out"
}, 0);`);

  return { html, gsap };
}

/**
 * Generate lower-third overlay element for brand name display.
 * Slides in from left with brand accent color border.
 */
function generateLowerThirdElements(scenes, options) {
  const html = [];
  const gsap = [];
  const width = options.width || DEFAULT_WIDTH;
  const height = options.height || DEFAULT_HEIGHT;
  const brandKit = options.brandKit;

  if (!brandKit || !brandKit.lowerThird || !brandKit.lowerThird.enabled) {
    return { html: [], gsap: [] };
  }

  const { colors, lowerThird, typography, brandName } = brandKit;
  const totalDuration = calculateTotalDuration(scenes || []);

  html.push(`<div id="lower-third" class="clip lower-third"
  data-start="0"
  data-duration="${totalDuration.toFixed(2)}"
  data-track-index="17"
  style="position: absolute; bottom: 280px; left: 24px; right: 24px;
  background: ${lowerThird.backgroundColor}; border-left: 3px solid ${lowerThird.accentColor};
  padding: 12px 16px; border-radius: 4px; z-index: 50;">
  <span style="color: ${lowerThird.textColor || colors.text}; font-family: ${typography.fontFamily};
  font-weight: ${typography.fontWeight}; font-size: 16px; display: block;">${brandName}</span>
</div>`);

  gsap.push(`// Lower third slide-in
tl.fromTo("#lower-third", { x: -200, opacity: 0 }, {
  x: 0, opacity: 1, duration: 0.4, ease: "power2.out"
}, 0.5);
tl.to("#lower-third", { x: -200, opacity: 0, duration: 0.3, ease: "power2.in" },
  ${totalDuration - 1});`);

  return { html, gsap };
}

/**
 * Generate CTA (Call-to-Action) overlay elements for CTA scenes.
 *
 * Creates a dedicated overlay element at track-index 20 (above subtitles at 10)
 * with animated entrance: scale + fade + bounce, then hold, then exit.
 *
 * CTA text comes from the CTA scene's scriptText. If no CTA scene exists,
 * no CTA element is generated.
 */
function generateCTAElements(scenes, options) {
  const html = [];
  const gsap = [];
  const width = options.width || DEFAULT_WIDTH;
  const height = options.height || DEFAULT_HEIGHT;
  const brandKit = options.brandKit;

  // Brand Kit: extract CTA colors
  const ctaPrimaryColor = brandKit && brandKit.cta ? brandKit.cta.primaryColor : '#e94560';
  const ctaSecondaryColor = brandKit && brandKit.cta ? brandKit.cta.secondaryColor : '#533483';
  const ctaButtonColor = brandKit && brandKit.cta ? brandKit.cta.buttonColor : '#ffffff';
  const ctaButtonTextColor = brandKit && brandKit.cta ? brandKit.cta.buttonTextColor : '#e94560';
  const ctaButtonText = brandKit && brandKit.cta && brandKit.cta.text
    ? brandKit.cta.text
    : (options.ctaButtonText || "Learn More");

  let currentTime = 0;
  let ctaIndex = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];

    if (scene.sceneType === 'transition') {
      currentTime += scene.duration;
      continue;
    }

    if (scene.sceneType !== 'cta') {
      currentTime += scene.duration;
      continue;
    }

    const elementId = `cta-overlay-${ctaIndex}`;
    const ctaText = scene.scriptText || "Act Now!";
    const ctaStart = currentTime;
    const ctaDuration = scene.duration;

    const ctaWidth = width - SAFE_MARGIN * 4;
    const ctaHeight = 80;
    const ctaLeft = SAFE_MARGIN * 2;
    const ctaTop = height - 320;

    html.push(`<div id="${elementId}" class="clip cta-overlay"
  data-start="${ctaStart.toFixed(2)}"
  data-duration="${ctaDuration.toFixed(2)}"
  data-track-index="20"
  style="left: ${ctaLeft}px; top: ${ctaTop}px; width: ${ctaWidth}px; height: ${ctaHeight}px;">
  <span class="cta-text">${escapeHtml(ctaText)}</span>
  <span class="cta-button">${ctaButtonText}</span>
  </div>`);

    const entranceDur = Math.min(0.6, ctaDuration * 0.15);
    const exitDur = Math.min(0.4, ctaDuration * 0.1);
    const holdEnd = ctaStart + ctaDuration - exitDur;

    gsap.push(`// CTA overlay ${ctaIndex} — entrance + hold + exit [${ctaStart.toFixed(2)}s-${(ctaStart + ctaDuration).toFixed(2)}s]
tl.fromTo("#${elementId}", {
  opacity: 0,
  scale: 0.5,
  y: 30,
}, {
  opacity: 1,
  scale: 1,
  y: 0,
  duration: ${entranceDur.toFixed(3)},
  ease: "back.out(1.7)",
}, ${ctaStart.toFixed(2)});
tl.to("#${elementId}", {
  opacity: 0,
  scale: 0.9,
  y: -20,
  duration: ${exitDur.toFixed(3)},
  ease: "power2.in",
}, ${holdEnd.toFixed(2)});`);

    // Pulsing glow effect using brand colors
    const pulseStart = ctaStart + entranceDur;
    const pulseEnd = holdEnd;
    if (pulseEnd - pulseStart > 1.0) {
      const pulseRgb = brandKit ? (function(h){const r=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);return r?`${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}`:'233,69,96';})(ctaPrimaryColor) : '233,69,96';
      gsap.push(`// CTA button pulse glow (brand color)
tl.fromTo("#${elementId} .cta-button", {
  boxShadow: "0 0 10px rgba(${pulseRgb},0.3)",
}, {
  boxShadow: "0 0 25px rgba(${pulseRgb},0.8)",
  duration: 0.5,
  repeat: -1,
  yoyo: true,
  ease: "sine.inOut",
}, ${pulseStart.toFixed(2)});`);
    }

    ctaIndex++;
    currentTime += scene.duration;
  }

  return { html, gsap };
}

/**
 * Generate camera motion directives as GSAP timeline entries on #camera-container.
 *
 * Camera motion applies to #camera-container which wraps #root and ALL visual
 * layers. This means a camera pan/zoom simultaneously moves avatar, b-roll,
 * subtitles, CTA — just like a real camera move.
 *
 * Motion types per scene type:
 *   HOOK: dramatic zoom-in (scale 1.0→1.15) to grab attention
 *   STORY: gentle pan-left or pan-right (x: 0 → ±20px)
 *   CTA: subtle zoom-out (scale 1.05→1.0) for breathing room
 *   TRANSITION: no camera motion (the transition overlay handles it)
 *
 * Each directive produces a GSAP timeline entry with correct start time.
 */
function generateCameraMotionDirectives(scenes, options) {
  const gsap = [];
  const width = options.width || DEFAULT_WIDTH;
  const height = options.height || DEFAULT_HEIGHT;

  let currentTime = 0;
  let directiveIndex = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const sceneStart = currentTime;
    const sceneDuration = scene.duration;

    if (scene.sceneType === 'transition') {
      currentTime += sceneDuration;
      continue;
    }

    // Director Plan camera override (if available)
    const directorGsap = scene.metadata && scene.metadata.directorCamera && scene.metadata.directorCamera.gsap;
    if (directorGsap) {
      const g = directorGsap;
      const shakeComment = g.shake ? ` + shake(${g.shake.amplitude}px, ${g.shake.frequency}Hz)` : '';
      gsap.push(`// Camera: DIRECTOR ${scene.sceneType || 'scene'} [${sceneStart.toFixed(2)}s-${(sceneStart + sceneDuration).toFixed(2)}s]${shakeComment}
tl.fromTo("${g.target}", ${JSON.stringify(g.from)}, {
  ...${JSON.stringify(g.to)},
  duration: ${g.duration.toFixed(2)},
  ease: "${g.ease}",
}, ${sceneStart.toFixed(2)});`);

      // Add shake animation if director specifies it
      if (g.shake) {
        gsap.push(`// Camera shake: ${g.shake.amplitude}px amplitude, ${g.shake.frequency}Hz
tl.to("${g.target}", {
  x: "+=${g.shake.amplitude}",
  yoyo: true,
  repeat: ${Math.round(g.shake.frequency * g.shake.duration / 2)},
  duration: ${(1 / g.shake.frequency).toFixed(3)},
  ease: "sine.inOut",
}, ${sceneStart.toFixed(2)});`);
      }

      currentTime += sceneDuration;
      directiveIndex++;
      continue;
    }

    // Fallback: hardcoded camera per scene type
    switch (scene.sceneType) {
      case 'hook': {
        gsap.push(`// Camera: HOOK zoom-in [${sceneStart.toFixed(2)}s-${(sceneStart + sceneDuration).toFixed(2)}s]
tl.fromTo("#camera-container", {
  scale: 1.0,
  x: 0,
  y: 0,
}, {
  scale: 1.15,
  x: -${Math.round(width * 0.03)},
  y: -${Math.round(height * 0.02)},
  duration: ${sceneDuration.toFixed(2)},
  ease: "power1.out",
}, ${sceneStart.toFixed(2)});`);
        break;
      }

      case 'story': {
        const panDirection = directiveIndex % 2 === 0 ? -1 : 1;
        const panDistance = Math.round(width * 0.04);
        gsap.push(`// Camera: STORY pan-${panDirection > 0 ? 'right' : 'left'} [${sceneStart.toFixed(2)}s-${(sceneStart + sceneDuration).toFixed(2)}s]
tl.fromTo("#camera-container", {
  x: ${panDirection > 0 ? 0 : panDistance},
}, {
  x: ${panDirection > 0 ? -panDistance : 0},
  duration: ${sceneDuration.toFixed(2)},
  ease: "none",
}, ${sceneStart.toFixed(2)});`);
        break;
      }

      case 'cta': {
        gsap.push(`// Camera: CTA zoom-out [${sceneStart.toFixed(2)}s-${(sceneStart + sceneDuration).toFixed(2)}s]
tl.fromTo("#camera-container", {
  scale: 1.05,
}, {
  scale: 1.0,
  duration: ${sceneDuration.toFixed(2)},
  ease: "power1.inOut",
}, ${sceneStart.toFixed(2)});`);
        break;
      }

      default: {
        break;
      }
    }

    directiveIndex++;
    currentTime += sceneDuration;
  }

  return { gsap };
}

// ---------- CSS GENERATION ----------

function generateStyles(options) {
  const brandKit = options.brandKit;
  const brandCss = brandKit && brandKit.colors ? `
    :root {
      --brand-primary: ${brandKit.colors.primary};
      --brand-secondary: ${brandKit.colors.secondary};
      --brand-accent: ${brandKit.colors.accent};
      --brand-text: ${brandKit.colors.text};
      --brand-font: ${brandKit.typography.fontFamily};
    }
  ` : '';

  // Brand-aware CTA colors
  const ctaGradient = brandKit && brandKit.cta
    ? `linear-gradient(135deg, ${brandKit.cta.primaryColor || brandKit.colors.primary} 0%, ${brandKit.cta.secondaryColor || brandKit.colors.secondary} 100%)`
    : 'linear-gradient(135deg, rgba(233,69,96,0.9) 0%, rgba(83,52,131,0.9) 100%)';
  const ctaShadow = brandKit && brandKit.cta
    ? `0 4px 20px rgba(${(function(h){const r=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);return r?`${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}`:'233,69,96';})(brandKit.cta.primaryColor || brandKit.colors.primary)},0.4)`
    : '0 4px 20px rgba(233,69,96,0.4)';
  const ctaButtonBg = brandKit && brandKit.cta ? brandKit.cta.buttonColor : '#ffffff';
  const ctaButtonColor = brandKit && brandKit.cta ? brandKit.cta.buttonTextColor : '#e94560';
  const ctaBorderRadius = brandKit && brandKit.cta ? brandKit.cta.borderRadius : 12;
  const fontFamily = brandKit && brandKit.typography ? brandKit.typography.fontFamily : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";

  return `
    ${brandCss}
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    [data-composition-id="ecm-video"] {
      position: relative;
      width: ${options.width || DEFAULT_WIDTH}px;
      height: ${options.height || DEFAULT_HEIGHT}px;
      background: linear-gradient(180deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
      overflow: hidden;
      font-family: ${fontFamily};
    }

    .avatar-video {
      position: absolute;
      border-radius: 0;
      overflow: hidden;
    }

    .broll-video {
      position: absolute;
      overflow: hidden;
    }

    .subtitle-text {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-weight: 700;
      line-height: 1.3;
      padding: 12px 16px;
    }

    .subtitle-text.cinematic {
      font-size: 28px;
      color: #ffffff;
      text-shadow:
        0 2px 4px rgba(0,0,0,0.8),
        0 0 20px rgba(0,0,0,0.5);
      background: linear-gradient(180deg,
        rgba(0,0,0,0.6) 0%,
        rgba(0,0,0,0.4) 50%,
        rgba(0,0,0,0.6) 100%);
      border-radius: 8px;
      backdrop-filter: blur(4px);
    }

    /* ── Per-word subtitle element (Hormozi mode) ── */
    .subtitle-word {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-weight: 900;
      line-height: 1.3;
      will-change: transform, opacity;
    }

    .subtitle-word.hormozi {
      font-size: 42px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #FFFFFF;
      text-shadow: 0 3px 6px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.6);
      background: rgba(0,0,0,0.7);
      border-radius: 8px;
      padding: 14px 20px;
    }

    .subtitle-word.hormozi.active {
      color: var(--hl-color, #FFD700);
      text-shadow: 0 3px 6px rgba(0,0,0,0.9), 0 0 20px var(--glow-color, rgba(255,215,0,0.6));
      transform: scale(var(--active-scale, 1.15));
    }

    /* ── Phrase container with inline word spans (highlight mode) ── */
    .subtitle-phrase .subtitle-word {
      position: relative;
      display: inline;
      color: inherit;
      transition: color 0.08s ease, transform 0.08s ease, text-shadow 0.08s ease;
    }

    .subtitle-phrase .subtitle-word.active {
      color: var(--hl-color, #FFD700);
      text-shadow: 0 0 12px var(--glow-color, rgba(255,215,0,0.5));
      transform: scale(var(--active-scale, 1.05));
    }

    /* ── TikTok preset ── */
    .subtitle-text.tiktok, .subtitle-word.tiktok {
      font-size: 36px;
      font-weight: 800;
      color: #FFFFFF;
      text-shadow: 0 2px 4px rgba(0,0,0,0.8), 0 0 12px rgba(0,245,255,0.3);
      background: rgba(0,0,0,0.6);
      border-radius: 6px;
      padding: 10px 16px;
    }

    .subtitle-word.tiktok.active {
      color: var(--hl-color, #00F5FF);
      text-shadow: 0 2px 4px rgba(0,0,0,0.8), 0 0 16px var(--glow-color, rgba(0,245,255,0.5));
    }

    /* ── Reels preset ── */
    .subtitle-text.reels, .subtitle-word.reels {
      font-size: 34px;
      font-weight: 700;
      color: #FFFFFF;
      text-shadow: 0 2px 8px rgba(0,0,0,0.9);
      background: linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.3) 100%);
      border-radius: 6px;
      padding: 12px 18px;
    }

    .subtitle-word.reels.active {
      color: var(--hl-color, #FF6B6B);
      text-shadow: 0 2px 8px rgba(0,0,0,0.9), 0 0 14px var(--glow-color, rgba(255,107,107,0.5));
      transform: scale(var(--active-scale, 1.05));
    }

    /* ── Documentary preset ── */
    .subtitle-text.documentary, .subtitle-word.documentary {
      font-size: 26px;
      font-weight: 600;
      color: #F0F0F0;
      letter-spacing: 0.5px;
      text-shadow: 0 1px 3px rgba(0,0,0,0.9);
      background: rgba(0,0,0,0.6);
      border-radius: 4px;
      padding: 10px 14px;
    }

    .subtitle-word.documentary.active {
      color: var(--hl-color, #FFFFFF);
      text-shadow: 0 1px 3px rgba(0,0,0,0.9), 0 0 8px var(--glow-color, rgba(255,255,255,0.3));
    }

    /* ── Premium Corporate preset ── */
    .subtitle-text.premium_corporate, .subtitle-word.premium_corporate {
      font-size: 28px;
      font-weight: 600;
      color: #FFFFFF;
      letter-spacing: 0.3px;
      text-shadow: 0 1px 4px rgba(0,0,0,0.7);
      background: rgba(0,0,0,0.4);
      border-radius: 12px;
      padding: 12px 20px;
    }

    .subtitle-word.premium_corporate.active {
      color: var(--hl-color, #4ECDC4);
      text-shadow: 0 1px 4px rgba(0,0,0,0.7), 0 0 10px var(--glow-color, rgba(78,205,196,0.4));
    }

    /* ── Keyword emphasis styling ── */
    .subtitle-word.emphasis, .subtitle-phrase .emphasis {
      font-weight: 900;
      text-decoration: underline;
      text-decoration-color: var(--hl-color, #FFD700);
      text-underline-offset: 4px;
      text-decoration-thickness: 2px;
    }

    .transition-overlay {
      position: absolute;
      background: #000000;
      pointer-events: none;
    }

.logo-overlay {
  position: absolute;
  pointer-events: none;
}

.cta-overlay {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: ${ctaGradient};
  border-radius: ${ctaBorderRadius}px;
  padding: 10px 16px;
  box-shadow: ${ctaShadow};
  backdrop-filter: blur(8px);
  will-change: transform, opacity;
}

.cta-text {
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
  text-align: center;
  text-shadow: 0 1px 3px rgba(0,0,0,0.3);
  line-height: 1.2;
  font-family: ${fontFamily};
}

.cta-button {
  display: inline-block;
  background: ${ctaButtonBg};
  color: ${ctaButtonColor};
  font-size: 14px;
  font-weight: 800;
  padding: 6px 18px;
  border-radius: ${ctaBorderRadius}px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 0 10px ${ctaShadow};
  will-change: box-shadow;
  font-family: ${fontFamily};
}

#camera-container {
  position: relative;
  will-change: transform;
  transform-origin: center center;
}
`;
}

// ---------- UTILITIES ----------

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------- ASSET MANAGEMENT ----------

/**
 * Copy assets to the composition project directory
 */
function copyAssetsToProject(projectDir, assets) {
  const assetsDir = path.join(projectDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  const copiedFiles = {};

  if (assets.avatarVideo && fs.existsSync(assets.avatarVideo)) {
    const dest = path.join(assetsDir, 'avatar.mp4');
    fs.copyFileSync(assets.avatarVideo, dest);
    copiedFiles.avatarVideo = dest;
  }

  if (assets.brollPaths && Array.isArray(assets.brollPaths)) {
    assets.brollPaths.forEach((brollPath, index) => {
      if (fs.existsSync(brollPath)) {
        const dest = path.join(assetsDir, `broll-${index}.mp4`);
        fs.copyFileSync(brollPath, dest);
        copiedFiles[`broll-${index}`] = dest;
      }
    });
  }

  if (assets.voiceoverPath && fs.existsSync(assets.voiceoverPath)) {
    const dest = path.join(assetsDir, 'voiceover.mp3');
    fs.copyFileSync(assets.voiceoverPath, dest);
    copiedFiles.voiceoverPath = dest;
  }

  if (assets.musicPath && fs.existsSync(assets.musicPath)) {
    const dest = path.join(assetsDir, 'music.mp3');
    fs.copyFileSync(assets.musicPath, dest);
    copiedFiles.musicPath = dest;
  }

  // Copy SFX files referenced in the composition
  const sfxDir = path.join(__dirname, '../assets/sfx');
  if (fs.existsSync(sfxDir)) {
    try {
      const sfxFiles = fs.readdirSync(sfxDir).filter(f => f.endsWith('.mp3') || f.endsWith('.wav'));
      for (const sfxFile of sfxFiles) {
        const src = path.join(sfxDir, sfxFile);
        const dest = path.join(assetsDir, sfxFile);
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
        }
      }
      copiedFiles.sfxDir = sfxDir;
    } catch (err) {
      console.warn('[HyperFrames] SFX copy warning:', err.message);
    }
  }

  return copiedFiles;
}

// ---------- MAIN EXPORT ----------

/**
 * Generate a complete HyperFrames composition project
 *
 * @param {Object} config
 * @param {Array} config.scenes - SceneManager.scenes array
 * @param {Object} config.assets - Asset paths (avatarVideo, brollPaths, voiceoverPath, musicPath)
 * @param {string} config.outputDir - Directory to write composition files
 * @param {Object} config.options - Rendering options (width, height, fps, subtitleStyle, showLogo)
 * @returns {Object} { projectDir, htmlPath, totalDuration, assetCount }
 */
async function generateComposition(config) {
  const {
    scenes = [],
    assets = {},
    outputDir,
    options = {},
  } = config;

  if (!outputDir) {
    throw new Error('outputDir is required');
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const totalDuration = calculateTotalDuration(scenes);

  // Visual Quality Engine: auto-detect settings from script if not provided
  let vqOptions = { ...options };
  if (!vqOptions.colorGrading && options.scenes) {
    // Script-based analysis happens at the caller level (engine4-video.cjs)
    // Here we just pass through what was provided
  }

  const htmlContent = generateCompositionHtml({
    scenes,
    assets,
    options: { ...vqOptions, scenes },
  });

  const htmlPath = path.join(outputDir, 'index.html');
  fs.writeFileSync(htmlPath, htmlContent, 'utf-8');

  const copiedAssets = copyAssetsToProject(outputDir, assets);

  const assetCount = Object.keys(copiedAssets).length;

  return {
    projectDir: outputDir,
    htmlPath,
    totalDuration,
    assetCount,
    copiedAssets,
    sceneCount: scenes.filter(s => s.sceneType !== 'transition').length,
  };
}

module.exports = {
  generateComposition,
  generateCompositionHtml,
  generateCTAElements,
  generateSfxElements,
  generateCameraMotionDirectives,
  generateWatermarkElements,
  generateLowerThirdElements,
  calculateTotalDuration,
  copyAssetsToProject,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  SUBTITLE_PRESETS,
  DEFAULT_FPS,
  SAFE_MARGIN,
};
