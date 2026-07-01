# ecm-devops

Use for EC2 deployment, Nginx config, SSL, PM2 management, environment variables, server monitoring.

## Infrastructure
- AWS EC2 eu-north-1 (Stockholm)
- PM2 runtime with `ecosystem.config.js`
- Neon PostgreSQL (serverless, no pooler needed)
- Redis (self-hosted or Upstash)
- n8n for workflow automation

## PM2 Processes
```bash
pm2 start ecosystem.config.js               # start all
pm2 restart ecm-api                          # restart API
pm2 restart ecm-worker                       # restart worker
pm2 logs ecm-api                             # tail logs
pm2 reload all --update-env                  # reload after .env change
```

## Deployment
```bash
git pull origin main
npm install --omit=dev
pm2 reload all --update-env
```

## Gotchas
- Node.js 20 with `/opt/node20/` binary
- SSL via Let's Encrypt + Nginx reverse proxy
- Rate limiting: 100 req/min per IP (express-rate-limit)
- EC2 security groups must allow ports 3000/4000/5000
- `.env` files contain live credentials — never commit
