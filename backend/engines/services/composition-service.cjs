// ---------- COMPOSITION SERVICE ----------
// Handles: composeAdvancedVideo, composeSimpleVideo, render stack, cleanup state

const fs = require("fs");
const path = require("path");
const gpuRender = require("../../render/gpu-render-service.cjs");
const visualQuality = require("../../ai/visual-quality.cjs");
const sfx = require("../../ai/sfx.cjs");
const { getSfxFallback } = require("../../ai/music.cjs");
const avatarEngine = require("../avatar-engine.cjs");
const { fetchEnhancedBroll } = require("./asset-handler.cjs");
const {
  VIDEO_WIDTH,
  VIDEO_HEIGHT,
  SAFE_MARGIN,
  SCENE_TYPES,
  TARGET_DURATION,
  Scene,
  SceneManager,
} = require("./scene-manager-service.cjs");
const {
  runFFmpeg,
  getAudioDuration,
  getVideoDuration,
  formatSrtTime,
  cropToVertical,
} = require("./ffmpeg-service.cjs");

// ---------- CROSS-MODULE STATE ----------
// tempFiles is owned by the orchestrator (runEngine4) but createVerticalSubtitles
// adds to it. We expose a setter so the orchestrator can register its Set;
// createVerticalSubtitles reads it via getCurrentTempFiles().
let _currentTempFiles = null;
function setCurrentTempFiles(set) { _currentTempFiles = set; }
function getCurrentTempFiles() { return _currentTempFiles; }

// usedBackgroundClips is a process-level Set that tracks every background
// clip path rendered during the current video. It survives across calls
// so the same B-roll never appears twice in a single output (the classic
// "same clip 4 times in a row" bug). Reset at the start of each render.
let _usedBackgroundClips = new Set();
function resetUsedBackgroundClips() { _usedBackgroundClips = new Set(); }
function markUsedBackgroundClip(clipPath) {
  if (clipPath) _usedBackgroundClips.add(clipPath);
}
function getUsedBackgroundClips() { return _usedBackgroundClips; }

/**
 * Pick the next background clip for a scene, avoiding the previous scene's
 * clip and the global "already used" set. Cycles through the pool with a
 * stride when the pool is smaller than the scene count so adjacent scenes
 * never share a clip.
 */
function pickNextBackgroundClip(pool, previousClip) {
  if (!pool || pool.length === 0) return null;
  if (pool.length === 1) return pool[0];

  // Find the first pool entry that is unused AND not the previous scene's clip
  for (let i = 0; i < pool.length; i++) {
    const candidate = pool[i];
    if (candidate && !_usedBackgroundClips.has(candidate) && candidate !== previousClip) {
      return candidate;
    }
  }
  // Pool exhausted: cycle with stride so the previous scene's clip is avoided
  const stride = Math.max(1, Math.floor(pool.length / 2) || 1);
  for (let i = 1; i <= pool.length; i++) {
    const candidate = pool[(i * stride) % pool.length];
    if (candidate && candidate !== previousClip) return candidate;
  }
  return pool[0];
}

// Compose final video with scene-based vertical rendering
async function composeAdvancedVideo(avatarVideoPath, brollPaths, voiceoverPath, script, tempDir, subtitleTimings = null, vqOptions = null, directorPlan = null, brandKit = null) {
  try {
    console.log("[Engine4] Starting advanced cinematic video composition");

    // Reset the per-video "already used background clip" set so dedup is
    // scoped to this single video only. Without this, the second video
    // in a long-running process would inherit clips marked as "used" by
    // the first video and end up empty.
    resetUsedBackgroundClips();

    // Create scene manager from script (with Director Plan if available)
    const sceneManager = SceneManager.createFromScript(script, directorPlan);

    // Set target duration based on voiceover
    let targetDuration = TARGET_DURATION.IDEAL;
    if (voiceoverPath) {
      const voiceDuration = await getAudioDuration(voiceoverPath);
      targetDuration = Math.max(Math.min(voiceDuration, TARGET_DURATION.MAX), TARGET_DURATION.MIN);
    }
    sceneManager.balanceTiming(targetDuration);

    console.log(`[Engine4] Final video will be ${sceneManager.totalDuration}s with ${sceneManager.scenes.length} scenes`);

  // Fetch per-scene B-roll with scene-type-aware keywords (returns Map<sceneId, clipPath>)
  const usedBrollGlobal = new Set(); // Global dedup — never repeat the exact same clip anywhere in a single video
  let brollMap = new Map();
  if (brollPaths.length > 0) {
    try {
      const fetchedMap = await fetchEnhancedBroll(script, tempDir, sceneManager.scenes);
      if (fetchedMap instanceof Map) {
        brollMap = fetchedMap;
      } else {
        // Fallback: legacy bulk mode returned array — distribute with global dedup
        const mainScenes = sceneManager.scenes.filter(s => s.sceneType !== SCENE_TYPES.TRANSITION);
        const pool = brollPaths.slice();
        let poolCursor = 0;
        mainScenes.forEach((scene) => {
          if (pool.length === 0) return;
          const candidate = pool[poolCursor % pool.length];
          brollMap.set(scene.sceneId, candidate);
          poolCursor++;
        });
      }
    } catch (brollFetchError) {
      console.warn("[Engine4] Per-scene B-roll fetch failed, using pre-fetched clips:", brollFetchError.message);
      const mainScenes = sceneManager.scenes.filter(s => s.sceneType !== SCENE_TYPES.TRANSITION);
      mainScenes.forEach((scene, idx) => {
        if (brollPaths.length > 0) {
          brollMap.set(scene.sceneId, brollPaths[idx % brollPaths.length]);
        }
      });
    }
  }

  // Global dedup pass: walk brollMap in scene order and ensure no clip is
  // used more than once across the entire video. Rotates to the next
  // available pool clip when a repeat would otherwise occur. If the pool
  // is smaller than the scene count, we cycle through with a stride so
  // adjacent scenes never see the same clip (avoids the "same B-roll 4
  // times in a row" bug from the previous build).
  if (brollMap.size > 1 && brollPaths.length > 1) {
    const sceneOrder = sceneManager.scenes.filter(s => s.sceneType !== SCENE_TYPES.TRANSITION);
    const pool = brollPaths.slice();
    let poolCursor = 0;
    let swaps = 0;
    for (let sIdx = 0; sIdx < sceneOrder.length; sIdx++) {
      const scene = sceneOrder[sIdx];
      const current = brollMap.get(scene.sceneId);
      if (!current) continue;

      // 1. If the current clip is already used OR the previous scene used it,
      //    pick a different clip from the pool (cycling if needed).
      const previousScene = sIdx > 0 ? sceneOrder[sIdx - 1] : null;
      const previousClip = previousScene ? brollMap.get(previousScene.sceneId) : null;
      const isRepeatOfPrevious = current && previousClip && current === previousClip;

      if (usedBrollGlobal.has(current) || isRepeatOfPrevious) {
        let assigned = false;
        for (let i = 0; i < pool.length; i++) {
          const candidate = pool[(poolCursor + i) % pool.length];
          if (candidate && !usedBrollGlobal.has(candidate) && candidate !== previousClip) {
            brollMap.set(scene.sceneId, candidate);
            poolCursor = (poolCursor + i + 1) % pool.length;
            swaps++;
            assigned = true;
            break;
          }
        }
        // If the pool is exhausted and every clip is already used, still
        // pick a clip that differs from the previous scene (cycle by stride).
        if (!assigned) {
          const stride = Math.max(1, Math.floor(pool.length / 2) || 1);
          for (let i = 1; i < pool.length; i++) {
            const candidate = pool[(poolCursor + i * stride) % pool.length];
            if (candidate && candidate !== previousClip) {
              brollMap.set(scene.sceneId, candidate);
              poolCursor = (poolCursor + i * stride + 1) % pool.length;
              swaps++;
              break;
            }
          }
        }
      }
      const finalClip = brollMap.get(scene.sceneId);
      if (finalClip) usedBrollGlobal.add(finalClip);
    }
    if (swaps > 0) console.log(`[Engine4] B-roll global dedup: swapped ${swaps} clips`);
  }

    // Add assets to scenes
    let _previousBackgroundClip = null;
    for (let i = 0; i < sceneManager.scenes.length; i++) {
      const scene = sceneManager.scenes[i];

      // Skip transition scenes
      if (scene.sceneType === SCENE_TYPES.TRANSITION) continue;

      // Add avatar video to non-transition scenes
      if (avatarVideoPath) {
        scene.addAsset('avatarVideo', avatarVideoPath);
      }

      // Add voiceover segment
      if (voiceoverPath) {
        scene.addAsset('voiceSegment', voiceoverPath);
      }

      // Add B-roll clip as scene background (crop to 9:16 vertical).
      // Use the per-video dedup set to avoid the same clip appearing twice.
      let rawBrollPath = brollMap.get(scene.sceneId);

      // If the assigned clip was already used in this video OR equals the
      // previous scene's clip, pick a different one from the pool. This is
      // a second-line defense in case the brollMap dedup pass above left
      // any duplicates (e.g. when brollPaths.length < scene count).
      const pool = brollPaths.slice();
      if (rawBrollPath && (_usedBackgroundClips.has(rawBrollPath) || rawBrollPath === _previousBackgroundClip)) {
        const replacement = pickNextBackgroundClip(pool, _previousBackgroundClip);
        if (replacement) rawBrollPath = replacement;
      }

      if (rawBrollPath && fs.existsSync(rawBrollPath)) {
        const croppedBrollPath = await cropToVertical(rawBrollPath, tempDir, scene.duration);
        scene.addAsset('background', croppedBrollPath);
        scene.brollClips = [croppedBrollPath];
        markUsedBackgroundClip(rawBrollPath);
        _previousBackgroundClip = rawBrollPath;
      } else {
        // No b-roll for this scene at all — try one more time from the
        // pool before giving up. Without this, when brollMap doesn't have
        // an entry (e.g. all Pexels lookups failed) the scene is left
        // with no background and ends up rendering against a solid color.
        const fallback = pickNextBackgroundClip(pool, _previousBackgroundClip);
        if (fallback && fs.existsSync(fallback)) {
          const croppedFallback = await cropToVertical(fallback, tempDir, scene.duration);
          scene.addAsset('background', croppedFallback);
          scene.brollClips = [croppedFallback];
          markUsedBackgroundClip(fallback);
          _previousBackgroundClip = fallback;
        }
      }
    }

  // Render vertical video using new pipeline (with Visual Quality Engine)
  const outputPath = await renderVerticalVideo(sceneManager, tempDir, subtitleTimings, {
    colorGrading: vqOptions?.colorGrading || visualQuality.getColorGradingForScene('story'),
    filmEffects: vqOptions?.filmEffects || visualQuality.getFilmEffectsForScene('story'),
  });

    console.log(`[Engine4] Advanced cinematic video completed: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error("[Engine4] Advanced cinematic video error:", error);
    console.log("[Engine4] Falling back to simple scene-based rendering");

    // Fallback: create single scene with all assets
    const fallbackSceneManager = new SceneManager();
    const fallbackScene = new Scene({
      sceneId: `fallback_${Date.now()}`,
      sceneType: SCENE_TYPES.STORY,
      scriptText: script || "Meet our amazing business",
      duration: 30
    });
    fallbackSceneManager.addScene(fallbackScene);
    fallbackSceneManager.balanceTiming();

    // Add available assets
    if (avatarVideoPath) fallbackScene.addAsset('avatarVideo', avatarVideoPath);
    if (voiceoverPath) fallbackScene.addAsset('voiceSegment', voiceoverPath);
    if (brollPaths.length > 0) {
      const croppedFallback = await cropToVertical(brollPaths[0], tempDir, fallbackScene.duration);
      fallbackScene.addAsset('background', croppedFallback);
      fallbackScene.brollClips = [croppedFallback];
    }

    try {
      return await renderVerticalVideo(fallbackSceneManager, tempDir);
    } catch (fallbackError) {
      console.error("[Engine4] Scene-based fallback failed:", fallbackError.message);
      console.log("[Engine4] Using legacy fallback");
      // Final legacy fallback
      return await composeSimpleVideo(avatarVideoPath, brollPaths, voiceoverPath, tempDir);
    }
  }
}

// ---------- RESOURCE LIMITS ----------

// Simple video composition fallback (similar to original engine logic)
async function composeSimpleVideo(avatarVideoPath, brollPaths, voiceoverPath, tempDir) {
  try {
    console.log("[Engine4] Using simple video composition fallback");

    // Reset per-video dedup state for the fallback path so it doesn't
    // inherit leftover "used clip" state from a previous advanced render.
    resetUsedBackgroundClips();

    const mergedVideo = path.join(tempDir, `merged_${Date.now()}.mp4`);
    const finalVideoTmp = path.join(tempDir, `final_tmp_${Date.now()}.mp4`);
    const finalVideo = path.join(tempDir, `final_${Date.now()}.mp4`);
    const listFile = path.join(tempDir, `list_${Date.now()}.txt`);

    // Filter out null / missing files so we never feed `null` into path.resolve()
    const validClips = [avatarVideoPath, ...brollPaths]
      .filter(p => p && typeof p === 'string' && fs.existsSync(p));
    if (validClips.length === 0) {
      throw new Error("composeSimpleVideo: no valid clips available (avatar and b-roll both missing)");
    }
    fs.writeFileSync(
      listFile,
      validClips.map(p => `file '${path.resolve(p)}'`).join("\n")
    );

    // Concatenate clips without re-encoding
    await runFFmpeg(`ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${mergedVideo}"`);

    // Add voiceover if present, preserving video stream
    if (voiceoverPath && fs.existsSync(voiceoverPath)) {
      await runFFmpeg(`ffmpeg -y -i "${mergedVideo}" -i "${voiceoverPath}" -shortest -c:v copy -c:a aac "${finalVideoTmp}"`);
    } else {
      fs.copyFileSync(mergedVideo, finalVideoTmp);
    }

    // Enforce vertical 720x1280 resolution (scale + pad) using encoder args
    const filter = `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase,crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT},setsar=1`;
    const gpuEncoder = gpuRender.getEncoderArgs({ preset: 'fast', codec: 'h264' });
    const simpleCmd = `ffmpeg -y -i "${finalVideoTmp}" -vf "${filter}" ${gpuEncoder.encoderArgs} "${finalVideo}"`;
    console.log(`[Engine4] [Simple] Full FFmpeg command:\n${simpleCmd}\n`);
    await runFFmpeg(simpleCmd);

    // Cleanup temporary files
    fs.unlinkSync(listFile);
    if (fs.existsSync(mergedVideo) && mergedVideo !== finalVideoTmp) {
      fs.unlinkSync(mergedVideo);
    }
    if (fs.existsSync(finalVideoTmp)) {
      fs.unlinkSync(finalVideoTmp);
    }

    return finalVideo;
  } catch (error) {
    console.error("[Engine4] Simple video composition failed:", error.message);
    if (fs.existsSync(avatarVideoPath)) {
      return avatarVideoPath;
    }
    throw error;
  }
}

/**
 * Create vertical avatar frame — delegates to avatar-engine.cjs
 */
async function createVerticalAvatarFrame(scene, tempDir) {
  return avatarEngine.createVerticalAvatarFrame(scene, scene.getAsset('avatarVideo'), tempDir);
}

/**
 * Create captions/subtitles for scene
 *
 * BUG FIX: Previously created a single SRT entry per scene ignoring real timing.
 * Now generates per-phrase SRT entries when subtitleTimings are available from
 * ElevenLabs word-level alignment. Falls back to estimated timing when not.
 */
async function createVerticalSubtitles(scene, tempDir, subtitleTimings = null) {
  try {
    console.log(`[Engine4] Creating subtitles for scene ${scene.sceneId}`);

    // Create SRT file with per-phrase timing
    const srtPath = path.join(tempDir, `subtitles_${scene.sceneId}.srt`);
    let srtContent = '';

    if (subtitleTimings && Array.isArray(subtitleTimings) && subtitleTimings.length > 0) {
      // Use real ElevenLabs timing — generate per-phrase SRT entries
      let srtIndex = 1;
      for (const phrase of subtitleTimings) {
        // Only include phrases that fall within this scene's time window
        if (phrase.end <= scene.startTime || phrase.start >= scene.getEndTime()) continue;

        // Clamp phrase timing to scene boundaries
        const phraseStart = Math.max(phrase.start - scene.startTime, 0);
        const phraseEnd = Math.min(phrase.end - scene.startTime, scene.duration);
        if (phraseEnd - phraseStart < 0.2) continue; // Skip tiny fragments

        const startFormatted = formatSrtTime(phraseStart);
        const endFormatted = formatSrtTime(phraseEnd);
        srtContent += `${srtIndex}\n${startFormatted} --> ${endFormatted}\n${phrase.text}\n\n`;
        srtIndex++;
      }
    }

    // Fallback: single SRT entry for the whole scene
    if (!srtContent.trim()) {
      const startFormatted = formatSrtTime(0);
      const endFormatted = formatSrtTime(scene.duration);
      srtContent = `1\n${startFormatted} --> ${endFormatted}\n${scene.scriptText}\n`;
    }

    fs.writeFileSync(srtPath, srtContent);
    scene.addAsset('subtitleFile', srtPath);

  // Generate styled subtitle overlay using FFmpeg drawtext (no ImageMagick dependency)
  // SECURITY: write text to a file and use `textfile=` to avoid shell injection
  // via user-controlled scriptText (was previously interpolated into a shell arg).
  //
  // BLACK SCREEN FIX: the previous build used `format=rgb24` which produced
  // a non-transparent PNG. When the renderer overlaid that PNG with
  // `format=auto`, the entire subtitle rectangle covered the b-roll with
  // a solid black box. We now generate the subtitle as a full-frame
  // transparent VIDEO (yuva420p) so the alpha is preserved through the
  // entire overlay chain. The video is 720x1280 so it covers the full
  // frame — text only renders at the bottom (y=VIDEO_HEIGHT-220) so the
  // rest stays transparent and the b-roll shows through.
  const subtitlePath = path.join(tempDir, `subtitles_overlay_${scene.sceneId}.mp4`);
  const textFilePath = path.join(tempDir, `subtitles_text_${scene.sceneId}.txt`);
  fs.writeFileSync(textFilePath, scene.scriptText || "");

  await runFFmpeg(
    `ffmpeg -y -f lavfi -i "color=c=black@0.0:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:d=${scene.duration}:r=30,format=yuva420p" ` +
    `-vf "drawtext=textfile='${textFilePath}':fontcolor=white:fontsize=48:borderw=3:bordercolor=black@1.0:x=(w-text_w)/2:y=${VIDEO_HEIGHT - 220}" ` +
    `-c:v png -pix_fmt yuva420p -t ${scene.duration} "${subtitlePath}"`
  );

  // Track textfile for cleanup (tempFiles is owned by the orchestrator)
  const tempFiles = getCurrentTempFiles();
  if (tempFiles) tempFiles.add(textFilePath);

    scene.addAsset('subtitleOverlay', subtitlePath);
    return scene;
  } catch (error) {
    console.error('[Engine4] Subtitle creation failed:', error.message);
    return scene;
  }
}

// ---------- VERTICAL VIDEO RENDERING ----------

async function renderVerticalVideo(sceneManager, tempDir, subtitleTimings = null, options = {}) {
  try {
    console.log(`[Engine4] Rendering ${sceneManager.scenes.length} scenes to vertical video`);

    const sceneFiles = [];
    const { selectMusicForScene, generateAudioMixFilter } = require('../../ai/music.cjs');

    // Visual Quality Engine: detect settings from scene data
    const vqOptions = {
      colorGrading: options.colorGrading || 'cinematic',
      filmEffects: options.filmEffects || ['vignette'],
    };

    // Render each scene
    for (let i = 0; i < sceneManager.scenes.length; i++) {
      const scene = sceneManager.scenes[i];

      if (scene.sceneType === SCENE_TYPES.TRANSITION) {
        // Handle transition scenes
        if (i > 0 && i < sceneManager.scenes.length - 1) {
          const prevScenePath = sceneFiles[i - 1];
          const nextScene = sceneManager.scenes[i + 1];
          if (nextScene) {
            const nextScenePath = path.join(tempDir, `scene_${nextScene.sceneId}.mp4`);
            const transitionPath = await renderTransition(scene, prevScenePath, nextScenePath, tempDir);
            if (transitionPath) sceneFiles.push(transitionPath);
          }
        }
        continue;
      }

      // Create scene directory
      const sceneDir = path.join(tempDir, `scene_${scene.sceneId}`);
      fs.mkdirSync(sceneDir, { recursive: true });

      // Create vertical avatar frame
      await createVerticalAvatarFrame(scene, sceneDir);

      // Create subtitles — pass real timing data when available
      await createVerticalSubtitles(scene, sceneDir, subtitleTimings);

      // Render scene
      const scenePath = await renderSingleScene(scene, sceneDir, selectMusicForScene, generateAudioMixFilter, vqOptions);
      sceneFiles.push(scenePath);
    }

    // Concatenate all scenes
    const concatFile = path.join(tempDir, 'concat_list.txt');
    fs.writeFileSync(concatFile, sceneFiles.map(f => `file '${f}'`).join('\n'));
    const concatPath = path.join(tempDir, `concatenated_${Date.now()}.mp4`);

    await runFFmpeg(
      `ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c copy -fflags +genpts -async 1 "${concatPath}"`
    );

    // Master the final video with Visual Quality Engine
    const finalPath = await masterVideo(concatPath, tempDir, vqOptions);

    return finalPath;
  } catch (error) {
    console.error('[Engine4] Vertical video rendering failed:', error.message);
    throw error;
  }
}

async function renderSingleScene(scene, sceneDir, selectMusicForScene, generateAudioMixFilter, options = {}) {
  try {
    const outputPath = path.join(sceneDir, `scene_${scene.sceneId}.mp4`);
    const inputs = [];
    const filterParts = [];
    let currentInput = 0;

    // BLACK SCREEN FIX: generate an explicit base color layer FIRST so the
    // frame is never empty even if the b-roll fails to decode. The base
    // color matches the scene type so the resulting video looks intentional,
    // not just a black placeholder. Subsequent layers (b-roll, avatar,
    // subtitles) are overlaid on top in the correct z-order:
    //
    //   Layer 0  → base color (NEVER null, always 720x1280)
    //   Layer 1  → b-roll background (overlay on base)
    //   Layer 2  → avatar sidebar (overlay on b-roll, if available)
    //   Layer 3  → subtitle overlay (overlay on top, transparent PNG)
    //   Layer 4  → audio tracks (voice, music, sfx)
    //
    const bgColor = scene.sceneType === SCENE_TYPES.HOOK ? '0xFFAA33' :
                     scene.sceneType === SCENE_TYPES.CTA ? '0x33AAFF' : '0x1A2E4D';
    const baseColorPath = path.join(sceneDir, `base_${scene.sceneId}.mp4`);
    const baseEncoder = gpuRender.getEncoderArgs({ preset: 'ultrafast', codec: 'h264' });
    await runFFmpeg(
      `ffmpeg -y -f lavfi -i "color=c=${bgColor}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:d=${scene.duration}:r=30,format=yuv420p" ` +
      `${baseEncoder.encoderArgs} -t ${scene.duration} "${baseColorPath}"`
    );
    inputs.push(baseColorPath);
    // [0:v] is the base. Tag it as [base] for clarity. setpts+format ensures
    // the buffer is in a known good state for the next overlay.
    filterParts.push(`[0:v]setpts=PTS-STARTPTS,format=yuv420p,trim=duration=${scene.duration}[base]`);
    let lastVideoLabel = 'base';
    currentInput = 1; // base color is now at input index 0; next push is at index 1

    // --- LAYER 1: B-ROLL BACKGROUND ---
    if (scene.getAsset('background') && fs.existsSync(scene.getAsset('background'))) {
      inputs.push(scene.getAsset('background'));
      // Scale to fit, pad to exactly 720x1280, force SAR, trim to scene duration
      // so a short b-roll doesn't leave a black tail.
      filterParts.push(
        `[${currentInput}:v]scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=decrease,` +
        `pad=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=${bgColor},` +
        `setsar=1,setpts=PTS-STARTPTS,trim=duration=${scene.duration},setpts=PTS-STARTPTS[broll]`
      );
      filterParts.push(`[${lastVideoLabel}][broll]overlay=shortest=0:format=yuv420p[with_broll]`);
      lastVideoLabel = 'with_broll';
      currentInput++;
    }

    // --- LAYER 2: AVATAR SIDEBAR ---
    const avatarAsset = scene.getAsset('verticalAvatar');
    if (avatarAsset && scene.avatarEnabled !== false && fs.existsSync(avatarAsset)) {
      inputs.push(avatarAsset);
      // Avatar goes in the bottom-left corner with the safe margin. The
      // avatar is already cropped to ~240px wide in createVerticalAvatarFrame.
      filterParts.push(
        `[${currentInput}:v]setpts=PTS-STARTPTS,trim=duration=${scene.duration},setpts=PTS-STARTPTS[av]`
      );
      // Compute overlay position from SAFE_MARGIN so the avatar sits inside
      // the safe area. Format auto so the alpha in verticalAvatar is used.
      filterParts.push(
        `[${lastVideoLabel}][av]overlay=x=${SAFE_MARGIN}:y=${VIDEO_HEIGHT - 260}:format=auto[with_avatar]`
      );
      lastVideoLabel = 'with_avatar';
      currentInput++;
    }

    // --- LAYER 3: SUBTITLES ---
    const subAsset = scene.getAsset('subtitleOverlay');
    if (subAsset && fs.existsSync(subAsset)) {
      inputs.push(subAsset);
      // Subtitle is now a full-frame transparent video (720x1280, yuva420p).
      // Just re-emit it with the right timing, overlay with format=auto
      // so the alpha is respected.
      filterParts.push(
        `[${currentInput}:v]setpts=PTS-STARTPTS,trim=duration=${scene.duration},setpts=PTS-STARTPTS,format=yuva420p[sub]`
      );
      filterParts.push(
        `[${lastVideoLabel}][sub]overlay=format=auto[vout]`
      );
      lastVideoLabel = 'vout';
      currentInput++;
    }

    const videoLabel = lastVideoLabel;

    // --- AUDIO TRACK ---

    // --- AUDIO TRACK ---
    let audioInputCount = 0;
    let musicIndex = -1;
    let voiceIndex = -1;

    if (scene.getAsset('voiceSegment')) {
      inputs.push(scene.getAsset('voiceSegment'));
      voiceIndex = currentInput;
      audioInputCount++;
      currentInput++;
    }

  let musicPath = selectMusicForScene(scene.sceneType);
  if (!musicPath || !fs.existsSync(musicPath)) {
    const { getMusicByMood } = require('../../ai/music.cjs');
    musicPath = getMusicByMood('energetic');
  }
  if (musicPath && fs.existsSync(musicPath)) {
    inputs.push(musicPath);
    musicIndex = currentInput;
    audioInputCount++;
    currentInput++;
  }

  const sfxPlacements = (typeof sfx?.calculateSfxTiming === 'function')
    ? sfx.calculateSfxTiming(scene, scene.scriptText || "")
    : [];
  if (sfxPlacements.length === 0) {
    const whoosh = getSfxFallback();
    if (whoosh) {
      sfxPlacements.push({ sfxPath: whoosh, startTime: scene.startTime + 0.3, duration: 1.0, volume: 0.25, label: "default_whoosh" });
    }
  }
    const sfxStartIndex = currentInput;
    for (const sp of sfxPlacements) {
      if (sp.sfxPath && fs.existsSync(sp.sfxPath)) {
        inputs.push(sp.sfxPath);
        audioInputCount++;
        currentInput++;
      }
    }

    // Build the audio filter chain
    if (audioInputCount === 0) {
      filterParts.push(`aevalsrc=0:channel_layout=stereo:d=${scene.duration}[audio]`);
    } else if (musicIndex >= 0 && voiceIndex >= 0 && sfxPlacements.length > 0) {
      // Voice + Music + SFX
      const sfxCount = inputs.length - sfxStartIndex;
      const audioChains = [
        `[${voiceIndex}:a]volume=1.0[v]`,
        `[${musicIndex}:a]volume=0.15[m]`,
      ];
      for (let si = 0; si < sfxCount; si++) {
        const delayMs = Math.round((sfxPlacements[si]?.startTime - scene.startTime) * 1000) || 0;
        audioChains.push(`[${sfxStartIndex + si}:a]adelay=${delayMs}|${delayMs},volume=${sfxPlacements[si]?.volume || 0.3}[sfx${si}]`);
      }
      const amixLabels = ["[v]", "[m]", ...Array.from({ length: sfxCount }, (_, i) => `[sfx${i}]`)];
      filterParts.push(`${audioChains.join(";")};${amixLabels.join("")}amix=inputs=${amixLabels.length}:duration=first:dropout_transition=2[audio]`);
    } else if (musicIndex >= 0 && voiceIndex >= 0) {
      // Voice + Music only — voice 0dB, music -16dB (≈ 0.158)
      filterParts.push(`[${voiceIndex}:a]volume=1.0[v];[${musicIndex}:a]volume=0.158[m];[v][m]amix=inputs=2:duration=first:dropout_transition=2[audio]`);
    } else if (voiceIndex >= 0) {
      filterParts.push(`[${voiceIndex}:a]volume=1.0,aformat=sample_fmts=fltp:channel_layouts=stereo[audio]`);
    } else if (musicIndex >= 0) {
      filterParts.push(`[${musicIndex}:a]volume=0.158,aformat=sample_fmts=fltp:channel_layouts=stereo[audio]`);
    } else if (sfxPlacements.length > 0) {
      const sfxCount = inputs.length - sfxStartIndex;
      const sfxFilters = [];
      for (let si = 0; si < sfxCount; si++) {
        const delayMs = Math.round((sfxPlacements[si]?.startTime - scene.startTime) * 1000) || 0;
        sfxFilters.push(`[${sfxStartIndex + si}:a]adelay=${delayMs}|${delayMs},volume=${sfxPlacements[si]?.volume || 0.3}[sfx${si}]`);
      }
      const amixLabels = Array.from({ length: sfxCount }, (_, i) => `[sfx${i}]`);
      filterParts.push(`${sfxFilters.join(";")};${amixLabels.join("")}amix=inputs=${sfxCount}:duration=longest[audio]`);
    }

    // --- VISUAL QUALITY (safe-mode) ---
    // The previous implementation embedded visualQuality's filter inside the
    // filter_complex without sanitizing newlines, which caused ffmpeg to
    // reject the chain. We now apply VQ as a SEPARATE -vf pass after the
    // scene is rendered — keeps the filter_complex single-line and clean.
    let finalVideoLabel = videoLabel;

    // Assemble single-line filter_complex
    const filterComplex = filterParts.join(";");

    const gpuEncoder = gpuRender.getEncoderArgs({ preset: 'standard', codec: 'h264' });
    const ffmpegCmd = `ffmpeg -y ` +
      inputs.map((inp, i) => `-i "${inp}"`).join(' ') + ' ' +
      `-filter_complex "${filterComplex}" ` +
      `-map "[${finalVideoLabel}]" -map "[audio]" ` +
      `${gpuEncoder.encoderArgs} ` +
      `-c:a aac -b:a 128k -t ${scene.duration} "${outputPath}"`;

    console.log(`[Engine4] [Scene ${scene.sceneId}] Full FFmpeg command:\n${ffmpegCmd}\n`);

    await runFFmpeg(ffmpegCmd);

    // --- POST-PASS: visual quality (single-line -vf, isolated from filter_complex) ---
    const vqFilter = visualQuality.getSceneFfmpegFilter(
      scene.sceneType,
      options?.colorGrading || 'cinematic',
      options?.filmEffects || ['vignette']
    );
    if (vqFilter) {
      const vqPath = path.join(sceneDir, `vq_${scene.sceneId}.mp4`);
      // Strip whitespace/newlines from the VQ filter to keep it single-line
      const safeVq = vqFilter.replace(/[\r\n]+/g, '').trim();
      const vqCmd = `ffmpeg -y -i "${outputPath}" -vf "${safeVq}" ${gpuEncoder.encoderArgs} -t ${scene.duration} "${vqPath}"`;
      console.log(`[Engine4] [Scene ${scene.sceneId}] VQ post-pass:\n${vqCmd}\n`);
      await runFFmpeg(vqCmd);
      fs.copyFileSync(vqPath, outputPath);
      try { fs.unlinkSync(vqPath); } catch (e) { /* ignore */ }
    }

    return outputPath;
  } catch (error) {
    console.error(`[Engine4] Scene rendering failed: ${error.message}`);
    throw error;
  }
}

async function renderTransition(transition, prevScenePath, nextScenePath, tempDir) {
  try {
    if (!prevScenePath || !nextScenePath) return null;

    const outputPath = path.join(tempDir, `transition_${transition.sceneId}.mp4`);
    const { getTransition, generateTransitionFilter, generateAudioCrossfade } = require('../../ai/transitions.cjs');

    const transitionConfig = getTransition(transition.customTransition) || getTransition('fade');
    const transitionEffect = transitionConfig.effect;

    const gpuEncoder = gpuRender.getEncoderArgs({ preset: 'fast', codec: 'h264' });
    await runFFmpeg(
      `ffmpeg -y -i "${prevScenePath}" -i "${nextScenePath}" ` +
      `-filter_complex "${generateTransitionFilter(0, 1, transitionEffect, transition.duration, 0.1)};` +
      `${generateAudioCrossfade(0, 1, transition.duration)}" ` +
      `-map "[video]" -map "[audio]" ${gpuEncoder.encoderArgs} "${outputPath}"`
    );

    return outputPath;
  } catch (error) {
    console.error(`[Engine4] Transition rendering failed: ${error.message}`);
    return null;
  }
}

async function masterVideo(videoPath, tempDir, options = {}) {
  try {
    const masteredPath = path.join(tempDir, `mastered_${Date.now()}.mp4`);

    // BUG FIX: fs.statSync() has no .duration property — use ffprobe via getVideoDuration()
    const videoDuration = await getVideoDuration(videoPath);
    const audioFadeOutStart = Math.max(1, videoDuration - 0.5);

    // Visual Quality Engine: scene-aware mastering filter
    const colorGrading = options.colorGrading || 'cinematic';
    const filmEffects = options.filmEffects || ['vignette'];
    const rawVqFilter = visualQuality.getMasteringFfmpegFilter(colorGrading, filmEffects);
    // Strip newlines/whitespace — assertFFmpegCommandSafe() rejects \n
    const videoFilter = (rawVqFilter || '').replace(/[\r\n]+/g, '').trim();
    // Force 720x1280 vertical output
    const finalVideoFilter = videoFilter
      ? `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase,crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT},setsar=1,${videoFilter}`
      : `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase,crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT},setsar=1`;

    // Single-line audio filter (no template whitespace)
    const audioFilter = `dynaudnorm=f=100:g=8,alimiter=limit=0.95:level=true:attack=5:release=50,afade=t=in:ss=0:d=0.5,afade=t=out:st=${audioFadeOutStart.toFixed(2)}:d=0.5`;

    const gpuEncoder = gpuRender.getEncoderArgs({ preset: 'standard', codec: 'h264' });
    const masterCmd = `ffmpeg -y -i "${videoPath}" ` +
      `-vf "${finalVideoFilter}" ` +
      `-af "${audioFilter}" ` +
      `${gpuEncoder.encoderArgs} ` +
      `-c:a aac -b:a 192k -ar 48000 ` +
      `-movflags +faststart "${masteredPath}"`;

    console.log(`[Engine4] [Master] Full FFmpeg command:\n${masterCmd}\n`);

    await runFFmpeg(masterCmd);

    return masteredPath;
  } catch (error) {
    console.error('[Engine4] Video mastering failed:', error.message);
    return videoPath;
  }
}

module.exports = {
  setCurrentTempFiles,
  getCurrentTempFiles,
  composeAdvancedVideo,
  composeSimpleVideo,
  createVerticalAvatarFrame,
  createVerticalSubtitles,
  renderVerticalVideo,
  renderSingleScene,
  renderTransition,
  masterVideo,
  // Dedup helpers (exported for testability and reuse)
  resetUsedBackgroundClips,
  markUsedBackgroundClip,
  getUsedBackgroundClips,
  pickNextBackgroundClip,
};
