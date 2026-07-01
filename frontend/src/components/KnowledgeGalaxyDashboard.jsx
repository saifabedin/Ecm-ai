import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/api.js';

export default function KnowledgeGalaxyDashboard() {
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [recentLessons, setRecentLessons] = useState([]);
  const [health, setHealth] = useState(null);

  const load = useCallback(async () => {
    try {
      const [g, l] = await Promise.all([
        apiFetch('/api/galaxy/stats'),
        apiFetch('/api/lessons?limit=5'),
      ]);
      setStats(g.stats);
      setRecentLessons(l.lessons || []);
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!stats) return <div className="p-12 text-center text-gray-500">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Knowledge Galaxy</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border"><div className="text-sm text-gray-500">Total Nodes</div><div className="text-2xl font-bold">{stats.totalNodes}</div></div>
        <div className="bg-white rounded-xl p-4 border"><div className="text-sm text-gray-500">Total Edges</div><div className="text-2xl font-bold">{stats.totalEdges}</div></div>
        <div className="bg-white rounded-xl p-4 border"><div className="text-sm text-gray-500">Types</div><div className="text-2xl font-bold">{stats.byType?.length}</div></div>
        <div className="bg-white rounded-xl p-4 border"><div className="text-sm text-gray-500">Density (est)</div><div className="text-2xl font-bold">{stats.totalNodes > 0 ? ((stats.totalEdges / (stats.totalNodes * (stats.totalNodes - 1) / 2)) * 100).toFixed(1) : 0}%</div></div>
      </div>
      {stats.byType && (
        <div className="mt-4 bg-white rounded-xl p-4 border">
          <h3 className="font-semibold mb-2">Node Types</h3>
          <div className="flex gap-2 flex-wrap">
            {stats.byType.map(t => <span key={t.node_type} className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">{t.node_type}: {t.count}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}
