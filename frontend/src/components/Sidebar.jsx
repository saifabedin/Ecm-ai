import React, { useState } from 'react'
import {
  Home,
  Megaphone,
  Users,
  FileText,
  MessageSquare,
  HelpCircle,
  ChevronDown,
  Network,
  Cpu,
  Zap,
  Calendar,
  Heart,
  Image,
  Video,
  Settings,
  Target,
  Shield,
  CreditCard,
  Link2,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useSidebar } from '../context/SidebarContext'
import { useAuth } from '../context/AuthContext'

const menuItems = [
  { label: 'Home', path: '/', icon: Home },
  {
    label: 'Sales AI',
    icon: Zap,
    children: [
      { label: 'Lead Intel', path: '/leads/intel' },
      { label: 'Research', path: '/research' },
      { label: 'Funnel', path: '/funnel' },
      { label: 'CRM', path: '/crm' },
      { label: 'Outreach', path: '/leads/outreach' },
      { label: 'Voice Calls', path: '/leads/voice' },
      { label: 'Meetings', path: '/meetings' },
      { label: 'Proposals', path: '/proposals' },
    ],
  },
  {
    label: 'Content & Ads',
    icon: Megaphone,
    children: [
      { label: 'Discover', path: '/content/discover' },
      { label: 'Create', path: '/content/create' },
      { label: 'Manage Ads', path: '/content/ads' },
      { label: 'Schedule', path: '/content/schedule' },
    ],
  },
  {
    label: 'Studio',
    icon: Image,
    children: [
      { label: 'Image Studio', path: '/studio/image' },
      { label: 'Video Studio', path: '/studio/video' },
    ],
  },
  { label: 'Client Success', path: '/clients', icon: Heart },
  { label: 'Autopilot', path: '/autopilot', icon: Target },
  { label: 'Documents', path: '/documents', icon: FileText },
  { label: 'AI Team', path: '/ai-team', icon: Cpu },
  { label: 'Knowledge Graph', path: '/knowledge-graph', icon: Network },
  { label: 'Chat', path: '/chat', icon: MessageSquare },
  { label: 'Help Center', path: '/help', icon: HelpCircle },
  { label: 'Billing', path: '/billing', icon: CreditCard },
  { label: 'Connections', path: '/connections', icon: Link2 },
  { label: 'Settings', path: '/settings', icon: Settings },
]

export default function Sidebar() {
  const { isCollapsed } = useSidebar()
  const location = useLocation()
  const { user } = useAuth()

  // Track which groups are open by their label key
  const [openGroups, setOpenGroups] = useState({ 'Sales AI': true, 'Content & Ads': false, 'Studio': false })

  const toggleGroup = (label) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <aside 
      className={`fixed left-0 top-0 bottom-0 flex flex-col border-r border-gray-200 bg-white p-6 transition-all duration-300 dark:border-gray-800 dark:bg-gray-900 z-50 ${isCollapsed ? 'w-[90px]' : 'w-[290px]'}`}
    >
      <div className={`mb-10 flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'}`}>
        <span className="text-2xl font-bold text-gray-900 dark:text-white">
          {isCollapsed ? 'F' : 'FixMyLeads'}
        </span>
      </div>

      <div className={`mb-4 text-xs font-semibold tracking-wider text-gray-400 uppercase ${isCollapsed ? 'text-center' : ''}`}>
        {isCollapsed ? '·' : 'MENU'}
      </div>

      <nav className="flex flex-col gap-1.5 flex-1 overflow-y-auto no-scrollbar">
        {menuItems.map((item, idx) => {
          const Icon = item.icon
          const hasChildren = !!item.children
          const isGroupOpen = openGroups[item.label]
          const isGroupActive = hasChildren && item.children.some(c => location.pathname === c.path)
          const isActive = !hasChildren && location.pathname === item.path

          const rowClass = `flex items-center rounded-lg text-sm font-medium transition-colors w-full text-left ${
            isCollapsed ? 'justify-center p-3' : 'px-4 py-3 gap-3'
          } ${
            isActive || isGroupActive
              ? 'bg-brand-50 text-brand-500 dark:bg-brand-500/10'
              : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/[0.03]'
          }`

          return (
            <div key={idx} className="flex flex-col gap-1">
              {/* Parent row — button for groups, Link for regular items */}
              {hasChildren ? (
                <button
                  onClick={() => !isCollapsed && toggleGroup(item.label)}
                  className={rowClass}
                >
                  <Icon size={20} strokeWidth={2} className="shrink-0" />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      <ChevronDown
                        size={15}
                        className={`text-gray-400 transition-transform duration-200 ${isGroupOpen ? 'rotate-180' : ''}`}
                      />
                    </>
                  )}
                </button>
              ) : (
                <Link to={item.path} className={rowClass}>
                  <Icon size={20} strokeWidth={2} className="shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              )}

              {/* Children — animate open/close */}
              {!isCollapsed && hasChildren && (
                <div
                  className={`ml-9 flex flex-col gap-1 mt-1 overflow-hidden transition-all duration-200 ${
                    isGroupOpen ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  {item.children.map((child, cIdx) => (
                    <Link
                      key={cIdx}
                      to={child.path}
                      className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        location.pathname === child.path
                          ? 'text-brand-500 bg-brand-50/50 dark:bg-brand-500/5'
                          : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/[0.03]'
                      }`}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Admin Panel — super admins only */}
        {user?.is_super_admin && (
          <Link
            to="/admin"
            className={`flex items-center rounded-lg text-sm font-medium transition-colors w-full text-left ${
              isCollapsed ? 'justify-center p-3' : 'px-4 py-3 gap-3'
            } ${
              location.pathname === '/admin'
                ? 'bg-brand-50 text-brand-500 dark:bg-brand-500/10'
                : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/[0.03]'
            }`}
          >
            <Shield size={20} strokeWidth={2} className="shrink-0" />
            {!isCollapsed && <span>Admin Panel</span>}
          </Link>
        )}
      </nav>

      {!isCollapsed && (
        <div className="mt-6 rounded-2xl bg-gray-50 p-6 dark:bg-white/[0.03]">
          <div className="mb-2 text-sm font-bold text-gray-900 dark:text-white">FixMyLeads Intelligence</div>
          <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            AI-powered sales automation and lead management platform.
          </p>
        </div>
      )}
    </aside>
  )
}
