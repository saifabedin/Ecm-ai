import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../utils/api.js'
import {
  Target, Plus, Zap, RefreshCw, Search, AlertCircle,
  Globe, Upload, ChevronLeft, ChevronRight, Star, TrendingUp
} from 'lucide-react'

const GRADE_COLORS = {
  A: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  B: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  C: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
  D: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
}

const LIMIT = 20

export default function LeadIntel() {
  const [leads, setLeads] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [showSource, setShowSource] = useState(false)
  const [sourceForm, setSourceForm] = useState({ url: '', type: 'website' })
  const [sourcing, setSourcing] = useState(false)
  const [enrichingId, setEnrichingId] = useState(null)
  const [scoringId, setScoringId] = useState(null)
  const [running, setRunning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset: page * LIMIT })
      const data = await apiFetch(`/api/team/api/lead-intel/leads?${params}`)
      setLeads(data.leads || [])
      setTotal(data.total || 0)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  const filtered = search
    ? leads.filter(l =>
        (l.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.company || '').toLowerCase().includes(search.toLowerCase())
      )
    : leads

  const handleSource = async () => {
    setSourcing(true)
    try {
      await apiFetch('/api/team/api/lead-intel/source', {
        method: 'POST',
        body: JSON.stringify(sourceForm),
      })
      setShowSource(false)
      setSourceForm({ url: '', type: 'website' })
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSourcing(false)
    }
  }

  const handleEnrich = async (id) => {
    setEnrichingId(id)
    try {
      await apiFetch(`/api/team/api/lead-intel/leads/${id}/enrich`, { method: 'POST' })
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setEnrichingId(null)
    }
  }

  const handleScore = async (id) => {
    setScoringId(id)
    try {
      await apiFetch(`/api/team/api/lead-intel/leads/${id}/score`, { method: 'POST' })
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setScoringId(null)
    }
  }

  const handleRunAll = async () => {
    setRunning(true)
    try {
      await apiFetch('/api/team/api/lead-intel/run', { method: 'POST', body: JSON.stringify({}) })
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
    }
  }

  const pages = Math.ceil(total / LIMIT)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lead Intel</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Source, enrich and score leads automatically</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRunAll}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50"
          >
            {running ? <RefreshCw size={15} className="animate-spin" /> : <Zap size={15} />}
            Run Pipeline
          </button>
          <button
            onClick={() => setShowSource(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600"
          >
            <Plus size={15} /> Source Leads
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: total, icon: Target, color: 'text-blue-500' },
          { label: 'Grade A', value: leads.filter(l => l.grade === 'A').length, icon: Star, color: 'text-green-500' },
          { label: 'Enriched', value: leads.filter(l => l.enriched_at).length, icon: TrendingUp, color: 'text-purple-500' },
          { label: 'Scored', value: leads.filter(l => l.score).length, icon: Zap, color: 'text-yellow-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
              <Icon size={18} className={color} />
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">{value}</span>
          </div>
        ))}
      </div>

      {/* Source Modal */}
      {showSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Source New Leads</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Type</label>
                <select
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                  value={sourceForm.type}
                  onChange={e => setSourceForm(f => ({ ...f, type: e.target.value }))}
                >
                  <option value="website">Website</option>
                  <option value="google_maps">Google Maps</option>
                  <option value="linkedin">LinkedIn</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">URL</label>
                <input
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="https://..."
                  value={sourceForm.url}
                  onChange={e => setSourceForm(f => ({ ...f, url: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowSource(false)} className="flex-1 px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5">
                Cancel
              </button>
              <button
                onClick={handleSource}
                disabled={sourcing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {sourcing ? <RefreshCw size={14} className="animate-spin" /> : <Globe size={14} />}
                {sourcing ? 'Sourcing...' : 'Source'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Search leads..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <RefreshCw size={20} className="animate-spin mr-2" /> Loading leads...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
            <Target size={32} className="opacity-30" />
            <span className="text-sm">No leads yet. Source your first batch.</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 dark:border-gray-800">
              <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Grade</th>
                <th className="px-6 py-4">Score</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filtered.map(l => (
                <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{l.full_name || '—'}</td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{l.company || '—'}</td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs">{l.email || '—'}</td>
                  <td className="px-6 py-4">
                    {l.grade ? (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${GRADE_COLORS[l.grade] || 'bg-gray-100 text-gray-600'}`}>
                        {l.grade}
                      </span>
                    ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                  <td className="px-6 py-4 text-gray-700 dark:text-gray-300 font-semibold">
                    {l.score != null ? l.score : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEnrich(l.id)}
                        disabled={enrichingId === l.id}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50"
                      >
                        {enrichingId === l.id ? <RefreshCw size={11} className="animate-spin" /> : <Upload size={11} />}
                        Enrich
                      </button>
                      <button
                        onClick={() => handleScore(l.id)}
                        disabled={scoringId === l.id}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
                      >
                        {scoringId === l.id ? <RefreshCw size={11} className="animate-spin" /> : <Star size={11} />}
                        Score
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>Showing {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} of {total}</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-white/5">
              <ChevronLeft size={15} /> Prev
            </button>
            <button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-white/5">
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
