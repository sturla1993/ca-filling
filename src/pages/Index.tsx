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
  const [tankTarget, setTankTarget] = useState(500);
  const [siloTarget, setSiloTarget] = useState(500);
  const [tankFineThreshold, setTankFineThreshold] = useState(450);
  const [tankOverrun, setTankOverrun] = useState(5);
  const [siloOverrun, setSiloOverrun] = useState(5);
  const [fillMode, setFillMode] = useState<FillMode>("idle");
  const [pumpStatus, setPumpStatus] = useState<EquipmentStatus>("idle");
  const [valveStatus, setValveStatus] = useState<EquipmentStatus>("idle");
  const [fineValveStatus, setFineValveStatus] = useState<EquipmentStatus>("idle");
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
    const pumpOn = data.relays.pump;
    const valveOn = data.relays.valve;
    const fineValveOn = data.relays.fine_valve;
    const damperOn = data.relays.damper;
    
    setPumpStatus(pumpOn ? "running" : "idle");
    setValveStatus(valveOn ? "running" : "idle");
    setFineValveStatus(fineValveOn ? "running" : "idle");
    setDamperStatus(damperOn ? "running" : "idle");
    
    // Bestem fyllemodus basert på relé-status
    if (pumpOn || valveOn || fineValveOn) {
      setIsFillingFromTank(true);
      if (fineValveOn) {
        setFillMode("fine");
      } else {
        setFillMode("coarse");
      }
    } else if (damperOn) {
      setIsFillingFromTank(false);
      setFillMode("coarse");
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


  // Simulering av fylleprosess (kun når ikke koblet til Pi)
  useEffect(() => {
    if (useSimulation && fillMode !== "idle") {
      const fillRate = fillMode === "coarse" ? 5 : 0.5;
      const interval = setInterval(() => {
        if (isFillingFromTank) {
          setTankWeight(prev => {
            const newWeight = prev + fillRate;
            
            // Bytt til finfylling ved definert terskel
            if (fillMode === "coarse" && newWeight >= tankFineThreshold) {
              setFillMode("fine");
              // Slå av pumpe+grovventil, start finventil
              setPumpStatus("idle");
              setValveStatus("idle");
              setFineValveStatus("running");
              toast.info("Bytter til finfylling (ventil fin)");
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
  }, [useSimulation, fillMode, tankTarget, siloTarget, tankFineThreshold, tankOverrun, siloOverrun, isFillingFromTank]);

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
        // Sjekk om vi skal starte i fin- eller grovmodus
        if (tankWeight >= tankFineThreshold) {
          setFillMode("fine");
          setFineValveStatus("running");
        } else {
          setFillMode("coarse");
          setPumpStatus("running");
          setValveStatus("running");
        }
        toast.success("Starter vannfylling");
      }
    } else if (source === "silo") {
      if (isConnected) {
        startFill('silo');
      } else {
        setIsFillingFromTank(false);
        setFillMode("coarse");
        setDamperStatus("running");
        toast.success("Starter tørrstofffylling");
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
    setFineValveStatus("idle");
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
    newTankFineThreshold: number,
    newTankOverrun: number,
    newSiloOverrun: number
  ) => {
    setTankTarget(newTankTarget);
    setSiloTarget(newSiloTarget);
    setTankFineThreshold(newTankFineThreshold);
    setTankOverrun(newTankOverrun);
    setSiloOverrun(newSiloOverrun);
    
    if (isConnected) {
      updateSettings({
        tank_target: newTankTarget,
        silo_target: newSiloTarget,
        tank_fine_threshold: newTankFineThreshold,
        tank_overrun: newTankOverrun,
        silo_overrun: newSiloOverrun
      });
    }
    
    toast.success("Innstillinger lagret");
  };

  // Sjekk om den andre kilden kjører
  const isTankRunning = pumpStatus === "running" || valveStatus === "running" || fineValveStatus === "running";
  const isSiloRunning = damperStatus === "running";

  return (
    <div className="h-screen bg-background p-4 flex flex-col overflow-hidden">
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

      {/* Header - compact */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-foreground">IBC Fyllesystem</h1>
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-sm ${
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
          <SettingsDialog
            tankTarget={tankTarget}
            siloTarget={siloTarget}
            tankFineThreshold={tankFineThreshold}
            tankOverrun={tankOverrun}
            siloOverrun={siloOverrun}
            onSave={handleSettingsSave}
          />
        </div>
      </div>

      {/* Main content - fills remaining height */}
      <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Left Panel - Controls */}
        <div className="col-span-2 flex flex-col gap-3">
          {/* Status Bar + Fill Mode - compact row */}
          <Card className="p-3 bg-card border-border flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <StatusIndicator
                  status={pumpStatus}
                  label={`Pumpe: ${pumpStatus === "running" ? "Kjører" : "Av"}`}
                />
                <StatusIndicator
                  status={valveStatus}
                  label={`Ventil (grov): ${valveStatus === "running" ? "Åpen" : "Lukket"}`}
                />
                <StatusIndicator
                  status={fineValveStatus}
                  label={`Ventil (fin): ${fineValveStatus === "running" ? "Åpen" : "Lukket"}`}
                />
                <StatusIndicator
                  status={damperStatus}
                  label={`Spjeld: ${damperStatus === "running" ? "Åpen" : "Lukket"}`}
                />
              </div>
              <div>
                {fillMode !== "idle" ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/20 rounded border border-primary">
                    <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                    <span className="font-semibold text-foreground text-base uppercase">
                      {fillMode === "coarse" ? "Grovfylling" : "Finfylling"}
                    </span>
                  </div>
                ) : (
                  <div className="px-3 py-1.5 bg-muted rounded">
                    <span className="text-muted-foreground text-base">Inaktiv</span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Vann & Tørrstoff - stacked vertically */}
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            {/* Vann (Tank) */}
            <button
              onClick={isTankRunning ? handleStopFilling : startFillingFromTank}
              disabled={isSiloRunning}
              className={`relative rounded-lg border-2 transition-all flex items-center justify-center gap-4 text-foreground flex-1 ${
                isSiloRunning 
                  ? 'opacity-40 cursor-not-allowed border-border bg-card' 
                  : isTankRunning
                    ? 'border-status-running bg-status-running/20 animate-pulse'
                    : 'border-border bg-card hover:border-primary hover:bg-primary/10 active:scale-[0.98]'
              }`}
            >
              <Droplets className={`w-10 h-10 ${isTankRunning ? 'text-status-running' : 'text-primary'}`} />
              <div className="flex flex-col items-start">
                <span className="text-2xl font-bold">{isTankRunning ? 'STOPP VANN' : 'START VANN'}</span>
                <span className={`text-sm font-semibold ${
                  isTankRunning ? 'text-status-running' : 'text-muted-foreground'
                }`}>
                  {isTankRunning ? '● Kjører' : 'Inaktiv'}
                </span>
              </div>
              {isSiloRunning && (
                <span className="text-xs text-muted-foreground absolute bottom-2 right-3">(Tørrstoff kjører)</span>
              )}
            </button>

            {/* Tørrstoff (Silo) */}
            <button
              onClick={isSiloRunning ? handleStopFilling : startFillingFromSilo}
              disabled={isTankRunning}
              className={`relative rounded-lg border-2 transition-all flex items-center justify-center gap-4 text-foreground flex-1 ${
                isTankRunning 
                  ? 'opacity-40 cursor-not-allowed border-border bg-card' 
                  : isSiloRunning
                    ? 'border-status-running bg-status-running/20 animate-pulse'
                    : 'border-border bg-card hover:border-primary hover:bg-primary/10 active:scale-[0.98]'
              }`}
            >
              <Package className={`w-10 h-10 ${isSiloRunning ? 'text-status-running' : 'text-primary'}`} />
              <div className="flex flex-col items-start">
                <span className="text-2xl font-bold">{isSiloRunning ? 'STOPP TØRRSTOFF' : 'START TØRRSTOFF'}</span>
                <span className={`text-sm font-semibold ${
                  isSiloRunning ? 'text-status-running' : 'text-muted-foreground'
                }`}>
                  {isSiloRunning ? '● Kjører' : 'Inaktiv'}
                </span>
              </div>
              {isTankRunning && (
                <span className="text-xs text-muted-foreground absolute bottom-2 right-3">(Vann kjører)</span>
              )}
            </button>
          </div>

          {/* Bottom row: Emergency Stop + Reset */}
          <div className="grid grid-cols-2 gap-3 flex-shrink-0">
            <Card className="p-3 bg-destructive/20 border-destructive">
              <ControlButton
                icon={Square}
                label="NØDSTOPP"
                status={fillMode !== "idle" ? "stopped" : "idle"}
                onClick={handleEmergencyStop}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-destructive h-20"
              />
            </Card>
            <Card className="p-3 bg-card border-border">
              <ControlButton
                icon={RefreshCw}
                label="Nullstill"
                status="idle"
                onClick={resetFilling}
                className="bg-secondary hover:bg-secondary/80 h-20"
              />
            </Card>
          </div>
        </div>

        {/* Right Panel - IBC Visualization */}
        <div className="col-span-1 flex flex-col gap-3">
          <div className="flex-1 min-h-0">
            <IBCVisualization
              currentWeight={currentWeight}
              targetWeight={totalTarget}
              maxCapacity={totalTarget}
              tankWeight={tankWeight}
              siloWeight={siloWeight}
            />
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default Index;
