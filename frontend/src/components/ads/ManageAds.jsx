import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  Plus,
  DollarSign,
  Eye,
  MousePointerClick,
  Target,
  Pause,
  Play,
  Pencil,
  ChevronRight,
  ChevronLeft,
  Link2,
  CheckCircle2,
  Rocket,
  X,
  TrendingUp,
  BarChart3,
  Users,
  Zap,
  Copy,
  CheckCheck,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  MessageSquare,
  Send,
  Bot
} from 'lucide-react'
import Dialog from '../common/Dialog'
import { apiFetch } from '../../utils/api.js'

/* ─── Inline Platform Icons (same pattern as Discover.jsx) ─── */
const FacebookIcon = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z"/>
  </svg>
)
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

/* ─── Mock Data ─── */
const mockConnectedAccounts = [
  { id: 1, platform: 'Facebook', name: 'BrightSmile Dental (Main)', status: 'Connected', icon: FacebookIcon, color: '#1877F2', username: 'brightsmile_main', avatar: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=100&h=100&fit=crop' },
  { id: 2, platform: 'Facebook', name: 'BrightSmile - Beverly Hills', status: 'Connected', icon: FacebookIcon, color: '#1877F2', username: 'brightsmile_bh', avatar: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=100&h=100&fit=crop' },
  { id: 3, platform: 'TikTok', name: '@brightsmiledental', status: 'Connected', icon: TikTokIcon, color: '#000000', username: 'brightsmile_tiktok', avatar: 'https://images.unsplash.com/photo-1516062423079-7ca13cdc7f5a?w=100&h=100&fit=crop' },
]

const mockMetrics = [
  { label: 'Total Spend', value: '$4,280', change: '+12%', trend: 'up', icon: DollarSign, iconColor: 'text-brand-500', bgColor: 'bg-brand-50 dark:bg-brand-500/10' },
  { label: 'Impressions', value: '284K', change: '+8%', trend: 'up', icon: Eye, iconColor: 'text-violet-500', bgColor: 'bg-violet-50 dark:bg-violet-500/10' },
  { label: 'Clicks', value: '12.4K', change: '+24%', trend: 'up', icon: MousePointerClick, iconColor: 'text-emerald-500', bgColor: 'bg-emerald-50 dark:bg-emerald-500/10' },
  { label: 'Conversions', value: '842', change: '-3%', trend: 'down', icon: Target, iconColor: 'text-amber-500', bgColor: 'bg-amber-50 dark:bg-amber-500/10' },
]

const initialCampaigns = [
  { id: 1, name: 'Teeth Whitening Promo', platform: 'Facebook', status: 'Active', budget: '$500', spend: '$342.50', ctr: '3.2%', impressions: '45.2K', clicks: '1,446', conversions: '89' },
  { id: 2, name: 'Invisalign Awareness', platform: 'TikTok', status: 'Active', budget: '$750', spend: '$608.20', ctr: '4.8%', impressions: '92.1K', clicks: '4,420', conversions: '214' },
  { id: 3, name: 'Kids Dental Check-Up', platform: 'Facebook', status: 'Paused', budget: '$300', spend: '$187.00', ctr: '2.1%', impressions: '28.3K', clicks: '594', conversions: '42' },
  { id: 4, name: 'Summer Smile Makeover', platform: 'TikTok', status: 'Active', budget: '$1,000', spend: '$821.30', ctr: '5.1%', impressions: '118.4K', clicks: '6,038', conversions: '312' },
  { id: 5, name: 'Emergency Dental Care', platform: 'Facebook', status: 'Paused', budget: '$250', spend: '$125.80', ctr: '1.8%', impressions: '15.6K', clicks: '280', conversions: '18' },
  { id: 6, name: 'New Patient Welcome Offer', platform: 'Facebook', status: 'Active', budget: '$400', spend: '$295.10', ctr: '3.7%', impressions: '38.9K', clicks: '1,439', conversions: '167' },
]

const mockDrafts = [
  { id: 1, headline: 'Teeth Whitening Holiday Promo', caption: 'Brighten your smile for the holidays! 🎁 Get 25% off professional whitening throughout December.', platform: 'Facebook' },
  { id: 2, headline: 'New Patient Welcome Package', caption: 'Welcome to our clinic! New patients get a free cleaning with their first exam. Book now!', platform: 'Facebook' },
  { id: 3, headline: 'Invisalign Transformation', caption: 'See how Sarah transformed her smile in just 6 months. Ask us about Invisalign today! ✨', platform: 'TikTok' },
  { id: 4, headline: 'Kids Dental Day', caption: 'Making dentist visits fun for kids! 🎈 Schedule your child\'s check-up for our upcoming event.', platform: 'Facebook' },
]

const platformOptions = ['All', 'Facebook', 'TikTok']
const statusOptions = ['All', 'Active', 'Paused']

/* ─── Create Campaign Step Data ─── */
const stepLabels = ['Platform', 'Creative', 'Audience', 'Budget', 'Review']

export default function ManageAds() {
  const [connectedAccounts, setConnectedAccounts] = useState(mockConnectedAccounts)
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [showAddAccountModal, setShowAddAccountModal] = useState(false)
  const [addingPlatform, setAddingPlatform] = useState(null)
  
  // Dashboard state
  const [campaigns, setCampaigns] = useState([])
  const [filterPlatform, setFilterPlatform] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createStep, setCreateStep] = useState(0)
  const [selectedCampaign, setSelectedCampaign] = useState(null)

  // Drafts state
  const [showDraftsList, setShowDraftsList] = useState(false)

  // Meta Connect flow state
  const [showMetaModal, setShowMetaModal] = useState(false)
  const [metaStep, setMetaStep] = useState(0)
  const [syncProgress, setSyncProgress] = useState(0)

  // AI Assist state
  const [isAiGenerating, setIsAiGenerating] = useState(false)

  // Load campaigns when account is selected
useEffect(() => {
if (!selectedAccount) return
const loadCampaigns = async () => {
try {
const data = await apiFetch('/api/campaigns')
setCampaigns(data.campaigns || [])
} catch (err) {
console.error('Failed to load campaigns:', err)
}
}
loadCampaigns()
}, [selectedAccount])

// AI Chatbot state
  const [showChat, setShowChat] = useState(false)
  const [chatMessages, setChatMessages] = useState([
    { id: 1, role: 'ai', text: `Hi! I'm your FixMyLeads AI Assistant. I can help you build ad campaigns, analyze your performance, or answer any questions about the platform. What's on your mind?`, timestamp: new Date() }
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [chatProposal, setChatProposal] = useState(null)
  const chatEndRef = useRef(null)
  const chatInputRef = useRef(null)

  const quickActions = [
    { label: '🚀 Build Campaign', prompt: 'I want to build a new ad campaign' },
    { label: '✍️ Improve Headline', prompt: 'Can you help me improve my ad headline?' },
    { label: '📊 Explain Stats', prompt: 'Why is my CTR lower this week?' },
    { label: '🎯 Targeting Advice', prompt: 'Who should I target for teeth whitening?' },
  ]

  // Create campaign form state
  const [newCampaign, setNewCampaign] = useState({
    platform: '',
    headline: '',
    caption: '',
    audience: 'general',
    location: '',
    ageRange: '18-65',
    budget: '',
    duration: '7',
  })

  /* ─── Handlers ─── */
  const toggleCampaignStatus = useCallback(async (id) => {
    // Find the campaign to get its current status
    const campaign = campaigns.find(c => c.id === id);
    if (!campaign) return;

    // Toggle the status locally first for immediate UI feedback
    const newStatus = campaign.status === 'Active' ? 'Paused' : 'Active';
    setCampaigns(prev => prev.map(c => 
      c.id === id ? { ...c, status: newStatus } : c
    ));

try {
await apiFetch(`/api/campaigns/${id}/status`, {
method: 'PUT',
body: JSON.stringify({ status: newStatus.toLowerCase() })
});
} catch (err) {
console.error('Failed to update campaign status:', err);
setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: campaign.status } : c));
}
  }, [campaigns]);

const filteredCampaigns = campaigns.filter(c => {
const matchPlatform = !selectedAccount || c.platform === selectedAccount?.platform
const matchStatus = filterStatus === 'All' || c.status === filterStatus
return matchPlatform && matchStatus
})

  const handleOpenCreate = () => {
    // Start directly from Creative (step 1) since platform is pre-determined
    setCreateStep(1)
    setShowDraftsList(false)
    setNewCampaign({ 
      platform: selectedAccount.platform, 
      headline: '', 
      caption: '', 
      audience: 'general', 
      location: '', 
      ageRange: '18-65', 
      budget: '', 
      duration: '7' 
    })
    setShowCreateModal(true)
  }

  const handleApplyDraft = (draft) => {
    setNewCampaign(prev => ({
      ...prev,
      headline: draft.headline,
      caption: draft.caption
    }))
    setShowDraftsList(false)
  }

  const handleLaunch = async () => {
    // Validate required fields
    if (!newCampaign.headline || !newCampaign.budget) {
      console.error('Headline and budget are required');
      return;
    }

try {
const campaign = {
name: newCampaign.headline,
platform: newCampaign.platform,
budget: parseFloat(newCampaign.budget),
status: 'active',
start_date: new Date().toISOString().split('T')[0],
end_date: new Date(Date.now() + parseInt(newCampaign.duration) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
metadata: {
headline: newCampaign.headline,
caption: newCampaign.caption,
audience: newCampaign.audience,
location: newCampaign.location,
ageRange: newCampaign.ageRange
}
};
const result = await apiFetch('/api/campaigns', {
method: 'POST',
body: JSON.stringify({ campaign }),
});
if (result.success) {
const launched = {
id: result.id,
name: newCampaign.headline || 'New Campaign',
platform: newCampaign.platform || 'Facebook',
status: 'Active',
budget: `${newCampaign.budget || '0'}`,
spend: '$0.00',
ctr: '0.0%',
impressions: '0',
clicks: '0',
conversions: '0',
}
setCampaigns(prev => [launched, ...prev]);
setShowCreateModal(false);
}
} catch (err) {
console.error('Failed to create campaign:', err);
}
  };

  const handleAddAccount = (platform) => {
    setAddingPlatform(platform)
    setShowAddAccountModal(true)
  }

  const handleConnectMetaBusiness = () => {
    setMetaStep(0)
    setSyncProgress(0)
    setShowMetaModal(true)
  }

  const startMetaSync = () => {
    setMetaStep(2) // Jump to sync
    let progress = 0
    const interval = setInterval(() => {
      progress += Math.random() * 15
      if (progress >= 100) {
        setSyncProgress(100)
        clearInterval(interval)
        setTimeout(() => setMetaStep(3), 600) // Go to success
      } else {
        setSyncProgress(progress)
      }
    }, 400)
  }

  const completeMetaConnection = () => {
    setConnectedAccounts(prev => prev.map(acc => 
      acc.id === selectedAccount.id ? { ...acc, metaConnected: true } : acc
    ))
    setSelectedAccount(prev => ({ ...prev, metaConnected: true }))
    setShowMetaModal(false)
  }

  const handleAiAssist = () => {
    setIsAiGenerating(true)
    // Mock AI generation delay
    setTimeout(() => {
      setNewCampaign(prev => ({
        ...prev,
        headline: "Professional Teeth Whitening | 50% Off First Visit",
        caption: "Transform your smile with our expert whitening treatment. Safe, fast, and remarkably effective. Book your appointment today and join 1,000+ happy patients! ✨"
      }))
      setIsAiGenerating(false)
    }, 1500)
  }

  // ─── AI Chat Helpers ───
  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, chatLoading])

  const parseCampaignFromMessage = (msg) => {
    const lower = msg.toLowerCase()
    let audience = 'general'
    let location = ''
    let budget = '500'
    let headline = ''
    let caption = ''
    let ageRange = '18-65'

    // Parse audience
    if (lower.includes('overdue') || lower.includes('recall')) audience = 'overdue-patients'
    else if (lower.includes('parent') || lower.includes('kid') || lower.includes('children')) audience = 'parents'
    else if (lower.includes('young') || lower.includes('cosmetic') || lower.includes('whitening')) audience = 'young-adults'
    else if (lower.includes('senior') || lower.includes('elder')) audience = 'seniors'

    // Parse location
    const locationMatch = msg.match(/(?:in|near|around|targeting)\s+([A-Z][a-zA-Z\s,]+?)(?:\.|,|\s+targeting|\s+budget|\s+for|$)/i)
    if (locationMatch) location = locationMatch[1].trim()

    // Parse budget
    const budgetMatch = msg.match(/(?:budget|spend|\$|₦|NGN)\s*([\d,]+)/i)
    if (budgetMatch) budget = budgetMatch[1].replace(/,/g, '')

    // Generate contextual creative
    if (audience === 'overdue-patients') {
      headline = 'It\'s Time For Your Check-Up!'
      caption = `Don't let your dental health fall behind. Book your overdue appointment today and get 15% off your next visit.${location ? ` Serving ${location}.` : ''} Your smile deserves attention! 🦷`
      ageRange = '25-65'
    } else if (audience === 'parents') {
      headline = 'Kids Dental Day — Fun & Painless!'
      caption = `Make your child's dental visit an adventure! 🎈 Gentle care, friendly staff, and zero tears.${location ? ` Now in ${location}.` : ''} Book today!`
      ageRange = '25-50'
    } else if (audience === 'young-adults') {
      headline = 'Get Your Dream Smile ✨'
      caption = `Professional whitening & cosmetic treatments starting at just $99.${location ? ` Visit us in ${location}.` : ''} Results in one session!`
      ageRange = '18-35'
    } else {
      headline = 'Your Smile, Our Priority'
      caption = `Professional dental care tailored for you.${location ? ` Now serving ${location}.` : ''} Book your appointment and experience the difference. 😁`
    }

    return {
      platform: selectedAccount.platform,
      headline,
      caption,
      audience,
      location,
      ageRange,
      budget,
      duration: '14'
    }
  }

  const handleChatSend = (customPrompt = null) => {
    const text = customPrompt || chatInput.trim()
    if (!text || chatLoading) return

    const userMsg = { id: Date.now(), role: 'user', text, timestamp: new Date() }
    setChatMessages(prev => [...prev, userMsg])
    setChatInput('')
    setChatLoading(true)

    // Simulate AI thinking & streaming
    setTimeout(() => {
      const lower = text.toLowerCase()
      let fullText = ""
      let proposal = null

      // Intent logic
      const isCampaignReq = lower.includes('ad') || lower.includes('campaign') || lower.includes('run') || lower.includes('target') || lower.includes('budget') || lower.includes('build')

      if (isCampaignReq && (lower.includes('build') || lower.includes('create') || lower.includes('set up') || lower.includes(' lagos') || lower.includes('overdue'))) {
        proposal = parseCampaignFromMessage(text)
        fullText = `I've put together a campaign strategy based on your request. Here's a preview of the setup:`
      } else if (lower.includes('improve') || lower.includes('headline') || lower.includes('caption')) {
        fullText = "Of course! For dental ads, I recommend using **benefit-driven hooks**. \n\nInstead of 'We do whitening', try: \n• 'Get a Celebrity Smile in 1 Hour' \n• 'Professional Whitening - 50% Off This Week' \n\nWhich one fits your clinic's brand better?"
      } else if (lower.includes('stats') || lower.includes('performance') || lower.includes('ctr') || lower.includes('low')) {
        fullText = `I've analyzed your campaigns for **${selectedAccount?.name}**. \n\nYour average CTR is 2.4%, which is solid! However, the 'Overdue Patients' ad is dipping. I suggest refreshing the creative or adding an 'urgency' trigger like 'Limited Slots Available' to boost clicks.`
      } else if (lower.includes('meta') || lower.includes('facebook') || lower.includes('connect')) {
        fullText = "To connect your **Meta Business Suite**, use the green button in the top right. This enables real-time syncing of your ad assets and direct deployment from FixMyLeads."
      } else if (lower.includes('targeting') || lower.includes('who')) {
        fullText = "For **Teeth Whitening**, the best ROI usually comes from targeting: \n1. Engaged shoppers (25-45) \n2. People with upcoming life events (weddings, graduations) \n3. Residents within a 10-mile radius of your clinic."
      } else {
        fullText = "I'm here to help with all things FixMyLeads! I can build campaigns, optimize your copy, or explain your marketing data. What would you like to focus on next?"
      }

      // Streaming effect simulation
      setIsTyping(true)
      const aiMsgId = Date.now() + 1
      setChatMessages(prev => [...prev, { id: aiMsgId, role: 'ai', text: '', timestamp: new Date(), isStreaming: true }])
      
      let currentText = ""
      const words = fullText.split(" ")
      let i = 0

      const interval = setInterval(() => {
        if (i < words.length) {
          currentText += (i === 0 ? "" : " ") + words[i]
          setChatMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: currentText } : m))
          i++
        } else {
          clearInterval(interval)
          setChatMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: fullText, proposal, isStreaming: false } : m))
          setChatLoading(false)
          setIsTyping(false)
          if (proposal) setChatProposal(proposal)
        }
      }, 50)
    }, 1000)
  }

  const handleRegenerate = () => {
    const lastUserMsg = [...chatMessages].reverse().find(m => m.role === 'user')
    if (lastUserMsg) {
      handleChatSend(lastUserMsg.text)
    }
  }

  const clearChat = () => {
    setChatMessages([{ id: 1, role: 'ai', text: `Hi! I'm your FixMyLeads AI Assistant. How can I help you today?`, timestamp: new Date() }])
    setChatProposal(null)
  }

  const handleChatLaunch = (proposal) => {
    const launched = {
      id: campaigns.length + 1,
      name: proposal.headline,
      platform: proposal.platform,
      status: 'Active',
      budget: `$${proposal.budget}`,
      spend: '$0.00',
      ctr: '0.0%',
      impressions: '0',
      clicks: '0',
      conversions: '0'
    }
    setCampaigns(prev => [launched, ...prev])
    setChatProposal(null)
    const confirmMsg = {
      id: Date.now(),
      role: 'ai',
      text: `🚀 Campaign "${proposal.headline}" is now live! You can track it in the dashboard. Want to create another one?`,
      timestamp: new Date()
    }
    setChatMessages(prev => [...prev, confirmMsg])
  }

  const handleChatEditProposal = (proposal) => {
    // Load proposal into the Create Campaign modal for manual editing
    setNewCampaign(proposal)
    setCreateStep(1)
    setShowCreateModal(true)
    setShowChat(false)
    setChatProposal(null)
    const editMsg = {
      id: Date.now(),
      role: 'ai',
      text: `I've loaded the campaign into the editor so you can fine-tune it. Make your changes and launch when ready!`,
      timestamp: new Date()
    }
    setChatMessages(prev => [...prev, editMsg])
  }

  const handleConnectAccount = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const newAcc = {
      id: connectedAccounts.length + 1,
      platform: addingPlatform,
      name: formData.get('name'),
      username: formData.get('username'),
      status: 'Connected',
      icon: addingPlatform === 'TikTok' ? TikTokIcon : FacebookIcon,
      color: addingPlatform === 'TikTok' ? '#000000' : '#1877F2',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.get('name'))}&background=random`
    }
    setConnectedAccounts(prev => [...prev, newAcc])
    setShowAddAccountModal(false)
  }

  /* ─── Shared component classes (matching existing system) ─── */
  const selectClass = "h-11 rounded-xl border border-gray-200 bg-gray-50/50 px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.02] dark:text-white/90 dark:focus:border-brand-500 dark:focus:bg-gray-900 appearance-none cursor-pointer transition-colors"
  const inputClass = "h-11 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.02] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-500 dark:focus:bg-gray-900 transition-colors"

  // ─── Account Selection View ───
  if (!selectedAccount) {
    return (
      <div className="p-6 lg:p-10 transition-colors">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Ads</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Select an ad account to continue or connect a new one</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Facebook / Instagram Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1877F2]/10 flex items-center justify-center text-[#1877F2]">
                  <FacebookIcon size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Facebook / Instagram</h3>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                    {connectedAccounts.filter(a => a.platform === 'Facebook').length} Accounts Connected
                  </p>
                </div>
              </div>
              <button 
                onClick={() => handleAddAccount('Facebook')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-brand-500 bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/10 dark:hover:bg-brand-500/20 transition-colors"
              >
                <Plus size={14} />
                Add Account
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {connectedAccounts.filter(a => a.platform === 'Facebook').map(account => (
                <button
                  key={account.id}
                  onClick={() => setSelectedAccount(account)}
                  className="flex items-center justify-between p-4 rounded-2xl border border-gray-200 bg-white hover:border-brand-500 hover:shadow-theme-md dark:border-gray-800 dark:bg-white/[0.03] transition-all group text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <img src={account.avatar} className="w-12 h-12 rounded-xl object-cover" alt={account.name} />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#1877F2] border-2 border-white dark:border-gray-900 flex items-center justify-center text-white">
                        <FacebookIcon size={10} />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{account.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">@{account.username}</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 group-hover:text-brand-500 group-hover:translate-x-1 transition-all" />
                </button>
              ))}
              {connectedAccounts.filter(a => a.platform === 'Facebook').length === 0 && (
                <div className="py-8 text-center rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/[0.01]">
                  <p className="text-xs text-gray-400">No Facebook accounts connected</p>
                </div>
              )}
            </div>
          </div>

          {/* TikTok Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-black/10 flex items-center justify-center text-black dark:bg-white/10 dark:text-white">
                  <TikTokIcon size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">TikTok Ads</h3>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                    {connectedAccounts.filter(a => a.platform === 'TikTok').length} Accounts Connected
                  </p>
                </div>
              </div>
              <button 
                onClick={() => handleAddAccount('TikTok')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-brand-500 bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/10 dark:hover:bg-brand-500/20 transition-colors"
              >
                <Plus size={14} />
                Add Account
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {connectedAccounts.filter(a => a.platform === 'TikTok').map(account => (
                <button
                  key={account.id}
                  onClick={() => setSelectedAccount(account)}
                  className="flex items-center justify-between p-4 rounded-2xl border border-gray-200 bg-white hover:border-brand-500 hover:shadow-theme-md dark:border-gray-800 dark:bg-white/[0.03] transition-all group text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <img src={account.avatar} className="w-12 h-12 rounded-xl object-cover" alt={account.name} />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-black border-2 border-white dark:border-gray-900 flex items-center justify-center text-white">
                        <TikTokIcon size={10} />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{account.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{account.username}</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 group-hover:text-brand-500 group-hover:translate-x-1 transition-all" />
                </button>
              ))}
              {connectedAccounts.filter(a => a.platform === 'TikTok').length === 0 && (
                <div className="py-8 text-center rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/[0.01]">
                  <p className="text-xs text-gray-400">No TikTok accounts connected</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add Account Modal */}
        <Dialog isOpen={showAddAccountModal} onClose={() => setShowAddAccountModal(false)} title={`Connect ${addingPlatform} Account`}>
          <form onSubmit={handleConnectAccount} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 block">Account Name</label>
              <input name="name" required type="text" className={inputClass} placeholder="e.g. BrightSmile Dental" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 block">Username / ID</label>
              <input name="username" required type="text" className={inputClass} placeholder="e.g. brightsmile_ads" />
            </div>
            <div className="pt-2">
              <button type="submit" className="w-full flex items-center justify-center h-12 bg-brand-500 text-white rounded-xl font-bold hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20">
                Connect Account
              </button>
            </div>
          </form>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 transition-colors">
      {/* ─── Page Header ─── */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSelectedAccount(null)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:border-brand-500 hover:text-brand-500 dark:border-gray-800 dark:bg-white/[0.03] transition-all"
            title="Switch Account"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedAccount.name}</h1>
              <span className="px-2 py-0.5 rounded-md bg-brand-50 text-[10px] font-bold text-brand-500 uppercase dark:bg-brand-500/10 border border-brand-500/20">
                {selectedAccount.platform}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Manage campaigns and track performance</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {selectedAccount.platform === 'Facebook' && (
            <button
              onClick={handleConnectMetaBusiness}
              className={`flex items-center gap-2 h-11 px-5 rounded-xl text-sm font-bold transition-all ${
                selectedAccount.metaConnected
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                  : 'bg-white text-[#1877F2] border border-[#1877F2]/20 hover:bg-[#1877F2]/5 dark:bg-white/5 dark:text-white dark:border-white/10 dark:hover:bg-white/10'
              }`}
            >
              <FacebookIcon size={18} />
              {selectedAccount.metaConnected ? 'Meta Connected' : 'Connect Meta Business'}
            </button>
          )}
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 h-11 px-5 bg-brand-500 text-white rounded-xl text-sm font-bold hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20"
          >
            <Plus size={18} />
            Create Campaign
          </button>
        </div>
      </div>

      {/* Removed the old Connected Accounts section as it's now handled by the selection screen */}

      {/* ═══ 2. METRICS OVERVIEW ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
        {mockMetrics.map((metric, i) => {
          const Icon = metric.icon
          return (
            <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="flex items-center justify-between mb-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${metric.bgColor}`}>
                  <Icon size={20} className={metric.iconColor} />
                </div>
                <div className={`flex items-center gap-1 text-xs font-semibold ${metric.trend === 'up' ? 'text-success-500' : 'text-error-500'}`}>
                  {metric.trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {metric.change}
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{metric.value}</p>
              <p className="text-xs text-gray-400 mt-1">{metric.label}</p>
            </div>
          )
        })}
      </div>

      {/* ═══ 3. FILTER BAR ═══ */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Platform filter removed as it's now scoped to selectedAccount */}

          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={selectClass}
            >
              {statusOptions.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"/></svg>
            </div>
          </div>

          <input
            type="text"
            placeholder="Date range (e.g. Apr 1 – Apr 30)"
            className={`${inputClass} w-56`}
            readOnly
          />

          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
            Showing {filteredCampaigns.length} of {campaigns.length} campaigns
          </span>
        </div>
      </div>

      {/* ═══ 4. CAMPAIGNS TABLE ═══ */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Campaign</th>
                <th className="px-4 py-4 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Platform</th>
                <th className="px-4 py-4 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-4 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Budget</th>
                <th className="px-4 py-4 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Spend</th>
                <th className="px-4 py-4 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">CTR</th>
                <th className="px-4 py-4 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCampaigns.map(campaign => {
                const PlatIcon = campaign.platform === 'TikTok' ? TikTokIcon : FacebookIcon
                return (
                  <tr
                    key={campaign.id}
                    onClick={() => setSelectedCampaign(campaign)}
                    className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{campaign.name}</p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <PlatIcon size={14} className="text-gray-500 dark:text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">{campaign.platform}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider ${
                        campaign.status === 'Active'
                          ? 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-500'
                          : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${campaign.status === 'Active' ? 'bg-success-500' : 'bg-gray-400'}`} />
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-medium text-gray-700 dark:text-gray-300">{campaign.budget}</td>
                    <td className="px-4 py-4 text-right text-sm font-medium text-gray-700 dark:text-gray-300">{campaign.spend}</td>
                    <td className="px-4 py-4 text-right text-sm font-semibold text-gray-900 dark:text-white">{campaign.ctr}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => toggleCampaignStatus(campaign.id)}
                          title={campaign.status === 'Active' ? 'Pause' : 'Resume'}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-200 transition-all"
                        >
                          {campaign.status === 'Active' ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                        <button
                          title="Edit"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-200 transition-all"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredCampaigns.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-400">No campaigns match your current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ 6. CREATE CAMPAIGN MODAL (Multi-Step) ═══ */}
      <Dialog isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Campaign">
        <div className="space-y-6">
          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {stepLabels.slice(1).map((label, i) => {
              const stepIndex = i + 1; // Actual step index in code
              return (
                <React.Fragment key={label}>
                  <div className="flex items-center gap-2">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      stepIndex < createStep ? 'bg-success-500 text-white'
                      : stepIndex === createStep ? 'bg-brand-500 text-white'
                      : 'bg-gray-100 text-gray-400 dark:bg-white/5'
                    }`}>
                      {stepIndex < createStep ? <CheckCircle2 size={14} /> : i + 1}
                    </div>
                    <span className={`text-xs font-semibold hidden sm:inline ${stepIndex === createStep ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>{label}</span>
                  </div>
                  {i < stepLabels.length - 2 && (
                    <div className={`flex-1 h-0.5 mx-1 rounded-full ${stepIndex < createStep ? 'bg-success-500' : 'bg-gray-100 dark:bg-white/5'}`} />
                  )}
                </React.Fragment>
              )
            })}
          </div>


          {/* Step 2: Creative */}
          {createStep === 1 && (
            <div className="space-y-6">
              {/* AI Assist Section */}
              <div 
                onClick={handleAiAssist}
                className="group p-4 rounded-xl border border-brand-500/20 bg-brand-50/30 dark:bg-brand-500/5 flex items-center justify-between gap-4 cursor-pointer hover:border-brand-500/40 hover:bg-brand-50/50 dark:hover:bg-brand-500/10 transition-all active:scale-[0.99]"
              >
                <div className="flex items-start gap-3">
                  <div className={`h-8 w-8 rounded-lg ${isAiGenerating ? 'bg-gray-100 animate-pulse' : 'bg-brand-500'} flex items-center justify-center text-white shrink-0 transition-colors`}>
                    {isAiGenerating ? <Zap size={16} className="text-gray-400 animate-spin" /> : <Sparkles size={16} />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white">AI Assist ("Auto")</h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed mt-0.5">
                      {isAiGenerating ? 'Generating optimized content...' : 'Click to generate headline, caption, and structure automatically.'}
                    </p>
                  </div>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white bg-brand-500 hover:bg-brand-600 shadow-md shadow-brand-500/10 transition-colors">
                  {isAiGenerating ? 'Processing...' : 'Get AI Help'}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-900 dark:text-white">Ad Creative</p>
                <button 
                  onClick={() => setShowDraftsList(!showDraftsList)}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-brand-500 bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/10 dark:hover:bg-brand-500/20 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <Copy size={14} />
                  {showDraftsList ? 'Cancel' : 'Import from Drafts'}
                </button>
              </div>

              {showDraftsList ? (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Your saved drafts ({mockDrafts.filter(d => d.platform === selectedAccount.platform).length})</p>
                  <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {mockDrafts.filter(d => d.platform === selectedAccount.platform).map(draft => (
                      <button
                        key={draft.id}
                        onClick={() => handleApplyDraft(draft)}
                        className="flex flex-col text-left p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:border-brand-500 hover:bg-brand-500/[0.04] dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-brand-500/20 transition-all"
                      >
                        <span className="text-xs font-bold text-gray-900 dark:text-white mb-1">{draft.headline}</span>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1">{draft.caption}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 block">Headline</label>
                    <input
                      type="text"
                      value={newCampaign.headline}
                      onChange={(e) => setNewCampaign(prev => ({ ...prev, headline: e.target.value }))}
                      className={inputClass}
                      placeholder="e.g. Get a Brighter Smile Today!"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 block">Caption / Description</label>
                    <textarea
                      value={newCampaign.caption}
                      onChange={(e) => setNewCampaign(prev => ({ ...prev, caption: e.target.value }))}
                      rows={4}
                      className={`${inputClass} h-auto py-3 resize-none custom-scrollbar`}
                      placeholder="Write compelling ad copy..."
                    />
                  </div>
                </>
              )}
              
              {!showDraftsList && (
                <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/[0.02] p-6 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Drag & drop media or <span className="text-brand-500 font-semibold cursor-pointer">browse files</span></p>
                  <p className="text-[11px] text-gray-400 mt-1">PNG, JPG, MP4 up to 50MB</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Audience */}
          {createStep === 2 && (
            <div className="space-y-4">
              <p className="text-sm font-bold text-gray-900 dark:text-white">Define Audience</p>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 block">Target Audience</label>
                <div className="relative">
                  <select
                    value={newCampaign.audience}
                    onChange={(e) => setNewCampaign(prev => ({ ...prev, audience: e.target.value }))}
                    className={`${selectClass} w-full`}
                  >
                    <option value="general">General Patients</option>
                    <option value="parents">Parents with Kids</option>
                    <option value="young-adults">Young Adults (18-35)</option>
                    <option value="seniors">Seniors (55+)</option>
                    <option value="cosmetic">Cosmetic-focused</option>
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"/></svg>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 block">Location</label>
                <input
                  type="text"
                  value={newCampaign.location}
                  onChange={(e) => setNewCampaign(prev => ({ ...prev, location: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g. Los Angeles, CA — 25 mile radius"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 block">Age Range</label>
                <div className="relative">
                  <select
                    value={newCampaign.ageRange}
                    onChange={(e) => setNewCampaign(prev => ({ ...prev, ageRange: e.target.value }))}
                    className={`${selectClass} w-full`}
                  >
                    <option value="18-25">18 – 25</option>
                    <option value="25-35">25 – 35</option>
                    <option value="35-50">35 – 50</option>
                    <option value="50-65">50 – 65</option>
                    <option value="18-65">18 – 65 (All)</option>
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"/></svg>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Budget */}
          {createStep === 3 && (
            <div className="space-y-4">
              <p className="text-sm font-bold text-gray-900 dark:text-white">Set Budget</p>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 block">Daily Budget ($)</label>
                <input
                  type="number"
                  value={newCampaign.budget}
                  onChange={(e) => setNewCampaign(prev => ({ ...prev, budget: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g. 50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 block">Duration (days)</label>
                <div className="relative">
                  <select
                    value={newCampaign.duration}
                    onChange={(e) => setNewCampaign(prev => ({ ...prev, duration: e.target.value }))}
                    className={`${selectClass} w-full`}
                  >
                    <option value="3">3 days</option>
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                    <option value="30">30 days</option>
                    <option value="ongoing">Ongoing</option>
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"/></svg>
                  </div>
                </div>
              </div>
              {newCampaign.budget && newCampaign.duration !== 'ongoing' && (
                <div className="rounded-xl bg-brand-50 dark:bg-brand-500/10 p-4 border border-brand-500/20">
                  <p className="text-sm text-brand-500 font-semibold">Estimated Total: ${(Number(newCampaign.budget) * Number(newCampaign.duration)).toLocaleString()}</p>
                  <p className="text-xs text-brand-500/60 mt-0.5">${newCampaign.budget}/day × {newCampaign.duration} days</p>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Review */}
          {createStep === 4 && (
            <div className="space-y-4">
              <p className="text-sm font-bold text-gray-900 dark:text-white">Review Campaign</p>
              <div className="space-y-3">
                {[
                  { label: 'Platform', value: newCampaign.platform || '—' },
                  { label: 'Headline', value: newCampaign.headline || '—' },
                  { label: 'Caption', value: newCampaign.caption ? (newCampaign.caption.length > 60 ? newCampaign.caption.slice(0, 60) + '…' : newCampaign.caption) : '—' },
                  { label: 'Audience', value: newCampaign.audience },
                  { label: 'Location', value: newCampaign.location || '—' },
                  { label: 'Age Range', value: newCampaign.ageRange },
                  { label: 'Daily Budget', value: newCampaign.budget ? `$${newCampaign.budget}` : '—' },
                  { label: 'Duration', value: newCampaign.duration === 'ongoing' ? 'Ongoing' : `${newCampaign.duration} days` },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{row.label}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            {createStep > 1 ? (
              <button
                onClick={() => setCreateStep(s => s - 1)}
                className="flex items-center gap-2 h-11 px-5 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:border-gray-700 transition-all"
              >
                <ChevronLeft size={16} />
                Back
              </button>
            ) : <div />}

            {createStep < stepLabels.length - 1 ? (
              <button
                onClick={() => setCreateStep(s => s + 1)}
                className="flex items-center gap-2 h-11 px-6 bg-brand-500 text-white rounded-xl text-sm font-bold hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20"
              >
                Next
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleLaunch}
                className="flex items-center gap-2 h-11 px-6 bg-brand-500 text-white rounded-xl text-sm font-bold hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20"
              >
                <Rocket size={16} />
                Launch Campaign
              </button>
            )}
          </div>
        </div>
      </Dialog>

      {/* ═══ 8. META CONNECT MODAL (Multi-Step) ═══ */}
      <Dialog isOpen={showMetaModal} onClose={() => setShowMetaModal(false)} title="Connect Meta Business Suite">
        <div className="space-y-6">
          {/* Step 1: Welcome & Auth */}
          {metaStep === 0 && (
            <div className="text-center space-y-6 py-4">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="h-20 w-20 rounded-2xl bg-[#1877F2]/10 flex items-center justify-center text-[#1877F2]">
                    <FacebookIcon size={40} />
                  </div>
                  <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-emerald-500 border-4 border-white dark:border-gray-900 flex items-center justify-center text-white">
                    <CheckCircle2 size={16} />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Professional Integration</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                  Connect {selectedAccount?.name} to sync your business assets, ad accounts, and advanced performance tracking.
                </p>
              </div>
              <div className="pt-4">
                <button 
                  onClick={() => setMetaStep(1)}
                  className="w-full flex items-center justify-center gap-3 h-14 bg-[#1877F2] text-white rounded-xl font-bold hover:bg-[#1464c7] transition-all shadow-lg shadow-[#1877F2]/20 active:scale-[0.98]"
                >
                  <FacebookIcon size={20} />
                  Continue with Meta Business
                </button>
                <p className="mt-4 text-[11px] text-gray-400">
                  By continuing, you agree to grant FixMyLeads permission to manage your business assets and view performance data.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Asset Selection */}
          {metaStep === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Select Business Assets</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Choose the pages and ad accounts you want to sync.</p>
              </div>
              
              <div className="space-y-3">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1">Pages</p>
                {[
                  { name: 'Elite Dental Group', selected: true },
                  { name: 'Smile Studio (Beverly Hills)', selected: false },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#1877F2]/10 flex items-center justify-center text-[#1877F2]">
                        <FacebookIcon size={16} />
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.name}</span>
                    </div>
                    <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors ${item.selected ? 'bg-brand-500 border-brand-500 text-white' : 'border-gray-300 dark:border-gray-700'}`}>
                      {item.selected && <CheckCircle2 size={14} />}
                    </div>
                  </div>
                ))}

                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1 mt-4">Ad Accounts</p>
                <div className="flex items-center justify-between p-4 rounded-xl border border-brand-500/30 bg-brand-50/30 dark:bg-brand-500/10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-500">
                      <Target size={16} />
                    </div>
                    <span className="text-sm font-bold text-brand-600 dark:text-brand-400">Main Advertising Account</span>
                  </div>
                  <div className="h-5 w-5 rounded-md bg-brand-500 border-2 border-brand-500 flex items-center justify-center text-white">
                    <CheckCircle2 size={14} />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={startMetaSync}
                  className="w-full flex items-center justify-center h-12 bg-brand-500 text-white rounded-xl font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20"
                >
                  Confirm & Sync Assets
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Syncing Animation */}
          {metaStep === 2 && (
            <div className="text-center py-12 space-y-8">
              <div className="flex justify-center items-center">
                <div className="relative w-24 h-24">
                  <div className="absolute inset-0 rounded-full border-4 border-gray-100 dark:border-gray-800" />
                  <div className="absolute inset-0 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FacebookIcon size={32} className="text-[#1877F2]" />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Syncing Business Data...</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Establishing secure handshake with Meta Graph API</p>
                </div>
                
                <div className="max-w-xs mx-auto space-y-2">
                  <div className="w-full h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand-500 transition-all duration-300 ease-out"
                      style={{ width: `${syncProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase">
                    <span>{Math.round(syncProgress)}% Complete</span>
                    <span>Importing Assets</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Success */}
          {metaStep === 3 && (
            <div className="text-center py-8 space-y-6">
              <div className="flex justify-center">
                <div className="h-20 w-20 rounded-full bg-success-50 dark:bg-success-500/10 flex items-center justify-center text-success-500">
                  <Rocket size={40} className="animate-bounce" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Connection Successful!</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                  Meta Business Suite is now fully integrated with {selectedAccount?.name}. Advanced tracking is active.
                </p>
              </div>
              <div className="pt-4">
                <button 
                  onClick={completeMetaConnection}
                  className="w-full flex items-center justify-center h-12 bg-success-500 text-white rounded-xl font-bold hover:bg-success-600 transition-all shadow-lg shadow-success-500/20"
                >
                  Enter Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </Dialog>
      <Dialog isOpen={!!selectedCampaign} onClose={() => setSelectedCampaign(null)} title="Campaign Details">
        {selectedCampaign && (() => {
          const PlatIcon = selectedCampaign.platform === 'TikTok' ? TikTokIcon : FacebookIcon
          return (
            <div className="space-y-6">
              {/* Campaign header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                  <PlatIcon size={18} className="text-gray-600 dark:text-gray-300" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">{selectedCampaign.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{selectedCampaign.platform}</span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                      selectedCampaign.status === 'Active' ? 'text-success-500' : 'text-gray-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${selectedCampaign.status === 'Active' ? 'bg-success-500' : 'bg-gray-400'}`} />
                      {selectedCampaign.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Performance stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Impressions', value: selectedCampaign.impressions, icon: Eye, color: 'text-brand-500' },
                  { label: 'Clicks', value: selectedCampaign.clicks, icon: MousePointerClick, color: 'text-emerald-500' },
                  { label: 'CTR', value: selectedCampaign.ctr, icon: TrendingUp, color: 'text-violet-500' },
                  { label: 'Conversions', value: selectedCampaign.conversions, icon: Target, color: 'text-amber-500' },
                ].map(stat => {
                  const StatIcon = stat.icon
                  return (
                    <div key={stat.label} className="rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 p-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <StatIcon size={14} className={stat.color} />
                        <span className="text-[11px] font-semibold text-gray-400 uppercase">{stat.label}</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{stat.value}</p>
                    </div>
                  )
                })}
              </div>

              {/* Budget breakdown */}
              <div className="rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 p-5">
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <BarChart3 size={14} className="text-brand-500" />
                  Budget & Spend
                </h4>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-500">Spent</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{selectedCampaign.spend} / {selectedCampaign.budget}</span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (parseFloat(selectedCampaign.spend.replace(/[$,]/g, '')) / parseFloat(selectedCampaign.budget.replace(/[$,]/g, ''))) * 100)}%`
                    }}
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  {Math.round((parseFloat(selectedCampaign.spend.replace(/[$,]/g, '')) / parseFloat(selectedCampaign.budget.replace(/[$,]/g, ''))) * 100)}% of budget used
                </p>
              </div>

              {/* Performance chart placeholder */}
              <div className="rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-gray-800 p-5">
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <TrendingUp size={14} className="text-emerald-500" />
                  Daily Performance (Last 7 Days)
                </h4>
                {/* Simple bar chart using divs */}
                <div className="flex items-end gap-2 h-28">
                  {[35, 52, 48, 72, 65, 80, 68].map((v, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                      <div
                        className="w-full rounded-t-md bg-brand-500/80 dark:bg-brand-500/60 transition-all hover:bg-brand-500"
                        style={{ height: `${v}%` }}
                      />
                      <span className="text-[9px] text-gray-400">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => { toggleCampaignStatus(selectedCampaign.id); setSelectedCampaign(null) }}
                  className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:border-gray-700 transition-all"
                >
                  {selectedCampaign.status === 'Active' ? <Pause size={16} /> : <Play size={16} />}
                  {selectedCampaign.status === 'Active' ? 'Pause Campaign' : 'Resume Campaign'}
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 h-11 bg-brand-500 text-white rounded-xl text-sm font-bold hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20">
                  <Pencil size={16} />
                  Edit Campaign
                </button>
              </div>
            </div>
          )
        })()}
      </Dialog>

      {/* ═══ AI CHATBOT ═══ */}
      {/* Floating Chat Toggle */}
      <button
        onClick={() => { setShowChat(!showChat); setTimeout(() => chatInputRef.current?.focus(), 200) }}
        className={`fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-xl flex items-center justify-center transition-all active:scale-90 ${
          showChat
            ? 'bg-gray-800 dark:bg-gray-700 text-white rotate-90'
            : 'bg-brand-500 text-white hover:bg-brand-600 shadow-brand-500/30'
        }`}
      >
        {showChat ? <X size={22} /> : <Bot size={22} />}
      </button>

      {/* Chat Panel */}
      <div className={`fixed bottom-24 right-6 z-50 w-[420px] max-w-[calc(100vw-48px)] max-h-[calc(100vh-140px)] rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900 transition-all duration-300 origin-bottom-right flex flex-col ${
        showChat ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
      }`}>
        {/* Chat Header */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="h-9 w-9 rounded-xl bg-brand-500 flex items-center justify-center text-white">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">AI Campaign Builder</h3>
            <p className="text-[10px] text-gray-400 font-medium">Describe your ad and I'll build it</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-success-500 animate-pulse" />
            <span className="text-[10px] font-semibold text-success-500">Online</span>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar mt-4">
          {chatMessages.map((msg, idx) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] space-y-2`}>
                <div className={`px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-brand-500 text-white rounded-br-md shadow-brand-500/10'
                    : 'bg-gray-100 text-gray-800 dark:bg-white/[0.05] dark:text-gray-200 rounded-bl-md'
                }`}>
                  {/* Simple Markdown Rendering */}
                  <div className="whitespace-pre-wrap">
                    {msg.text.split('\n').map((line, i) => {
                      // Bold formatting
                      const parts = line.split(/(\*\*.*?\*\*)/g)
                      return (
                        <p key={i} className={i > 0 ? 'mt-2' : ''}>
                          {parts.map((part, j) => 
                            part.startsWith('**') && part.endsWith('**') 
                              ? <strong key={j} className="font-bold text-gray-900 dark:text-white">{part.slice(2, -2)}</strong> 
                              : part
                          )}
                        </p>
                      )
                    })}
                  </div>
                </div>

                {/* Campaign Proposal Card */}
                {msg.proposal && !msg.isStreaming && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50/80 dark:border-gray-800 dark:bg-white/[0.03] p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Rocket size={14} className="text-brand-500" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Campaign Proposal</span>
                    </div>
                    {[
                      { label: 'Headline', value: msg.proposal.headline },
                      { label: 'Caption', value: msg.proposal.caption.length > 80 ? msg.proposal.caption.slice(0, 80) + '…' : msg.proposal.caption },
                      { label: 'Audience', value: msg.proposal.audience.replace(/-/g, ' ') },
                      { label: 'Location', value: msg.proposal.location || 'Broad' },
                      { label: 'Budget', value: `$${msg.proposal.budget}/day` },
                      { label: 'Duration', value: `${msg.proposal.duration} days` },
                    ].map(row => (
                      <div key={row.label} className="flex items-start justify-between py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider shrink-0">{row.label}</span>
                        <span className="text-[11px] font-medium text-gray-800 dark:text-gray-200 text-right ml-4">{row.value}</span>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => handleChatEditProposal(msg.proposal)}
                        className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-[11px] font-semibold border border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:border-gray-600 transition-all"
                      >
                        <Pencil size={12} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleChatLaunch(msg.proposal)}
                        className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-brand-500 text-white rounded-lg text-[11px] font-bold hover:bg-brand-600 transition-colors shadow-md shadow-brand-500/20"
                      >
                        <Rocket size={12} />
                        Launch Now
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between px-1">
                  <span className="text-[9px] text-gray-400">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.role === 'ai' && idx === chatMessages.length - 1 && !msg.isStreaming && (
                    <button 
                      onClick={handleRegenerate}
                      className="text-[10px] font-bold text-brand-500 hover:text-brand-600 transition-colors flex items-center gap-1"
                    >
                      <Zap size={10} />
                      Regenerate
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* AI Typing Indicator */}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-white/[0.05] px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Footer Actions */}
        <div className="p-3 space-y-3 bg-gray-50/50 dark:bg-white/[0.01] border-t border-gray-100 dark:border-gray-800">
          {/* Quick Actions */}
          {!chatLoading && chatMessages.length < 5 && (
            <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 no-scrollbar">
              {quickActions.map(action => (
                <button
                  key={action.label}
                  onClick={() => handleChatSend(action.prompt)}
                  className="whitespace-nowrap px-3 py-1.5 rounded-full border border-gray-200 bg-white text-[11px] font-semibold text-gray-600 hover:border-brand-500 hover:text-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 transition-all shadow-sm"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Chat Input */}
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={chatInputRef}
                rows={1}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleChatSend()
                  }
                }}
                placeholder="Ask anything about your ads..."
                className="w-full max-h-32 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-800 dark:text-white/90 dark:placeholder:text-white/30 transition-all resize-none custom-scrollbar"
                style={{ height: 'auto' }}
                onInput={(e) => {
                  e.target.style.height = 'auto'
                  e.target.style.height = e.target.scrollHeight + 'px'
                }}
              />
            </div>
            <button
              onClick={() => handleChatSend()}
              disabled={!chatInput.trim() || chatLoading}
              className={`h-11 w-11 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                chatInput.trim() && !chatLoading
                  ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-md shadow-brand-500/20'
                  : 'bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-600'
              }`}
            >
              <Send size={18} />
            </button>
          </div>
          
          <div className="flex items-center justify-between px-1">
            <p className="text-[9px] text-gray-400 font-medium">FixMyLeads AI can make mistakes. Check important info.</p>
            <button 
              onClick={clearChat}
              className="text-[10px] font-bold text-gray-400 hover:text-red-500 transition-colors"
            >
              Clear History
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
