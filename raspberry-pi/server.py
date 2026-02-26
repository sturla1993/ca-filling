#!/usr/bin/env python3
"""
IBC Fyllesystem - Raspberry Pi 5 Backend
Flask + WebSocket server for relékontroll og sensoravlesning
"""

import os
import time
import json
import threading
import serial
from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS

# Sjekk om vi kjører på Pi eller i utviklingsmiljø
try:
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
GPIO_RELAY_PUMP = 5        # CH1 - Pumpe
GPIO_RELAY_VALVE = 6       # CH2 - Ventil (grov)
GPIO_RELAY_FINE_VALVE = 19 # CH3 - Ventil (fin)
GPIO_RELAY_DAMPER = 13     # CH4 - Spjeld

# Kern vekt via RS-232/USB
KERN_SERIAL_PORT = os.environ.get('KERN_PORT', '/dev/ttyUSB0')
KERN_BAUD_RATE = int(os.environ.get('KERN_BAUD', '9600'))
KERN_TIMEOUT = 1  # sekunder

# Relay-mapping (relay nummer -> funksjon)
RELAY_PUMP = 1           # Pumpe (tank)
RELAY_VALVE = 2          # Ventil grov (tank)
RELAY_FINE_VALVE = 3     # Ventil fin (tank)
RELAY_DAMPER = 4         # Spjeld (silo)

# GPIO-mapping (relay nummer -> GPIO pin)
RELAY_GPIO_MAP = {
    RELAY_PUMP: GPIO_RELAY_PUMP,
    RELAY_VALVE: GPIO_RELAY_VALVE,
    RELAY_FINE_VALVE: GPIO_RELAY_FINE_VALVE,
    RELAY_DAMPER: GPIO_RELAY_DAMPER
}

WEIGHT_MAX_KG = 1000.0   # Maks kapasitet i kg (for simulering)

# ============== HARDWARE KLASSER ==============

class RelayController:
    """Kontrollerer Waveshare 8-Channel Relay Board via lgpio (invertert logikk)"""
    
    def __init__(self):
        self.states = {1: False, 2: False, 3: False, 4: False}
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
            'fine_valve': self.states[RELAY_FINE_VALVE],
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
    """Leser vekt fra Kern vektindikator via RS-232 (seriell/USB)"""
    
    def __init__(self):
        self.serial_conn = None
        self._last_weight = 0.0
        self._simulated_weight = 0.0
        
        if ON_RASPBERRY_PI and not SIMULATE_WEIGHT:
            try:
                self.serial_conn = serial.Serial(
                    port=KERN_SERIAL_PORT,
                    baudrate=KERN_BAUD_RATE,
                    bytesize=serial.EIGHTBITS,
                    parity=serial.PARITY_NONE,
                    stopbits=serial.STOPBITS_ONE,
                    timeout=KERN_TIMEOUT
                )
                print(f"✅ Kern vekt tilkoblet på {KERN_SERIAL_PORT} ({KERN_BAUD_RATE} baud)")
            except Exception as e:
                print(f"❌ Kunne ikke koble til Kern vekt: {e}")
    
    def read_weight(self) -> float:
        """Les vekt i kg fra Kern vektindikator via RS-232"""
        if not self.serial_conn or SIMULATE_WEIGHT:
            return self._simulated_weight
        
        try:
            # Send Kern-kommando for å be om vekt (standard: 'w' eller 's')
            self.serial_conn.write(b'w\r\n')
            time.sleep(0.05)
            
            response = self.serial_conn.readline().decode('ascii', errors='ignore').strip()
            
            if response:
                # Parse Kern-respons, typisk format: "S S     123.45 kg"
                # Fjern bokstaver og enheter, behold tall
                weight_str = ''
                for part in response.split():
                    try:
                        weight_str = part
                        val = float(part)
                        self._last_weight = val
                        return val
                    except ValueError:
                        continue
            
            return self._last_weight
            
        except Exception as e:
            print(f"❌ Kern vekt-lesefeil: {e}")
            return self._last_weight
    
    def simulate_add_weight(self, kg: float):
        self._simulated_weight = min(WEIGHT_MAX_KG, self._simulated_weight + kg)
    
    def simulate_reset(self):
        self._simulated_weight = 0.0
    
    def __del__(self):
        if self.serial_conn and self.serial_conn.is_open:
            self.serial_conn.close()


# ============== GLOBALE OBJEKTER ==============

relay_controller = RelayController()
weight_sensor = WeightSensor()

# Tilstand
system_state = {
    'filling': False,
    'fill_source': None,       # 'tank' eller 'silo'
    'fill_mode': 'idle',       # 'idle', 'coarse', 'fine'
    'tank_target': 500,
    'silo_target': 500,
    'tank_fine_threshold': 450,  # Vekt der finfylling starter
    'tank_overrun': 5,
    'silo_overrun': 5,
    'tank_weight': 0,
    'silo_weight': 0
}


# ============== AUTOMATISK FINFYLLING ==============

def check_auto_fine_fill():
    """Sjekk om vi skal bytte fra grovfylling til finfylling for tank"""
    if (system_state['filling'] and 
        system_state['fill_source'] == 'tank' and 
        system_state['fill_mode'] == 'coarse'):
        
        if system_state['tank_weight'] >= system_state['tank_fine_threshold']:
            # Bytt til finfylling: slå av pumpe+grovventil, start finventil
            relay_controller.set_relay(RELAY_PUMP, False)
            relay_controller.set_relay(RELAY_VALVE, False)
            relay_controller.set_relay(RELAY_FINE_VALVE, True)
            system_state['fill_mode'] = 'fine'
            print(f"🔄 Bytter til finfylling ved {system_state['tank_weight']:.1f} kg")


def check_auto_stop():
    """Sjekk om fylling skal stoppes automatisk (mål minus etterrenning)"""
    if not system_state['filling']:
        return
    
    source = system_state['fill_source']
    
    if source == 'tank':
        stop_at = system_state['tank_target'] - system_state['tank_overrun']
        if system_state['tank_weight'] >= stop_at:
            relay_controller.all_off()
            system_state['filling'] = False
            system_state['fill_mode'] = 'idle'
            print(f"✅ Tankfylling fullført ved {system_state['tank_weight']:.1f} kg (mål: {system_state['tank_target']} kg)")
    
    elif source == 'silo':
        stop_at = system_state['silo_target'] - system_state['silo_overrun']
        if system_state['silo_weight'] >= stop_at:
            relay_controller.all_off()
            system_state['filling'] = False
            system_state['fill_mode'] = 'idle'
            print(f"✅ Silofylling fullført ved {system_state['silo_weight']:.1f} kg (mål: {system_state['silo_target']} kg)")


# ============== BAKGRUNNSTRÅD FOR SENSORDATA ==============

def sensor_broadcast_loop():
    """Oppdater sensordata og simuler vekt når fylling pågår"""
    global system_state
    while True:
        # Simuler vektøkning når releene er på
        relays = relay_controller.get_states()
        if SIMULATE_WEIGHT:
            if relays['pump'] or relays['valve']:
                # Grovfylling tank - ca 10 kg/sek
                system_state['tank_weight'] += 1.0
            if relays['fine_valve']:
                # Finfylling tank - ca 1 kg/sek
                system_state['tank_weight'] += 0.1
            if relays['damper']:
                # Silo fylling - ca 10 kg/sek
                system_state['silo_weight'] += 1.0
        
        # Sjekk automatisk overgang til finfylling og autostopp
        check_auto_fine_fill()
        check_auto_stop()
        
        data = {
            'type': 'sensor_update',
            'weight': weight_sensor.read_weight(),
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
        'fine_valve': RELAY_FINE_VALVE,
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
    if 'tank_fine_threshold' in data:
        system_state['tank_fine_threshold'] = float(data['tank_fine_threshold'])
    if 'tank_overrun' in data:
        system_state['tank_overrun'] = float(data['tank_overrun'])
    if 'silo_overrun' in data:
        system_state['silo_overrun'] = float(data['silo_overrun'])
    return jsonify({'success': True, 'settings': system_state})


@app.route('/api/start-fill/<source>', methods=['POST'])
def start_fill(source):
    """Start fylling fra tank eller silo via REST"""
    if source not in ['tank', 'silo']:
        return jsonify({'error': 'Ugyldig kilde, bruk tank eller silo'}), 400
    
    system_state['filling'] = True
    system_state['fill_source'] = source
    system_state['fill_mode'] = 'coarse'
    
    if source == 'tank':
        # Start pumpe + grovventil simultant
        relay_controller.set_relay(RELAY_PUMP, True)
        relay_controller.set_relay(RELAY_VALVE, True)
        relay_controller.set_relay(RELAY_FINE_VALVE, False)  # Sørg for at finventil er av
    else:
        # Start spjeld for tørrstoff
        relay_controller.set_relay(RELAY_DAMPER, True)
    
    print(f"▶️ Fylling startet fra {source}")
    return jsonify({'success': True, 'source': source})


@app.route('/api/stop-fill', methods=['POST'])
def stop_fill():
    """Stopp fylling via REST"""
    relay_controller.all_off()
    system_state['filling'] = False
    system_state['fill_mode'] = 'idle'
    print("⏹️ Fylling stoppet")
    return jsonify({'success': True})


@app.route('/api/reset', methods=['POST'])
def reset_system():
    """Nullstill system via REST"""
    relay_controller.all_off()
    system_state['filling'] = False
    system_state['fill_mode'] = 'idle'
    system_state['tank_weight'] = 0
    system_state['silo_weight'] = 0
    if SIMULATE_WEIGHT:
        weight_sensor.simulate_reset()
    print("🔄 System nullstilt")
    return jsonify({'success': True})


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
        relay_controller.set_relay(RELAY_FINE_VALVE, False)
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
    if 'tank_fine_threshold' in data:
        system_state['tank_fine_threshold'] = float(data['tank_fine_threshold'])
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
    print(f"  Releer: Pumpe(GPIO{GPIO_RELAY_PUMP}), Ventil grov(GPIO{GPIO_RELAY_VALVE}), Ventil fin(GPIO{GPIO_RELAY_FINE_VALVE}), Spjeld(GPIO{GPIO_RELAY_DAMPER})")
    print("=" * 50)
    
    # Start sensor-broadcast i bakgrunnen
    sensor_thread = threading.Thread(target=sensor_broadcast_loop, daemon=True)
    sensor_thread.start()
    
    # Start server
    socketio.run(app, host='0.0.0.0', port=5000, debug=False, allow_unsafe_werkzeug=True)
