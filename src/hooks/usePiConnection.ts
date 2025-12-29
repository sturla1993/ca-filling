import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';

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
  piUrl?: string;
  onSensorData?: (data: SensorData) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export const usePiConnection = (options: UsePiConnectionOptions = {}) => {
  // Bruk relativ URL når servert fra nginx, ellers localhost:5000
  const defaultUrl = typeof window !== 'undefined' && window.location.port === ''
    ? '' // Relativ URL via nginx proxy
    : 'http://localhost:5000';
  
  const {
    piUrl = defaultUrl,
    onSensorData,
    onConnectionChange
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isOnPi, setIsOnPi] = useState(false);
  const [lastSensorData, setLastSensorData] = useState<SensorData | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Koble til Pi
  useEffect(() => {
    const socket = io(piUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Koblet til Raspberry Pi');
      setIsConnected(true);
      onConnectionChange?.(true);
      toast.success('Koblet til Raspberry Pi');
    });

    socket.on('disconnect', () => {
      console.log('❌ Frakoblet fra Raspberry Pi');
      setIsConnected(false);
      onConnectionChange?.(false);
      toast.error('Mistet tilkobling til Raspberry Pi');
    });

    socket.on('connected', (data: { status: string; on_raspberry_pi: boolean }) => {
      setIsOnPi(data.on_raspberry_pi);
      if (!data.on_raspberry_pi) {
        toast.info('Kjører i simuleringsmodus');
      }
    });

    socket.on('sensor_data', (data: { type: string } & SensorData) => {
      setLastSensorData(data);
      onSensorData?.(data);
    });

    socket.on('fill_started', (data: { source: string }) => {
      toast.success(`Fylling startet fra ${data.source === 'tank' ? 'tank' : 'silo'}`);
    });

    socket.on('fill_stopped', () => {
      toast.info('Fylling stoppet');
    });

    socket.on('reset_complete', () => {
      toast.success('System nullstilt');
    });

    socket.on('connect_error', (error) => {
      console.error('Tilkoblingsfeil:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, [piUrl, onSensorData, onConnectionChange]);

  // Kommandoer
  const startFill = useCallback((source: 'tank' | 'silo') => {
    socketRef.current?.emit('start_fill', { source });
  }, []);

  const stopFill = useCallback(() => {
    socketRef.current?.emit('stop_fill');
  }, []);

  const reset = useCallback(() => {
    socketRef.current?.emit('reset');
  }, []);

  const updateSettings = useCallback((settings: {
    tank_target?: number;
    silo_target?: number;
    tank_overrun?: number;
    silo_overrun?: number;
  }) => {
    socketRef.current?.emit('update_settings', settings);
  }, []);

  const emergencyStop = useCallback(async () => {
    // Send via WebSocket
    socketRef.current?.emit('stop_fill');
    
    // Backup via REST API
    try {
      await fetch(`${piUrl}/api/emergency-stop`, { method: 'POST' });
    } catch (e) {
      console.error('Nødstopp REST-feil:', e);
    }
  }, [piUrl]);

  // Simulering (kun for testing)
  const simulateWeight = useCallback((addKg: number) => {
    socketRef.current?.emit('simulate_weight', { add: addKg });
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
