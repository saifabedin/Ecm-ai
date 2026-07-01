import React, { useState, useRef, useEffect } from 'react'
import { apiFetch } from '../utils/api.js'
import { MessageSquare, Send, Loader2, Bot, User, RefreshCw } from 'lucide-react'

const STARTERS = [
  'How many leads do I have?',
  'What is my pipeline win rate?',
  'Show me leads ready to enroll',
  'Generate a proposal for lead 1',
  'What should I focus on today?',
]

export default function Chat() {
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      text: "Hi! I'm your FixMyLeads AI Assistant. I can help you research leads, check pipeline status, generate proposals, and answer questions about your sales activity. What's on your mind?",
      ts: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [jobId, setJobId] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const pollJob = async (id) => {
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const job = await apiFetch(`/api/jobs/${id}`)
      if (job.state === 'completed') return job.result?.content || job.result || 'Done.'
      if (job.state === 'failed') throw new Error(job.error || 'Job failed')
    }
    throw new Error('Timed out waiting for response')
  }

  const send = async (text) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: msg, ts: new Date() }])
    setLoading(true)

    try {
      const data = await apiFetch('/api/orchestrator', {
        method: 'POST',
        body: JSON.stringify({ prompt: msg }),
      })

      let reply
      if (data.jobId) {
        setJobId(data.jobId)
        reply = await pollJob(data.jobId)
        setJobId(null)
      } else {
        reply = data.content || data.result || data.message || JSON.stringify(data)
      }

      setMessages(prev => [...prev, { role: 'ai', text: reply, ts: new Date() }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: `Error: ${e.message}`, ts: new Date(), error: true }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-3xl mx-auto p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <MessageSquare size={24} className="text-indigo-600" /> AI Assistant
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Powered by FixMyLeads AI OS</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'ai' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
                <Bot size={15} className="text-white" />
              </div>
            )}
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : m.error
                  ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20'
                  : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-sm'
              }`}
            >
              {m.text}
            </div>
            {m.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <User size={15} className="text-gray-600 dark:text-gray-300" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
              <Bot size={15} className="text-white" />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-indigo-600" />
              <span className="text-sm text-gray-500">
                {jobId ? `Processing job ${jobId}…` : 'Thinking…'}
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Starter chips — show only at start */}
      {messages.length === 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {STARTERS.map(s => (
            <button
              key={s}
              onClick={() => send(s)}
              className="px-3 py-1.5 text-xs rounded-full border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-3 items-end">
        <textarea
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
          }}
          placeholder="Ask anything about your leads, pipeline, proposals…"
          className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          className="flex-shrink-0 w-11 h-11 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </div>
      <p className="text-center text-xs text-gray-400 mt-2">FixMyLeads AI can make mistakes. Verify important info.</p>
    </div>
  )
}
