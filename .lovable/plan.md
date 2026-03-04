

## Plan: Bruk ekte Kern-vekt for reléstyring + tarering

### Problemet nå
- `tank_weight` og `silo_weight` oppdateres **kun** i simuleringsmodus (hardkodede inkrementer)
- Når ekte Kern-vekt er tilkoblet, leses den via `read_weight()` men brukes **ikke** av autostopp/finfylling
- Tarering på Kern-indikatoren nullstiller displayet, men backend husker gamle verdier i `system_state`

### Løsning

#### Backend (`raspberry-pi/server.py`)

**1. Bruk ekte vekt i sensor-loopen:**

I `sensor_broadcast_loop()`, endre logikken slik at:
- Når `SIMULATE_WEIGHT` er `False`: les vekt fra `weight_sensor.read_weight()` og sett `tank_weight` eller `silo_weight` direkte basert på hvilken kilde som fylles
- Når `SIMULATE_WEIGHT` er `True`: behold nåværende simuleringslogikk

Konkret: etter simuleringsblokken, legg til:
```python
if not SIMULATE_WEIGHT:
    real_weight = weight_sensor.read_weight()
    if system_state['fill_source'] == 'tank' or not system_state['filling']:
        system_state['tank_weight'] = real_weight
    if system_state['fill_source'] == 'silo':
        system_state['silo_weight'] = real_weight
```

**2. Tarering:**

Kern-indikatoren har fysisk tare-knapp. Når operatøren trykker tare på indikatoren, sender den 0.0 kg tilbake via RS-232. Dette betyr at `read_weight()` returnerer 0, og `tank_weight`/`silo_weight` settes automatisk til 0 — **tarering fungerer automatisk**.

I tillegg, i `reset`-endepunktet, legg til at `tank_weight` og `silo_weight` settes til den nåværende vekten (som vil være 0 etter tare), slik at nullstilling i UI-et også synkroniserer.

#### Frontend — ingen endringer nødvendig
Frontend viser allerede `tank_weight`/`silo_weight` fra `system_state`. Når backend oppdaterer disse med ekte verdier, fungerer alt automatisk.

### Viktig merknad om vektflyt
Systemet bruker **én vekt** (Kern). Når du fyller tank, er det vekten som vises. Når du fyller silo, er det samme vekt. Vekten tareres mellom hver fylling. Planen tar høyde for dette — den aktive kildeen (`fill_source`) bestemmer hvilken state-variabel som oppdateres.

### Oppsummering
- 1 fil endres: `raspberry-pi/server.py`
- Ekte vekt styrer autostopp og finfylling
- Tarering på Kern = automatisk tarering i systemet
- Simulering fungerer fortsatt når `SIMULATE_WEIGHT=1`

