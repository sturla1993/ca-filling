import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Droplets, Package } from "lucide-react";

interface IBCVisualizationProps {
  currentWeight: number;
  tankTarget: number;
  siloTarget: number;
  tankWeight: number;
  siloWeight: number;
}

export const IBCVisualization = ({ currentWeight, tankTarget, siloTarget, tankWeight, siloWeight }: IBCVisualizationProps) => {
  const [fillPercentage, setFillPercentage] = useState(0);
  const [tankPercentage, setTankPercentage] = useState(0);
  const [siloPercentage, setSiloPercentage] = useState(0);
  const safeWeight = isNaN(currentWeight) ? 0 : currentWeight;
  const safeTankTarget = isNaN(tankTarget) || tankTarget === 0 ? 1 : tankTarget;
  const safeSiloTarget = isNaN(siloTarget) || siloTarget === 0 ? 1 : siloTarget;
  const totalTarget = safeTankTarget + safeSiloTarget;
  const safeMax = totalTarget;
  const safeTank = isNaN(tankWeight) ? 0 : tankWeight;
  const safeSilo = isNaN(siloWeight) ? 0 : siloWeight;
  
  const tankTargetPercentage = (safeTankTarget / safeMax) * 100;

  useEffect(() => {
    setFillPercentage((safeWeight / safeMax) * 100);
    setTankPercentage((safeTank / safeMax) * 100);
    setSiloPercentage((safeSilo / safeMax) * 100);
  }, [safeWeight, safeMax, safeTank, safeSilo]);

  return (
    <div className="flex flex-col items-center gap-3 p-4 bg-card rounded border border-border h-full">
      <h3 className="text-lg font-semibold text-foreground flex-shrink-0">IBC</h3>
      
      {/* IBC Container Visualization */}
      <div className="relative w-44 flex-1 min-h-0 bg-tank-empty border-2 border-border rounded-lg overflow-hidden">
        {/* Tank target line (water level) */}
        <div
          className="absolute w-full h-0.5 bg-tank-fill border-t-2 border-dashed border-tank-fill z-10"
          style={{ bottom: `${tankTargetPercentage}%` }}
        >
          <span className="absolute right-1 -top-4 text-xs text-tank-fill font-semibold">{safeTankTarget.toFixed(0)} kg</span>
        </div>
        {/* Total target line (tank + silo) */}
        <div
          className="absolute w-full h-0.5 bg-status-warning border-t-2 border-dashed border-status-warning z-10"
          style={{ bottom: '100%' }}
        />
        
        {/* Tank fill level (blue) - always at bottom */}
        <div
          className="absolute bottom-0 w-full bg-tank-fill transition-all duration-500 ease-out"
          style={{ height: `${Math.min(tankPercentage, 100)}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-tank-fill to-transparent opacity-50" />
        </div>
        
        {/* Silo fill level (amber) - stacked on top of tank */}
        <div
          className={cn(
            "absolute w-full bg-amber-500 transition-all duration-500 ease-out",
            fillPercentage >= 100 && "animate-pulse"
          )}
          style={{ 
            bottom: `${Math.min(tankPercentage, 100)}%`,
            height: `${Math.min(siloPercentage, 100 - tankPercentage)}%` 
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-amber-500 to-transparent opacity-50" />
        </div>
        
        {/* Capacity markers */}
        {[25, 50, 75].map((mark) => (
          <div
            key={mark}
            className="absolute w-full flex items-center"
            style={{ bottom: `${mark}%`, transform: 'translateY(50%)' }}
          >
            <div className="w-2 h-px bg-muted-foreground" />
            <span className="ml-1 text-xs text-muted-foreground">{mark}%</span>
          </div>
        ))}
      </div>

      {/* Weight displays */}
      <div className="grid grid-cols-3 gap-2 w-full">
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-0.5">Nå</div>
          <div className="text-lg font-mono font-bold text-foreground">
            {safeWeight.toFixed(0)}
          </div>
          <div className="text-xs text-muted-foreground">kg</div>
        </div>
        
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-0.5 flex items-center justify-center gap-1">
            <Droplets className="w-3 h-3" /> Vann
          </div>
          <div className="text-lg font-mono font-bold text-tank-fill">
            {safeTankTarget.toFixed(0)}
          </div>
          <div className="text-xs text-muted-foreground">kg</div>
        </div>
        
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-0.5 flex items-center justify-center gap-1">
            <Package className="w-3 h-3" /> Tørr
          </div>
          <div className="text-lg font-mono font-bold text-amber-500">
            {safeSiloTarget.toFixed(0)}
          </div>
          <div className="text-xs text-muted-foreground">kg</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-500"
          style={{ width: `${Math.min((safeWeight / totalTarget) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
};
