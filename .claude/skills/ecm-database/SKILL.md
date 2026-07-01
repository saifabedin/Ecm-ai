# ecm-database

Use for all PostgreSQL tasks on ECM-AI-OS — schema changes, migrations, query optimization, indexes. Multi-tenant isolation with INTEGER primary keys.

## Connection
- Neon PostgreSQL (serverless) via `backend/db/client.cjs`
- Connection string from `DATABASE_URL` env var
- pg Pool with max 5 connections

## Schema
- `tenants` — multi-tenant orgs (business_name, niche, subscription_status, onboarding_complete, plan_id)
- `users` — auth + is_super_admin flag
- `subscriptions` — Razorpay subscription tracking
- `billing_events` — Razorpay webhook event log
- `plans` — pricing tiers (starter, pro, enterprise)
- `brand_knowledge` — per-tenant brand data
- `agent_memory` — agent conversation history
- `agent_collaboration` — inter-agent messages

## Patterns
- ALWAYS filter by `brand_id` on multi-tenant tables
- Migrations in `backend/db/migrate-*.cjs` files
- Raw SQL via `pg` driver (no ORM — Drizzle was removed)
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for idempotent migrations
- CHECK constraints for enum-like columns

## Commands
```bash
node backend/db/migrate-saas.cjs     # SaaS multi-tenant migration
node src/database/migrate.js          # Legacy migration
node src/database/seed.js             # Seed data
```

## Gotchas
- No migration framework — files are manually ordered
- Two DB configs: `backend/db/client.cjs` (runtime) and `src/config/db.js` (legacy)
- `plan_id` in tenants is INTEGER referencing plans.id
- Razorpay webhook secret must be validated via HMAC SHA256
