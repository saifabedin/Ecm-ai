import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../utils/api.js';

const NODE_COLORS = {
  project: '#3b82f6', client: '#8b5cf6', agent: '#10b981',
  memory: '#f59e0b', architecture: '#6366f1', research: '#06b6d4',
  automation: '#eab308', deployment: '#22c55e', sop: '#64748b',
  lesson: '#ec4899', root: '#ef4444',
};

const NODE_ICONS = {
  project: '🚀', client: '👤', agent: '🤖', memory: '🧠',
  architecture: '🏗️', research: '🔬', automation: '⚡',
  deployment: '🚀', sop: '📋', lesson: '💡', root: '⭐',
};

export default function KnowledgeGalaxy() {
  const [nodes, setNodes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [edges, setEdges] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [stats, setStats] = useState(null);
  const [trace, setTrace] = useState(null);
  const [tab, setTab] = useState('galaxy');
  const svgRef = useRef();
  const transform = useRef({ x: 0, y: 0, k: 1 });
  const dragging = useRef(null);

  const loadStats = useCallback(async () => {
    try {
      const d = await apiFetch('/api/galaxy/stats');
      setStats(d.stats);
    } catch (e) { setError(e.message); }
  }, []);

  const loadNodes = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter) params.set('nodeType', filter);
      const d = await apiFetch(`/api/galaxy/nodes?${params.toString()}`);
      setNodes(d.nodes || []);
    } catch (e) { setError(e.message); }
  }, [filter]);

  const buildGalaxy = useCallback(async () => {
    try {
      await apiFetch('/api/galaxy/build', { method: 'POST' });
      loadNodes();
      loadStats();
    } catch (e) { setError(e.message); }
  }, [loadNodes, loadStats]);

  useEffect(() => { loadStats(); loadNodes(); }, [loadStats, loadNodes]);

  const handleSearch = async () => {
    if (!search.trim()) return;
    try {
      const d = await apiFetch(`/api/galaxy/search?query=${encodeURIComponent(search)}`);
      setNodes(d.nodes || []);
      setTab('search-results');
    } catch (e) { setError(e.message); }
  };

  const selectNode = async (node) => {
    setSelected(node);
    try {
      const d = await apiFetch(`/api/galaxy/nodes/${node.id}`);
      setEdges(d.edges || []);
    } catch (e) { setError(e.message); }
  };

  const traceToNode = async () => {
    if (!selected || !trace) return;
    try {
      const d = await apiFetch(`/api/galaxy/path?source=${selected.id}&target=${trace}`);
      setTab('trace');
    } catch (e) { setError(e.message); }
  };

  // D3-like force simulation (minimal inline)
  const simulate = (ns, ed) => {
    const W = 1200, H = 800;
    const sim = ns.map(n => ({
      ...n,
      x: Math.random() * W,
      y: Math.random() * H,
      vx: 0, vy: 0,
    }));
    const centerX = W / 2, centerY = H / 2;

    // Simple force: center gravity + repulsion + edge attraction
    for (let iter = 0; iter < 50; iter++) {
      for (const n of sim) {
        n.vx += (centerX - n.x) * 0.001;
        n.vy += (centerY - n.y) * 0.001;
      }
      for (let i = 0; i < sim.length; i++) {
        for (let j = i + 1; j < sim.length; j++) {
          const dx = sim[j].x - sim[i].x;
          const dy = sim[j].y - sim[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 1;
          const force = 500 / (dist * dist);
          sim[i].vx -= dx * force;
          sim[i].vy -= dy * force;
          sim[j].vx += dx * force;
          sim[j].vy += dy * force;
        }
      }
      for (const e of ed) {
        const s = sim.find(n => n.id === e.source_id);
        const t = sim.find(n => n.id === e.target_id);
        if (s && t) {
          s.vx += (t.x - s.x) * 0.005;
          s.vy += (t.y - s.y) * 0.005;
          t.vx -= (t.x - s.x) * 0.005;
          t.vy -= (t.y - s.y) * 0.005;
        }
      }
      for (const n of sim) {
        n.x += n.vx;
        n.y += n.vy;
        n.vx *= 0.9;
        n.vy *= 0.9;
      }
    }
    return sim;
  };

  const layout = nodes.length > 0 && edges.length >= 0 ? simulate(nodes, edges) : [];
  const W = 1200, H = 800;

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    transform.current.k = Math.max(0.1, Math.min(5, transform.current.k + delta));
  };

  const handleMouseDown = (e, node) => {
    dragging.current = { node, startX: e.clientX, startY: e.clientY, nodeStartX: node.x, nodeStartY: node.y };
  };

  const handleMouseMove = (e) => {
    if (!dragging.current) return;
    const { node, startX, startY, nodeStartX, nodeStartY } = dragging.current;
    node.x = nodeStartX + (e.clientX - startX) / transform.current.k;
    node.y = nodeStartY + (e.clientY - startY) / transform.current.k;
    setNodes([...layout]);
  };

  const handleMouseUp = () => { dragging.current = null; };

  const nodeTypes = [...new Set(nodes.map(n => n.node_type))];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Knowledge Galaxy</h1>
          <p className="text-sm text-gray-500">Visual knowledge universe — all ECM intelligence in one graph</p>
        </div>
        <button onClick={buildGalaxy} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">Rebuild Galaxy</button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200"><div className="text-sm text-gray-500">Total Nodes</div><div className="text-2xl font-bold">{stats.totalNodes}</div></div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200"><div className="text-sm text-gray-500">Connections</div><div className="text-2xl font-bold">{stats.totalEdges}</div></div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200"><div className="text-sm text-gray-500">Types</div><div className="text-2xl font-bold">{stats.byType?.length || 0}</div></div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200"><div className="text-sm text-gray-500">Density (est)</div><div className="text-2xl font-bold">{stats.totalNodes > 0 ? ((stats.totalEdges / (stats.totalNodes * (stats.totalNodes - 1) / 2)) * 100).toFixed(1) : 0}%</div></div>
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Search galaxy..." className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white flex-1" />
        <button onClick={handleSearch} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Search</button>
        <select value={filter} onChange={e => { setFilter(e.target.value); loadNodes(); }}
          className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white">
          <option value="">All Types</option>
          {nodeTypes.map(t => <option key={t} value={t}>{NODE_ICONS[t] || '📄'} {t}</option>)}
        </select>
      </div>

      {selected && (
        <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{NODE_ICONS[selected.node_type] || '📄'}</span>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">{selected.label}</h3>
              <span className="text-xs text-gray-500">{selected.node_type} | ID: {selected.id.substring(0, 8)}...</span>
            </div>
          </div>
          <div className="text-sm text-gray-600 mb-2">{selected.description}</div>
          <div className="flex gap-2 text-sm">
            <span>Connections: {selected.connection_count || 0}</span>
            <span>Activity: {selected.activity_score || 0}</span>
          </div>
          {edges.outgoing.length > 0 && (
            <div className="mt-2">
              <span className="text-xs text-gray-500">Outgoing:</span>
              <div className="flex gap-1 flex-wrap mt-1">
                {edges.outgoing.slice(0, 10).map(e => <span key={e.id} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">→ {e.target_label || e.target_id.substring(0, 8)}</span>)}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 overflow-hidden mb-6">
        <svg ref={svgRef} width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
          onWheel={handleWheel} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
          className="bg-gray-50 dark:bg-gray-900">
          <g transform={`translate(${transform.current.x},${transform.current.y}) scale(${transform.current.k})`}>
            {/* Edges */}
            {edges.length > 0 && edges.map(e => {
              const s = layout.find(n => n.id === e.source_id);
              const t = layout.find(n => n.id === e.target_id);
              if (!s || !t) return null;
              return (
                <line key={e.id} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                  stroke="#cbd5e1" strokeWidth={Math.max(1, e.weight * 2)} />
              );
            })}
            {/* Nodes */}
            {layout.map(n => {
              const color = NODE_COLORS[n.node_type] || '#94a3b8';
              const r = Math.max(8, Math.min(25, 4 + (n.connection_count || 0) * 0.5));
              return (
                <g key={n.id} transform={`translate(${n.x},${n.y})`}
                  onMouseDown={(e) => handleMouseDown(e, n)}
                  onClick={() => selectNode(n)}
                  className="cursor-pointer">
                  <circle r={r} fill={color} fillOpacity="0.8" stroke="white" strokeWidth="2" />
                  <text y={-r - 5} textAnchor="middle" fontSize="10" fill="#64748b">{NODE_ICONS[n.node_type] || '📄'}</text>
                  <text y={r + 14} textAnchor="middle" fontSize="9" fill="#475569">{n.label?.substring(0, 15)}</text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {stats?.byType && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200">
          <h3 className="font-semibold mb-3">Node Types</h3>
          <div className="flex gap-2 flex-wrap">
            {stats.byType.map(t => (
              <span key={t.node_type} className={`px-3 py-1 rounded-full text-sm`}
                style={{ backgroundColor: NODE_COLORS[t.node_type] || '#94a3b8', color: 'white' }}>
                {NODE_ICONS[t.node_type] || '📄'} {t.node_type}: {t.count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
