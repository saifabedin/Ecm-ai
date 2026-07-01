import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../utils/api.js'
import {
  Wand2,
  Megaphone,
  CalendarRange,
  ArrowRight,
  Sparkles,
  ChevronRight,
  Lightbulb,
  Search,
  Zap,
  LayoutGrid
} from 'lucide-react'

/* ─── Two main colors ─── */
const workflows = [
  {
    category: 'DISCOVER',
    title: 'Find Ideas',
    description: 'Explore proven content angles and trending ideas for your services.',
    cta: 'Browse Ideas',
    path: '/content/discover',
    icon: Lightbulb,
    iconBg: 'bg-brand-50 dark:bg-brand-500/10',
    iconColor: 'text-brand-500',
    borderHover: 'hover:border-brand-500/30',
  },
  {
    category: 'CREATE',
    title: 'Create Content',
    description: 'Turn ideas into scripts, captions, and videos with AI.',
    cta: 'Generate Content',
    path: '/content/create',
    icon: Wand2,
    iconBg: 'bg-brand-50 dark:bg-brand-500/10',
    iconColor: 'text-brand-500',
    borderHover: 'hover:border-brand-500/30',
  },
  {
    category: 'MANAGE ADS',
    title: 'Run Ads',
    description: 'Launch and track campaigns across platforms from one place.',
    cta: 'View Campaigns',
    path: '/content/ads',
    icon: Megaphone,
    iconBg: 'bg-brand-50 dark:bg-brand-500/10',
    iconColor: 'text-brand-500',
    borderHover: 'hover:border-brand-500/30',
  },
  {
    category: 'CONTENT CALENDAR',
    title: 'Plan & Schedule',
    description: 'Organize posts, manage drafts, and stay consistent.',
    cta: 'Open Calendar',
    path: '/content/schedule',
    icon: CalendarRange,
    iconBg: 'bg-brand-50 dark:bg-brand-500/10',
    iconColor: 'text-brand-500',
    borderHover: 'hover:border-brand-500/30',
  },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)

  // Load real data from backend
  useEffect(() => {
const loadSuggestions = async () => {
try {
const draftsData = await apiFetch('/api/drafts');
const drafts = draftsData.success ? draftsData.drafts : [];

const scheduledData = await apiFetch('/api/scheduled-posts');
const scheduledPosts = scheduledData.success ? scheduledData.scheduledPosts : [];

        // Generate suggestions based on data
        const newSuggestions = [];

        // Check if there are no scheduled posts for tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowFormatted = tomorrow.toISOString().split('T')[0];
        const hasScheduledForTomorrow = scheduledPosts.some(post => 
          post.scheduled_date === tomorrowFormatted
        );

        if (!hasScheduledForTomorrow) {
          newSuggestions.push({
            text: "You have no posts scheduled for tomorrow",
            path: "/content/schedule",
            icon: CalendarRange
          });
        }

        // Add suggestion based on drafts
        if (drafts.length > 0) {
          newSuggestions.push({
            text: "You have drafts ready to schedule",
            path: "/content/schedule",
            icon: CalendarRange
          });
        }

        // Add suggestion to create new content if no drafts
        if (drafts.length === 0) {
          newSuggestions.push({
            text: "Create new content to get started",
            path: "/content/create",
            icon: Wand2
          });
        }

        setSuggestions(newSuggestions);
      } catch (err) {
        console.error('Failed to load suggestions:', err);
        // Fallback to mock suggestions
        setSuggestions([
          {
            text: "You have no posts scheduled for tomorrow",
            path: "/content/schedule",
            icon: CalendarRange
          },
          {
            text: "Try promoting teeth whitening this week",
            path: "/content/discover",
            icon: Lightbulb
          },
          {
            text: "Your ad campaign CTR is below average",
            path: "/content/ads",
            icon: Megaphone
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadSuggestions();
  }, []);

  return (
    <div className="p-6 lg:p-10 transition-colors">

      {/* ═══ 1. WORKFLOW CARDS ═══ */}
      <div className="mb-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-6 px-1">
          Command Center
        </h2>
        
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {workflows.map((card) => {
            const Icon = card.icon
            return (
              <button
                key={card.path}
                onClick={() => navigate(card.path)}
                aria-label={`Go to ${card.title}`}
                className={`group relative text-left rounded-2xl border border-gray-200 bg-white p-7 transition-all hover:shadow-theme-lg hover:scale-[1.01] active:scale-[0.98] cursor-pointer dark:border-gray-800 dark:bg-white/[0.03] ${card.borderHover}`}
              >
                <div className="mb-6">
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${card.iconBg}`}>
                    <Icon size={24} className={card.iconColor} />
                  </div>
                </div>

                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2 tracking-tight">{card.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-6 line-clamp-3">{card.description}</p>

                <div className="flex items-center gap-1.5 text-xs font-bold text-brand-500 group-hover:gap-2 transition-all mt-auto">
                  {card.cta}
                  <ChevronRight size={14} />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ═══ 2. INSIGHTS / GUIDANCE ═══ */}
      <div className="max-w-3xl">
        <div className="rounded-2xl border border-gray-200 bg-white p-7 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-warning-500 fill-warning-500/20" />
            <h2 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Suggestions</h2>
          </div>
          
          <ul className="space-y-4">
            {suggestions.map((suggestion, idx) => {
              const Icon = suggestion.icon;
              return (
                <li key={idx}>
                  <button 
                    onClick={() => navigate(suggestion.path)}
                    className="flex items-start gap-4 w-full p-2.5 -m-2.5 rounded-xl transition-all hover:bg-gray-50 dark:hover:bg-white/5 group text-left"
                  >
                    <div className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-500 ring-4 ring-brand-500/10 shrink-0 group-hover:scale-110 transition-transform" />
                    <span className="text-xs text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">
                      {suggestion.text}
                    </span>
                    <ChevronRight size={14} className="ml-auto text-gray-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
