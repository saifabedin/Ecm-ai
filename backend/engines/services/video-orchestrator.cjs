// ---------- VIDEO ORCHESTRATOR ----------
// runEngine4: main flow, fallback chain, jobId/correlationId handling

const ttsProvider = require("../../ai/tts-provider.cjs");
const retentionSfx = require("../../ai/retention-sfx.cjs");
const { calculateRetentionScore } = require("../../ai/retention-score.cjs");
const avatarEngine = require("../avatar-engine.cjs");
const { analyzeArc } = require("../../ai/story-arc.cjs");
const visualQuality = require("../../ai/visual-quality.cjs");
const gpuRender = require("../../render/gpu-render-service.cjs");
const { createDirectorPlan } = require("../../ai/director-engine.cjs");
const { BrandKitEngine } = require("../../ai/brand-kit-engine.cjs");

const fs = require("fs");
const path = require("path");
const { uuidv4 } = require("../../utils/uuid.cjs");

const { assertValidJobId, assertPathInside, getAudioDuration } = require("./ffmpeg-service.cjs");
const { SceneManager, Scene, SCENE_TYPES, TARGET_DURATION, VIDEO_WIDTH, VIDEO_HEIGHT } = require("./scene-manager-service.cjs");
const { fetchEnhancedBroll, splitScript } = require("./asset-handler.cjs");
const {
  composeAdvancedVideo,
  composeSimpleVideo,
  setCurrentTempFiles,
} = require("./composition-service.cjs");

async function runEngine4(input) {
  const jobId = assertValidJobId(uuidv4());
  const correlationId = (input && input.correlationId) || 'unknown';
  const engine = "engine4-video";
  const startTime = Date.now();

  // Local log helper — adds jobId/correlationId context to every line.
  // Accepts a message string + optional extra args (mirrors console.log signature)
  // so call sites can pass objects/values exactly as they did with console.log.
  const log = {
    info:  (msg, ...rest) => console.log(`[jobId=${jobId}][corr=${correlationId}] ${msg}`, ...rest),
    warn:  (msg, ...rest) => console.warn(`[jobId=${jobId}][corr=${correlationId}] ${msg}`, ...rest),
    error: (msg, ...rest) => console.error(`[jobId=${jobId}][corr=${correlationId}] ${msg}`, ...rest),
  };

  // Centralized temp file tracking
  const tempFiles = new Set();
  const tempDirs = new Set();

  // Register the tempFiles Set with composition-service so that
  // createVerticalSubtitles() can register its textfile path for cleanup.
  setCurrentTempFiles(tempFiles);

  // Safer timeout handling
  let processingTimeout;
  let timeoutCleared = false;

  // Cleanup function for guaranteed cleanup on success/failure
  const cleanup = () => {
    if (processingTimeout && !timeoutCleared) {
      clearTimeout(processingTimeout);
      timeoutCleared = true;
    }

    // Clean up temp files
    tempFiles.forEach(file => {
      if (file && typeof file === 'string' && fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch (e) {
          log.warn(`[Engine4] Failed to cleanup temp file ${file}:`, e.message);
        }
      }
    });

    // Clean up temp directories
    tempDirs.forEach(dir => {
      if (dir && typeof dir === 'string' && fs.existsSync(dir)) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch (e) {
          log.warn(`[Engine4] Failed to cleanup temp dir ${dir}:`, e.message);
        }
      }
    });
  };

  // Set processing timeout for safer timeout handling
  const setProcessingTimeout = () => {
    if (processingTimeout) {
      clearTimeout(processingTimeout);
    }
    processingTimeout = setTimeout(() => {
      log.error('Video processing timeout exceeded');
      cleanup();
      timeoutCleared = true; // prevent double-cleanup in the finally block
      // Do NOT throw inside setTimeout — throws there become uncaught exceptions
      // and crash the process. The cleanup has run; the next await will fail
      // naturally and the outer catch will return { success: false }.
      // Setting a flag so the in-flight operations can detect the timeout.
      global.__engine4TimedOut = true;
    }, 600000); // 10 minutes timeout (HyperFrames renders need more time)
  };

  try {
    log.info("[Engine4] Starting execution with jobId:", jobId);
    log.info("[Engine4] Input received:", JSON.stringify(input, null, 2));

    // Initialize GPU render service (safe — no-ops if already initialized)
    const gpuInfo = await gpuRender.initialize();
    log.info(`[Engine4] GPU render: ${gpuInfo.strategy.toUpperCase()} | GPU: ${gpuInfo.gpuAvailable ? gpuInfo.gpuName : 'none'}`);

    // Set initial timeout
    setProcessingTimeout();

    // Extract script from content data
    let script = null;
    let brand_id = input.brand_id || input.research?.brandId || "default-brand";

    if (input.content && Array.isArray(input.content.reelsScripts) && input.content.reelsScripts.length > 0) {
      script = input.content.reelsScripts.join(" ");
      log.info("[Engine4] Found reelsScripts:", input.content.reelsScripts.length);
    } else if (input.content && Array.isArray(input.content.captions) && input.content.captions.length > 0) {
      script = input.content.captions.join(" ");
      log.info("[Engine4] Found captions:", input.content.captions.length);
    } else if (input.script) {
      script = input.script;
      log.info("[Engine4] Found script in input");
    } else {
      log.info("[Engine4] No script found, using fallback");
      script = "Welcome to our amazing place! Try our special dishes today! Visit us now!";
    }

    log.info("[Engine4] Script ready (first 100 chars):", script.substring(0, 100) + "...");

    // ── RETENTION QUALITY SCORING ──
    // Every video gets a retention score before rendering
    let retentionResult = null;
    try {
      retentionResult = calculateRetentionScore(script, { targetDuration: 55, detailed: true });
      log.info(`[Engine4] [Retention] Score: ${retentionResult.score}/100 (${retentionResult.grade} - ${retentionResult.gradeLabel})`);
      log.info(`[Engine4] [Retention] Production ready: ${retentionResult.isProductionReady} | Needs optimization: ${retentionResult.needsOptimization}`);
      if (retentionResult.recommendations.length > 0) {
        log.info(`[Engine4] [Retention] Recommendations:`);
        retentionResult.recommendations.forEach(r => log.info(`  - ${r}`));
      }
    } catch (retentionErr) {
      log.warn("[Engine4] [Retention] Scoring failed:", retentionErr.message);
    }

    // ── AI DIRECTOR: SHOT PLANNING ──
    // Plans cinematic shots, camera motion, and layout diversity before rendering
    let directorPlan = null;
    try {
      const arc = analyzeArc(script);
      directorPlan = createDirectorPlan(arc.sceneRecommendations, script, {
        targetDuration: 55,
        videoWidth: VIDEO_WIDTH,
        videoHeight: VIDEO_HEIGHT,
        fps: 30,
      });
      log.info(`[Engine4] [Director] Plan created: ${directorPlan.scenes.length} scenes | Avg score: ${directorPlan.summary.averageDirectorScore}/100 | Diversity: ${directorPlan.summary.layoutDiversityScore}/100`);
      if (directorPlan.summary.totalScenes > 0) {
        const shotDist = Object.entries(directorPlan.summary.shotDistribution).map(([k, v]) => `${k}:${v}`).join(', ');
        log.info(`[Engine4] [Director] Shot distribution: ${shotDist}`);
      }
    } catch (directorErr) {
      log.warn("[Engine4] [Director] Planning failed, using defaults:", directorErr.message);
    }

    // Safety: normalize directorPlan to either { scenes: [...] } or null.
    // createFromScript handles null safely, so a partial/malformed plan
    // gracefully degrades to "no plan" instead of crashing downstream.
    if (directorPlan && !Array.isArray(directorPlan.scenes)) {
      log.warn("[Engine4] [Director] Plan missing scenes array, normalizing to null");
      directorPlan = null;
    }

    // ── BRAND KIT: RESOLVE BRAND CONFIGURATION ──
    let brandKit = null;
    try {
      const brandKitEngine = new BrandKitEngine();
      brandKit = await brandKitEngine.resolveFromInput(input);
      log.info(`[Engine4] [BrandKit] Resolved: ${brandKit.brandName} | Theme: ${brandKit.theme} | Source: ${brandKit.source}`);
    } catch (brandErr) {
      log.warn("[Engine4] [BrandKit] Resolution failed, using defaults:", brandErr.message);
    }

    // Create temp directory first
    // SECURITY: validate jobId + verify resolved path is inside the temp root
    const TEMP_ROOT = path.resolve(__dirname, '../../temp');
    const tempDir = assertPathInside(TEMP_ROOT, path.join(TEMP_ROOT, jobId), 'tempDir');
    fs.mkdirSync(tempDir, { recursive: true });
    tempDirs.add(tempDir);

    if (global.__engine4TimedOut) throw new Error('Video generation timed out');

    // 1️⃣ Generate voiceover with word-level timing for subtitle sync
    let audioPath = null;
    let subtitleTimings = [];
    try {
      log.info("[Engine4] Generating voiceover with timing data...");
      audioPath = path.join(tempDir, `audio_${jobId}.mp3`);
      tempFiles.add(audioPath);
      const { audioBuffer, wordTimings, provider } = await ttsProvider.generateVoiceWithTiming(script, { tempDir });
      fs.writeFileSync(audioPath, audioBuffer);
      log.info(`[Engine4] Voiceover generated via ${provider}: ${wordTimings.length} word timings captured`);

      // Group words into subtitle-friendly phrases
      if (wordTimings.length > 0) {
        subtitleTimings = ttsProvider.groupWordsIntoPhrases(wordTimings, {
          maxPhraseDuration: 2.5,
          maxWordsPerPhrase: 6,
          minPhraseDuration: 0.4,
        });
        log.info(`[Engine4] Subtitle phrases: ${subtitleTimings.length} (from ${wordTimings.length} words)`);
      }
    } catch (voiceError) {
      log.error("[Engine4] Voice generation failed:", voiceError.message);
      // Continue without voice - will create silent video
    }

    // 2️⃣ Create avatar video (real image only — null means skip avatar entirely)
    let avatarVideoPath = null;
    try {
      log.info("[Engine4] Creating avatar video...");
      const avatarImage = input.avatarImage || null;
      const brandName = input.brand_name || input.clinic_name || null;
      avatarVideoPath = await avatarEngine.createAvatarVideo({
        script,
        tempDir,
        avatarImage,
        brandName,
        jobId,
        sceneType: 'story',
        duration: 5,
      });
      if (avatarVideoPath && fs.existsSync(avatarVideoPath)) {
        const avStat = fs.statSync(avatarVideoPath);
        log.info(`[Engine4] [Avatar] STATUS: ready | path=${avatarVideoPath} | size=${(avStat.size/1024).toFixed(1)}KB`);
      } else {
        log.info("[Engine4] [Avatar] STATUS: null — will be auto-generated as part of the scene render");
        // BLACK SCREEN FIX: when avatar generation fails, we still need a
        // non-null avatarVideoPath so renderSingleScene can use it as a
        // background fallback. Try one more time with a forced Replicate
        // call (a generic "professional person" prompt) so the auto-gen
        // chain runs even if the script-based path was skipped.
        try {
          const fallbackAvatar = await avatarEngine.createAvatarVideo({
            script: script || "Welcome to our brand.",
            brandName: brandName || "modern brand",
            sceneType: "story",
            jobId,
            duration: 5,
            tempDir,
          });
          if (fallbackAvatar && fs.existsSync(fallbackAvatar)) {
            avatarVideoPath = fallbackAvatar;
            log.info(`[Engine4] [Avatar] STATUS: recovered via forced auto-gen | path=${avatarVideoPath}`);
          }
        } catch (fallbackAvErr) {
          log.warn(`[Engine4] [Avatar] forced auto-gen failed: ${fallbackAvErr.message}`);
        }
      }
    } catch (avatarError) {
      log.warn("[Engine4] Avatar creation failed, continuing without avatar:", avatarError.message);
      avatarVideoPath = null;
    }

    // 3️⃣ Get enhanced B-roll clips
    let brollPaths = [];
    try {
      log.info("[Engine4] Fetching enhanced B-roll clips...");
      brollPaths = await fetchEnhancedBroll(script, tempDir);
      brollPaths.forEach(p => tempFiles.add(p));
      log.info(`[Engine4] B-roll clips found: ${brollPaths.length}`);
    } catch (brollError) {
      log.error("[Engine4] B-roll fetching failed:", brollError.message);
      // Continue with empty brollPaths - will use avatar only
    }

    // 4️⃣ Create cinematic vertical video
    //
    // Phase 4: HyperFrames integration with automatic fallback
    // Feature flag: HYPERFRAMES_ENABLED=true (default: false)
    // On ANY HyperFrames failure → automatic fallback to composeAdvancedVideo()

    // Visual Quality Engine: analyze script for optimal settings
    const vqAnalysis = visualQuality.analyzeScriptForVisualQuality(script);
    log.info(`[Engine4] [VisualQuality] Color grading: ${vqAnalysis.colorGrading} | Film effects: ${vqAnalysis.filmEffects.join(', ')}`);
    log.info(`[Engine4] [VisualQuality] Camera motion: ${vqAnalysis.cameraMotion} | Export profile: ${vqAnalysis.exportProfile}`);

    // --- Pre-render audio validation ---
    let audioValid = false;
    let audioValidationReason = '';

    if (audioPath && fs.existsSync(audioPath)) {
      try {
        const audioStat = fs.statSync(audioPath);
        if (audioStat.size === 0) {
          audioValidationReason = `audio file exists but is empty (0 bytes)`;
          log.info(`[Engine4] [AudioValidation] FAILED: ${audioValidationReason}`);
        } else {
          // ffprobe validation
          const { execSync: execSyncFfprobe } = require("child_process");
          const ffprobeOutput = execSyncFfprobe(
            `ffprobe -v error -select_streams a:0 -show_entries stream=codec_type -of csv=p=0 "${audioPath}"`,
            { encoding: "utf-8", timeout: 10000 }
          ).trim();

          if (ffprobeOutput === 'audio') {
            audioValid = true;
            const duration = await getAudioDuration(audioPath);
            log.info(`[Engine4] [AudioValidation] PASSED: ${audioStat.size} bytes, ${duration.toFixed(2)}s, codec=audio`);
          } else {
            audioValidationReason = `ffprobe returned '${ffprobeOutput}' instead of 'audio'`;
            log.info(`[Engine4] [AudioValidation] FAILED: ${audioValidationReason}`);
          }
        }
      } catch (probeErr) {
        audioValidationReason = `ffprobe error: ${probeErr.message}`;
        log.info(`[Engine4] [AudioValidation] FAILED: ${audioValidationReason}`);
      }
    } else {
      audioValidationReason = `audio file does not exist: ${audioPath || 'null'}`;
      log.info(`[Engine4] [AudioValidation] FAILED: ${audioValidationReason}`);
    }

  const skipHyperFrames = !audioValid;
  const renderMetrics = {
    strategy: 'hyperframes',
    hyperFramesAttempted: false,
    hyperFramesSucceeded: false,
    fallbackUsed: false,
    renderStartTime: Date.now(),
    renderEndTime: null,
    renderDurationMs: null,
    error: null,
    audioValid,
    audioValidationReason,
  };

  let sceneManager = null;
  let finalVideoPath = null;

  // BLACK SCREEN DEBUG: log every input that will go into the final
  // composition so any null / missing file shows up here, not as a black
  // frame at the end of the render. Includes resolution probe for the
  // avatar + b-roll + audio so the dimension mismatch surface early.
  const logFinalInputs = async (label) => {
    const probeInfo = async (p) => {
      if (!p || !fs.existsSync(p)) return `MISSING (${p || 'null'})`;
      try {
        const { execSync: probe } = require("child_process");
        const out = probe(
          `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,codec_name,duration -of default=nw=1 "${p}"`,
          { encoding: "utf-8", timeout: 5000 }
        ).trim();
        const stat = fs.statSync(p);
        return `OK ${(stat.size/1024).toFixed(1)}KB | ${out.replace(/\n/g, ' ')}`;
      } catch (e) {
        return `probe-error: ${e.message}`;
      }
    };
    log.info(`[Engine4] [Composition] ${label} final composition input files:`);
    log.info(`  avatarVideo:  ${await probeInfo(avatarVideoPath)}`);
    log.info(`  audio:        ${await probeInfo(audioPath)}`);
    log.info(`  broll count:  ${brollPaths.length}`);
    for (let i = 0; i < Math.min(brollPaths.length, 5); i++) {
      log.info(`    broll[${i}]:    ${await probeInfo(brollPaths[i])}`);
    }
    if (brollPaths.length > 5) log.info(`    ... and ${brollPaths.length - 5} more`);
  };

  if (global.__engine4TimedOut) throw new Error('Video generation timed out');

  // --- PRIMARY RENDER PATH: HyperFrames ---
  // HyperFrames is the primary renderer for cinematic TikTok-style reels.
  // It uses Chrome BeginFrame API + GSAP for real animation, CSS for styling,
  // and produces superior visual quality compared to FFmpeg-only rendering.
  // On ANY HyperFrames failure → automatic fallback to composeAdvancedVideo()
  if (!skipHyperFrames) {
    log.info("[Engine4] === HYPERFRAMES PRIMARY RENDER PATH ===");
    await logFinalInputs("HyperFrames");
    renderMetrics.hyperFramesAttempted = true;

    try {
      const { generateComposition } = require('../../hyperframes/composition-generator.cjs');
      const { renderComposition } = require('../../hyperframes/render-composition.cjs');
      const { getMusicByMood, analyzeScriptMood } = require('../../ai/music.cjs');

      // Build scene manager for HyperFrames composition (with Director Plan)
      sceneManager = SceneManager.createFromScript(script, directorPlan);
      let targetDuration = TARGET_DURATION.IDEAL;
      if (audioPath) {
        const voiceDuration = await getAudioDuration(audioPath);
        targetDuration = Math.max(Math.min(voiceDuration, TARGET_DURATION.MAX), TARGET_DURATION.MIN);
      }
      sceneManager.balanceTiming(targetDuration);

      // Fetch per-scene B-roll for HyperFrames composition
      let hfBrollPaths = brollPaths;
      try {
        const hfBrollMap = await fetchEnhancedBroll(script, tempDir, sceneManager.scenes);
        if (hfBrollMap instanceof Map && hfBrollMap.size > 0) {
          // Convert Map to ordered array matching scene order
          hfBrollPaths = sceneManager.scenes
            .filter(s => s.sceneType !== SCENE_TYPES.TRANSITION)
            .map(s => hfBrollMap.get(s.sceneId))
            .filter(Boolean);
          log.info(`[Engine4] [HyperFrames] Per-scene B-roll: ${hfBrollPaths.length} clips for ${sceneManager.scenes.length} scenes`);
        }
      } catch (hfBrollErr) {
        log.warn("[Engine4] [HyperFrames] Per-scene B-roll failed, using bulk:", hfBrollErr.message);
      }

      const compositionDir = path.join(tempDir, 'hyperframes-composition');
      const renderOutputDir = path.join(tempDir, 'hyperframes-output');

      log.info(`[Engine4] [HyperFrames] Generating composition (${sceneManager.scenes.length} scenes, ${sceneManager.totalDuration}s target)`);

      const composition = await generateComposition({
        scenes: sceneManager.scenes,
        assets: {
          avatarVideo: avatarVideoPath,
          brollPaths: hfBrollPaths,
          voiceoverPath: audioPath,
          musicPath: (() => {
            const mood = analyzeScriptMood(script);
            const musicPath = getMusicByMood(mood);
            log.info(`[Engine4] [HyperFrames] Script mood: ${mood} | Music: ${musicPath || 'none'}`);
            return musicPath;
          })(),
        },
        outputDir: compositionDir,
        options: {
          width: 720,
          height: 1280,
          fps: 30,
          subtitleStyle: input.subtitleStyle || input.captionStyle || input.preset || 'hormozi',
          subtitleTimings: subtitleTimings.length > 0 ? subtitleTimings : undefined,
          // Visual Quality Engine settings
          colorGrading: vqAnalysis.colorGrading,
          filmEffects: vqAnalysis.filmEffects,
          cameraMotion: vqAnalysis.cameraMotion,
          exportProfile: vqAnalysis.exportProfile,
          // Brand Kit settings
          brandKit: brandKit,
        },
      });

      // Calculate retention-aware SFX placements
      const allSfxPlacements = retentionSfx.generateRetentionSfxPlacements(script, subtitleTimings, sceneManager.scenes);
      log.info(`[Engine4] [HyperFrames] Retention SFX placements: ${allSfxPlacements.length} (${allSfxPlacements.map(s => s.label || s.ruleId || 'scene').join(', ')})`);

      log.info(`[Engine4] [HyperFrames] Composition generated: ${composition.htmlPath} | Subtitle timing: ${subtitleTimings.length > 0 ? 'REAL' : 'ESTIMATED'}`);

      const renderResult = await renderComposition({
        projectDir: composition.projectDir,
        outputDir: renderOutputDir,
        outputFilename: `hyperframes_${jobId}.mp4`,
        options: { fps: 30, quality: 'standard', workers: 1, timeoutMs: 900000 },
      });

      if (renderResult.success) {
        finalVideoPath = renderResult.outputPath;
        renderMetrics.hyperFramesSucceeded = true;
        renderMetrics.renderDurationMs = renderResult.renderTimeMs;
        log.info(`[Engine4] [HyperFrames] Render SUCCESS: ${renderResult.outputPath} (${(renderResult.fileSize / 1024 / 1024).toFixed(2)}MB, ${renderResult.duration}s, ${renderResult.renderTimeMs}ms)`);
      } else {
        throw new Error(renderResult.error || 'HyperFrames render returned failure');
      }
    } catch (hyperFramesError) {
      renderMetrics.error = hyperFramesError.message;
      log.error(`[Engine4] [HyperFrames] RENDER FAILED: ${hyperFramesError.message}`);
      log.info("[Engine4] [HyperFrames] → AUTOMATIC FALLBACK to composeAdvancedVideo()");
      renderMetrics.fallbackUsed = true;
      renderMetrics.strategy = 'composeAdvancedVideo (fallback)';
      renderMetrics.fallbackChain = ['hyperframes', 'composeAdvancedVideo'];

      try {
        await logFinalInputs("composeAdvancedVideo (after HyperFrames failure)");
        finalVideoPath = await composeAdvancedVideo(avatarVideoPath, brollPaths, audioPath, script, tempDir, subtitleTimings, vqAnalysis, directorPlan, brandKit);
        log.info(`[Engine4] [Fallback] composeAdvancedVideo succeeded after HyperFrames failure`);
      } catch (fallbackError) {
        log.error(`[Engine4] [Fallback] composeAdvancedVideo ALSO failed: ${fallbackError.message}`);
        renderMetrics.fallbackChain.push('composeSimpleVideo');

        // Third-tier fallback: simple FFmpeg composition (no HyperFrames, no scenes)
        try {
          log.info("[Engine4] [Fallback] Trying third-tier: composeSimpleVideo()");
          finalVideoPath = await composeSimpleVideo(avatarVideoPath, brollPaths, audioPath, tempDir);
          renderMetrics.strategy = 'composeSimpleVideo (third-tier)';
          log.info(`[Engine4] [Fallback] composeSimpleVideo succeeded after both prior failures`);
        } catch (simpleError) {
          log.error(`[Engine4] [Fallback] ALL three render tiers failed`);
          renderMetrics.error = `HF: ${hyperFramesError.message} | ADV: ${fallbackError.message} | SIMPLE: ${simpleError.message}`;
          throw new Error(`All render tiers failed: HF(${hyperFramesError.message}) | ADV(${fallbackError.message}) | SIMPLE(${simpleError.message})`);
        }
      }
    }
  } else {
    // Audio validation failed — skip HyperFrames entirely, use FFmpeg directly
    log.info(`[Engine4] [HyperFrames] SKIPPED: audio validation failed — ${audioValidationReason}`);
    log.info(`[Engine4] [HyperFrames] → FALLBACK to composeAdvancedVideo()`);
    await logFinalInputs("composeAdvancedVideo (audio-invalid)");
    renderMetrics.fallbackUsed = true;
    renderMetrics.strategy = 'composeAdvancedVideo (audio-invalid)';
    renderMetrics.fallbackChain = ['composeAdvancedVideo'];
    try {
      finalVideoPath = await composeAdvancedVideo(avatarVideoPath, brollPaths, audioPath, script, tempDir, subtitleTimings, vqAnalysis, directorPlan, brandKit);
      log.info("[Engine4] Cinematic video created successfully");
    } catch (composeError) {
      log.error("[Engine4] Cinematic video creation failed:", composeError.message);
      renderMetrics.fallbackChain.push('composeSimpleVideo');
      // Third-tier fallback: simple FFmpeg composition
      try {
        finalVideoPath = await composeSimpleVideo(avatarVideoPath, brollPaths, audioPath, tempDir);
        renderMetrics.strategy = 'composeSimpleVideo (fallback)';
        log.info(`[Engine4] [Fallback] composeSimpleVideo succeeded after composeAdvancedVideo failure`);
      } catch (simpleError) {
        log.error(`[Engine4] [Fallback] composeSimpleVideo also failed: ${simpleError.message}`);
        throw composeError;
      }
    }
  }

    renderMetrics.renderEndTime = Date.now();
    renderMetrics.renderDurationMs = renderMetrics.renderDurationMs || (renderMetrics.renderEndTime - renderMetrics.renderStartTime);
    log.info(`[Engine4] [Metrics] Strategy: ${renderMetrics.strategy} | Duration: ${renderMetrics.renderDurationMs}ms | HyperFrames: ${renderMetrics.hyperFramesSucceeded ? 'SUCCESS' : renderMetrics.hyperFramesAttempted ? 'FAILED→FALLBACK' : 'DISABLED'}`);

    // 🎵 ALWAYS-ON POST-PASS: add background music + SFX to the final video.
    // This guarantees every video has audio polish, even if the primary
    // render (HyperFrames / composeAdvancedVideo) didn't include them or
    // included them at the wrong volume. The function never fails the
    // call — it returns the original path on any error. We also enforce a
    // hard fallback to plain background music if addBackgroundMusicAndSFX
    // itself throws, so music is never skipped on a real render.
    try {
      const musicMod = require('../../ai/music.cjs');
      const retentionSfxMod = require('../../ai/retention-sfx.cjs');
      const sfxMod = require('../../ai/sfx.cjs');

      const { addBackgroundMusicAndSFX, addBackgroundMusic, analyzeScriptMood, getMusicByMood, selectMusicForScene, getSfxFallback } = musicMod;
      const { generateRetentionSfxPlacements } = retentionSfxMod;

      // 1. Build SFX placements with multiple fallbacks so we never end up silent.
      let sfxPlacements = [];
      try {
        sfxPlacements = generateRetentionSfxPlacements(script, subtitleTimings, sceneManager?.scenes || []);
      } catch (sfxErr) {
        log.warn(`[Engine4] [Audio] Retention SFX placements failed: ${sfxErr.message}`);
      }
      if (sfxPlacements.length === 0) {
        try {
          sfxPlacements = sfxMod.calculateSfxTiming
            ? sfxMod.calculateSfxTiming({ startTime: 0, duration: 30, sceneType: 'story' }, script)
            : [];
        } catch (sfxCalcErr) {
          log.warn(`[Engine4] [Audio] sfx.calculateSfxTiming failed: ${sfxCalcErr.message}`);
        }
      }
      if (sfxPlacements.length === 0) {
        const whoosh = getSfxFallback && getSfxFallback();
        if (whoosh) {
          sfxPlacements = [
            { sfxPath: whoosh, startTime: 0.3, duration: 1.0, volume: 0.25, label: 'forced_intro' },
            { sfxPath: whoosh, startTime: 27, duration: 1.0, volume: 0.18, label: 'forced_outro' },
          ];
        }
      }

      const mood = (() => { try { return analyzeScriptMood(script); } catch { return 'energetic'; } })();
      log.info(`[Engine4] [Audio] Post-pass: mood=${mood} | sfxPlacements=${sfxPlacements.length} | hasVoice=${!!audioValid}`);

      // 2. Primary path: addBackgroundMusicAndSFX (music + SFX in one ffmpeg pass)
      let audioApplied = false;
      try {
        const audioResult = await addBackgroundMusicAndSFX(finalVideoPath, {
          tempDir,
          mood,
          sfxPlacements,
          hasVoice: !!audioValid,
        });
        if (audioResult && audioResult !== finalVideoPath) {
          finalVideoPath = audioResult;
          tempFiles.add(finalVideoPath);
        }
        audioApplied = true;
        log.info(`[Engine4] [Audio] Music + SFX applied to final video (path=${path.basename(finalVideoPath)})`);
      } catch (audioPassErr) {
        log.warn(`[Engine4] [Audio] addBackgroundMusicAndSFX failed, falling back to plain music: ${audioPassErr.message}`);
      }

      // 3. Hard fallback: plain background music if the combined pass failed.
      if (!audioApplied) {
        try {
          let fallbackMusic = null;
          try {
            fallbackMusic = getMusicByMood(mood) || selectMusicForScene('STORY') || getMusicByMood('energetic');
          } catch { /* ignore */ }
          if (!fallbackMusic) {
            try {
              const musicMod2 = require('../../ai/music.cjs');
              const files = musicMod2.getBackgroundMusicFiles ? musicMod2.getBackgroundMusicFiles() : [];
              fallbackMusic = files[0] || null;
            } catch { /* ignore */ }
          }
          if (fallbackMusic && fs.existsSync(fallbackMusic)) {
            const ducking = audioValid ? 0.158 : 0.45;
            const fallbackOut = path.join(tempDir, `with_music_only_${Date.now()}.mp4`);
            const fbResult = await addBackgroundMusic(finalVideoPath, fallbackMusic, fallbackOut, ducking);
            if (fbResult && fbResult !== finalVideoPath && fs.existsSync(fbResult)) {
              finalVideoPath = fbResult;
              tempFiles.add(finalVideoPath);
              log.info(`[Engine4] [Audio] Hard-fallback plain music applied: ${path.basename(fallbackMusic)}`);
            } else {
              log.warn(`[Engine4] [Audio] Hard-fallback plain music returned original (ffmpeg may have failed)`);
            }
          } else {
            log.warn(`[Engine4] [Audio] No music files in /assets/music — skipping audio post-pass entirely`);
          }
        } catch (fallbackErr) {
          log.warn(`[Engine4] [Audio] Hard-fallback music also failed (non-fatal): ${fallbackErr.message}`);
        }
      }
    } catch (audioPassErr) {
      log.warn(`[Engine4] [Audio] Music+SFX post-pass failed (non-fatal): ${audioPassErr.message}`);
    }

    // 5️⃣ Move final video to public directory and return URL
    // SECURITY: verify resolved path is inside the public root
    const PUBLIC_ROOT = path.resolve(__dirname, '../../public/videos');
    const publicDir = assertPathInside(PUBLIC_ROOT, PUBLIC_ROOT, 'publicDir');
    fs.mkdirSync(publicDir, { recursive: true });
    const publicVideoPath = assertPathInside(publicDir, path.join(publicDir, `${jobId}.mp4`), 'publicVideoPath');

    try {
      fs.copyFileSync(finalVideoPath, publicVideoPath);
      tempFiles.add(finalVideoPath);
      log.info("[Engine4] Video copied to public directory");

      // Store in GPU render cache for future dedup
      const cacheKey = gpuRender.generateCacheKey(`engine4:${jobId}:${script.length}`, [finalVideoPath]);
      gpuRender.storeCache(cacheKey, publicVideoPath);
    } catch (copyError) {
      log.error("[Engine4] Failed to copy video to public:", copyError.message);
      throw copyError;
    }

    // 6️⃣ Cleanup temporary files
    cleanup();

    // Clear processing timeout
    if (processingTimeout) {
      clearTimeout(processingTimeout);
      timeoutCleared = true;
    }

    const processingTime = Date.now() - startTime;
    log.info(`[Engine4] Execution completed successfully in ${processingTime}ms`);

    // Per-job memory snapshot — tagged with jobId for downstream attribution
    const memUsageSnapshot = process.memoryUsage();

    // Return final output (same format as original)
    return {
      success: true,
      engine,
      jobId,
      data: {
        video_url: `/videos/${path.basename(publicVideoPath)}`,
        captions: script,
        brand_id: brand_id,
        scenes: splitScript(script),
        processingTime: processingTime,
        memoryUsage: {
          jobId,
          heapUsed: memUsageSnapshot.heapUsed,
          rss: memUsageSnapshot.rss,
        },
        retentionScore: retentionResult ? {
          score: retentionResult.score,
          grade: retentionResult.grade,
          gradeLabel: retentionResult.gradeLabel,
          isProductionReady: retentionResult.isProductionReady,
          recommendations: retentionResult.recommendations,
        } : null,
        visualQuality: {
          colorGrading: vqAnalysis.colorGrading,
          filmEffects: vqAnalysis.filmEffects,
          cameraMotion: vqAnalysis.cameraMotion,
          exportProfile: vqAnalysis.exportProfile,
          renderStrategy: renderMetrics.strategy,
        },
        gpuRender: gpuRender.getMetrics(),
      },
      error: null,
    };

  } catch (err) {
    // Clear processing timeout on error
    if (processingTimeout) {
      clearTimeout(processingTimeout);
      timeoutCleared = true;
    }

    log.error(`Advanced processing failed: ${err.message}`);

    // Cleanup any temp files on error
    cleanup();

    // SAFETY FIX: Return honest error status instead of fake URL with success:true
    // Previously returned sample-videos.com URL with success:true — this silently
    // hid all failures and made debugging impossible
    return {
      success: false,
      engine,
      jobId,
      data: {
        video_url: null,
        captions: script || "",
        brand_id: brand_id || "default-brand",
        scenes: splitScript(script) || [],
      },
      error: err.message,
    };
  } finally {
    // RELIABILITY: belt-and-suspenders cleanup. The try and catch blocks above
    // both call cleanup(), but if either cleanup() itself throws OR an unexpected
    // error path is hit, this finally guarantees temp files + timeout are released.
    // cleanup() is idempotent (uses timeoutCleared flag) so double-calls are safe.
    try { cleanup(); } catch (e) { /* nothing useful to do */ }
    try {
      if (processingTimeout && !timeoutCleared) {
        clearTimeout(processingTimeout);
        timeoutCleared = true;
      }
    } catch (e) { /* nothing useful to do */ }
  }
}

// ---------- LOCAL HELPERS (defined here in original file) ----------

// Create avatar video — delegates to avatar-engine.cjs
// Supports: user-uploaded images, scene-aware styling, GPU acceleration, caching
// Returns null if no real avatar image is found (caller should skip avatar).
async function createAvatarVideo(script, tempDir, avatarImage = null, brandName = null, jobId = null) {
  return avatarEngine.createAvatarVideo({
    script,
    avatarImage,
    jobId,
    brandName,
    duration: 5,
    tempDir,
  });
}

module.exports = runEngine4;
