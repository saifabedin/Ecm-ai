import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../utils/api.js'
import {
  Phone, RefreshCw, CheckCircle2, Clock, AlertCircle,
  Loader2, Calendar, ExternalLink, Building2, Mail
} from 'lucide-react'

const STATUS_COLORS = {
  booked: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  confirmed: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  completed: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  cancelled: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400',
}

function fmtDatetime(s) {
  if (!s) return '—'
  return new Date(s).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  })
}

export default function VoiceCalls() {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [calling, setCalling] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch('/api/team/api/voice/meetings')
      setMeetings(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const confirm = async (id) => {
    setConfirming(id)
    try {
      await apiFetch(`/api/team/api/voice/meetings/${id}/confirm`, { method: 'POST' })
      await load()
    } catch (e) {
      alert(e.message)
    } finally {
      setConfirming(null)
    }
  }

  const callLead = async (leadId) => {
    setCalling(leadId)
    try {
      await apiFetch(`/api/team/api/voice/leads/${leadId}/call`, {
        method: 'POST',
        body: JSON.stringify({ purpose: 'qualification' }),
      })
      alert('Voice call initiated!')
    } catch (e) {
      alert(e.message)
    } finally {
      setCalling(null)
    }
  }

  const upcoming = meetings.filter(m => m.status === 'booked' || m.status === 'confirmed')
  const past = meetings.filter(m => m.status === 'completed' || m.status === 'cancelled')

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Phone size={24} className="text-indigo-600" /> Voice Calls
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {upcoming.length} upcoming · {past.length} past
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm">
          <AlertCircle size={16} /> {error} — make sure ai-team gateway is running on port 4100
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" /> Loading meetings…
        </div>
      ) : meetings.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Phone size={40} className="mx-auto mb-3 opacity-30" />
          <p>No meetings yet. Book meetings from the CRM or Outreach page.</p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="mb-6">
              <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Calendar size={16} className="text-indigo-600" /> Upcoming ({upcoming.length})
              </h2>
              <div className="grid gap-3">
                {upcoming.map(m => (
                  <div key={m.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {m.lead_name || `Lead #${m.lead_id}`}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[m.status] || ''}`}>
                            {m.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                          {m.company && (
                            <span className="flex items-center gap-1.5">
                              <Building2 size={13} /> {m.company}
                            </span>
                          )}
                          <span className="flex items-center gap-1.5">
                            <Clock size={13} /> {fmtDatetime(m.scheduled_at)}
                          </span>
                          {m.channel && <span className="uppercase text-xs font-medium">{m.channel}</span>}
                        </div>
                        {m.notes && <p className="mt-2 text-xs text-gray-400">{m.notes}</p>}
                      </div>
                      <div className="flex gap-2">
                        {m.link && (
                          <a
                            href={m.link}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <ExternalLink size={11} /> Join
                          </a>
                        )}
                        {m.status === 'booked' && (
                          <button
                            onClick={() => confirm(m.id)}
                            disabled={confirming === m.id}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-60"
                          >
                            {confirming === m.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                            Confirm
                          </button>
                        )}
                        <button
                          onClick={() => callLead(m.lead_id)}
                          disabled={calling === m.lead_id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {calling === m.lead_id ? <Loader2 size={11} className="animate-spin" /> : <Phone size={11} />}
                          Call
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                Past Meetings ({past.length})
              </h2>
              <div className="grid gap-3">
                {past.map(m => (
                  <div key={m.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 opacity-70">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{m.lead_name || `Lead #${m.lead_id}`}</span>
                        {m.company && <span className="ml-2 text-sm text-gray-400">{m.company}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">{fmtDatetime(m.scheduled_at)}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[m.status] || ''}`}>
                          {m.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
