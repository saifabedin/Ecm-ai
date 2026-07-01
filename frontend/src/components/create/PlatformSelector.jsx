import React from 'react'

/* Inline SVG icons for brand fidelity — same pattern as Discover.jsx */
const InstagramIcon = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2"/>
    <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/>
    <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/>
  </svg>
)

const TikTokIcon = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1 0-5.78c.29 0 .58.04.85.11V9a6.33 6.33 0 0 0-.85-.06 6.34 6.34 0 0 0 0 12.68 6.34 6.34 0 0 0 6.34-6.34V8.73a8.19 8.19 0 0 0 3.76.92V6.69Z"/>
  </svg>
)

const FacebookIcon = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z"/>
  </svg>
)

export const platforms = [
  { id: 'instagram', label: 'Instagram', icon: InstagramIcon, color: '#E4405F' },
  { id: 'tiktok', label: 'TikTok', icon: TikTokIcon, color: '#000000' },
  { id: 'facebook', label: 'Facebook', icon: FacebookIcon, color: '#1877F2' },
]

export default function PlatformSelector({ selected, onSelect }) {
  return (
    <div className="flex p-1 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-gray-800">
      {platforms.map(platform => {
        const Icon = platform.icon
        const isActive = selected === platform.id
        return (
          <button
            key={platform.id}
            onClick={() => onSelect(platform.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 flex-1 justify-center ${
              isActive
                ? 'bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Icon size={16} className={isActive ? 'text-brand-500' : ''} />
            {platform.label}
          </button>
        )
      })}
    </div>
  )
}
