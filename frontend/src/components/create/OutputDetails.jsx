import React, { useState } from 'react'
import { FileText, Zap, Type, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react'

function CollapsibleSection({ icon: Icon, iconColor, title, children, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-5 py-4 text-left hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Icon size={15} className={iconColor} />
          <span className="text-sm font-bold text-gray-900 dark:text-white">{title}</span>
        </div>
        {isOpen
          ? <ChevronUp size={16} className="text-gray-400" />
          : <ChevronDown size={16} className="text-gray-400" />
        }
      </button>
      {isOpen && (
        <div className="px-5 pb-5 pt-0">
          {children}
        </div>
      )}
    </div>
  )
}

export default function OutputDetails({ content }) {
  if (!content) return null

  return (
    <div className="space-y-4">
      {/* Script Breakdown */}
      <CollapsibleSection icon={FileText} iconColor="text-brand-500" title="Script Breakdown" defaultOpen={true}>
        <div className="space-y-3">
          <div className="rounded-xl bg-gray-50 dark:bg-white/[0.03] p-4 border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={12} className="text-amber-500" />
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hook</span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{content.hook}</p>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-white/[0.03] p-4 border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <Type size={12} className="text-blue-500" />
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Body</span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{content.body}</p>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-white/[0.03] p-4 border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb size={12} className="text-emerald-500" />
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">CTA</span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{content.cta}</p>
          </div>
        </div>
      </CollapsibleSection>

      {/* Full Caption */}
      <CollapsibleSection icon={Type} iconColor="text-violet-500" title="Full Caption" defaultOpen={false}>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          {content.caption}
        </p>
        {content.hashtags && (
          <p className="text-sm text-brand-500 mt-2 leading-relaxed">{content.hashtags}</p>
        )}
      </CollapsibleSection>

      {/* Hook Variations */}
      <CollapsibleSection icon={Zap} iconColor="text-amber-500" title="Hook Variations" defaultOpen={false}>
        <div className="space-y-2.5">
          {(content.hookVariations || []).map((hook, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] p-4 border border-gray-100 dark:border-gray-800"
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-[10px] font-bold text-brand-500">{i + 1}</span>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{hook}</p>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  )
}
