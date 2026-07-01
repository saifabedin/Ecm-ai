import React, { useState, useEffect, useRef } from 'react'
import { apiFetch } from '../utils/api.js'
import {
  Zap, Play, Square, RefreshCw, AlertCircle,
  CheckCircle2, Clock, Activity, Settings
} from 'lucide-react'

const JOB_TYPES = ['research', 'content', 'image', 'video', 'publish', 'ads', 'tracking', 'optimization']

export default function Autopilot() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [jobType, setJobType] = useState('research')
  const [jobInput, setJobInput] = useState('{"topic": "AI sales automation for Indian SMBs"}')
  const [submitting, setSubmitting] = useState(false)
  const [lastJobId, setLastJobId] = useState(null)
  const [jobResult, setJobResult] = useState(null)
  const [polling, setPolling] = useState(false)
  const pollIntervalRef = useRef(null)

  useEffect(() => () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current) }, [])

  const checkHealth = async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/health')
      setStatus(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { checkHealth() }, [])

  const handleRunJob = async () => {
    setSubmitting(true)
    setError(null)
    setJobResult(null)
    try {
      const input = JSON.parse(jobInput)
      const data = await apiFetch('/api/orchestrator', {
        method: 'POST',
        body: JSON.stringify({ jobType, ...input }),
      })
      setLastJobId(data.jobId)
      pollJob(data.jobId)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const pollJob = (jobId) => {
    setPolling(true)
    let attempts = 0
    pollIntervalRef.current = setInterval(async () => {
      attempts++
      try {
        const data = await apiFetch(`/api/jobs/${jobId}`)
        if (data.state === 'completed' || data.state === 'failed' || attempts > 30) {
          setJobResult(data)
          setPolling(false)
          clearInterval(pollIntervalRef.current)
        }
      } catch {
        if (attempts > 30) {
          setPolling(false)
          clearInterval(pollIntervalRef.current)
        }
      }
    }, 3000)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Autopilot</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Trigger and monitor AI pipeline jobs</p>
        </div>
        <button
          onClick={checkHealth}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* System Health */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Activity size={18} className="text-brand-500" />
          <h2 className="font-semibold text-gray-900 dark:text-white">System Status</h2>
        </div>
        {status ? (
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              {status.status === 'healthy' ? 'All systems operational' : status.status}
            </span>
            <span className="text-xs text-gray-400">{status.service} · v{status.version}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <RefreshCw size={14} className="animate-spin" /> Checking...
          </div>
        )}
      </div>

      {/* Job Runner */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Settings size={18} className="text-brand-500" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Run Pipeline Job</h2>
        </div>

        <div className="space-y-4">
          <div className="max-w-xs">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Job Type</label>
            <select
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
              value={jobType}
              onChange={e => setJobType(e.target.value)}
            >
              {JOB_TYPES.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Job Input (JSON)</label>
            <textarea
              rows={4}
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm font-mono text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              value={jobInput}
              onChange={e => setJobInput(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={handleRunJob}
          disabled={submitting || polling}
          className="flex items-center gap-2 px-6 py-2.5 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 font-medium"
        >
          {submitting ? <RefreshCw size={15} className="animate-spin" /> : <Play size={15} />}
          {submitting ? 'Submitting...' : 'Run Job'}
        </button>

        {error && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}
      </div>

      {/* Job Status */}
      {(lastJobId || polling) && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Clock size={18} className="text-brand-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Job Status</h2>
            {polling && <span className="text-xs text-gray-400 flex items-center gap-1"><RefreshCw size={11} className="animate-spin" /> Polling...</span>}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-gray-400">{lastJobId}</span>
            {jobResult && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                jobResult.state === 'completed'
                  ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
              }`}>
                {jobResult.state === 'completed' ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                {jobResult.state}
              </span>
            )}
          </div>

          {jobResult?.result && (
            <pre className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-xs font-mono text-gray-700 dark:text-gray-300 overflow-auto max-h-60">
              {JSON.stringify(jobResult.result, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Pipeline Overview */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <div className="flex items-center gap-3 mb-5">
          <Zap size={18} className="text-brand-500" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Pipeline Engines</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { name: 'Engine 1', label: 'Research', desc: 'Market research & insights' },
            { name: 'Engine 2', label: 'Content', desc: 'AI content generation' },
            { name: 'Engine 3', label: 'Image', desc: 'AI image creation' },
            { name: 'Engine 4', label: 'Video', desc: 'Video production' },
            { name: 'Engine 5', label: 'Publish', desc: 'Multi-platform publishing' },
            { name: 'Engine 6', label: 'Ads', desc: 'Meta & Google ad campaigns' },
            { name: 'Engine 7', label: 'Tracking', desc: 'Performance analytics' },
            { name: 'Engine 8', label: 'Optimization', desc: 'AI-driven optimization' },
          ].map(e => (
            <div key={e.name} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
                <Zap size={14} className="text-brand-500" />
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-900 dark:text-white">{e.label} <span className="text-gray-400 font-normal">({e.name})</span></div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{e.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
