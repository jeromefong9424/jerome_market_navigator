#!/bin/bash
# Run this on your Hetzner box (as jerome with sudo)
# Usage: ssh jerome@195.201.130.210 'sudo bash -s' < deploy/setup.sh

set -e

echo "=== Installing dependencies ==="
apt update && apt install -y python3 python3-venv python3-pip nginx git

echo "=== Creating user jerome (if needed) ==="
id jerome &>/dev/null || useradd -m -s /bin/bash jerome

echo "=== Cloning repo ==="
mkdir -p /opt/jerome-market-navigator
if [ -d /opt/jerome-market-navigator/.git ]; then
    cd /opt/jerome-market-navigator && git pull
else
    git clone https://github.com/jeromefong9424/jerome_market_navigator.git /opt/jerome-market-navigator
fi
chown -R jerome:jerome /opt/jerome-market-navigator

echo "=== Setting up Python venv ==="
cd /opt/jerome-market-navigator/backend
sudo -u jerome python3 -m venv .venv
sudo -u jerome .venv/bin/pip install -r requirements.txt

echo "=== Create .env (if missing) ==="
if [ ! -f .env ]; then
    echo "ANTHROPIC_API_KEY=your-key-here" > .env
    chown jerome:jerome .env
    echo ">>> IMPORTANT: Edit /opt/jerome-market-navigator/backend/.env with your real API key"
fi

echo "=== Installing systemd service ==="
cp /opt/jerome-market-navigator/deploy/jmn-api.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable jmn-api
systemctl restart jmn-api

echo "=== Installing nginx config ==="
cp /opt/jerome-market-navigator/deploy/jmn-api.nginx /etc/nginx/sites-available/jmn-api
ln -sf /etc/nginx/sites-available/jmn-api /etc/nginx/sites-enabled/jmn-api
nginx -t && systemctl reload nginx

echo ""
echo "=== Done! ==="
echo "API running at: http://195.201.130.210/api/rs?tickers=SPY"
echo ""
echo "Next steps:"
echo "  1. Edit /opt/jerome-market-navigator/backend/.env with your ANTHROPIC_API_KEY"
echo "  2. systemctl restart jmn-api"
echo "  3. Set GitHub secret VITE_API_URL = http://195.201.130.210/api"
