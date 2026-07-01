# ecm-sales

Use for sales automation features — WhatsApp outreach sequences, lead qualification AI flow, appointment booking integration, follow-up automation, Cal.com webhook.

## Related Components
- `backend/engines/engine1-research.cjs` — market intelligence / lead research
- `backend/engines/engine2-content.cjs` — outreach content generation
- `backend/engines/engine6-ads.cjs` — ad campaign management
- `backend/controllers/onboarding.cjs` — lead onboarding flow
- n8n workflows for lead ingestion from Google Sheets

## Patterns
- Lead qualification: source → enrich → score → enroll → sequence
- Outreach channels: email (Gmail SMTP), WhatsApp (WPPConnect), LinkedIn (mock)
- Appointment booking via Cal.com integration
- Follow-up cadence configurable per campaign

## Gotchas
- WhatsApp integration requires WPPConnect server running separately
- Most providers support `mock` mode for development without real credits
- brand_id must propagate through all sales workflows
- Autopilot loop runs every 60s — check `AUTOPILOT_INTERVAL_MS` in .env
