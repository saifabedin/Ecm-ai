import React from 'react'
import { Heart, MessageCircle, Share2, Bookmark, Music } from 'lucide-react'

export default function TikTokPreview({ content, caption, onCaptionChange }) {
  return (
    <div className="flex flex-col h-full bg-black relative overflow-hidden">
      {/* Full-screen background */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900/20 via-transparent to-gray-950/90" />
      
      {/* Content Area */}
      <div className="absolute inset-0 flex items-center justify-center px-8">
        <div className="text-center">
          <p className="text-sm font-bold text-white leading-snug drop-shadow-lg">{content.hook || 'Your content preview'}</p>
          <p className="text-[10px] text-white/70 mt-3">{content.cta || ''}</p>
        </div>
      </div>

      {/* Right side actions */}
      <div className="absolute right-2.5 bottom-24 flex flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <Heart size={16} className="text-white" />
          </div>
          <span className="text-[9px] font-semibold text-white">12.4K</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <MessageCircle size={16} className="text-white" />
          </div>
          <span className="text-[9px] font-semibold text-white">843</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <Bookmark size={16} className="text-white" />
          </div>
          <span className="text-[9px] font-semibold text-white">2.1K</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <Share2 size={16} className="text-white" />
          </div>
          <span className="text-[9px] font-semibold text-white">Share</span>
        </div>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 px-3 pb-4 pt-8 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-[8px] font-bold text-white">BS</span>
          </div>
          <span className="text-[11px] font-bold text-white">@{(content.clinicName || 'brightsmile').toLowerCase().replace(/\s+/g, '')}</span>
          <span className="text-[9px] px-2 py-0.5 rounded-md border border-white/30 text-white font-semibold">Follow</span>
        </div>
        <div
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onCaptionChange(e.currentTarget.textContent)}
          className="text-[10px] text-white/90 leading-relaxed outline-none min-h-[1.5rem] cursor-text"
        >
          {caption}
        </div>
        {content.hashtags && (
          <p className="text-[10px] text-white/60 mt-1">{content.hashtags}</p>
        )}
        <div className="flex items-center gap-1.5 mt-2">
          <Music size={10} className="text-white/60" />
          <p className="text-[9px] text-white/60">Original audio — {content.clinicName || 'BrightSmile Dental'}</p>
        </div>
      </div>
    </div>
  )
}
