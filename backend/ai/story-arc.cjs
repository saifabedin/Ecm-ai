/**
 * Story Arc Engine
 *
 * Analyzes script text and maps sentences to a high-retention
 * narrative arc structure. Each sentence receives:
 * - A narrative beat classification (hook, context, problem, etc.)
 * - An emotional intensity score (0-10)
 * - A pacing hint (fast, medium, slow)
 * - Scene duration recommendations
 *
 * Inspired by Hormozi-style retention mechanics:
 *   Hook → Context → Problem → Escalation → Solution → Peak → CTA
 */

// ---------- NARRATIVE BEAT DEFINITIONS ----------

const NARRATIVE_BEATS = {
  HOOK: {
    id: 'hook',
    label: 'Hook',
    targetDuration: { min: 2, max: 4 },
    pacing: 'fast',
    intensityRange: [8, 10],
    description: 'Pattern interrupt, bold claim, curiosity gap',
    musicMood: 'energetic',
    cameraMotion: 'dramatic_zoom_in',
    transitionIn: 'hard_cut',
    keywords: [
      'secret', 'never', 'stop', 'wait', 'listen', 'hey', 'psst',
      'believe', 'insane', 'crazy', 'shocking', 'wrong', 'mistake',
      'actually', 'literally', 'hidden', 'banned', 'controversial',
      'poor', 'rich', 'million', 'billion', 'zero', 'free',
      'you', 'your', 'imagine', 'what if', 'here\'s', 'this is',
    ],
  },
  CONTEXT: {
    id: 'context',
    label: 'Context',
    targetDuration: { min: 3, max: 6 },
    pacing: 'medium',
    intensityRange: [5, 7],
    description: 'Establish relevance, set the scene',
    musicMood: 'inspiring',
    cameraMotion: 'gentle_pan',
    transitionIn: 'crossfade',
    keywords: [
      'here\'s', 'let me', 'let me show', 'thing is', 'reality',
      'most people', 'everyone', 'nobody tells', 'truth',
      'years', 'ago', 'back when', 'today', 'right now',
      'situation', 'problem', 'truth is', 'fact',
    ],
  },
  PROBLEM: {
    id: 'problem',
    label: 'Problem',
    targetDuration: { min: 4, max: 8 },
    pacing: 'slow',
    intensityRange: [6, 8],
    description: 'Pain point amplification, emotional contrast',
    musicMood: 'dramatic',
    cameraMotion: 'slow_zoom',
    transitionIn: 'dissolve',
    keywords: [
      'wrong', 'mistake', 'fail', 'problem', 'issue', 'struggle',
      'waste', 'lose', 'lost', 'pain', 'hurt', 'broken',
      'never', 'don\'t', 'can\'t', 'impossible', 'frustrated',
      'tired', 'sick', 'suffering', 'stuck', 'confused',
      'worse', 'terrible', 'awful', 'horrible', 'nightmare',
    ],
  },
  ESCALATION: {
    id: 'escalation',
    label: 'Escalation',
    targetDuration: { min: 5, max: 10 },
    pacing: 'accelerating',
    intensityRange: [7, 9],
    description: 'Build tension, stakes rising',
    musicMood: 'tension',
    cameraMotion: 'push_in',
    transitionIn: 'slide_left',
    keywords: [
      'and then', 'but then', 'until', 'suddenly', 'then',
      'worse', 'even worse', 'gets worse', 'more', 'bigger',
      'thousands', 'millions', 'everyone', 'nobody', 'always',
      'keeps', 'keeps happening', 'every time', 'without',
      'before', 'after', 'during', 'while', 'moment',
    ],
  },
  SOLUTION: {
    id: 'solution',
    label: 'Solution',
    targetDuration: { min: 5, max: 10 },
    pacing: 'medium',
    intensityRange: [8, 10],
    description: 'Reveal, transformation, proof',
    musicMood: 'uplifting',
    cameraMotion: 'reveal_zoom_out',
    transitionIn: 'zoom_in',
    keywords: [
      'until', 'then I', 'discovered', 'found', 'realized',
      'solution', 'fix', 'answer', 'secret', 'trick', 'method',
      'proven', 'works', 'results', 'transformed', 'changed',
      'finally', 'breakthrough', 'easy', 'simple', 'fast',
      'this is how', 'here\'s how', 'the way', 'what I did',
    ],
  },
  PEAK: {
    id: 'peak',
    label: 'Peak',
    targetDuration: { min: 4, max: 8 },
    pacing: 'fast',
    intensityRange: [9, 10],
    description: 'Climax, strongest emotional moment',
    musicMood: 'triumphant',
    cameraMotion: 'dramatic_zoom',
    transitionIn: 'flash',
    keywords: [
      'best', 'amazing', 'incredible', 'unbelievable',
      'crushed', 'destroyed', 'dominated', 'killed it',
      'record', 'first', 'only', 'never before',
      'money', 'revenue', 'profit', 'income', 'earnings',
      'result', 'outcome', 'achieved', 'accomplished',
      '10x', '100x', 'exponential', 'massive', 'huge',
    ],
  },
  CTA: {
    id: 'cta',
    label: 'CTA',
    targetDuration: { min: 3, max: 7 },
    pacing: 'fast',
    intensityRange: [8, 10],
    description: 'Clear action, urgency, FOMO',
    musicMood: 'motivational',
    cameraMotion: 'subtle_zoom_out',
    transitionIn: 'crossfade',
    keywords: [
      'click', 'tap', 'sign up', 'join', 'link', 'subscribe',
      'follow', 'download', 'get', 'start', 'try', 'now',
      'today', 'limited', 'hurry', 'last chance', 'don\'t miss',
      'free', 'bonus', 'exclusive', 'offer', 'deal',
      'book', 'call', 'contact', 'visit', 'order',
    ],
  },
};

// ---------- INTENSITY SCORING ----------

// Words that boost emotional intensity
const INTENSITY_BOOSTERS = new Set([
  'secret', 'never', 'always', 'everyone', 'nobody', 'only',
  'first', 'last', 'best', 'worst', 'insane', 'crazy',
  'shocking', 'incredible', 'unbelievable', 'amazing',
  'million', 'billion', 'free', 'guaranteed', 'proven',
  'you', 'your', 'imagine', 'what if', 'right now',
  'before', 'after', 'transform', 'breakthrough',
  '10x', '100x', 'massive', 'huge', 'enormous',
]);

// Words that reduce intensity (filler/softening)
const INTENSITY_DAMPERS = new Set([
  'maybe', 'perhaps', 'sometimes', 'kind of', 'sort of',
  'basically', 'literally', 'actually', 'honestly',
  'I think', 'I believe', 'in my opinion', 'possibly',
]);

// Patterns that indicate questions (lower intensity)
const QUESTION_PATTERN = /\?$/;

// Patterns that indicate commands/exclamations (higher intensity)
const EXCLAMATION_PATTERN = /[!]$/;
const COMMAND_PATTERN = /\b(do|try|get|start|stop|look|watch|listen|hear)\b/i;

/**
 * Score emotional intensity of a sentence (0-10)
 */
function scoreIntensity(sentence) {
  if (!sentence || typeof sentence !== 'string') return 5;

  const words = sentence.toLowerCase().split(/\s+/);
  const wordCount = words.length;

  // Base score from sentence position in typical arc
  let score = 5;

  // Boost for intensity words
  let boostCount = 0;
  for (const word of words) {
    if (INTENSITY_BOOSTERS.has(word)) boostCount++;
  }
  score += Math.min(boostCount * 1.5, 3);

  // Dampen for softening words
  let damperCount = 0;
  for (const phrase of INTENSITY_DAMPERS) {
    if (sentence.toLowerCase().includes(phrase)) damperCount++;
  }
  score -= damperCount * 1;

  // Boost for exclamation marks
  if (EXCLAMATION_PATTERN.test(sentence.trim())) score += 1.5;

  // Boost for commands
  if (COMMAND_PATTERN.test(sentence)) score += 1;

  // Dampen for questions
  if (QUESTION_PATTERN.test(sentence.trim())) score -= 1;

  // Dampen for very long sentences (attention drift)
  if (wordCount > 20) score -= 1.5;
  else if (wordCount > 15) score -= 0.5;

  // Boost for short punchy sentences
  if (wordCount <= 6) score += 1;

  // Clamp to 0-10
  return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
}

/**
 * Classify a sentence's narrative beat based on keyword matching
 */
function classifyBeat(sentence) {
  if (!sentence || typeof sentence !== 'string') return 'context';

  const lower = sentence.toLowerCase();
  const scores = {};

  for (const [beatName, beat] of Object.entries(NARRATIVE_BEATS)) {
    let matchCount = 0;
    for (const keyword of beat.keywords) {
      if (lower.includes(keyword)) matchCount++;
    }
    scores[beatName] = matchCount;
  }

  // Find the beat with the highest match count
  let bestBeat = 'context';
  let bestScore = 0;

  for (const [beatName, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestBeat = beatName;
    }
  }

  // If no keywords matched at all, return context as default
  if (bestScore === 0) return 'context';

  return bestBeat;
}

// ---------- ARC ANALYSIS ----------

/**
 * Analyze a script and map each sentence to a narrative beat
 *
 * @param {string} script - The full video script text
 * @returns {Object} Arc analysis with beats, intensity curve, and recommendations
 */
function analyzeArc(script) {
  if (!script || typeof script !== 'string') {
    return getDefaultArc();
  }

  const sentences = script
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 3);

  if (sentences.length === 0) {
    return getDefaultArc();
  }

  // Step 1: Classify each sentence's natural beat
  const rawBeats = sentences.map((sentence, index) => ({
    index,
    text: sentence,
    naturalBeat: classifyBeat(sentence),
    intensity: scoreIntensity(sentence),
    wordCount: sentence.split(/\s+/).length,
  }));

  // Step 2: Assign final beats using positional guidance + keyword classification
  const beats = assignBeats(rawBeats);

  // Step 3: Calculate pacing recommendations
  const pacing = calculatePacing(beats);

  // Step 4: Calculate duration per beat
  const durations = calculateDurations(beats, sentences.length);

  // Step 5: Calculate total arc intensity curve
  const intensityCurve = beats.map(b => b.intensity);

  // Step 6: Generate scene recommendations
  const sceneRecommendations = generateSceneRecommendations(beats, durations);

  return {
    beats,
    pacing,
    durations,
    intensityCurve,
    sceneRecommendations,
    totalBeats: beats.length,
    averageIntensity: intensityCurve.reduce((a, b) => a + b, 0) / intensityCurve.length,
    peakIntensity: Math.max(...intensityCurve),
    hasStrongHook: beats[0]?.intensity >= 7,
    hasStrongCTA: beats[beats.length - 1]?.intensity >= 7,
    arcQuality: assessArcQuality(beats, intensityCurve),
  };
}

/**
 * Assign final beats using positional guidance + keyword classification
 * The target arc is: hook → context → problem → escalation → solution → peak → cta
 */
function assignBeats(rawBeats) {
  const n = rawBeats.length;
  if (n === 0) return [];
  // For tiny scripts, the early-return branches MUST populate every field
  // calculateDurations() and downstream code depend on — otherwise the
  // entire orchestration crashes with "Cannot destructure 'min' of
  // beat.targetDuration as it is undefined". Each branch mirrors the full
  // beat object that the main loop produces.
  if (n === 1) {
    const beatDef = NARRATIVE_BEATS.hook;
    return [{
      ...rawBeats[0],
      beat: 'hook',
      beatLabel: beatDef?.label || 'Hook',
      targetDuration: beatDef?.targetDuration || { min: 3, max: 6 },
      pacing: beatDef?.pacing || 'medium',
      musicMood: beatDef?.musicMood || 'inspiring',
      cameraMotion: beatDef?.cameraMotion || 'gentle_pan',
      transitionIn: beatDef?.transitionIn || 'crossfade',
    }];
  }
  if (n === 2) {
    const hookDef = NARRATIVE_BEATS.hook;
    const ctaDef = NARRATIVE_BEATS.cta;
    return [
      {
        ...rawBeats[0],
        beat: 'hook',
        beatLabel: hookDef?.label || 'Hook',
        targetDuration: hookDef?.targetDuration || { min: 3, max: 6 },
        pacing: hookDef?.pacing || 'fast',
        musicMood: hookDef?.musicMood || 'energetic',
        cameraMotion: hookDef?.cameraMotion || 'dramatic_zoom_in',
        transitionIn: hookDef?.transitionIn || 'hard_cut',
      },
      {
        ...rawBeats[1],
        beat: 'cta',
        beatLabel: ctaDef?.label || 'CTA',
        targetDuration: ctaDef?.targetDuration || { min: 3, max: 6 },
        pacing: ctaDef?.pacing || 'medium',
        musicMood: ctaDef?.musicMood || 'energetic',
        cameraMotion: ctaDef?.cameraMotion || 'gentle_pan',
        transitionIn: ctaDef?.transitionIn || 'crossfade',
      },
    ];
  }

  // Define target arc positions (percentage-based)
  const arcPositions = [
    { beat: 'hook', start: 0, end: 0.10 },        // First 10%
    { beat: 'context', start: 0.10, end: 0.25 },   // 10-25%
    { beat: 'problem', start: 0.25, end: 0.40 },   // 25-40%
    { beat: 'escalation', start: 0.40, end: 0.55 }, // 40-55%
    { beat: 'solution', start: 0.55, end: 0.75 },   // 55-75%
    { beat: 'peak', start: 0.75, end: 0.88 },       // 75-88%
    { beat: 'cta', start: 0.88, end: 1.0 },         // 88-100%
  ];

  const beats = [];

  for (let i = 0; i < n; i++) {
    const position = (i + 0.5) / n; // Center of position range
    const raw = rawBeats[i];

    // Find the target beat for this position
    const targetBeat = arcPositions.find(
      p => position >= p.start && position < p.end
    ) || arcPositions[arcPositions.length - 1];

    // Use keyword classification as tiebreaker if it strongly disagrees
    const keywordBeat = raw.naturalBeat;
    const keywordBeatDef = NARRATIVE_BEATS[keywordBeat];
    const targetBeatDef = NARRATIVE_BEATS[targetBeat.beat];

    // If keyword classification strongly matches a different beat and is near its position
    const keywordPosition = keywordBeatDef ? getBeatPosition(keywordBeat, arcPositions) : 0.5;
    const positionDistance = Math.abs(keywordPosition - position);

    // Use keyword beat if it's a strong match (score >= 2) and within reasonable position range
    const useKeywordBeat = raw.wordCount > 0 && positionDistance < 0.3;

    const finalBeat = useKeywordBeat ? keywordBeat : targetBeat.beat;
    const beatDef = NARRATIVE_BEATS[finalBeat];

    beats.push({
      ...raw,
      beat: finalBeat,
      beatLabel: beatDef?.label || finalBeat,
      targetDuration: beatDef?.targetDuration || { min: 3, max: 6 },
      pacing: beatDef?.pacing || 'medium',
      musicMood: beatDef?.musicMood || 'inspiring',
      cameraMotion: beatDef?.cameraMotion || 'gentle_pan',
      transitionIn: beatDef?.transitionIn || 'crossfade',
    });
  }

  return beats;
}

/**
 * Get approximate position of a beat in the arc (0-1)
 */
function getBeatPosition(beatName, arcPositions) {
  const pos = arcPositions.find(p => p.beat === beatName);
  return pos ? (pos.start + pos.end) / 2 : 0.5;
}

/**
 * Calculate pacing recommendations based on beat sequence
 */
function calculatePacing(beats) {
  if (beats.length === 0) return 'uniform';

  const pacingMap = beats.map(b => b.pacing);

  // Check for good pacing variety
  const hasFast = pacingMap.includes('fast');
  const hasSlow = pacingMap.includes('slow');
  const hasAccelerating = pacingMap.includes('accelerating');

  if (hasFast && hasSlow && hasAccelerating) return 'excellent';
  if (hasFast && hasSlow) return 'good';
  if (hasAccelerating) return 'building';
  return 'uniform';
}

/**
 * Calculate duration for each beat
 */
function calculateDurations(beats, totalSentences) {
  return beats.map(beat => {
    const { min, max } = beat.targetDuration;
    // Scale duration based on sentence length (longer sentences need more time)
    const wordCount = beat.wordCount || 5;
    const readingTime = (wordCount / 150) * 60; // 150 words per minute speaking rate
    const baseDuration = min + (max - min) * 0.5;

    // Blend reading time with target duration
    const duration = Math.max(min, Math.min(max, (readingTime + baseDuration) / 2));

    return Math.round(duration * 10) / 10;
  });
}

/**
 * Generate per-scene recommendations
 */
function generateSceneRecommendations(beats, durations) {
  return beats.map((beat, i) => ({
    sceneIndex: i,
    beat: beat.beat,
    beatLabel: beat.beatLabel,
    scriptText: beat.text,
    duration: durations[i],
    intensity: beat.intensity,
    pacing: beat.pacing,
    musicMood: beat.musicMood,
    cameraMotion: beat.cameraMotion,
    transitionIn: beat.transitionIn,
  }));
}

/**
 * Assess overall arc quality (0-100)
 */
function assessArcQuality(beats, intensityCurve) {
  if (beats.length < 3) return 30; // Too few beats for good arc

  let score = 0;

  // Check: has all 3 acts (beginning, middle, end)
  const uniqueBeats = new Set(beats.map(b => b.beat));
  if (uniqueBeats.has('hook')) score += 15;
  if (uniqueBeats.has('cta')) score += 15;
  if (uniqueBeats.has('problem') || uniqueBeats.has('escalation')) score += 10;

  // Check: intensity curve has variation (not flat)
  const maxIntensity = Math.max(...intensityCurve);
  const minIntensity = Math.min(...intensityCurve);
  const range = maxIntensity - minIntensity;
  if (range >= 4) score += 20;
  else if (range >= 2) score += 10;

  // Check: hook is strong (intensity >= 7)
  if (intensityCurve[0] >= 7) score += 15;

  // Check: CTA is strong (intensity >= 7)
  if (intensityCurve[intensityCurve.length - 1] >= 7) score += 15;

  // Check: there's a peak in the latter half
  const latterHalf = intensityCurve.slice(Math.floor(intensityCurve.length / 2));
  const peakInLatterHalf = Math.max(...latterHalf);
  if (peakInLatterHalf >= 8) score += 10;

  // Check: pacing variety
  const pacingTypes = new Set(beats.map(b => b.pacing));
  if (pacingTypes.size >= 3) score += 10;

  return Math.min(100, score);
}

/**
 * Get default arc for fallback scenarios
 */
function getDefaultArc() {
  return {
    beats: [
      { index: 0, text: '', beat: 'hook', beatLabel: 'Hook', intensity: 8, wordCount: 5, pacing: 'fast', targetDuration: { min: 2, max: 4 }, musicMood: 'energetic', cameraMotion: 'dramatic_zoom_in', transitionIn: 'hard_cut' },
      { index: 1, text: '', beat: 'context', beatLabel: 'Context', intensity: 6, wordCount: 10, pacing: 'medium', targetDuration: { min: 3, max: 6 }, musicMood: 'inspiring', cameraMotion: 'gentle_pan', transitionIn: 'crossfade' },
      { index: 2, text: '', beat: 'problem', beatLabel: 'Problem', intensity: 7, wordCount: 10, pacing: 'slow', targetDuration: { min: 4, max: 8 }, musicMood: 'dramatic', cameraMotion: 'slow_zoom', transitionIn: 'dissolve' },
      { index: 3, text: '', beat: 'solution', beatLabel: 'Solution', intensity: 8, wordCount: 10, pacing: 'medium', targetDuration: { min: 5, max: 10 }, musicMood: 'uplifting', cameraMotion: 'reveal_zoom_out', transitionIn: 'zoom_in' },
      { index: 4, text: '', beat: 'cta', beatLabel: 'CTA', intensity: 9, wordCount: 5, pacing: 'fast', targetDuration: { min: 3, max: 7 }, musicMood: 'motivational', cameraMotion: 'subtle_zoom_out', transitionIn: 'crossfade' },
    ],
    pacing: 'good',
    durations: [3, 5, 6, 8, 5],
    intensityCurve: [8, 6, 7, 8, 9],
    sceneRecommendations: [],
    totalBeats: 5,
    averageIntensity: 7.6,
    peakIntensity: 9,
    hasStrongHook: true,
    hasStrongCTA: true,
    arcQuality: 65,
  };
}

module.exports = {
  NARRATIVE_BEATS,
  analyzeArc,
  scoreIntensity,
  classifyBeat,
  assignBeats,
  calculatePacing,
  calculateDurations,
  generateSceneRecommendations,
  assessArcQuality,
  getDefaultArc,
};
