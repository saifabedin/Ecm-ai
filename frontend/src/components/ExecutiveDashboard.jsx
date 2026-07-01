import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';

export default function ExecutiveDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    apiFetch('/api/executive/overview').then(d => setData(d)).catch(e => setError(e.message));
  }, []);

  if (!data) return <div className="p-12 text-center text-gray-500">Loading...</div>;
  const { overview: o, health, galaxy, memory, collaboration, lessons } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Executive Intelligence</h1>

      {health && (
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white mb-6">
          <div className="text-sm opacity-80">AI Operating System Score</div>
          <div className="text-5xl font-bold mt-1">{(Number(health.overallScore || 0) * 100).toFixed(1)}%</div>
          <div className="text-sm opacity-80 mt-2">Updated: {new Date(health.createdAt).toLocaleString()}</div>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {[
              { label: 'Graph Density', value: health.graphDensity },
              { label: 'Memory', value: health.memoryConnectivity },
              { label: 'Collab', value: health.agentCollaborationScore },
              { label: 'Reuse', value: health.knowledgeReuseRate },
              { label: 'Learning', value: health.learningRate },
              { label: 'Retrieval', value: health.retrievalAccuracy },
              { label: 'Reasoning', value: health.reasoningAccuracy },
            ].map((m, i) => (
              <div key={i} className="bg-white/10 rounded-lg p-2 text-center">
                <div className="text-xs opacity-80">{m.label}</div>
                <div className="text-lg font-bold">{(Number(m.value || 0) * 100).toFixed(0)}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border"><div className="text-sm text-gray-500">Active Agents</div><div className="text-3xl font-bold">{o.activeAgents}</div></div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border"><div className="text-sm text-gray-500">Memories</div><div className="text-3xl font-bold">{o.memoryGrowth}</div></div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border"><div className="text-sm text-gray-500">Knowledge Nodes</div><div className="text-3xl font-bold">{o.knowledgeGrowth}</div></div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border"><div className="text-sm text-gray-500">AI OS Score</div><div className="text-3xl font-bold">{health ? (Number(health.overallScore || 0) * 100).toFixed(1) + '%' : '—'}</div></div>
      </div>
    </div>
  );
}
