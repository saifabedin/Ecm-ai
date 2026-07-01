import React, { useState } from 'react'
import { apiFetch } from '../utils/api.js'
import { Settings as SettingsIcon, User, Key, Bell, Shield, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'

const TABS = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'api', label: 'API Keys', icon: Key },
  { key: 'notifications', label: 'Notifications', icon: Bell },
]

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState(null)

  // Profile
  const [name, setName] = useState(localStorage.getItem('user_name') || '')
  const [email, setEmail] = useState(localStorage.getItem('user_email') || '')

  // Security
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')

  // API
  const [n8nWebhook, setN8nWebhook] = useState(localStorage.getItem('n8n_webhook') || '')
  const [bookingLink, setBookingLink] = useState(localStorage.getItem('booking_link') || '')

  const notify = (msg, isError = false) => {
    if (isError) setError(msg)
    else setSuccess(msg)
    setTimeout(() => { setSuccess(null); setError(null) }, 3000)
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      localStorage.setItem('user_name', name)
      localStorage.setItem('user_email', email)
      notify('Profile saved successfully')
    } catch (e) {
      notify(e.message, true)
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPwd !== confirmPwd) return notify('Passwords do not match', true)
    if (newPwd.length < 8) return notify('Password must be at least 8 characters', true)
    setSaving(true)
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      })
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
      notify('Password changed successfully')
    } catch (e) {
      notify(e.message, true)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveApi = () => {
    localStorage.setItem('n8n_webhook', n8nWebhook)
    localStorage.setItem('booking_link', bookingLink)
    notify('Settings saved')
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your account and platform configuration</p>
      </div>

      {/* Notification */}
      {(success || error) && (
        <div className={`flex items-center gap-2 p-4 rounded-xl text-sm ${
          success ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
        }`}>
          {success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {success || error}
        </div>
      )}

      <div className="flex gap-6">
        {/* Tabs */}
        <div className="w-48 shrink-0 space-y-1">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-left transition-colors ${
                  activeTab === tab.key
                    ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                <Icon size={16} /> {tab.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-6">

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Profile Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Name</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Email</label>
                  <input
                    type="email"
                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Platform</label>
                <div className="mt-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm text-gray-500 dark:text-gray-400">
                  FixMyLeads — AI Sales Platform
                </div>
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Save Profile
              </button>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Change Password</h2>
              <div className="space-y-4 max-w-sm">
                {[
                  { label: 'Current Password', value: currentPwd, setter: setCurrentPwd },
                  { label: 'New Password', value: newPwd, setter: setNewPwd },
                  { label: 'Confirm New Password', value: confirmPwd, setter: setConfirmPwd },
                ].map(({ label, value, setter }) => (
                  <div key={label}>
                    <label className="text-xs font-medium text-gray-500 uppercase">{label}</label>
                    <input
                      type="password"
                      className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                      value={value}
                      onChange={e => setter(e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={handleChangePassword}
                disabled={saving || !currentPwd || !newPwd || !confirmPwd}
                className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Shield size={14} />}
                Change Password
              </button>
            </div>
          )}

          {/* API Keys Tab */}
          {activeTab === 'api' && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Integrations & Config</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">n8n Webhook Base URL</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                    placeholder="http://localhost:5678/webhook"
                    value={n8nWebhook}
                    onChange={e => setN8nWebhook(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Booking Link (Cal.com)</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="https://cal.com/your-link"
                    value={bookingLink}
                    onChange={e => setBookingLink(e.target.value)}
                  />
                </div>
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  <div className="font-medium text-gray-700 dark:text-gray-300">API Keys are managed server-side via .env</div>
                  <div>OpenRouter, Replicate, OpenAI, Facebook, xAI keys are set in the server environment.</div>
                </div>
              </div>
              <button
                onClick={handleSaveApi}
                className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600"
              >
                <CheckCircle2 size={14} /> Save Config
              </button>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notification Preferences</h2>
              <div className="space-y-4">
                {[
                  { label: 'New lead sourced', desc: 'When scout finds new leads' },
                  { label: 'Meeting booked', desc: 'When a prospect books a meeting' },
                  { label: 'Proposal accepted', desc: 'When a client accepts a proposal' },
                  { label: 'Job completed', desc: 'When a pipeline job finishes' },
                  { label: 'System health alerts', desc: 'When services go down' },
                ].map(({ label, desc }) => (
                  <div key={label} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{label}</div>
                      <div className="text-xs text-gray-400">{desc}</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-10 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-brand-500 dark:bg-gray-700 rounded-full peer peer-checked:bg-brand-500 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
