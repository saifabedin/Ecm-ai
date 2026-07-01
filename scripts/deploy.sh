#!/usr/bin/env bash
set -euo pipefail

echo "=== ECM-AI-OS Deploy ==="
git pull origin main
npm install --omit=dev --no-audit --no-fund
pm2 reload all --update-env
pm2 status
echo "=== Deploy complete ==="
