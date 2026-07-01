# ecm-backend

Use for all Node.js backend tasks on ECM-AI-OS — `.cjs` routes, services, controllers, middleware, BullMQ jobs, PostgreSQL queries. Activates on Express, `.cjs` files, API endpoints, tenant isolation work.

## Structure
- `backend/api-server.cjs` — Express entry (port 4000)
- `backend/orchestrator/` — Master Agent orchestration
- `backend/queues/` — BullMQ job queue + worker
- `backend/controllers/` — Route handlers
- `backend/middleware/` — Auth, brandId, error handler, rate limiter
- `backend/db/` — pg Pool client, migrations
- `backend/engines/` — 9 AI engines (research, content, image, video, publish, ads, tracking, optimization, delayed)
- `backend/ai/` — 32 AI service integrations (LLM, TTS, video, analysis)
- `backend/agents/` — Master Agent, memory agents
- `backend/routes/` — API route definitions

## Patterns
- All API handlers receive `req.brandId` (UUID v4 string) from middleware
- DB queries filter by `brand_id` on every row
- Responses are `{ success: true, data }` or `{ success: false, error }`
- Engines run sequentially 1→9 via Master Agent
- BullMQ queue `ai-jobs` with 5 retry attempts + exponential backoff

## Commands
```bash
node backend/api-server.cjs              # start API
node backend/queues/worker.cjs            # start worker
node backend/db/<migration>.cjs           # run migration
curl http://localhost:4000/health         # health check
```

## Gotchas
- Two codebases exist: `backend/` (runtime) and `src/` (legacy agentic)
- brand_id is ALWAYS required — no brand_id = 401
- `requireSuperAdmin` middleware for admin-only routes
- Razorpay webhook MUST be mounted BEFORE `express.json()` in api-server.cjs
