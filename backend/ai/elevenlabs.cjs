const axios = require("axios");

// Debug: log API key status
console.log("[ElevenLabs] API key status:", process.env.ELEVENLABS_API_KEY ? "present" : "MISSING");

async function generateVoice(text) {
  try {
    const response = await axios.post(
      "https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb",
      {
        text: text,
        model_id: "eleven_multilingual_v2",
      },
      {
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
      }
    );

    return Buffer.from(response.data);
  } catch (err) {
    console.error("ElevenLabs Error:", err.message);
    throw new Error("Voice generation failed");
  }
}

/**
 * Generate voice with word-level timing data using ElevenLabs streaming endpoint.
 *
 * Returns: { audioBuffer, wordTimings, characterAlignment }
 *   audioBuffer: Buffer - the complete audio
 *   wordTimings: Array<{ word, start, end, duration }> - word-level timing in seconds
 *   characterAlignment: { characters, startTimes, endTimes } - raw character alignment
 *
 * Falls back to generateVoice() with empty timing if streaming endpoint fails.
 */
async function generateVoiceWithTiming(text) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.log("[ElevenLabs] API key missing, using generateVoice fallback");
      const audioBuffer = await generateVoice(text);
      return { audioBuffer, wordTimings: [], characterAlignment: null };
    }

    console.log("[ElevenLabs] Requesting speech with word-level timestamps");

    const response = await axios.post(
      "https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb/stream/with-timestamps?output_format=mp3_44100_128",
      {
        text: text,
        model_id: "eleven_multilingual_v2",
      },
      {
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        responseType: "text",
        timeout: 60000,
      }
    );

    const rawText = response.data;
    const chunks = parseStreamingResponse(rawText);

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
    const characterAlignment = {
      characters: allCharacters,
      startTimes: allCharStarts,
      endTimes: allCharEnds,
    };

    const wordTimings = aggregateCharacterToWordTiming(
      allCharacters,
      allCharStarts,
      allCharEnds,
      text
    );

    console.log(`[ElevenLabs] Generated ${wordTimings.length} word timings from ${allCharacters.length} characters`);

    return { audioBuffer, wordTimings, characterAlignment };
  } catch (err) {
    console.warn("[ElevenLabs] Timing endpoint failed, falling back to standard generation:", err.message);
    try {
      const audioBuffer = await generateVoice(text);
      return { audioBuffer, wordTimings: [], characterAlignment: null };
    } catch (fallbackErr) {
      console.error("[ElevenLabs] Fallback also failed:", fallbackErr.message);
      throw fallbackErr;
    }
  }
}

/**
 * Parse concatenated JSON objects from ElevenLabs streaming response.
 * The response is NOT SSE — it's multiple JSON objects concatenated together.
 */
function parseStreamingResponse(rawText) {
  const chunks = [];
  let braceCount = 0;
  let start = -1;

  for (let i = 0; i < rawText.length; i++) {
    if (rawText[i] === '{') {
      if (braceCount === 0) start = i;
      braceCount++;
    } else if (rawText[i] === '}') {
      braceCount--;
      if (braceCount === 0 && start >= 0) {
        try {
          const obj = JSON.parse(rawText.substring(start, i + 1));
          if (obj.audio_base64 || obj.alignment) {
            chunks.push(obj);
          }
        } catch (e) {
          // Skip malformed objects
        }
        start = -1;
      }
    }
  }

  return chunks;
}

/**
 * Aggregate character-level timing into word-level timing.
 *
 * Maps each character in the original text to its timing, then groups
 * consecutive characters into words based on whitespace boundaries.
 */
function aggregateCharacterToWordTiming(characters, startTimes, endTimes, originalText) {
  if (!characters || characters.length === 0 || startTimes.length === 0) {
    return [];
  }

  const wordTimings = [];
  let currentWord = "";
  let wordStart = null;
  let wordEnd = null;
  let charIndex = 0;

  // Build a map from character position in original text to timing
  const charTimingMap = [];
  for (let i = 0; i < characters.length; i++) {
    charTimingMap.push({
      char: characters[i],
      start: startTimes[i] || 0,
      end: endTimes[i] || 0,
    });
  }

  // Walk through original text and match characters to timing
  const textChars = originalText.split("");
  let timingIdx = 0;

  for (let t = 0; t < textChars.length; t++) {
    const textChar = textChars[t];

    // Skip whitespace — finalize current word if any
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

    // Match character in timing data (skip punctuation in timing if needed)
    while (timingIdx < charTimingMap.length) {
      const timingChar = charTimingMap[timingIdx];
      timingIdx++;

      // Skip characters that don't match (punctuation, etc.)
      if (timingChar.char.toLowerCase() === textChar.toLowerCase()) {
        if (wordStart === null) {
          wordStart = timingChar.start;
        }
        wordEnd = timingChar.end;
        currentWord += textChar;
        break;
      }
      // If timing char is punctuation/space, skip it but don't advance text
      if (timingChar.char === " " || timingChar.char === "\n" || /[.,!?;:'"()]/.test(timingChar.char)) {
        continue;
      }
      // Characters don't match — might be normalization difference, skip timing char
    }
  }

  // Finalize last word
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

/**
 * Group word timings into subtitle-friendly phrases.
 *
 * Groups consecutive words into phrases of target duration, ensuring
 * phrases don't split in the middle of natural pauses.
 */
function groupWordsIntoPhrases(wordTimings, options = {}) {
  const maxPhraseDuration = options.maxPhraseDuration || 2.5;
  const maxWordsPerPhrase = options.maxWordsPerPhrase || 6;
  const minPhraseDuration = options.minPhraseDuration || 0.5;

  if (!wordTimings || wordTimings.length === 0) {
    return [];
  }

  const phrases = [];
  let currentPhrase = [];
  let phraseStart = null;
  let phraseEnd = null;

  for (const wt of wordTimings) {
    const wouldDuration = phraseEnd !== null ? wt.end - phraseStart : wt.duration;
    const wouldWords = currentPhrase.length + 1;

    // Check if adding this word would exceed limits
    const exceedsDuration = wouldDuration > maxPhraseDuration && currentPhrase.length > 0;
    const exceedsWordCount = wouldWords > maxWordsPerPhrase;

    if (exceedsDuration || exceedsWordCount) {
      // Finalize current phrase
      if (currentPhrase.length > 0) {
        phrases.push({
          text: currentPhrase.map(w => w.word).join(" "),
          start: phraseStart,
          end: phraseEnd,
          duration: phraseEnd - phraseStart,
          wordCount: currentPhrase.length,
        });
      }
      // Start new phrase
      currentPhrase = [wt];
      phraseStart = wt.start;
      phraseEnd = wt.end;
    } else {
      currentPhrase.push(wt);
      if (phraseStart === null) phraseStart = wt.start;
      phraseEnd = wt.end;
    }
  }

  // Finalize last phrase
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

module.exports = { generateVoice, generateVoiceWithTiming, groupWordsIntoPhrases };
