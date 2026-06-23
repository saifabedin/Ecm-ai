// frontend/src/components/admin/AdminPanel.jsx
import React, { useEffect, useState } from 'react'
import { apiFetch } from '../../utils/api.js'
import AdminUserRow from './AdminUserRow.jsx'

export default function AdminPanel() {
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [niche, setNiche] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/api/admin/stats').then(r => setStats(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page, limit: 20 })
    if (search) params.set('search', search)
    if (niche)  params.set('niche', niche)
    if (status) params.set('status', status)
    apiFetch(`/api/admin/users?${params}`)
      .then(r => { setUsers(r.data.users); setTotal(r.data.total) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, search, niche, status])

  function handleUpdate(tenantId, newStatus) {
    setUsers(prev => prev.map(u => u.tenant_id === tenantId ? { ...u, subscription_status: newStatus } : u))
  }

  const MRR = stats ? `₹${((stats.mrr || 0)).toLocaleString('en-IN')}` : '—'

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Admin Panel</h1>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Users',   value: stats.total_users },
            { label: 'Active',        value: stats.active_users },
            { label: 'Trials',        value: stats.trial_users },
            { label: 'MRR',           value: MRR },
          ].map(card => (
            <div key={card.label} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{card.label}</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Niche Breakdown */}
      {stats?.niche_breakdown?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Users by Niche</div>
          <div className="flex gap-4 flex-wrap">
            {stats.niche_breakdown.map(n => (
              <div key={n.niche} className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">{n.niche}</span>: {n.count}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-64"
          placeholder="Search name or email..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
        <select
          className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          value={niche} onChange={e => { setNiche(e.target.value); setPage(1) }}
        >
          <option value="">All Niches</option>
          <option value="dental">Dental</option>
          <option value="real_estate">Real Estate</option>
          <option value="agency">Agency</option>
          <option value="general">General</option>
        </select>
        <select
          className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
        >
          <option value="">All Statuses</option>
          <option value="trial">Trial</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="text-left py-3 px-4">Business</th>
                <th className="text-left py-3 px-4">Niche</th>
                <th className="text-left py-3 px-4">Plan</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">WhatsApp</th>
                <th className="text-left py-3 px-4">Onboarded</th>
                <th className="text-left py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <AdminUserRow key={u.id} user={u} onUpdate={handleUpdate} />
              ))}
              {users.length === 0 && (
                <tr><td colSpan="7" className="text-center py-8 text-gray-400 text-sm">No users found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
        <span>Showing {users.length} of {total}</span>
        <div className="flex gap-2">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border border-gray-200 dark:border-gray-600 rounded disabled:opacity-40">Prev</button>
          <button disabled={users.length < 20} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border border-gray-200 dark:border-gray-600 rounded disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  )
}
