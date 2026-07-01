import React, { useState, useCallback, useMemo, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  GripVertical,
  Image as ImageIcon,
  Plus,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  Settings2,
  Sparkles,
  Trash2,
  X,
  Info
} from 'lucide-react'
import Dialog from '../common/Dialog'
import { apiFetch } from '../../utils/api.js'

/* ─── Platform Icons (same inline SVGs used across dashboard) ─── */
const InstagramIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2"/>
    <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/>
    <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/>
  </svg>
)
const TikTokIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1 0-5.78c.29 0 .58.04.85.11V9a6.33 6.33 0 0 0-.85-.06 6.34 6.34 0 0 0 0 12.68 6.34 6.34 0 0 0 6.34-6.34V8.73a8.19 8.19 0 0 0 3.76.92V6.69Z"/>
  </svg>
)
const FacebookIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z"/>
  </svg>
)

const platformMap = {
  instagram: { icon: InstagramIcon, label: 'Instagram', color: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-500/10' },
  tiktok:    { icon: TikTokIcon,    label: 'TikTok',    color: 'text-gray-700 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-white/5' },
  facebook:  { icon: FacebookIcon,  label: 'Facebook',  color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
}

/* ─── Helpers ─── */
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()
  const cells = []
  // Previous month tail
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, inMonth: false })
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true })
  }
  // Next month head — fill to complete rows
  const remaining = 42 - cells.length
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, inMonth: false })
  }
  return cells
}

function dateKey(y, m, d) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` }

/* ─── Mock Data ─── */
const today = new Date()

/* ═══════════════════════════════════════════════════════════════════════ */

export default function ContentCalendar() {
  /* ─── State ─── */
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [scheduledPosts, setScheduledPosts] = useState(initialScheduled)
  const [drafts, setDrafts] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [draggedDraft, setDraggedDraft] = useState(null)
  const [detailPost, setDetailPost] = useState(null)
  const [detailDraft, setDetailDraft] = useState(null)

  // Schedule form state
  const [scheduleForm, setScheduleForm] = useState({
    platform: 'instagram',
    time: '10:00',
    caption: '',
  })

  // Frequency settings
  const [postsPerWeek, setPostsPerWeek] = useState(5)
  const [dailyPosting, setDailyPosting] = useState(false)

  /* ─── Calendar data ─── */
  const calendarCells = useMemo(() => getCalendarDays(currentYear, currentMonth), [currentYear, currentMonth])

  const postsForDate = useCallback((dk) => {
    return scheduledPosts.filter(p => p.date === dk)
  }, [scheduledPosts])

  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate())
  const tomorrowKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate() + 1)

  /* ─── Week count for frequency ─── */
  const totalPostsThisMonth = scheduledPosts.filter(p => p.date.startsWith(`${currentYear}-${String(currentMonth+1).padStart(2,'0')}`)).length
  const weeksInMonth = Math.ceil(new Date(currentYear, currentMonth + 1, 0).getDate() / 7)
  const targetPosts = postsPerWeek * weeksInMonth
  const isBelowTarget = totalPostsThisMonth < targetPosts
  const tomorrowPosts = postsForDate(tomorrowKey)

  /* ─── Data loading ─── */
useEffect(() => {
const loadScheduledPosts = async () => {
try {
const result = await apiFetch('/api/scheduled-posts');
const loadedScheduledPosts = result.scheduledPosts.map(post => ({
id: post.id,
platform: post.platform,
time: post.scheduled_time,
caption: post.caption,
date: post.scheduled_date
}));
setScheduledPosts(loadedScheduledPosts);
} catch (err) {
console.error('Failed to load scheduled posts:', err);
}
};
loadScheduledPosts();
}, []);

useEffect(() => {
const loadDrafts = async () => {
try {
const result = await apiFetch('/api/drafts');
const loadedDrafts = result.drafts.map(draft => ({
id: draft.id,
caption: draft.caption,
platform: draft.platform,
}));
setDrafts(loadedDrafts);
} catch (err) {
console.error('Failed to load drafts:', err);
}
};
loadDrafts();
}, []);

/* ─── Navigation ─── */
  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
    else setCurrentMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
    else setCurrentMonth(m => m + 1)
  }
  const goToToday = () => { setCurrentMonth(today.getMonth()); setCurrentYear(today.getFullYear()) }

  /* ─── Drag & Drop ─── */
  const handleDragStart = (draft) => { setDraggedDraft(draft) }
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  const handleDrop = (e, dk) => {
    e.preventDefault()
    if (!draggedDraft) return
    setSelectedDate(dk)
    setScheduleForm({ platform: draggedDraft.platform, time: '10:00', caption: draggedDraft.caption })
    setModalOpen(true)
  }
  const handleDragEnd = () => { setDraggedDraft(null) }

  /* ─── Cell click → open scheduler ─── */
  const handleCellClick = (dk) => {
    setSelectedDate(dk)
    setScheduleForm({ platform: 'instagram', time: '10:00', caption: '' })
    setModalOpen(true)
  }

  /* ─── Schedule post ─── */
  const handleSchedule = async () => {
    const timeHour = parseInt(scheduleForm.time.split(':')[0])
    const ampm = timeHour >= 12 ? 'PM' : 'AM'
    const displayHour = timeHour > 12 ? timeHour - 12 : (timeHour === 0 ? 12 : timeHour)
    const mins = scheduleForm.time.split(':')[1]

    // Prepare data for backend
    const scheduledPost = {
      platform: scheduleForm.platform,
      caption: scheduleForm.caption,
      scheduled_date: selectedDate,
      scheduled_time: scheduleForm.time,
      status: 'scheduled'
    };

try {
const result = await apiFetch('/api/scheduled-posts', {
method: 'POST',
body: JSON.stringify({ scheduledPost }),
});
if (result.success) {
const newPost = {
id: result.id,
platform: scheduleForm.platform,
time: `${displayHour}:${mins} ${ampm}`,
caption: scheduleForm.caption,
date: selectedDate,
}
setScheduledPosts(prev => [...prev, newPost])
if (draggedDraft) {
setDrafts(prev => prev.filter(d => d.id !== draggedDraft.id))
setDraggedDraft(null)
}
setModalOpen(false)
}
} catch (err) {
console.error('Failed to save scheduled post:', err);
}
  }

  /* ─── Delete scheduled post ─── */
const handleDeletePost = async (postId) => {
try {
await apiFetch(`/api/scheduled-posts/${postId}`, { method: 'DELETE' });
setScheduledPosts(prev => prev.filter(p => p.id !== postId));
setDetailPost(null);
} catch (err) {
console.error('Failed to delete scheduled post:', err);
}
}

  /* ─── Shared style tokens ─── */
  const inputClass = "h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-500"
  const selectClass = "h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:focus:border-brand-500 appearance-none cursor-pointer"

  return (
    <div className="p-6 lg:p-10 transition-colors">
      {/* ─── Page Header ─── */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Content Calendar</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Plan, schedule, and manage your content visually</p>
        </div>
        <button
          onClick={() => { setSelectedDate(todayKey); setScheduleForm({ platform: 'instagram', time: '10:00', caption: '' }); setModalOpen(true) }}
          className="flex items-center gap-2 h-11 px-5 bg-brand-500 text-white rounded-xl text-sm font-bold hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20"
        >
          <Plus size={18} />
          Schedule Post
        </button>
      </div>

      {/* ─── Alert Banners ─── */}
      {tomorrowPosts.length === 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-warning-500/30 bg-warning-50 px-5 py-3 dark:bg-warning-500/5 dark:border-warning-500/20">
          <AlertTriangle size={16} className="text-warning-500 shrink-0" />
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-semibold">Heads up:</span> No posts are scheduled for tomorrow. Drag a draft from the right panel to get started.
          </p>
        </div>
      )}
      {isBelowTarget && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-brand-500/20 bg-brand-50 px-5 py-3 dark:bg-brand-500/5 dark:border-brand-500/20">
          <Info size={16} className="text-brand-500 shrink-0" />
          <p className="text-sm text-gray-700 dark:text-gray-300">
            You have <span className="font-bold text-brand-500">{totalPostsThisMonth}</span> posts this month — target is <span className="font-bold">{targetPosts}</span> ({postsPerWeek}/week). Keep scheduling!
          </p>
        </div>
      )}

      {/* ─── Two Column Layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">

        {/* ═══ LEFT: Calendar ═══ */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
            {/* Calendar header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {MONTHS[currentMonth]} {currentYear}
                </h2>
                <button
                  onClick={goToToday}
                  className="px-3 py-1 rounded-lg text-[11px] font-bold text-brand-500 bg-brand-50 hover:bg-brand-500 hover:text-white dark:bg-brand-500/10 dark:hover:bg-brand-500 transition-all"
                >
                  Today
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={prevMonth} className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] transition-all">
                  <ChevronLeft size={16} className="text-gray-500" />
                </button>
                <button onClick={nextMonth} className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] transition-all">
                  <ChevronRight size={16} className="text-gray-500" />
                </button>
              </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
              {DAYS.map(d => (
                <div key={d} className="py-2.5 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {calendarCells.map((cell, idx) => {
                const dk = cell.inMonth ? dateKey(currentYear, currentMonth, cell.day) : null
                const posts = dk ? postsForDate(dk) : []
                const isToday = dk === todayKey
                const isEmpty = cell.inMonth && posts.length === 0
                const isDropTarget = draggedDraft && cell.inMonth

                return (
                  <div
                    key={idx}
                    onClick={() => cell.inMonth && handleCellClick(dk)}
                    onDragOver={cell.inMonth ? handleDragOver : undefined}
                    onDrop={cell.inMonth ? (e) => handleDrop(e, dk) : undefined}
                    className={`min-h-[100px] border-b border-r border-gray-50 dark:border-gray-800/50 p-1.5 cursor-pointer transition-colors ${
                      !cell.inMonth ? 'bg-gray-50/50 dark:bg-white/[0.01]' : ''
                    } ${isToday ? 'bg-brand-50/30 dark:bg-brand-500/5' : ''} ${
                      isDropTarget ? 'hover:bg-brand-50/50 dark:hover:bg-brand-500/5' : 'hover:bg-gray-50/50 dark:hover:bg-white/[0.02]'
                    } ${isEmpty && dailyPosting ? 'ring-1 ring-inset ring-warning-500/20' : ''}`}
                  >
                    {/* Date number */}
                    <div className="flex items-center justify-between mb-1">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
                        !cell.inMonth ? 'text-gray-300 dark:text-gray-700'
                        : isToday ? 'bg-brand-500 text-white'
                        : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {cell.day}
                      </span>
                      {cell.inMonth && posts.length === 0 && (
                        <Plus size={12} className="text-gray-300 dark:text-gray-700 opacity-0 group-hover:opacity-100" />
                      )}
                    </div>

                    {/* Scheduled posts in cell */}
                    <div className="space-y-1">
                      {posts.slice(0, 2).map(post => {
                        const plat = platformMap[post.platform]
                        const PlatIcon = plat?.icon
                        return (
                          <div
                            key={post.id}
                            onClick={(e) => { e.stopPropagation(); setDetailPost(post) }}
                            className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-medium truncate ${plat?.bg || 'bg-gray-100 dark:bg-white/5'} hover:shadow-theme-xs transition-all cursor-pointer`}
                          >
                            {PlatIcon && <PlatIcon size={10} className={plat.color} />}
                            <span className="truncate text-gray-700 dark:text-gray-300">{post.time}</span>
                          </div>
                        )
                      })}
                      {posts.length > 2 && (
                        <span className="text-[9px] font-semibold text-gray-400 px-1.5">+{posts.length - 2} more</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ─── Frequency Settings ─── */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center gap-2 mb-4">
              <Settings2 size={15} className="text-brand-500" />
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Posting Frequency</span>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 dark:text-gray-400">Posts per week</label>
                <div className="relative">
                  <select
                    value={postsPerWeek}
                    onChange={(e) => setPostsPerWeek(Number(e.target.value))}
                    className="h-9 rounded-lg border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-800 shadow-theme-xs focus:border-brand-500 focus:outline-none dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 appearance-none cursor-pointer"
                  >
                    {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"/></svg>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 dark:text-gray-400">Daily posting</label>
                <button
                  onClick={() => setDailyPosting(!dailyPosting)}
                  className={`relative w-10 h-[22px] rounded-full transition-colors ${dailyPosting ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all ${dailyPosting ? 'left-[22px]' : 'left-[3px]'}`} />
                </button>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <Sparkles size={14} className="text-amber-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Best days: <span className="font-semibold text-gray-700 dark:text-gray-300">Tue, Thu, Sat</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT: Draft Panel ═══ */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden sticky top-[80px]">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays size={15} className="text-brand-500" />
                <span className="text-sm font-bold text-gray-900 dark:text-white">Drafts</span>
              </div>
              <span className="text-[11px] font-semibold text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-md">{drafts.length}</span>
            </div>

            <div className="p-3 space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar">
              {drafts.length === 0 && (
                <div className="py-8 text-center">
                  <CheckCircle2 size={24} className="mx-auto mb-2 text-success-500" />
                  <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">All drafts scheduled!</p>
                  <p className="text-xs text-gray-400 mt-0.5">Create new content to add drafts.</p>
                </div>
              )}

              {drafts.map(draft => {
                const plat = platformMap[draft.platform]
                const PlatIcon = plat?.icon
                return (
                  <div
                    key={draft.id}
                    draggable
                    onDragStart={() => handleDragStart(draft)}
                    onDragEnd={handleDragEnd}
                    onClick={() => setDetailDraft(draft)}
                    className="group flex items-start gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/[0.02] hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-theme-xs cursor-grab active:cursor-grabbing transition-all pointer-events-auto active:scale-95"
                  >
                    {/* Drag handle */}
                    <div className="shrink-0 mt-0.5 text-gray-300 dark:text-gray-600 group-hover:text-gray-400">
                      <GripVertical size={14} />
                    </div>

                    {/* Thumbnail */}
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                      <ImageIcon size={16} className="text-gray-400" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-2">{draft.caption}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {PlatIcon && <PlatIcon size={10} className={plat.color} />}
                        <span className="text-[10px] font-semibold text-gray-400 uppercase">{plat?.label}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Tip */}
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/[0.01]">
              <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center">
                💡 Drag a draft onto a calendar day to schedule it
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SCHEDULE MODAL ═══ */}
      <Dialog isOpen={modalOpen} onClose={() => { setModalOpen(false); setDraggedDraft(null) }} title="Schedule Post">
        <div className="space-y-5">
          {/* Date display */}
          {selectedDate && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-brand-50 dark:bg-brand-500/10 border border-brand-500/20">
              <CalendarDays size={16} className="text-brand-500" />
              <span className="text-sm font-semibold text-brand-500">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          )}

          {/* Platform */}
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 block">Platform</label>
            <div className="relative">
              <select
                value={scheduleForm.platform}
                onChange={(e) => setScheduleForm(f => ({ ...f, platform: e.target.value }))}
                className={selectClass}
              >
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="facebook">Facebook</option>
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"/></svg>
              </div>
            </div>
          </div>

          {/* Time */}
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 block">Time</label>
            <input
              type="time"
              value={scheduleForm.time}
              onChange={(e) => setScheduleForm(f => ({ ...f, time: e.target.value }))}
              className={inputClass}
            />
          </div>

          {/* Caption */}
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 block">Caption</label>
            <textarea
              value={scheduleForm.caption}
              onChange={(e) => setScheduleForm(f => ({ ...f, caption: e.target.value }))}
              rows={4}
              className={`${inputClass} h-auto py-3 resize-none custom-scrollbar`}
              placeholder="Write your post caption..."
            />
          </div>

          {/* Media placeholder */}
          <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/[0.02] p-5 text-center">
            <ImageIcon size={20} className="mx-auto text-gray-400 mb-1.5" />
            <p className="text-xs text-gray-500 dark:text-gray-400">Drag media here or <span className="text-brand-500 font-semibold cursor-pointer">browse</span></p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => { setModalOpen(false); setDraggedDraft(null) }}
              className="flex-1 h-11 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:border-gray-700 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSchedule}
              className="flex-1 flex items-center justify-center gap-2 h-11 bg-brand-500 text-white rounded-xl text-sm font-bold hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20"
            >
              <CalendarDays size={16} />
              Schedule
            </button>
          </div>
        </div>
      </Dialog>

      {/* ═══ POST DETAIL MODAL ═══ */}
      <Dialog isOpen={!!detailPost} onClose={() => setDetailPost(null)} title="Scheduled Post">
        {detailPost && (() => {
          const plat = platformMap[detailPost.platform]
          const PlatIcon = plat?.icon
          return (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${plat?.bg}`}>
                  {PlatIcon && <PlatIcon size={18} className={plat.color} />}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{plat?.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{detailPost.date} at {detailPost.time}</p>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 p-4">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{detailPost.caption}</p>
              </div>

              <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/[0.02] p-6 text-center">
                <ImageIcon size={24} className="mx-auto text-gray-300 mb-2" />
                <p className="text-xs text-gray-400">No media attached</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleDeletePost(detailPost.id)}
                  className="flex items-center justify-center gap-2 h-11 px-5 rounded-xl text-sm font-semibold border border-error-100 bg-error-50 text-error-500 hover:bg-error-100 dark:border-error-500/20 dark:bg-error-500/10 dark:hover:bg-error-500/20 transition-all"
                >
                  <Trash2 size={16} />
                  Remove
                </button>
                <button
                  onClick={() => setDetailPost(null)}
                  className="flex-1 flex items-center justify-center gap-2 h-11 bg-brand-500 text-white rounded-xl text-sm font-bold hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20"
                >
                  Done
                </button>
              </div>
            </div>
          )
        })()}
      </Dialog>

      {/* ═══ DRAFT DETAIL MODAL ═══ */}
      <Dialog isOpen={!!detailDraft} onClose={() => setDetailDraft(null)} title="Draft Content">
        {detailDraft && (() => {
          const plat = platformMap[detailDraft.platform]
          const PlatIcon = plat?.icon
          const suggestedTime = detailDraft.platform === 'instagram' ? '6:00 PM' : detailDraft.platform === 'tiktok' ? '12:00 PM' : '9:00 AM'
          
          return (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${plat?.bg}`}>
                    {PlatIcon && <PlatIcon size={18} className={plat.color} />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">{plat?.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      <Clock size={10} className="text-amber-500" />
                      Suggested Time: <span className="font-semibold text-gray-700 dark:text-gray-300">{suggestedTime}</span>
                    </p>
                  </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-500 text-[10px] font-bold uppercase tracking-wider">Draft</div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Post Caption</label>
                <div className="rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 p-5 shadow-inner">
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed italic">"{detailDraft.caption}"</p>
                </div>
              </div>

              <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/[0.02] p-8 text-center">
                <ImageIcon size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-xs text-gray-400 font-medium">No media uploaded yet</p>
                <p className="text-[10px] text-gray-400 mt-1 italic">Click 'Schedule Now' to add media files</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setDetailDraft(null)}
                  className="flex-1 h-11 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:border-gray-700 transition-all"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setDetailDraft(null);
                    setSelectedDate(todayKey);
                    setScheduleForm({
                      platform: detailDraft.platform,
                      time: suggestedTime.includes('AM') ? suggestedTime.replace(' AM', '') : String(parseInt(suggestedTime)+12) + ':00',
                      caption: detailDraft.caption
                    });
                    setDraggedDraft(detailDraft); // Treat as a "staged" draft for the scheduler
                    setModalOpen(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 h-11 bg-brand-500 text-white rounded-xl text-sm font-bold hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20"
                >
                  <CalendarDays size={18} />
                  Schedule Now
                </button>
              </div>
            </div>
          )
        })()}
      </Dialog>
    </div>
  )
}
