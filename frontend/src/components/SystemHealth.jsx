import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/api.js';

export default function ExecutiveDashboard() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const d = await apiFetch('/api/executive/overview');
      setOverview(d);
      setLoading(false);
    } catch (e) { setError(e.message); setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  if (loading) return <div className="p-12 text-center text-gray-500">Loading executive intelligence...</div>;
  if (!overview) return <div className="p-12 text-center text-red-500">Failed to load</div>;

  const { overview: o, health, memory, collaboration, lessons } = overview;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Executive Intelligence</h1>
          <p className="text-sm text-gray-500">AI Operating System Overview</p>
        </div>
        <button onClick={load} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">Refresh</button>
      </div>

      {/* AI Operating System Score */}
      {health && (
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white mb-6">
          <div className="text-sm opacity-80">AI Operating System Score</div>
          <div className="text-5xl font-bold mt-1">{(health.overallScore * 100).toFixed(1)}%</div>
          <div className="text-sm opacity-80 mt-2">Overall System Health · Updated: {new Date(health.created_at).toLocaleString()}</div>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {[
              { label: 'Graph Density', value: health.graphDensity },
              { label: 'Memory Connect', value: health.memoryConnectivity },
              { label: 'Collab Score', value: health.agentCollaborationScore },
              { label: 'Knowledge Reuse', value: health.knowledgeReuseRate },
              { label: 'Learning Rate', value: health.learningRate },
              { label: 'Retrieval Acc', value: health.retrievalAccuracy },
              { label: 'Reasoning Acc', value: health.reasoningAccuracy },
            ].map((m, i) => (
              <div key={i} className="bg-white/10 rounded-lg p-2 text-center">
                <div className="text-xs opacity-80">{m.label}</div>
                <div className="text-lg font-bold">{(m.value * 100).toFixed(0)}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Active Agents</div>
          <div className="text-3xl font-bold text-indigo-600">{o.activeAgents}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Memory Growth</div>
          <div className="text-3xl font-bold text-blue-600">{o.memoryGrowth}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Knowledge Growth</div>
          <div className="text-3xl font-bold text-green-600">{o.knowledgeGrowth}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Deployment Activity</div>
          <div className="text-3xl font-bold text-purple-600">{o.deploymentActivity}</div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Architecture Changes</div>
          <div className="text-2xl font-bold">{o.architectureChanges}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Automation Activity</div>
          <div className="text-2xl font-bold">{o.automationActivity}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Top Referenced Memories</div>
          <div className="text-2xl font-bold">{o.topReferencedMemories}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Emerging Clusters</div>
          <div className="text-2xl font-bold">{o.emergingClusters}</div>
        </div>
      </div>

      {/* Most Connected Nodes */}
      {o.mostConnectedNodes?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 mb-6">
          <h3 className="font-semibold mb-3">Most Connected Nodes</h3>
          <div className="space-y-2">
            {o.mostConnectedNodes.map((n, i) => (
              <div key={n.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <div className="flex items-center gap-3">
                  <span className="text-lg">#{i + 1}</span>
                  <div>
                    <div className="text-sm font-medium">{n.label}</div>
                    <div className="text-xs text-gray-500">{n.node_type}</div>
                  </div>
                </div>
                <div className="text-sm text-gray-600">Activity: {n.activity_score || 0} | Connections: {n.connection_count || 0}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Details */}
      {health?.details && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200">
          <h3 className="font-semibold mb-3">System Details</h3>
          <div className="space-y-1 text-sm">
            <div>Total Nodes: {health.details.totalNodes} · Edges: {health.details.totalEdges} · Memories: {health.details.totalMemories}</div>
            <div>Connected Memories: {health.details.connectedMemories} · Chains: {health.details.totalChains} · Completed: {health.details.completedChains} · Lessons: {health.details.totalLessons}</div>
          </div>
        </div>
      )}
    </div>
  );
}
