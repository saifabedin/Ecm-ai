/**
 * Local Footage Library
 *
 * Provides zero-network B-roll footage from a local curated library.
 * Falls back gracefully when no local clips match.
 *
 * Directory structure:
 *   backend/assets/footage/
 *   ├── business/     ← office, teamwork, meetings
 *   ├── technology/   ← code, devices, futuristic
 *   ├── nature/       ← landscape, ocean, mountains
 *   ├── food/         ← cooking, restaurants, meals
 *   ├── fitness/      ← gym, yoga, running
 *   ├── lifestyle/    ← coffee, morning, home
 *   ├── abstract/     ← motion, particles, gradients
 *   └── city/         ← skyline, traffic, urban
 */

const fs = require("fs");
const path = require("path");

const FOOTAGE_DIR = path.join(__dirname, "../assets/footage");

// Niche → directory mapping for keyword lookup
const NicheMap = {
  // Business keywords
  office: "business", team: "business", meeting: "business",
  corporate: "business", professional: "business", company: "business",
  startup: "business", entrepreneur: "business", success: "business",
  money: "business", finance: "business", profit: "business",

  // Technology keywords
  tech: "technology", code: "technology", computer: "technology",
  software: "technology", ai: "technology", robot: "technology",
  digital: "technology", data: "technology", network: "technology",
  futuristic: "technology", innovation: "technology", device: "technology",

  // Nature keywords
  nature: "nature", ocean: "nature", mountain: "nature",
  forest: "nature", sky: "nature", sun: "nature",
  sunset: "nature", sunrise: "nature", beach: "nature",
  water: "nature", tree: "nature", flower: "nature",

  // Food keywords
  food: "food", cook: "food", restaurant: "food",
  meal: "food", coffee: "food", drink: "food",
  kitchen: "food", recipe: "food", dish: "food",

  // Fitness keywords
  fitness: "fitness", gym: "fitness", workout: "fitness",
  yoga: "fitness", run: "fitness", sport: "fitness",
  exercise: "fitness", muscle: "fitness", health: "fitness",

  // Lifestyle keywords
  home: "lifestyle", family: "lifestyle", lifestyle: "lifestyle",
  morning: "lifestyle", relax: "lifestyle", travel: "lifestyle",
  fashion: "lifestyle", beauty: "lifestyle", comfort: "lifestyle",

  // Abstract keywords
  abstract: "abstract", motion: "abstract", particle: "abstract",
  gradient: "abstract", color: "abstract", shape: "abstract",
  pattern: "abstract", texture: "abstract", animation: "abstract",

  // City keywords
  city: "city", urban: "city", skyline: "city",
  traffic: "city", street: "city", building: "city",
  architecture: "city", downtown: "city", bridge: "city",
};

/**
 * Find a niche directory that matches a keyword
 */
function matchKeywordToNiche(keyword) {
  const lower = keyword.toLowerCase();
  return NicheMap[lower] || null;
}

/**
 * Get all video files in a directory (recursive)
 */
function getVideoFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getVideoFiles(fullPath));
      } else if (/\.(mp4|mov|webm|avi)$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    // Ignore read errors
  }
  return files;
}

/**
 * Find local footage matching given keywords
 *
 * @param {string[]} keywords - Search keywords
 * @param {Set<string>} [excludePaths] - Paths to exclude (already used)
 * @returns {string|null} Path to a matching clip, or null
 */
function findLocalFootage(keywords, excludePaths = new Set()) {
  if (!keywords || keywords.length === 0) return null;

  // Try each keyword, looking for a matching niche
  for (const keyword of keywords) {
    const niche = matchKeywordToNiche(keyword);
    if (!niche) continue;

    const nicheDir = path.join(FOOTAGE_DIR, niche);
    const clips = getVideoFiles(nicheDir);

    // Find first unused clip
    for (const clip of clips) {
      if (!excludePaths.has(clip)) {
        return clip;
      }
    }
  }

  // Fallback: try all footage directories for any unused clip
  const allDirs = fs.readdirSync(FOOTAGE_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => path.join(FOOTAGE_DIR, d.name));

  for (const dir of allDirs) {
    const clips = getVideoFiles(dir);
    for (const clip of clips) {
      if (!excludePaths.has(clip)) {
        return clip;
      }
    }
  }

  return null;
}

/**
 * Get all available local footage (for listing/inventory)
 */
function listLocalFootage() {
  const inventory = {};
  const allDirs = fs.readdirSync(FOOTAGE_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const dir of allDirs) {
    const clips = getVideoFiles(path.join(FOOTAGE_DIR, dir));
    inventory[dir] = clips.length;
  }

  return inventory;
}

module.exports = {
  findLocalFootage,
  matchKeywordToNiche,
  listLocalFootage,
  getVideoFiles,
  FOOTAGE_DIR,
};
