# ecm-debugger

Use when anything is broken, crashing, returning wrong data, or behaving unexpectedly in ECM-AI-OS. Systematic root cause analysis for Node.js + PostgreSQL + Redis + BullMQ + PM2 on EC2.

## Quick Checks
```bash
pm2 list                              # all process status
pm2 logs ecm-api --lines 50           # API error logs
pm2 logs ecm-worker --lines 50        # worker logs
curl http://localhost:4000/health     # API health
node -e "require('redis').createClient({url:process.env.REDIS_URL}).ping().then(console.log)"
node -e "require('./backend/db/client.cjs').query('SELECT 1').then(r=>console.log('DB OK'))"
```

## Common Failure Modes
| Symptom | Likely Cause |
|---------|-------------|
| 401 on all routes | Missing/malformed JWT or brand_id header |
| Worker not processing | Redis down or BullMQ connection error |
| DB query timeout | Neon cold start or connection pool exhaustion |
| Engine returns empty | Missing API key for provider (ElevenLabs, OpenAI) |
| PM2 process keeps restarting | Uncaught exception or OOM (check max_memory_restart) |

## Debug Steps
1. Check PM2 status → logs
2. Verify Redis ping
3. Verify DB connection
4. Check .env has all required keys
5. Check specific engine/service logs in `backend/logs/`

## Gotchas
- Two parallel codebases (`backend/` vs `src/`) — ensure you're debugging the right one
- `unhandledRejection` is non-fatal in worker, `uncaughtException` is fatal
- Superpowers SDD tasks may have introduced regressions — check `.superpowers/sdd/review-*.diff`
- Razorpay webhook failures: ensure webhook route mounts BEFORE express.json()
