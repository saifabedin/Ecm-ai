import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../utils/api.js'
import {
  FileText, RefreshCw, Send, PlusCircle, Loader2, AlertCircle,
  CheckCircle2, Clock, XCircle, FileCheck, DollarSign
} from 'lucide-react'

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  viewed: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
  accepted: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
}

const STATUS_ICONS = {
  draft: <Clock size={12} />,
  sent: <Send size={12} />,
  viewed: <FileText size={12} />,
  accepted: <CheckCircle2 size={12} />,
  rejected: <XCircle size={12} />,
}

export default function Documents() {
  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ leadId: '', kind: 'proposal', title: '', amount: '' })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch('/api/team/api/proposal/')
      setProposals(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const generate = async () => {
    if (!form.leadId) { alert('Enter a Lead ID'); return }
    setGenerating(true)
    try {
      await apiFetch('/api/team/api/proposal/generate', {
        method: 'POST',
        body: JSON.stringify({
          leadId: +form.leadId,
          kind: form.kind,
          title: form.title || undefined,
          amount: form.amount ? +form.amount : undefined,
        }),
      })
      setShowForm(false)
      setForm({ leadId: '', kind: 'proposal', title: '', amount: '' })
      await load()
    } catch (e) {
      alert(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const sendProposal = async (id) => {
    setSending(id)
    try {
      await apiFetch(`/api/team/api/proposal/${id}/send`, { method: 'POST' })
      await load()
    } catch (e) {
      alert(e.message)
    } finally {
      setSending(null)
    }
  }

  const fmt = (n) => n ? `₹${Number(n).toLocaleString('en-IN')}` : '—'
  const fmtDate = (s) => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText size={24} className="text-indigo-600" /> Documents
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            AI-generated proposals and documents
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
          >
            <PlusCircle size={16} /> Generate
          </button>
        </div>
      </div>

      {/* Generate form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
          <h2 className="font-medium text-gray-900 dark:text-white mb-4">Generate New Proposal</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Lead ID *</label>
              <input
                type="number"
                placeholder="Lead ID from CRM"
                value={form.leadId}
                onChange={e => setForm(f => ({ ...f, leadId: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Kind</label>
              <select
                value={form.kind}
                onChange={e => setForm(f => ({ ...f, kind: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              >
                <option value="proposal">Proposal</option>
                <option value="quote">Quote</option>
                <option value="contract">Contract</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Title (optional)</label>
              <input
                type="text"
                placeholder="Auto-generated if blank"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Amount (₹)</label>
              <input
                type="number"
                placeholder="e.g. 25000"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={generate}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 text-sm"
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <FileCheck size={14} />}
              {generating ? 'Generating…' : 'Generate with AI'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900">Cancel</button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm">
          <AlertCircle size={16} /> {error} — make sure ai-team gateway is running on port 4100
        </div>
      )}

      {/* Proposals list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" /> Loading documents…
        </div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p>No documents yet. Generate your first proposal.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {proposals.map(p => (
            <div key={p.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                <FileText size={18} className="text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-white truncate">
                  {p.title || `${p.kind} #${p.id}`}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span className="capitalize">{p.kind}</span>
                  <span>·</span>
                  <span>{fmtDate(p.created_at)}</span>
                  {p.amount && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-0.5">
                        <DollarSign size={10} /> {fmt(p.amount)}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || STATUS_COLORS.draft}`}>
                {STATUS_ICONS[p.status] || STATUS_ICONS.draft}
                {p.status || 'draft'}
              </span>
              {p.status === 'draft' && (
                <button
                  onClick={() => sendProposal(p.id)}
                  disabled={sending === p.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-60"
                >
                  {sending === p.id ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                  Send
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
