#!/bin/bash
# pm2-startup-ecm.sh
# Configure PM2 to auto-start ecm system on boot
# Run: sudo bash backend/scripts/pm2-startup-ecm.sh

set -e

echo "[PM2 Startup] Configuring PM2 auto-start for ECM-AI-OS..."

PM2_PATH=$(which pm2)
if [ -z "$PM2_PATH" ]; then
  echo "ERROR: pm2 not found in PATH"
  exit 1
fi

echo "[PM2 Startup] PM2 found at: $PM2_PATH"

# Get current PM2 process list
$PM2_PATH list || true

# Save PM2 process list
echo "[PM2 Startup] Saving PM2 process list..."
$PM2_PATH save --force || true

# Generate and setup startup script
echo "[PM2 Startup] Running startup configuration..."
$PM2_PATH startup systemd -u ubuntu --hp /home/ubuntu || true

echo ""
echo "=========================================="
echo "PM2 Auto-Start Configuration Complete"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Review the systemd command output above"
echo "  2. If prompted, run: sudo env PATH=\$PATH:\$(pm2 startup | tail -n 1 | sed 's/^ *//g')"
echo "  3. Verify: sudo systemctl status pm2-ubuntu"
echo ""
echo "On boot, PM2 will auto-start these apps:"
echo "  - ecm-api-staging"
echo "  - ecm-worker-staging"
echo "  - ecm-mcp"
echo "  - ecm-knowledge-brain"
