import React, { useState, useRef, useEffect } from 'react'
import { 
  Search, 
  Play, 
  Heart, 
  Eye, 
  Share2,
  Video,
  Image as ImageIcon,
  Grid,
  TrendingUp,
  MessageCircle,
  ExternalLink,
  X,
  Copy,
  CheckCheck,
  Megaphone,
  FileText,
  Sparkles,
  BarChart3,
  Users,
  ThumbsUp,
  Bookmark,
  Zap,
  Target,
  Lightbulb
} from 'lucide-react'

/* ─── Social Media Platform Icons (inline SVGs for exact brand fidelity) ─── */
const InstagramIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2"/>
    <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/>
    <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/>
  </svg>
)
const TikTokIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1 0-5.78c.29 0 .58.04.85.11V9a6.33 6.33 0 0 0-.85-.06 6.34 6.34 0 0 0 0 12.68 6.34 6.34 0 0 0 6.34-6.34V8.73a8.19 8.19 0 0 0 3.76.92V6.69Z"/>
  </svg>
)
const YouTubeIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81ZM9.75 15.02V8.98L15.5 12l-5.75 3.02Z"/>
  </svg>
)
const FacebookIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z"/>
  </svg>
)
const LinkedInIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124ZM6.813 20.452H3.362V9h3.451v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.454C23.204 24 24 23.227 24 22.271V1.729C24 .774 23.204 0 22.225 0Z"/>
  </svg>
)
const PinterestIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 0a12 12 0 0 0-4.373 23.178c-.07-.633-.134-1.606.028-2.298.146-.625.938-3.978.938-3.978s-.239-.479-.239-1.187c0-1.113.645-1.943 1.448-1.943.683 0 1.012.512 1.012 1.127 0 .686-.437 1.713-.663 2.664-.189.796.399 1.446 1.185 1.446 1.42 0 2.514-1.498 2.514-3.662 0-1.915-1.376-3.254-3.342-3.254-2.276 0-3.612 1.707-3.612 3.472 0 .688.265 1.425.595 1.826a.24.24 0 0 1 .056.23c-.061.252-.196.796-.222.907-.035.146-.116.177-.268.107-1-.465-1.624-1.926-1.624-3.1 0-2.523 1.834-4.84 5.286-4.84 2.775 0 4.932 1.977 4.932 4.62 0 2.757-1.739 4.976-4.151 4.976-.811 0-1.573-.421-1.834-.919l-.498 1.902c-.181.695-.669 1.566-.995 2.097A12 12 0 1 0 12 0Z"/>
  </svg>
)

const socialPlatforms = [
  { name: 'Instagram', icon: InstagramIcon, color: '#E4405F' },
  { name: 'TikTok', icon: TikTokIcon, color: '#000000' },
  { name: 'YouTube', icon: YouTubeIcon, color: '#FF0000' },
  { name: 'Facebook', icon: FacebookIcon, color: '#1877F2' },
  { name: 'LinkedIn', icon: LinkedInIcon, color: '#0A66C2' },
  { name: 'Pinterest', icon: PinterestIcon, color: '#BD081C' },
]

const popularKeywords = [
  '🔥 Trending',
  'Teeth Whitening',
  'Braces',
  'Dental Implants',
  'Smile Makeover',
  'Oral Hygiene',
  'Kids Dentistry',
  'Veneers',
  'Root Canal',
  'Invisalign',
]

const mockSuggestions = [
  { text: 'teeth whitening before and after', category: 'Teeth Whitening', platform: 'Instagram' },
  { text: 'teeth whitening at home tips', category: 'Teeth Whitening', platform: 'TikTok' },
  { text: 'teeth cleaning satisfying videos', category: 'Oral Hygiene', platform: 'TikTok' },
  { text: 'braces transformation timelapse', category: 'Braces', platform: 'YouTube' },
  { text: 'braces colors ideas aesthetic', category: 'Braces', platform: 'Pinterest' },
  { text: 'dental implant procedure explained', category: 'Dental Implants', platform: 'YouTube' },
  { text: 'dental clinic marketing ideas', category: 'Marketing', platform: 'LinkedIn' },
  { text: 'smile makeover veneers cost', category: 'Smile Makeover', platform: 'Instagram' },
  { text: 'kids first dentist visit tips', category: 'Kids Dentistry', platform: 'Facebook' },
  { text: 'oral hygiene routine morning', category: 'Oral Hygiene', platform: 'TikTok' },
  { text: 'invisalign vs braces comparison', category: 'Braces', platform: 'YouTube' },
  { text: 'root canal pain myth debunk', category: 'Education', platform: 'Instagram' },
]

const contentTypes = [
  { id: 'all', label: 'All', icon: Grid },
  { id: 'videos', label: 'Videos', icon: Video },
  { id: 'images', label: 'Images', icon: ImageIcon }
]

const mockContent = [
  {
    id: 1, type: 'videos',
    title: 'Transform Your Smile: The Ultimate Whitening Guide',
    likes: '12K', views: '150K', comments: '1.2K', saves: '3.4K',
    platform: 'Instagram',
    thumbnail: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=400&h=250&fit=crop',
    category: 'Teeth Whitening',
    contentLabel: 'content',
    growth: '+24%',
    engagementRate: '8.2%',
    script: `[HOOK - 0:00] "You won't believe this $20 teeth whitening hack actually works..."

[INTRO - 0:03] "I'm Dr. Sarah, and today I'm going to show you the safest, most effective way to whiten your teeth at home."

[BODY - 0:15] "Step 1: Start with a clean base. Brush your teeth gently with a soft-bristled brush. Step 2: Apply a thin layer of carbamide peroxide gel — this is the same ingredient dentists use. Step 3: Wait 15 minutes. No more, no less."

[RESULTS - 0:45] "Here's my before... and here's my after just 2 weeks later."

[CTA - 0:55] "Follow for more dental tips that actually work. Drop a 🦷 if you're trying this!"`,
    viralReasons: {
      hook: 'Opens with a bold, curiosity-driven statement ("You won\'t believe...") combined with an accessible price point ($20) that makes viewers feel they can achieve the same results.',
      emotionalTrigger: 'Before/after transformation creates a powerful visual contrast that triggers aspiration and hope.',
      relatability: 'Uses everyday language and positions the dentist as approachable rather than clinical.',
      timing: 'Posted at 7 PM EST on a Tuesday — peak engagement window for health/beauty content on Instagram.',
      format: 'Short-form vertical video (under 60s) optimized for Reels algorithm. Quick cuts maintain attention throughout.',
      cta: 'The emoji CTA ("Drop a 🦷") is low-friction and fun, driving comments which boost algorithmic reach.'
    }
  },
  {
    id: 2, type: 'images',
    title: '5 Daily Habits for Perfect Oral Hygiene',
    likes: '8K', views: '45K', comments: '430', saves: '6.1K',
    platform: 'Pinterest',
    thumbnail: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=400&h=250&fit=crop',
    category: 'Oral Hygiene',
    contentLabel: 'sponsored',
    growth: '+12%',
    engagementRate: '5.7%',
    script: `[HEADLINE] "5 Daily Habits Your Dentist Wishes You Knew"

[SLIDE 1] "Habit #1: Brush at a 45-degree angle to your gumline. Most people brush straight across — this misses 40% of plaque buildup."

[SLIDE 2] "Habit #2: Floss before brushing, not after. This loosens debris so your toothpaste can reach between teeth."

[SLIDE 3] "Habit #3: Wait 30 minutes after eating to brush. Acid from food temporarily softens enamel."

[SLIDE 4] "Habit #4: Replace your toothbrush every 3 months or when bristles fray — whichever comes first."

[SLIDE 5] "Habit #5: Use mouthwash as the final step, not a substitute for brushing."

[CTA] "Save this pin & share with someone who needs better oral hygiene! 🪥"`,
    viralReasons: {
      hook: 'The "Your Dentist Wishes You Knew" framing creates an information-gap that compels users to click.',
      emotionalTrigger: 'Plays on the fear of doing something wrong daily — viewers realize they may have been brushing incorrectly for years.',
      relatability: 'Each habit corrects a common mistake, making every viewer feel personally addressed.',
      timing: 'Published during "New Year, New Me" season when health-related content sees 40% higher engagement.',
      format: 'Multi-slide carousel pin — Pinterest\'s highest-engagement format. Each slide reveals one habit, driving swipe-through completion.',
      cta: 'The save-first CTA leverages Pinterest\'s core behavior. Saves are the #1 signal for Pinterest distribution.'
    }
  },
  {
    id: 3, type: 'videos',
    title: 'Invisible Braces: Is It Right for You?',
    likes: '25K', views: '400K', comments: '3.4K', saves: '8.9K',
    platform: 'TikTok',
    thumbnail: 'https://images.unsplash.com/photo-1593054999502-c97c0d49df42?w=400&h=250&fit=crop',
    category: 'Braces',
    contentLabel: 'sponsored',
    growth: '+67%',
    engagementRate: '11.4%',
    script: `[HOOK - 0:00] "POV: You just found out braces don't have to be metal anymore 🤯"

[BODY - 0:03] "Clear aligners have completely changed the game. Here's what no one tells you:"

[POINT 1 - 0:07] "They're removable — eat whatever you want. Pizza? Yes. Popcorn? Absolutely."

[POINT 2 - 0:12] "Treatment is 40% faster than traditional braces for most cases."

[POINT 3 - 0:17] "You can preview your final smile with 3D imaging before you even start."

[REVEAL - 0:22] "I've been wearing mine for 6 months and nobody at work has noticed."

[CTA - 0:27] "Stitch this with your braces journey! Link in bio for a free consultation. ⬇️"`,
    viralReasons: {
      hook: 'The "POV:" format is one of TikTok\'s most viral templates. Combined with the mind-blown emoji, it creates instant relatability.',
      emotionalTrigger: 'Addresses a deep insecurity (visible braces) and presents an "invisible" solution — taps into vanity and social anxiety.',
      relatability: 'The food examples (pizza, popcorn) connect to universally loved foods that traditional braces restrict.',
      timing: 'Posted during back-to-school season when orthodontic searches spike 3x on TikTok.',
      format: 'Under 30 seconds with rapid cuts — perfectly tuned for TikTok\'s completion-rate algorithm. High completion = massive reach.',
      cta: '"Stitch this" is a genius growth hack — it invites duets/stitches which create exponential organic reach.'
    }
  },
  {
    id: 4, type: 'images',
    title: 'The Future of Dental Implants',
    likes: '3K', views: '12K', comments: '85', saves: '1.8K',
    platform: 'LinkedIn',
    thumbnail: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=400&h=250&fit=crop',
    category: 'Dental Implants',
    contentLabel: 'content',
    growth: '+8%',
    engagementRate: '3.2%',
    script: `[HEADLINE] "The dental implant industry is projected to reach $13B by 2028. Here's what's driving it."

[PARAGRAPH 1] "3D-printed titanium implants are reducing surgery time by 50% and improving osseointegration rates. We're seeing 98.5% success rates in our practice."

[PARAGRAPH 2] "AI-guided surgical planning is eliminating guesswork. Our latest case used machine learning to predict optimal implant angles within 0.2mm accuracy."

[PARAGRAPH 3] "Same-day implants are no longer a luxury — they're becoming the standard of care. Patients walk in with missing teeth and leave with a functional smile."

[CLOSING] "The future isn't coming. It's already here. What innovations are you seeing in your practice?"

[HASHTAGS] #DentalImplants #DentalInnovation #DigitalDentistry #ImplantDentistry`,
    viralReasons: {
      hook: 'Leading with a massive market statistic ($13B) immediately establishes authority and captures attention of both clinicians and investors.',
      emotionalTrigger: 'Appeals to professional FOMO — dentists fear falling behind on technology adoption.',
      relatability: 'Shares specific practice results (98.5% success rate) which invites comparison and discussion.',
      timing: 'Published on a Wednesday morning — LinkedIn\'s peak engagement window for professional content.',
      format: 'Long-form text post with no external link (LinkedIn deprioritizes posts with links). The question at the end drives comments.',
      cta: 'The closing question is an open invitation for industry peers to share their experiences, which fuels comment-driven virality on LinkedIn.'
    }
  },
  {
    id: 5, type: 'videos',
    title: 'Making Kids Love Dentistry',
    likes: '15K', views: '220K', comments: '920', saves: '4.2K',
    platform: 'TikTok',
    thumbnail: 'https://images.unsplash.com/photo-1461532257246-777de18cd58b?w=400&h=250&fit=crop',
    category: 'Kids Dentistry',
    contentLabel: 'content',
    growth: '+45%',
    engagementRate: '9.6%',
    script: `[HOOK - 0:00] "Watch this 4-year-old's reaction when she finds out the dentist is actually fun 😭❤️"

[SCENE 1 - 0:03] *Child walks in nervously, clutching parent's hand*

[SCENE 2 - 0:06] "We make every visit feel like an adventure. First stop: choosing a flavored toothpaste." *Child excitedly picks bubblegum*

[SCENE 3 - 0:12] "Then we count teeth together using a mirror — she loves being the helper." *Child giggles*

[SCENE 4 - 0:18] "The 'magic chair' goes up... and she's the queen of the castle!" *Child throws hands up*

[REACTION - 0:24] *Child asks mom: "Can we come back tomorrow?"*

[CTA - 0:28] "Every child deserves a positive dental experience. Tag a parent who needs to see this! 💛"`,
    viralReasons: {
      hook: 'The emotional preview ("Watch this 4-year-old\'s reaction") combined with crying/heart emojis signals a heartwarming moment — irresistible scroll-stopper.',
      emotionalTrigger: 'Parental anxiety about children at the dentist is universal. This video transforms fear into joy — a powerful emotional arc.',
      relatability: 'Every parent has struggled with taking kids to the dentist. The video offers validation and hope.',
      timing: 'Posted during Children\'s Dental Health Month (February) when parenting communities are most active.',
      format: 'Authentic, unpolished footage feels real rather than staged. TikTok\'s algorithm favors authentic content over produced content.',
      cta: '"Tag a parent" is one of the highest-conversion CTAs for family content — it leverages social obligation to share helpful information.'
    }
  },
  {
    id: 6, type: 'images',
    title: 'Smile Makeover Case Study: Real Results',
    likes: '6K', views: '30K', comments: '120', saves: '2.7K',
    platform: 'Instagram',
    thumbnail: 'https://images.unsplash.com/photo-1516062423079-7ca13cdc7f5a?w=400&h=250&fit=crop',
    category: 'Smile Makeover',
    contentLabel: 'sponsored',
    growth: '+18%',
    engagementRate: '6.1%',
    script: `[COVER SLIDE] "From hiding her smile in every photo → to this ✨" *Before/after split image*

[SLIDE 1 - THE PROBLEM] "Sarah came to us feeling self-conscious about her stained, chipped front teeth. She hadn't smiled in a photo in 3 years."

[SLIDE 2 - THE PLAN] "We designed a custom treatment plan: professional whitening + 4 porcelain veneers. Total treatment time: 2 visits over 10 days."

[SLIDE 3 - THE PROCESS] "Using digital smile design, Sarah approved her new smile before we even started. No surprises, just confidence."

[SLIDE 4 - THE RESULT] "Here's Sarah 6 months later. She says she can't stop smiling. That's the reaction we live for."

[SLIDE 5 - CTA] "Want to start your smile journey? DM us 'SMILE' for a free virtual consultation. 📩"`,
    viralReasons: {
      hook: 'The "From X → to Y" transformation format is one of Instagram\'s most proven viral templates. The sparkle emoji adds aspiration.',
      emotionalTrigger: 'The personal story (hadn\'t smiled in photos for 3 years) creates empathy and makes the transformation feel earned, not cosmetic.',
      relatability: 'Many people are self-conscious about their smile — this addresses a widespread insecurity with a positive outcome.',
      timing: 'Published on a Friday afternoon when aspirational/lifestyle content sees peak engagement on Instagram.',
      format: 'Multi-slide carousel — Instagram\'s highest-reach format. Each slide advances the narrative, driving swipe completion.',
      cta: 'The keyword DM trigger ("DM us SMILE") creates a low-friction conversion path and allows automated follow-up.'
    }
  }
]

export default function Discover() {
  const [activeType, setActiveType] = useState('all')
  const [activeFilters, setActiveFilters] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activePlatform, setActivePlatform] = useState(null)
  const [copiedScript, setCopiedScript] = useState(false)
  const searchRef = useRef(null)

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleFilter = (filter) => {
    setActiveFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter) 
        : [...prev, filter]
    )
  }

  const handleKeywordClick = (keyword) => {
    if (keyword === '🔥 Trending') {
      setSearchQuery('')
      setActiveFilters([])
      return
    }
    setSearchQuery(keyword)
    setShowSuggestions(false)
  }

  const handleCopyScript = () => {
    if (selectedItem) {
      let fullContent = '';
      
      // Header and Script
      fullContent += `${selectedItem.type === 'videos' ? 'Video Script' : 'Content Script'}\n`;
      fullContent += `${selectedItem.script}\n\n`;
      
      // Viral Analysis
      if (selectedItem.viralReasons) {
        fullContent += `Why It Went Viral\n`;
        const labels = {
          hook: 'Hook Strategy',
          emotionalTrigger: 'Emotional Trigger',
          relatability: 'Relatability Factor',
          timing: 'Optimal Timing',
          format: 'Format & Structure',
          cta: 'CTA Effectiveness'
        };
        
        Object.entries(labels).forEach(([key, label]) => {
          if (selectedItem.viralReasons[key]) {
            fullContent += `${label}\n${selectedItem.viralReasons[key]}\n\n`;
          }
        });
      }
      
      navigator.clipboard.writeText(fullContent.trim());
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2500);
    }
  }

  const filteredSuggestions = searchQuery.length > 0
    ? mockSuggestions.filter(s => s.text.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 6)
    : []

  const filteredContent = mockContent.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = activeType === 'all' || item.type === activeType
    
    // Split filters into category filters and specific label filters (sponsored/content)
    const categoryFilters = activeFilters.filter(f => f !== 'sponsored' && f !== 'content')
    const labelFilters = activeFilters.filter(f => f === 'sponsored' || f === 'content')
    
    const matchesCategory = categoryFilters.length === 0 || categoryFilters.includes(item.category)
    const matchesLabel = labelFilters.length === 0 || labelFilters.includes(item.contentLabel)
    const matchesPlatform = !activePlatform || item.platform === activePlatform
    
    return matchesSearch && matchesType && matchesCategory && matchesLabel && matchesPlatform
  })

  // Helper to get platform icon component
  const getPlatformIcon = (platformName) => {
    const p = socialPlatforms.find(sp => sp.name === platformName)
    return p ? p.icon : null
  }

  return (
    <div className="p-6 lg:p-10 transition-colors">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Discover</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Find high-performing dental content ideas</p>
      </div>

      {/* ─── Social Platform Icons Row ─── */}
      <div className="mb-8 flex items-center gap-3">
        {socialPlatforms.map(platform => {
          const Icon = platform.icon
          const isActive = activePlatform === platform.name
          return (
            <button
              key={platform.name}
              onClick={() => setActivePlatform(isActive ? null : platform.name)}
              title={platform.name}
              className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-200 ${
                isActive
                  ? 'border-brand-500 bg-brand-50 shadow-lg shadow-brand-500/10 dark:bg-brand-500/10'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-gray-700'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-brand-500' : 'text-gray-500 dark:text-gray-400'} />
            </button>
          )
        })}
        {activePlatform && (
          <button
            onClick={() => setActivePlatform(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-gray-700 bg-gray-100 dark:bg-white/5 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={14} />
            Clear
          </button>
        )}
      </div>

      {/* ─── Search with Auto-Suggestions ─── */}
      <div className="mb-6" ref={searchRef}>
        <div className="relative xl:w-[600px]">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true) }}
            onFocus={() => searchQuery.length > 0 && setShowSuggestions(true)}
            className="h-12 w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-12 pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-500" 
            placeholder="Search a keyword" 
          />

          {/* Auto-suggestion Dropdown */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-gray-200 bg-white shadow-theme-lg overflow-hidden z-50 dark:border-gray-800 dark:bg-gray-900">
              {filteredSuggestions.map((suggestion, idx) => {
                const PlatIcon = getPlatformIcon(suggestion.platform)
                return (
                  <button
                    key={idx}
                    onClick={() => { setSearchQuery(suggestion.text); setShowSuggestions(false) }}
                    className="flex items-center gap-3 w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors dark:text-gray-300 dark:hover:bg-white/5"
                  >
                    <Search size={14} className="text-gray-400 shrink-0" />
                    <span className="flex-1 truncate">{suggestion.text}</span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {PlatIcon && <PlatIcon size={14} className="text-gray-400" />}
                      <span className="text-[10px] font-semibold text-gray-400 uppercase">{suggestion.platform}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Popular Keywords Row ─── */}
      <div className="mb-6 flex flex-wrap gap-2">
        {popularKeywords.map(keyword => (
          <button
            key={keyword}
            onClick={() => handleKeywordClick(keyword)}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 border ${
              (activeFilters.includes(keyword) || searchQuery === keyword)
                ? 'bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-500/20'
                : 'bg-white border-gray-200 text-gray-600 hover:border-brand-300 hover:text-brand-500 dark:bg-white/5 dark:border-gray-800 dark:text-gray-400 dark:hover:border-brand-500'
            }`}
          >
            {keyword}
          </button>
        ))}
      </div>

      {/* ─── Hot Topics & FAQs (New Section) ─── */}
      <div className="mb-8 rounded-2xl border border-brand-500/10 bg-brand-50/30 p-6 dark:border-brand-500/20 dark:bg-brand-500/5">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb size={16} className="text-brand-500" />
          <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Hot Topics & Dental FAQs</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            "Why are my teeth yellow even after brushing?",
            "Is charcoal toothpaste actually safe for enamel?",
            "How to stop bleeding gums in 3 days",
            "Are dental implants worth the cost?"
          ].map((topic, i) => (
            <button 
              key={i} 
              onClick={() => setSearchQuery(topic)}
              className="flex items-start gap-3 p-3 rounded-xl bg-white border border-gray-100 text-left hover:border-brand-500/30 hover:shadow-theme-sm transition-all dark:bg-gray-900 dark:border-gray-800"
            >
              <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
              <span className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-relaxed">{topic}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Content Type Toggle & Sponsored Filter ─── */}
      <div className="mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex p-1 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-gray-800">
          {contentTypes.map(type => {
            const Icon = type.icon
            return (
              <button
                key={type.id}
                onClick={() => setActiveType(type.id)}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  activeType === type.id
                    ? 'bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <Icon size={16} />
                {type.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-gray-800">
          <button
            onClick={() => toggleFilter('sponsored')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeFilters.includes('sponsored')
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Ads Only
          </button>
          <button
            onClick={() => toggleFilter('content')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeFilters.includes('content')
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Organic Only
          </button>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredContent.map((item) => {
          const PlatIcon = getPlatformIcon(item.platform)
          const isSponsored = item.contentLabel === 'sponsored'
          return (
            <div 
              key={item.id} 
              onClick={() => setSelectedItem(item)}
              className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all hover:shadow-theme-md dark:border-gray-800 dark:bg-white/[0.03] cursor-pointer"
            >
              <div className="relative aspect-video overflow-hidden">
                <img 
                  src={item.thumbnail} 
                  alt={item.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 transition-opacity group-hover:opacity-100" />
                {item.type === 'videos' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-brand-500 shadow-lg backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
                      <Play size={20} fill="currentColor" />
                    </div>
                  </div>
                )}
                {/* Platform badge - top left */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 backdrop-blur-md">
                  {PlatIcon && <PlatIcon size={12} className="text-white" />}
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">{item.platform}</span>
                </div>
                {/* Content / Sponsored badge - top right */}
                <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-md ${
                  isSponsored 
                    ? 'bg-amber-500/80' 
                    : 'bg-emerald-500/80'
                }`}>
                  {isSponsored 
                    ? <Megaphone size={11} className="text-white" /> 
                    : <FileText size={11} className="text-white" />
                  }
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                    {isSponsored ? 'Sponsored' : 'Content'}
                  </span>
                </div>
              </div>

              <div className="p-5 flex flex-col flex-1">
                <div className="mb-2">
                  <span className="text-[10px] font-bold text-brand-500 uppercase tracking-wider">{item.category}</span>
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight mb-4 flex-1">
                  {item.title}
                </h3>
                
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800 mt-auto">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 group-hover:text-gray-900 transition-colors">
                      <Heart size={14} className="group-hover:fill-error-500 text-error-500 transition-all" />
                      {item.likes}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <Eye size={14} />
                      {item.views}
                    </div>
                  </div>
                  <button 
                    aria-label="Share Content"
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-all active:scale-90"
                    onClick={(e) => { e.stopPropagation(); console.log('Sharing:', item.title); alert(`Shared link for: ${item.title}`) }}
                  >
                    <Share2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filteredContent.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-gray-500 dark:text-gray-400">No content found matching your search or filters.</p>
        </div>
      )}

      {/* ─── Two-Panel Content Detail Modal ─── */}
      {selectedItem && (() => {
        const PlatIcon = getPlatformIcon(selectedItem.platform)
        const isSponsored = selectedItem.contentLabel === 'sponsored'
        const reasons = selectedItem.viralReasons || {}
        const reasonEntries = [
          { key: 'hook', label: 'Hook Strategy', icon: Zap, color: 'text-amber-500' },
          { key: 'emotionalTrigger', label: 'Emotional Trigger', icon: Heart, color: 'text-rose-500' },
          { key: 'relatability', label: 'Relatability Factor', icon: Users, color: 'text-blue-500' },
          { key: 'timing', label: 'Optimal Timing', icon: Target, color: 'text-emerald-500' },
          { key: 'format', label: 'Format & Structure', icon: BarChart3, color: 'text-violet-500' },
          { key: 'cta', label: 'CTA Effectiveness', icon: Lightbulb, color: 'text-orange-500' },
        ]

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" 
              onClick={() => { setSelectedItem(null); setCopiedScript(false) }}
            />
            
            {/* Modal */}
            <div className="relative w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 px-8 py-5 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Content Breakdown</h2>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
                    isSponsored 
                      ? 'bg-amber-50 dark:bg-amber-500/10' 
                      : 'bg-emerald-50 dark:bg-emerald-500/10'
                  }`}>
                    {isSponsored 
                      ? <Megaphone size={12} className="text-amber-600 dark:text-amber-400" /> 
                      : <FileText size={12} className="text-emerald-600 dark:text-emerald-400" />
                    }
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      isSponsored 
                        ? 'text-amber-600 dark:text-amber-400' 
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {isSponsored ? 'Sponsored Ad' : 'Organic Content'}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => { setSelectedItem(null); setCopiedScript(false) }}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:hover:bg-white/5 dark:hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              
              {/* Two-Panel Body */}
              <div className="flex flex-col lg:flex-row max-h-[calc(92vh-76px)] overflow-hidden">
                
                {/* ═══ LEFT PANEL: Video + Engagement Stats ═══ */}
                <div className="lg:w-[45%] border-r-0 lg:border-r border-gray-100 dark:border-gray-800 overflow-y-auto no-scrollbar p-6 lg:p-8 space-y-6">
                  {/* Video Preview */}
                  <div className="relative aspect-video overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 group">
                    <img src={selectedItem.thumbnail} className="h-full w-full object-cover" alt={selectedItem.title} />
                    {selectedItem.type === 'videos' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-brand-500 shadow-lg backdrop-blur-sm">
                          <Play size={24} fill="currentColor" />
                        </div>
                      </div>
                    )}
                    {/* Platform badge on video */}
                    <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-md">
                      {PlatIcon && <PlatIcon size={12} className="text-white" />}
                      <span className="text-[10px] font-bold text-white uppercase tracking-wider">{selectedItem.platform}</span>
                    </div>
                  </div>

                  {/* Title & Category */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 rounded-md bg-brand-50 text-[10px] font-bold text-brand-500 uppercase dark:bg-brand-500/10">
                        {selectedItem.category}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                      {selectedItem.title}
                    </h2>
                  </div>

                  {/* Engagement Stats Grid */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Sparkles size={14} className="text-brand-500" />
                      Engagement & Growth
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Eye size={15} className="text-brand-500" />
                          <span className="text-[11px] font-semibold text-gray-400 uppercase">Views</span>
                        </div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white">{selectedItem.views}</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Heart size={15} className="text-error-500" />
                          <span className="text-[11px] font-semibold text-gray-400 uppercase">Likes</span>
                        </div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white">{selectedItem.likes}</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-2 mb-1.5">
                          <MessageCircle size={15} className="text-blue-500" />
                          <span className="text-[11px] font-semibold text-gray-400 uppercase">Comments</span>
                        </div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white">{selectedItem.comments}</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Bookmark size={15} className="text-amber-500" />
                          <span className="text-[11px] font-semibold text-gray-400 uppercase">Saves</span>
                        </div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white">{selectedItem.saves}</div>
                      </div>
                    </div>
                  </div>

                  {/* Growth & Engagement Rate */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <TrendingUp size={15} className="text-emerald-600 dark:text-emerald-400" />
                        <span className="text-[11px] font-semibold text-emerald-600/70 dark:text-emerald-400/70 uppercase">Growth</span>
                      </div>
                      <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{selectedItem.growth}</div>
                    </div>
                    <div className="p-4 rounded-2xl border border-violet-100 bg-violet-50/50 dark:border-violet-500/20 dark:bg-violet-500/5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <BarChart3 size={15} className="text-violet-600 dark:text-violet-400" />
                        <span className="text-[11px] font-semibold text-violet-600/70 dark:text-violet-400/70 uppercase">Eng. Rate</span>
                      </div>
                      <div className="text-lg font-bold text-violet-700 dark:text-violet-400">{selectedItem.engagementRate}</div>
                    </div>
                  </div>
                </div>

                {/* ═══ RIGHT PANEL: Script + Viral Analysis ═══ */}
                <div className="lg:w-[55%] overflow-y-auto no-scrollbar p-6 lg:p-8 space-y-6">
                  
                  {/* Video Script Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <FileText size={14} className="text-brand-500" />
                        {selectedItem.type === 'videos' ? 'Video Script' : 'Content Script'}
                      </h3>
                    </div>
                    <div 
                      onClick={handleCopyScript}
                      className="relative rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 overflow-hidden cursor-pointer group/script hover:border-brand-500/50 transition-all active:scale-[0.99]"
                    >
                      <pre className="p-5 text-[13px] leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-['Outfit',sans-serif] max-h-[280px] overflow-y-auto no-scrollbar">
                        {selectedItem.script}
                      </pre>
                      <div className="absolute top-4 right-4 opacity-0 group-hover/script:opacity-100 transition-opacity">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/90 dark:bg-gray-800/90 text-[10px] font-bold text-brand-500 shadow-sm border border-gray-100 dark:border-gray-700">
                          {copiedScript ? <CheckCheck size={12} /> : <Copy size={12} />}
                          {copiedScript ? 'Copied!' : 'Click to copy all'}
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-50 dark:from-gray-800/80 to-transparent pointer-events-none" />
                    </div>
                  </div>

                  {/* Why It Went Viral Section */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Sparkles size={14} className="text-amber-500" />
                      Why It Went Viral
                    </h3>
                    <div className="space-y-3">
                      {reasonEntries.map(({ key, label, icon: ReasonIcon, color }) => {
                        if (!reasons[key]) return null
                        return (
                          <div key={key} className="rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <ReasonIcon size={14} className={color} />
                              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{label}</span>
                            </div>
                            <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
                              {reasons[key]}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* CTA Buttons */}
                  <div className="flex gap-3 pt-2 sticky bottom-0 bg-white dark:bg-gray-900 pb-2">
                    <button 
                      onClick={() => window.open('#', '_blank')}
                      className="flex-1 flex items-center justify-center gap-2 h-12 bg-brand-500 text-white rounded-xl font-bold hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20"
                    >
                      <ExternalLink size={18} />
                      View Original
                    </button>
                    <button 
                      onClick={handleCopyScript}
                      className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl font-bold transition-all ${
                        copiedScript
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10'
                      }`}
                    >
                      {copiedScript ? <CheckCheck size={18} /> : <Copy size={18} />}
                      {copiedScript ? 'Copied!' : 'Copy Ad Script'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
