import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../utils/api.js'
import {
  Cpu, RefreshCw, AlertCircle, Loader2, TrendingUp,
  Users, Send, Phone, FileText, Sparkles, Star, Activity
} from 'lucide-react'

const AGENTS = [
  { key: 'scout', label: 'Scout', desc: 'Lead Intelligence', icon: Users, color: 'blue' },
  { key: 'nova', label: 'Nova', desc: 'SDR / Outreach', icon: Send, color: 'purple' },
  { key: 'vox', label: 'Vox', desc: 'Voice & Meetings', icon: Phone, color: 'green' },
  { key: 'quill', label: 'Quill', desc: 'Proposals', icon: FileText, color: 'yellow' },
  { key: 'muse', label: 'Muse', desc: 'Content', icon: Sparkles, color: 'pink' },
  { key: 'sage', label: 'Sage', desc: 'Client Success', icon: Star, color: 'orange' },
]

const COLOR_CLASSES = {
  blue:   { bg: 'bg-blue-50 dark:bg-blue-500/10',   text: 'text-blue-600 dark:text-blue-400',   dot: 'bg-blue-500' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500' },
  green:  { bg: 'bg-green-50 dark:bg-green-500/10',  text: 'text-green-600 dark:text-green-400',  dot: 'bg-green-500' },
  yellow: { bg: 'bg-yellow-50 dark:bg-yellow-500/10', text: 'text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-500' },
  pink:   { bg: 'bg-pink-50 dark:bg-pink-500/10',    text: 'text-pink-600 dark:text-pink-400',    dot: 'bg-pink-500' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
}

export default function AITeam() {
  const [overview, setOverview] = useState(null)
  const [agentStats, setAgentStats] = useState(null)
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ov, ag, fd] = await Promise.all([
        apiFetch('/api/team/api/dashboard/overview'),
        apiFetch('/api/team/api/dashboard/agents'),
        apiFetch('/api/team/api/dashboard/feed?limit=10'),
      ])
      setOverview(ov)
      setAgentStats(ag)
      setFeed(Array.isArray(fd) ? fd : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const o = overview || {}

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Cpu size={24} className="text-indigo-600" /> AI Team
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">6 autonomous agents running your sales pipeline</p>
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

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Leads', value: o.totalLeads },
          { label: 'Active Enrollments', value: o.activeEnrollments },
          { label: 'Meetings Booked', value: o.meetingsBooked },
          { label: 'Proposals Sent', value: o.proposalsSent },
        ].map(card => (
          <div key={card.label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">{card.label}</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {loading ? '—' : (card.value ?? '—')}
            </div>
          </div>
        ))}
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {AGENTS.map(agent => {
          const c = COLOR_CLASSES[agent.color]
          const stat = agentStats?.[agent.key] || {}
          const Icon = agent.icon
          return (
            <div key={agent.key} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
                  <Icon size={18} className={c.text} />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">{agent.label}</div>
                  <div className="text-xs text-gray-400">{agent.desc}</div>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${c.dot} animate-pulse`} />
                  <span className="text-xs text-gray-400">Online</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                {stat.tasks !== undefined && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">{stat.tasks}</div>
                    <div className="text-xs text-gray-400">Tasks</div>
                  </div>
                )}
                {stat.success !== undefined && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">{stat.success}%</div>
                    <div className="text-xs text-gray-400">Success</div>
                  </div>
                )}
              </div>
              {(!stat.tasks && !stat.success) && (
                <div className="text-center py-2 text-xs text-gray-400">
                  {loading ? 'Loading…' : 'No stats yet'}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Activity feed */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Activity size={16} className="text-indigo-600" /> Recent Activity
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading…
          </div>
        ) : feed.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {feed.map((item, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    {item.description || item.action || item.type || JSON.stringify(item)}
                  </div>
                  {item.created_at && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      {new Date(item.created_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', month: 'short', day: '2-digit' })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
