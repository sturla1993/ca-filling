#!/bin/bash
# IBC Filling System - Deployment Script
# Kjør denne med: sudo bash deploy.sh

echo "=== IBC Fyllesystem Deployment ==="

# Stopp eksisterende tjeneste hvis den kjører
sudo systemctl stop ibc-filling 2>/dev/null

# Last ned nyeste server.py
echo "Laster ned server.py..."
wget -O /home/menstad/server.py https://raw.githubusercontent.com/sturla1993/ca-filling/main/raspberry-pi/server.py

# Last ned og installer systemd service
echo "Installerer systemd service..."
wget -O /etc/systemd/system/ibc-filling.service https://raw.githubusercontent.com/sturla1993/ca-filling/main/raspberry-pi/ibc-filling.service

# Reload systemd og start tjenesten
sudo systemctl daemon-reload
sudo systemctl enable ibc-filling
sudo systemctl start ibc-filling

# Sjekk status
echo ""
echo "=== Service Status ==="
sudo systemctl status ibc-filling --no-pager

echo ""
echo "=== Ferdig! ==="
echo "Backend kjører nå automatisk ved oppstart."
echo "Åpne http://127.0.0.1 i nettleseren for å bruke systemet."
echo ""
echo "Nyttige kommandoer:"
echo "  sudo systemctl status ibc-filling  - Se status"
echo "  sudo systemctl restart ibc-filling - Restart"
echo "  sudo journalctl -u ibc-filling -f  - Se logger"
