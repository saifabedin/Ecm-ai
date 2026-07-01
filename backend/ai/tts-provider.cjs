/**
 * Unified TTS Provider Layer
 *
 * Provides a single interface for voice generation across multiple providers:
 *   1. ElevenLabs — premium quality, word-level timing, API key required
 *   2. Edge-TTS — free, good quality, sentence-level timing only
 *   3. Local fallback — espeak/flite if available, or silent generation
 *
 * Provider selection is automatic with fallback chain:
 *   ElevenLabs → Edge-TTS → Local fallback
 *
 * All providers return the same interface:
 *   { audioBuffer, wordTimings, provider, duration }
 *
 * Usage:
 *   const { generateVoiceWithTiming } = require('./tts-provider.cjs');
 *   const { audioBuffer, wordTimings } = await generateVoiceWithTiming(text, options);
 */

const fs = require("fs");
const path = require("path");
const { exec, execFile } = require("child_process");
const ffmpeg = require("fluent-ffmpeg");
const { retryWithBackoff } = require("../utils/retry.cjs");
const logger = require("../utils/logger.cjs");

// ---------- PROVIDER CONFIGURATION ----------

const PROVIDERS = {
  elevenlabs: {
    name: "ElevenLabs",
    priority: 1,
    requiresApiKey: true,
    envKey: "ELEVENLABS_API_KEY",
    supportsWordTiming: true,
    maxTextLength: 5000,
    estimatedCostPerChar: 0.00003, // ~$0.30 per 10K chars
  },
  edge: {
    name: "Edge-TTS",
    priority: 2,
    requiresApiKey: false,
    supportsWordTiming: false, // sentence-level only
    supportsSentenceTiming: true,
    maxTextLength: 10000,
    estimatedCostPerChar: 0, // free
    defaultVoice: "en-US-JennyNeural",
    availableVoices: [
      "en-US-JennyNeural",
      "en-US-GuyNeural",
      "en-US-AriaNeural",
      "en-GB-SoniaNeural",
      "en-AU-NatashaNeural",
      "en-IN-PrabhatNeural",
    ],
  },
  local: {
    name: "Local TTS",
    priority: 3,
    requiresApiKey: false,
    supportsWordTiming: false,
    maxTextLength: 10000,
    estimatedCostPerChar: 0,
  },
};

// ---------- PROVIDER SELECTION ----------

let _activeProvider = null;
let _providerPriority = ["elevenlabs", "edge", "local"];

/**
 * Get the currently active provider
 */
function getActiveProvider() {
  if (_activeProvider) return _activeProvider;

  for (const providerId of _providerPriority) {
    const config = PROVIDERS[providerId];
    if (config.requiresApiKey && !process.env[config.envKey]) {
      continue;
    }
    if (providerId === "edge" && !isEdgeTtsAvailable()) {
      continue;
    }
    if (providerId === "local" && !isLocalTtsAvailable()) {
      continue;
    }
    _activeProvider = providerId;
    logger.info(`[TTS] Active provider: ${config.name}`);
    return _activeProvider;
  }

  logger.warn("[TTS] No TTS provider available — will generate silent audio");
  return null;
}

/**
 * Force a specific provider
 */
function setProvider(providerId) {
  if (!PROVIDERS[providerId]) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  _activeProvider = providerId;
  logger.info(`[TTS] Provider forced to: ${PROVIDERS[providerId].name}`);
}

/**
 * Get provider priority list
 */
function getProviderPriority() {
  return [..._providerPriority];
}

// ---------- AVAILABILITY CHECKS ----------

let _edgeTtsAvailable = null;
function isEdgeTtsAvailable() {
  if (_edgeTtsAvailable !== null) return _edgeTtsAvailable;
  try {
    const { execSync } = require("child_process");
    execSync("python3 -c 'import edge_tts'", { timeout: 5000, stdio: 'ignore' });
    _edgeTtsAvailable = true;
  } catch {
    _edgeTtsAvailable = false;
  }
  return _edgeTtsAvailable;
}

function isLocalTtsAvailable() {
  try {
    const { execSync } = require("child_process");
    execSync("which espeak", { encoding: "utf-8", timeout: 3000 });
    return true;
  } catch {
    try {
      const { execSync } = require("child_process");
      execSync("which espeak-ng", { encoding: "utf-8", timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }
}

// ---------- ELEVENLABS PROVIDER ----------

async function generateWithElevenLabs(text, options = {}) {
  const axios = require("axios");
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error("ElevenLabs API key not configured");
  }

  const voiceId = options.voiceId || "JBFqnCBsd6RMkjVDRZzb";
  const modelId = options.modelId || "eleven_multilingual_v2";

  // Try streaming endpoint with word-level timestamps first
  try {
    logger.info(`[TTS] ElevenLabs: requesting speech with timestamps (${text.length} chars)`);

    const response = await retryWithBackoff(
      () => axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream/with-timestamps?output_format=mp3_44100_128`,
        { text, model_id: modelId },
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          responseType: "text",
          timeout: 60000,
        }
      ),
      { attempts: 3, delayMs: 1000, label: 'ElevenLabs streaming' }
    );

    const chunks = parseElevenLabsStreamingResponse(response.data);
    const audioBuffers = [];
    const allCharacters = [];
    const allCharStarts = [];
    const allCharEnds = [];

    for (const chunk of chunks) {
      if (chunk.audio_base64) {
        audioBuffers.push(Buffer.from(chunk.audio_base64, "base64"));
      }
      if (chunk.alignment) {
        allCharacters.push(...chunk.alignment.characters);
        allCharStarts.push(...chunk.alignment.character_start_times_seconds);
        allCharEnds.push(...chunk.alignment.character_end_times_seconds);
      }
    }

    const audioBuffer = Buffer.concat(audioBuffers);
    const wordTimings = aggregateCharacterToWordTiming(
      allCharacters, allCharStarts, allCharEnds, text
    );

    logger.info(`[TTS] ElevenLabs: generated ${wordTimings.length} word timings`);
    return { audioBuffer, wordTimings, provider: "elevenlabs" };
  } catch (err) {
    logger.warn(`[TTS] ElevenLabs timestamp endpoint failed: ${err.message}`);

    // Fallback to basic generation
    try {
      logger.info("[TTS] ElevenLabs: falling back to basic generation");
      const response = await retryWithBackoff(
        () => axios.post(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          { text, model_id: modelId },
          {
            headers: {
              "xi-api-key": apiKey,
              "Content-Type": "application/json",
            },
            responseType: "arraybuffer",
            timeout: 60000,
          }
        ),
        { attempts: 3, delayMs: 1000, label: 'ElevenLabs basic' }
      );

      const audioBuffer = Buffer.from(response.data);
      const wordTimings = estimateWordTimings(text, audioBuffer);
      return { audioBuffer, wordTimings, provider: "elevenlabs-basic" };
    } catch (fallbackErr) {
      throw new Error(`ElevenLabs failed: ${fallbackErr.message}`);
    }
  }
}

function parseElevenLabsStreamingResponse(rawText) {
  const chunks = [];
  let braceCount = 0;
  let start = -1;

  for (let i = 0; i < rawText.length; i++) {
    if (rawText[i] === "{") {
      if (braceCount === 0) start = i;
      braceCount++;
    } else if (rawText[i] === "}") {
      braceCount--;
      if (braceCount === 0 && start >= 0) {
        try {
          const obj = JSON.parse(rawText.substring(start, i + 1));
          if (obj.audio_base64 || obj.alignment) {
            chunks.push(obj);
          }
        } catch (e) { /* skip malformed */ }
        start = -1;
      }
    }
  }
  return chunks;
}

function aggregateCharacterToWordTiming(characters, startTimes, endTimes, originalText) {
  if (!characters || characters.length === 0) return [];

  const wordTimings = [];
  let currentWord = "";
  let wordStart = null;
  let wordEnd = null;
  let timingIdx = 0;
  const textChars = originalText.split("");

  for (let t = 0; t < textChars.length; t++) {
    const textChar = textChars[t];

    if (textChar === " " || textChar === "\n" || textChar === "\t") {
      if (currentWord.length > 0 && wordStart !== null) {
        wordTimings.push({
          word: currentWord,
          start: Math.round(wordStart * 1000) / 1000,
          end: Math.round(wordEnd * 1000) / 1000,
          duration: Math.round((wordEnd - wordStart) * 1000) / 1000,
        });
        currentWord = "";
        wordStart = null;
        wordEnd = null;
      }
      continue;
    }

    while (timingIdx < characters.length) {
      const timingChar = characters[timingIdx];
      timingIdx++;

      if (timingChar.toLowerCase() === textChar.toLowerCase()) {
        if (wordStart === null) wordStart = startTimes[timingIdx - 1] || 0;
        wordEnd = endTimes[timingIdx - 1] || 0;
        currentWord += textChar;
        break;
      }
      if (timingChar === " " || timingChar === "\n" || /[.,!?;:'"()]/.test(timingChar)) {
        continue;
      }
    }
  }

  if (currentWord.length > 0 && wordStart !== null) {
    wordTimings.push({
      word: currentWord,
      start: Math.round(wordStart * 1000) / 1000,
      end: Math.round(wordEnd * 1000) / 1000,
      duration: Math.round((wordEnd - wordStart) * 1000) / 1000,
    });
  }

  return wordTimings;
}

// ---------- EDGE-TTS PROVIDER ----------

async function generateWithEdgeTts(text, options = {}) {
  const voice = options.voice || PROVIDERS.edge.defaultVoice;
  const tempDir = options.tempDir || path.join(__dirname, "../../temp");
  const timestamp = Date.now();
  const outputPath = path.join(tempDir, `edge_tts_${timestamp}.mp3`);
  const vttPath = path.join(tempDir, `edge_tts_${timestamp}.vtt`);

  // Write Python script for edge-tts with word boundary support
  const pyScript = `
import asyncio
import edge_tts
import json
import sys

async def main():
    communicate = edge_tts.Communicate(${JSON.stringify(text)}, ${JSON.stringify(voice)})
    words = []
    with open(${JSON.stringify(outputPath)}, "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words.append({
                    "word": chunk["text"],
                    "start": round(chunk["offset"] / 10_000_000, 3),
                    "duration": round(chunk["duration"] / 10_000_000, 3),
                })
            elif chunk["type"] == "SentenceBoundary":
                words.append({
                    "word": chunk["text"],
                    "start": round(chunk["offset"] / 10_000_000, 3),
                    "duration": round(chunk["duration"] / 10_000_000, 3),
                    "isSentence": True,
                })
    print(json.dumps({"wordTimings": words}))

asyncio.run(main())
`;

  const pyPath = path.join(tempDir, `edge_tts_gen_${timestamp}.py`);
  fs.writeFileSync(pyPath, pyScript);

  try {
    logger.info(`[TTS] Edge-TTS: generating with voice ${voice} (${text.length} chars)`);

    await new Promise((resolve, reject) => {
      exec(`python3 "${pyPath}"`, { timeout: 60000 }, (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve(stdout);
      });
    });

    // Read audio
    if (!fs.existsSync(outputPath)) {
      throw new Error("Edge-TTS did not produce audio file");
    }
    const audioBuffer = fs.readFileSync(outputPath);

    // Get actual audio duration for accurate timing estimation
    const duration = await getAudioDuration(outputPath);

    // Edge-TTS v7+ only provides SentenceBoundary, not WordBoundary
    // Generate estimated word timings from text + audio duration
    const wordTimings = estimateWordTimings(text, null, duration);

    // Cleanup Python script
    try { fs.unlinkSync(pyPath); } catch {}

    logger.info(`[TTS] Edge-TTS: generated ${audioBuffer.length} bytes, ${wordTimings.length} word timings (estimated from audio duration ${duration.toFixed(2)}s)`);
    return { audioBuffer, wordTimings, provider: "edge", duration };
  } catch (err) {
    // Cleanup on failure
    try { fs.unlinkSync(pyPath); } catch {}
    try { fs.unlinkSync(outputPath); } catch {}
    throw new Error(`Edge-TTS failed: ${err.message}`);
  }
}

// ---------- LOCAL/FALLBACK PROVIDER ----------

async function generateWithLocalTts(text, options = {}) {
  const tempDir = options.tempDir || path.join(__dirname, "../../temp");
  const outputPath = path.join(tempDir, `local_tts_${Date.now()}.wav`);
  const mp3Path = outputPath.replace(".wav", ".mp3");

  // Try espeak first, then espeak-ng
  const engines = ["espeak", "espeak-ng"];
  let engine = null;

  for (const eng of engines) {
    try {
      const { execSync } = require("child_process");
      execSync(`which ${eng}`, { encoding: "utf-8", timeout: 3000 });
      engine = eng;
      break;
    } catch {}
  }

  if (!engine) {
    // No TTS engine available — generate silent audio
    logger.info("[TTS] No local TTS engine available — generating silent audio");
    const duration = estimateTextDuration(text);
    await new Promise((resolve, reject) => {
      exec(
        `ffmpeg -y -f lavfi -i "anullsrc=r=22050:cl=mono" -t ${duration} -c:a libmp3lame -q:a 9 "${mp3Path}"`,
        { timeout: 10000 },
        (err) => err ? reject(err) : resolve()
      );
    });

    const audioBuffer = fs.readFileSync(mp3Path);
    const wordTimings = estimateWordTimings(text, null, duration);
    try { fs.unlinkSync(mp3Path); } catch {}
    return { audioBuffer, wordTimings, provider: "silent" };
  }

  logger.info(`[TTS] Local TTS: using ${engine} (${text.length} chars)`);

  // Generate with espeak
  await new Promise((resolve, reject) => {
    execFile(engine, ['-w', outputPath, text], { timeout: 30000 }, (err) => err ? reject(err) : resolve());
  });

  // Convert to mp3
  await new Promise((resolve, reject) => {
    exec(
      `ffmpeg -y -i "${outputPath}" -c:a libmp3lame -q:a 2 "${mp3Path}"`,
      { timeout: 10000 },
      (err) => err ? reject(err) : resolve()
    );
  });

  const audioBuffer = fs.readFileSync(mp3Path);
  const duration = await getAudioDuration(mp3Path);
  const wordTimings = estimateWordTimings(text, null, duration);

  // Cleanup
  try { fs.unlinkSync(outputPath); } catch {}
  try { fs.unlinkSync(mp3Path); } catch {}

  logger.info(`[TTS] Local TTS: generated ${audioBuffer.length} bytes, ${wordTimings.length} word timings`);
  return { audioBuffer, wordTimings, provider: engine };
}

// ---------- TIMING ESTIMATION ----------

/**
 * Estimate word timings when real timing data is unavailable
 * Uses average speaking rate (~150 words per minute) and distributes evenly
 */
function estimateWordTimings(text, audioBuffer = null, totalDuration = null) {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return [];

  // Estimate duration from word count if not provided
  if (!totalDuration) {
    totalDuration = estimateTextDuration(text);
  }

  const avgWordDuration = totalDuration / words.length;
  const timings = [];
  let currentTime = 0;

  for (const word of words) {
    // Longer words get slightly more time
    const wordFactor = Math.max(0.5, Math.min(2.0, word.length / 5));
    const duration = avgWordDuration * wordFactor;

    timings.push({
      word,
      start: Math.round(currentTime * 1000) / 1000,
      end: Math.round((currentTime + duration) * 1000) / 1000,
      duration: Math.round(duration * 1000) / 1000,
    });

    currentTime += duration;
  }

  // Scale to match actual duration if available
  if (totalDuration && currentTime > 0) {
    const scale = totalDuration / currentTime;
    for (const t of timings) {
      t.start = Math.round(t.start * scale * 1000) / 1000;
      t.end = Math.round(t.end * scale * 1000) / 1000;
      t.duration = Math.round(t.duration * scale * 1000) / 1000;
    }
  }

  return timings;
}

/**
 * Estimate text duration based on average speaking rate
 */
function estimateTextDuration(text) {
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  // Average: 150 words per minute = 2.5 words per second
  return wordCount / 2.5;
}

/**
 * Get audio duration using ffprobe
 */
function getAudioDuration(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return resolve(estimateTextDuration(""));
      resolve(metadata.format.duration || 0);
    });
  });
}

// ---------- MAIN INTERFACE ----------

/**
 * Generate voice audio with word-level timing
 *
 * Automatically selects the best available provider with fallback chain:
 *   ElevenLabs → Edge-TTS → Local fallback
 *
 * @param {string} text - Text to convert to speech
 * @param {Object} options - Configuration options
 * @param {string} options.provider - Force specific provider
 * @param {string} options.voice - Voice name/ID
 * @param {string} options.tempDir - Temp directory for intermediate files
 * @returns {Object} { audioBuffer, wordTimings, provider, duration }
 */
async function generateVoiceWithTiming(text, options = {}) {
  const provider = options.provider || getActiveProvider();

  if (!provider) {
    // No provider available — generate silent audio
    logger.info("[TTS] No provider available — generating silent audio");
    const duration = estimateTextDuration(text);
    const tempDir = options.tempDir || path.join(__dirname, "../../temp");
    const silentPath = path.join(tempDir, `silent_${Date.now()}.mp3`);

    await new Promise((resolve, reject) => {
      exec(
        `ffmpeg -y -f lavfi -i "anullsrc=r=44100:cl=stereo" -t ${duration} -c:a libmp3lame -q:a 4 "${silentPath}"`,
        { timeout: 10000 },
        (err) => err ? reject(err) : resolve()
      );
    });

    const audioBuffer = fs.readFileSync(silentPath);
    const wordTimings = estimateWordTimings(text, null, duration);
    try { fs.unlinkSync(silentPath); } catch {}
    return { audioBuffer, wordTimings, provider: "silent", duration };
  }

  try {
    let result;
    switch (provider) {
      case "elevenlabs":
        result = await generateWithElevenLabs(text, options);
        break;
      case "edge":
        result = await generateWithEdgeTts(text, options);
        break;
      case "local":
        result = await generateWithLocalTts(text, options);
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    // Get duration
    const tempDir = options.tempDir || path.join(__dirname, "../../temp");
    const tempPath = path.join(tempDir, `tts_check_${Date.now()}.mp3`);
    fs.writeFileSync(tempPath, result.audioBuffer);
    result.duration = await getAudioDuration(tempPath);
    try { fs.unlinkSync(tempPath); } catch {}

    return result;
  } catch (err) {
    logger.error(`[TTS] Provider ${provider} failed: ${err.message}`);

    // Fallback chain
    const fallbackOrder = _providerPriority.filter(p => p !== provider);
    for (const fallback of fallbackOrder) {
      try {
        logger.info(`[TTS] Trying fallback: ${fallback}`);
        return await generateVoiceWithTiming(text, { ...options, provider: fallback });
      } catch (fallbackErr) {
        logger.warn(`[TTS] Fallback ${fallback} also failed: ${fallbackErr.message}`);
      }
    }

    throw new Error(`All TTS providers failed. Last error: ${err.message}`);
  }
}

/**
 * Simple voice generation without timing (backward compatible)
 */
async function generateVoice(text, options = {}) {
  const result = await generateVoiceWithTiming(text, options);
  return result.audioBuffer;
}

/**
 * Group word timings into subtitle-friendly phrases
 */
function groupWordsIntoPhrases(wordTimings, options = {}) {
  const maxPhraseDuration = options.maxPhraseDuration || 2.5;
  const maxWordsPerPhrase = options.maxWordsPerPhrase || 6;
  const minPhraseDuration = options.minPhraseDuration || 0.5;

  if (!wordTimings || wordTimings.length === 0) return [];

  const phrases = [];
  let currentPhrase = [];
  let phraseStart = null;
  let phraseEnd = null;

  for (const wt of wordTimings) {
    // Skip sentence boundary markers (from Edge-TTS)
    if (wt.isSentence) continue;

    const wouldDuration = phraseEnd !== null ? wt.end - phraseStart : wt.duration;
    const wouldWords = currentPhrase.length + 1;
    const exceedsDuration = wouldDuration > maxPhraseDuration && currentPhrase.length > 0;
    const exceedsWordCount = wouldWords > maxWordsPerPhrase;

    if (exceedsDuration || exceedsWordCount) {
      if (currentPhrase.length > 0) {
        phrases.push({
          text: currentPhrase.map(w => w.word).join(" "),
          start: phraseStart,
          end: phraseEnd,
          duration: phraseEnd - phraseStart,
          wordCount: currentPhrase.length,
        });
      }
      currentPhrase = [wt];
      phraseStart = wt.start;
      phraseEnd = wt.end;
    } else {
      currentPhrase.push(wt);
      if (phraseStart === null) phraseStart = wt.start;
      phraseEnd = wt.end;
    }
  }

  if (currentPhrase.length > 0) {
    phrases.push({
      text: currentPhrase.map(w => w.word).join(" "),
      start: phraseStart,
      end: phraseEnd,
      duration: phraseEnd - phraseStart,
      wordCount: currentPhrase.length,
    });
  }

  return phrases;
}

// ---------- STATUS / DIAGNOSTICS ----------

function getProviderStatus() {
  return {
    active: getActiveProvider(),
    providers: {
      elevenlabs: {
        available: !!process.env.ELEVENLABS_API_KEY,
        hasApiKey: !!process.env.ELEVENLABS_API_KEY,
        supportsWordTiming: true,
        costPerChar: PROVIDERS.elevenlabs.estimatedCostPerChar,
      },
      edge: {
        available: isEdgeTtsAvailable(),
        supportsWordTiming: false,
        costPerChar: 0,
        defaultVoice: PROVIDERS.edge.defaultVoice,
      },
      local: {
        available: isLocalTtsAvailable(),
        supportsWordTiming: false,
        costPerChar: 0,
      },
    },
  };
}

// ---------- EXPORTS ----------

module.exports = {
  generateVoiceWithTiming,
  generateVoice,
  groupWordsIntoPhrases,
  estimateWordTimings,
  estimateTextDuration,
  getActiveProvider,
  setProvider,
  getProviderPriority,
  getProviderStatus,
  PROVIDERS,
};
