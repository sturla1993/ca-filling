import { useState, useEffect, useCallback } from "react";
import { StatusIndicator } from "@/components/StatusIndicator";
import { IBCVisualization } from "@/components/IBCVisualization";
import { ControlButton } from "@/components/ControlButton";
import { SettingsDialog } from "@/components/SettingsDialog";
import { Card } from "@/components/ui/card";
import { 
  Droplets, 
  Thermometer,
  Play,
  Square,
  AlertCircle,
  RefreshCw,
  Package,
  Wifi,
  WifiOff
} from "lucide-react";
import { toast } from "sonner";
import { usePiConnection, SensorData } from "@/hooks/usePiConnection";

type FillMode = "idle" | "coarse" | "fine";
type EquipmentStatus = "running" | "stopped" | "idle";

// Pi-adresse - endre denne til Pi-ens IP når du kobler til
const PI_URL = import.meta.env.VITE_PI_URL || "http://172.20.178.135:5000";

const Index = () => {
  // State management
  const [tankTemp, setTankTemp] = useState(22.5);
  const [tankTarget, setTankTarget] = useState(500);
  const [siloTarget, setSiloTarget] = useState(500);
  const [tankOverrun, setTankOverrun] = useState(5);
  const [siloOverrun, setSiloOverrun] = useState(5);
  const [fillMode, setFillMode] = useState<FillMode>("idle");
  const [pumpStatus, setPumpStatus] = useState<EquipmentStatus>("idle");
  const [valveStatus, setValveStatus] = useState<EquipmentStatus>("idle");
  const [damperStatus, setDamperStatus] = useState<EquipmentStatus>("idle");
  const [isFillingFromTank, setIsFillingFromTank] = useState(false);
  const [tankWeight, setTankWeight] = useState(0);
  const [siloWeight, setSiloWeight] = useState(0);
  const [useSimulation, setUseSimulation] = useState(true);

  // Pi-tilkobling
  const handleSensorData = useCallback((data: SensorData) => {
    if (!useSimulation) {
      setTankTemp(data.temperature);
      setPumpStatus(data.relays.pump ? "running" : "idle");
      setValveStatus(data.relays.valve ? "running" : "idle");
      setDamperStatus(data.relays.damper ? "running" : "idle");
      setFillMode(data.state.fill_mode);
      
      // Fordel vekt basert på kilde
      if (data.state.fill_source === 'tank') {
        setTankWeight(data.weight);
      } else if (data.state.fill_source === 'silo') {
        setSiloWeight(data.weight);
      }
    }
  }, [useSimulation]);

  const handleConnectionChange = useCallback((connected: boolean) => {
    if (connected) {
      setUseSimulation(false);
    } else {
      setUseSimulation(true);
    }
  }, []);

  const {
    isConnected,
    isOnPi,
    startFill,
    stopFill,
    reset,
    updateSettings,
    emergencyStop
  } = usePiConnection({
    piUrl: PI_URL,
    onSensorData: handleSensorData,
    onConnectionChange: handleConnectionChange
  });

  const totalTarget = tankTarget + siloTarget;
  const currentWeight = tankWeight + siloWeight;

  // Simulering av temperatur (kun når ikke koblet til Pi)
  useEffect(() => {
    if (useSimulation) {
      const interval = setInterval(() => {
        setTankTemp(prev => prev + (Math.random() - 0.5) * 0.2);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [useSimulation]);

  // Simulering av fylleprosess (kun når ikke koblet til Pi)
  useEffect(() => {
    if (useSimulation && fillMode !== "idle") {
      const fillRate = fillMode === "coarse" ? 5 : 0.5;
      const interval = setInterval(() => {
        if (isFillingFromTank) {
          setTankWeight(prev => {
            const newWeight = prev + fillRate;
            
            if (fillMode === "coarse" && newWeight >= tankTarget * 0.9) {
              setFillMode("fine");
              toast.info("Bytter til finfylling");
            }
            
            if (newWeight >= (tankTarget - tankOverrun)) {
              toast.success(`Fylling fra tank fullført! Vekt: ${newWeight.toFixed(1)} kg`);
              stopFillingLocal();
              return newWeight;
            }
            
            return newWeight;
          });
        } else {
          setSiloWeight(prev => {
            const newWeight = prev + fillRate;
            
            if (fillMode === "coarse" && newWeight >= siloTarget * 0.9) {
              setFillMode("fine");
              toast.info("Bytter til finfylling");
            }
            
            if (newWeight >= (siloTarget - siloOverrun)) {
              toast.success(`Fylling fra silo fullført! Vekt: ${newWeight.toFixed(1)} kg`);
              stopFillingLocal();
              return newWeight;
            }
            
            return newWeight;
          });
        }
      }, 100);
      
      return () => clearInterval(interval);
    }
  }, [useSimulation, fillMode, tankTarget, siloTarget, tankOverrun, siloOverrun, isFillingFromTank]);

  const startFillingFromTank = () => {
    if (isConnected) {
      startFill('tank');
    } else {
      setIsFillingFromTank(true);
      const fillPercentage = (tankWeight / tankTarget) * 100;
      setFillMode(fillPercentage >= 90 ? "fine" : "coarse");
      setPumpStatus("running");
      setValveStatus("running");
      toast.success("Starter fylling fra tank");
    }
  };

  const startFillingFromSilo = () => {
    if (isConnected) {
      startFill('silo');
    } else {
      setIsFillingFromTank(false);
      const fillPercentage = (siloWeight / siloTarget) * 100;
      setFillMode(fillPercentage >= 90 ? "fine" : "coarse");
      setDamperStatus("running");
      toast.success("Starter fylling fra silo");
    }
  };

  const stopFillingLocal = () => {
    setFillMode("idle");
    setPumpStatus("idle");
    setValveStatus("idle");
    setDamperStatus("idle");
  };

  const handleStopFilling = () => {
    if (isConnected) {
      stopFill();
    } else {
      stopFillingLocal();
      toast.info("Fylling stoppet");
    }
  };

  const handleEmergencyStop = () => {
    if (isConnected) {
      emergencyStop();
    }
    stopFillingLocal();
    toast.error("NØDSTOPP AKTIVERT", { duration: 5000 });
  };

  const resetFilling = () => {
    if (isConnected) {
      reset();
    } else {
      stopFillingLocal();
      setTankWeight(0);
      setSiloWeight(0);
      setIsFillingFromTank(false);
      toast.success("Nullstilt");
    }
  };

  const handleSettingsSave = (
    newTankTarget: number, 
    newSiloTarget: number,
    newTankOverrun: number,
    newSiloOverrun: number
  ) => {
    setTankTarget(newTankTarget);
    setSiloTarget(newSiloTarget);
    setTankOverrun(newTankOverrun);
    setSiloOverrun(newSiloOverrun);
    
    if (isConnected) {
      updateSettings({
        tank_target: newTankTarget,
        silo_target: newSiloTarget,
        tank_overrun: newTankOverrun,
        silo_overrun: newSiloOverrun
      });
    }
    
    toast.success("Innstillinger lagret");
  };

  return (
    <div className="min-h-screen bg-background p-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-foreground">IBC Fyllesystem</h1>
          {/* Tilkoblingsstatus */}
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
            isConnected 
              ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
              : 'bg-muted text-muted-foreground'
          }`}>
            {isConnected ? (
              <>
                <Wifi className="w-3 h-3" />
                <span>{isOnPi ? 'Pi' : 'Sim'}</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                <span>Offline</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Thermometer className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-foreground">
              <span className="font-mono text-sm">{tankTemp.toFixed(1)}°C</span>
            </span>
          </div>
          <SettingsDialog
            tankTarget={tankTarget}
            siloTarget={siloTarget}
            tankOverrun={tankOverrun}
            siloOverrun={siloOverrun}
            onSave={handleSettingsSave}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* Left Panel - Controls */}
        <div className="col-span-2 space-y-2">
          {/* Status Bar */}
          <Card className="p-2 bg-card border-border">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <StatusIndicator
                status={pumpStatus}
                label={`Pumpe: ${pumpStatus === "running" ? "Kjører" : "Av"}`}
              />
              <StatusIndicator
                status={valveStatus}
                label={`Ventil: ${valveStatus === "running" ? "Åpen" : "Lukket"}`}
              />
              <StatusIndicator
                status={damperStatus}
                label={`Spjeld: ${damperStatus === "running" ? "Åpen" : "Lukket"}`}
              />
            </div>
          </Card>

          {/* Fill Mode Indicator */}
          <Card className="p-2 bg-card border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Modus:</span>
              {fillMode !== "idle" && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/20 rounded border border-primary">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="font-semibold text-foreground text-xs uppercase">
                    {fillMode === "coarse" ? "Grovfylling" : "Finfylling"}
                  </span>
                </div>
              )}
              {fillMode === "idle" && (
                <div className="px-2 py-1 bg-muted rounded">
                  <span className="text-muted-foreground text-xs">Inaktiv</span>
                </div>
              )}
            </div>
          </Card>

          {/* Tank Controls */}
          <Card className="p-2 bg-card border-border">
            <h2 className="text-sm font-semibold mb-2 text-foreground flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-primary" />
              Tank
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <ControlButton
                icon={Play}
                label="Start"
                status={isFillingFromTank && fillMode !== "idle" ? "running" : "idle"}
                onClick={startFillingFromTank}
                disabled={fillMode !== "idle"}
              />
              <ControlButton
                icon={Square}
                label="Stopp"
                status={isFillingFromTank && fillMode !== "idle" ? "stopped" : "idle"}
                onClick={handleStopFilling}
                disabled={fillMode === "idle" || !isFillingFromTank}
                className="bg-destructive/20 border-destructive"
              />
            </div>
          </Card>

          {/* Silo Controls */}
          <Card className="p-2 bg-card border-border">
            <h2 className="text-sm font-semibold mb-2 text-foreground flex items-center gap-1.5">
              <Package className="w-4 h-4 text-primary" />
              Silo
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <ControlButton
                icon={Play}
                label="Start"
                status={!isFillingFromTank && fillMode !== "idle" ? "running" : "idle"}
                onClick={startFillingFromSilo}
                disabled={fillMode !== "idle"}
              />
              <ControlButton
                icon={Square}
                label="Stopp"
                status={!isFillingFromTank && fillMode !== "idle" ? "stopped" : "idle"}
                onClick={handleStopFilling}
                disabled={fillMode === "idle" || isFillingFromTank}
                className="bg-destructive/20 border-destructive"
              />
            </div>
          </Card>

          {/* Emergency Stop */}
          <Card className="p-2 bg-destructive/20 border-destructive">
            <ControlButton
              icon={Square}
              label="NØDSTOPP"
              status={fillMode !== "idle" ? "stopped" : "idle"}
              onClick={handleEmergencyStop}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-destructive"
            />
          </Card>
        </div>

        {/* Right Panel - IBC Visualization */}
        <div className="col-span-1 space-y-2">
          <IBCVisualization
            currentWeight={currentWeight}
            targetWeight={totalTarget}
            maxCapacity={totalTarget}
            tankWeight={tankWeight}
            siloWeight={siloWeight}
          />
          
          {/* Reset Button - Full width */}
          <Card className="p-2 bg-card border-border">
            <ControlButton
              icon={RefreshCw}
              label="Nullstill"
              status="idle"
              onClick={resetFilling}
              className="bg-secondary hover:bg-secondary/80 h-32"
            />
          </Card>
          
          {/* Warnings */}
          {tankTemp > 30 && (
            <Card className="p-2 bg-status-warning/20 border-status-warning">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-status-warning" />
                <div className="text-xs text-foreground font-semibold">Temp advarsel</div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
