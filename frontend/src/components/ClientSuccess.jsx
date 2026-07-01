import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../utils/api.js'
import {
  Heart, UserPlus, TrendingUp, RefreshCw, Search,
  AlertCircle, CheckCircle2, ChevronLeft, ChevronRight,
  Building2, Mail, ArrowUpRight
} from 'lucide-react'

const LIMIT = 20

export default function ClientSuccess() {
  const [clients, setClients] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [showOnboard, setShowOnboard] = useState(false)
  const [onboardForm, setOnboardForm] = useState({ lead_id: '', notes: '' })
  const [onboarding, setOnboarding] = useState(false)
  const [upsellId, setUpsellId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset: page * LIMIT })
      const data = await apiFetch(`/api/team/api/success/clients?${params}`)
      setClients(Array.isArray(data) ? data : [])
      setTotal(Array.isArray(data) ? data.length : 0)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  const filtered = search
    ? clients.filter(c =>
        (c.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.company || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(search.toLowerCase())
      )
    : clients

  const handleOnboard = async () => {
    if (!onboardForm.lead_id) return
    setOnboarding(true)
    try {
      await apiFetch('/api/team/api/success/onboard', {
        method: 'POST',
        body: JSON.stringify({ lead_id: parseInt(onboardForm.lead_id), notes: onboardForm.notes }),
      })
      setShowOnboard(false)
      setOnboardForm({ lead_id: '', notes: '' })
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setOnboarding(false)
    }
  }

  const handleUpsell = async (id) => {
    setUpsellId(id)
    try {
      await apiFetch(`/api/team/api/success/clients/${id}/upsell`, { method: 'POST' })
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setUpsellId(null)
    }
  }

  const pages = Math.ceil(total / LIMIT)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Client Success</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Onboard clients and drive upsells</p>
        </div>
        <div className="flex gap-3">
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5">
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            onClick={() => setShowOnboard(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600"
          >
            <UserPlus size={15} /> Onboard Client
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Clients', value: total, icon: Heart, color: 'text-pink-500' },
          { label: 'Active', value: clients.filter(c => c.status === 'active').length, icon: CheckCircle2, color: 'text-green-500' },
          { label: 'Upsell Candidates', value: clients.filter(c => c.upsell_ready).length, icon: TrendingUp, color: 'text-blue-500' },
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

      {/* Onboard Modal */}
      {showOnboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Onboard Client</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Lead ID</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Lead ID from CRM"
                  value={onboardForm.lead_id}
                  onChange={e => setOnboardForm(f => ({ ...f, lead_id: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Notes</label>
                <textarea
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  placeholder="Onboarding notes..."
                  value={onboardForm.notes}
                  onChange={e => setOnboardForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowOnboard(false)} className="flex-1 px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5">
                Cancel
              </button>
              <button
                onClick={handleOnboard}
                disabled={onboarding || !onboardForm.lead_id}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {onboarding ? <RefreshCw size={14} className="animate-spin" /> : <UserPlus size={14} />}
                {onboarding ? 'Onboarding...' : 'Onboard'}
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
          placeholder="Search clients..."
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
            <RefreshCw size={20} className="animate-spin mr-2" /> Loading clients...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
            <Heart size={32} className="opacity-30" />
            <span className="text-sm">No clients yet. Onboard your first client.</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 dark:border-gray-800">
              <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Onboarded</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{c.full_name || '—'}</td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1"><Building2 size={13} className="text-gray-400" />{c.company || '—'}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs">
                    <div className="flex items-center gap-1"><Mail size={12} className="text-gray-400" />{c.email || '—'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${c.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400'}`}>
                      {c.status || 'active'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-xs">
                    {c.onboarded_at ? new Date(c.onboarded_at).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleUpsell(c.id)}
                      disabled={upsellId === c.id}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
                    >
                      {upsellId === c.id ? <RefreshCw size={11} className="animate-spin" /> : <ArrowUpRight size={11} />}
                      Upsell
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>Page {page + 1} of {pages}</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40">
              <ChevronLeft size={15} /> Prev
            </button>
            <button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40">
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
