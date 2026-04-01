/**
 * Optimizer Agent
 *
 * Reads agent_logs for the last 24 hours for a given brand, analyses
 * patterns (error rates, slow engines, token usage), and returns
 * structured improvement suggestions.
 *
 * Also triggers optimization-spider (engine-10) with the findings
 * so n8n can act on them automatically.
 */

const { triggerWorkflow } = require('../utils/n8n');
const { query } = require('../config/db');
const logger = require('../utils/logger');

// Thresholds that define a "problem" worth surfacing
const THRESHOLDS = {
  error_rate_pct:       20,   // >20% errors for an agent type = problem
  avg_tokens_high:      5000, // avg token use above this = optimise prompt
  slow_engine_ms:       8000, // avg latency above 8s = flag engine
  min_log_count:        3     // need at least 3 logs to draw conclusions
};

/**
 * Aggregate raw logs by agent_type.
 * Returns per-agent stats: call_count, error_count, avg_tokens.
 */
function aggregateLogs(logs) {
  const stats = {};

  for (const log of logs) {
    const key = log.agent_type;
    if (!stats[key]) {
      stats[key] = { agent_type: key, call_count: 0, error_count: 0, total_tokens: 0 };
    }
    stats[key].call_count++;
    stats[key].total_tokens += log.tokens_used || 0;

    const out = log.output || {};
    if (out.status === 'failed' || out.error || out.success === false) {
      stats[key].error_count++;
    }
  }

  for (const s of Object.values(stats)) {
    s.avg_tokens    = s.call_count > 0 ? Math.round(s.total_tokens / s.call_count) : 0;
    s.error_rate_pct = s.call_count > 0 ? Math.round((s.error_count / s.call_count) * 100) : 0;
  }

  return Object.values(stats);
}

/**
 * Generate human-readable suggestions from aggregated stats.
 */
function generateSuggestions(stats) {
  const suggestions = [];

  for (const s of stats) {
    if (s.call_count < THRESHOLDS.min_log_count) continue;

    if (s.error_rate_pct >= THRESHOLDS.error_rate_pct) {
      suggestions.push({
        priority:    'high',
        agent_type:  s.agent_type,
        issue:       `High error rate: ${s.error_rate_pct}% of ${s.call_count} calls failed`,
        suggestion:  `Investigate ${s.agent_type} error responses. Check n8n workflow logs for engine "${s.agent_type}".`,
        metric:      { error_rate_pct: s.error_rate_pct, call_count: s.call_count }
      });
    }

    if (s.avg_tokens >= THRESHOLDS.avg_tokens_high) {
      suggestions.push({
        priority:    'medium',
        agent_type:  s.agent_type,
        issue:       `High token usage: avg ${s.avg_tokens} tokens/call`,
        suggestion:  `Review prompt templates for "${s.agent_type}". Consider caching brand context to reduce repeated tokens.`,
        metric:      { avg_tokens: s.avg_tokens }
      });
    }
  }

  if (suggestions.length === 0) {
    suggestions.push({
      priority:   'info',
      agent_type: 'all',
      issue:      'No significant issues detected',
      suggestion: 'System is performing within normal parameters.',
      metric:     {}
    });
  }

  return suggestions.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2, info: 3 };
    return (order[a.priority] || 3) - (order[b.priority] || 3);
  });
}

/**
 * Run the Optimizer Agent.
 *
 * @param {object} opts
 * @param {string} opts.brand_id
 * @param {number} opts.hours       - lookback window (default 24)
 * @returns {object} optimization report
 */
async function run({ brand_id, hours = 24 }) {
  logger.info('Optimizer agent started', { brand_id, hours });

  // Fetch recent logs
  const logsResult = await query(
    `SELECT agent_type,
            COALESCE(output, '{}')::jsonb  AS output,
            COALESCE(tokens_used, 0)       AS tokens_used,
            created_at
     FROM agent_logs
     WHERE brand_id = $1
       AND created_at >= NOW() - ($2 || ' hours')::INTERVAL
     ORDER BY created_at DESC
     LIMIT 200`,
    [brand_id, hours]
  );

  const logs = logsResult.rows;
  const stats = aggregateLogs(logs);
  const suggestions = generateSuggestions(stats);

  const report = {
    brand_id,
    analysis_window_hours: hours,
    logs_analyzed:         logs.length,
    agent_stats:           stats,
    suggestions,
    generated_at:          new Date().toISOString()
  };

  // Log the optimizer run itself
  await query(
    `INSERT INTO agent_logs (brand_id, agent_type, input, output, tokens_used, created_at)
     VALUES ($1, 'optimizer', $2, $3, 0, NOW())`,
    [brand_id, JSON.stringify({ hours }), JSON.stringify(report)]
  ).catch(err => logger.warn('Optimizer agent_logs insert failed', { error: err.message }));

  // Dispatch to optimization-spider engine with the full report
  try {
    const { job_id } = await triggerWorkflow('optimization-spider', brand_id, {
      report,
      auto_apply: false  // set true to allow n8n to auto-apply recommendations
    });
    report.engine_job_id = job_id;
  } catch (err) {
    logger.warn('Optimizer failed to trigger optimization-spider', { error: err.message });
    report.engine_job_id = null;
    report.engine_error = err.message;
  }

  logger.info('Optimizer agent complete', {
    brand_id,
    logs_analyzed: logs.length,
    suggestions: suggestions.length
  });

  return report;
}

module.exports = { run, aggregateLogs, generateSuggestions, THRESHOLDS };
