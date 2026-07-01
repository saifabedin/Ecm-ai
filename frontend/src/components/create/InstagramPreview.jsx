import React from 'react'
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from 'lucide-react'

export default function InstagramPreview({ content, caption, onCaptionChange }) {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950">
      {/* IG Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 p-[2px]">
          <div className="w-full h-full rounded-full bg-white dark:bg-gray-950 flex items-center justify-center">
            <span className="text-[8px] font-bold text-gray-700 dark:text-gray-300">BS</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-gray-900 dark:text-white leading-none">{content.clinicName || 'brightsmile_dental'}</p>
          <p className="text-[9px] text-gray-400 mt-0.5">{content.location || 'Los Angeles, CA'}</p>
        </div>
        <MoreHorizontal size={14} className="text-gray-500 shrink-0" />
      </div>

      {/* IG Image */}
      <div className="aspect-square bg-gradient-to-br from-brand-500/20 via-purple-500/10 to-pink-500/20 dark:from-brand-500/10 dark:via-purple-500/5 dark:to-pink-500/10 flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-sm font-bold text-gray-800 dark:text-white leading-snug">{content.hook || 'Your content preview'}</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2">{content.cta || ''}</p>
        </div>
      </div>

      {/* IG Action Row */}
      <div className="px-3 pt-2.5 pb-1.5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3.5">
            <Heart size={18} className="text-gray-800 dark:text-white" />
            <MessageCircle size={18} className="text-gray-800 dark:text-white" />
            <Send size={18} className="text-gray-800 dark:text-white" />
          </div>
          <Bookmark size={18} className="text-gray-800 dark:text-white" />
        </div>
        <p className="text-[10px] font-bold text-gray-900 dark:text-white mb-1">1,247 likes</p>
      </div>

      {/* IG Caption — editable */}
      <div className="px-3 pb-3 flex-1 overflow-y-auto no-scrollbar">
        <div className="flex gap-1.5">
          <span className="text-[10px] font-bold text-gray-900 dark:text-white shrink-0">{(content.clinicName || 'brightsmile').toLowerCase().replace(/\s+/g, '')}</span>
          <div
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => onCaptionChange(e.currentTarget.textContent)}
            className="text-[10px] text-gray-700 dark:text-gray-300 leading-relaxed outline-none flex-1 min-h-[2rem] cursor-text focus:bg-brand-50/30 dark:focus:bg-brand-500/5 rounded px-0.5 -mx-0.5"
          >
            {caption}
          </div>
        </div>
        {content.hashtags && (
          <p className="text-[10px] text-brand-500 mt-1.5 leading-relaxed">{content.hashtags}</p>
        )}
      </div>
    </div>
  )
}
