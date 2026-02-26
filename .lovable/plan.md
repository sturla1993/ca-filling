

# Fjern temperatursensor fra systemet

## Oversikt
Fjerner all temperaturrelatert funksjonalitet fra frontend, backend og hook, siden DS18B20-sensoren ikke skal brukes.

## Endringer

### 1. Frontend - `src/pages/Index.tsx`
- Fjern `tankTemp` state og all temperatursimulering (useEffect linje 122-130)
- Fjern `Thermometer`-import fra lucide-react
- Fjern temperaturvisning i headeren (linje 396-399)
- Fjern temperaturadvarselen nederst (linje 544-551)

### 2. Hook - `src/hooks/usePiConnection.ts`
- Fjern `temperature` fra `SensorData`-interfacet
- Fjern `temperature` fra sensorData-mappingen i `fetchStatus`

### 3. Backend - `raspberry-pi/server.py`
- Fjern hele `TemperatureSensor`-klassen
- Fjern `temp_sensor`-objektet
- Fjern `temperature` fra `/api/status`-responsen
- Fjern `temperature` fra `sensor_broadcast_loop`
- Fjern DS18B20-relaterte imports (`glob`) og konstanter (`DS18B20_BASE_DIR`)

### 4. README - `raspberry-pi/README.md`
- Fjern DS18B20-referanser fra komponentliste og tilkoblingsdiagram

## Tekniske detaljer
- Ingen nye avhengigheter
- Backend vil fortsatt fungere uten temperatursensor
- Frontenden vil ikke lenger vise temperatur noe sted

