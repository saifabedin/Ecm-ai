// ---------- KEYWORD EXTRACTION & SCENE-TYPE MAPPING ----------

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { findLocalFootage } = require("../../ai/local-footage.cjs");
const { selectBest: selectBestRanked } = require("../../ai/footage-ranker.cjs");
const { SCENE_TYPES } = require("./scene-manager-service.cjs");

// Enhanced keyword extraction from script with frequency scoring
function extractKeywords(script) {
  if (!script || typeof script !== 'string') return [];

  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
    'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could',
    'may', 'might', 'must', 'shall', 'this', 'that', 'these', 'those',
    'am', 'pm', 'ltd', 'inc', 'corp', 'llc', 'company', 'business',
    'our', 'your', 'their', 'its', 'his', 'her', 'we', 'you', 'they',
    'what', 'when', 'where', 'how', 'why', 'which', 'who', 'whom',
    'about', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'between', 'same', 'than', 'just', 'also', 'very', 'too',
    'only', 'even', 'back', 'here', 'there', 'now', 'then', 'come',
    'make', 'get', 'take', 'want', 'need', 'like', 'look', 'find'
  ]);

  // Bigram extraction: capture meaningful 2-word phrases
  const cleanText = script.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ');
  const rawWords = cleanText.split(/\s+/).filter(w => w.length > 2);
  const words = rawWords.filter(w => !stopWords.has(w));

  // Score words by frequency
  const freq = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }

  // Extract bigrams (2-word phrases) for better semantic matching
  const bigrams = [];
  for (let i = 0; i < rawWords.length - 1; i++) {
    if (!stopWords.has(rawWords[i]) && !stopWords.has(rawWords[i + 1]) &&
        rawWords[i].length > 2 && rawWords[i + 1].length > 2) {
      bigrams.push(`${rawWords[i]} ${rawWords[i + 1]}`);
    }
  }

  // Rank: bigrams first (more specific), then high-frequency single words
  const ranked = [];
  const bigramSet = [...new Set(bigrams)].slice(0, 2);
  ranked.push(...bigramSet);

  const sortedWords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .filter(w => !ranked.some(r => r.includes(w)));

  ranked.push(...sortedWords);

  return ranked.slice(0, 5);
}

// Scene-type-to-keyword mapping for context-aware footage search
const SCENE_TYPE_KEYWORDS = {
  hook: [
    'dynamic', 'energetic', 'exciting', 'attention', 'impact',
    'explosion', 'flash', 'motion', 'speed', 'dramatic'
  ],
  story: [], // Populated from script keywords (context-aware)
  cta: [
    'action', 'contact', 'phone', 'website', 'visit',
    'click', 'connect', 'reach', 'engage', 'join'
  ],
  transition: []
};

// Generate search keywords per scene based on scene type + script context
function getKeywordsForScene(sceneType, scriptKeywords, sceneText) {
  const typeKeywords = SCENE_TYPE_KEYWORDS[sceneType] || [];

  // Extract scene-specific keywords from the scene text
  const sceneWords = extractKeywords(sceneText || '');

  // Merge: scene-specific words + script-level keywords + type fallback
  const merged = [];
  const seen = new Set();

  // 1. Scene-specific keywords (highest priority)
  for (const kw of sceneWords) {
    if (!seen.has(kw)) { merged.push(kw); seen.add(kw); }
  }

  // 2. Script-level keywords (medium priority)
  for (const kw of scriptKeywords) {
    if (!seen.has(kw)) { merged.push(kw); seen.add(kw); }
  }

  // 3. Scene-type fallback keywords (if we don't have enough)
  if (merged.length < 2) {
    for (const kw of typeKeywords) {
      if (!seen.has(kw)) { merged.push(kw); seen.add(kw); }
    }
  }

  return merged.slice(0, 3);
}

// Split script into chunks (basic scenes)
function splitScript(script) {
  if (!script || typeof script !== 'string') {
    console.log("[Engine4] Invalid script, using fallback");
    return ["Welcome to our amazing place!", "Try our special dishes today!", "Visit us now!"];
  }
  const scenes = script.split(/[.!?]/).filter(s => s.trim().length > 0);
  if (scenes.length === 0) {
    console.log("[Engine4] No scenes found, using fallback");
    return ["Welcome to our amazing place!", "Try our special dishes today!", "Visit us now!"];
  }
  return scenes;
}

// ---------- RESOURCE LIMITS ----------

const RESOURCE_LIMITS = {
  MAX_VIDEO_DURATION: 180,     // 3 minutes max
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB max download
  MAX_PROCESSING_TIME: 300 * 1000, // 5 minutes max per job
  MAX_CONCURRENT_JOBS: 3,      // Prevent resource exhaustion
  CLEANUP_INTERVAL: 3600       // Cleanup every hour
};

// ---------- B-ROLL FETCHING ----------

// Download a single video clip from URL with size monitoring
async function downloadClip(videoUrl, clipPath, timeoutMs = 30000) {
  let downloadedBytes = 0;
  const videoResp = await axios.get(videoUrl, {
    responseType: 'stream',
    timeout: timeoutMs
  });

  const writer = fs.createWriteStream(clipPath);

  videoResp.data.on('data', (chunk) => {
    downloadedBytes += chunk.length;
    if (downloadedBytes > RESOURCE_LIMITS.MAX_FILE_SIZE) {
      writer.destroy();
      videoResp.data.destroy();
      throw new Error(`File too large: ${downloadedBytes} bytes`);
    }
  });

  videoResp.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(clipPath));
    writer.on('error', reject);
  });

  return clipPath;
}

// Select best video file from Pexels response (HD MP4 preferred)
function selectBestVideoFile(video) {
  return video.video_files.find(f =>
    f.quality === 'hd' && f.file_type === 'video/mp4'
  ) || video.video_files.find(f =>
    f.file_type === 'video/mp4'
  ) || video.video_files[0];
}

// Cache a downloaded Pexels clip to local library for future reuse
function cacheToLocalLibrary(clipPath, keyword) {
  try {
    if (!fs.existsSync(clipPath)) return;

    const { matchKeywordToNiche, FOOTAGE_DIR } = require("../../ai/local-footage.cjs");
    const niche = matchKeywordToNiche(keyword) || "business";
    const destDir = path.join(FOOTAGE_DIR, niche);

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Check if we already have enough clips in this niche (max 10 per category)
    const existingClips = fs.readdirSync(destDir).filter(f => /\.(mp4|mov|webm)$/i.test(f));
    if (existingClips.length >= 10) return;

    const destPath = path.join(destDir, `cached_${Date.now()}.mp4`);
    fs.copyFileSync(clipPath, destPath);
    console.log(`[Engine4] Cached footage to local library: ${niche}/${path.basename(destPath)}`);
  } catch (cacheErr) {
    // Non-critical — don't fail the render
  }
}

// Fetch B-roll for a single scene with scene-type-aware keywords and diversity scoring
async function fetchBrollForScene(scene, scriptKeywords, tempDir, usedPexelsIds, usedKeywords) {
  const searchKeywords = getKeywordsForScene(scene.sceneType, scriptKeywords, scene.scriptText);
  if (searchKeywords.length === 0) return null;

  // 1. Try local footage library first (zero network cost)
  const localClip = findLocalFootage(searchKeywords);
  if (localClip) {
    // Copy to temp dir so it integrates with the rest of the pipeline
    const clipPath = path.join(tempDir, `broll_${scene.sceneId}_local_${Date.now()}.mp4`);
    try {
      fs.copyFileSync(localClip, clipPath);
      usedKeywords.add(searchKeywords[0]);
      console.log(`[Engine4] [Scene ${scene.sceneId}] Local clip: ${path.basename(localClip)}`);
      return clipPath;
    } catch (copyErr) {
      console.warn(`[Engine4] [Scene ${scene.sceneId}] Local copy failed:`, copyErr.message);
    }
  }

  // 2. Fall back to Pexels API
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  // Score keywords by diversity: prefer keywords not yet used by other scenes
  const scoredKeywords = searchKeywords.map(kw => ({
    keyword: kw,
    diversityScore: usedKeywords.has(kw) ? 0 : 1,
  })).sort((a, b) => b.diversityScore - a.diversityScore);

  // Try each keyword until we find an unused clip
  for (const { keyword } of scoredKeywords) {
    try {
      console.log(`[Engine4] [Scene ${scene.sceneId}] Searching: "${keyword}" (type=${scene.sceneType})`);
      const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(keyword)}&per_page=5&orientation=portrait`;
      const response = await axios.get(url, {
        headers: { Authorization: apiKey },
        timeout: 15000
      });

      if (!response.data.videos || response.data.videos.length === 0) continue;

      // Filter out already-used videos, then rank the rest
      const availableVideos = response.data.videos.filter(v => !usedPexelsIds.has(v.id));
      if (availableVideos.length === 0) continue;

      // Use footage ranker to select the best candidate
      const bestVideo = selectBestRanked(availableVideos, {
        sceneDuration: scene.duration,
        searchKeyword: keyword,
        usedKeywords,
      });

      if (!bestVideo) continue;

      const videoFile = selectBestVideoFile(bestVideo);
      if (!videoFile) continue;

      const clipPath = path.join(tempDir, `broll_${scene.sceneId}_${keyword}_${Date.now()}.mp4`);
      await downloadClip(videoFile.link, clipPath);

      usedPexelsIds.add(bestVideo.id);
      usedKeywords.add(keyword);

      // Cache to local library for future renders
      cacheToLocalLibrary(clipPath, keyword);

      console.log(`[Engine4] [Scene ${scene.sceneId}] Downloaded: ${keyword} (pexels:${bestVideo.id})`);
      return clipPath;
    } catch (keywordError) {
      console.warn(`[Engine4] [Scene ${scene.sceneId}] Keyword "${keyword}" failed:`, keywordError.message);
      continue;
    }
  }

  return null;
}

// Fetch enhanced B-roll clips — now supports both bulk and per-scene modes
async function fetchEnhancedBroll(script, tempDir, scenes = null) {
  try {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
      console.log("[Engine4] Pexels API key not found");
      return [];
    }

    const scriptKeywords = extractKeywords(script);
    console.log(`[Engine4] Extracted script keywords: ${scriptKeywords.join(', ')}`);

    // Per-scene mode: fetch one clip per scene with scene-type-aware search
    if (scenes && Array.isArray(scenes) && scenes.length > 0) {
      const usedPexelsIds = new Set();
      const usedKeywords = new Set(); // Track keywords used across scenes for diversity
      const brollMap = new Map(); // sceneId → clipPath

      for (const scene of scenes) {
        if (scene.sceneType === SCENE_TYPES.TRANSITION) continue;

        const clipPath = await fetchBrollForScene(scene, scriptKeywords, tempDir, usedPexelsIds, usedKeywords);
        if (clipPath) {
          brollMap.set(scene.sceneId, clipPath);
        }
      }

      // If some scenes didn't get clips, try diverse fallback keywords
      const mainScenes = scenes.filter(s => s.sceneType !== SCENE_TYPES.TRANSITION);
      const missingScenes = mainScenes.filter(s => !brollMap.has(s.sceneId));

      if (missingScenes.length > 0) {
        console.log(`[Engine4] ${missingScenes.length} scenes missing B-roll, trying diverse fallbacks`);

        // Diverse fallback keywords: visual themes that differ from already-used keywords
        const fallbackKeywords = [
          'nature landscape', 'city skyline', 'abstract motion',
          'technology futuristic', 'ocean waves sunset', 'mountain aerial',
          'coffee steam morning', 'workspace modern', 'team collaboration'
        ].filter(kw => !usedKeywords.has(kw));

        for (const scene of missingScenes) {
          // Try diverse keywords first
          let gotClip = false;
          for (const keyword of fallbackKeywords) {
            try {
              const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(keyword)}&per_page=3&orientation=portrait`;
              const response = await axios.get(url, {
                headers: { Authorization: apiKey },
                timeout: 15000
              });

              if (!response.data.videos || response.data.videos.length === 0) continue;

              for (const video of response.data.videos) {
                if (usedPexelsIds.has(video.id)) continue;
                const videoFile = selectBestVideoFile(video);
                if (!videoFile) continue;

                const clipPath = path.join(tempDir, `broll_${scene.sceneId}_fallback_${Date.now()}.mp4`);
                await downloadClip(videoFile.link, clipPath);
                usedPexelsIds.add(video.id);
                usedKeywords.add(keyword);
                brollMap.set(scene.sceneId, clipPath);
                gotClip = true;
                console.log(`[Engine4] [Scene ${scene.sceneId}] Fallback clip: ${keyword}`);
                break;
              }
              if (gotClip) break;
            } catch (fbErr) {
              continue;
            }
          }

          // Final fallback: default business clips
          if (!gotClip) {
            const defaultClips = await fetchDefaultBroll(tempDir);
            if (defaultClips.length > 0) {
              const clip = defaultClips[0];
              brollMap.set(scene.sceneId, clip);
            }
          }
        }
      }

      return brollMap;
    }

    // Legacy bulk mode: fetch clips for whole script
    if (scriptKeywords.length === 0) {
      console.log("[Engine4] No keywords found, using default search");
      return await fetchDefaultBroll(tempDir);
    }

    const clips = [];
    const usedPexelsIds = new Set();

    for (let i = 0; i < Math.min(scriptKeywords.length, 3); i++) {
      const keyword = scriptKeywords[i];
      console.log(`[Engine4] Fetching B-roll for keyword: ${keyword}`);

      try {
        const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(keyword)}&per_page=5&orientation=portrait`;
        const response = await axios.get(url, {
          headers: { Authorization: apiKey },
          timeout: 15000
        });

        if (response.data.videos && response.data.videos.length > 0) {
          for (const video of response.data.videos) {
            if (usedPexelsIds.has(video.id)) continue;

            const videoFile = selectBestVideoFile(video);
            if (!videoFile) continue;

            const clipPath = path.join(tempDir, `broll_${keyword}_${Date.now()}.mp4`);
            await downloadClip(videoFile.link, clipPath);

            usedPexelsIds.add(video.id);
            clips.push(clipPath);
            console.log(`[Engine4] Downloaded B-roll: ${clipPath}`);
            break; // One clip per keyword in bulk mode
          }
        }
      } catch (keywordError) {
        console.warn(`[Engine4] Failed to fetch B-roll for keyword "${keyword}":`, keywordError.message);
        continue;
      }
    }

    if (clips.length < 2) {
      console.log("[Engine4] Adding default B-roll clips");
      const defaultClips = await fetchDefaultBroll(tempDir);
      clips.push(...defaultClips.slice(0, 2 - clips.length));
    }

    return clips.slice(0, 4);
  } catch (error) {
    console.error("[Engine4] B-roll fetching failed:", error.message);
    return await fetchDefaultBroll(tempDir);
  }
}

// Fetch default B-roll clips as fallback
async function fetchDefaultBroll(tempDir) {
  try {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) return [];

    console.log("[Engine4] Fetching default B-roll clips");
    const url = `https://api.pexels.com/videos/search?query=business%20success&per_page=3&orientation=portrait`;
    const response = await axios.get(url, {
      headers: { Authorization: apiKey },
      timeout: 15000
    });

    const clips = [];
    if (response.data.videos && response.data.videos.length > 0) {
      for (const video of response.data.videos.slice(0, 2)) {
        const videoFile = video.video_files.find(f =>
          f.quality === 'hd' && f.file_type === 'video/mp4'
        ) || video.video_files[0];

        if (videoFile) {
          const clipPath = path.join(tempDir, `default_broll_${Date.now()}.mp4`);
          const videoResp = await axios.get(videoFile.link, {
            responseType: 'stream',
            timeout: 30000
          });
          const writer = fs.createWriteStream(clipPath);
          videoResp.data.pipe(writer);

          await new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(clipPath));
            writer.on('error', reject);
          });

          clips.push(clipPath);
        }
      }
    }

    return clips;
  } catch (error) {
    console.error("[Engine4] Default B-roll fetch failed:", error.message);
    return [];
  }
}

module.exports = {
  extractKeywords,
  getKeywordsForScene,
  splitScript,
  RESOURCE_LIMITS,
  downloadClip,
  selectBestVideoFile,
  cacheToLocalLibrary,
  fetchBrollForScene,
  fetchEnhancedBroll,
  fetchDefaultBroll,
};
