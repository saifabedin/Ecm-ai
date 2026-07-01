import React, { useState } from 'react'
import { apiFetch } from '../utils/api.js'
import {
  Search, Play, Loader2, Building2, User, Mail, Phone,
  Globe, Star, CheckCircle2, AlertCircle, Zap, RefreshCw
} from 'lucide-react'

const SOURCES = [
  { key: 'gmaps', label: 'Google Maps', desc: 'Local businesses by query' },
  { key: 'linkedin', label: 'LinkedIn', desc: 'Professional profiles' },
  { key: 'directory', label: 'Directory', desc: 'Business directories' },
  { key: 'web', label: 'Website', desc: 'Single website URL' },
]

const GRADE_COLORS = {
  A: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  B: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  C: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
  D: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
}

export default function Research() {
  const [source, setSource] = useState('gmaps')
  const [query, setQuery] = useState('')
  const [url, setUrl] = useState('')
  const [limit, setLimit] = useState(5)
  const [inline, setInline] = useState(true)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const run = async () => {
    if (!query && source !== 'web') { setError('Enter a search query'); return }
    if (source === 'web' && !url) { setError('Enter a website URL'); return }
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const body = { source, limit, inline }
      if (source === 'web') body.url = url
      else body.query = query
      const data = await apiFetch('/api/team/api/lead-intel/run', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
    }
  }

  const enroll = async (leadId) => {
    try {
      await apiFetch('/api/team/api/sdr/enroll', {
        method: 'POST',
        body: JSON.stringify({ leadId }),
      })
      alert('Enrolled in outreach sequence!')
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Search size={24} className="text-indigo-600" /> Research
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          AI-powered lead sourcing — find, enrich, and score leads automatically
        </p>
      </div>

      {/* Search form */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        {/* Source selector */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {SOURCES.map(s => (
            <button
              key={s.key}
              onClick={() => setSource(s.key)}
              className={`p-3 rounded-xl border-2 text-left transition-colors ${
                source === s.key
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <div className={`text-sm font-medium ${source === s.key ? 'text-indigo-700 dark:text-indigo-400' : 'text-gray-900 dark:text-white'}`}>
                {s.label}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
            </button>
          ))}
        </div>

        {source === 'web' ? (
          <input
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={e => setUrl(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
          />
        ) : (
          <input
            type="text"
            placeholder={source === 'gmaps' ? 'e.g. dental clinics in Mumbai' : 'e.g. marketing managers in Delhi'}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && run()}
            className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
          />
        )}

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">Leads:</label>
            <select
              value={limit}
              onChange={e => setLimit(+e.target.value)}
              className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              {[3, 5, 10, 20].map(n => <option key={n}>{n}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={inline}
              onChange={e => setInline(e.target.checked)}
              className="rounded"
            />
            Enrich & score inline
          </label>
          <button
            onClick={run}
            disabled={running}
            className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-60 font-medium text-sm"
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {running ? 'Running…' : 'Run Research'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={18} className="text-green-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Found {result.sourced || result.leads?.length || 0} leads
              {result.enriched !== undefined && ` · ${result.enriched} enriched`}
              {result.scored !== undefined && ` · ${result.scored} scored`}
            </span>
          </div>

          <div className="grid gap-4">
            {(result.leads || []).map(lead => (
              <div key={lead.id || lead.email} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {lead.name || lead.full_name || '—'}
                      </div>
                      {lead.grade && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${GRADE_COLORS[lead.grade] || ''}`}>
                          {lead.grade}
                        </span>
                      )}
                      {lead.score && (
                        <span className="text-xs text-gray-400">Score: {lead.score}</span>
                      )}
                    </div>
                    {lead.title && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">{lead.title}</div>
                    )}
                    <div className="flex flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-300">
                      {(lead.company || lead.company_name) && (
                        <span className="flex items-center gap-1.5">
                          <Building2 size={13} className="text-gray-400" />
                          {lead.company || lead.company_name}
                        </span>
                      )}
                      {lead.email && (
                        <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:underline">
                          <Mail size={13} /> {lead.email}
                        </a>
                      )}
                      {lead.phone && (
                        <span className="flex items-center gap-1.5">
                          <Phone size={13} className="text-gray-400" /> {lead.phone}
                        </span>
                      )}
                      {lead.website && (
                        <a href={lead.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-indigo-600 hover:underline">
                          <Globe size={13} /> Website
                        </a>
                      )}
                    </div>
                    {lead.summary && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{lead.summary}</p>
                    )}
                    {lead.pain_points && lead.pain_points.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {lead.pain_points.slice(0, 3).map((p, i) => (
                          <span key={i} className="px-2 py-0.5 bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 text-xs rounded-full">{p}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {lead.id && (
                    <button
                      onClick={() => enroll(lead.id)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 whitespace-nowrap"
                    >
                      <Zap size={12} /> Enroll
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
