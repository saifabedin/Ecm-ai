import React from 'react'
import { Sparkles } from 'lucide-react'

export default function PromptEditor({ value, onChange }) {
  return (
    <div>
      <label className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-brand-500" />
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">AI Prompt</span>
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-500 resize-none leading-relaxed custom-scrollbar"
        placeholder="Describe the content you want to create..."
      />
      <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
        Be specific about your service, audience, and desired outcome for best results.
      </p>
    </div>
  )
}
