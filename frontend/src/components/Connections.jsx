// frontend/src/components/Connections.jsx
import React, { useEffect, useState } from 'react'
import { apiFetch } from '../utils/api.js'

export default function Connections() {
  const [whatsapp, setWhatsapp] = useState('')
  const [calLink, setCalLink] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiFetch('/api/onboarding/status').then(r => {
      setWhatsapp(r.data.whatsapp_number || '')
      setCalLink(r.data.cal_link || '')
    }).finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true); setSaved(false)
    try {
      await apiFetch('/api/onboarding/connections', {
        method: 'POST',
        body: JSON.stringify({ whatsapp_number: whatsapp, cal_link: calLink }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  if (loading) return <div className="p-6 text-gray-400">Loading...</div>

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Connections</h1>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">WhatsApp Business Number</label>
          <input
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="+91 98765 43210"
            value={whatsapp}
            onChange={e => setWhatsapp(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">Your AI receptionist answers on this number</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cal.com Booking Link</label>
          <input
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://cal.com/your-name"
            value={calLink}
            onChange={e => setCalLink(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">Appointments will be booked on this link</p>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? '✅ Saved!' : 'Save Connections'}
        </button>
      </div>
    </div>
  )
}
