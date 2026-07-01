import React, { useState, useEffect, useRef } from 'react'
import { apiFetch } from '../../utils/api.js'
import { Video, Wand2, RefreshCw, AlertCircle, Download, Sparkles, Play } from 'lucide-react'

const SCENE_TYPES = ['story', 'testimonial', 'product', 'explainer', 'ad']
const DURATIONS = [15, 30, 60]

export default function VideoStudio() {
  const [script, setScript] = useState('')
  const [sceneType, setSceneType] = useState('story')
  const [duration, setDuration] = useState(30)
  const [brandName, setBrandName] = useState('FixMyLeads')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [jobId, setJobId] = useState(null)
  const pollIntervalRef = useRef(null)

  useEffect(() => () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current) }, [])

  const handleGenerate = async () => {
    if (!script.trim()) return
    setGenerating(true)
    setError(null)
    setResult(null)
    try {
      const data = await apiFetch('/api/orchestrator', {
        method: 'POST',
        body: JSON.stringify({
          jobType: 'video',
          script,
          sceneType,
          duration,
          brandName,
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
        if (data.state === 'completed' || data.state === 'failed' || attempts > 60) {
          setResult(data)
          setGenerating(false)
          clearInterval(pollIntervalRef.current)
        }
      } catch {
        if (attempts > 60) {
          setGenerating(false)
          clearInterval(pollIntervalRef.current)
        }
      }
    }, 5000)
  }

  const videoUrl = result?.result?.videoUrl || result?.result?.video_url || result?.result?.outputPath

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Video Studio</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create AI-powered video content for your brand</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Controls */}
        <div className="col-span-1 space-y-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Script / Prompt</label>
            <textarea
              rows={6}
              className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              placeholder="Write the script or describe the video you want..."
              value={script}
              onChange={e => setScript(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Scene Type</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {SCENE_TYPES.map(s => (
                <button
                  key={s}
                  onClick={() => setSceneType(s)}
                  className={`px-3 py-2 text-xs rounded-lg border transition-colors capitalize ${
                    sceneType === s
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
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Duration (seconds)</label>
            <div className="mt-2 flex gap-2">
              {DURATIONS.map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${
                    duration === d
                      ? 'border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                  }`}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Brand Name</label>
            <input
              className="mt-2 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
              value={brandName}
              onChange={e => setBrandName(e.target.value)}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || !script.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm rounded-xl bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 font-medium"
          >
            {generating ? <RefreshCw size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {generating ? 'Generating...' : 'Generate Video'}
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
              <div className="text-sm">Generating your video... this may take a few minutes</div>
              <div className="text-xs text-gray-300 dark:text-gray-600">Job: {jobId}</div>
              <div className="w-48 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full animate-pulse w-2/3" />
              </div>
            </div>
          ) : videoUrl ? (
            <div className="w-full space-y-4">
              <video src={videoUrl} controls className="w-full rounded-xl shadow-lg" />
              <div className="flex justify-end">
                <a
                  href={videoUrl}
                  download="generated-video.mp4"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  <Download size={14} /> Download MP4
                </a>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-gray-300 dark:text-gray-600">
              <Video size={48} className="opacity-30" />
              <span className="text-sm">Your generated video will appear here</span>
              <span className="text-xs text-gray-400 dark:text-gray-600">Video generation typically takes 2-5 minutes</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
