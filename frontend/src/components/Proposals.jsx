import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../utils/api.js'
import {
  FileText, Plus, Send, Download, RefreshCw, Search,
  CheckCircle2, Clock, XCircle, AlertCircle, ChevronLeft, ChevronRight
} from 'lucide-react'

const STATUS_COLORS = {
  draft:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
  sent:     'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  accepted: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
}

const STATUS_ICONS = {
  draft:    Clock,
  sent:     Send,
  accepted: CheckCircle2,
  rejected: XCircle,
}

const KIND_LABELS = {
  retainer: 'Retainer',
  project:  'Project',
  audit:    'Audit',
}

const LIMIT = 20

export default function Proposals() {
  const [proposals, setProposals] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [generating, setGenerating] = useState(false)
  const [sendingId, setSendingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', kind: 'retainer', amount: '', lead_id: '' })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset: page * LIMIT })
      const data = await apiFetch(`/api/team/api/proposal?${params}`)
      setProposals(Array.isArray(data) ? data : [])
      setTotal(Array.isArray(data) ? data.length : 0)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  const filtered = search
    ? proposals.filter(p =>
        (p.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.kind || '').toLowerCase().includes(search.toLowerCase())
      )
    : proposals

  const handleGenerate = async () => {
    if (!form.title) return
    setGenerating(true)
    try {
      await apiFetch('/api/team/api/proposal/generate', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          kind: form.kind,
          amount: parseFloat(form.amount) || 0,
          lead_id: parseInt(form.lead_id) || null,
        }),
      })
      setShowForm(false)
      setForm({ title: '', kind: 'retainer', amount: '', lead_id: '' })
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleSend = async (id) => {
    setSendingId(id)
    try {
      await apiFetch(`/api/team/api/proposal/${id}/send`, { method: 'POST' })
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSendingId(null)
    }
  }

  const handleDownloadPdf = (id) => {
    const token = localStorage.getItem('auth_token')
    window.open(`/api/team/api/proposal/${id}/pdf?token=${token}`, '_blank')
  }

  const pages = Math.ceil(total / LIMIT)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Proposals</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Generate and manage client proposals</p>
        </div>
        <div className="flex gap-3">
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5">
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors"
          >
            <Plus size={15} /> New Proposal
          </button>
        </div>
      </div>

      {/* Generate Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Generate Proposal</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Title</label>
                <input
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="e.g. Social Media Package - Acme Corp"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Kind</label>
                <select
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.kind}
                  onChange={e => setForm(f => ({ ...f, kind: e.target.value }))}
                >
                  <option value="retainer">Retainer</option>
                  <option value="project">Project</option>
                  <option value="audit">Audit</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount (INR)</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="e.g. 25000"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Lead ID (optional)</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Lead ID from CRM"
                  value={form.lead_id}
                  onChange={e => setForm(f => ({ ...f, lead_id: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || !form.title}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {generating ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                {generating ? 'Generating...' : 'Generate'}
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
          placeholder="Search proposals..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <RefreshCw size={20} className="animate-spin mr-2" /> Loading proposals...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
            <FileText size={32} className="opacity-30" />
            <span className="text-sm">No proposals yet. Generate your first one.</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 dark:border-gray-800">
              <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Kind</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Created</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filtered.map(p => {
                const Icon = STATUS_ICONS[p.status] || Clock
                return (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white max-w-xs truncate">
                      {p.title || '—'}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                      {KIND_LABELS[p.kind] || p.kind || '—'}
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                      {p.amount ? `₹${Number(p.amount).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600'}`}>
                        <Icon size={11} />
                        {p.status || 'draft'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-xs">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {p.pdf_path && (
                          <button
                            onClick={() => handleDownloadPdf(p.id)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
                          >
                            <Download size={12} /> PDF
                          </button>
                        )}
                        {p.status === 'draft' && (
                          <button
                            onClick={() => handleSend(p.id)}
                            disabled={sendingId === p.id}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
                          >
                            {sendingId === p.id
                              ? <RefreshCw size={12} className="animate-spin" />
                              : <Send size={12} />}
                            Send
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>Showing {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} of {total}</span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-white/5"
            >
              <ChevronLeft size={15} /> Prev
            </button>
            <button
              disabled={page >= pages - 1}
              onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-white/5"
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
