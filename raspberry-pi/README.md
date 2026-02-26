# IBC Fyllesystem - Raspberry Pi 5 Backend

## Maskinvare

### Handleliste
| Komponent | Modell | Ca. pris |
|-----------|--------|----------|
| Relemodul | Waveshare RPi Relay Board (B) 8-kanal | 300 kr |
| Vektindikator | Kern med KUP (RS-232) | (eksisterende) |
| USB-RS232 adapter | USB til RS-232 kabel (evt. Kern KUP-kabel) | 100 kr |
| Kabler | Jumper-kabler female-female 40-pack | 50 kr |
| Strømforsyning | 5V 3A USB-C for Pi 5 | 150 kr |
| SD-kort | 32GB microSD | 100 kr |

**Totalt: ~700 kr** (ekskl. Raspberry Pi 5 og Kern vektindikator)

---

## Koblingsskjema

```
                    RASPBERRY PI 5
                    ┌─────────────────────────────────────┐
                    │   5V  (2) ●                         │
                    │   5V  (4) ●                         │
                    │  GND (6) ●───────┼──► GND           │
                    │         ...      │                  │
                    │  USB Port ●──────┼──► Kern RS-232   │
                    └─────────────────────────────────────┘
                                       │
         ┌─────────────────────────────┴──────────────────┐
         │                              │                  
         ▼                              ▼                  
┌───────────────────┐      ┌───────────────────┐
│ WAVESHARE RELAY   │      │ KERN VEKT         │
│ BOARD (B)         │      │ (RS-232/USB)      │
├───────────────────┤      ├───────────────────┤
│ GPIO direkte      │      │ USB → /dev/ttyUSB0│
│                   │      │ 9600 baud, 8N1    │
│ Relay 1 → Pumpe   │      │                   │
│ Relay 2 → Ventil  │      │ KUP-kabel eller   │
│ Relay 3 → Finvent.│      │ USB-RS232 adapter  │
│ Relay 4 → Spjeld  │      │                   │
└───────────────────┘      └───────────────────┘
         │
         ▼
┌───────────────────┐
│ TIL UTSTYR        │
├───────────────────┤
│ Pumpe: 230V/24V   │
│ Ventil: 24V       │
│ Spjeld: 24V       │
└───────────────────┘
```

---

## Installasjon på Raspberry Pi 5

### 1. Installer OS
```bash
# Bruk Raspberry Pi Imager til å installere Raspberry Pi OS (64-bit)
# Aktiver SSH og sett opp WiFi under installasjon
```

### 2. Oppdater systemet
```bash
sudo apt update && sudo apt upgrade -y
```

### 3. Installer Python-avhengigheter
```bash
sudo apt install python3-pip python3-venv -y
cd ~
mkdir ibc-control && cd ibc-control
python3 -m venv venv
source venv/bin/activate
pip install flask flask-socketio flask-cors pyserial lgpio
```

### 5. Kopier backend-filer
```bash
# Kopier server.py og requirements.txt til ~/ibc-control/
```

### 6. Kjør som service (valgfritt)
```bash
sudo nano /etc/systemd/system/ibc-control.service
```

Lim inn:
```ini
[Unit]
Description=IBC Control System
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/ibc-control
Environment=PATH=/home/pi/ibc-control/venv/bin
ExecStart=/home/pi/ibc-control/venv/bin/python server.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Aktiver:
```bash
sudo systemctl enable ibc-control
sudo systemctl start ibc-control
```

---

## Test Kern vekt (RS-232)
```bash
# Sjekk at USB-RS232 adapteren er tilkoblet
ls /dev/ttyUSB*
# Skal vise /dev/ttyUSB0

# Test manuell avlesning
python3 -c "
import serial
ser = serial.Serial('/dev/ttyUSB0', 9600, timeout=1)
ser.write(b'w\r\n')
print(ser.readline().decode('ascii', errors='ignore').strip())
ser.close()
"
```

