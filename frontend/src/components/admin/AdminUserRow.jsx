// frontend/src/components/admin/AdminUserRow.jsx
import React, { useState } from 'react'
import { apiFetch } from '../../utils/api.js'

const STATUS_COLORS = {
  active:    'bg-green-100 text-green-700',
  trial:     'bg-yellow-100 text-yellow-700',
  suspended: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
}

const NICHE_LABELS = {
  dental:      '🦷 Dental',
  real_estate: '🏠 Real Estate',
  agency:      '📣 Agency',
  general:     '💼 General',
}

export default function AdminUserRow({ user, onUpdate }) {
  const [loading, setLoading] = useState(false)

  async function toggleStatus(newStatus) {
    setLoading(true)
    try {
      await apiFetch(`/api/admin/tenants/${user.tenant_id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
      onUpdate(user.tenant_id, newStatus)
    } catch (e) { alert(e.message) }
    finally { setLoading(false) }
  }

  return (
    <tr className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
      <td className="py-3 px-4">
        <div className="font-medium text-gray-900 dark:text-white text-sm">{user.business_name || user.name}</div>
        <div className="text-xs text-gray-400">{user.email}</div>
      </td>
      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{NICHE_LABELS[user.niche] || '—'}</td>
      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 uppercase">{user.plan_id}</td>
      <td className="py-3 px-4">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[user.subscription_status] || 'bg-gray-100 text-gray-600'}`}>
          {user.subscription_status}
        </span>
      </td>
      <td className="py-3 px-4 text-xs text-gray-400">{user.whatsapp_number || '—'}</td>
      <td className="py-3 px-4 text-xs text-gray-400">{user.onboarding_complete ? '✅' : '⏳'}</td>
      <td className="py-3 px-4">
        <select
          disabled={loading}
          value={user.subscription_status}
          onChange={e => toggleStatus(e.target.value)}
          className="text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50"
        >
          <option value="trial">Trial</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </td>
    </tr>
  )
}
