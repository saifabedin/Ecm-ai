import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../utils/api.js'
import {
  Send, RefreshCw, Play, Pause, AlertCircle, Loader2,
  Mail, MessageSquare, Clock, CheckCircle2, User
} from 'lucide-react'

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'paused', label: 'Paused' },
  { key: 'done', label: 'Done' },
]

const CHANNEL_ICONS = {
  email: <Mail size={13} />,
  whatsapp: <MessageSquare size={13} className="text-green-600" />,
  linkedin: <MessageSquare size={13} className="text-blue-600" />,
}

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
  done: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  const now = new Date()
  const diffMs = d - now
  const diffH = Math.round(diffMs / 3600000)
  if (Math.abs(diffH) < 1) return 'Now'
  if (diffH > 0 && diffH < 24) return `in ${diffH}h`
  if (diffH < 0 && diffH > -24) return `${Math.abs(diffH)}h ago`
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export default function Outreach() {
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('')
  const [running, setRunning] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: 50 })
      if (status) params.set('status', status)
      const data = await apiFetch(`/api/team/api/sdr/enrollments?${params}`)
      setEnrollments(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => { load() }, [load])

  const runStep = async (id) => {
    setRunning(id)
    try {
      await apiFetch(`/api/team/api/sdr/enrollments/${id}/run`, { method: 'POST' })
      await load()
    } catch (e) {
      alert(e.message)
    } finally {
      setRunning(null)
    }
  }

  const bookMeeting = async (leadId) => {
    try {
      await apiFetch(`/api/team/api/sdr/leads/${leadId}/book`, {
        method: 'POST',
        body: JSON.stringify({ notes: 'Booked from Outreach dashboard' }),
      })
      await load()
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Send size={24} className="text-indigo-600" /> Outreach
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            SDR sequences — {enrollments.length} enrollment{enrollments.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
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

      {error && (
        <div className="mb-4 flex items-center gap-2 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm">
          <AlertCircle size={16} /> {error} — make sure ai-team gateway is running on port 4100
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" /> Loading enrollments…
        </div>
      ) : enrollments.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Send size={40} className="mx-auto mb-3 opacity-30" />
          <p>No enrollments. Go to CRM and enroll leads in a sequence.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Lead</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Sequence</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Step</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Next Run</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map(e => (
                  <tr key={e.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{e.lead_name || `Lead #${e.lead_id}`}</div>
                      {e.company && <div className="text-xs text-gray-400">{e.company}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {e.sequence_name || `Seq #${e.sequence_id}`}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900 dark:text-white">Step {e.current_step}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[e.status] || STATUS_COLORS.done}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Clock size={12} />
                        <span className="text-xs">{fmtDate(e.next_run_at)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {e.status === 'active' && (
                          <>
                            <button
                              onClick={() => runStep(e.id)}
                              disabled={running === e.id}
                              title="Run next step now"
                              className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-60"
                            >
                              {running === e.id ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                              Run Step
                            </button>
                            <button
                              onClick={() => bookMeeting(e.lead_id)}
                              title="Book meeting"
                              className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              Book
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
