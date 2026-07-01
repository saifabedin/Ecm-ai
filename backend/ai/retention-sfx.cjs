const fs = require("fs");
const path = require("path");
const sfx = require("./sfx.cjs");

// ---------- RETENTION RULES ----------

/**
 * Retention-triggered SFX rules
 * Maps video retention patterns to SFX triggers
 * These are applied AFTER scene-based SFX placement
 */

const RETENTION_RULES = [
  // Pattern Interrupt: "wait", "stop", "hold on" → whoosh
  {
    id: "pattern_interrupt",
    pattern: /\b(wait|stop|hold on|listen|hey|psst|look|watch this)\b/i,
    sfx: "whoosh sfx.mp3",
    volume: 0.45,
    position: "immediate", // play at exact match position
    cooldown: 3.0, // seconds between triggers
    description: "Pattern interrupt — grabs lost attention",
  },

  // CTA popup: "click", "tap", "sign up", "link" → click
  {
    id: "cta_popup",
    pattern: /\b(click|tap|sign up|join|link|subscribe|follow|download)\b/i,
    sfx: "computer click.mp3",
    volume: 0.4,
    position: "exact",
    cooldown: 2.0,
    description: "CTA action — reinforces click behavior",
  },

  // Money claim: "$", "revenue", "profit" → cash register
  {
    id: "money_claim",
    pattern: /\$[\d,]+|\b\d+[%]\b|\b(revenue|profit|earn|income|save|savings|made \$|worth)\b/i,
    sfx: "moneysfx.mp3",
    volume: 0.45,
    position: "exact",
    cooldown: 4.0,
    description: "Money claim — emphasizes financial value",
  },

  // Success statement: "success", "achieve", "goal" → success chime
  {
    id: "success_statement",
    pattern: /\b(success|win|achieve|goal|completed|done|finished|ready|launched|crushed)\b/i,
    sfx: "success slick sfx.mp3",
    volume: 0.4,
    position: "exact",
    cooldown: 3.0,
    description: "Success moment — reinforces positive outcome",
  },

  // Bonus/FOMO: "free", "limited", "exclusive" → ding
  {
    id: "bonus_fomo",
    pattern: /\b(free|bonus|special|exclusive|limited|hurry|last chance|don't miss)\b/i,
    sfx: "ding sfx.mp3",
    volume: 0.35,
    position: "exact",
    cooldown: 2.5,
    description: "FOMO trigger — creates urgency",
  },

  // Negative contrast: "wrong", "mistake", "fail" → negative sound
  {
    id: "negative_contrast",
    pattern: /\b(wrong|mistake|fail|problem|issue|never|don't)\b/i,
    sfx: "wrong.mp3",
    volume: 0.3,
    position: "exact",
    cooldown: 3.0,
    description: "Negative contrast — sets up the solution",
  },

  // Glitch/tech: "glitch", "broken", "error" → glitch
  {
    id: "glitch_tech",
    pattern: /\b(glitch|broken|error|bug|crash|hack)\b/i,
    sfx: "glitch sfx.mp3",
    volume: 0.35,
    position: "exact",
    cooldown: 2.0,
    description: "Tech disruption — emphasizes problem",
  },
];

// ---------- CAPTION-BASED TRIGGERS ----------

/**
 * Analyze subtitle timings for SFX trigger points
 * Connects caption content to SFX placement
 */
function analyzeCaptionSfx(subtitleTimings, scenes = []) {
  if (!subtitleTimings || subtitleTimings.length === 0) return [];

  const triggers = [];
  const lastTriggerTime = {};

  for (const phrase of subtitleTimings) {
    const text = phrase.text || "";
    const startTime = phrase.start || 0;

    for (const rule of RETENTION_RULES) {
      // Check cooldown
      if (lastTriggerTime[rule.id] && (startTime - lastTriggerTime[rule.id]) < rule.cooldown) {
        continue;
      }

      const match = text.match(rule.pattern);
      if (match) {
        const sfxPath = sfx.getSfxByName(rule.sfx);
        if (sfxPath) {
          triggers.push({
            ruleId: rule.id,
            sfxPath,
            startTime,
            volume: rule.volume,
            label: rule.id,
            triggerWord: match[0],
            description: rule.description,
          });
          lastTriggerTime[rule.id] = startTime;
        }
      }
    }
  }

  return triggers;
}

/**
 * Generate caption-aware SFX placements for the full video
 */
function generateRetentionSfxPlacements(script, subtitleTimings, scenes) {
  const placements = [];

  // 1. Scene-based SFX (from sfx.cjs)
  const sceneSfx = sfx.calculateAllSfxPlacements(scenes, script);
  placements.push(...sceneSfx);

  // 2. Caption-based SFX (from subtitle timings)
  if (subtitleTimings && subtitleTimings.length > 0) {
    const captionSfx = analyzeCaptionSfx(subtitleTimings, scenes);
    placements.push(...captionSfx);
  }

  // 3. Deduplicate: if two SFX trigger within 0.5s of each other, keep the louder one
  const deduped = [];
  placements.sort((a, b) => a.startTime - b.startTime);

  for (const p of placements) {
    const tooClose = deduped.find(d => Math.abs(d.startTime - p.startTime) < 0.5);
    if (!tooClose) {
      deduped.push(p);
    } else if (p.volume > tooClose.volume) {
      // Replace the quieter one
      const idx = deduped.indexOf(tooClose);
      deduped[idx] = p;
    }
  }

  return deduped;
}

// ---------- RETENTION ANALYSIS ----------

/**
 * Analyze a script for retention risk points
 * Returns sections where viewer attention may drop
 */
function analyzeRetentionRisk(script) {
  if (!script) return [];

  const risks = [];
  const sentences = script.split(/[.!?]+/).filter(s => s.trim().length > 3);

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    const lowerSentence = sentence.toLowerCase();

    // Risk: long sentence (>15 words) — attention may drift
    const wordCount = sentence.split(/\s+/).length;
    if (wordCount > 15) {
      risks.push({
        type: "long_sentence",
        position: i,
        sentence,
        severity: wordCount > 20 ? "high" : "medium",
        recommendation: "Add pattern interrupt SFX",
        sfx: "whoosh sfx.mp3",
      });
    }

    // Risk: boring/plain language — no emotional hooks
    if (!lowerSentence.match(/amazing|incredible|free|new|secret|proven|exclusive|limited/)) {
      if (i > 0 && i < sentences.length - 1) {
        risks.push({
          type: "low_engagement",
          position: i,
          sentence,
          severity: "low",
          recommendation: "Add transition SFX",
          sfx: "glitch sfx.mp3",
        });
      }
    }

    // Risk: no CTA in final 20%
    if (i >= sentences.length * 0.8) {
      if (!lowerSentence.match(/click|sign up|join|learn more|try|get|start|now|today/)) {
        risks.push({
          type: "weak_cta",
          position: i,
          sentence,
          severity: "high",
          recommendation: "Add CTA click SFX",
          sfx: "computer click.mp3",
        });
      }
    }
  }

  return risks;
}

// ---------- EXPORTS ----------

module.exports = {
  RETENTION_RULES,
  analyzeCaptionSfx,
  generateRetentionSfxPlacements,
  analyzeRetentionRisk,
};
