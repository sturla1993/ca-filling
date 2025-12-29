import { useState, useEffect, useCallback } from "react";
import { StatusIndicator } from "@/components/StatusIndicator";
import { IBCVisualization } from "@/components/IBCVisualization";
import { ControlButton } from "@/components/ControlButton";
import { SettingsDialog } from "@/components/SettingsDialog";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
type FillSource = "tank" | "silo" | null;

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
  
  // Sporing av forrige fylling for avviksvarsler
  const [lastTankFillResult, setLastTankFillResult] = useState<{ weight: number; target: number } | null>(null);
  const [lastSiloFillResult, setLastSiloFillResult] = useState<{ weight: number; target: number } | null>(null);
  const [pendingFillSource, setPendingFillSource] = useState<FillSource>(null);
  const [showDeviationWarning, setShowDeviationWarning] = useState(false);
  const [deviationMessage, setDeviationMessage] = useState("");

  // Pi-tilkobling - oppdater alltid når vi får data fra Pi
  const handleSensorData = useCallback((data: SensorData) => {
    // Alltid oppdater fra Pi-data når vi mottar det
    setTankTemp(data.temperature);
    
    const pumpOn = data.relays.pump;
    const valveOn = data.relays.valve;
    const damperOn = data.relays.damper;
    
    setPumpStatus(pumpOn ? "running" : "idle");
    setValveStatus(valveOn ? "running" : "idle");
    setDamperStatus(damperOn ? "running" : "idle");
    
    // Bestem fyllemodus basert på relé-status
    if (pumpOn || valveOn) {
      setIsFillingFromTank(true);
      if (data.state.tank_weight >= data.state.tank_target * 0.9) {
        setFillMode("fine");
      } else {
        setFillMode("coarse");
      }
    } else if (damperOn) {
      setIsFillingFromTank(false);
      if (data.state.silo_weight >= data.state.silo_target * 0.9) {
        setFillMode("fine");
      } else {
        setFillMode("coarse");
      }
    } else {
      setFillMode("idle");
    }
    
    // Bruk tank_weight og silo_weight fra backend state
    setTankWeight(data.state.tank_weight);
    setSiloWeight(data.state.silo_weight);
    
    // Slå av simulering når vi mottar data
    setUseSimulation(false);
  }, []);

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
              setLastTankFillResult({ weight: newWeight, target: tankTarget });
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
              setLastSiloFillResult({ weight: newWeight, target: siloTarget });
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

  // Sjekk om forrige fylling var utenfor målpunkt (±5% toleranse)
  const checkDeviationWarning = (source: FillSource): boolean => {
    const tolerance = 0.05; // 5% toleranse
    
    if (source === "tank" && lastTankFillResult) {
      const deviation = Math.abs(lastTankFillResult.weight - lastTankFillResult.target) / lastTankFillResult.target;
      if (deviation > tolerance) {
        setDeviationMessage(
          `Forrige tankfylling avvek fra mål: ${lastTankFillResult.weight.toFixed(1)} kg vs mål ${lastTankFillResult.target.toFixed(1)} kg (${(deviation * 100).toFixed(1)}% avvik)`
        );
        return true;
      }
    }
    
    if (source === "silo" && lastSiloFillResult) {
      const deviation = Math.abs(lastSiloFillResult.weight - lastSiloFillResult.target) / lastSiloFillResult.target;
      if (deviation > tolerance) {
        setDeviationMessage(
          `Forrige silofylling avvek fra mål: ${lastSiloFillResult.weight.toFixed(1)} kg vs mål ${lastSiloFillResult.target.toFixed(1)} kg (${(deviation * 100).toFixed(1)}% avvik)`
        );
        return true;
      }
    }
    
    return false;
  };

  const executeStartFill = (source: FillSource) => {
    if (!source) return;
    
    if (source === "tank") {
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
    } else if (source === "silo") {
      if (isConnected) {
        startFill('silo');
      } else {
        setIsFillingFromTank(false);
        const fillPercentage = (siloWeight / siloTarget) * 100;
        setFillMode(fillPercentage >= 90 ? "fine" : "coarse");
        setDamperStatus("running");
        toast.success("Starter fylling fra silo");
      }
    }
  };

  const startFillingFromTank = () => {
    // Sjekk om silo kjører - ikke tillat samtidig
    if (damperStatus === "running") {
      toast.error("Kan ikke starte tank mens silo kjører");
      return;
    }
    
    if (checkDeviationWarning("tank")) {
      setPendingFillSource("tank");
      setShowDeviationWarning(true);
      return;
    }
    
    executeStartFill("tank");
  };

  const startFillingFromSilo = () => {
    // Sjekk om tank kjører - ikke tillat samtidig
    if (pumpStatus === "running" || valveStatus === "running") {
      toast.error("Kan ikke starte silo mens tank kjører");
      return;
    }
    
    if (checkDeviationWarning("silo")) {
      setPendingFillSource("silo");
      setShowDeviationWarning(true);
      return;
    }
    
    executeStartFill("silo");
  };

  const handleDeviationConfirm = () => {
    setShowDeviationWarning(false);
    executeStartFill(pendingFillSource);
    setPendingFillSource(null);
  };

  const handleDeviationCancel = () => {
    setShowDeviationWarning(false);
    setPendingFillSource(null);
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

  // Sjekk om den andre kilden kjører
  const isTankRunning = pumpStatus === "running" || valveStatus === "running";
  const isSiloRunning = damperStatus === "running";

  return (
    <div className="min-h-screen bg-background p-3">
      {/* Avviksvarsel dialog */}
      <AlertDialog open={showDeviationWarning} onOpenChange={setShowDeviationWarning}>
        <AlertDialogContent className="bg-card border-status-warning">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl text-status-warning flex items-center gap-2">
              <AlertCircle className="w-6 h-6" />
              Avvik fra målpunkt
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-foreground">
              {deviationMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeviationCancel} className="text-base">
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeviationConfirm} className="bg-status-warning text-background text-base">
              Fortsett likevel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">IBC Fyllesystem</h1>
          {/* Tilkoblingsstatus */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded text-sm ${
            isConnected 
              ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
              : 'bg-muted text-muted-foreground'
          }`}>
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4" />
                <span>{isOnPi ? 'Pi' : 'Sim'}</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" />
                <span>Offline</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-primary" />
            <span className="font-mono text-lg font-bold text-foreground">{tankTemp.toFixed(1)}°C</span>
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

      <div className="grid grid-cols-3 gap-3">
        {/* Left Panel - Controls */}
        <div className="col-span-2 space-y-3">
          {/* Status Bar */}
          <Card className="p-3 bg-card border-border">
            <div className="grid grid-cols-3 gap-3">
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
          <Card className="p-3 bg-card border-border">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-foreground">Modus:</span>
              {fillMode !== "idle" && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/20 rounded border border-primary">
                  <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                  <span className="font-semibold text-foreground text-base uppercase">
                    {fillMode === "coarse" ? "Grovfylling" : "Finfylling"}
                  </span>
                </div>
              )}
              {fillMode === "idle" && (
                <div className="px-3 py-1.5 bg-muted rounded">
                  <span className="text-muted-foreground text-base">Inaktiv</span>
                </div>
              )}
            </div>
          </Card>

          {/* Tank Controls */}
          <Card className={`p-3 bg-card border-border ${isSiloRunning ? 'opacity-50' : ''}`}>
            <h2 className="text-lg font-semibold mb-3 text-foreground flex items-center gap-2">
              <Droplets className="w-5 h-5 text-primary" />
              Tank
              {isSiloRunning && <span className="text-sm text-muted-foreground ml-2">(Silo kjører)</span>}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <ControlButton
                icon={Play}
                label="Start"
                status={isTankRunning ? "running" : "idle"}
                onClick={startFillingFromTank}
                disabled={isTankRunning || isSiloRunning}
              />
              <ControlButton
                icon={Square}
                label="Stopp"
                status={isTankRunning ? "stopped" : "idle"}
                onClick={handleStopFilling}
                disabled={!isTankRunning}
                className="bg-destructive/20 border-destructive"
              />
            </div>
          </Card>

          {/* Silo Controls */}
          <Card className={`p-3 bg-card border-border ${isTankRunning ? 'opacity-50' : ''}`}>
            <h2 className="text-lg font-semibold mb-3 text-foreground flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Silo
              {isTankRunning && <span className="text-sm text-muted-foreground ml-2">(Tank kjører)</span>}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <ControlButton
                icon={Play}
                label="Start"
                status={isSiloRunning ? "running" : "idle"}
                onClick={startFillingFromSilo}
                disabled={isSiloRunning || isTankRunning}
              />
              <ControlButton
                icon={Square}
                label="Stopp"
                status={isSiloRunning ? "stopped" : "idle"}
                onClick={handleStopFilling}
                disabled={!isSiloRunning}
                className="bg-destructive/20 border-destructive"
              />
            </div>
          </Card>

          {/* Emergency Stop */}
          <Card className="p-3 bg-destructive/20 border-destructive">
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
        <div className="col-span-1 space-y-3">
          <IBCVisualization
            currentWeight={currentWeight}
            targetWeight={totalTarget}
            maxCapacity={totalTarget}
            tankWeight={tankWeight}
            siloWeight={siloWeight}
          />
          
          {/* Reset Button - Full width */}
          <Card className="p-3 bg-card border-border">
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
            <Card className="p-3 bg-status-warning/20 border-status-warning">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-status-warning" />
                <div className="text-base text-foreground font-semibold">Temp advarsel</div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
