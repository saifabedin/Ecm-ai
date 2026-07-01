// Thin wrapper re-exporting the public API of engine4-video.
// All implementation lives in ./services/video-orchestrator.cjs and ./services/*.cjs

const runEngine4 = require("./services/video-orchestrator.cjs");
const { SceneManager, Scene, SCENE_TYPES } = require("./services/scene-manager-service.cjs");
const avatarEngine = require("./avatar-engine.cjs");

module.exports = runEngine4;
module.exports.SceneManager = SceneManager;
module.exports.Scene = Scene;
module.exports.SCENE_TYPES = SCENE_TYPES;
module.exports.avatarEngine = avatarEngine;
