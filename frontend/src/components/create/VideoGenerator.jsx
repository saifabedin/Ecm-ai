import React, { useState, useCallback, useRef } from 'react'
import {
  Video,
  Wand2,
  Loader2,
  Download,
  Copy,
  CheckCheck,
  RefreshCw,
  Image,
  Play,
  Pause,
  Maximize2,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { apiFetch } from '../../utils/api'

export default function VideoGenerator({ inputs, prompt }) {
  const [videoUrl, setVideoUrl] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [copied, setCopied] = useState(false)
  const videoRef = useRef(null)

  const pollJobStatus = async (jobId, maxAttempts = 120, intervalMs = 3000) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const status = await apiFetch(`/api/jobs/${jobId}`)
      if (status.state === 'completed') return status
      if (status.state === 'failed') throw new Error(status.failedReason || 'Job failed')
      setProgress(`Rendering... (${Math.round((attempt / maxAttempts) * 100)}%)`)
      await new Promise((r) => setTimeout(r, intervalMs))
    }
    throw new Error('Job timed out')
  }

  const handleGenerateVideo = useCallback(async () => {
    setIsGenerating(true)
    setProgress('Queuing video job...')
    setVideoUrl(null)
    try {
      const payload = {
        jobType: 'video',
        prompt,
        clinicName: inputs.clinicName,
        location: inputs.location,
        audience: inputs.audience,
        goal: inputs.goal,
        tone: inputs.tone,
        avatarImage: inputs.avatarImage || null,
      }
      const queued = await apiFetch('/api/orchestrator', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setProgress('Processing video (1-3 min)...')
      const result = await pollJobStatus(queued.jobId)
      if (result?.result?.data?.video_url) {
        setVideoUrl(result.result.data.video_url)
        setProgress('')
      } else {
        throw new Error('No video URL in response')
      }
    } catch (err) {
      setProgress(`Failed: ${err.message}`)
      console.error('Video generation failed:', err)
    } finally {
      setIsGenerating(false)
    }
  }, [prompt, inputs])

  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    videoRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const handleDownload = () => {
    if (!videoUrl) return
    const a = document.createElement('a')
    a.href = videoUrl
    a.download = `fixmyleads-video-${Date.now()}.mp4`
    a.click()
  }

  const handleCopyUrl = () => {
    if (!videoUrl) return
    const fullUrl = `${window.location.origin}${videoUrl}`
    navigator.clipboard.writeText(fullUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="space-y-6">
      {/* Generate Video Button */}
      <button
        onClick={handleGenerateVideo}
        disabled={isGenerating}
        className={`w-full flex items-center justify-center gap-2.5 h-12 rounded-xl font-bold text-sm transition-all duration-200 shadow-lg ${
          isGenerating
            ? 'bg-violet-400 text-white/80 cursor-not-allowed shadow-violet-500/10'
            : 'bg-violet-600 text-white hover:bg-violet-700 shadow-violet-500/20 active:scale-[0.98]'
        }`}
      >
        {isGenerating ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            {progress || 'Generating...'}
          </>
        ) : videoUrl ? (
          <>
            <RefreshCw size={18} />
            Regenerate Video
          </>
        ) : (
          <>
            <Video size={18} />
            Generate AI Reel
          </>
        )}
      </button>

      {/* Progress */}
      {progress && !videoUrl && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20">
          <Loader2 size={16} className="animate-spin text-violet-500" />
          <span className="text-sm text-violet-700 dark:text-violet-300">{progress}</span>
        </div>
      )}

      {/* Video Preview */}
      {videoUrl && (
        <div className="space-y-4">
          {/* Video Player Card */}
          <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-black">
            <div className="relative aspect-[9/16] max-h-[500px] mx-auto">
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                onEnded={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                playsInline
                loop
              />
              {/* Video Controls Overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <div className="flex items-center justify-between">
                  <button
                    onClick={togglePlay}
                    className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
                  >
                    {isPlaying ? <Pause size={18} className="text-white" /> : <Play size={18} className="text-white ml-0.5" />}
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleMute}
                      className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
                    >
                      {isMuted ? <VolumeX size={18} className="text-white" /> : <Volume2 size={18} className="text-white" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold bg-brand-500 text-white hover:bg-brand-600 shadow-lg shadow-brand-500/20 transition-all"
            >
              <Download size={16} />
              Download MP4
            </button>
            <button
              onClick={handleCopyUrl}
              className={`flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-all ${
                copied
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'border border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:border-gray-700'
              }`}
            >
              {copied ? <CheckCheck size={16} /> : <Copy size={16} />}
              {copied ? 'Copied!' : 'Copy URL'}
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!videoUrl && !isGenerating && !progress && (
        <div className="flex flex-col items-center justify-center py-12 px-8 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-white/[0.02]">
          <div className="w-16 h-16 mb-4 rounded-2xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center">
            <Video size={28} className="text-violet-500" />
          </div>
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">AI Video Reel</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center max-w-xs">
            Generate a cinematic 9:16 short-form video with AI voiceover, avatar, b-roll, subtitles & background music
          </p>
        </div>
      )}
    </div>
  )
}
