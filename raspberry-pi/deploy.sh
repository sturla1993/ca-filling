#!/bin/bash
# IBC Filling System - Komplett Deployment Script
# Kjør denne med: sudo bash deploy.sh

set -e
echo "=== IBC Fyllesystem - Komplett Deployment ==="

# Stopp eksisterende tjeneste
echo "[1/6] Stopper eksisterende tjenester..."
sudo systemctl stop ibc-filling 2>/dev/null || true

# Last ned nyeste backend
echo "[2/6] Laster ned backend (server.py)..."
wget -q -O /home/menstad/server.py https://raw.githubusercontent.com/sturla1993/ca-filling/main/raspberry-pi/server.py
echo "      Backend lastet ned."

# Last ned nyeste frontend-bygg
echo "[3/6] Laster ned frontend..."
cd /tmp
rm -rf frontend-dist 2>/dev/null || true
mkdir -p frontend-dist
cd frontend-dist

# Last ned pre-bygget frontend fra GitHub releases eller bygg lokalt
if command -v npm &> /dev/null; then
    echo "      npm funnet - bygger fra kilde..."
    cd /home/menstad
    if [ -d "ca-filling" ]; then
        cd ca-filling
        git pull
    else
        git clone https://github.com/sturla1993/ca-filling.git
        cd ca-filling
    fi
    npm install
    npm run build
    sudo cp -r dist/* /var/www/html/
else
    echo "      Laster ned ferdigbygd frontend..."
    wget -q -O frontend.tar.gz https://github.com/sturla1993/ca-filling/releases/latest/download/frontend.tar.gz 2>/dev/null || {
        echo "      ADVARSEL: Kunne ikke laste ned frontend. Du må bygge manuelt."
        echo "      Kjør: cd ~/ca-filling && npm install && npm run build && sudo cp -r dist/* /var/www/html/"
    }
    if [ -f frontend.tar.gz ]; then
        tar -xzf frontend.tar.gz
        sudo cp -r dist/* /var/www/html/
    fi
fi
echo "      Frontend installert."

# Installer systemd service
echo "[4/6] Installerer systemd service..."
sudo wget -q -O /etc/systemd/system/ibc-filling.service https://raw.githubusercontent.com/sturla1993/ca-filling/main/raspberry-pi/ibc-filling.service

# Start tjenesten
echo "[5/6] Starter backend-tjeneste..."
sudo systemctl daemon-reload
sudo systemctl enable ibc-filling
sudo systemctl start ibc-filling

# Verifiser
echo "[6/6] Verifiserer..."
sleep 2
if systemctl is-active --quiet ibc-filling; then
    echo "      ✓ Backend kjører"
else
    echo "      ✗ Backend feilet - sjekk: sudo journalctl -u ibc-filling -n 50"
fi

echo ""
echo "=== Ferdig! ==="
echo "Åpne http://127.0.0.1 i nettleseren."
echo ""
echo "Nyttige kommandoer:"
echo "  sudo systemctl status ibc-filling   - Se status"
echo "  sudo systemctl restart ibc-filling  - Restart backend"
echo "  sudo journalctl -u ibc-filling -f   - Se logger"
