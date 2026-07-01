import React, { useState, useCallback } from 'react'
import {
  Wand2,
  Copy,
  CheckCheck,
  RefreshCw,
  Save,
  Sparkles,
  Loader2,
  FileText,
  Video
} from 'lucide-react'
import PromptEditor from './PromptEditor'
import ContentForm from './ContentForm'
import PlatformSelector from './PlatformSelector'
import PhoneMockup from './PhoneMockup'
import OutputDetails from './OutputDetails'
import VideoGenerator from './VideoGenerator'
import { apiFetch } from '../../utils/api.js'

export default function CreateContent() {
  /* ─── Tabs ─── */
  const [activeTab, setActiveTab] = useState('content')

  /* ─── State ─── */
  const [prompt, setPrompt] = useState(
    'Create a short-form video script promoting professional teeth whitening services. The content should educate viewers on why professional whitening is safer and more effective than DIY methods. Include a compelling hook, key benefits, and a clear call to action for booking.'
  )
  const [inputs, setInputs] = useState({
    clinicName: 'BrightSmile Dental',
    location: 'Los Angeles, CA',
    audience: 'young-adults',
    goal: 'bookings',
    tone: 'friendly',
    avatarImage: null,
  })
  const [selectedPlatform, setSelectedPlatform] = useState('instagram')
  const [generatedContent, setGeneratedContent] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [caption, setCaption] = useState('')
  const [copiedCaption, setCopiedCaption] = useState(false)
  const [copiedScript, setCopiedScript] = useState(false)
  const [savedDraft, setSavedDraft] = useState(false)

  /* ─── Handlers ─── */
  const pollJobStatus = async (jobId, maxAttempts = 60, intervalMs = 3000) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const status = await apiFetch(`/api/jobs/${jobId}`)
      if (status.state === 'completed') return status
      if (status.state === 'failed') throw new Error(status.failedReason || 'Job failed')
      await new Promise((r) => setTimeout(r, intervalMs))
    }
    throw new Error('Job timed out')
  }

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    try {
      const payload = {
        jobType: 'research',
        prompt,
        clinicName: inputs.clinicName,
        location: inputs.location,
        audience: inputs.audience,
        goal: inputs.goal,
        tone: inputs.tone,
      }
      const queued = await apiFetch('/api/orchestrator', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const result = await pollJobStatus(queued.jobId)
      if (result && result.result) {
        const content = result.result
        setGeneratedContent({
          hook: content.hook || '',
          body: content.body || '',
          cta: content.cta || '',
          caption: content.caption || '',
          hashtags: content.hashtags || '',
          script: content.script || '',
          hookVariations: content.hookVariations || [],
        })
        setCaption(content.caption || '')
      }
    } catch (err) {
      console.error('Generation failed:', err)
    } finally {
      setIsGenerating(false)
    }
  }, [prompt, inputs])

  const handleRegenerate = useCallback(async () => {
    setIsGenerating(true)
    try {
      const payload = {
        jobType: 'research',
        prompt,
        clinicName: inputs.clinicName,
        location: inputs.location,
        audience: inputs.audience,
        goal: inputs.goal,
        tone: inputs.tone,
        regenerate: true,
      }
      const queued = await apiFetch('/api/orchestrator', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const result = await pollJobStatus(queued.jobId)
      if (result && result.result) {
        const content = result.result
        setGeneratedContent({
          hook: content.hook || '',
          body: content.body || '',
          cta: content.cta || '',
          caption: content.caption || '',
          hashtags: content.hashtags || '',
          script: content.script || '',
          hookVariations: content.hookVariations || [],
        })
        setCaption(content.caption || '')
      }
    } catch (err) {
      console.error('Regeneration failed:', err)
    } finally {
      setIsGenerating(false)
    }
  }, [prompt, inputs])

  const copyToClipboard = useCallback((text, type) => {
    navigator.clipboard.writeText(text)
    if (type === 'caption') {
      setCopiedCaption(true)
      setTimeout(() => setCopiedCaption(false), 2500)
    } else {
      setCopiedScript(true)
      setTimeout(() => setCopiedScript(false), 2500)
    }
  }, [])

const handleSaveDraft = useCallback(async () => {
try {
const draft = {
platform: selectedPlatform,
clinic_name: inputs.clinicName,
location: inputs.location,
audience: inputs.audience,
goal: inputs.goal,
tone: inputs.tone,
...generatedContent
};
const result = await apiFetch('/api/drafts', {
method: 'POST',
body: JSON.stringify({ draft }),
});
if (result.success) {
setSavedDraft(true);
setTimeout(() => setSavedDraft(false), 2500);
}
} catch (err) {
console.error('Failed to save draft:', err);
}
}, [selectedPlatform, inputs, generatedContent]);

  /* ─── Preview content object passed to phone ─── */
  const previewContent = generatedContent ? {
    ...generatedContent,
    clinicName: inputs.clinicName,
    location: inputs.location,
  } : {
    hook: '',
    cta: '',
    caption: '',
    hashtags: '',
    clinicName: inputs.clinicName,
    location: inputs.location,
  }

  return (
    <div className="p-6 lg:p-10 transition-colors">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Content</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Generate AI-powered social content and cinematic video reels
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 p-1 rounded-xl bg-gray-100 dark:bg-white/[0.05] w-fit">
        <button
          onClick={() => setActiveTab('content')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'content'
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <FileText size={16} />
          Content
        </button>
        <button
          onClick={() => setActiveTab('video')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'video'
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Video size={16} />
          AI Reel
        </button>
      </div>

      {/* Content Tab */}
      {activeTab === 'content' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <PromptEditor value={prompt} onChange={setPrompt} />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Content Settings</span>
              </div>
              <ContentForm inputs={inputs} onChange={setInputs} />
            </div>

            <button
              onClick={generatedContent ? handleRegenerate : handleGenerate}
              disabled={isGenerating}
              className={`w-full flex items-center justify-center gap-2.5 h-12 rounded-xl font-bold text-sm transition-all duration-200 shadow-lg ${
                isGenerating
                  ? 'bg-brand-400 text-white/80 cursor-not-allowed shadow-brand-500/10'
                  : 'bg-brand-500 text-white hover:bg-brand-600 shadow-brand-500/20 active:scale-[0.98]'
              }`}
            >
              {isGenerating ? (
                <><Loader2 size={18} className="animate-spin" /> Generating...</>
              ) : generatedContent ? (
                <><RefreshCw size={18} /> Regenerate</>
              ) : (
                <><Wand2 size={18} /> Generate Content</>
              )}
            </button>
          </div>

          <div className="lg:col-span-3 space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 mb-5">
                <Sparkles size={14} className="text-brand-500" />
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Live Preview</span>
              </div>
              <PlatformSelector selected={selectedPlatform} onSelect={setSelectedPlatform} />
              {generatedContent ? (
                <PhoneMockup platform={selectedPlatform} content={previewContent} caption={caption} onCaptionChange={setCaption} />
              ) : (
                <div className="flex justify-center py-4">
                  <div className="w-[280px] aspect-[9/16] rounded-[2.5rem] border-[3px] border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/[0.02] flex items-center justify-center">
                    <div className="text-center px-8">
                      <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center">
                        <Wand2 size={22} className="text-brand-500" />
                      </div>
                      <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Preview will appear here</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">Generate content to see a live preview</p>
                    </div>
                  </div>
                </div>
              )}
              {generatedContent && (
                <p className="text-center text-[11px] text-gray-400 dark:text-gray-500 mt-2">
                  Click on the caption inside the preview to edit it directly
                </p>
              )}
            </div>
            {generatedContent && <OutputDetails content={generatedContent} />}
            {generatedContent && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button onClick={() => copyToClipboard(caption || generatedContent.caption, 'caption')}
                  className={`flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-all ${copiedCaption ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'border border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:border-gray-700'}`}
                >{copiedCaption ? <CheckCheck size={16} /> : <Copy size={16} />} {copiedCaption ? 'Copied!' : 'Caption'}</button>
                <button onClick={() => copyToClipboard(generatedContent.script, 'script')}
                  className={`flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-all ${copiedScript ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'border border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:border-gray-700'}`}
                >{copiedScript ? <CheckCheck size={16} /> : <Copy size={16} />} {copiedScript ? 'Copied!' : 'Script'}</button>
                <button onClick={handleRegenerate} disabled={isGenerating}
                  className="flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:border-gray-700 transition-all disabled:opacity-50"
                ><RefreshCw size={16} className={isGenerating ? 'animate-spin' : ''} /> Regenerate</button>
                <button onClick={handleSaveDraft}
                  className={`flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-all ${savedDraft ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'border border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:border-gray-700'}`}
                >{savedDraft ? <CheckCheck size={16} /> : <Save size={16} />} {savedDraft ? 'Saved!' : 'Save Draft'}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Video Tab */}
      {activeTab === 'video' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <PromptEditor value={prompt} onChange={setPrompt} />
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Video Settings</span>
              </div>
              <ContentForm inputs={inputs} onChange={setInputs} />
            </div>
            <VideoGenerator inputs={inputs} prompt={prompt} />
          </div>
          <div className="lg:col-span-3 space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 mb-5">
                <Video size={14} className="text-violet-500" />
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Video Preview</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">
                Click "Generate AI Reel" to start — rendering takes 1-3 minutes
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
