# ecm-security

Use for security reviews, auth hardening, prompt injection prevention, input validation, rate limiting on ECM-AI-OS.

## Auth Layer
- JWT (jsonwebtoken) with HS256 — `JWT_SECRET` from env
- Middleware chain: `authenticateToken` → `attachBrandId` → `requireSuperAdmin`
- brand_id extracted from JWT payload or header
- is_super_admin flag in JWT for admin routes

## Rate Limiting
- `express-rate-limit` — 100 requests per minute per IP (global)
- Higher limits for authenticated routes
- Razorpay webhook exempted from rate limiter

## Security Rules
- ALWAYS validate brand_id UUID format (v4)
- ALWAYS verify Razorpay webhook HMAC-SHA256 signature
- NEVER commit `.env` files with real credentials
- NEVER expose error details in production responses
- Input sanitization on all user-controlled strings
- Prompt injection prevention in AI service inputs

## Audit
- All state-changing operations logged to `audit_log` table
- Append-only pattern for compliance
- Structured error responses `{ success: false, error, stage }`

## Gotchas
- Two auth systems exist: `backend/middleware/` (runtime) and `src/middleware/` (legacy)
- `.env` files are in .gitignore but backups may accidentally get committed
- MCP server uses `MCP_API_KEY` bearer token — rotate regularly
- Rate limiter counts n8n webhook calls — exempt or raise cap for webhooks
