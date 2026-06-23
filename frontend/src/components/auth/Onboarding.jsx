// frontend/src/components/auth/Onboarding.jsx
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../utils/api.js'

const NICHES = [
  { id: 'dental',      label: 'Dental Clinic',           icon: '🦷' },
  { id: 'real_estate', label: 'Real Estate Agent',        icon: '🏠' },
  { id: 'agency',      label: 'Digital Marketing Agency', icon: '📣' },
  { id: 'general',     label: 'Other Business',           icon: '💼' },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [niche, setNiche] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [calLink, setCalLink] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleNicheNext() {
    if (!niche || !businessName.trim()) { setError('Select a niche and enter your business name'); return }
    setLoading(true); setError('')
    try {
      await apiFetch('/api/onboarding/niche', {
        method: 'POST',
        body: JSON.stringify({ niche, business_name: businessName }),
      })
      setStep(2)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleConnectionsNext() {
    setLoading(true); setError('')
    try {
      await apiFetch('/api/onboarding/connections', {
        method: 'POST',
        body: JSON.stringify({ whatsapp_number: whatsapp, cal_link: calLink }),
      })
      setStep(3)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleComplete() {
    setLoading(true); setError('')
    try {
      await apiFetch('/api/onboarding/complete', { method: 'POST' })
      navigate('/')
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-8">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {[1,2,3].map(s => (
            <div key={s} className={`flex-1 h-2 rounded-full ${step >= s ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
          ))}
        </div>

        {step === 1 && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Tell us about your business</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">We'll customize the AI for your industry.</p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Business Name</label>
              <input
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Dr. Sharma Dental Clinic"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {NICHES.map(n => (
                <button
                  key={n.id}
                  onClick={() => setNiche(n.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${niche === n.id ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
                >
                  <div className="text-2xl mb-1">{n.icon}</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{n.label}</div>
                </button>
              ))}
            </div>

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <button
              onClick={handleNicheNext}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Continue'}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Connect your tools</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">You can skip these and add them later in Settings.</p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">WhatsApp Business Number</label>
              <input
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+91 98765 43210"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">Your AI receptionist will respond on this number</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cal.com Booking Link (optional)</label>
              <input
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://cal.com/your-name"
                value={calLink}
                onChange={e => setCalLink(e.target.value)}
              />
            </div>

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold py-3 rounded-xl">Back</button>
              <button onClick={handleConnectionsNext} disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl disabled:opacity-50">
                {loading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Choose your plan</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Start with a 14-day free trial. No credit card needed.</p>

            <div className="space-y-3 mb-6">
              {[
                { name: 'Starter', price: '₹2,999/mo', features: ['AI Receptionist', '200 Leads/mo', 'WhatsApp + Calendar'] },
                { name: 'Growth',  price: '₹5,999/mo', features: ['Everything in Starter', '1,000 Leads/mo', 'CRM + Campaigns'] },
                { name: 'Pro',     price: '₹9,999/mo', features: ['Everything in Growth', 'Unlimited Leads', 'Video Studio + AI Team'] },
              ].map(plan => (
                <div key={plan.name} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-gray-900 dark:text-white">{plan.name}</span>
                    <span className="text-blue-600 font-bold">{plan.price}</span>
                  </div>
                  <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                    {plan.features.map(f => <li key={f}>✓ {f}</li>)}
                  </ul>
                </div>
              ))}
            </div>

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <button
              onClick={handleComplete}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
            >
              {loading ? 'Starting trial...' : 'Start Free Trial'}
            </button>
            <p className="text-center text-xs text-gray-400 mt-3">Upgrade or cancel anytime from Billing settings</p>
          </>
        )}
      </div>
    </div>
  )
}
