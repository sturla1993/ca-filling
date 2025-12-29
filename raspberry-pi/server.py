#!/usr/bin/env python3
"""
IBC Fyllesystem - Raspberry Pi 5 Backend
Flask + WebSocket server for relékontroll og sensoravlesning
"""

import os
import glob
import time
import json
import threading
from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS

# Sjekk om vi kjører på Pi eller i utviklingsmiljø
try:
    import smbus2
    import lgpio
    ON_RASPBERRY_PI = True
except ImportError:
    ON_RASPBERRY_PI = False
    lgpio = None
    print("⚠️  Kjører i simuleringsmodus (ikke på Raspberry Pi)")

# Miljøvariabler for delvis simulering
SIMULATE_WEIGHT = os.environ.get('SIMULATE_WEIGHT', '0') == '1'
SIMULATE_RELAYS = os.environ.get('SIMULATE_RELAYS', '0') == '1'
SIMULATE_ALL = os.environ.get('SIMULATE', '0') == '1'

if SIMULATE_ALL:
    SIMULATE_WEIGHT = True
    SIMULATE_RELAYS = True

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# ============== KONFIGURASJON ==============

# GPIO-pinner for relékort (Waveshare 8-ch, direkte GPIO, invertert logikk)
# LOW = PÅ, HIGH = AV
GPIO_CHIP = 0  # gpiochip0 for lgpio
GPIO_RELAY_PUMP = 5     # CH1 - Pumpe
GPIO_RELAY_VALVE = 6    # CH2 - Ventil
GPIO_RELAY_DAMPER = 13  # CH3 - Spjeld

# I2C-adresser
ADS1115_I2C_ADDR = 0x48  # ADS1115 ADC

# Relay-mapping (relay nummer -> funksjon)
RELAY_PUMP = 1      # Pumpe (tank)
RELAY_VALVE = 2     # Ventil (tank)
RELAY_DAMPER = 3    # Spjeld (silo)

# GPIO-mapping (relay nummer -> GPIO pin)
RELAY_GPIO_MAP = {
    RELAY_PUMP: GPIO_RELAY_PUMP,
    RELAY_VALVE: GPIO_RELAY_VALVE,
    RELAY_DAMPER: GPIO_RELAY_DAMPER
}

# Veiecelle konfigurasjon (4-20mA)
WEIGHT_MIN_MA = 4.0      # mA ved 0 kg
WEIGHT_MAX_MA = 20.0     # mA ved maks vekt
WEIGHT_MAX_KG = 1000.0   # Maks kapasitet i kg

# DS18B20 temperatursensor
DS18B20_BASE_DIR = '/sys/bus/w1/devices/'

# ============== HARDWARE KLASSER ==============

class RelayController:
    """Kontrollerer Waveshare 8-Channel Relay Board via lgpio (invertert logikk)"""
    
    def __init__(self):
        self.states = {1: False, 2: False, 3: False}
        self.handle = None
        
        if ON_RASPBERRY_PI and not SIMULATE_RELAYS and lgpio:
            try:
                self.handle = lgpio.gpiochip_open(GPIO_CHIP)
                # Konfigurer GPIO-pinner som output med HIGH (AV, pga invertert logikk)
                for gpio_pin in RELAY_GPIO_MAP.values():
                    lgpio.gpio_claim_output(self.handle, gpio_pin, 1)  # 1 = HIGH = AV
                print(f"✅ Relay board tilkoblet via lgpio (pins {list(RELAY_GPIO_MAP.values())})")
            except Exception as e:
                print(f"❌ Kunne ikke initialisere GPIO: {e}")
                self.handle = None
    
    def set_relay(self, relay_num: int, state: bool):
        """Sett et relay til på (True) eller av (False)"""
        if relay_num not in self.states:
            return False
        self.states[relay_num] = state
        
        if self.handle is not None:
            try:
                gpio_pin = RELAY_GPIO_MAP[relay_num]
                # Invertert logikk: LOW = PÅ, HIGH = AV
                value = 0 if state else 1
                lgpio.gpio_write(self.handle, gpio_pin, value)
            except Exception as e:
                print(f"❌ GPIO-feil (relay {relay_num}): {e}")
        
        print(f"🔌 Relay {relay_num}: {'PÅ' if state else 'AV'}")
        return True
    
    def get_states(self) -> dict:
        """Hent status for alle releer"""
        return {
            'pump': self.states[RELAY_PUMP],
            'valve': self.states[RELAY_VALVE],
            'damper': self.states[RELAY_DAMPER]
        }
    
    def all_off(self):
        """Slå av alle releer (nødstopp)"""
        for relay_num in self.states:
            self.states[relay_num] = False
            if self.handle is not None:
                try:
                    gpio_pin = RELAY_GPIO_MAP[relay_num]
                    lgpio.gpio_write(self.handle, gpio_pin, 1)  # HIGH = AV
                except Exception as e:
                    print(f"❌ GPIO-feil ved nødstopp (relay {relay_num}): {e}")
        print("🛑 ALLE RELEER AV")
    
    def __del__(self):
        """Rydd opp GPIO-ressurser"""
        if self.handle is not None:
            try:
                self.all_off()
                lgpio.gpiochip_close(self.handle)
            except:
                pass


class WeightSensor:
    """Leser industriell veiecelle via ADS1115 (4-20mA)"""
    
    def __init__(self):
        self.bus = None
        if ON_RASPBERRY_PI and not SIMULATE_WEIGHT:
            try:
                self.bus = smbus2.SMBus(1)
                print("✅ Vektsensor (ADC) tilkoblet")
            except Exception as e:
                print(f"❌ Kunne ikke koble til vektsensor: {e}")
        self._simulated_weight = 0.0
    
    def read_weight(self) -> float:
        """Les vekt i kg fra veiecelle"""
        if not self.bus or SIMULATE_WEIGHT:
            return self._simulated_weight
        
        try:
            # Les fra ADS1115 kanal 0
            # Konfigurasjon: Single-ended, ±4.096V, 128 SPS
            config = 0xC183  # Kanal 0, gain 1, single-shot
            self.bus.write_i2c_block_data(ADS1115_I2C_ADDR, 0x01, 
                                          [(config >> 8) & 0xFF, config & 0xFF])
            time.sleep(0.01)  # Vent på konvertering
            
            # Les resultat
            data = self.bus.read_i2c_block_data(ADS1115_I2C_ADDR, 0x00, 2)
            raw = (data[0] << 8) | data[1]
            if raw > 32767:
                raw -= 65536
            
            # Konverter til spenning (med 250Ω motstand: 4-20mA → 1-5V)
            voltage = (raw / 32767.0) * 4.096
            
            # Konverter spenning til strøm (I = V/R, R = 250Ω)
            current_ma = (voltage / 0.250)
            
            # Konverter strøm til vekt
            if current_ma < WEIGHT_MIN_MA:
                return 0.0
            
            weight_fraction = (current_ma - WEIGHT_MIN_MA) / (WEIGHT_MAX_MA - WEIGHT_MIN_MA)
            weight_kg = weight_fraction * WEIGHT_MAX_KG
            
            return max(0.0, min(WEIGHT_MAX_KG, weight_kg))
            
        except Exception as e:
            print(f"❌ Vekt-lesefeil: {e}")
            return 0.0
    
    def simulate_add_weight(self, kg: float):
        """Simuler vektøkning (kun for testing)"""
        self._simulated_weight = min(WEIGHT_MAX_KG, self._simulated_weight + kg)
    
    def simulate_reset(self):
        """Nullstill simulert vekt"""
        self._simulated_weight = 0.0


class TemperatureSensor:
    """Leser DS18B20 temperatursensor via 1-Wire"""
    
    def __init__(self):
        self.device_file = None
        if ON_RASPBERRY_PI:
            self._find_sensor()
    
    def _find_sensor(self):
        """Finn DS18B20 sensor"""
        try:
            devices = glob.glob(DS18B20_BASE_DIR + '28*')
            if devices:
                self.device_file = devices[0] + '/temperature'
                print(f"✅ DS18B20 funnet: {devices[0]}")
        except Exception as e:
            print(f"❌ Kunne ikke finne DS18B20: {e}")
    
    def read_temperature(self) -> float:
        """Les temperatur i °C"""
        if not ON_RASPBERRY_PI or not self.device_file:
            # Simuler temperatur rundt 22°C
            return 22.0 + (time.time() % 10) * 0.1
        
        try:
            with open(self.device_file, 'r') as f:
                temp_raw = f.read().strip()
                return float(temp_raw) / 1000.0
        except Exception as e:
            print(f"❌ Temp-lesefeil: {e}")
            return 0.0


# ============== GLOBALE OBJEKTER ==============

relay_controller = RelayController()
weight_sensor = WeightSensor()
temp_sensor = TemperatureSensor()

# Tilstand
system_state = {
    'filling': False,
    'fill_source': None,  # 'tank' eller 'silo'
    'fill_mode': 'idle',  # 'idle', 'coarse', 'fine'
    'tank_target': 500,
    'silo_target': 500,
    'tank_overrun': 5,
    'silo_overrun': 5,
    'tank_weight': 0,
    'silo_weight': 0
}


# ============== BAKGRUNNSTRÅD FOR SENSORDATA ==============

def sensor_broadcast_loop():
    """Send sensordata til alle tilkoblede klienter hvert 100ms"""
    while True:
        data = {
            'type': 'sensor_update',
            'weight': weight_sensor.read_weight(),
            'temperature': temp_sensor.read_temperature(),
            'relays': relay_controller.get_states(),
            'state': system_state
        }
        socketio.emit('sensor_data', data)
        time.sleep(0.1)


# ============== REST API ==============

@app.route('/api/status', methods=['GET'])
def get_status():
    """Hent systemstatus"""
    return jsonify({
        'weight': weight_sensor.read_weight(),
        'temperature': temp_sensor.read_temperature(),
        'relays': relay_controller.get_states(),
        'state': system_state,
        'on_raspberry_pi': ON_RASPBERRY_PI
    })


@app.route('/api/relay/<relay_name>/<action>', methods=['POST'])
def control_relay(relay_name, action):
    """Kontroller enkelt relay"""
    relay_map = {
        'pump': RELAY_PUMP,
        'valve': RELAY_VALVE,
        'damper': RELAY_DAMPER
    }
    
    if relay_name not in relay_map:
        return jsonify({'error': 'Ukjent relay'}), 400
    
    state = action.lower() == 'on'
    relay_controller.set_relay(relay_map[relay_name], state)
    
    return jsonify({'success': True, 'relay': relay_name, 'state': state})


@app.route('/api/emergency-stop', methods=['POST'])
def emergency_stop():
    """Nødstopp - slå av alle releer"""
    relay_controller.all_off()
    system_state['filling'] = False
    system_state['fill_mode'] = 'idle'
    return jsonify({'success': True, 'message': 'Nødstopp aktivert'})


@app.route('/api/settings', methods=['POST'])
def update_settings():
    """Oppdater innstillinger"""
    data = request.json
    if 'tank_target' in data:
        system_state['tank_target'] = float(data['tank_target'])
    if 'silo_target' in data:
        system_state['silo_target'] = float(data['silo_target'])
    if 'tank_overrun' in data:
        system_state['tank_overrun'] = float(data['tank_overrun'])
    if 'silo_overrun' in data:
        system_state['silo_overrun'] = float(data['silo_overrun'])
    return jsonify({'success': True, 'settings': system_state})


# ============== WEBSOCKET EVENTS ==============

@socketio.on('connect')
def handle_connect():
    print('🔗 Klient tilkoblet')
    emit('connected', {'status': 'ok', 'on_raspberry_pi': ON_RASPBERRY_PI})


@socketio.on('disconnect')
def handle_disconnect():
    print('🔌 Klient frakoblet')


@socketio.on('start_fill')
def handle_start_fill(data):
    """Start fylling fra tank eller silo"""
    source = data.get('source', 'tank')
    system_state['filling'] = True
    system_state['fill_source'] = source
    system_state['fill_mode'] = 'coarse'
    
    if source == 'tank':
        relay_controller.set_relay(RELAY_PUMP, True)
        relay_controller.set_relay(RELAY_VALVE, True)
    else:
        relay_controller.set_relay(RELAY_DAMPER, True)
    
    emit('fill_started', {'source': source})
    print(f"▶️ Fylling startet fra {source}")


@socketio.on('stop_fill')
def handle_stop_fill():
    """Stopp fylling"""
    relay_controller.all_off()
    system_state['filling'] = False
    system_state['fill_mode'] = 'idle'
    emit('fill_stopped', {})
    print("⏹️ Fylling stoppet")


@socketio.on('reset')
def handle_reset():
    """Nullstill system"""
    relay_controller.all_off()
    system_state['filling'] = False
    system_state['fill_mode'] = 'idle'
    system_state['tank_weight'] = 0
    system_state['silo_weight'] = 0
    if SIMULATE_WEIGHT:
        weight_sensor.simulate_reset()
    emit('reset_complete', {})
    print("🔄 System nullstilt")


@socketio.on('update_settings')
def handle_update_settings(data):
    """Oppdater innstillinger via WebSocket"""
    if 'tank_target' in data:
        system_state['tank_target'] = float(data['tank_target'])
    if 'silo_target' in data:
        system_state['silo_target'] = float(data['silo_target'])
    if 'tank_overrun' in data:
        system_state['tank_overrun'] = float(data['tank_overrun'])
    if 'silo_overrun' in data:
        system_state['silo_overrun'] = float(data['silo_overrun'])
    emit('settings_updated', system_state)


# ============== SIMULERING (for testing uten hardware) ==============

@socketio.on('simulate_weight')
def handle_simulate_weight(data):
    """Simuler vektøkning (kun for testing)"""
    if SIMULATE_WEIGHT:
        weight_sensor.simulate_add_weight(data.get('add', 1.0))


# ============== MAIN ==============

if __name__ == '__main__':
    print("=" * 50)
    print("  IBC Fyllesystem - Raspberry Pi Backend")
    print("=" * 50)
    mode_parts = []
    if ON_RASPBERRY_PI:
        mode_parts.append("Raspberry Pi")
    else:
        mode_parts.append("Simulering (full)")
    if SIMULATE_WEIGHT:
        mode_parts.append("Vekt: simulert")
    if SIMULATE_RELAYS:
        mode_parts.append("Releer: simulert")
    print(f"  Modus: {', '.join(mode_parts)}")
    print("=" * 50)
    
    # Start sensor-broadcast i bakgrunnen
    sensor_thread = threading.Thread(target=sensor_broadcast_loop, daemon=True)
    sensor_thread.start()
    
    # Start server
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)
