/**
 * Curiosity Gap Engine
 *
 * Generates curiosity-gap phrases and analyzes scripts for
 * information gap density. Curiosity gaps are the single most
 * powerful retention mechanic — they create an irresistible
 * need for the viewer to keep watching.
 *
 * Types of curiosity gaps:
 * 1. Knowledge gap: "The secret to..." / "Nobody tells you..."
 * 2. Outcome gap: "What happened next..." / "Here's what..."
 * 3. Identity gap: "People who... are different"
 * 4. Number gap: "3 things that..." / "The #1 reason..."
 * 5. Contrarian gap: "Actually, the opposite is true"
 */

// ---------- CURIOSITY GAP TEMPLATES ----------

const GAP_TEMPLATES = {
  knowledge: [
    'The secret to {topic} that nobody talks about',
    'Here\'s what they don\'t want you to know about {topic}',
    'The hidden truth about {topic}',
    'Nobody tells you this about {topic}',
    'The classified method for {topic}',
    'What {experts} won\'t tell you about {topic}',
    'The real reason {topic} works',
    'Why {topic} is actually {contrarian}',
  ],
  outcome: [
    'What happened next will {emotion}',
    'Here\'s what happens when you {action}',
    'The result will {emotion} you',
    'Watch what happens when {event}',
    'What {person} did next changed everything',
    'The outcome will {emotion} your mind',
  ],
  identity: [
    'People who {behavior} are {descriptor}',
    'If you {behavior}, you\'re {descriptor}',
    'Only {descriptor} people {behavior}',
    'The type of person who {behavior}',
    '{descriptor} people never {behavior}',
  ],
  number: [
    '{number} things that {outcome}',
    'The #{number} reason {topic}',
    '{number} secrets about {topic} that {audience} don\'t know',
    'The {ordinal} rule of {topic}',
    '{number} {topic} mistakes that are costing you {consequence}',
  ],
  contrarian: [
    'Actually, {common_belief} is wrong',
    'The opposite of {common_belief} is true',
    'Everyone thinks {common_belief}, but {reality}',
    '{common_belief}? Think again.',
    'Stop believing {common_belief}',
  ],
};

// ---------- CURIOSITY GAP DETECTION PATTERNS ----------

const GAP_DETECTION_PATTERNS = [
  // Knowledge gaps
  { pattern: /\b(secret|hidden|banned|classified|unknown)\b/i, type: 'knowledge', weight: 2.0 },
  { pattern: /\b(nobody tells you|they don't want|won't tell you)\b/i, type: 'knowledge', weight: 2.5 },
  { pattern: /\b(what if|imagine|suppose|picture this)\b/i, type: 'knowledge', weight: 2.0 },
  { pattern: /\b(here's what|the reason|the truth is|real talk)\b/i, type: 'knowledge', weight: 1.5 },

  // Outcome gaps
  { pattern: /\b(what happens|watch what|here's what happens)\b/i, type: 'outcome', weight: 2.0 },
  { pattern: /\b(will change|changed everything|will blow)\b/i, type: 'outcome', weight: 2.0 },
  { pattern: /\b(before and after|the result|the outcome)\b/i, type: 'outcome', weight: 1.5 },

  // Identity gaps
  { pattern: /\b(people who|the type of|only.*people)\b/i, type: 'identity', weight: 1.5 },
  { pattern: /\b(if you.*you're|successful people|winners|losers)\b/i, type: 'identity', weight: 1.5 },

  // Number gaps
  { pattern: /\b(\d+ (things|reasons|secrets|ways|steps|rules))\b/i, type: 'number', weight: 2.0 },
  { pattern: /\b(the #?\d|number one|top \d+|best \d+)\b/i, type: 'number', weight: 2.0 },

  // Contrarian gaps
  { pattern: /\b(actually|think again|wrong|opposite|myth)\b/i, type: 'contrarian', weight: 1.5 },
  { pattern: /\b(everyone thinks|most people believe|common belief)\b/i, type: 'contrarian', weight: 2.0 },

  // Question marks (natural curiosity gap)
  { pattern: /\?$/, type: 'question', weight: 1.5 },
];

// ---------- ANALYSIS FUNCTIONS ----------

/**
 * Analyze a script for curiosity gap density and quality.
 *
 * @param {string} script - The full video script
 * @returns {Object} Analysis with gap count, density, types, and positions
 */
function analyzeCuriosityGaps(script) {
  if (!script || typeof script !== 'string') {
    return { gaps: [], density: 0, score: 0, types: {}, recommendations: [] };
  }

  const sentences = script.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 3);
  const gaps = [];
  const typeCounts = {};

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceGaps = [];

    for (const detector of GAP_DETECTION_PATTERNS) {
      if (detector.pattern.test(sentence)) {
        sentenceGaps.push({
          type: detector.type,
          weight: detector.weight,
          pattern: detector.pattern.toString(),
        });
      }
    }

    if (sentenceGaps.length > 0) {
      const bestGap = sentenceGaps.reduce((best, g) => g.weight > best.weight ? g : best);
      gaps.push({
        position: i,
        sentence,
        type: bestGap.type,
        weight: bestGap.weight,
        totalMatches: sentenceGaps.length,
      });
      typeCounts[bestGap.type] = (typeCounts[bestGap.type] || 0) + 1;
    }
  }

  // Calculate density (gaps per sentence)
  const density = sentences.length > 0 ? gaps.length / sentences.length : 0;

  // Calculate score (0-100)
  let score = 0;

  // Base: density score (ideal density is 0.3-0.5 gaps per sentence)
  if (density >= 0.3 && density <= 0.5) {
    score += 40;
  } else if (density >= 0.2 && density <= 0.6) {
    score += 30;
  } else if (density >= 0.1) {
    score += 20;
  } else {
    score += 10;
  }

  // Type diversity bonus (more types = better retention)
  const uniqueTypes = Object.keys(typeCounts).length;
  if (uniqueTypes >= 3) score += 25;
  else if (uniqueTypes >= 2) score += 15;
  else if (uniqueTypes >= 1) score += 5;

  // Hook gap bonus (gap in first 2 sentences is critical)
  const hookGap = gaps.find(g => g.position <= 1);
  if (hookGap) score += 20;

  // Distribution bonus (gaps spread across script, not clustered)
  if (gaps.length >= 3) {
    const positions = gaps.map(g => g.position);
    const spread = Math.max(...positions) - Math.min(...positions);
    if (spread >= sentences.length * 0.5) score += 15;
  }

  score = Math.min(100, score);

  // Recommendations
  const recommendations = [];
  if (density < 0.2) {
    recommendations.push('Add more curiosity gaps — aim for 1 gap every 3 sentences');
  }
  if (!hookGap) {
    recommendations.push('Add a curiosity gap to the first 2 sentences (hook)');
  }
  if (uniqueTypes < 2) {
    recommendations.push('Use diverse gap types: knowledge + outcome + number gaps');
  }
  if (typeCounts.knowledge && typeCounts.knowledge > gaps.length * 0.7) {
    recommendations.push('Too many knowledge gaps — add outcome or number gaps for variety');
  }
  if (!typeCounts.number) {
    recommendations.push('Add a number-based gap ("3 things...", "#1 reason...") for specificity');
  }

  return {
    gaps,
    density: Math.round(density * 100) / 100,
    score,
    types: typeCounts,
    totalGaps: gaps.length,
    hasHookGap: !!hookGap,
    recommendations,
  };
}

/**
 * Generate curiosity-gap hook alternatives for a given topic.
 *
 * @param {string} topic - The video topic or main subject
 * @param {number} [count=5] - Number of alternatives to generate
 * @returns {string[]} Array of curiosity-gap hook phrases
 */
function generateHookAlternatives(topic, count = 5) {
  if (!topic) return [];

  const alternatives = [];
  const templateTypes = Object.keys(GAP_TEMPLATES);

  // Pick one template from each type to ensure diversity
  for (const type of templateTypes) {
    const templates = GAP_TEMPLATES[type];
    const template = templates[Math.floor(Math.random() * templates.length)];

    const filled = template
      .replace(/{topic}/g, topic)
      .replace(/{experts}/g, 'experts')
      .replace(/{contrarian}/g, 'not what you think')
      .replace(/{emotion}/g, 'shock you')
      .replace(/{action}/g, `try ${topic}`)
      .replace(/{event}/g, `you ${topic}`)
      .replace(/{person}/g, 'they')
      .replace(/{descriptor}/g, 'truly successful')
      .replace(/{behavior}/g, `master ${topic}`)
      .replace(/{number}/g, String(Math.floor(Math.random() * 7) + 3))
      .replace(/{ordinal}/g, 'first')
      .replace(/{outcome}/g, 'change your life')
      .replace(/{audience}/g, 'most people')
      .replace(/{consequence}/g, 'money')
      .replace(/{common_belief}/g, `what you know about ${topic}`)
      .replace(/{reality}/g, `the truth about ${topic} is different`);

    alternatives.push(filled);
    if (alternatives.length >= count) break;
  }

  // Fill remaining with random templates if needed
  while (alternatives.length < count) {
    const type = templateTypes[Math.floor(Math.random() * templateTypes.length)];
    const templates = GAP_TEMPLATES[type];
    const template = templates[Math.floor(Math.random() * templates.length)];

    const filled = template
      .replace(/{topic}/g, topic)
      .replace(/{experts}/g, 'experts')
      .replace(/{contrarian}/g, 'not what you think')
      .replace(/{emotion}/g, 'change how you see everything')
      .replace(/{action}/g, `apply ${topic}`)
      .replace(/{event}/g, `combine ${topic}`)
      .replace(/{person}/g, 'this one person')
      .replace(/{descriptor}/g, 'highly successful')
      .replace(/{behavior}/g, `use ${topic}`)
      .replace(/{number}/g, String(Math.floor(Math.random() * 9) + 2))
      .replace(/{ordinal}/g, 'golden')
      .replace(/{outcome}/g, 'blow your mind')
      .replace(/{audience}/g, 'you')
      .replace(/{consequence}/g, 'time')
      .replace(/{common_belief}/g, `everything about ${topic}`)
      .replace(/{reality}/g, `${topic} works differently`);

    if (!alternatives.includes(filled)) {
      alternatives.push(filled);
    }
  }

  return alternatives.slice(0, count);
}

module.exports = {
  analyzeCuriosityGaps,
  generateHookAlternatives,
  GAP_TEMPLATES,
  GAP_DETECTION_PATTERNS,
};
