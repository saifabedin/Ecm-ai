# ecm-ai-engine

Use for all AI engine work on ECM-AI-OS — Engine 1-8, avatar engine, video pipeline (FFmpeg/Python), AI receptionist, OpenAI/ElevenLabs/Replicate integration.

## Engine Pipeline (1→8)
1. Research — market intelligence, brand analysis
2. Content — script generation, copywriting
3. Image — AI image generation
4. Video — cinematic short-form video (reels/tiktok)
5. Publish — Facebook/Instagram publishing
6. Ads — ad management + activation
7. Tracking — performance tracking
8. Optimization — campaign optimization
9. Delayed Jobs — scheduling

## Video Engine (Engine 4)
- `backend/engines/engine4-video.cjs` — main video engine
- `backend/engines/engine4-video-upgraded.cjs` — upgraded version
- ElevenLabs TTS + D-ID avatar + Pexels stock footage + FFmpeg composition
- HyperFrames system for frame-accurate rendering

## Integration Services (`backend/ai/`)
- LLM: OpenAI, Anthropic, OpenRouter, Replicate
- Router: routes task types to optimal model (deepseek, mistral, glm, claude)
- Analysis: hook scoring, retention, viral engine, curiosity gap
- Media: ElevenLabs, D-ID, Pexels, subtitles, SFX, music, transitions

## Commands
```bash
node backend/engines/engine4-video.cjs     # run video engine directly
curl -X POST http://localhost:4000/api/command -H "Content-Type: application/json" -d '{"brand_id":"...","command":"/plan","args":{"goal":"generate-ads"}}'
```

## Gotchas
- Engine 4 is the most complex — involves multi-stage FFmpeg pipeline
- Two codebases: `backend/engines/` (runtime) and `src/routes/engines/` (legacy)
- Avatar engine uses D-ID API (paid) with fallback
- brand_id must propagate through every engine call
