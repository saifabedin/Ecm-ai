import React, { useState } from 'react'
import { HelpCircle, ChevronDown, ChevronRight, Zap, Users, Send, Phone, FileText, Cpu } from 'lucide-react'

const SECTIONS = [
  {
    icon: Zap,
    title: 'Getting Started',
    items: [
      {
        q: 'What is FixMyLeads?',
        a: 'FixMyLeads is an AI-powered sales automation platform with 6 autonomous agents (Scout, Nova, Vox, Quill, Muse, Sage) that handle lead research, outreach, calls, proposals, content, and client success.',
      },
      {
        q: 'How do I add leads?',
        a: 'Go to Research → select a source (Google Maps, LinkedIn, Directory) → enter a query → click "Run Research". The Scout agent will find, enrich, and score leads automatically.',
      },
      {
        q: 'How does the 5-step sequence work?',
        a: 'Step 1: WhatsApp (Day 0 instant). Step 2: Email (Day 1). Step 3: Email (Day 3). Step 4: Email (Day 7). Step 5: Re-engagement email (Day 14). Enrollments auto-cancel when a meeting is booked.',
      },
    ],
  },
  {
    icon: Users,
    title: 'CRM & Leads',
    items: [
      {
        q: 'What do lead grades mean?',
        a: 'A = High priority (strong fit, clear pain points). B = Good fit. C = Average fit. D = Low priority. Grades are assigned by the Scout AI based on company data, intent signals, and industry fit.',
      },
      {
        q: 'How do I enroll a lead?',
        a: 'Open CRM → find the lead → click "Enroll". The Nova agent will automatically send messages at the right times via WhatsApp and email.',
      },
    ],
  },
  {
    icon: Send,
    title: 'Outreach & SDR',
    items: [
      {
        q: 'Can I manually trigger the next step?',
        a: 'Yes. Go to Outreach → find the active enrollment → click "Run Step" to send the next message immediately instead of waiting for the scheduled time.',
      },
      {
        q: 'What happens when a lead replies?',
        a: 'Nova analyses the reply, handles objections, and if positive intent is detected, automatically books a meeting using your Cal.com link.',
      },
    ],
  },
  {
    icon: Phone,
    title: 'Voice & Meetings',
    items: [
      {
        q: 'How does meeting booking work?',
        a: 'Set your BOOKING_LINK env var to your Cal.com link. Nova includes the link in WhatsApp step 1 and books meetings automatically on positive replies. You can also book manually from the CRM or Outreach pages.',
      },
      {
        q: 'What is the Voice agent (Vox)?',
        a: 'Vox handles AI voice calls when PROVIDER_MODE=live and a telephony API is configured. In mock mode it simulates calls. Configure VOICE_ADAPTER_URL and TELEPHONY_API_URL in .env.',
      },
    ],
  },
  {
    icon: FileText,
    title: 'Proposals & Documents',
    items: [
      {
        q: 'How does AI proposal generation work?',
        a: 'Go to Documents → Generate → enter a Lead ID. The Quill agent reads the lead profile, pain points, and company data, then generates a personalized proposal with pricing.',
      },
      {
        q: 'How do I send a proposal?',
        a: 'In Documents, find the draft proposal → click "Send". The proposal is emailed to the lead automatically and status updates to "sent".',
      },
    ],
  },
  {
    icon: Cpu,
    title: 'Configuration & Setup',
    items: [
      {
        q: 'How do I switch from mock to live mode?',
        a: 'Set PROVIDER_MODE=live in .env. Then configure: GMAIL_USER + GMAIL_APP_PASSWORD (email), WHATSAPP_API_URL + WHATSAPP_API_TOKEN (WhatsApp), BOOKING_LINK (Cal.com).',
      },
      {
        q: 'How do I set a user API key?',
        a: 'Run: node scripts/set-api-key.cjs --email your@email.com in the ai-team folder. This generates a bcrypt-hashed key in the DB that you use for Bearer token auth.',
      },
      {
        q: 'What services need to be running?',
        a: 'Gateway (port 4100), Dashboard (4101), Autopilot (background), Queue Worker (BullMQ), ECM AI OS backend (4000). Use PM2: pm2 start ecosystem.config.js',
      },
    ],
  },
]

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between py-4 text-left gap-4 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
      >
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{q}</span>
        {open ? <ChevronDown size={16} className="text-indigo-600 flex-shrink-0" /> : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />}
      </button>
      {open && (
        <p className="pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{a}</p>
      )}
    </div>
  )
}

export default function HelpCenter() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <HelpCircle size={24} className="text-indigo-600" /> Help Center
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Everything you need to know about FixMyLeads
        </p>
      </div>

      <div className="space-y-4">
        {SECTIONS.map(section => {
          const Icon = section.icon
          return (
            <div key={section.title} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                  <Icon size={15} className="text-indigo-600" />
                </div>
                <h2 className="font-semibold text-gray-900 dark:text-white">{section.title}</h2>
              </div>
              {section.items.map(item => <FAQItem key={item.q} {...item} />)}
            </div>
          )
        })}
      </div>

      <div className="mt-6 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl p-6 text-center">
        <p className="text-sm font-medium text-indigo-700 dark:text-indigo-400 mb-1">Need more help?</p>
        <p className="text-xs text-indigo-600 dark:text-indigo-500">
          Use the AI Assistant (Chat) to ask questions about your data in real time.
        </p>
      </div>
    </div>
  )
}
