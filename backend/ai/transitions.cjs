const fs = require("fs");
const path = require("path");

// Cinematic transition types with FFmpeg xfade effects
const CINEMATIC_TRANSITIONS = {
  fade: { effect: 'fade', description: 'Simple fade', duration: 0.5, mood: 'neutral' },
  crossfade: { effect: 'fade', description: 'Crossfade', duration: 0.5, mood: 'neutral' },
  slide_left: { effect: 'slideleft', description: 'Slide right to left', duration: 0.5, mood: 'dynamic' },
  slide_right: { effect: 'slideright', description: 'Slide left to right', duration: 0.5, mood: 'dynamic' },
  slide_up: { effect: 'slideup', description: 'Slide bottom to top', duration: 0.5, mood: 'dynamic' },
  slide_down: { effect: 'slidedown', description: 'Slide top to bottom', duration: 0.5, mood: 'dynamic' },
  zoom_in: { effect: 'zoomin', description: 'Zoom in', duration: 0.5, mood: 'dramatic' },
  zoom_out: { effect: 'zoomout', description: 'Zoom out', duration: 0.5, mood: 'dramatic' },
  wipe_left: { effect: 'wipeleft', description: 'Wipe right to left', duration: 0.5, mood: 'clean' },
  wipe_right: { effect: 'wiperight', description: 'Wipe left to right', duration: 0.5, mood: 'clean' },
  wipe_up: { effect: 'wipeup', description: 'Wipe bottom to top', duration: 0.5, mood: 'clean' },
  wipe_down: { effect: 'wipedown', description: 'Wipe top to bottom', duration: 0.5, mood: 'clean' },
  circle_crop: { effect: 'circlecrop', description: 'Circle crop', duration: 0.5, mood: 'artistic' },
  circle_open: { effect: 'circleopen', description: 'Circle open', duration: 0.5, mood: 'artistic' },
  push_left: { effect: 'pushleft', description: 'Push right to left', duration: 0.5, mood: 'energetic' },
  push_right: { effect: 'pushright', description: 'Push left to right', duration: 0.5, mood: 'energetic' },
  push_up: { effect: 'pushup', description: 'Push bottom to top', duration: 0.5, mood: 'energetic' },
  push_down: { effect: 'pushdown', description: 'Push top to bottom', duration: 0.5, mood: 'energetic' },
  dissolve: { effect: 'dissolve', description: 'Dissolve', duration: 0.5, mood: 'smooth' },
  pixelize: { effect: 'pixelize', description: 'Pixelate', duration: 0.5, mood: 'tech' },
  horzblur: { effect: 'horzblur', description: 'Horizontal blur', duration: 0.5, mood: 'dreamy' },
  vertblur: { effect: 'vertblur', description: 'Vertical blur', duration: 0.5, mood: 'dreamy' }
};

const SCENE_TRANSITION_MAP = {
  HOOK: ['fade', 'zoom_in', 'slide_left'],
  STORY: ['crossfade', 'dissolve', 'horzblur'],
  CTA: ['zoom_out', 'push_left', 'circle_crop'],
  TRANSITION: ['fade', 'slide_left', 'wipe_left']
};

function getTransition(transitionName) {
  return CINEMATIC_TRANSITIONS[transitionName] || CINEMATIC_TRANSITIONS.fade;
}

function getRandomTransition(sceneType = 'STORY') {
  const transitions = SCENE_TRANSITION_MAP[sceneType] || SCENE_TRANSITION_MAP.STORY;
  const randomName = transitions[Math.floor(Math.random() * transitions.length)];
  return getTransition(randomName);
}

function getAllTransitions() {
  return Object.keys(CINEMATIC_TRANSITIONS);
}

function getTransitionsByMood(mood) {
  return Object.entries(CINEMATIC_TRANSITIONS)
    .filter(([_, config]) => config.mood === mood)
    .map(([name, config]) => ({ name, ...config }));
}

function createAdvancedTransitions(transitionType = "fade") {
  const transition = getTransition(transitionType);
  return transition.effect;
}

function applyTransitions(scenes, transitionType = "fade") {
  return createAdvancedTransitions(transitionType);
}

function createCinematicTransitions() {
  return {
    fade: "fade", slide: "slideleft", zoom: "zoomin", wipe: "wipeleft",
    crossfade: "fade", push: "pushleft", circle: "circlecrop",
    dissolve: "dissolve", pixelize: "pixelize"
  };
}

function generateTransitionFilter(prevIndex, nextIndex, transitionType, duration, offset = 0.1) {
  const transition = getTransition(transitionType);
  return `[${prevIndex}:v][${nextIndex}:v]xfade=transition=${transition.effect}:duration=${duration}:offset=${offset}[video]`;
}

function generateAudioCrossfade(prevIndex, nextIndex, duration) {
  return `[${prevIndex}:a][${nextIndex}:a]acrossfade=d=${duration}[audio]`;
}

function getTransitionRecommendation(fromSceneType, toSceneType) {
  const fromTransitions = SCENE_TRANSITION_MAP[fromSceneType] || ['fade'];
  const toTransitions = SCENE_TRANSITION_MAP[toSceneType] || ['fade'];
  const common = fromTransitions.filter(t => toTransitions.includes(t));
  if (common.length > 0) {
    return getTransition(common[Math.floor(Math.random() * common.length)]);
  }
  return getTransition(fromTransitions[Math.floor(Math.random() * fromTransitions.length)]);
}

function isValidTransition(transitionType) {
  return CINEMATIC_TRANSITIONS.hasOwnProperty(transitionType);
}

function getTransitionDuration(sceneType) {
  const transition = getRandomTransition(sceneType);
  return transition.duration;
}

module.exports = {
  CINEMATIC_TRANSITIONS,
  SCENE_TRANSITION_MAP,
  getTransition,
  getRandomTransition,
  getAllTransitions,
  getTransitionsByMood,
  createAdvancedTransitions,
  applyTransitions,
  createCinematicTransitions,
  generateTransitionFilter,
  generateAudioCrossfade,
  getTransitionRecommendation,
  isValidTransition,
  getTransitionDuration
};
