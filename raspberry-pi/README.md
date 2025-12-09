# IBC Fyllesystem - Raspberry Pi 5 Backend

## Maskinvare

### Handleliste
| Komponent | Modell | Ca. pris |
|-----------|--------|----------|
| Relemodul | Waveshare RPi Relay Board (B) 8-kanal | 300 kr |
| ADC for 4-20mA | NCD 4-Channel 4-20mA Current Loop Receiver (ADS1115) | 600 kr |
| Temperatursensor | DS18B20 vannbestandig probe | 50 kr |
| Pull-up motstand | 4.7kΩ for DS18B20 | 5 kr |
| Kabler | Jumper-kabler female-female 40-pack | 50 kr |
| Strømforsyning | 5V 3A USB-C for Pi 5 | 150 kr |
| SD-kort | 32GB microSD | 100 kr |

**Totalt: ~1250 kr** (ekskl. Raspberry Pi 5)

---

## Koblingsskjema

```
                    RASPBERRY PI 5
                    ┌─────────────────────────────────────┐
                    │  3.3V (1) ●──────┐                  │
                    │   5V  (2) ●      │                  │
                    │  SDA (3) ●───────┼──► I2C Data      │
                    │   5V  (4) ●      │                  │
                    │  SCL (5) ●───────┼──► I2C Clock     │
                    │  GND (6) ●───────┼──► GND           │
                    │ GPIO4(7) ●───────┼──► DS18B20 Data  │
                    │         ...      │                  │
                    └─────────────────────────────────────┘
                                       │
        ┌──────────────────────────────┴──────────────────────────────┐
        │                              │                              │
        ▼                              ▼                              ▼
┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
│ WAVESHARE RELAY   │      │ ADS1115 4-20mA    │      │ DS18B20           │
│ BOARD (B)         │      │ ADC MODUL         │      │ TEMP SENSOR       │
├───────────────────┤      ├───────────────────┤      ├───────────────────┤
│ I2C Adresse: 0x20 │      │ I2C Adresse: 0x48 │      │ 1-Wire på GPIO4   │
│                   │      │                   │      │                   │
│ Relay 1 → Pumpe   │      │ CH0 → Veiecelle   │      │ VCC → 3.3V        │
│ Relay 2 → Ventil  │      │     (4-20mA)      │      │ GND → GND         │
│ Relay 3 → Spjeld  │      │                   │      │ DATA → GPIO4      │
│                   │      │                   │      │ + 4.7kΩ pull-up   │
└───────────────────┘      └───────────────────┘      └───────────────────┘
        │                              │
        ▼                              ▼
┌───────────────────┐      ┌───────────────────┐
│ TIL UTSTYR        │      │ FRA VEIECELLE     │
├───────────────────┤      ├───────────────────┤
│ Pumpe: 230V/24V   │      │ + → CH0+          │
│ Ventil: 24V       │      │ - → CH0-          │
│ Spjeld: 24V       │      │ (4-20mA signal)   │
└───────────────────┘      └───────────────────┘
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

### 3. Aktiver I2C og 1-Wire
```bash
sudo raspi-config
# Interface Options → I2C → Enable
# Interface Options → 1-Wire → Enable
sudo reboot
```

### 4. Installer Python-avhengigheter
```bash
sudo apt install python3-pip python3-venv -y
cd ~
mkdir ibc-control && cd ibc-control
python3 -m venv venv
source venv/bin/activate
pip install flask flask-socketio flask-cors smbus2 RPi.GPIO
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

## Test I2C-enheter
```bash
sudo i2cdetect -y 1
# Skal vise:
# 0x20 - Waveshare Relay Board
# 0x48 - ADS1115 ADC
```

## Test DS18B20
```bash
ls /sys/bus/w1/devices/
# Skal vise 28-xxxxxxxxxxxx (sensor-ID)
cat /sys/bus/w1/devices/28-*/temperature
# Viser temperatur i milligrader (22500 = 22.5°C)
```
