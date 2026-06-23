// frontend/src/components/Billing.jsx
import React, { useEffect, useState } from 'react'
import { apiFetch } from '../utils/api.js'

export default function Billing() {
  const [billing, setBilling] = useState(null)
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      apiFetch('/api/billing/status'),
      apiFetch('/api/billing/plans'),
    ]).then(([b, p]) => {
      setBilling(b.data)
      setPlans(p.data)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6 text-gray-400">Loading billing info...</div>

  const trialDaysLeft = billing?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(billing.trial_ends_at) - Date.now()) / 86400000))
    : 0

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Billing & Plan</h1>

      {/* Current Plan Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm mb-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Current Plan</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">{billing?.plan_name || 'Starter'}</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">₹{billing?.price_monthly?.toLocaleString('en-IN')}/mo</div>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${
            billing?.subscription_status === 'active'  ? 'bg-green-100 text-green-700' :
            billing?.subscription_status === 'trial'   ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {billing?.subscription_status === 'trial'
              ? `Trial — ${trialDaysLeft} days left`
              : billing?.subscription_status}
          </span>
        </div>

        {billing?.features && (
          <ul className="mt-4 text-sm text-gray-600 dark:text-gray-400 space-y-1">
            {Object.entries(billing.features).map(([k, v]) => (
              <li key={k}>✓ {k.replace(/_/g, ' ')}: {v === true ? 'Yes' : v === -1 ? 'Unlimited' : v}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Upgrade Plans */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Upgrade Plan</h2>
      <div className="space-y-3">
        {plans.filter(p => p.plan_id !== billing?.plan_id).map(plan => (
          <div key={plan.plan_id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div>
              <div className="font-semibold text-gray-900 dark:text-white">{plan.name}</div>
              <div className="text-sm text-blue-600 font-bold">₹{plan.price_monthly.toLocaleString('en-IN')}/mo</div>
            </div>
            <button
              onClick={() => window.alert('Razorpay checkout will open here — integrate with createSubscription API')}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg font-medium"
            >
              Upgrade
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
