import React from 'react'
import InstagramPreview from './InstagramPreview'
import TikTokPreview from './TikTokPreview'
import FacebookPreview from './FacebookPreview'

export default function PhoneMockup({ platform, content, caption, onCaptionChange }) {
  const PreviewComponent = {
    instagram: InstagramPreview,
    tiktok: TikTokPreview,
    facebook: FacebookPreview,
  }[platform]

  const isTikTok = platform === 'tiktok'

  return (
    <div className="flex justify-center py-4">
      {/* Phone frame — built with Card/div + Tailwind, no external libs */}
      <div className={`relative rounded-[2.5rem] border-[3px] border-gray-300 dark:border-gray-600 bg-gray-300 dark:bg-gray-600 shadow-xl overflow-hidden ${
        isTikTok ? 'w-[260px]' : 'w-[280px]'
      }`}>
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-gray-300 dark:bg-gray-600 rounded-b-2xl z-20" />
        
        {/* Screen */}
        <div className={`${isTikTok ? 'aspect-[9/17.5]' : 'aspect-[9/16]'} m-[3px] rounded-[2.2rem] overflow-hidden bg-white dark:bg-gray-950`}>
          {/* Status bar */}
          <div className={`flex items-center justify-between px-5 pt-2 pb-1 ${
            isTikTok ? 'bg-black' : 'bg-white dark:bg-gray-950'
          }`}>
            <span className={`text-[9px] font-bold ${isTikTok ? 'text-white' : 'text-gray-900 dark:text-white'}`}>9:41</span>
            <div className="flex items-center gap-1">
              <div className={`w-3 h-1.5 rounded-sm ${isTikTok ? 'bg-white/60' : 'bg-gray-400'}`} />
              <div className={`w-3 h-1.5 rounded-sm ${isTikTok ? 'bg-white/60' : 'bg-gray-400'}`} />
              <div className={`w-4 h-2 rounded-sm border ${isTikTok ? 'border-white/60' : 'border-gray-400'}`}>
                <div className={`w-2.5 h-full rounded-sm ${isTikTok ? 'bg-white/60' : 'bg-gray-400'}`} />
              </div>
            </div>
          </div>

          {/* Platform preview content */}
          <div className="flex-1 h-[calc(100%-28px)] overflow-hidden">
            {PreviewComponent && (
              <PreviewComponent
                content={content}
                caption={caption}
                onCaptionChange={onCaptionChange}
              />
            )}
          </div>
        </div>

        {/* Home indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 rounded-full bg-gray-400 dark:bg-gray-500 z-20" />
      </div>
    </div>
  )
}
