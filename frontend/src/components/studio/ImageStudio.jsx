import React, { useState, useEffect, useRef } from 'react'
import { apiFetch } from '../../utils/api.js'
import { Image, Wand2, RefreshCw, AlertCircle, Download, Sparkles } from 'lucide-react'

const STYLES = ['photorealistic', 'digital art', 'illustration', 'cinematic', 'minimalist', 'corporate']
const SIZES = ['1024x1024', '1792x1024', '1024x1792']

export default function ImageStudio() {
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('photorealistic')
  const [size, setSize] = useState('1024x1024')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [jobId, setJobId] = useState(null)
  const pollIntervalRef = useRef(null)

  useEffect(() => () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current) }, [])

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setGenerating(true)
    setError(null)
    setResult(null)
    try {
      const data = await apiFetch('/api/orchestrator', {
        method: 'POST',
        body: JSON.stringify({
          jobType: 'image',
          prompt,
          style,
          size,
        }),
      })
      setJobId(data.jobId)
      pollJob(data.jobId)
    } catch (e) {
      setError(e.message)
      setGenerating(false)
    }
  }

  const pollJob = (id) => {
    let attempts = 0
    pollIntervalRef.current = setInterval(async () => {
      attempts++
      try {
        const data = await apiFetch(`/api/jobs/${id}`)
        if (data.state === 'completed' || data.state === 'failed' || attempts > 40) {
          setResult(data)
          setGenerating(false)
          clearInterval(pollIntervalRef.current)
        }
      } catch {
        if (attempts > 40) {
          setGenerating(false)
          clearInterval(pollIntervalRef.current)
        }
      }
    }, 3000)
  }

  const imageUrl = result?.result?.imageUrl || result?.result?.image_url || result?.result?.url

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Image Studio</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Generate AI images for your campaigns</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Controls */}
        <div className="col-span-1 space-y-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Prompt</label>
            <textarea
              rows={5}
              className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              placeholder="Describe the image you want to generate..."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Style</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {STYLES.map(s => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  className={`px-3 py-2 text-xs rounded-lg border transition-colors capitalize ${
                    style === s
                      ? 'border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Size</label>
            <select
              className="mt-2 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
              value={size}
              onChange={e => setSize(e.target.value)}
            >
              {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm rounded-xl bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 font-medium"
          >
            {generating ? <RefreshCw size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {generating ? 'Generating...' : 'Generate Image'}
          </button>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="col-span-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 flex flex-col items-center justify-center min-h-96">
          {generating ? (
            <div className="flex flex-col items-center gap-4 text-gray-400">
              <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center">
                <Sparkles size={28} className="text-brand-500 animate-pulse" />
              </div>
              <div className="text-sm">Generating your image...</div>
              <div className="text-xs text-gray-300 dark:text-gray-600">Job: {jobId}</div>
            </div>
          ) : imageUrl ? (
            <div className="w-full space-y-4">
              <img src={imageUrl} alt="Generated" className="w-full rounded-xl object-cover shadow-lg" />
              <div className="flex justify-end">
                <a
                  href={imageUrl}
                  download="generated-image.png"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  <Download size={14} /> Download
                </a>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-gray-300 dark:text-gray-600">
              <Image size={48} className="opacity-30" />
              <span className="text-sm">Your generated image will appear here</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
