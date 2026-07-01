const pool = require('./client.cjs');
const { uuidv4 } = require('../utils/uuid.cjs');
const { getEmbedding } = require('../ai/embeddings.cjs');

// ─── EXTRACT LESSON ───────────────────────────────────────────
async function extractLesson({ sourceType, sourceRefId, lessonType, title, description, evidence, confidence, tags }) {
  if (!pool) throw new Error('DB disabled');
  const id = uuidv4();
  let embedding = null;
  try { embedding = await getEmbedding(`${title} ${description}`); } catch (e) {}

  await pool.query(
    `INSERT INTO lessons_learned (id, source_type, source_ref_id, lesson_type, title, description, evidence, confidence, tags, embedding)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, sourceType, sourceRefId || null, lessonType, title, description,
     JSON.stringify(evidence || []), confidence || 0.70, tags || [], embedding ? JSON.stringify(embedding) : null]
  );
  return id;
}

// ─── STORE LESSON ─────────────────────────────────────────────
async function storeLesson({ sourceType, sourceRefId, lessonType, title, description, evidence, confidence, tags, relatedNodeIds }) {
  // Check for duplicate lessons
  if (pool) {
    const existing = await pool.query(
      `SELECT id FROM lessons_learned WHERE title = $1 AND lesson_type = $2`, [title, lessonType]
    );
    if (existing.rows.length > 0) {
      // Update usefulness score
      await pool.query(
        `UPDATE lessons_learned SET usefulness_score = LEAST(usefulness_score + 0.05, 1.0), times_applied = times_applied + 1, updated_at = NOW() WHERE id = $1`,
        [existing.rows[0].id]
      );
      return existing.rows[0].id;
    }
  }
  return extractLesson({ sourceType, sourceRefId, lessonType, title, description, evidence, confidence, tags });
}

// ─── LINK LESSON TO GRAPH ─────────────────────────────────────
async function linkLessonToGraph(lessonId, nodeIds) {
  if (!pool) throw new Error('DB disabled');
  await pool.query(
    `UPDATE lessons_learned SET related_node_ids = $1, updated_at = NOW() WHERE id = $2`,
    [nodeIds, lessonId]
  );
}

// ─── SCORE LESSON USEFULNESS ──────────────────────────────────
async function scoreLesson(lessonId, usefulnessDelta) {
  if (!pool) throw new Error('DB disabled');
  await pool.query(
    `UPDATE lessons_learned SET usefulness_score = GREATEST(LEAST(usefulness_score + $1, 1.0), 0), updated_at = NOW() WHERE id = $2`,
    [usefulnessDelta, lessonId]
  );
}

// ─── PATTERN DETECTION ────────────────────────────────────────
async function detectPatterns() {
  if (!pool) throw new Error('DB disabled');

  // Find repeated failure patterns
  const failures = await pool.query(
    `SELECT title, COUNT(*) as count FROM lessons_learned WHERE lesson_type = 'failure_pattern' GROUP BY title HAVING COUNT(*) > 1 ORDER BY count DESC`
  );

  // Find repeated success patterns
  const successes = await pool.query(
    `SELECT title, COUNT(*) as count FROM lessons_learned WHERE lesson_type = 'success_pattern' GROUP BY title HAVING COUNT(*) > 1 ORDER BY count DESC`
  );

  // Find most useful lessons
  const useful = await pool.query(
    `SELECT title, usefulness_score, times_applied FROM lessons_learned ORDER BY usefulness_score DESC LIMIT 10`
  );

  return {
    failurePatterns: failures.rows,
    successPatterns: successes.rows,
    mostUsefulLessons: useful.rows,
  };
}

// ─── RECOMMENDATION GENERATION ────────────────────────────────
async function generateRecommendations() {
  if (!pool) throw new Error('DB disabled');

  const patterns = await detectPatterns();
  const recommendations = [];

  for (const f of patterns.failurePatterns) {
    recommendations.push({
      type: 'avoid',
      title: `Avoid: ${f.title}`,
      reason: `This failure pattern has occurred ${f.count} times`,
      confidence: 0.80,
    });
  }

  for (const s of patterns.successPatterns) {
    recommendations.push({
      type: 'repeat',
      title: `Replicate: ${s.title}`,
      reason: `This success pattern has occurred ${s.count} times`,
      confidence: 0.85,
    });
  }

  return recommendations;
}

// ─── LIST LESSONS ─────────────────────────────────────────────
async function listLessons({ lessonType, sourceType, limit = 50, offset = 0 } = {}) {
  if (!pool) throw new Error('DB disabled');
  let q = `SELECT * FROM lessons_learned WHERE 1=1`;
  const params = [];
  let idx = 1;
  if (lessonType) { q += ` AND lesson_type = $${idx++}`; params.push(lessonType); }
  if (sourceType) { q += ` AND source_type = $${idx++}`; params.push(sourceType); }
  q += ` ORDER BY usefulness_score DESC, created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(limit, offset);
  const res = await pool.query(q, params);
  const count = await pool.query(`SELECT COUNT(*) FROM lessons_learned`);
  return { lessons: res.rows, total: parseInt(count.rows[0].count) };
}

// ─── LESSON AGENT ─────────────────────────────────────────────
async function runLessonAgent(event) {
  const { sourceType, sourceRefId, outcome, details } = event;
  const isFailure = outcome === 'failure';
  const isSuccess = outcome === 'success';

  let lessonType, title, description, confidence;

  if (isFailure) {
    lessonType = 'failure_pattern';
    title = `Failure in ${sourceType}: ${details.error || 'Unknown error'}`;
    description = JSON.stringify(details);
    confidence = 0.75;
  } else if (isSuccess) {
    lessonType = 'success_pattern';
    title = `Success in ${sourceType}: ${details.summary || 'Completed'}`;
    description = JSON.stringify(details);
    confidence = 0.80;
  } else {
    lessonType = 'pattern';
    title = `Event in ${sourceType}`;
    description = JSON.stringify(details);
    confidence = 0.65;
  }

  const lessonId = await storeLesson({
    sourceType, sourceRefId, lessonType, title, description,
    evidence: [details], confidence,
    tags: [sourceType, outcome || 'event'],
  });

  const patterns = await detectPatterns();
  const recommendations = await generateRecommendations();

  return { lessonId, patterns, recommendations };
}

// ─── LESSONS STATS ────────────────────────────────────────────
async function getLessonsStats() {
  if (!pool) throw new Error('DB disabled');
  const total = await pool.query(`SELECT COUNT(*) FROM lessons_learned`);
  const byType = await pool.query(`SELECT lesson_type, COUNT(*) as count FROM lessons_learned GROUP BY lesson_type`);
  const avgUsefulness = await pool.query(`SELECT AVG(usefulness_score) as avg_usefulness FROM lessons_learned`);
  const recentLessons = await pool.query(`SELECT * FROM lessons_learned ORDER BY created_at DESC LIMIT 5`);
  return {
    totalLessons: parseInt(total.rows[0].count),
    byType: byType.rows,
    avgUsefulness: parseFloat(avgUsefulness.rows[0].avg_usefulness) || 0,
    recentLessons: recentLessons.rows,
  };
}

module.exports = {
  extractLesson, storeLesson, linkLessonToGraph, scoreLesson,
  detectPatterns, generateRecommendations, listLessons,
  runLessonAgent, getLessonsStats,
};
