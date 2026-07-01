/**
 * Pattern Interrupt Scheduler
 *
 * Determines optimal placement of pattern interrupts (visual, audio,
 * transition) throughout a video to maximize viewer retention.
 *
 * Pattern interrupts break the viewer's "autopilot" — the mental state
 * where they're passively watching and likely to scroll away.
 *
 * Research-backed rules:
 * - Every 5-8 seconds, something must change (visual, audio, or pacing)
 * - After 10+ seconds of monotony, drop-off probability spikes
 * - Pattern interrupts should be DIVERSE (not the same type repeatedly)
 * - Hook (0-5s) needs 2-3 rapid interrupts
 * - CTA (last 5-10s) needs 1-2 urgency interrupts
 * - Middle section needs 1 interrupt per 8-12 seconds
 */

// ---------- INTERRUPT TYPES ----------

const INTERRUPT_TYPES = {
  VISUAL: {
    id: 'visual',
    label: 'Visual Interrupt',
    examples: ['zoom_in', 'zoom_out', 'slide_left', 'flash', 'glitch', 'ken_burns'],
    cooldown: 3.0, // minimum seconds between same-type interrupts
    retentionBoost: 0.15,
  },
  AUDIO: {
    id: 'audio',
    label: 'Audio Interrupt',
    examples: ['whoosh', 'impact', 'riser', 'bass_drop', 'glitch_sfx'],
    cooldown: 2.5,
    retentionBoost: 0.12,
  },
  PACING: {
    id: 'pacing',
    label: 'Pacing Change',
    examples: ['speed_up', 'slow_down', 'pause', 'freeze_frame'],
    cooldown: 5.0,
    retentionBoost: 0.18,
  },
  TEXT: {
    id: 'text',
    label: 'Text/Kinetic Interrupt',
    examples: ['pop_word', 'zoom_text', 'kinetic_type', 'bold_highlight'],
    cooldown: 2.0,
    retentionBoost: 0.10,
  },
  EMOTIONAL: {
    id: 'emotional',
    label: 'Emotional Beat',
    examples: ['money_reveal', 'success_moment', 'negative_contrast', 'fomo_trigger'],
    cooldown: 4.0,
    retentionBoost: 0.20,
  },
};

// ---------- SCHEDULING RULES ----------

/**
 * Retention decay model: after N seconds without an interrupt,
 * the retention probability drops by X%.
 */
const RETENTION_DECAY = {
  hook: { maxSilence: 3.0, decayRate: 0.08 },    // Hook: interrupt every 3s
  context: { maxSilence: 6.0, decayRate: 0.05 },
  problem: { maxSilence: 5.0, decayRate: 0.06 },
  escalation: { maxSilence: 4.0, decayRate: 0.07 },
  solution: { maxSilence: 6.0, decayRate: 0.04 },
  peak: { maxSilence: 3.0, decayRate: 0.09 },   // Peak: rapid interrupts
  cta: { maxSilence: 4.0, decayRate: 0.07 },
};

// ---------- MAIN SCHEDULER ----------

/**
 * Schedule pattern interrupts across a video's timeline.
 *
 * @param {Object[]} scenes - Array of scene objects with { sceneType, duration, startTime, emotionalIntensity, narrativeBeat }
 * @param {Object} [options] - Scheduling options
 * @param {number} [options.targetDuration=55] - Target video duration in seconds
 * @param {number} [options.minInterrupts=8] - Minimum number of interrupts
 * @param {number} [options.maxInterrupts=20] - Maximum number of interrupts
 * @returns {Object} Scheduled interrupts with timing, type, and intensity
 */
function scheduleInterrupts(scenes, options = {}) {
  if (!scenes || scenes.length === 0) {
    return { interrupts: [], totalInterrupts: 0, retentionScore: 0, coverage: 0 };
  }

  const targetDuration = options.targetDuration || 55;
  const minInterrupts = options.minInterrupts || 8;
  const maxInterrupts = options.maxInterrupts || 20;

  const interrupts = [];
  const lastOfType = {}; // Track cooldown per type
  let currentTime = 0;

  for (const scene of scenes) {
    if (scene.sceneType === 'transition') {
      currentTime += scene.duration || 0.5;
      continue;
    }

    const beat = scene.narrativeBeat || 'context';
    const decay = RETENTION_DECAY[beat] || RETENTION_DECAY.context;
    const sceneDuration = scene.duration || 5;
    const intensity = scene.emotionalIntensity || 5;

    // Calculate how many interrupts this scene needs
    const interruptsNeeded = Math.max(1, Math.ceil(sceneDuration / decay.maxSilence));

    // Calculate interrupt spacing within the scene
    const spacing = sceneDuration / (interruptsNeeded + 1);

    for (let i = 0; i < interruptsNeeded && interrupts.length < maxInterrupts; i++) {
      const interruptTime = currentTime + spacing * (i + 1);

      // Select the best interrupt type (diversity + cooldown)
      const selectedType = selectInterruptType(
        beat, intensity, lastOfType, interruptTime
      );

      // Calculate intensity multiplier based on scene importance
      let intensityMultiplier = 1.0;
      if (beat === 'hook') intensityMultiplier = 1.3;
      else if (beat === 'peak') intensityMultiplier = 1.4;
      else if (beat === 'cta') intensityMultiplier = 1.2;

      interrupts.push({
        time: Math.round(interruptTime * 1000) / 1000,
        type: selectedType.id,
        typeLabel: selectedType.label,
        beat,
        sceneIndex: scenes.indexOf(scene),
        intensity: Math.min(1.0, (intensity / 10) * intensityMultiplier),
        examples: selectInterruptExample(selectedType, beat),
      });

      lastOfType[selectedType.id] = interruptTime;
    }

    currentTime += sceneDuration;
  }

  // Ensure minimum interrupt count
  if (interrupts.length < minInterrupts) {
    fillMissingInterrupts(interrupts, scenes, lastOfType, minInterrupts);
  }

  // Calculate retention coverage
  const totalDuration = currentTime;
  const coverage = calculateRetentionCoverage(interrupts, totalDuration);

  // Calculate overall retention score
  const retentionScore = calculateInterruptRetentionScore(interrupts, scenes, totalDuration);

  return {
    interrupts: interrupts.sort((a, b) => a.time - b.time),
    totalInterrupts: interrupts.length,
    retentionScore,
    coverage: Math.round(coverage * 100),
    avgIntensity: interrupts.length > 0
      ? Math.round(interrupts.reduce((s, i) => s + i.intensity, 0) / interrupts.length * 100) / 100
      : 0,
    typeDistribution: getTypeDistribution(interrupts),
  };
}

// ---------- HELPER FUNCTIONS ----------

/**
 * Select the best interrupt type based on diversity and cooldown.
 */
function selectInterruptType(beat, intensity, lastOfType, currentTime) {
  const types = Object.values(INTERRUPT_TYPES);

  // Score each type
  const scored = types.map(type => {
    let score = type.retentionBoost * 100;

    // Cooldown penalty
    const lastTime = lastOfType[type.id] || -100;
    const timeSinceLast = currentTime - lastTime;
    if (timeSinceLast < type.cooldown) {
      score *= 0.2; // Heavy penalty for cooldown violation
    }

    // Beat-specific bonuses
    if (beat === 'hook' && type.id === 'visual') score *= 1.5;
    if (beat === 'hook' && type.id === 'audio') score *= 1.3;
    if (beat === 'peak' && type.id === 'emotional') score *= 1.5;
    if (beat === 'cta' && type.id === 'text') score *= 1.4;
    if (beat === 'problem' && type.id === 'pacing') score *= 1.3;

    // Intensity bonus for high-intensity scenes
    if (intensity >= 7 && type.id === 'emotional') score *= 1.4;

    return { type, score };
  });

  // Sort by score, pick the best
  scored.sort((a, b) => b.score - a.score);
  return scored[0].type;
}

/**
 * Select a specific interrupt example based on type and beat.
 */
function selectInterruptExample(type, beat) {
  const examples = type.examples;

  // Beat-specific preferred examples
  const preferences = {
    hook: ['zoom_in', 'flash', 'whoosh', 'impact', 'pop_word'],
    peak: ['money_reveal', 'success_moment', 'bass_drop', 'freeze_frame'],
    cta: ['zoom_out', 'riser', 'bold_highlight', 'fomo_trigger'],
    problem: ['slow_down', 'negative_contrast', 'glitch', 'glitch_sfx'],
    escalation: ['speed_up', 'impact', 'ken_burns', 'kinetic_type'],
  };

  const preferred = preferences[beat] || [];
  for (const p of preferred) {
    if (examples.includes(p)) return p;
  }

  return examples[Math.floor(Math.random() * examples.length)];
}

/**
 * Fill missing interrupts to meet minimum count.
 */
function fillMissingInterrupts(interrupts, scenes, lastOfType, minCount) {
  const totalDuration = scenes.reduce((sum, s) => sum + (s.duration || 5), 0);

  while (interrupts.length < minCount) {
    // Find the largest gap between existing interrupts
    const sorted = [...interrupts].sort((a, b) => a.time - b.time);
    let maxGap = 0;
    let gapCenter = totalDuration / 2;

    for (let i = 0; i <= sorted.length; i++) {
      const start = i === 0 ? 0 : sorted[i - 1].time;
      const end = i === sorted.length ? totalDuration : sorted[i].time;
      if (end - start > maxGap) {
        maxGap = end - start;
        gapCenter = (start + end) / 2;
      }
    }

    const type = selectInterruptType('context', 5, lastOfType, gapCenter);
    interrupts.push({
      time: Math.round(gapCenter * 1000) / 1000,
      type: type.id,
      typeLabel: type.label,
      beat: 'context',
      sceneIndex: -1,
      intensity: 0.5,
      examples: type.examples[0],
    });
    lastOfType[type.id] = gapCenter;
  }
}

/**
 * Calculate what percentage of the video is covered by interrupts.
 * "Covered" = within 3 seconds of an interrupt.
 */
function calculateRetentionCoverage(interrupts, totalDuration) {
  if (totalDuration <= 0 || interrupts.length === 0) return 0;

  const coverageWindow = 3.0; // seconds
  let coveredSeconds = 0;

  for (let t = 0; t < totalDuration; t += 0.1) {
    const isCovered = interrupts.some(i => Math.abs(i.time - t) <= coverageWindow);
    if (isCovered) coveredSeconds += 0.1;
  }

  return coveredSeconds / totalDuration;
}

/**
 * Calculate overall retention score from interrupt schedule.
 */
function calculateInterruptRetentionScore(interrupts, scenes, totalDuration) {
  let score = 0;

  // Coverage score (0-30)
  const coverage = calculateRetentionCoverage(interrupts, totalDuration);
  score += coverage * 30;

  // Diversity score (0-20)
  const types = new Set(interrupts.map(i => i.type));
  score += Math.min(20, types.size * 5);

  // Frequency score (0-20)
  const idealFrequency = totalDuration / 5; // One interrupt per 5 seconds on average
  const actualFrequency = interrupts.length;
  const frequencyRatio = Math.min(actualFrequency, idealFrequency) / Math.max(actualFrequency, idealFrequency);
  score += frequencyRatio * 20;

  // Intensity distribution score (0-15)
  const avgIntensity = interrupts.reduce((s, i) => s + i.intensity, 0) / Math.max(1, interrupts.length);
  score += avgIntensity * 15;

  // Hook interrupt density (0-15)
  const hookInterrupts = interrupts.filter(i => i.beat === 'hook');
  const hookScene = scenes.find(s => s.narrativeBeat === 'hook');
  if (hookScene && hookInterrupts.length >= 2) {
    score += 15;
  } else if (hookScene && hookInterrupts.length >= 1) {
    score += 8;
  }

  return Math.min(100, Math.round(score));
}

/**
 * Get type distribution for reporting.
 */
function getTypeDistribution(interrupts) {
  const dist = {};
  for (const i of interrupts) {
    dist[i.type] = (dist[i.type] || 0) + 1;
  }
  return dist;
}

module.exports = {
  scheduleInterrupts,
  INTERRUPT_TYPES,
  RETENTION_DECAY,
};
