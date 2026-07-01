/**
 * AI Director & Shot Planner
 *
 * Automatically plans cinematic shots before rendering.
 * Runs inside Engine 4 after script extraction, before any expensive operations.
 * Produces a DirectorPlan that orchestrates all downstream rendering decisions.
 *
 * Capabilities:
 *   - Shot planning per scene (10 shot types)
 *   - Scene-based logic (hook/story/peak/cta directives)
 *   - Camera system (zoom, speed, motion intensity, framing)
 *   - HyperFrames GSAP camera timeline generation
 *   - FFmpeg fallback motion instructions
 *   - Director scoring (engagement, visual variety, retention support)
 *   - Layout diversity enforcement (prevents repetitive shots)
 *
 * This module is ISOLATED — it does NOT modify engine4-video.cjs,
 * the worker queue, or the orchestrator flow.
 *
 * Usage:
 *   const { createDirectorPlan } = require('./backend/ai/director-engine.cjs');
 *   const plan = createDirectorPlan(sceneRecommendations, script, {
 *     targetDuration: 55,
 *     videoWidth: 720,
 *     videoHeight: 1280,
 *   });
 */

// ---------- SHOT TYPES ----------
// 10 cinematic shot types with full rendering parameters

const SHOT_TYPES = {
  avatar_closeup: {
    label: 'Avatar Close-Up',
    description: 'Tight avatar framing, face fills 60% of sidebar',
    avatarRequired: true,
    avatarScale: 1.4,
    avatarPosition: { x: 0, y: -40 },
    avatarShape: 'standard',
    brollMode: 'background',
    brollOpacity: 0.3,
    brollScale: 1.0,
    textOverlay: false,
    textPosition: 'bottom',
    textScale: 1.0,
    layout: 'standard',
    framing: 'tight',
    cameraAffinity: ['dramatic_zoom_in', 'micro_shake'],
    beats: ['hook', 'peak', 'cta'],
    intensityRange: [7, 10],
  },
  avatar_medium: {
    label: 'Avatar Medium',
    description: 'Standard avatar sidebar, balanced composition',
    avatarRequired: true,
    avatarScale: 1.0,
    avatarPosition: { x: 0, y: 0 },
    avatarShape: 'standard',
    brollMode: 'background',
    brollOpacity: 1.0,
    brollScale: 1.0,
    textOverlay: false,
    textPosition: 'bottom',
    textScale: 1.0,
    layout: 'standard',
    framing: 'standard',
    cameraAffinity: ['slow_push_in', 'gentle_pan'],
    beats: ['context', 'problem', 'solution'],
    intensityRange: [3, 7],
  },
  avatar_wide: {
    label: 'Avatar Wide',
    description: 'Avatar smaller, more B-roll visible',
    avatarRequired: true,
    avatarScale: 0.8,
    avatarPosition: { x: 0, y: 20 },
    avatarShape: 'standard',
    brollMode: 'background',
    brollOpacity: 1.0,
    brollScale: 1.05,
    textOverlay: false,
    textPosition: 'bottom',
    textScale: 1.0,
    layout: 'standard',
    framing: 'wide',
    cameraAffinity: ['parallax_motion', 'slow_pan'],
    beats: ['context', 'escalation'],
    intensityRange: [2, 6],
  },
  fullscreen_text: {
    label: 'Fullscreen Text',
    description: 'No avatar, text dominates screen over B-roll',
    avatarRequired: false,
    avatarVisible: false,
    avatarScale: 0,
    avatarPosition: { x: 0, y: 0 },
    avatarShape: 'standard',
    brollMode: 'background',
    brollOpacity: 0.15,
    brollScale: 1.0,
    textOverlay: true,
    textPosition: 'center',
    textScale: 1.2,
    layout: 'fullscreen_text',
    framing: 'text_primary',
    cameraAffinity: ['dynamic_zoom', 'dramatic_zoom_in'],
    beats: ['hook', 'peak'],
    intensityRange: [8, 10],
  },
  split_screen: {
    label: 'Split Screen',
    description: 'Avatar top, B-roll bottom, 50/50 vertical split',
    avatarRequired: true,
    avatarScale: 0.9,
    avatarPosition: { x: 0, y: -160 },
    avatarShape: 'standard',
    brollMode: 'background',
    brollOpacity: 1.0,
    brollScale: 1.0,
    splitRatio: 0.5,
    textOverlay: false,
    textPosition: 'bottom',
    textScale: 1.0,
    layout: 'vertical_split',
    framing: 'split',
    cameraAffinity: ['slow_push_in', 'parallax_motion'],
    beats: ['context', 'solution'],
    intensityRange: [5, 8],
  },
  broll_fullscreen: {
    label: 'B-Roll Fullscreen',
    description: 'Full B-roll with text overlay, no avatar',
    avatarRequired: false,
    avatarVisible: false,
    avatarScale: 0,
    avatarPosition: { x: 0, y: 0 },
    avatarShape: 'standard',
    brollMode: 'fullscreen',
    brollOpacity: 1.0,
    brollScale: 1.0,
    textOverlay: true,
    textPosition: 'bottom',
    textScale: 1.0,
    layout: 'broll_fullscreen',
    framing: 'broll_primary',
    cameraAffinity: ['cinematic_pan', 'parallax_motion'],
    beats: ['context', 'escalation', 'solution'],
    intensityRange: [4, 8],
  },
  broll_picture_in_picture: {
    label: 'B-Roll PiP',
    description: 'B-roll background with small circular avatar inset',
    avatarRequired: true,
    avatarScale: 0.5,
    avatarPosition: { x: -260, y: -480 },
    avatarShape: 'circle',
    brollMode: 'fullscreen',
    brollOpacity: 1.0,
    brollScale: 1.0,
    textOverlay: false,
    textPosition: 'bottom',
    textScale: 1.0,
    layout: 'pip',
    framing: 'pip',
    cameraAffinity: ['slow_push_in', 'gentle_pan'],
    beats: ['story', 'context'],
    intensityRange: [2, 6],
  },
  dramatic_zoom: {
    label: 'Dramatic Zoom',
    description: 'Fast zoom into scene center, high energy',
    avatarRequired: true,
    avatarScale: 1.2,
    avatarPosition: { x: 0, y: -20 },
    avatarShape: 'standard',
    brollMode: 'background',
    brollOpacity: 0.8,
    brollScale: 1.3,
    textOverlay: false,
    textPosition: 'bottom',
    textScale: 1.0,
    layout: 'zoom',
    framing: 'zoom',
    cameraAffinity: ['dramatic_zoom_in', 'dynamic_zoom'],
    beats: ['hook', 'peak', 'escalation'],
    intensityRange: [7, 10],
  },
  cinematic_pan: {
    label: 'Cinematic Pan',
    description: 'Slow horizontal pan across B-roll content',
    avatarRequired: true,
    avatarScale: 0.9,
    avatarPosition: { x: 0, y: 10 },
    avatarShape: 'standard',
    brollMode: 'background',
    brollOpacity: 1.0,
    brollScale: 1.15,
    textOverlay: false,
    textPosition: 'bottom',
    textScale: 1.0,
    layout: 'standard',
    framing: 'panoramic',
    cameraAffinity: ['parallax_motion', 'slow_pan'],
    beats: ['context', 'escalation', 'solution'],
    intensityRange: [4, 7],
  },
  testimonial_layout: {
    label: 'Testimonial Layout',
    description: 'Avatar centered with quote styling and brand framing',
    avatarRequired: true,
    avatarScale: 1.1,
    avatarPosition: { x: 0, y: 0 },
    avatarShape: 'rounded_square',
    brollMode: 'background',
    brollOpacity: 0.2,
    brollScale: 1.0,
    textOverlay: true,
    textPosition: 'below_avatar',
    textScale: 0.9,
    layout: 'testimonial',
    framing: 'testimonial',
    cameraAffinity: ['slow_push_in', 'micro_shake'],
    beats: ['solution', 'peak', 'cta'],
    intensityRange: [6, 9],
  },
};

// ---------- SCENE DIRECTIVE MAP ----------
// Per-narrative-beat directives for shot selection, camera, and visual style

const SCENE_DIRECTIVE_MAP = {
  hook: {
    preferredShots: ['dramatic_zoom', 'fullscreen_text', 'avatar_closeup'],
    avoidShots: ['broll_picture_in_picture', 'avatar_wide', 'cinematic_pan'],
    aggressionLevel: 'high',
    textEmphasis: 'maximum',
    motionIntensity: 0.9,
    cameraSpeed: 'fast',
    transitionIn: 'hard_cut',
    visualVariety: 'rapid',
    colorGrade: 'dramatic',
    filmEffects: ['vignette', 'light_leaks'],
    contrastBoost: 1.25,
    saturationBoost: 1.15,
  },
  context: {
    preferredShots: ['broll_fullscreen', 'cinematic_pan', 'avatar_medium', 'avatar_wide'],
    avoidShots: ['dramatic_zoom', 'fullscreen_text'],
    aggressionLevel: 'low',
    textEmphasis: 'moderate',
    motionIntensity: 0.4,
    cameraSpeed: 'slow',
    transitionIn: 'crossfade',
    visualVariety: 'moderate',
    colorGrade: 'cinematic',
    filmEffects: ['soft_bloom', 'vignette'],
    contrastBoost: 1.0,
    saturationBoost: 1.0,
  },
  problem: {
    preferredShots: ['avatar_closeup', 'broll_fullscreen', 'split_screen'],
    avoidShots: ['testimonial_layout', 'broll_picture_in_picture'],
    aggressionLevel: 'medium',
    textEmphasis: 'moderate',
    motionIntensity: 0.5,
    cameraSpeed: 'medium',
    transitionIn: 'dissolve',
    visualVariety: 'moderate',
    colorGrade: 'dramatic',
    filmEffects: ['vignette', 'film_grain'],
    contrastBoost: 1.15,
    saturationBoost: 0.9,
  },
  escalation: {
    preferredShots: ['cinematic_pan', 'dramatic_zoom', 'split_screen', 'broll_fullscreen'],
    avoidShots: ['broll_picture_in_picture', 'testimonial_layout'],
    aggressionLevel: 'high',
    textEmphasis: 'strong',
    motionIntensity: 0.7,
    cameraSpeed: 'medium',
    transitionIn: 'slide_left',
    visualVariety: 'rapid',
    colorGrade: 'dramatic',
    filmEffects: ['film_grain', 'vignette'],
    contrastBoost: 1.2,
    saturationBoost: 1.1,
  },
  solution: {
    preferredShots: ['testimonial_layout', 'broll_fullscreen', 'avatar_medium', 'split_screen'],
    avoidShots: ['dramatic_zoom', 'fullscreen_text'],
    aggressionLevel: 'medium',
    textEmphasis: 'strong',
    motionIntensity: 0.5,
    cameraSpeed: 'slow',
    transitionIn: 'zoom_in',
    visualVariety: 'moderate',
    colorGrade: 'cinematic',
    filmEffects: ['soft_bloom', 'vignette'],
    contrastBoost: 1.05,
    saturationBoost: 1.05,
  },
  peak: {
    preferredShots: ['dramatic_zoom', 'avatar_closeup', 'testimonial_layout', 'split_screen'],
    avoidShots: ['broll_picture_in_picture', 'avatar_wide'],
    aggressionLevel: 'very_high',
    textEmphasis: 'maximum',
    motionIntensity: 1.0,
    cameraSpeed: 'fast',
    transitionIn: 'flash',
    visualVariety: 'rapid',
    colorGrade: 'dramatic',
    filmEffects: ['film_grain', 'light_leaks', 'vignette'],
    contrastBoost: 1.3,
    saturationBoost: 1.2,
  },
  cta: {
    preferredShots: ['avatar_medium', 'testimonial_layout', 'split_screen'],
    avoidShots: ['dramatic_zoom', 'fullscreen_text', 'broll_picture_in_picture'],
    aggressionLevel: 'medium',
    textEmphasis: 'strong',
    motionIntensity: 0.3,
    cameraSpeed: 'slow',
    transitionIn: 'crossfade',
    visualVariety: 'stable',
    colorGrade: 'corporate',
    filmEffects: ['vignette'],
    contrastBoost: 1.05,
    saturationBoost: 0.95,
  },
};

// ---------- CAMERA SYSTEM ----------
// Defines zoom levels, speeds, motion intensities, and framing styles

const CAMERA_SYSTEM = {
  zoom: {
    subtle:     { from: 1.0, to: 1.05, ease: 'power1.out' },
    moderate:   { from: 1.0, to: 1.12, ease: 'power1.inOut' },
    dramatic:   { from: 1.0, to: 1.25, ease: 'power2.inOut' },
    aggressive: { from: 1.0, to: 1.40, ease: 'power3.in' },
  },
  speed: {
    slow:   { durationMultiplier: 1.0, ease: 'power1.out' },
    medium: { durationMultiplier: 0.7, ease: 'power1.inOut' },
    fast:   { durationMultiplier: 0.4, ease: 'power2.in' },
    instant:{ durationMultiplier: 0.15, ease: 'power3.in' },
  },
  framing: {
    tight:      { avatarMargin: 0,  brollMargin: 0,  textMargin: 0 },
    standard:   { avatarMargin: 30, brollMargin: 30, textMargin: 24 },
    wide:       { avatarMargin: 20, brollMargin: 20, textMargin: 30 },
    panoramic:  { avatarMargin: 15, brollMargin: 10, textMargin: 24 },
  },
};

// ---------- TRANSITIONS PER BEAT ----------

const TRANSITIONS_BY_BEAT = {
  hook:        'hard_cut',
  context:     'crossfade',
  problem:     'dissolve',
  escalation:  'slide_left',
  solution:    'zoom_in',
  peak:        'flash',
  cta:         'crossfade',
};

// ---------- LAYOUT DIVERSITY ENGINE ----------
// Prevents repetitive scene layouts and forces visual variation

class LayoutDiversityEngine {
  constructor() {
    this.recentShots = [];
    this.recentLayouts = [];
    this.maxRepetition = 2;
    this.minLayoutGap = 2;
  }

  /**
   * Enforce layout diversity across all scenes.
   * Mutates scenes in-place, returning the same array.
   */
  enforce(scenes) {
    this.recentShots = [];
    this.recentLayouts = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      if (!scene.shot) continue;

      // Rule 1: No more than maxRepetition same shot type consecutively
      const lastN = this.recentShots.slice(-this.maxRepetition);
      const sameCount = lastN.filter(s => s === scene.shot.type).length;
      if (sameCount >= this.maxRepetition) {
        const alternative = this._findAlternative(scene);
        if (alternative) {
          scene.shot = alternative;
        }
      }

      // Rule 2: No same layout pattern within minLayoutGap scenes
      const layoutKey = `${scene.shot.layout}_${scene.shot.avatarShape || 'standard'}`;
      const recentLayoutKeys = this.recentLayouts.slice(-this.minLayoutGap);
      if (recentLayoutKeys.includes(layoutKey)) {
        const layoutAlt = this._findLayoutAlternative(scene);
        if (layoutAlt) {
          scene.shot = layoutAlt;
        }
      }

      // Rule 3: Force variation in hook scenes (every hook must differ)
      if (scene.sceneType === 'hook' && this.recentShots.length > 0) {
        const lastShot = this.recentShots[this.recentShots.length - 1];
        if (lastShot === scene.shot.type) {
          const alt = this._findAlternative(scene);
          if (alt) {
            scene.shot = alt;
          }
        }
      }

      // Record what was used
      this.recentShots.push(scene.shot.type);
      const finalLayoutKey = `${scene.shot.layout}_${scene.shot.avatarShape || 'standard'}`;
      this.recentLayouts.push(finalLayoutKey);
    }

    return scenes;
  }

  _findAlternative(scene) {
    const beat = scene.narrativeBeat;
    const directive = SCENE_DIRECTIVE_MAP[scene.sceneType] || SCENE_DIRECTIVE_MAP.context;

    // Get preferred shots that haven't been used recently
    const candidates = directive.preferredShots
      .filter(key => key !== scene.shot.type)
      .map(key => ({ key, shot: SHOT_TYPES[key] }))
      .filter(s => s.shot);

    if (candidates.length === 0) {
      // Fallback: any shot type not in recent list
      const allKeys = Object.keys(SHOT_TYPES);
      const available = allKeys.filter(k =>
        k !== scene.shot.type && !this.recentShots.slice(-3).includes(k)
      );
      if (available.length > 0) {
        return { ...SHOT_TYPES[available[0]], type: available[0] };
      }
      return null;
    }

    const pick = candidates[0];
    return { ...SHOT_TYPES[pick.key], type: pick.key };
  }

  _findLayoutAlternative(scene) {
    const currentLayout = scene.shot.layout;
    const allKeys = Object.keys(SHOT_TYPES);
    const differentLayouts = allKeys
      .filter(k => SHOT_TYPES[k].layout !== currentLayout)
      .filter(k => {
        const shot = SHOT_TYPES[k];
        return shot.beats.includes(scene.narrativeBeat);
      });

    if (differentLayouts.length > 0) {
      const pick = differentLayouts[0];
      return { ...SHOT_TYPES[pick], type: pick };
    }
    return null;
  }

  /**
   * Calculate layout diversity score (0-100).
   */
  static score(scenes) {
    if (scenes.length <= 1) return 100;

    const shotTypes = scenes.map(s => s.shot ? s.shot.type : 'unknown');
    const layouts = scenes.map(s => s.shot ? s.shot.layout : 'unknown');

    // Unique shot types used
    const uniqueShots = new Set(shotTypes).size;
    const uniqueLayouts = new Set(layouts).size;

    // Consecutive repetition penalty
    let repetitions = 0;
    for (let i = 1; i < shotTypes.length; i++) {
      if (shotTypes[i] === shotTypes[i - 1]) repetitions++;
    }
    const repetitionPenalty = (repetitions / Math.max(1, shotTypes.length - 1)) * 40;

    // Diversity bonus
    const totalShotTypes = Object.keys(SHOT_TYPES).length;
    const shotVariety = (uniqueShots / Math.min(shotTypes.length, totalShotTypes)) * 40;
    const layoutVariety = (uniqueLayouts / Math.min(layouts.length, 7)) * 20;

    return Math.min(100, Math.round(shotVariety + layoutVariety + (100 - 40 - repetitionPenalty) * 0.4));
  }
}

// ---------- DIRECTOR SCORE ENGINE ----------
// Scores every scene 0-100 based on engagement, visual variety, retention support

class DirectorScoreEngine {
  /**
   * Score a single scene.
   */
  static score(scene, shot, previousScene) {
    let engagement = 50;
    let visualVariety = 50;
    let retentionSupport = 50;

    // ── ENGAGEMENT SCORING ──
    const beat = scene.sceneType || scene.narrativeBeat;

    if (beat === 'hook') {
      engagement += shot.framing === 'tight' ? 15 : 5;
      engagement += shot.framing === 'zoom' ? 20 : 0;
      engagement += (scene.motionIntensity || 0) > 0.7 ? 15 : 5;
      engagement += shot.textOverlay ? 10 : 0;
      engagement += shot.type === 'dramatic_zoom' ? 10 : 0;
    } else if (beat === 'peak') {
      engagement += shot.type === 'dramatic_zoom' ? 20 : 8;
      engagement += shot.framing === 'tight' ? 10 : 0;
      engagement += (scene.motionIntensity || 0) > 0.8 ? 12 : 0;
    } else if (beat === 'cta') {
      engagement += shot.layout === 'testimonial' ? 15 : 5;
      engagement += shot.layout === 'vertical_split' ? 10 : 0;
      engagement += shot.textOverlay ? 8 : 0;
    } else if (beat === 'escalation') {
      engagement += shot.type === 'cinematic_pan' ? 12 : 5;
      engagement += (scene.motionIntensity || 0) > 0.6 ? 10 : 0;
    } else {
      // context, problem, solution
      engagement += shot.brollMode === 'fullscreen' ? 10 : 3;
      engagement += shot.type !== 'broll_picture_in_picture' ? 5 : 0;
    }

    // Film effects boost engagement
    const effectsCount = (scene.filmEffects || []).length;
    engagement += Math.min(10, effectsCount * 4);

    // ── VISUAL VARIETY SCORING ──
    if (previousScene && previousScene.shot) {
      const typeChanged = previousScene.shot.type !== shot.type;
      const layoutChanged = previousScene.shot.layout !== shot.layout;
      const framingChanged = previousScene.shot.framing !== shot.framing;

      visualVariety += typeChanged ? 20 : -15;
      visualVariety += layoutChanged ? 15 : -5;
      visualVariety += framingChanged ? 10 : 0;

      // Camera motion change
      const prevCam = previousScene.cameraMotionType || '';
      const thisCam = scene.cameraMotionType || '';
      visualVariety += (prevCam !== thisCam && thisCam !== '') ? 10 : 0;
    } else {
      visualVariety += 25;
    }

    // ── RETENTION SUPPORT SCORING ──
    const directive = SCENE_DIRECTIVE_MAP[beat] || SCENE_DIRECTIVE_MAP.context;

    // Motion intensity alignment
    const targetIntensity = directive.motionIntensity;
    const actualIntensity = scene.motionIntensity || 0.5;
    const intensityDelta = Math.abs(targetIntensity - actualIntensity);
    retentionSupport += intensityDelta < 0.15 ? 15 : intensityDelta < 0.3 ? 5 : -10;

    // Color grading alignment
    if (scene.colorGrade === directive.colorGrade) retentionSupport += 8;

    // Duration sanity check (3-10s per scene is optimal)
    const dur = scene.duration || 5;
    retentionSupport += (dur >= 3 && dur <= 10) ? 8 : -5;

    // Text emphasis alignment
    if (scene.textEmphasis === directive.textEmphasis) retentionSupport += 5;

    // Beat-specific retention bonuses
    if (beat === 'hook' && dur <= 5) retentionSupport += 10;
    if (beat === 'peak' && actualIntensity >= 0.8) retentionSupport += 8;
    if (beat === 'cta' && shot.textOverlay) retentionSupport += 10;

    // Clamp all scores
    engagement = Math.max(0, Math.min(100, engagement));
    visualVariety = Math.max(0, Math.min(100, visualVariety));
    retentionSupport = Math.max(0, Math.min(100, retentionSupport));

    const overall = Math.round(
      engagement * 0.4 + visualVariety * 0.3 + retentionSupport * 0.3
    );

    return {
      overall: Math.max(0, Math.min(100, overall)),
      engagement,
      visualVariety,
      retentionSupport,
    };
  }
}

// ---------- SHOT SELECTION ENGINE ----------

/**
 * Select the best shot type for a scene using weighted scoring.
 */
function selectShotForScene(scene, previousShot) {
  const beat = scene.beat || scene.narrativeBeat || scene.sceneType;
  const directive = SCENE_DIRECTIVE_MAP[beat] || SCENE_DIRECTIVE_MAP.context;
  const intensity = scene.intensity || scene.emotionalIntensity || 5;

  const candidates = Object.entries(SHOT_TYPES).map(([key, shot]) => {
    let score = 0;

    // Beat affinity (+30 if shot's beats include this scene's narrative beat)
    if (shot.beats.includes(beat)) score += 30;

    // Director preference (+25 if in preferred list)
    if (directive.preferredShots.includes(key)) score += 25;

    // Avoid penalty (-40 if in avoid list)
    if (directive.avoidShots.includes(key)) score -= 40;

    // Intensity alignment (+15 if scene intensity falls in shot's range)
    const [minI, maxI] = shot.intensityRange;
    if (intensity >= minI && intensity <= maxI) score += 15;
    else if (intensity >= minI - 1 && intensity <= maxI + 1) score += 5;
    else score -= 10;

    // Layout diversity bonus (+20 if not used in previous scene)
    if (previousShot && previousShot.type === key) score -= 15;
    if (!previousShot) score += 10;

    // Camera affinity match (+10)
    if (shot.cameraAffinity.includes(directive.cameraAffinity ? directive.cameraAffinity[0] : '')) {
      score += 10;
    }

    // Framing variety (+8 if different framing from previous)
    if (previousShot && previousShot.framing !== shot.framing) score += 8;

    return { key, score, shot };
  });

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].key;
}

// ---------- CAMERA PLAN GENERATOR ----------
// Generates GSAP (HyperFrames) and FFmpeg (fallback) camera instructions

/**
 * Generate camera plan for a single scene.
 */
function generateSceneCamera(scene, shotKey, options) {
  const width = options.videoWidth || 720;
  const height = options.videoHeight || 1280;
  const beat = scene.beat || scene.narrativeBeat || scene.sceneType;
  const directive = SCENE_DIRECTIVE_MAP[beat] || SCENE_DIRECTIVE_MAP.context;

  const intensity = directive.motionIntensity;
  const speed = directive.cameraSpeed;
  const duration = scene.duration || 5;
  const fps = options.fps || 30;

  // Determine camera motion type based on shot and beat
  const shot = SHOT_TYPES[shotKey];
  const motionTypes = shot.cameraAffinity;
  const motionType = motionTypes[0] || 'slow_push_in';

  // Calculate zoom parameters from intensity
  let zoomLevel;
  if (intensity >= 0.85) zoomLevel = 'aggressive';
  else if (intensity >= 0.65) zoomLevel = 'dramatic';
  else if (intensity >= 0.4) zoomLevel = 'moderate';
  else zoomLevel = 'subtle';

  const zoom = CAMERA_SYSTEM.zoom[zoomLevel];
  const speedDef = CAMERA_SYSTEM.speed[speed] || CAMERA_SYSTEM.speed.medium;

  // Scale offsets based on intensity
  const offsetX = -(width * intensity * 0.04);
  const offsetY = -(height * intensity * 0.02);

  // Camera shake for high-intensity scenes
  const useShake = intensity >= 0.8 && (motionType === 'micro_shake' || motionType === 'dramatic_zoom_in');

  // GSAP output (for HyperFrames)
  const gsapFrom = { scale: zoom.from, x: 0, y: 0 };
  const gsapTo = {
    scale: zoom.to,
    x: Math.round(offsetX),
    y: Math.round(offsetY),
  };

  const gsap = {
    target: '#camera-container',
    from: gsapFrom,
    to: gsapTo,
    duration: duration,
    ease: speedDef.ease,
    startTime: scene.startTime || 0,
  };

  // Add shake if applicable
  if (useShake) {
    gsap.shake = {
      amplitude: Math.round(intensity * 4),
      frequency: 12,
      duration: duration * 0.3,
    };
  }

  // FFmpeg fallback output
  const maxZoom = zoom.to.toFixed(2);
  const zoomSpeed = (intensity * 0.003).toFixed(4);
  const totalFrames = Math.round(duration * fps);

  const ffmpeg = {
    filter: `zoompan=z='if(lte(zoom,${maxZoom}),zoom+${zoomSpeed},${maxZoom})':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}`,
  };

  // Pan-based motion for parallax/cinematic_pan
  if (motionType === 'parallax_motion' || motionType === 'cinematic_pan' || motionType === 'gentle_pan') {
    const panDistance = Math.round(width * intensity * 0.05);
    gsap.from.x = panDistance;
    gsap.to.x = -panDistance;
    gsap.from.y = 0;
    gsap.to.y = -(Math.round(height * intensity * 0.01));

    ffmpeg.filter = `crop=${width}:${height}:(iw-${width})/2:(ih-${height})/2,zoompan=z='1.0':x='if(lte(x,${-panDistance}),x+${Math.round(panDistance / totalFrames)},x-${Math.round(panDistance / totalFrames)})':d=${totalFrames}:s=${width}x${height}`;
  }

  return {
    motionType,
    zoom: { from: zoom.from, to: zoom.to, ease: zoom.ease },
    speed,
    motionIntensity: intensity,
    offsetX: Math.round(offsetX),
    offsetY: Math.round(offsetY),
    gsap,
    ffmpeg,
  };
}

// ---------- MAIN ENTRY POINT ----------

/**
 * Create a complete Director Plan from scene recommendations.
 *
 * @param {Object[]} sceneRecommendations - From story-arc.cjs analyzeArc()
 * @param {string} script - Original script text
 * @param {Object} options - Configuration
 * @param {number} [options.targetDuration=55] - Target video duration in seconds
 * @param {number} [options.videoWidth=720] - Video width
 * @param {number} [options.videoHeight=1280] - Video height
 * @param {number} [options.fps=30] - Frames per second
 * @returns {Object} DirectorPlan
 */
function createDirectorPlan(sceneRecommendations, script, options = {}) {
  const targetDuration = options.targetDuration || 55;
  const videoWidth = options.videoWidth || 720;
  const videoHeight = options.videoHeight || 1280;
  const fps = options.fps || 30;

  if (!sceneRecommendations || sceneRecommendations.length === 0) {
    return {
      version: '1.0',
      script,
      targetDuration,
      scenes: [],
      summary: {
        totalScenes: 0,
        shotDistribution: {},
        layoutDiversityScore: 100,
        averageDirectorScore: 0,
        estimatedRetentionBoost: 0,
        cameraComplexity: 'simple',
      },
    };
  }

  // Phase 1: Assign shots to each scene
  let previousShot = null;
  const planScenes = [];

  for (let i = 0; i < sceneRecommendations.length; i++) {
    const rec = sceneRecommendations[i];
    const beat = rec.beat || rec.narrativeBeat || 'story';
    const sceneType = mapBeatToSceneType(beat);
    const intensity = rec.intensity || rec.emotionalIntensity || 5;

    // Select shot type
    const shotKey = selectShotForScene(
      { ...rec, beat, sceneType, intensity },
      previousShot
    );
    const shot = { ...SHOT_TYPES[shotKey], type: shotKey };

    // Get directive for this beat
    const directive = SCENE_DIRECTIVE_MAP[beat] || SCENE_DIRECTIVE_MAP.context;

    planScenes.push({
      sceneId: rec.sceneId || `scene_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      sceneType,
      narrativeBeat: beat,
      scriptText: rec.scriptText || '',
      duration: rec.duration || 5,
      startTime: 0, // will be calculated
      shot,
      cameraMotionType: shot.cameraAffinity[0] || 'slow_push_in',
      motionIntensity: directive.motionIntensity,
      colorGrade: directive.colorGrade,
      filmEffects: [...directive.filmEffects],
      contrastBoost: directive.contrastBoost,
      saturationBoost: directive.saturationBoost,
      textEmphasis: directive.textEmphasis,
      transition: {
        type: directive.transitionIn,
        duration: beat === 'hook' ? 0.2 : 0.4,
      },
    });

    previousShot = shot;
  }

  // Phase 2: Enforce layout diversity
  const diversityEngine = new LayoutDiversityEngine();
  diversityEngine.enforce(planScenes);

  // Phase 3: Calculate start times
  let currentTime = 0;
  for (const scene of planScenes) {
    scene.startTime = currentTime;
    currentTime += scene.duration;
  }

  // Phase 4: Generate camera plans
  for (const scene of planScenes) {
    scene.camera = generateSceneCamera(scene, scene.shot.type, {
      videoWidth,
      videoHeight,
      fps,
    });

    // Director score
    const prevScene = planScenes.indexOf(scene) > 0
      ? planScenes[planScenes.indexOf(scene) - 1]
      : null;

    scene.directorScore = DirectorScoreEngine.score(
      {
        ...scene,
        motionIntensity: scene.motionIntensity,
        colorGrade: scene.colorGrade,
        filmEffects: scene.filmEffects,
        textEmphasis: scene.textEmphasis,
        duration: scene.duration,
        cameraMotionType: scene.camera.motionType,
      },
      scene.shot,
      prevScene
    );
  }

  // Phase 5: Build summary
  const shotDistribution = {};
  for (const scene of planScenes) {
    const key = scene.shot.type;
    shotDistribution[key] = (shotDistribution[key] || 0) + 1;
  }

  const diversityScore = LayoutDiversityEngine.score(planScenes);
  const avgScore = planScenes.length > 0
    ? Math.round(planScenes.reduce((sum, s) => sum + (s.directorScore ? s.directorScore.overall : 0), 0) / planScenes.length)
    : 0;

  // Camera complexity assessment
  const uniqueMotions = new Set(planScenes.map(s => s.camera.motionType)).size;
  const cameraComplexity = uniqueMotions >= 5 ? 'complex' : uniqueMotions >= 3 ? 'medium' : 'simple';

  // Estimate retention boost from scores
  const retentionBoost = planScenes.length > 0
    ? Math.round(planScenes.reduce((sum, s) => sum + (s.directorScore ? s.directorScore.retentionSupport : 50), 0) / planScenes.length / 100 * 20)
    : 0;

  return {
    version: '1.0',
    script,
    targetDuration,
    videoWidth,
    videoHeight,
    fps,
    scenes: planScenes,
    summary: {
      totalScenes: planScenes.length,
      shotDistribution,
      layoutDiversityScore: diversityScore,
      averageDirectorScore: avgScore,
      estimatedRetentionBoost: retentionBoost,
      cameraComplexity,
      totalDuration: currentTime,
    },
  };
}

// ---------- HELPER: Map beat to scene type ----------

function mapBeatToSceneType(beat) {
  switch (beat) {
    case 'hook': return 'hook';
    case 'context':
    case 'problem':
    case 'escalation':
    case 'solution': return 'story';
    case 'peak': return 'story';
    case 'cta': return 'cta';
    default: return 'story';
  }
}

// ---------- EXPORTS ----------

module.exports = {
  createDirectorPlan,
  SHOT_TYPES,
  SCENE_DIRECTIVE_MAP,
  CAMERA_SYSTEM,
  LayoutDiversityEngine,
  DirectorScoreEngine,
  selectShotForScene,
  generateSceneCamera,
  mapBeatToSceneType,
  TRANSITIONS_BY_BEAT,
};
