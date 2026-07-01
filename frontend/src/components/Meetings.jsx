import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../utils/api.js'
import {
  Calendar, Phone, CheckCircle2, RefreshCw, Search,
  AlertCircle, Clock, ChevronLeft, ChevronRight, Building2, User
} from 'lucide-react'

const STATUS_COLORS = {
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  confirmed: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  completed: 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
}

const LIMIT = 20

export default function Meetings() {
  const [meetings, setMeetings] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [confirmingId, setConfirmingId] = useState(null)
  const [callingId, setCallingId] = useState(null)
  const [callLeadId, setCallLeadId] = useState('')
  const [callPurpose, setCallPurpose] = useState('')
  const [showCallForm, setShowCallForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset: page * LIMIT })
      const data = await apiFetch(`/api/team/api/voice/meetings?${params}`)
      setMeetings(Array.isArray(data) ? data : [])
      setTotal(Array.isArray(data) ? data.length : 0)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  const filtered = search
    ? meetings.filter(m =>
        (m.lead_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (m.company || '').toLowerCase().includes(search.toLowerCase())
      )
    : meetings

  const handleConfirm = async (id) => {
    setConfirmingId(id)
    try {
      await apiFetch(`/api/team/api/voice/meetings/${id}/confirm`, { method: 'POST' })
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setConfirmingId(null)
    }
  }

  const handleCall = async () => {
    if (!callLeadId) return
    setCallingId(callLeadId)
    try {
      await apiFetch(`/api/team/api/voice/leads/${callLeadId}/call`, {
        method: 'POST',
        body: JSON.stringify({ purpose: callPurpose }),
      })
      setShowCallForm(false)
      setCallLeadId('')
      setCallPurpose('')
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setCallingId(null)
    }
  }

  const scheduled = meetings.filter(m => m.status === 'scheduled').length
  const confirmed = meetings.filter(m => m.status === 'confirmed').length
  const completed = meetings.filter(m => m.status === 'completed').length
  const pages = Math.ceil(total / LIMIT)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Meetings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Voice calls and booked meetings</p>
        </div>
        <div className="flex gap-3">
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5">
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            onClick={() => setShowCallForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600"
          >
            <Phone size={15} /> Call Lead
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Scheduled', value: scheduled, icon: Clock, color: 'text-blue-500' },
          { label: 'Confirmed', value: confirmed, icon: CheckCircle2, color: 'text-green-500' },
          { label: 'Completed', value: completed, icon: Calendar, color: 'text-gray-500' },
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

      {/* Call Modal */}
      {showCallForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Call a Lead</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Lead ID</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Lead ID from CRM"
                  value={callLeadId}
                  onChange={e => setCallLeadId(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Purpose</label>
                <input
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="e.g. Follow-up on proposal"
                  value={callPurpose}
                  onChange={e => setCallPurpose(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCallForm(false)} className="flex-1 px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5">
                Cancel
              </button>
              <button
                onClick={handleCall}
                disabled={!!callingId || !callLeadId}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {callingId ? <RefreshCw size={14} className="animate-spin" /> : <Phone size={14} />}
                {callingId ? 'Calling...' : 'Call Now'}
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
          placeholder="Search meetings..."
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
            <RefreshCw size={20} className="animate-spin mr-2" /> Loading meetings...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
            <Calendar size={32} className="opacity-30" />
            <span className="text-sm">No meetings yet.</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 dark:border-gray-800">
              <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-4">Lead</th>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Scheduled</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filtered.map(m => (
                <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-white">{m.lead_name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <Building2 size={13} className="text-gray-400" />
                      {m.company || '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs">
                    {m.scheduled_at ? new Date(m.scheduled_at).toLocaleString('en-IN') : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[m.status] || 'bg-gray-100 text-gray-600'}`}>
                      {m.status || 'scheduled'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {m.status === 'scheduled' && (
                      <button
                        onClick={() => handleConfirm(m.id)}
                        disabled={confirmingId === m.id}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
                      >
                        {confirmingId === m.id ? <RefreshCw size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                        Confirm
                      </button>
                    )}
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
