// ---------- CONSTANTS ----------

// Video dimensions for 9:16 vertical format
const VIDEO_WIDTH = 720;
const VIDEO_HEIGHT = 1280;
const SAFE_MARGIN = 30; // pixels for text/subtitle safety

// Scene types for different ad sections
const SCENE_TYPES = {
  HOOK: 'hook',        // First 3-5 seconds - grab attention
  STORY: 'story',      // Middle 30-40 seconds - tell story
  CTA: 'cta',          // Final 5-10 seconds - call to action
  TRANSITION: 'transition' // Transition between scenes
};

// Scene timing defaults (in seconds)
// HeyGen-style dynamic short-form pacing: fast minimums eliminate static
// hold, bounded maximums prevent any scene from swallowing the video.
// Story scenes can be as short as 2s to keep the cut fast and reduce
// any risk of a single scene holding the frame too long.
const SCENE_TIME = {
  HOOK: { min: 1.8, max: 5 },
  STORY: { min: 2.5, max: 12 },
  CTA: { min: 2.2, max: 7 }
};

// Transitions are uniformly short for a snappier feel.
const TRANSITION_TIME = {
  fast: 0.2,
  medium: 0.3,
  slow: 0.45,
};

// Hard minimum durations (in seconds) used by the no-empty-seconds guard.
// Anything below these would leave the frame looking static.
const MIN_DURATION = {
  HOOK: 1.5,
  STORY: 1.5,
  CTA: 1.5,
  TRANSITION: 0.15,
};

// Video target duration defaults
const TARGET_DURATION = {
  MIN: 45,   // 45 seconds minimum
  MAX: 60,   // 60 seconds maximum
  IDEAL: 55 // Ideal target
};

const { analyzeArc } = require("../../ai/story-arc.cjs");

// ---------- SCENE-BASED ARCHITECTURE ----------

/***
 * Scene Class - Represents a video scene
 */
class Scene {
  constructor({
    sceneId, sceneType, scriptText, startTime, duration,
    brollClips = [], avatarRequired = true, customTransition = null,
    emotionalIntensity = 5, narrativeBeat = null, pacingHint = 'medium',
    musicMood = 'inspiring', cameraMotion = 'gentle_pan'
  }) {
    this.sceneId = sceneId || `scene_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.sceneType = sceneType || SCENE_TYPES.STORY;
    this.scriptText = scriptText || "";
    this.startTime = startTime || 0;
    this.duration = duration || 5; // default 5 seconds
    this.brollClips = brollClips;
    this.avatarRequired = avatarRequired;
    this.customTransition = customTransition;
    // Arc metadata
    this.emotionalIntensity = emotionalIntensity;
    this.narrativeBeat = narrativeBeat;
    this.pacingHint = pacingHint;
    this.musicMood = musicMood;
    this.cameraMotion = cameraMotion;
    this.assets = {
      avatarVideo: null,
      brollVideos: [],
      voiceSegment: null,
      subtitleFile: null,
      backgroundMusic: null,
      background: null,
      verticalAvatar: null,
      subtitleOverlay: null,
    };
    this.metadata = {};
  }

  // Add asset to scene
  addAsset(type, asset) {
    if (this.assets[type] !== undefined) {
      if (type === 'brollVideos') {
        this.assets[type].push(asset);
      } else {
        this.assets[type] = asset;
      }
    }
  }

  // Get asset by type
  getAsset(type) {
    return this.assets[type];
  }

  // Calculate end time
  getEndTime() {
    return this.startTime + this.duration;
  }

  // BLACK SCREEN FIX: helper for the renderer to know whether the scene
  // currently has any visual element assigned. Returns one of:
  //   'avatar+broll'  — both are present
  //   'avatar'        — only the avatar
  //   'broll'         — only b-roll
  //   'empty'         — neither, renderer MUST use a fallback (base color)
  getVisualState() {
    const hasAvatar = !!this.assets.verticalAvatar;
    const hasBroll = !!this.assets.background;
    if (hasAvatar && hasBroll) return 'avatar+broll';
    if (hasAvatar) return 'avatar';
    if (hasBroll) return 'broll';
    return 'empty';
  }
}

/***
 * Scene Manager - Handles scene creation and timing
 */
class SceneManager {
  constructor() {
    this.scenes = [];
    this.totalDuration = 0;
    this.targetDuration = TARGET_DURATION.IDEAL;
  }

  // Add scene to the video
  addScene(scene) {
    // Set scene timing
    if (this.scenes.length === 0) {
      scene.startTime = 0;
    } else {
      scene.startTime = this.scenes[this.scenes.length - 1].getEndTime();
    }

    this.scenes.push(scene);
    this.totalDuration = scene.getEndTime();
  }

  // Adjust scene timing to fit target duration (arc-aware)
  balanceTiming(targetDuration = null) {
    if (targetDuration) {
      this.targetDuration = Math.min(Math.max(targetDuration, TARGET_DURATION.MIN), TARGET_DURATION.MAX);
    }

    const mainScenes = this.scenes.filter(s => s.sceneType !== SCENE_TYPES.TRANSITION);
    if (mainScenes.length === 0) return;

    // Calculate total current duration of main scenes
    let currentTotal = mainScenes.reduce((sum, s) => sum + s.duration, 0);
    const gap = this.targetDuration - currentTotal;

    if (Math.abs(gap) < 0.5) return; // Close enough

    // Arc-aware adjustment: distribute gap based on pacing hints
    // Fast scenes absorb less change, slow scenes absorb more
    const pacingWeights = {
      fast: 0.5,
      medium: 1.0,
      slow: 1.5,
      accelerating: 1.2,
    };

    const totalWeight = mainScenes.reduce((sum, s) => {
      return sum + (pacingWeights[s.pacingHint] || 1.0);
    }, 0);

    if (totalWeight === 0) return;

    for (const scene of mainScenes) {
      const weight = (pacingWeights[scene.pacingHint] || 1.0) / totalWeight;
      const adjustment = gap * weight;

      // Apply adjustment with bounds — use the per-type SCENE_TIME envelope
      const { min, max } = scene.narrativeBeat === 'cta'
        ? SCENE_TIME.CTA
        : scene.narrativeBeat === 'hook'
          ? SCENE_TIME.HOOK
          : SCENE_TIME.STORY;

      scene.duration = Math.max(min, Math.min(max, scene.duration + adjustment));
    }

    // Recalculate total after adjustment
    this.totalDuration = this.scenes[this.scenes.length - 1].getEndTime();
  }

  // Split script into scene objects using Story Arc Engine
  static createFromScript(script, directorPlan = null) {
    const manager = new SceneManager();

    // Use Story Arc Engine for intelligent scene mapping
    const arc = analyzeArc(script);
    console.log(`[SceneManager] Arc quality: ${arc.arcQuality}/100 | Beats: ${arc.totalBeats} | Avg intensity: ${arc.averageIntensity}`);

    // Create scenes from arc beats
    for (let i = 0; i < arc.sceneRecommendations.length; i++) {
      const rec = arc.sceneRecommendations[i];
      // Map narrative beat to scene type
      const sceneType = mapBeatToSceneType(rec.beat);

      const scene = new Scene({
        sceneType,
        scriptText: rec.scriptText,
        duration: rec.duration,
        avatarRequired: true,
        emotionalIntensity: rec.intensity,
        narrativeBeat: rec.beat,
        pacingHint: rec.pacing,
        musicMood: rec.musicMood,
        cameraMotion: rec.cameraMotion,
      });

      // Apply Director Plan overrides if available
      if (directorPlan && directorPlan.scenes[i]) {
        const planScene = directorPlan.scenes[i];
        scene.cameraMotion = planScene.camera ? planScene.camera.motionType : scene.cameraMotion;
        scene.emotionalIntensity = planScene.motionIntensity ? planScene.motionIntensity * 10 : scene.emotionalIntensity;
        scene.metadata.directorShot = planScene.shot || null;
    scene.shot = planScene.shot || null;
        scene.metadata.directorCamera = planScene.camera || null;
        scene.metadata.directorVisual = {
          colorGrading: planScene.colorGrade,
          filmEffects: planScene.filmEffects,
          contrastBoost: planScene.contrastBoost,
          saturationBoost: planScene.saturationBoost,
          textEmphasis: planScene.textEmphasis,
        };
        scene.metadata.directorScore = planScene.directorScore || null;
        scene.metadata.directorTransition = planScene.transition || null;
      }

      manager.addScene(scene);
    }

    // Add transition scenes between main scenes
    const scenesWithTransitions = [];
    for (let i = 0; i < manager.scenes.length; i++) {
      scenesWithTransitions.push(manager.scenes[i]);
      if (i < manager.scenes.length - 1) {
        const prevScene = manager.scenes[i];
        const nextScene = manager.scenes[i + 1];

        // Use director transition if available, otherwise arc-recommended
        let transitionEffect = 'crossfade';
        if (nextScene.metadata.directorTransition) {
          transitionEffect = nextScene.metadata.directorTransition.type || 'crossfade';
        } else if (nextScene.transitionIn) {
          transitionEffect = nextScene.transitionIn;
        }
        const { getTransition } = require('../../ai/transitions.cjs');
        const transitionConfig = getTransition(transitionEffect) || getTransition('crossfade');

        scenesWithTransitions.push(new Scene({
          sceneType: SCENE_TYPES.TRANSITION,
          duration: TRANSITION_TIME[prevScene.pacingHint] || TRANSITION_TIME.medium,
          customTransition: transitionConfig.effect,
          emotionalIntensity: Math.max(prevScene.emotionalIntensity, nextScene.emotionalIntensity) * 0.5,
          pacingHint: prevScene.pacingHint === 'fast' ? 'fast' : 'medium',
        }));
      }
    }

    // No-empty-seconds guard: any main scene shorter than the per-type
    // minimum is stretched to that minimum so the frame is never visually
    // static. Transitions are allowed to be shorter (crossfades work
    // visually at 0.2-0.5s) but never below MIN_DURATION.TRANSITION.
    for (const scene of manager.scenes) {
      if (scene.sceneType === SCENE_TYPES.TRANSITION) {
        if (scene.duration < MIN_DURATION.TRANSITION) {
          scene.duration = MIN_DURATION.TRANSITION;
        }
        continue;
      }
      // Map sceneType → MIN_DURATION
      const typeKey = scene.sceneType === SCENE_TYPES.HOOK ? 'HOOK'
                    : scene.sceneType === SCENE_TYPES.CTA ? 'CTA'
                    : 'STORY';
      if (scene.duration < MIN_DURATION[typeKey]) {
        scene.duration = MIN_DURATION[typeKey];
      }
    }

    manager.scenes = scenesWithTransitions;

    // Final balance pass — call balanceTiming with the current total so
    // any padding from the no-empty-seconds guard is absorbed.
    const runningTotal = manager.scenes.reduce((sum, s) => sum + s.duration, 0);
    manager.balanceTiming(runningTotal);

    // Post-balance: re-apply the no-empty-seconds guard in case
    // balanceTiming pulled any scene below the minimum.
    for (const scene of manager.scenes) {
      if (scene.sceneType === SCENE_TYPES.TRANSITION) continue;
      const typeKey = scene.sceneType === SCENE_TYPES.HOOK ? 'HOOK'
                    : scene.sceneType === SCENE_TYPES.CTA ? 'CTA'
                    : 'STORY';
      if (scene.duration < MIN_DURATION[typeKey]) {
        scene.duration = MIN_DURATION[typeKey];
      }
    }

    // BLACK SCREEN FIX: every main scene (non-transition) must declare
    // that it requires at least one visual element so the renderer knows
    // to draw SOMETHING (b-roll OR avatar OR both). Without this, a
    // scene with no assigned assets ends up rendering a blank frame
    // and the concat shows a black slice. The check is on the Scene
    // object, not on the runtime assets — it's a render-time guarantee
    // that the renderer must satisfy, surfaced as scene.requiresVisual.
    for (const scene of manager.scenes) {
      if (scene.sceneType === SCENE_TYPES.TRANSITION) {
        scene.requiresVisual = false; // transitions inherit from neighbors
        continue;
      }
      scene.requiresVisual = true;
      scene.visualPriority = scene.sceneType === SCENE_TYPES.HOOK ? 'broll' : 'avatar+broll';
    }

    // Balance timing with arc-aware pacing
    manager.balanceTiming();

    return manager;
  }
}

// Map narrative beat to scene type for rendering pipeline
function mapBeatToSceneType(beat) {
  const beatToSceneType = {
    hook: SCENE_TYPES.HOOK,
    context: SCENE_TYPES.STORY,
    problem: SCENE_TYPES.STORY,
    escalation: SCENE_TYPES.STORY,
    solution: SCENE_TYPES.STORY,
    peak: SCENE_TYPES.STORY,
    cta: SCENE_TYPES.CTA,
  };
  return beatToSceneType[beat] || SCENE_TYPES.STORY;
}

module.exports = {
  VIDEO_WIDTH,
  VIDEO_HEIGHT,
  SAFE_MARGIN,
  SCENE_TYPES,
  SCENE_TIME,
  TRANSITION_TIME,
  TARGET_DURATION,
  Scene,
  SceneManager,
  mapBeatToSceneType,
};
