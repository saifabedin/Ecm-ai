import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { Network, RefreshCw, ZoomIn, ZoomOut, Maximize2, Search, X, Clock, Link2 } from 'lucide-react'
import { apiFetch } from '../utils/api.js'

const CATEGORY_COLORS = {
  '00-Inbox':           '#94a3b8',
  '01-Projects':        '#3b82f6',
  '02-Clients':         '#10b981',
  '03-Agents':          '#a855f7',
  '04-Architecture':    '#f59e0b',
  '05-Automations':     '#ec4899',
  '06-Business':        '#ef4444',
  '07-Learning':        '#14b8a6',
  '08-Prompts':         '#8b5cf6',
  '09-Meetings':        '#0ea5e9',
  '10-SOPs':            '#f97316',
  '11-Research':        '#22c55e',
  '12-Memory':          '#06b6d4',
  '13-Knowledge-Graph': '#eab308',
  '99-Archive':         '#64748b',
  'templates':          '#475569',
  'workflows':          '#84cc16',
  'root':               '#1e293b',
}

const CATEGORY_LABELS = {
  '00-Inbox':           'Inbox',
  '01-Projects':        'Projects',
  '02-Clients':         'Clients',
  '03-Agents':          'Agents',
  '04-Architecture':    'Architecture',
  '05-Automations':     'Automations',
  '06-Business':        'Business',
  '07-Learning':        'Learning',
  '08-Prompts':         'Prompts',
  '09-Meetings':        'Meetings',
  '10-SOPs':            'SOPs',
  '11-Research':        'Research',
  '12-Memory':          'Memory',
  '13-Knowledge-Graph': 'Knowledge Graph',
  '99-Archive':         'Archive',
  'templates':          'Templates',
  'workflows':          'Workflows',
}

function categoryOf(path) {
  if (!path) return 'root'
  const top = path.split('/')[0]
  return CATEGORY_COLORS[top] ? top : 'root'
}

export default function KnowledgeGraph() {
  const svgRef = useRef(null)
  const containerRef = useRef(null)
  const simulationRef = useRef(null)
  const [graph, setGraph] = useState({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [meta, setMeta] = useState({ source: '', count: 0, generatedAt: '' })
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategories, setActiveCategories] = useState(() => {
    const all = {}
    Object.keys(CATEGORY_COLORS).forEach(k => { all[k] = true })
    return all
  })
  const [lastRefresh, setLastRefresh] = useState(null)
  const [highlightedNode, setHighlightedNode] = useState(null)

  const fetchGraph = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch('/api/knowledge-graph')
      setGraph({ nodes: data.nodes || [], links: data.links || [] })
      setMeta({
        source: data.source || '',
        count: data.nodeCount ?? (data.nodes || []).length,
        generatedAt: data.generatedAt || '',
      })
      setLastRefresh(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchGraph() }, [fetchGraph])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchGraph, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchGraph])

  // Filter nodes by search and category
  const filteredNodeIds = React.useMemo(() => {
    const ids = new Set()
    const q = searchQuery.toLowerCase().trim()
    for (const node of graph.nodes) {
      if (!activeCategories[node.category] && node.category !== 'root') continue
      if (q && !node.label.toLowerCase().includes(q) && !node.path?.toLowerCase().includes(q)) continue
      ids.add(node.id)
    }
    return ids
  }, [graph.nodes, searchQuery, activeCategories])

  // Find connected nodes for highlighting
  const connectedNodeIds = React.useMemo(() => {
    if (!highlightedNode) return null
    const ids = new Set([highlightedNode])
    for (const link of graph.links) {
      const srcId = typeof link.source === 'object' ? link.source.id : link.source
      const tgtId = typeof link.target === 'object' ? link.target.id : link.target
      if (srcId === highlightedNode) ids.add(tgtId)
      if (tgtId === highlightedNode) ids.add(srcId)
    }
    return ids
  }, [graph.links, highlightedNode])

  useEffect(() => {
    if (!graph.nodes.length || !svgRef.current || !containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('viewBox', `0 0 ${width} ${height}`)

    const g = svg.append('g')

    // Arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 18)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#94a3b8')
      .style('stroke', 'none')

    // Highlighted arrow marker
    svg.select('defs').append('marker')
      .attr('id', 'arrowhead-highlight')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 18)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#60a5fa')
      .style('stroke', 'none')

    // Clone data so d3 mutates safely
    const nodes = graph.nodes.map(d => ({ ...d }))
    const links = graph.links.map(d => ({ ...d }))

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(110).strength(0.6))
      .force('charge', d3.forceManyBody().strength(-380))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(28))

    simulationRef.current = simulation

    const link = g.append('g')
      .attr('stroke', '#94a3b8')
      .attr('stroke-opacity', 0.5)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', d => Math.max(1, Math.min(4, (d.weight || 1) * 1.2)))
      .attr('marker-end', 'url(#arrowhead)')

    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .on('click', (_, d) => setSelected(d))
      .on('mouseover', function (_, d) {
        setHighlightedNode(d.id)
        d3.select(this).select('circle').transition().duration(150).attr('r', d.kind === 'folder' ? 16 : 12)
        link
          .attr('stroke-opacity', l => {
            const srcId = typeof l.source === 'object' ? l.source.id : l.source
            const tgtId = typeof l.target === 'object' ? l.target.id : l.target
            return (srcId === d.id || tgtId === d.id) ? 0.95 : 0.08
          })
          .attr('stroke', l => {
            const srcId = typeof l.source === 'object' ? l.source.id : l.source
            const tgtId = typeof l.target === 'object' ? l.target.id : l.target
            return (srcId === d.id || tgtId === d.id) ? '#60a5fa' : '#94a3b8'
          })
          .attr('marker-end', l => {
            const srcId = typeof l.source === 'object' ? l.source.id : l.source
            const tgtId = typeof l.target === 'object' ? l.target.id : l.target
            return (srcId === d.id || tgtId === d.id) ? 'url(#arrowhead-highlight)' : 'url(#arrowhead)'
          })
        node.style('opacity', n => {
          if (n.id === d.id) return 1
          for (const l of links) {
            const srcId = typeof l.source === 'object' ? l.source.id : l.source
            const tgtId = typeof l.target === 'object' ? l.target.id : l.target
            if ((srcId === d.id && tgtId === n.id) || (tgtId === d.id && srcId === n.id)) return 1
          }
          return 0.15
        })
      })
      .on('mouseout', function (_, d) {
        setHighlightedNode(null)
        d3.select(this).select('circle').transition().duration(150).attr('r', d.kind === 'folder' ? 11 : 7)
        link.attr('stroke-opacity', 0.5).attr('stroke', '#94a3b8').attr('marker-end', 'url(#arrowhead)')
        node.style('opacity', 1)
      })
      .call(d3.drag()
        .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
        .on('end', (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null })
      )

    node.append('circle')
      .attr('r', d => d.kind === 'folder' ? 11 : 7)
      .attr('fill', d => CATEGORY_COLORS[d.category] || CATEGORY_COLORS.root)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)

    node.append('text')
      .text(d => d.label)
      .attr('x', 14)
      .attr('y', 4)
      .attr('font-size', d => d.kind === 'folder' ? 13 : 11)
      .attr('font-weight', d => d.kind === 'folder' ? 600 : 400)
      .attr('fill', 'currentColor')
      .style('paint-order', 'stroke')
      .style('stroke', 'var(--kg-bg, #0f172a)')
      .style('stroke-width', 3)
      .style('stroke-linejoin', 'round')
      .style('pointer-events', 'none')

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y)
      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    // Zoom
    const zoom = d3.zoom()
      .scaleExtent([0.2, 5])
      .on('zoom', (event) => g.attr('transform', event.transform))
    svg.call(zoom)

    containerRef.current._zoom = zoom
    containerRef.current._svg = svg

    return () => { simulation.stop() }
  }, [graph])

  // Apply visibility filter to rendered nodes
  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('g > g > g').each(function (d) {
      const el = d3.select(this)
      const visible = filteredNodeIds.has(d.id)
      const highlighted = !connectedNodeIds || connectedNodeIds.has(d.id)
      el.style('display', visible && highlighted ? null : 'none')
    })
  }, [filteredNodeIds, connectedNodeIds])

  const handleZoom = (factor) => {
    if (!containerRef.current?._svg || !containerRef.current?._zoom) return
    containerRef.current._svg.transition().duration(250)
      .call(containerRef.current._zoom.scaleBy, factor)
  }
  const handleReset = () => {
    if (!containerRef.current?._svg || !containerRef.current?._zoom) return
    containerRef.current._svg.transition().duration(400)
      .call(containerRef.current._zoom.transform, d3.zoomIdentity)
  }

  const toggleCategory = (cat) => {
    setActiveCategories(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  const clearSearch = () => setSearchQuery('')

  const visibleCategories = Object.keys(CATEGORY_COLORS).filter(k => k !== 'root')
  const visibleNodeCount = graph.nodes.filter(n => filteredNodeIds.has(n.id)).length
  const visibleLinkCount = graph.links.filter(l => {
    const srcId = typeof l.source === 'object' ? l.source.id : l.source
    const tgtId = typeof l.target === 'object' ? l.target.id : l.target
    return filteredNodeIds.has(srcId) && filteredNodeIds.has(tgtId)
  }).length

  const formatTime = (date) => {
    if (!date) return ''
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="p-6 h-[calc(100vh-80px)] flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Network className="w-7 h-7 text-blue-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Visual Knowledge Graph</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {loading ? 'Loading…' : error ? `Error: ${error}` :
                `${visibleNodeCount} of ${graph.nodes.length} nodes · ${visibleLinkCount} of ${graph.links.length} links`}
              {lastRefresh && <span className="ml-2 opacity-60">· refreshed {formatTime(lastRefresh)}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleZoom(1.3)} className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" title="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => handleZoom(0.7)} className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" title="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={handleReset} className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" title="Reset view">
            <Maximize2 className="w-4 h-4" />
          </button>
          <button onClick={fetchGraph} className="p-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 flex items-center gap-2 px-3 transition-colors" title="Reload">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-sm">Reload</span>
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search nodes by name or path…"
          className="w-full pl-10 pr-9 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
        />
        {searchQuery && (
          <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-1.5">
        {visibleCategories.map(cat => {
          const isActive = activeCategories[cat]
          const count = graph.nodes.filter(n => n.category === cat).length
          return (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-all ${
                isActive
                  ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800/50 border-transparent text-gray-400 dark:text-gray-600 opacity-50'
              }`}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0 transition-opacity"
                style={{ background: CATEGORY_COLORS[cat], opacity: isActive ? 1 : 0.3 }}
              ></span>
              <span>{CATEGORY_LABELS[cat] || cat}</span>
              <span className="text-[10px] opacity-60">({count})</span>
            </button>
          )
        })}
      </div>

      {/* Main content area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
        {/* Graph canvas */}
        <div ref={containerRef} className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden relative">
          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-red-500 z-10">
              Failed to load graph: {error}
            </div>
          )}
          <svg ref={svgRef} className="w-full h-full text-gray-900 dark:text-white" style={{ background: 'transparent' }}></svg>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm z-10">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          )}
          {!loading && !error && graph.nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              No nodes found in the vault.
            </div>
          )}
        </div>

        {/* Details panel */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 overflow-auto flex flex-col">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <span>Node Details</span>
          </h3>

          {selected ? (
            <div className="space-y-3 text-sm flex-1">
              <div>
                <span className="text-gray-500 text-xs uppercase tracking-wide">Name</span>
                <div className="font-mono font-medium text-gray-900 dark:text-white mt-0.5">{selected.label}</div>
              </div>
              <div>
                <span className="text-gray-500 text-xs uppercase tracking-wide">Category</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-3 h-3 rounded-full" style={{ background: CATEGORY_COLORS[selected.category] || CATEGORY_COLORS.root }}></span>
                  <span className="text-gray-700 dark:text-gray-300">{CATEGORY_LABELS[selected.category] || selected.category}</span>
                </div>
              </div>
              <div>
                <span className="text-gray-500 text-xs uppercase tracking-wide">Type</span>
                <div className="text-gray-700 dark:text-gray-300 mt-0.5">{selected.kind}</div>
              </div>
              {selected.path && (
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Path</span>
                  <div className="break-all font-mono text-xs text-gray-600 dark:text-gray-400 mt-0.5">{selected.path}</div>
                </div>
              )}
              {(selected.incoming !== undefined || selected.outgoing !== undefined) && (
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Connections</span>
                  <div className="flex gap-4 mt-1">
                    <div className="flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-gray-700 dark:text-gray-300">{selected.incoming || 0} incoming</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-green-500 rotate-180" />
                      <span className="text-gray-700 dark:text-gray-300">{selected.outgoing || 0} outgoing</span>
                    </div>
                  </div>
                </div>
              )}
              <button
                onClick={() => setSelected(null)}
                className="mt-3 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                Clear selection
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500 flex-1">Click any node to see its connections and metadata.</p>
          )}

          {/* Stats */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">Statistics</h4>
            <div className="text-xs space-y-1.5 text-gray-600 dark:text-gray-400">
              <div className="flex justify-between">
                <span>Total nodes</span>
                <span className="font-mono">{graph.nodes.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Total links</span>
                <span className="font-mono">{graph.links.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Folders</span>
                <span className="font-mono">{graph.nodes.filter(n => n.kind === 'folder').length}</span>
              </div>
              <div className="flex justify-between">
                <span>Documents</span>
                <span className="font-mono">{graph.nodes.filter(n => n.kind === 'document').length}</span>
              </div>
              <div className="flex justify-between">
                <span>Visible</span>
                <span className="font-mono">{visibleNodeCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Filtered links</span>
                <span className="font-mono">{visibleLinkCount}</span>
              </div>
            </div>
          </div>

          {/* Auto-refresh indicator */}
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <Clock className="w-3 h-3" />
              <span>Auto-refresh: 5 min</span>
            </div>
            {meta.generatedAt && (
              <div className="text-[11px] text-gray-400 mt-1">
                Vault generated: {new Date(meta.generatedAt).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
