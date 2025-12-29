import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

export interface SensorData {
  weight: number;
  temperature: number;
  relays: {
    pump: boolean;
    valve: boolean;
    damper: boolean;
  };
  state: {
    filling: boolean;
    fill_source: 'tank' | 'silo' | null;
    fill_mode: 'idle' | 'coarse' | 'fine';
    tank_target: number;
    silo_target: number;
    tank_overrun: number;
    silo_overrun: number;
    tank_weight: number;
    silo_weight: number;
  };
}

interface UsePiConnectionOptions {
  onSensorData?: (data: SensorData) => void;
  onConnectionChange?: (connected: boolean) => void;
}

// Use relative URLs when served via nginx, or direct URL for development
const PI_URL = window.location.port === '5000' ? '' : 
               window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
               ? '' : 'http://127.0.0.1:5000';

export const usePiConnection = (options: UsePiConnectionOptions = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isOnPi, setIsOnPi] = useState(false);
  const [lastSensorData, setLastSensorData] = useState<SensorData | null>(null);
  const pollingRef = useRef<number | null>(null);
  const wasConnectedRef = useRef(false);

  const onSensorDataRef = useRef(options.onSensorData);
  const onConnectionChangeRef = useRef(options.onConnectionChange);
  
  useEffect(() => {
    onSensorDataRef.current = options.onSensorData;
    onConnectionChangeRef.current = options.onConnectionChange;
  }, [options.onSensorData, options.onConnectionChange]);

  // Poll for status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${PI_URL}/api/status`);
      if (!response.ok) throw new Error('Fetch failed');
      
      const data = await response.json();
      
      if (!wasConnectedRef.current) {
        wasConnectedRef.current = true;
        setIsConnected(true);
        setIsOnPi(data.on_raspberry_pi);
        onConnectionChangeRef.current?.(true);
        toast.success('Koblet til Raspberry Pi');
      }
      
      const sensorData: SensorData = {
        weight: data.weight,
        temperature: data.temperature,
        relays: data.relays,
        state: data.state
      };
      
      setLastSensorData(sensorData);
      onSensorDataRef.current?.(sensorData);
      
    } catch (error) {
      if (wasConnectedRef.current) {
        wasConnectedRef.current = false;
        setIsConnected(false);
        onConnectionChangeRef.current?.(false);
        toast.error('Mistet tilkobling til Raspberry Pi');
      }
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchStatus();
    
    // Poll every 200ms
    pollingRef.current = window.setInterval(fetchStatus, 200);
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [fetchStatus]);

  const startFill = useCallback(async (source: 'tank' | 'silo') => {
    try {
      const response = await fetch(`${PI_URL}/api/start-fill/${source}`, { method: 'POST' });
      if (!response.ok) throw new Error('Start fill failed');
      toast.success(`Fylling startet fra ${source === 'tank' ? 'tank' : 'silo'}`);
    } catch (e) {
      toast.error('Kunne ikke starte fylling');
    }
  }, []);

  const stopFill = useCallback(async () => {
    try {
      await fetch(`${PI_URL}/api/stop-fill`, { method: 'POST' });
      toast.info('Fylling stoppet');
    } catch (e) {
      toast.error('Kunne ikke stoppe fylling');
    }
  }, []);

  const reset = useCallback(async () => {
    try {
      await fetch(`${PI_URL}/api/reset`, { method: 'POST' });
      toast.success('System nullstilt');
    } catch (e) {
      toast.error('Kunne ikke nullstille');
    }
  }, []);

  const updateSettings = useCallback(async (settings: {
    tank_target?: number;
    silo_target?: number;
    tank_overrun?: number;
    silo_overrun?: number;
  }) => {
    try {
      await fetch(`${PI_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
    } catch (e) {
      console.error('Settings update failed:', e);
    }
  }, []);

  const emergencyStop = useCallback(async () => {
    try {
      await fetch(`${PI_URL}/api/emergency-stop`, { method: 'POST' });
    } catch (e) {
      console.error('Nødstopp feilet:', e);
    }
  }, []);

  const simulateWeight = useCallback((addKg: number) => {
    // Not used with REST - simulation happens on backend
  }, []);

  return {
    isConnected,
    isOnPi,
    lastSensorData,
    startFill,
    stopFill,
    reset,
    updateSettings,
    emergencyStop,
    simulateWeight
  };
};
