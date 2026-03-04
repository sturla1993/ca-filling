

## Problem

Vektavlesningen er ustabil fordi:

1. **Dobbel seriell-lesing per loop**: `sensor_broadcast_loop()` kaller `weight_sensor.read_weight()` to ganger per iterasjon — én gang på linje 283 for å oppdatere state, og én gang på linje 295 for å bygge `data`-objektet. Hver kaller sender `w\r\n` til vekten og leser svar. Dette kan forårsake kollisjoner på seriellporten.

2. **`/api/status` leser også**: Hvert 200ms-poll fra frontend kaller `weight_sensor.read_weight()` (linje 309), som sender enda en `w\r\n`-kommando. Kombinert med bakgrunnstråden betyr dette 15+ seriell-forespørsler per sekund fra to ulike tråder, uten noen form for låsing.

3. **Ingen trådsikkerhet**: Seriellporten aksesseres fra både bakgrunnstråden og Flask-request-tråden uten mutex/lock, noe som kan gi korrupte svar.

4. **Kort ventetid**: `time.sleep(0.05)` etter `write()` kan være for kort for Kern-indikatoren å svare.

## Plan

### Endre `server.py`:

1. **Legg til en threading Lock** på seriellporten for trådsikkerhet.

2. **Les vekten kun én gang per loop-iterasjon** i `sensor_broadcast_loop()` — lagre verdien i `self._last_weight` og bruk den cachet verdien i `data`-objektet og i `/api/status`.

3. **`/api/status` og andre REST-endepunkt bruker kun cachet vekt** (`self._last_weight`) — aldri direkte seriell-lesing.

4. **Øk ventetiden** etter `write()` fra 0.05s til 0.1s for å gi Kern tid til å svare.

5. **Flush seriellbufferen** før ny lesing for å unngå gamle/korrupte data.

6. **Øk loop-intervallet** fra 0.1s til 0.2s — gir bedre margin for seriellkommunikasjon.

### Konkrete endringer i `WeightSensor`:

- Legg til `self._lock = threading.Lock()` i `__init__`
- I `read_weight()`: bruk `with self._lock`, flush input-buffer, skriv kommando, vent 0.1s, les svar
- Ny metode `get_cached_weight()` som returnerer `self._last_weight` uten å lese seriellporten

### Konkrete endringer i `sensor_broadcast_loop()`:

- Kall `weight_sensor.read_weight()` én gang, lagre i variabel
- Bruk samme variabel for både state-oppdatering og `data`-objekt

### Konkrete endringer i `/api/status`:

- Bruk `weight_sensor.get_cached_weight()` i stedet for `read_weight()`

