/**
 * Hook Scoring Engine
 *
 * Evaluates the first 1-3 sentences of a script (the "hook")
 * and produces a 0-100 quality score based on retention mechanics:
 *
 * - Pattern interrupt strength (0-25 pts)
 * - Emotional trigger density (0-25 pts)
 * - Curiosity gap presence (0-25 pts)
 * - Brevity / punchiness (0-25 pts)
 *
 * A hook score >= 70 is considered "strong" for retention.
 * A hook score < 40 triggers automatic hook rewriting.
 */

// ---------- PATTERN INTERRUPT LEXICON ----------

const PATTERN_INTERRUPT_WORDS = new Set([
  'wait', 'stop', 'hold', 'listen', 'hey', 'psst', 'look', 'watch',
  'never', 'actually', 'literally', 'honestly', 'believe', 'shocking',
  'wrong', 'mistake', 'secret', 'hidden', 'banned', 'controversial',
  'nobody', 'everyone', 'imagine', 'what if', 'forget', 'ignore',
]);

const PATTERN_INTERRUPT_PHRASES = [
  'hold on', 'wait a minute', 'stop scrolling', 'listen to this',
  'watch this', 'you won\'t believe', 'nobody talks about',
  'here\'s the thing', 'the truth is', 'real talk',
  'can I be honest', 'let me explain', 'pay attention',
  'this changes everything', 'hear me out',
];

// ---------- EMOTIONAL TRIGGER LEXICON ----------

const EMOTIONAL_TRIGGERS = new Set([
  'secret', 'never', 'always', 'everyone', 'nobody', 'only',
  'insane', 'crazy', 'shocking', 'incredible', 'unbelievable', 'amazing',
  'million', 'billion', 'free', 'guaranteed', 'proven',
  'you', 'your', 'imagine', 'what if', 'right now',
  'before', 'after', 'transform', 'breakthrough',
  '10x', '100x', 'massive', 'huge', 'enormous',
  'love', 'hate', 'fear', 'danger', 'risk', 'reward',
  'now', 'today', 'instant', 'instantly', 'immediately',
]);

const EMOTIONAL_INTENSITY_BOOSTERS = new Set([
  'insane', 'crazy', 'shocking', 'unbelievable', 'mind-blowing',
  'terrifying', 'devastating', 'explosive', 'life-changing',
]);

// ---------- CURIOSITY GAP PATTERNS ----------

const CURIOSITY_GAP_MARKERS = [
  { pattern: /\b(secret|hidden|banned|controversial|classified)\b/i, weight: 2.0 },
  { pattern: /\b(what if|imagine|suppose|picture this)\b/i, weight: 2.0 },
  { pattern: /\b(nobody tells you|they don't want you to know)\b/i, weight: 2.5 },
  { pattern: /\b(here's what|the reason|the truth is)\b/i, weight: 1.5 },
  { pattern: /\b(before (I|we|you)|after (I|we|you))\b/i, weight: 1.0 },
  { pattern: /\b(\d+% of|most people|everyone)\b/i, weight: 1.5 },
  { pattern: /\?$/, weight: 1.5 }, // Ends with question mark
];

// ---------- SCORING FUNCTIONS ----------

/**
 * Score pattern interrupt strength (0-25)
 * Measures how effectively the hook breaks the viewer's scroll pattern.
 */
function scorePatternInterrupt(hookText) {
  if (!hookText) return 0;
  const lower = hookText.toLowerCase();
  let score = 0;

  // Single-word pattern interrupts
  for (const word of PATTERN_INTERRUPT_WORDS) {
    if (lower.includes(word)) {
      score += 5;
      break; // Cap at one word match
    }
  }

  // Multi-word pattern interrupt phrases (stronger)
  for (const phrase of PATTERN_INTERRUPT_PHRASES) {
    if (lower.includes(phrase)) {
      score += 10;
      break;
    }
  }

  // Starts with a command/imperative (strong pattern interrupt)
  if (/^(stop|wait|listen|hold|look|watch|never|forget|ignore)/i.test(lower)) {
    score += 5;
  }

  // ALL CAPS word (visual pattern interrupt in subtitle rendering)
  if (/\b[A-Z]{2,}\b/.test(hookText)) {
    score += 3;
  }

  // Exclamation mark (urgency signal)
  if (hookText.includes('!')) {
    score += 2;
  }

  return Math.min(25, score);
}

/**
 * Score emotional trigger density (0-25)
 * Measures how many emotional/power words appear in the hook.
 */
function scoreEmotionalTriggers(hookText) {
  if (!hookText) return 0;
  const words = hookText.toLowerCase().split(/\s+/);
  let score = 0;
  let triggerCount = 0;

  for (const word of words) {
    if (EMOTIONAL_TRIGGERS.has(word)) {
      triggerCount++;
      score += 4;
    }
    if (EMOTIONAL_INTENSITY_BOOSTERS.has(word)) {
      score += 3;
    }
  }

  // Diminishing returns after 3 triggers (avoid keyword stuffing)
  if (triggerCount > 3) {
    score = score * 0.8;
  }

  // Direct address ("you", "your") is a strong emotional connector
  if (/\b(you|your|you're|you'll)\b/i.test(hookText)) {
    score += 5;
  }

  return Math.min(25, score);
}

/**
 * Score curiosity gap presence (0-25)
 * Measures how strongly the hook creates an information gap the viewer must fill.
 */
function scoreCuriosityGap(hookText) {
  if (!hookText) return 0;
  let score = 0;

  // Check curiosity gap marker patterns
  for (const marker of CURIOSITY_GAP_MARKERS) {
    if (marker.pattern.test(hookText)) {
      score += marker.weight * 5;
    }
  }

  // Questions create natural curiosity gaps
  if (hookText.includes('?')) {
    score += 5;
  }

  // Incomplete statements ("The secret to...") create gaps
  if (/\.\.\.$|to\b/i.test(hookText) && hookText.split(/\s+/).length <= 8) {
    score += 5;
  }

  // Numbers create specificity ("3 things", "100%") which increases curiosity
  if (/\d+/.test(hookText)) {
    score += 3;
  }

  return Math.min(25, score);
}

/**
 * Score hook brevity and punchiness (0-25)
 * Shorter hooks retain better. The ideal hook is 3-8 words.
 */
function scoreBrevity(hookText) {
  if (!hookText) return 0;
  const wordCount = hookText.split(/\s+/).length;
  let score = 0;

  // Optimal range: 3-8 words
  if (wordCount >= 3 && wordCount <= 8) {
    score = 25;
  } else if (wordCount >= 2 && wordCount <= 10) {
    score = 20;
  } else if (wordCount <= 12) {
    score = 15;
  } else if (wordCount <= 15) {
    score = 10;
  } else {
    score = 5;
  }

  // Penalty for very long hooks (>15 words = viewer drops)
  if (wordCount > 15) {
    score = Math.max(0, score - 10);
  }

  // Bonus for very short punchy hooks (2-4 words)
  if (wordCount >= 2 && wordCount <= 4) {
    score = Math.min(25, score + 3);
  }

  return Math.min(25, score);
}

// ---------- MAIN SCORING FUNCTION ----------

/**
 * Score a hook (first 1-3 sentences) on a 0-100 scale.
 *
 * @param {string} script - The full video script (hook is extracted from first sentences)
 * @param {Object} [options] - Scoring options
 * @param {number} [options.hookSentenceCount=2] - How many sentences constitute the hook
 * @returns {Object} Scoring result with breakdown and recommendations
 */
function scoreHook(script, options = {}) {
  if (!script || typeof script !== 'string') {
    return { score: 0, grade: 'F', breakdown: {}, recommendations: ['Write a script first'] };
  }

  const hookSentenceCount = options.hookSentenceCount || 2;

  // Extract hook sentences
  const sentences = script.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 3);
  const hookSentences = sentences.slice(0, Math.min(hookSentenceCount, sentences.length));
  const hookText = hookSentences.join(' ');

  // Score each dimension
  const patternInterrupt = scorePatternInterrupt(hookText);
  const emotionalTriggers = scoreEmotionalTriggers(hookText);
  const curiosityGap = scoreCuriosityGap(hookText);
  const brevity = scoreBrevity(hookText);

  const totalScore = patternInterrupt + emotionalTriggers + curiosityGap + brevity;

  // Determine grade
  let grade;
  if (totalScore >= 85) grade = 'A+';
  else if (totalScore >= 75) grade = 'A';
  else if (totalScore >= 65) grade = 'B+';
  else if (totalScore >= 55) grade = 'B';
  else if (totalScore >= 45) grade = 'C+';
  else if (totalScore >= 35) grade = 'C';
  else if (totalScore >= 25) grade = 'D';
  else grade = 'F';

  // Generate recommendations
  const recommendations = [];
  if (patternInterrupt < 10) {
    recommendations.push('Add a pattern interrupt word (wait, stop, never, listen)');
  }
  if (emotionalTriggers < 10) {
    recommendations.push('Add emotional trigger words (secret, insane, free, you)');
  }
  if (curiosityGap < 10) {
    recommendations.push('Create a curiosity gap (what if, hidden, nobody tells you)');
  }
  if (brevity < 15) {
    recommendations.push('Shorten the hook to 3-8 words for maximum impact');
  }
  if (!hookText.includes('?') && curiosityGap < 15) {
    recommendations.push('Consider ending with a question to create engagement');
  }
  if (!/\b(you|your)\b/i.test(hookText)) {
    recommendations.push('Address the viewer directly with "you" or "your"');
  }

  return {
    score: totalScore,
    grade,
    hookText,
    breakdown: {
      patternInterrupt: { score: patternInterrupt, max: 25 },
      emotionalTriggers: { score: emotionalTriggers, max: 25 },
      curiosityGap: { score: curiosityGap, max: 25 },
      brevity: { score: brevity, max: 25 },
    },
    recommendations,
    isStrong: totalScore >= 70,
    needsRewrite: totalScore < 40,
  };
}

module.exports = {
  scoreHook,
  scorePatternInterrupt,
  scoreEmotionalTriggers,
  scoreCuriosityGap,
  scoreBrevity,
  PATTERN_INTERRUPT_WORDS,
  PATTERN_INTERRUPT_PHRASES,
  EMOTIONAL_TRIGGERS,
  CURIOSITY_GAP_MARKERS,
};
