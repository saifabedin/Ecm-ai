import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/api.js';

const AGENTS = [
  { id: 'agent-research', name: 'Research Agent', icon: '🔬', color: 'blue' },
  { id: 'agent-developer', name: 'Developer Agent', icon: '💻', color: 'green' },
  { id: 'agent-sales', name: 'Sales Agent', icon: '💼', color: 'purple' },
  { id: 'agent-automation', name: 'Automation Agent', icon: '⚡', color: 'yellow' },
  { id: 'agent-architecture', name: 'Architecture Agent', icon: '🏗️', color: 'red' },
];

const MEMORY_TYPES = [
  { value: 'decisions', label: 'Decisions', icon: '📋' },
  { value: 'research', label: 'Research', icon: '🔬' },
  { value: 'architecture', label: 'Architecture', icon: '🏗️' },
  { value: 'deployments', label: 'Deployments', icon: '🚀' },
  { value: 'customer_context', label: 'Customer Context', icon: '👤' },
  { value: 'automation_knowledge', label: 'Automation Knowledge', icon: '⚡' },
];

export default function AgentMemory() {
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [memories, setMemories] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMemory, setSelectedMemory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterAgent, setFilterAgent] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [writeForm, setWriteForm] = useState({ agentId: 'agent-research', memoryType: 'research', title: '', content: '', confidence: 0.85, tags: '', graphNodes: '' });
  const [writeResult, setWriteResult] = useState(null);

  const loadStats = useCallback(async () => {
    try {
      const data = await apiFetch('/api/shared-memory-stats');
      setStats(data.stats);
    } catch (e) { setError(e.message); }
  }, []);

  const loadMemories = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterAgent) params.set('agentId', filterAgent);
      if (filterType) params.set('memoryType', filterType);
      params.set('limit', '50');
      const data = await apiFetch(`/api/shared-memory?${params.toString()}`);
      setMemories(data.memories || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [filterAgent, filterType]);

  const loadConflicts = useCallback(async () => {
    try {
      const data = await apiFetch('/api/shared-memory-conflicts');
      setConflicts(data.conflicts || []);
    } catch (e) { /* ok */ }
  }, []);

  useEffect(() => { loadStats(); loadMemories(); loadConflicts(); }, [loadStats, loadMemories, loadConflicts]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const data = await apiFetch('/api/shared-memory/search', {
        method: 'POST',
        body: JSON.stringify({ query: searchQuery, limit: 10 }),
      });
      setSearchResults(data.results || []);
      setTab('search');
    } catch (e) { setError(e.message); }
  };

  const handleWrite = async () => {
    try {
      const body = {
        agentId: writeForm.agentId,
        memoryType: writeForm.memoryType,
        title: writeForm.title,
        content: { text: writeForm.content },
        confidence: parseFloat(writeForm.confidence),
        tags: writeForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        graphNodes: writeForm.graphNodes.split(',').map(n => n.trim()).filter(Boolean),
      };
      const data = await apiFetch('/api/shared-memory', { method: 'POST', body: JSON.stringify(body) });
      setWriteResult(data);
      setShowWriteModal(false);
      setWriteForm({ agentId: 'agent-research', memoryType: 'research', title: '', content: '', confidence: 0.85, tags: '', graphNodes: '' });
      loadMemories();
      loadStats();
    } catch (e) { setError(e.message); }
  };

  const viewMemory = async (id) => {
    try {
      const data = await apiFetch(`/api/shared-memory/${id}`);
      setSelectedMemory(data);
      setTab('detail');
    } catch (e) { setError(e.message); }
  };

  const agentColor = (agentId) => {
    const a = AGENTS.find(a => a.id === agentId);
    const colors = { blue: 'bg-blue-100 text-blue-800', green: 'bg-green-100 text-green-800', purple: 'bg-purple-100 text-purple-800', yellow: 'bg-yellow-100 text-yellow-800', red: 'bg-red-100 text-red-800' };
    return a ? colors[a.color] : 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agent Memory</h1>
          <p className="text-sm text-gray-500 mt-1">Multi-Agent Shared Intelligence Layer</p>
        </div>
        <button onClick={() => setShowWriteModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
          + Write Memory
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        {['dashboard', 'memories', 'search', 'conflicts'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {writeResult && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
        Memory written! ID: {writeResult.id} {writeResult.conflicts?.length > 0 && `| ⚠️ ${writeResult.conflicts.length} conflict(s) detected`}
      </div>}

      {/* DASHBOARD TAB */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {AGENTS.map(a => {
              const agentStat = stats?.byAgent?.find(s => s.agent_id === a.id);
              return (
                <div key={a.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                  <div className="text-2xl mb-2">{a.icon}</div>
                  <div className="text-xs text-gray-500 truncate">{a.name}</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{agentStat?.count || 0}</div>
                  <div className="text-xs text-gray-400">memories</div>
                </div>
              );
            })}
          </div>

          {/* Summary Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500">Total Memories</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.totalMemories || 0}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500">Unresolved Conflicts</div>
              <div className="text-2xl font-bold text-orange-600">{stats?.unresolvedConflicts || 0}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500">References (24h)</div>
              <div className="text-2xl font-bold text-blue-600">{stats?.recentReferences || 0}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500">Memory Types</div>
              <div className="text-2xl font-bold text-purple-600">{stats?.byType?.length || 0}</div>
            </div>
          </div>

          {/* Agent Memory Flow Diagram */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Memory Flow</h3>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400 flex-wrap">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full">Agent Writes</span>
              <span>→</span>
              <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full">PostgreSQL + pgvector</span>
              <span>→</span>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full">Vault Sync</span>
              <span>→</span>
              <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full">Knowledge Graph</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-3 flex-wrap">
              <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full">Conflict Detection</span>
              <span>←</span>
              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full">Relevance Scoring</span>
              <span>←</span>
              <span className="px-3 py-1 bg-cyan-100 text-cyan-800 rounded-full">Semantic Search</span>
            </div>
          </div>
        </div>
      )}

      {/* MEMORIES TAB */}
      {tab === 'memories' && (
        <div>
          <div className="flex gap-3 mb-4">
            <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white">
              <option value="">All Agents</option>
              {AGENTS.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white">
              <option value="">All Types</option>
              {MEMORY_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
          </div>

          {loading ? <div className="text-center py-8 text-gray-500">Loading...</div> : memories.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No memories found. Click "Write Memory" to create one.</div>
          ) : (
            <div className="space-y-3">
              {memories.map(m => (
                <div key={m.id} onClick={() => viewMemory(m.id)}
                  className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-indigo-300 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${agentColor(m.agent_id)}`}>
                          {AGENTS.find(a => a.id === m.agent_id)?.icon} {m.agent_name}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs text-gray-600 dark:text-gray-300">
                          {MEMORY_TYPES.find(t => t.value === m.memory_type)?.icon} {m.memory_type}
                        </span>
                      </div>
                      <h3 className="font-medium text-gray-900 dark:text-white">{m.title}</h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{typeof m.content === 'object' ? m.content?.text : JSON.stringify(m.content)}</p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-xs text-gray-400">{new Date(m.created_at).toLocaleDateString()}</div>
                      <div className={`text-sm font-medium mt-1 ${parseFloat(m.confidence) >= 0.9 ? 'text-green-600' : parseFloat(m.confidence) >= 0.7 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {(m.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                  {m.tags?.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {m.tags.slice(0, 5).map(t => <span key={t} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-500">#{t}</span>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SEARCH TAB */}
      {tab === 'search' && (
        <div>
          <div className="flex gap-3 mb-6">
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Semantic search across all agent memories..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white" />
            <button onClick={handleSearch} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Search</button>
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-3">
              {searchResults.map((m, i) => (
                <div key={m.id} onClick={() => viewMemory(m.id)}
                  className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-indigo-300">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${agentColor(m.agent_id)}`}>
                      {AGENTS.find(a => a.id === m.agent_id)?.icon} {m.agent_name}
                    </span>
                    {m.relevance_score != null && (
                      <span className="text-xs text-indigo-600 font-medium">Score: {(m.relevance_score * 100).toFixed(1)}%</span>
                    )}
                  </div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{m.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{typeof m.content === 'object' ? m.content?.text : JSON.stringify(m.content)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CONFLICTS TAB */}
      {tab === 'conflicts' && (
        <div>
          {conflicts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No unresolved conflicts</div>
          ) : (
            <div className="space-y-3">
              {conflicts.map(c => (
                <div key={c.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-orange-200 dark:border-orange-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.severity === 'critical' ? 'bg-red-100 text-red-800' : c.severity === 'high' ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {c.severity}
                    </span>
                    <span className="text-xs text-gray-500">{c.conflict_type}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="text-xs text-gray-500">Memory A</div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{c.title_a}</div>
                      <div className="text-xs text-gray-400">by {c.agent_a}</div>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="text-xs text-gray-500">Memory B</div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{c.title_b}</div>
                      <div className="text-xs text-gray-400">by {c.agent_b}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DETAIL TAB */}
      {tab === 'detail' && selectedMemory && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <button onClick={() => setTab('memories')} className="text-sm text-indigo-600 hover:text-indigo-800 mb-4">← Back to memories</button>
          <div className="flex items-center gap-3 mb-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${agentColor(selectedMemory.memory.agent_id)}`}>
              {AGENTS.find(a => a.id === selectedMemory.memory.agent_id)?.icon} {selectedMemory.memory.agent_name}
            </span>
            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm">{selectedMemory.memory.memory_type}</span>
            <span className={`text-sm font-medium ${parseFloat(selectedMemory.memory.confidence) >= 0.9 ? 'text-green-600' : 'text-yellow-600'}`}>
              Confidence: {(selectedMemory.memory.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{selectedMemory.memory.title}</h2>
          <p className="text-sm text-gray-400 mb-4">Created: {new Date(selectedMemory.memory.created_at).toISOString()}</p>
          <div className="prose dark:prose-invert max-w-none mb-6">
            <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-sm overflow-auto">
              {typeof selectedMemory.memory.content === 'object' ? JSON.stringify(selectedMemory.memory.content, null, 2) : selectedMemory.memory.content}
            </pre>
          </div>

          {/* References */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Outgoing References ({selectedMemory.references.outgoing.length})</h3>
              {selectedMemory.references.outgoing.length === 0 ? <p className="text-sm text-gray-500">None</p> :
                selectedMemory.references.outgoing.map(r => (
                  <div key={r.id} className="p-2 bg-gray-50 dark:bg-gray-700 rounded mb-2 text-sm">
                    <span className="font-medium">{r.ref_title}</span> <span className="text-gray-400">({r.reference_type})</span>
                    <div className="text-xs text-gray-400">by {r.ref_agent}</div>
                  </div>
                ))
              }
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Incoming References ({selectedMemory.references.incoming.length})</h3>
              {selectedMemory.references.incoming.length === 0 ? <p className="text-sm text-gray-500">None</p> :
                selectedMemory.references.incoming.map(r => (
                  <div key={r.id} className="p-2 bg-gray-50 dark:bg-gray-700 rounded mb-2 text-sm">
                    <span className="font-medium">{r.ref_title}</span> <span className="text-gray-400">({r.reference_type})</span>
                    <div className="text-xs text-gray-400">by {r.ref_agent}</div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* WRITE MODAL */}
      {showWriteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowWriteModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Write Agent Memory</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Agent</label>
                <select value={writeForm.agentId} onChange={e => setWriteForm({ ...writeForm, agentId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                  {AGENTS.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Memory Type</label>
                <select value={writeForm.memoryType} onChange={e => setWriteForm({ ...writeForm, memoryType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                  {MEMORY_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                <input type="text" value={writeForm.title} onChange={e => setWriteForm({ ...writeForm, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label>
                <textarea rows={4} value={writeForm.content} onChange={e => setWriteForm({ ...writeForm, content: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confidence (0-1)</label>
                  <input type="number" step="0.01" min="0" max="1" value={writeForm.confidence}
                    onChange={e => setWriteForm({ ...writeForm, confidence: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags (comma-sep)</label>
                  <input type="text" value={writeForm.tags} onChange={e => setWriteForm({ ...writeForm, tags: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Graph Nodes (comma-sep)</label>
                <input type="text" value={writeForm.graphNodes} onChange={e => setWriteForm({ ...writeForm, graphNodes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleWrite} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Write Memory</button>
                <button onClick={() => setShowWriteModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-300">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
