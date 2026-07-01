const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const ffmpeg = require("fluent-ffmpeg");

// ---------- SFX ASSET LIBRARY ----------

const SFX_DIR = path.join(__dirname, "../assets/sfx");

// Scene type → SFX mapping
const SCENE_SFX_MAP = {
  hook: {
    primary: "whoosh sfx.mp3",
    secondary: "glitch sfx.mp3",
    volume: 0.35,
    triggerPoints: ["start"],  // at scene start
  },
  story: {
    primary: "ding sfx.mp3",
    secondary: "whoosh sfx.mp3",
    volume: 0.2,
    triggerPoints: ["midpoint"],  // at scene midpoint
  },
  peak: {
    primary: "moneysfx.mp3",
    secondary: "success slick sfx.mp3",
    volume: 0.4,
    triggerPoints: ["start", "midpoint"],
  },
  cta: {
    primary: "computer click.mp3",
    secondary: "success slick sfx.mp3",
    volume: 0.35,
    triggerPoints: ["start"],
  },
  transition: {
    primary: "whoosh sfx.mp3",
    secondary: "glitch sfx.mp3",
    volume: 0.25,
    triggerPoints: ["start"],
  },
};

// Retention-integration SFX triggers (keyword → SFX)
const RETENTION_SFX_TRIGGERS = [
  { pattern: /wait|stop|hold on|listen/i, sfx: "whoosh sfx.mp3", volume: 0.4, label: "pattern_interrupt" },
  { pattern: /\$|money|profit|earn|revenue|income|save/i, sfx: "moneysfx.mp3", volume: 0.4, label: "money_claim" },
  { pattern: /click|tap|sign up|join|link|subscribe/i, sfx: "computer click.mp3", volume: 0.35, label: "cta_popup" },
  { pattern: /success|win|achieve|goal|done|complete/i, sfx: "success slick sfx.mp3", volume: 0.35, label: "success_statement" },
  { pattern: /free|bonus|special|exclusive|limited/i, sfx: "ding sfx.mp3", volume: 0.3, label: "bonus_claim" },
  { pattern: /wrong|mistake|fail|problem|issue/i, sfx: "wrong.mp3", volume: 0.3, label: "negative" },
  { pattern: /glitch|broken|error|bug/i, sfx: "glitch sfx.mp3", volume: 0.35, label: "glitch" },
];

// ---------- SFX GENERATION ----------

/**
 * Get available SFX files from assets directory
 */
function getAvailableSfx() {
  if (!fs.existsSync(SFX_DIR)) {
    console.warn("[SFX] SFX directory not found:", SFX_DIR);
    return [];
  }
  try {
    return fs.readdirSync(SFX_DIR)
      .filter(f => f.endsWith(".mp3") || f.endsWith(".wav"))
      .map(f => path.join(SFX_DIR, f));
  } catch (err) {
    console.error("[SFX] Error reading SFX directory:", err.message);
    return [];
  }
}

/**
 * Get SFX file path by name
 */
function getSfxByName(name) {
  const files = getAvailableSfx();
  const match = files.find(f => path.basename(f).toLowerCase() === name.toLowerCase());
  if (match) return match;
  // Partial match
  const partial = files.find(f => path.basename(f).toLowerCase().includes(name.toLowerCase()));
  return partial || null;
}

/**
 * Get SFX config for a scene type
 */
function getSfxForScene(sceneType, scriptText = "") {
  const config = SCENE_SFX_MAP[sceneType] || SCENE_SFX_MAP.story;
  const sfxPath = getSfxByName(config.primary);
  const fallbackPath = getSfxByName(config.secondary);

  return {
    sfxPath: sfxPath || fallbackPath,
    volume: config.volume,
    triggerPoints: config.triggerPoints,
    label: `${sceneType}_primary`,
  };
}

/**
 * Scan script text for retention-trigger keywords and return matching SFX
 * Returns array of { sfxPath, volume, label, triggerWord }
 */
function getRetentionSfx(scriptText) {
  if (!scriptText) return [];
  const matches = [];
  for (const trigger of RETENTION_SFX_TRIGGERS) {
    const found = scriptText.match(trigger.pattern);
    if (found) {
      const sfxPath = getSfxByName(trigger.sfx);
      if (sfxPath) {
        matches.push({
          sfxPath,
          volume: trigger.volume,
          label: trigger.label,
          triggerWord: found[0],
        });
      }
    }
  }
  return matches;
}

// ---------- SFX TIMING ----------

/**
 * Calculate SFX placement times for a scene
 * @param {Object} scene - scene object with duration, startTime, sceneType
 * @param {string} scriptText - scene script text for retention keyword matching
 * @returns {Array} [{ sfxPath, startTime, duration, volume, label }]
 */
function calculateSfxTiming(scene, scriptText = "") {
  const placements = [];
  const config = SCENE_SFX_MAP[scene.sceneType] || SCENE_SFX_MAP.story;
  const sfxPath = getSfxByName(config.primary) || getSfxByName(config.secondary);

  if (!sfxPath) return placements;

  // Scene-type based placements
  for (const trigger of config.triggerPoints) {
    let offset = 0;
    if (trigger === "midpoint") offset = scene.duration / 2;
    else if (trigger === "end") offset = Math.max(0, scene.duration - 0.5);

    placements.push({
      sfxPath,
      startTime: scene.startTime + offset,
      duration: estimateSfxDuration(sfxPath),
      volume: config.volume,
      label: `${scene.sceneType}_${trigger}`,
    });
  }

  // Retention keyword placements
  const retentionSfx = getRetentionSfx(scriptText);
  for (const rsfx of retentionSfx) {
    placements.push({
      sfxPath: rsfx.sfxPath,
      startTime: scene.startTime + scene.duration * 0.3, // 30% into scene
      duration: estimateSfxDuration(rsfx.sfxPath),
      volume: rsfx.volume,
      label: rsfx.label,
    });
  }

  return placements;
}

/**
 * Estimate SFX duration from file using ffprobe (cached after first call)
 */
const durationCache = new Map();
function estimateSfxDuration(sfxPath) {
  if (durationCache.has(sfxPath)) {
    return durationCache.get(sfxPath);
  }

  // Synchronous fallback estimate based on file name heuristics
  // Most SFX are 0.5-2.0 seconds
  return 1.0;
}

async function getSfxDuration(sfxPath) {
  if (durationCache.has(sfxPath)) {
    return durationCache.get(sfxPath);
  }

  return new Promise((resolve) => {
    ffmpeg.ffprobe(sfxPath, (err, metadata) => {
      if (err) {
        resolve(1.0);
        return;
      }
      const dur = metadata.format.duration || 1.0;
      durationCache.set(sfxPath, dur);
      resolve(dur);
    });
  });
}

// ---------- HYPERFRAMES INTEGRATION ----------

/**
 * Generate SFX audio elements for HyperFrames composition
 * Returns { html: [...], gsap: [...] } for integration into composition-generator.cjs
 */
function generateSfxElements(scenes, assets, options = {}) {
  const html = [];
  const gsap = [];
  let currentTime = 0;
  let trackIndex = 30; // SFX track index (above voiceover=20, music=21)

  for (const scene of scenes) {
    if (scene.sceneType === "transition") {
      currentTime += scene.duration;
      continue;
    }

    const scriptText = scene.scriptText || "";
    const placements = calculateSfxTiming(scene, scriptText);

    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      const elementId = `sfx-${scene.sceneType}-${i}-${Date.now()}`;

      // Copy SFX file reference — actual files are copied by copyAssetsToProject
      const sfxFileName = `sfx-${trackIndex}.mp3`;
      const relativePath = `assets/${sfxFileName}`;

      // Store mapping for asset copy
      if (!assets._sfxMap) assets._sfxMap = {};
      assets._sfxMap[sfxFileName] = p.sfxPath;

      const duration = p.duration || 1.5;

      html.push(`<audio id="${elementId}"
  data-start="${p.startTime.toFixed(2)}"
  data-duration="${duration.toFixed(2)}"
  data-track-index="${trackIndex}"
  data-volume="${p.volume}"
  data-label="${p.label}"
  src="${relativePath}"></audio>`);

      trackIndex++;
    }

    currentTime += scene.duration;
  }

  return { html, gsap };
}

// ---------- FFMPEG MIXING ----------

/**
 * Build FFmpeg filter_complex for SFX layers
 * @param {Array} sfxPlacements - [{ sfxPath, startTime, duration, volume, label }]
 * @param {number} totalDuration - total video duration in seconds
 * @returns {string} FFmpeg filter_complex fragment
 */
function buildSfxMixFilter(sfxPlacements, totalDuration) {
  if (!sfxPlacements || sfxPlacements.length === 0) return "";

  const filters = [];

  sfxPlacements.forEach((sfx, idx) => {
    const inputIdx = idx; // These will be mapped as separate -i inputs
    const delayMs = Math.round(sfx.startTime * 1000);

    // Delay SFX to correct position, apply volume
    filters.push(
      `[${inputIdx}:a]adelay=${delayMs}|${delayMs},volume=${sfx.volume},apad=whole_dur=${totalDuration}[sfx${idx}]`
    );
  });

  // Mix all SFX layers together
  const sfxLabels = sfxPlacements.map((_, idx) => `[sfx${idx}]`).join("");
  filters.push(`${sfxLabels}amix=inputs=${sfxPlacements.length}:duration=longest:dropout_transition=0[sfxout]`);

  return filters.join(";\n");
}

/**
 * Build full audio mix filter: voice + music + SFX
 */
function buildFullAudioMixFilter(voiceIdx, musicIdx, sfxPlacements, totalDuration) {
  const parts = [];

  // Voice layer
  parts.push(`[${voiceIdx}:a]volume=1.0[voice]`);

  // Music layer with ducking
  parts.push(`[${musicIdx}:a]volume=0.25[music]`);

  // SFX layers
  if (sfxPlacements && sfxPlacements.length > 0) {
    sfxPlacements.forEach((sfx, idx) => {
      const delayMs = Math.round(sfx.startTime * 1000);
      parts.push(
        `[${idx + 2}:a]adelay=${delayMs}|${delayMs},volume=${sfx.volume},apad=whole_dur=${totalDuration}[sfx${idx}]`
      );
    });

    // Mix all: voice + music + sfx layers
    const allInputs = ["[voice]", "[music]", ...sfxPlacements.map((_, idx) => `[sfx${idx}]`)];
    parts.push(`${allInputs.join("")}amix=inputs=${allInputs.length}:duration=first:dropout_transition=2[audio]`);
  } else {
    parts.push("[voice][music]amix=inputs=2:duration=first:dropout_transition=2[audio]");
  }

  return parts.join(";\n");
}

// ---------- ASSET MANAGEMENT ----------

/**
 * Copy SFX files to composition project directory
 */
function copySfxToProject(projectDir, sfxPlacements) {
  const assetsDir = path.join(projectDir, "assets");
  fs.mkdirSync(assetsDir, { recursive: true });

  const copiedFiles = {};

  sfxPlacements.forEach((sfx, idx) => {
    if (sfx.sfxPath && fs.existsSync(sfx.sfxPath)) {
      const dest = path.join(assetsDir, `sfx-${30 + idx}.mp3`);
      try {
        fs.copyFileSync(sfx.sfxPath, dest);
        copiedFiles[`sfx-${idx}`] = dest;
      } catch (err) {
        console.warn(`[SFX] Failed to copy ${sfx.sfxPath}:`, err.message);
      }
    }
  });

  return copiedFiles;
}

// ---------- SCENE ANALYSIS ----------

/**
 * Detect peak/money/success moments in script for aggressive SFX placement
 */
function detectPeakMoments(script) {
  if (!script) return [];
  const moments = [];

  // Money/profit claims
  const moneyRegex = /\$[\d,]+|\d+[%]|revenue|profit|earn|income|save|savings/gi;
  let match;
  while ((match = moneyRegex.exec(script)) !== null) {
    moments.push({ type: "money", position: match.index, word: match[0] });
  }

  // Success statements
  const successRegex = /success|win|achieve|goal|completed|done|finished|ready|launched/gi;
  while ((match = successRegex.exec(script)) !== null) {
    moments.push({ type: "success", position: match.index, word: match[0] });
  }

  // Urgency/FOMO
  const urgencyRegex = /now|today|limited|hurry|fast|quick|urgent|only.*left|last.*chance/gi;
  while ((match = urgencyRegex.exec(script)) !== null) {
    moments.push({ type: "urgency", position: match.index, word: match[0] });
  }

  return moments;
}

/**
 * Calculate all SFX placements for the entire video
 * @param {Array} scenes - SceneManager.scenes
 * @param {string} script - full script text
 * @returns {Array} all SFX placements with absolute timing
 */
function calculateAllSfxPlacements(scenes, script) {
  const allPlacements = [];
  const peakMoments = detectPeakMoments(script);

  for (const scene of scenes) {
    if (scene.sceneType === "transition") continue;

    const placements = calculateSfxTiming(scene, scene.scriptText || "");
    allPlacements.push(...placements);
  }

  // Add peak moment SFX (aggressive placements for money/success)
  for (const moment of peakMoments) {
    // Map character position to approximate scene time
    const approxTime = (moment.position / Math.max(1, script.length)) * scenes.reduce((sum, s) => sum + (s.duration || 0), 0);
    const sfxMap = {
      money: "moneysfx.mp3",
      success: "success slick sfx.mp3",
      urgency: "ding sfx.mp3",
    };
    const sfxPath = getSfxByName(sfxMap[moment.type] || "ding sfx.mp3");
    if (sfxPath) {
      allPlacements.push({
        sfxPath,
        startTime: approxTime,
        duration: 1.0,
        volume: 0.35,
        label: `peak_${moment.type}`,
      });
    }
  }

  // Sort by time
  allPlacements.sort((a, b) => a.startTime - b.startTime);

  return allPlacements;
}

// ---------- EXPORTS ----------

module.exports = {
  // Constants
  SCENE_SFX_MAP,
  RETENTION_SFX_TRIGGERS,
  SFX_DIR,

  // Asset functions
  getAvailableSfx,
  getSfxByName,
  getSfxForScene,

  // Retention integration
  getRetentionSfx,
  detectPeakMoments,

  // Timing
  calculateSfxTiming,
  calculateAllSfxPlacements,
  getSfxDuration,
  estimateSfxDuration,

  // HyperFrames
  generateSfxElements,

  // FFmpeg mixing
  buildSfxMixFilter,
  buildFullAudioMixFilter,

  // Asset management
  copySfxToProject,
};
