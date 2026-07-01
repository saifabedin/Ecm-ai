import React, { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Dialog({ isOpen, onClose, title, children }) {
  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      {/* Dialog Content */}
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-gray-200 bg-white p-0 shadow-2xl animate-in zoom-in-95 duration-200 dark:border-gray-800 dark:bg-gray-900 transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-6 dark:border-gray-800">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
          <button 
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:hover:bg-white/5 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Content Body */}
        <div className="p-8 max-h-[80vh] overflow-y-auto no-scrollbar">
          {children}
        </div>
      </div>
    </div>
  )
}
