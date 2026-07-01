import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/api.js';

const AGENT_MAP = {
  'agent-research': { name: 'Research Agent', icon: '🔬', color: 'blue' },
  'agent-developer': { name: 'Developer Agent', icon: '💻', color: 'green' },
  'agent-sales': { name: 'Sales Agent', icon: '💼', color: 'purple' },
  'agent-automation': { name: 'Automation Agent', icon: '⚡', color: 'yellow' },
  'agent-architecture': { name: 'Architecture Agent', icon: '🏗️', color: 'red' },
};

export default function AgentCollaboration() {
  const [tab, setTab] = useState('dashboard');
  const [chains, setChains] = useState([]);
  const [activities, setActivities] = useState([]);
  const [agents, setAgents] = useState([]);
  const [chainForm, setChainForm] = useState({ triggerAgentId: 'agent-research', chainName: '', memoryId: '' });
  const [chainDetail, setChainDetail] = useState(null);
  const [showChainModal, setShowChainModal] = useState(false);
  const [chainResult, setChainResult] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [chainsRes, agentsRes, activityRes] = await Promise.all([
        apiFetch('/api/collaboration/chains'),
        apiFetch('/api/collaboration/agents'),
        apiFetch('/api/agents/activity'),
      ]);
      setChains(chainsRes.chains || []);
      setAgents(agentsRes.agents || []);
      setActivities(activityRes.activities || []);
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const startChain = async () => {
    try {
      setChainResult(null);
      const data = await apiFetch('/api/collaboration/chain', {
        method: 'POST',
        body: JSON.stringify({ triggerAgentId: chainForm.triggerAgentId, triggerMemoryId: chainForm.memoryId || null, chainName: chainForm.chainName || `Auto Chain ${new Date().toLocaleTimeString()}` }),
      });
      setChainResult({ success: true, chainId: data.chainId });
      setShowChainModal(false);
      await loadData();
    } catch (e) { setError(e.message); }
  };

  const viewChain = async (id) => {
    try {
      const d = await apiFetch(`/api/collaboration/chains/${id}`);
      setChainDetail(d);
      setTab('chain-detail');
    } catch (e) { setError(e.message); }
  };

  const agentColor = (id) => {
    const colors = { blue: 'bg-blue-100 text-blue-800', green: 'bg-green-100 text-green-800', purple: 'bg-purple-100 text-purple-800', yellow: 'bg-yellow-100 text-yellow-800', red: 'bg-red-100 text-red-800' };
    return colors[AGENT_MAP[id]?.color] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agent Collaboration</h1>
          <p className="text-sm text-gray-500">Autonomous multi-agent intelligence chains</p>
        </div>
        <button onClick={() => setShowChainModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">+ Start Chain</button>
      </div>

      {chainResult && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">✅ Chain started: {chainResult.chainId}</div>}

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {['dashboard', 'chains', 'activity', 'chain-detail'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>
            {t === 'chain-detail' ? 'Chain Detail' : t}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div className="space-y-6">
          {/* Agent Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {agents.map(a => (
              <div key={a.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 shadow-sm">
                <div className="text-2xl mb-2">{a.icon}</div>
                <div className="text-xs text-gray-500">{a.name}</div>
                <div className="text-xl font-bold">{a.memoryCount}</div>
                <div className="text-xs text-gray-400">memories</div>
                <div className="text-xs text-gray-400 mt-1">{a.collaborationSteps} collaborations</div>
              </div>
            ))}
          </div>

          {/* Collaboration Flow Diagram */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200">
            <h3 className="font-semibold mb-4">Collaboration Flow</h3>
            <div className="flex items-center justify-center gap-2 text-sm flex-wrap">
              <span className="px-3 py-2 bg-blue-100 text-blue-800 rounded-full">🔬 Research</span>
              <span>→</span>
              <span className="px-3 py-2 bg-green-100 text-green-800 rounded-full">💻 Developer</span>
              <span>→</span>
              <span className="px-3 py-2 bg-red-100 text-red-800 rounded-full">🏗️ Architecture</span>
              <span>→</span>
              <span className="px-3 py-2 bg-yellow-100 text-yellow-800 rounded-full">⚡ Automation</span>
              <span>→</span>
              <span className="px-3 py-2 bg-purple-100 text-purple-800 rounded-full">💼 Sales</span>
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">Memory flows through all agents — each reads, writes, references, and cites</p>
          </div>

          {/* Recent Activity */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200">
            <h3 className="font-semibold mb-3">Recent Activity Feed</h3>
            <div className="space-y-2 max-h-[400px] overflow-auto">
              {activities.length === 0 && <p className="text-sm text-gray-500">No activity yet</p>}
              {activities.slice(0, 15).map((a, i) => (
                <div key={i} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                  <span className="text-lg">{a.type === 'collaboration' ? '🔗' : a.type === 'lesson' ? '💡' : '🧠'}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{a.title}</div>
                    <div className="text-xs text-gray-500">{a.agent} · {new Date(a.timestamp).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'chains' && (
        <div className="space-y-3">
          {chains.length === 0 ? <div className="text-center py-12 text-gray-500">No chains yet. Start one!</div> :
            chains.map(c => (
              <div key={c.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 cursor-pointer hover:border-indigo-300"
                onClick={() => viewChain(c.id)}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{c.chain_name}</h3>
                    <div className="text-xs text-gray-500">Trigger: {c.trigger_agent_id} · Started: {new Date(c.started_at).toLocaleString()}</div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs ${c.status === 'completed' ? 'bg-green-100 text-green-800' : c.status === 'active' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{c.status}</span>
                </div>
              </div>
            ))}
        </div>
      )}

      {tab === 'chain-detail' && chainDetail && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200">
          <h2 className="text-lg font-bold mb-2">{chainDetail.chain.chain_name}</h2>
          <div className="text-sm text-gray-500 mb-4">Status: {chainDetail.chain.status} · Started: {new Date(chainDetail.chain.started_at).toLocaleString()}</div>
          <div className="space-y-3">
            {chainDetail.steps.map((s, i) => (
              <div key={s.id} className={`p-4 border rounded-lg ${s.status === 'completed' ? 'bg-green-50 border-green-200' : s.status === 'failed' ? 'bg-red-50 border-red-200' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{AGENT_MAP[s.agent_id]?.icon || '🤖'}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${agentColor(s.agent_id)}`}>{s.agent_id}</span>
                  <span className="text-sm font-medium">{s.action}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'completed' ? 'bg-green-100 text-green-800' : s.status === 'running' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{s.status}</span>
                </div>
                {s.output_data && s.output_data.result && <div className="text-sm text-gray-600 mt-2">{s.output_data.result}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {showChainModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowChainModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Start Collaboration Chain</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Chain Name</label>
                <input type="text" value={chainForm.chainName} onChange={e => setChainForm({ ...chainForm, chainName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Trigger Agent</label>
                <select value={chainForm.triggerAgentId} onChange={e => setChainForm({ ...chainForm, triggerAgentId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                  {Object.values(AGENT_MAP).map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Linked Memory ID (optional)</label>
                <input type="text" value={chainForm.memoryId} onChange={e => setChainForm({ ...chainForm, memoryId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={startChain} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Start Chain</button>
                <button onClick={() => setShowChainModal(false)} className="px-4 py-2 border rounded-lg text-gray-700">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
