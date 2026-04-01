# ECM AI Platform — CLAUDE.md Master Memory File

> This file is the single source of truth for all AI-assisted development on the ECM/DenMatrix platform.
> Claude Code reads this file at the start of every session. Keep it updated.

---

## 1. SYSTEM IDENTITY

| Key | Value |
|---|---|
| Platform Name | Editors Choice AI (ECM) |
| Backend Brand | ECM (Editors Choice Media) |
| Frontend Brand | DenMatrix |
| Domain | editorschoicemedia.in |
| Infrastructure | AWS EC2 eu-north-1 |
| Database | Neon PostgreSQL (serverless) |
| Automation Layer | n8n (self-hosted or cloud) |
| AI Engine Count | 15 custom engines |
| MCP Server | Connected |

---

## 2. REPOSITORY MAP

```
/home/ubuntu/
├── ecm-ai-os/
│   └── backend/           → Express.js API server (ECM brand — internal)
├── ai-platform/           → n8n workflows, engine configs, DB scripts
/home/user/
├── denmatrix-backend/     → Git repo mirror of ecm-ai-os/backend
└── denmatrix-frontend/    → React SPA (DenMatrix brand — public)
```

### Backend Repo
- **GitHub**: `saifabedin/denmatrix-backend`
- **Dev branch**: `claude/ecm-ai-platform-setup-3kqsm`
- **Local path**: `/home/ubuntu/ecm-ai-os/backend/` (canonical) + `/home/user/denmatrix-backend/` (git)
- **Runtime**: Node.js 20 (use `/opt/node20/`)
- **Framework**: Express.js
- **DB Driver**: `pg` with Neon pooler (no connection pooling outside Neon)
- **Process Manager**: PM2 via `ecosystem.config.js`

### Frontend Repo
- **GitHub**: `saifabedin/denmatrix-frontend`
- **Dev branch**: `claude/ecm-ai-platform-setup-3kqsm`
- **Local path**: `/home/user/denmatrix-frontend/`
- **Framework**: React (Vite)
- **UI Kit**: TBD by project — confirm before scaffolding

---

## 3. BRAND ARCHITECTURE RULES

```
ECM (internal)         DenMatrix (public-facing)
─────────────────      ─────────────────────────
API server             React dashboard UI
n8n orchestration      Client portal
15 AI engines          Reports / analytics UI
Neon DB                Brand: DenMatrix logo, colors
WhatsApp / Ads tools   Domain: editorschoicemedia.in
```

**Rules:**
- Never expose "ECM" branding to end users — use "DenMatrix" or "Editors Choice AI" only
- Backend API responses may use ECM internal codes
- Frontend copy uses DenMatrix brand language

---

## 4. MANDATORY: brand_id PROPAGATION

> **CRITICAL RULE** — Every API call, DB query, n8n webhook, and tool invocation MUST carry `brand_id`.

```js
// Every Express route handler must extract brand_id:
const { brand_id } = req.body || req.query || req.params;
if (!brand_id) return res.status(400).json({ error: 'brand_id is required' });

// Every DB query must scope by brand_id:
const result = await db.query('SELECT * FROM campaigns WHERE brand_id = $1', [brand_id]);

// Every n8n webhook payload must include brand_id:
{ brand_id, event_type, payload, timestamp }
```

**brand_id format**: UUID v4 string  
**Enforcement**: Middleware `requireBrandId` must be applied globally to all `/api/*` routes  
**Exception**: Auth endpoints (`/auth/login`, `/auth/register`) are exempt

---

## 5. NEON POSTGRESQL — CONNECTION RULES

```
Provider: Neon (neon.tech) — serverless PostgreSQL
Region: Match to eu-north-1 where possible
```

### Connection Rules
1. **Use connection pooling via Neon's pooler endpoint** — never direct connections in production
2. **Driver**: `@neondatabase/serverless` or `postgres` (pg)
3. **SSL**: always `ssl: true` / `sslmode=require`
4. **Connection string**: stored in `DATABASE_URL` env var — never hardcoded
5. **Idle timeout**: Neon suspends after 5 min inactivity — use `keepAlive: false` for serverless
6. **Transactions**: Use `BEGIN/COMMIT/ROLLBACK` explicitly — no implicit transactions

### Environment Variables (DB)
```env
DATABASE_URL=postgresql://[user]:[password]@[pooler-host]/[db]?sslmode=require
NEON_DATABASE_URL=  # direct connection (migrations only)
```

### Table Naming Convention
```sql
-- Always snake_case, always include brand_id column
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Every table MUST have: id, brand_id, created_at, updated_at
```

---

## 6. n8n WEBHOOK PATTERNS

### Webhook URL Format
```
https://[n8n-host]/webhook/[workflow-slug]
```

### Standard Payload Structure
```json
{
  "brand_id": "uuid-v4",
  "event_type": "campaign.created | lead.captured | content.generated | ad.published",
  "engine_id": "engine-slug",
  "payload": { ...event-specific data... },
  "timestamp": "ISO-8601",
  "session_id": "optional-tracking-id"
}
```

### Trigger Rules
- All n8n workflows are triggered via HTTP POST to webhook URL
- Never trigger n8n directly from frontend — always via backend API
- n8n webhook responses are async — use polling or callback endpoints
- Store `workflow_execution_id` in DB for status tracking

### Environment Variables (n8n)
```env
N8N_WEBHOOK_BASE_URL=https://[n8n-host]/webhook
N8N_API_KEY=           # for programmatic workflow management
```

---

## 7. THE 15 AI ENGINES

> Each engine has a unique slug, purpose, and n8n workflow trigger.
> All engines accept `brand_id` and return structured JSON.
> All engine routes live at: `routes/engines/[slug].js`

| ID | Engine Name | Slug | Purpose | Trigger Type |
|---|---|---|---|---|
| DB | EC Engine DB | `db-migration` | Database Auto-Migration | n8n webhook |
| 1 | EC Engine 1 | `brand-knowledge` | Brand Knowledge base management & retrieval | n8n webhook |
| 2 | EC Engine 2 | `market-intelligence` | Market Intelligence — competitor & trend analysis | n8n webhook |
| 3 | EC Engine 3 | `strategy-planning` | Strategy & Content Planning | n8n webhook |
| 4 | EC Engine 4 | `content-generation` | Content Generation (long-form, social, email) | n8n webhook |
| 5 | EC Engine 5 | `image-generation` | Image Generation via AI models | n8n webhook |
| 6 | EC Engine 6 | `video-generation` | Video Generation Professional 2-Stage pipeline | n8n webhook |
| 7 | EC Engine 7 | `publishing-spider` | Publishing Spider Web — multi-channel distribution | n8n webhook |
| 8 | EC Engine 8 | `ads-management` | Ads Management — parent orchestrator | n8n webhook |
| 8a | EC Engine 8a | `campaign-creator` | Ads Campaign Creator | n8n webhook |
| 8b | EC Engine 8b | `daily-performance` | Ads Daily Performance reporting | n8n webhook |
| 8c | EC Engine 8c | `campaign-activate` | Ads Campaign Activate / pause / budget adjust | n8n webhook |
| 9 | EC Engine 9 | `perf-tracking` | Performance Tracking Spider | n8n webhook |
| 10 | EC Engine 10 | `optimization-spider` | Optimization Spider — A/B test & iterate | n8n webhook |
| 11 | EC Engine 11 | `orchestrator-brain` | Orchestrator Brain — master workflow coordinator | n8n webhook |

### Engine API Pattern
```
POST /api/engines/:engine_slug/run
Headers: Authorization: Bearer <jwt>
Body: { brand_id, input, options }
Response: { success: true, brand_id, engine_id, job_id, status: "queued", estimated_seconds, timestamp }

GET /api/engines/:job_id/status
Headers: Authorization: Bearer <jwt>
Query: ?brand_id=<uuid>
Response: { success: true, brand_id, engine_id, job_id, status, result, timestamp }

Error Response (all engines):
{ success: false, brand_id, error_code, message, timestamp }
```

### Engine Route Files
```
src/routes/engines/
├── db-migration.js
├── brand-knowledge.js
├── market-intelligence.js
├── strategy-planning.js
├── content-generation.js
├── image-generation.js
├── video-generation.js
├── publishing-spider.js
├── ads-management.js
├── campaign-creator.js
├── daily-performance.js
├── campaign-activate.js
├── perf-tracking.js
├── optimization-spider.js
└── orchestrator-brain.js
```

---

## 8. MCP TOOL DEFINITIONS

The MCP server exposes these tools to Claude Code for direct use:

### DB Tool
```json
{
  "name": "db_query",
  "description": "Run a read-only SQL query against Neon PostgreSQL",
  "params": { "sql": "string", "brand_id": "string" }
}
```

### WhatsApp Tool
```json
{
  "name": "whatsapp_send",
  "description": "Send a WhatsApp message via the platform's WhatsApp Business API",
  "params": { "brand_id": "string", "to": "string", "message": "string" }
}
```

### Ads Tool
```json
{
  "name": "ads_publish",
  "description": "Publish or update a paid ad (Google/Meta)",
  "params": { "brand_id": "string", "platform": "google|meta", "ad_data": "object" }
}
```

### Scraper Tool
```json
{
  "name": "scrape_url",
  "description": "Scrape a URL and return structured content",
  "params": { "url": "string", "brand_id": "string", "extract_fields": "array" }
}
```

### n8n Tool
```json
{
  "name": "trigger_workflow",
  "description": "Trigger an n8n workflow by slug",
  "params": { "workflow_slug": "string", "brand_id": "string", "payload": "object" }
}
```

---

## 9. COMMAND LAYER

These slash commands are available in Claude Code sessions on this project:

| Command | Action |
|---|---|
| `/plan` | Generate a structured implementation plan for the next feature |
| `/deploy` | Run pre-deploy checks and push to the feature branch |
| `/test` | Run test suite and report failures |
| `/optimize` | Analyze current code and suggest performance improvements |
| `/audit` | Re-audit repo structure and update this CLAUDE.md |

### /plan Template
```
1. What are we building? (feature description)
2. Which repos are affected? (backend / frontend / both)
3. DB schema changes? (new tables / columns)
4. New API endpoints?
5. n8n workflows involved?
6. brand_id required? (always yes)
7. Estimated complexity (S/M/L/XL)
```

---

## 10. PERMISSION LAYER

### API Permission Levels
```
Level 0 — Public       : No auth required (health check, public landing pages)
Level 1 — Authenticated: Valid JWT required
Level 2 — Brand-scoped : Valid JWT + brand_id ownership verified
Level 3 — Admin        : Valid JWT + admin role
Level 4 — Super Admin  : Platform-level access (ECM internal)
```

### Middleware Stack (apply in this order)
```js
router.use(rateLimiter);          // Level 0+
router.use(authenticateJWT);      // Level 1+
router.use(requireBrandId);       // Level 2+
router.use(verifyBrandOwnership); // Level 2+ (confirms user owns brand_id)
router.use(requireAdmin);         // Level 3+
```

### JWT Rules
- Algorithm: RS256 or HS256 (set in env)
- Expiry: 24h for access token, 30d for refresh token
- Payload must include: `{ user_id, brand_id, role, iat, exp }`
- Secret: `JWT_SECRET` env var

---

## 11. MULTI-AGENT COORDINATION

When Claude Code spawns sub-agents for this project:

### Agent Roles
| Agent | Responsibility |
|---|---|
| `planner` | Break features into tasks, update CLAUDE.md |
| `backend-dev` | Node.js/Express routes, DB queries, n8n triggers |
| `frontend-dev` | React components, API integration |
| `db-admin` | Schema migrations, query optimization |
| `tester` | Write and run tests |
| `deployer` | Git operations, branch management |

### Coordination Rules
1. Always read CLAUDE.md first before any action
2. Never modify existing working files without a plan step
3. All agents log work in session notes at bottom of CLAUDE.md
4. Agents share `brand_id` context throughout session
5. Sub-agent results go to `planner` before commit

---

## 12. ENVIRONMENT VARIABLES MASTER LIST

```env
# Database
DATABASE_URL=                    # Neon pooler connection string
NEON_DATABASE_URL=               # Neon direct connection (migrations only)

# Authentication
JWT_SECRET=                      # JWT signing secret
JWT_EXPIRY=24h
JWT_REFRESH_EXPIRY=30d

# n8n
N8N_WEBHOOK_BASE_URL=            # https://[n8n-host]/webhook
N8N_API_KEY=                     # n8n API key

# AWS
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# WhatsApp Business API
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

# Google Ads
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_REFRESH_TOKEN=

# Meta Ads
META_APP_ID=
META_APP_SECRET=
META_ACCESS_TOKEN=

# Platform
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://editorschoicemedia.in
API_URL=https://api.editorschoicemedia.in

# MCP
MCP_SERVER_URL=
MCP_API_KEY=
```

---

## 13. DEVELOPMENT RULES

1. **Never hardcode secrets** — all credentials in `.env`, never in code
2. **Never commit `.env`** — `.env.example` only in repo
3. **brand_id on everything** — see Section 4
4. **SSL always** — no HTTP in production
5. **Neon connection via pooler** — see Section 5
6. **n8n async** — never expect synchronous n8n responses
7. **Feature branches only** — `claude/ecm-ai-platform-setup-3kqsm` for this session
8. **No overwriting existing files** — create new, then migrate
9. **Test before push** — run `npm test` before any push
10. **One engine per route file** — `routes/engines/[slug].js`

---

## 14. SKILLS SYSTEM

Skills are multi-engine sequences triggered by a single intent.
Each skill accepts `{ brand_id, goal, context }` and returns a unified result.
Implemented in `src/agents/planner.js` via `GOAL_ENGINE_MAP`.

| Skill | Trigger | Engine Sequence | Description |
|---|---|---|---|
| `generate-ads` | `goal` contains "ads" | `campaign-creator` → `daily-performance` | Create ad campaign then pull initial performance data |
| `build-landing-page` | `goal` contains "landing-page" | `strategy-planning` → `content-generation` → `image-generation` | Full landing page: strategy, copy, visuals |
| `lead-outreach` | `goal` contains "lead-outreach" | `brand-knowledge` → `market-intelligence` → `strategy-planning` | Research-first outreach strategy |
| `full-campaign` | `goal` contains "full-campaign" | `brand-knowledge` → `market-intelligence` → `strategy-planning` → `content-generation` → `image-generation` → `campaign-creator` → `daily-performance` | Complete campaign from brief to live ads |

### How to Invoke a Skill
```http
POST /api/command
{
  "brand_id": "<uuid>",
  "command": "/plan",
  "args": {
    "goal": "build-landing-page for Q2 product launch",
    "context": {
      "product": "ECM AI Suite",
      "audience": "Marketing managers",
      "tone": "professional"
    }
  }
}
```

### Skill Response Shape
```json
{
  "success": true,
  "brand_id": "<uuid>",
  "engine_id": "command-router",
  "command": "/plan",
  "result": {
    "agent_run_id": "<uuid>",
    "goal": "build-landing-page for Q2 product launch",
    "matched_keyword": "landing-page",
    "total_steps": 3,
    "subtasks": [
      { "step": 1, "engine_slug": "strategy-planning", "status": "pending", "depends_on": null },
      { "step": 2, "engine_slug": "content-generation", "status": "pending", "depends_on": "strategy-planning" },
      { "step": 3, "engine_slug": "image-generation",   "status": "pending", "depends_on": "content-generation" }
    ],
    "orchestrator_job_id": "<uuid>",
    "status": "dispatched"
  },
  "timestamp": "ISO-8601"
}
```

### Adding a New Skill
1. Add keyword → engine array entry in `src/agents/planner.js` → `GOAL_ENGINE_MAP`
2. Document it in this table
3. No route changes needed — planner resolves by keyword matching

---

## 15. SESSION NOTES

_Append notes here during active development sessions._

```
[2026-04-01] Session started — initial CLAUDE.md created.
  - Both GitHub repos confirmed empty (README only)
  - Feature branch claude/ecm-ai-platform-setup-3kqsm pushed to both repos
  - Git repos at: /home/user/denmatrix-backend, /home/user/denmatrix-frontend
  - Working source: /home/ubuntu/ecm-ai-os/backend/ (canonical backend)
  - /home/ubuntu/ecm-ai-os/ and /home/ubuntu/ai-platform/ created fresh
  - CLAUDE.md Section 7 updated with all 15 real engine slugs
  - Backend scaffold created: Express + Neon + JWT + brand_id + 15 engine routes + command router
  - Next: scaffold frontend (React/Vite + DenMatrix brand)
```

---

*Last updated: 2026-04-01 | Maintained by Claude Code + Saif Abedin*
