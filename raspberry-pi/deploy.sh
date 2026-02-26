#!/bin/bash
# IBC Filling System - Komplett Deployment Script
# Kjør denne med: sudo bash deploy.sh

set -e
echo "=== IBC Fyllesystem - Komplett Deployment ==="

# Stopp eksisterende tjeneste
echo "[1/6] Stopper eksisterende tjenester..."
sudo systemctl stop ibc-filling 2>/dev/null || true

# Last ned nyeste backend og requirements
echo "[2/7] Laster ned backend (server.py + requirements)..."
wget -q -O /home/menstad/server.py https://raw.githubusercontent.com/sturla1993/ca-filling/main/raspberry-pi/server.py
wget -q -O /tmp/requirements.txt https://raw.githubusercontent.com/sturla1993/ca-filling/main/raspberry-pi/requirements.txt
echo "      Backend lastet ned."

# Installer Python-avhengigheter
echo "[3/7] Installerer Python-avhengigheter..."
pip3 install -r /tmp/requirements.txt --break-system-packages 2>/dev/null || pip3 install -r /tmp/requirements.txt
echo "      Avhengigheter installert."

# Last ned nyeste frontend-bygg
echo "[4/7] Laster ned frontend..."
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

# Installer/oppdater Nginx-konfig
echo "[5/7] Oppdaterer Nginx-konfigurasjon..."
sudo wget -q -O /etc/nginx/sites-available/default https://raw.githubusercontent.com/sturla1993/ca-filling/main/raspberry-pi/nginx.conf 2>/dev/null || true
sudo systemctl restart nginx 2>/dev/null || true

# Installer systemd service
echo "[6/7] Installerer systemd service..."
sudo wget -q -O /etc/systemd/system/ibc-filling.service https://raw.githubusercontent.com/sturla1993/ca-filling/main/raspberry-pi/ibc-filling.service

# Start tjenesten
echo "[7/7] Starter backend-tjeneste..."
sudo systemctl daemon-reload
sudo systemctl enable ibc-filling
sudo systemctl start ibc-filling

# Verifiser
echo ""
echo "--- Verifisering ---"
sleep 2
if systemctl is-active --quiet ibc-filling; then
    echo "  ✓ Backend kjører"
else
    echo "  ✗ Backend feilet - sjekk: sudo journalctl -u ibc-filling -n 50"
fi

echo ""
echo "=== Ferdig! ==="
echo "Åpne http://127.0.0.1 i nettleseren."
echo ""
echo "Nyttige kommandoer:"
echo "  sudo systemctl status ibc-filling   - Se status"
echo "  sudo systemctl restart ibc-filling  - Restart backend"
echo "  sudo journalctl -u ibc-filling -f   - Se logger"
