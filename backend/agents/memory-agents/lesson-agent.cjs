const sm = require('../../db/shared-memory.cjs');
const collab = require('../../db/collaboration.cjs');
const lessons = require('../../db/lessons.cjs');

const AGENT_ID = 'agent-lesson';
const AGENT_NAME = 'Lesson Agent';

async function processEvent({ sourceType, sourceRefId, outcome, details }) {
  return collab.runLessonAgent({ sourceType, sourceRefId, outcome, details });
}

async function recommend() {
  return lessons.generateRecommendations();
}

async function detectPatterns() {
  return lessons.detectPatterns();
}

async function getLessonsStats() {
  return lessons.getLessonsStats();
}

module.exports = { processEvent, recommend, detectPatterns, getLessonsStats, AGENT_ID, AGENT_NAME };
