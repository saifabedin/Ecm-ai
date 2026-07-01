import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../utils/api.js'
import {
  Users, Search, RefreshCw, UserPlus, ChevronLeft, ChevronRight,
  Star, Phone, Mail, Building2, TrendingUp, Circle, CheckCircle2,
  XCircle, Clock, Calendar, Zap
} from 'lucide-react'

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'engaged', label: 'Engaged' },
  { key: 'meeting', label: 'Meeting' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
]

const STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  contacted: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
  engaged: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
  meeting: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400',
  won: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  lost: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
}

const GRADE_COLORS = {
  A: 'text-green-600 dark:text-green-400',
  B: 'text-blue-600 dark:text-blue-400',
  C: 'text-yellow-600 dark:text-yellow-400',
  D: 'text-red-500 dark:text-red-400',
}

export default function CRM() {
  const [leads, setLeads] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [enrolling, setEnrolling] = useState(null)
  const [enriching, setEnriching] = useState(null)
  const LIMIT = 20

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset: page * LIMIT })
      if (status) params.set('status', status)
      const data = await apiFetch(`/api/team/api/lead-intel/leads?${params}`)
      setLeads(data.leads || [])
      setTotal(data.total || 0)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [status, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [status])

  const filtered = search
    ? leads.filter(l =>
        (l.full_name || l.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.company || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.email || '').toLowerCase().includes(search.toLowerCase())
      )
    : leads

  const handleEnroll = async (lead) => {
    setEnrolling(lead.id)
    try {
      await apiFetch('/api/team/api/sdr/enroll', {
        method: 'POST',
        body: JSON.stringify({ leadId: lead.id }),
      })
      await load()
    } catch (e) {
      alert(e.message)
    } finally {
      setEnrolling(null)
    }
  }

  const handleEnrich = async (lead) => {
    setEnriching(lead.id)
    try {
      await apiFetch(`/api/team/api/lead-intel/leads/${lead.id}/enrich`, { method: 'POST' })
      await load()
    } catch (e) {
      alert(e.message)
    } finally {
      setEnriching(null)
    }
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users size={24} className="text-indigo-600" /> CRM
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {total} leads total
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              status === t.key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, company, email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm">
          {error} — make sure ai-team gateway is running on port 4100
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Lead</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Company</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Grade</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Contact</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
                    Loading leads…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    No leads found
                  </td>
                </tr>
              )}
              {!loading && filtered.map(lead => (
                <tr key={lead.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{lead.full_name || lead.name || '—'}</div>
                    {lead.title && <div className="text-xs text-gray-400">{lead.title}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                      <Building2 size={13} className="text-gray-400" />
                      {lead.company || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[lead.status] || 'bg-gray-100 text-gray-600'}`}>
                      {lead.status || 'new'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-lg font-bold ${GRADE_COLORS[lead.grade] || 'text-gray-400'}`}>
                      {lead.grade || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {lead.email && (
                        <a href={`mailto:${lead.email}`} className="text-gray-400 hover:text-indigo-600">
                          <Mail size={14} />
                        </a>
                      )}
                      {lead.phone && (
                        <a href={`tel:${lead.phone}`} className="text-gray-400 hover:text-green-600">
                          <Phone size={14} />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEnrich(lead)}
                        disabled={enriching === lead.id}
                        title="Enrich with AI"
                        className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                      >
                        {enriching === lead.id ? <RefreshCw size={11} className="animate-spin" /> : <TrendingUp size={11} />}
                      </button>
                      {!['won', 'lost', 'meeting'].includes(lead.status) && (
                        <button
                          onClick={() => handleEnroll(lead)}
                          disabled={enrolling === lead.id}
                          title="Enroll in sequence"
                          className="px-2.5 py-1 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                        >
                          {enrolling === lead.id ? <RefreshCw size={11} className="animate-spin" /> : <Zap size={11} />}
                          Enroll
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-500">
              Page {page + 1} of {totalPages} · {total} leads
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
