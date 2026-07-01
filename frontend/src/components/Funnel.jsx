import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../utils/api.js'
import { Filter, RefreshCw, TrendingUp, Users, Calendar, Zap, AlertCircle } from 'lucide-react'

const STAGES = [
  { key: 'new',       label: 'New Leads',      color: 'bg-blue-500',   text: 'text-blue-600 dark:text-blue-400',   iconBg: 'bg-blue-50 dark:bg-blue-500/10',   iconText: 'text-blue-600' },
  { key: 'contacted', label: 'Contacted',      color: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-400', iconBg: 'bg-yellow-50 dark:bg-yellow-500/10', iconText: 'text-yellow-600' },
  { key: 'engaged',   label: 'Engaged',        color: 'bg-purple-500', text: 'text-purple-600 dark:text-purple-400', iconBg: 'bg-purple-50 dark:bg-purple-500/10', iconText: 'text-purple-600' },
  { key: 'meeting',   label: 'Meeting Booked', color: 'bg-indigo-500', text: 'text-indigo-600 dark:text-indigo-400', iconBg: 'bg-indigo-50 dark:bg-indigo-500/10', iconText: 'text-indigo-600' },
  { key: 'won',       label: 'Won',            color: 'bg-green-500',  text: 'text-green-600 dark:text-green-400',  iconBg: 'bg-green-50 dark:bg-green-500/10',  iconText: 'text-green-600' },
  { key: 'lost',      label: 'Lost',           color: 'bg-red-500',    text: 'text-red-600 dark:text-red-400',     iconBg: 'bg-red-50 dark:bg-red-500/10',     iconText: 'text-red-600' },
]

async function fetchCount(status) {
  const data = await apiFetch(`/api/team/api/lead-intel/leads?limit=1&offset=0${status ? `&status=${status}` : ''}`)
  return data.total || 0
}

export default function Funnel() {
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const results = await Promise.all(
        STAGES.map(s => fetchCount(s.key).then(n => [s.key, n]))
      )
      setCounts(Object.fromEntries(results))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1
  const activeTotal = (counts.new || 0) + (counts.contacted || 0) + (counts.engaged || 0) + (counts.meeting || 0)
  const winRate = counts.won ? ((counts.won / (counts.won + (counts.lost || 0))) * 100).toFixed(1) : '0'
  const convRate = counts.won ? ((counts.won / (total - (counts.lost || 0))) * 100).toFixed(1) : '0'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Filter size={24} className="text-indigo-600" /> Funnel
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Live sales pipeline overview</p>
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

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Leads', value: total, icon: Users, iconBg: 'bg-indigo-50 dark:bg-indigo-500/10', iconText: 'text-indigo-600' },
          { label: 'Active Pipeline', value: activeTotal, icon: Zap, iconBg: 'bg-purple-50 dark:bg-purple-500/10', iconText: 'text-purple-600' },
          { label: 'Win Rate', value: `${winRate}%`, icon: TrendingUp, iconBg: 'bg-green-50 dark:bg-green-500/10', iconText: 'text-green-600' },
          { label: 'Conversion', value: `${convRate}%`, icon: Calendar, iconBg: 'bg-blue-50 dark:bg-blue-500/10', iconText: 'text-blue-600' },
        ].map(card => (
          <div key={card.label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">{card.label}</span>
              <div className={`w-8 h-8 rounded-lg ${card.iconBg} flex items-center justify-center`}>
                <card.icon size={15} className={card.iconText} />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {loading ? '—' : card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Funnel bars */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-5">Pipeline Stages</h2>
        <div className="space-y-4">
          {STAGES.map((stage, i) => {
            const count = counts[stage.key] || 0
            const pct = loading ? 0 : (count / total) * 100
            const prevCount = i === 0 ? total : (counts[STAGES[i - 1]?.key] || 0)
            const dropRate = prevCount > 0 && i > 0 ? (((prevCount - count) / prevCount) * 100).toFixed(0) : null
            return (
              <div key={stage.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{stage.label}</span>
                    {dropRate && +dropRate > 0 && (
                      <span className="text-xs text-gray-400">↓ {dropRate}% drop</span>
                    )}
                  </div>
                  <span className={`text-sm font-bold ${stage.text}`}>
                    {loading ? '…' : count}
                  </span>
                </div>
                <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                  <div
                    className={`h-full ${stage.color} rounded-lg transition-all duration-700 flex items-center pl-3`}
                    style={{ width: loading ? '0%' : `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
                  >
                    {pct > 8 && <span className="text-white text-xs font-medium">{pct.toFixed(1)}%</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Stage-to-stage table */}
      {!loading && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <th className="text-left px-5 py-3 font-medium text-gray-500">Stage</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500">Count</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {STAGES.map(stage => (
                <tr key={stage.key} className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="px-5 py-3">
                    <span className={`font-medium ${stage.text}`}>{stage.label}</span>
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-gray-900 dark:text-white">
                    {counts[stage.key] || 0}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-500">
                    {(((counts[stage.key] || 0) / total) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
