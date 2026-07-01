/**
 * Keyword Emphasis Detection
 *
 * Analyzes subtitle text and identifies words that should receive
 * visual emphasis (bold, highlight color, scale) based on:
 * - Power words (marketing/emotional triggers)
 * - Numbers, percentages, currency
 * - Acronyms
 * - All-caps words
 *
 * Returns a Map of word-index → emphasis-weight for use in subtitle rendering.
 */

const POWER_WORDS = new Set([
  'free', 'secret', 'proven', 'guaranteed', 'exclusive', 'limited',
  'new', 'instant', 'save', 'discover', 'unlock', 'transform',
  'now', 'today', 'never', 'always', 'best', 'worst', 'only',
  'money', 'profit', 'growth', 'revenue', 'results', 'success',
  'huge', 'massive', 'tiny', 'fast', 'slow', 'easy', 'hard',
  'stop', 'start', 'launch', 'build', 'create', 'destroy',
  'you', 'your', 'my', 'we', 'they', 'everyone', 'nobody',
  'insane', 'crazy', 'wild', 'insane', 'unreal', 'epic',
  'crush', 'crushing', 'killing', 'dominating', 'winning',
  'million', 'billion', 'thousand', 'hundred', 'billionaire',
  'first', 'last', 'next', 'step', 'simple', 'crazy',
]);

const EMPHASIS_RULES = [
  { pattern: /\b(\d+%)\b/g, type: 'percentage', weight: 2.0 },
  { pattern: /\$[\d,]+(\.\d+)?/g, type: 'currency', weight: 2.0 },
  { pattern: /\b(\d+[xX])\b/g, type: 'multiplier', weight: 2.0 },
  { pattern: /\b(\d{1,3}(,\d{3})+)\b/g, type: 'large-number', weight: 1.8 },
  { pattern: /\b([A-Z]{2,})\b/g, type: 'acronym', weight: 1.5 },
  { pattern: /\b(ROI|CTA|API|SEO|UGC|B2B|B2C|SaaS|AI)\b/g, type: 'tech-acronym', weight: 2.0 },
];

/**
 * Detect emphasis-worthy words in a text string.
 *
 * @param {string} text - The phrase text to analyze
 * @returns {Map<number, {weight: number, type: string}>} Map of word index → emphasis info
 */
function detectEmphasisWords(text) {
  if (!text) return new Map();

  const words = text.split(/\s+/);
  const emphasisMap = new Map();

  words.forEach((word, idx) => {
    const clean = word.toLowerCase().replace(/[^a-z0-9%$]/g, '');

    // Check power words
    if (POWER_WORDS.has(clean)) {
      const existing = emphasisMap.get(idx);
      if (!existing || existing.weight < 1.5) {
        emphasisMap.set(idx, { weight: 1.5, type: 'power-word' });
      }
    }

    // Check emphasis rules
    for (const rule of EMPHASIS_RULES) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(word)) {
        const existing = emphasisMap.get(idx);
        if (!existing || existing.weight < rule.weight) {
          emphasisMap.set(idx, { weight: rule.weight, type: rule.type });
        }
      }
    }

    // Check all-caps words (2+ chars, not just acronyms already caught)
    if (word.length >= 2 && word === word.toUpperCase() && /^[A-Z]+$/.test(word.replace(/[^A-Z]/g, ''))) {
      const existing = emphasisMap.get(idx);
      if (!existing || existing.weight < 1.3) {
        emphasisMap.set(idx, { weight: 1.3, type: 'all-caps' });
      }
    }
  });

  return emphasisMap;
}

/**
 * Get a list of all power words for external use (e.g., SFX triggers).
 */
function getPowerWords() {
  return [...POWER_WORDS];
}

module.exports = { detectEmphasisWords, getPowerWords, POWER_WORDS, EMPHASIS_RULES };
