import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/api.js';

export default function SelfLearning() {
  const [tab, setTab] = useState('patterns');
  const [lessons, setLessons] = useState([]);
  const [stats, setStats] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [patterns, setPatterns] = useState(null);
  const [learnForm, setLearnForm] = useState({ sourceType: 'deployment', outcome: 'success', details: { summary: '' }, sourceRefId: '' });
  const [showLearnModal, setShowLearnModal] = useState(false);
  const [learnResult, setLearnResult] = useState(null);

  const loadLessons = useCallback(async () => {
    try {
      const d = await apiFetch('/api/lessons?limit=50');
      setLessons(d.lessons || []);
    } catch (e) { setError(e.message); }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const d = await apiFetch('/api/lessons/stats');
      setStats(d.stats);
    } catch (e) { setError(e.message); }
  }, []);

  const detect = async () => {
    try {
      const p = await apiFetch('/api/lessons/detect', { method: 'POST' });
      setPatterns(p);
      setTab('patterns');
    } catch (e) { setError(e.message); }
  };

  const recommend = async () => {
    try {
      const r = await apiFetch('/api/lessons/recommend', { method: 'POST' });
      setRecommendations(r.recommendations || []);
      setTab('recommendations');
    } catch (e) { setError(e.message); }
  };

  const submitLesson = async () => {
    try {
      const d = await apiFetch('/api/lessons/learn', { method: 'POST', body: JSON.stringify(learnForm) });
      setLearnResult(d);
      setShowLearnModal(false);
      loadLessons();
      loadStats();
    } catch (e) { setError(e.message); }
  };

  useEffect(() => { loadLessons(); loadStats(); }, [loadLessons, loadStats]);

  const confidenceColor = (c) => c >= 0.8 ? 'text-green-600' : c >= 0.6 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Self-Learning Foundation</h1>
          <p className="text-sm text-gray-500">Pattern detection, lessons learned, recommendations</p>
        </div>
        <button onClick={() => setShowLearnModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">+ Capture Lesson</button>
      </div>

      {learnResult && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">✅ Lesson created: {learnResult.lessonId}</div>}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200"><div className="text-sm text-gray-500">Total Lessons</div><div className="text-2xl font-bold">{stats.totalLessons}</div></div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200"><div className="text-sm text-gray-500">Avg Usefulness</div><div className="text-2xl font-bold">{(stats.avgUsefulness * 100).toFixed(0)}%</div></div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200"><div className="text-sm text-gray-500">By Type</div><div className="text-lg font-bold">{stats.byType?.length || 0}</div></div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200"><div className="text-sm text-gray-500">Recent</div><div className="text-2xl font-bold">{stats.recentLessons?.length || 0}</div></div>
        </div>
      )}

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {['patterns', 'lessons', 'recommendations'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>{t}</button>
        ))}
      </div>

      {tab === 'patterns' && (
        <div className="space-y-4">
          {!patterns ? (
            <div className="text-center py-12">
              <p className="mb-4 text-gray-500">Pattern detection analyzes all lessons to find repeated failures, successes, and anti-patterns.</p>
              <button onClick={detect} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Run Pattern Detection</button>
            </div>
          ) : (
            <div className="space-y-4">
              {patterns.failurePatterns?.length > 0 && (
                <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                  <h3 className="font-semibold text-red-800 mb-2">🔴 Failure Patterns</h3>
                  {patterns.failurePatterns.map((p, i) => <div key={i} className="p-2 bg-white rounded mb-2 text-sm">⚠️ {p.title} (occurred {p.count} times)</div>)}
                </div>
              )}
              {patterns.successPatterns?.length > 0 && (
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                  <h3 className="font-semibold text-green-800 mb-2">🟢 Success Patterns</h3>
                  {patterns.successPatterns.map((p, i) => <div key={i} className="p-2 bg-white rounded mb-2 text-sm">✅ {p.title} (occurred {p.count} times)</div>)}
                </div>
              )}
              {patterns.mostUsefulLessons?.length > 0 && (
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <h3 className="font-semibold text-blue-800 mb-2">⭐ Most Useful Lessons</h3>
                  {patterns.mostUsefulLessons.map((p, i) => <div key={i} className="p-2 bg-white rounded mb-2 text-sm">📊 {p.title} (usefulness: {(p.usefulness_score * 100).toFixed(0)}%, applied {p.times_applied}x)</div>)}
                </div>
              )}
              <button onClick={() => setPatterns(null)} className="px-4 py-2 border rounded-lg text-sm">Run Again</button>
            </div>
          )}
        </div>
      )}

      {tab === 'lessons' && (
        <div className="space-y-3">
          {lessons.length === 0 ? <div className="text-center py-12 text-gray-500">No lessons captured yet.</div> :
            lessons.map(l => (
              <div key={l.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${l.lesson_type === 'failure_pattern' ? 'bg-red-100 text-red-800' : l.lesson_type === 'success_pattern' ? 'bg-green-100 text-green-800' : l.lesson_type === 'recommendation' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{l.lesson_type}</span>
                  <span className={`text-xs ${confidenceColor(l.confidence)}`}>Confidence: {(l.confidence * 100).toFixed(0)}%</span>
                </div>
                <h3 className="font-medium">{l.title}</h3>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{l.description}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span>From: {l.source_type}</span>
                  <span>Usefulness: {(l.usefulness_score * 100).toFixed(0)}%</span>
                  <span>Applied: {l.times_applied}x</span>
                </div>
              </div>
            ))}
        </div>
      )}

      {tab === 'recommendations' && (
        <div>
          <div className="mb-4">
            <button onClick={recommend} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">Generate Recommendations</button>
          </div>
          {recommendations.length === 0 ? <div className="text-center py-12 text-gray-500">Click to generate recommendations from patterns.</div> :
            <div className="space-y-3">
              {recommendations.map((r, i) => (
                <div key={i} className={`p-4 rounded-xl border ${r.type === 'avoid' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                  <div className="font-medium">{r.title}</div>
                  <div className="text-sm text-gray-600 mt-1">{r.reason}</div>
                  <div className="text-xs text-gray-500 mt-1">Confidence: {(r.confidence * 100).toFixed(0)}%</div>
                </div>
              ))}
            </div>
          }
        </div>
      )}

      {showLearnModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowLearnModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Capture a Lesson</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Source Type</label>
                <select value={learnForm.sourceType} onChange={e => setLearnForm({ ...learnForm, sourceType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                  <option value="deployment">Deployment</option>
                  <option value="architecture">Architecture Decision</option>
                  <option value="automation">Automation</option>
                  <option value="failure">Failure</option>
                  <option value="success">Success</option>
                  <option value="memory_update">Memory Update</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Outcome</label>
                <select value={learnForm.outcome} onChange={e => setLearnForm({ ...learnForm, outcome: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                  <option value="success">Success</option>
                  <option value="failure">Failure</option>
                  <option value="event">Event</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input type="text" value={learnForm.details.summary || ''} onChange={e => setLearnForm({ ...learnForm, details: { ...learnForm.details, summary: e.target.value } })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Source Reference ID</label>
                <input type="text" value={learnForm.sourceRefId} onChange={e => setLearnForm({ ...learnForm, sourceRefId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={submitLesson} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Capture</button>
                <button onClick={() => setShowLearnModal(false)} className="px-4 py-2 border rounded-lg text-gray-700">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
