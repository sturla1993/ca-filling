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
  Zap, 
  Thermometer,
  Play,
  Square,
  AlertCircle,
  RefreshCw,
  Container
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
  const [tankFilled, setTankFilled] = useState(false);
  const [tankWeight, setTankWeight] = useState(0);
  const [siloWeight, setSiloWeight] = useState(0);

  const totalTarget = tankTarget + siloTarget;

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
          
          // Determine target based on source
          const currentTarget = isFillingFromTank ? tankTarget : totalTarget;
          
          // Auto switch from coarse to fine at 90% of target
          if (fillMode === "coarse" && newWeight >= currentTarget * 0.9) {
            setFillMode("fine");
            toast.info("Bytter til finfylling");
          }
          
          // Stop at target
          if (newWeight >= currentTarget) {
            if (isFillingFromTank) {
              setTankFilled(true);
              setTankWeight(currentTarget);
              toast.success(`Fylling fra tank fullført! (${currentTarget.toFixed(1)} kg)`);
            } else {
              setSiloWeight(newWeight - tankWeight);
              toast.success(`Fylling fra silo fullført! (${(newWeight - tankWeight).toFixed(1)} kg)`);
            }
            stopFilling();
            return currentTarget;
          }
          
          // Update tank/silo weights during filling
          if (isFillingFromTank) {
            setTankWeight(newWeight);
          } else {
            setSiloWeight(newWeight - tankWeight);
          }
          
          return newWeight;
        });
      }, 100);
      
      return () => clearInterval(interval);
    }
  }, [fillMode, tankTarget, siloTarget, isFillingFromTank, tankFilled]);

  const startFillingFromTank = () => {
    setIsFillingFromTank(true);
    setFillMode("coarse");
    setPumpStatus("running");
    setValveStatus("running");
    if (!tankFilled) {
      setCurrentWeight(0);
    }
    toast.success("Starter fylling fra tank");
  };

  const startFillingFromSilo = () => {
    if (!tankFilled) {
      toast.error("Må fylle fra tank først!");
      return;
    }
    setIsFillingFromTank(false);
    setFillMode("coarse");
    setDamperStatus("running");
    toast.success("Starter fylling fra silo");
  };

  const stopFilling = () => {
    setFillMode("idle");
    setPumpStatus("idle");
    setValveStatus("idle");
    setDamperStatus("idle");
    toast.info("Fylling stoppet");
  };

  const resetFilling = () => {
    setFillMode("idle");
    setPumpStatus("idle");
    setValveStatus("idle");
    setDamperStatus("idle");
    setVibratorStatus("idle");
    setCurrentWeight(0);
    setTankWeight(0);
    setSiloWeight(0);
    setTankFilled(false);
    setIsFillingFromTank(false);
    toast.success("Nullstilt");
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
    <div className="min-h-screen bg-background p-2">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold text-foreground">IBC Fyllesystem</h1>
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
            onSave={handleSettingsSave}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {/* Status Bar - full width */}
        <Card className="col-span-4 p-2 bg-card border-border">
          <div className="grid grid-cols-2 gap-2 text-xs">
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
            <StatusIndicator
              status={vibratorStatus}
              label={`Vibrator: ${vibratorStatus === "running" ? "På" : "Av"}`}
            />
          </div>
        </Card>

        {/* Fill Mode Indicator - full width */}
        <Card className="col-span-4 p-2 bg-card border-border">
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
        <Card className="col-span-2 p-2 bg-card border-border">
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
              onClick={stopFilling}
              disabled={fillMode === "idle" || !isFillingFromTank}
              className="bg-destructive/20 border-destructive"
            />
          </div>
        </Card>

        {/* IBC Visualization - spans 3 rows on right */}
        <div className="col-span-2 row-span-3">
          <IBCVisualization
            currentWeight={currentWeight}
            targetWeight={totalTarget}
            maxCapacity={totalTarget}
            tankWeight={tankWeight}
            siloWeight={siloWeight}
          />
          
          {/* Warnings */}
          {tankTemp > 30 && (
            <Card className="mt-2 p-2 bg-status-warning/20 border-status-warning">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-status-warning" />
                <div className="text-xs text-foreground font-semibold">Temp advarsel</div>
              </div>
            </Card>
          )}
        </div>

        {/* Silo Controls */}
        <Card className="col-span-1 p-2 bg-card border-border">
          <h2 className="text-sm font-semibold mb-2 text-foreground flex items-center gap-1.5">
            <Container className="w-4 h-4 text-primary" />
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
              onClick={stopFilling}
              disabled={fillMode === "idle" || isFillingFromTank}
              className="bg-destructive/20 border-destructive"
            />
          </div>
        </Card>

        {/* Vibrator Control */}
        <Card className="col-span-1 p-2 bg-card border-border">
          <ControlButton
            icon={Zap}
            label={vibratorStatus === "running" ? "Stopp vibrator" : "Start vibrator"}
            status={vibratorStatus}
            active={vibratorStatus === "running"}
            onClick={toggleVibrator}
            className={vibratorStatus === "running" ? "border-status-running" : ""}
          />
        </Card>

        {/* Emergency Stop */}
        <Card className="col-span-1 p-2 bg-destructive/20 border-destructive">
          <ControlButton
            icon={Square}
            label="NØDSTOPP"
            status={fillMode !== "idle" ? "stopped" : "idle"}
            onClick={stopFilling}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-destructive"
          />
        </Card>

        {/* Reset Button */}
        <Card className="col-span-1 p-2 bg-card border-border">
          <ControlButton
            icon={RefreshCw}
            label="Nullstill"
            status="idle"
            onClick={resetFilling}
            className="bg-secondary hover:bg-secondary/80"
          />
        </Card>
      </div>
    </div>
  );
};

export default Index;
