import React from 'react'
import { ThumbsUp, MessageCircle, Share2, MoreHorizontal, Globe } from 'lucide-react'

export default function FacebookPreview({ content, caption, onCaptionChange }) {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950">
      {/* FB Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center">
          <span className="text-[10px] font-bold text-white">BS</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-gray-900 dark:text-white leading-none">{content.clinicName || 'BrightSmile Dental'}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <p className="text-[9px] text-gray-400">Just now</p>
            <span className="text-[9px] text-gray-400">·</span>
            <Globe size={8} className="text-gray-400" />
          </div>
        </div>
        <MoreHorizontal size={14} className="text-gray-400 shrink-0" />
      </div>

      {/* FB Caption — editable */}
      <div className="px-3 pt-2.5 pb-2">
        <div
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onCaptionChange(e.currentTarget.textContent)}
          className="text-[11px] text-gray-800 dark:text-gray-200 leading-relaxed outline-none min-h-[2.5rem] cursor-text focus:bg-brand-50/30 dark:focus:bg-brand-500/5 rounded px-0.5 -mx-0.5"
        >
          {caption}
        </div>
        {content.hashtags && (
          <p className="text-[10px] text-brand-500 mt-1">{content.hashtags}</p>
        )}
      </div>

      {/* FB Image Area */}
      <div className="aspect-video bg-gradient-to-br from-brand-500/15 via-blue-500/10 to-indigo-500/15 dark:from-brand-500/10 dark:via-blue-500/5 dark:to-indigo-500/10 flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-sm font-bold text-gray-800 dark:text-white leading-snug">{content.hook || 'Your content preview'}</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2">{content.cta || ''}</p>
        </div>
      </div>

      {/* FB Reactions Row */}
      <div className="px-3 pt-2 pb-1.5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div className="flex -space-x-1">
              <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-[7px] text-white">👍</span>
              <span className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-[7px] text-white">❤️</span>
            </div>
            <span className="text-[9px] text-gray-500 ml-1">824</span>
          </div>
          <span className="text-[9px] text-gray-400">142 comments · 56 shares</span>
        </div>
      </div>

      {/* FB Action Buttons */}
      <div className="flex items-center justify-around px-2 py-2 flex-shrink-0">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-white/5">
          <ThumbsUp size={14} className="text-gray-500" />
          <span className="text-[10px] font-semibold text-gray-500">Like</span>
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-white/5">
          <MessageCircle size={14} className="text-gray-500" />
          <span className="text-[10px] font-semibold text-gray-500">Comment</span>
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-white/5">
          <Share2 size={14} className="text-gray-500" />
          <span className="text-[10px] font-semibold text-gray-500">Share</span>
        </button>
      </div>
    </div>
  )
}
