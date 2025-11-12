import { useState, useEffect } from "react";
import { StatusIndicator } from "@/components/StatusIndicator";
import { IBCVisualization } from "@/components/IBCVisualization";
import { ControlButton } from "@/components/ControlButton";
import { SettingsDialog } from "@/components/SettingsDialog";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Droplets, 
  Gauge, 
  Wind, 
  Zap, 
  Thermometer,
  Play,
  Square,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

type FillMode = "idle" | "coarse" | "fine";
type EquipmentStatus = "running" | "stopped" | "idle";

const Index = () => {
  // State management
  const [tankTemp, setTankTemp] = useState(22.5);
  const [currentWeight, setCurrentWeight] = useState(0);
  const [tankTarget, setTankTarget] = useState(500);
  const [siloTarget, setSiloTarget] = useState(500);
  const [fillMode, setFillMode] = useState<FillMode>("idle");
  const [pumpStatus, setPumpStatus] = useState<EquipmentStatus>("idle");
  const [valveStatus, setValveStatus] = useState<EquipmentStatus>("idle");
  const [damperStatus, setDamperStatus] = useState<EquipmentStatus>("idle");
  const [vibratorStatus, setVibratorStatus] = useState<EquipmentStatus>("idle");
  const [isFillingFromTank, setIsFillingFromTank] = useState(false);

  const totalTarget = tankTarget + siloTarget;
  const maxCapacity = 1000;

  // Simulate temperature changes
  useEffect(() => {
    const interval = setInterval(() => {
      setTankTemp(prev => prev + (Math.random() - 0.5) * 0.2);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Simulate filling process
  useEffect(() => {
    if (fillMode !== "idle") {
      const fillRate = fillMode === "coarse" ? 5 : 0.5; // kg per interval
      const interval = setInterval(() => {
        setCurrentWeight(prev => {
          const newWeight = prev + fillRate;
          
          // Auto switch from coarse to fine at 90% of target
          if (fillMode === "coarse" && newWeight >= totalTarget * 0.9) {
            setFillMode("fine");
            toast.info("Bytter til finfylling");
          }
          
          // Stop at target
          if (newWeight >= totalTarget) {
            stopFilling();
            toast.success("Fylling fullført!");
            return totalTarget;
          }
          
          return newWeight;
        });
      }, 100);
      
      return () => clearInterval(interval);
    }
  }, [fillMode, totalTarget]);

  const startFillingFromTank = () => {
    setIsFillingFromTank(true);
    setFillMode("coarse");
    setPumpStatus("running");
    setValveStatus("running");
    setCurrentWeight(0);
    toast.success("Starter fylling fra tank");
  };

  const startFillingFromSilo = () => {
    setIsFillingFromTank(false);
    setFillMode("coarse");
    setDamperStatus("running");
    setCurrentWeight(0);
    toast.success("Starter fylling fra silo");
  };

  const stopFilling = () => {
    setFillMode("idle");
    setPumpStatus("idle");
    setValveStatus("idle");
    setDamperStatus("idle");
    toast.info("Fylling stoppet");
  };

  const toggleVibrator = () => {
    if (vibratorStatus === "running") {
      setVibratorStatus("idle");
      toast.info("Vibrator stoppet");
    } else {
      setVibratorStatus("running");
      toast.success("Vibrator startet");
    }
  };

  const handleSettingsSave = (newTankTarget: number, newSiloTarget: number) => {
    setTankTarget(newTankTarget);
    setSiloTarget(newSiloTarget);
    toast.success("Innstillinger lagret");
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-foreground">IBC Fyllesystem</h1>
          <SettingsDialog
            tankTarget={tankTarget}
            siloTarget={siloTarget}
            onSave={handleSettingsSave}
          />
        </div>
        
        {/* System Status */}
        <Card className="p-4 bg-card border-border">
          <div className="flex flex-wrap gap-6">
            <StatusIndicator
              status={pumpStatus}
              label={`Pumpe: ${pumpStatus === "running" ? "Kjører" : "Stoppet"}`}
            />
            <StatusIndicator
              status={valveStatus}
              label={`Magnetventil: ${valveStatus === "running" ? "Åpen" : "Lukket"}`}
            />
            <StatusIndicator
              status={damperStatus}
              label={`Spjeld: ${damperStatus === "running" ? "Åpen" : "Lukket"}`}
            />
            <StatusIndicator
              status={vibratorStatus}
              label={`Vibrator: ${vibratorStatus === "running" ? "Kjører" : "Av"}`}
            />
            <div className="flex items-center gap-2 ml-auto">
              <Thermometer className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-foreground">
                Tanktemp: <span className="font-mono text-lg">{tankTemp.toFixed(1)}°C</span>
              </span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Fill Mode Indicator */}
          <Card className="p-4 bg-card border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Fyllemodus</h2>
              <div className="flex items-center gap-3">
                {fillMode !== "idle" && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-primary/20 rounded-lg border border-primary">
                    <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                    <span className="font-semibold text-foreground uppercase">
                      {fillMode === "coarse" ? "Grovfylling" : "Finfylling"}
                    </span>
                  </div>
                )}
                {fillMode === "idle" && (
                  <div className="px-4 py-2 bg-muted rounded-lg">
                    <span className="text-muted-foreground">Inaktiv</span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Tank Controls */}
          <Card className="p-6 bg-card border-border">
            <h2 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
              <Droplets className="w-6 h-6 text-primary" />
              Fylling fra tank
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <ControlButton
                icon={Play}
                label="Start fylling"
                status={isFillingFromTank && fillMode !== "idle" ? "running" : "idle"}
                onClick={startFillingFromTank}
                disabled={fillMode !== "idle"}
              />
              <ControlButton
                icon={Gauge}
                label="Pumpe"
                status={pumpStatus}
                active={pumpStatus === "running"}
                onClick={() => {}}
                disabled
              />
              <ControlButton
                icon={Droplets}
                label="Magnetventil"
                status={valveStatus}
                active={valveStatus === "running"}
                onClick={() => {}}
                disabled
              />
            </div>
          </Card>

          {/* Silo Controls */}
          <Card className="p-6 bg-card border-border">
            <h2 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
              <Wind className="w-6 h-6 text-primary" />
              Fylling fra silo
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <ControlButton
                icon={Play}
                label="Start fylling"
                status={!isFillingFromTank && fillMode !== "idle" ? "running" : "idle"}
                onClick={startFillingFromSilo}
                disabled={fillMode !== "idle"}
              />
              <ControlButton
                icon={Wind}
                label="Spjeld (5/2)"
                status={damperStatus}
                active={damperStatus === "running"}
                onClick={() => {}}
                disabled
              />
              <ControlButton
                icon={Zap}
                label="Vibrator"
                status={vibratorStatus}
                active={vibratorStatus === "running"}
                onClick={toggleVibrator}
                disabled={fillMode === "idle"}
              />
            </div>
          </Card>

          {/* Emergency Stop */}
          <Card className="p-6 bg-destructive/20 border-destructive">
            <ControlButton
              icon={Square}
              label="NØDSTOPP"
              status={fillMode !== "idle" ? "stopped" : "idle"}
              onClick={stopFilling}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-destructive"
            />
          </Card>
        </div>

        {/* Right Panel - Visualization */}
        <div className="space-y-6">
          <IBCVisualization
            currentWeight={currentWeight}
            targetWeight={totalTarget}
            maxCapacity={maxCapacity}
          />

          {/* Warnings */}
          {tankTemp > 30 && (
            <Card className="p-4 bg-status-warning/20 border-status-warning">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-status-warning" />
                <div>
                  <div className="font-semibold text-foreground">Temperaturadvarsel</div>
                  <div className="text-sm text-muted-foreground">
                    Tanktemperatur er over normalt nivå
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
