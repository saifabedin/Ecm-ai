# ECM-AI-OS PROJECT CONTEXT

## MAIN PROJECT

Path:
/home/ubuntu/ecm-ai-os

This is a multi-tenant AI SaaS platform being prepared for production EC2 deployment.

Current architecture:

* Node.js backend
* Express API
* BullMQ worker queue
* Redis
* Neon PostgreSQL
* PM2 runtime
* React/Vite frontend
* Multi-engine AI orchestration system

## CURRENT STATUS

Working:

* PM2 services active
* Redis connected
* Neon PostgreSQL connected
* Worker queue processing
* Auth middleware functional
* Frontend/backend routing working
* Health endpoint working
* Orchestrator queue flow functional

Main running services:

* ecm-api-staging
* ecm-worker-staging

Current API port:
5000

## CORE SYSTEM FLOW

Frontend
→ API
→ Orchestrator
→ BullMQ Queue
→ Worker
→ Master Agent
→ AI Engines
→ Database/Output

## IMPORTANT ACTIVE COMPONENTS

Backend:

* backend/api-server.cjs
* backend/orchestrator/*
* backend/queues/worker.cjs
* backend/middleware/*
* backend/db/*
* backend/engines/*

Frontend:

* frontend/

PM2:

* ecosystem.config.js
* ecosystem.staging.config.js

## VIDEO ENGINE GOAL

Primary focus now:
advanced cinematic AI short-form video generation.

Target quality:

* 45-60 sec
* 9:16 reels/tiktok
* avatar intro
* cinematic AI voiceover
* synced b-roll
* subtitles
* motion text
* SFX
* background music
* FFmpeg cinematic transitions
* export optimized mp4

Current integrations:

* ElevenLabs
* D-ID
* Pexels
* FFmpeg

Main files:

* backend/engines/engine4-video.cjs
* backend/engines/engine4-video-upgraded.cjs

## IMPORTANT RULES

DO NOT:

* break worker/runtime flow
* restart PM2 unless required
* delete files without verification
* rewrite entire architecture
* create unnecessary duplicate engines
* overwrite working configs
* kill active ports blindly

ALWAYS:

* analyze before editing
* preserve backward compatibility
* work modularly
* use safe incremental upgrades
* verify dependencies before cleanup
* prefer merging over duplicating
* keep production stability first

## CURRENT PRIORITY ORDER

1. verify architecture/runtime
2. optimize video engine
3. improve render quality
4. frontend integration verification
5. production deployment hardening
6. cleanup duplicate/unnecessary files
7. SSL/domain/reverse proxy
8. monitoring/logging/security

## EXPECTED OUTPUT STYLE

Always provide:

* VERIFIED WORKING
* REAL BLOCKERS
* EXACT FILES
* SAFE IMPLEMENTATION PLAN
* SAFEST NEXT STEP

Avoid vague explanations.
Avoid rewriting unrelated systems.
Focus on production-safe implementation.
