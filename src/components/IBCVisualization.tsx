import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface IBCVisualizationProps {
  currentWeight: number;
  targetWeight: number;
  maxCapacity: number;
  tankWeight: number;
  siloWeight: number;
}

export const IBCVisualization = ({ currentWeight, targetWeight, maxCapacity, tankWeight, siloWeight }: IBCVisualizationProps) => {
  const [fillPercentage, setFillPercentage] = useState(0);
  const [tankPercentage, setTankPercentage] = useState(0);
  const [siloPercentage, setSiloPercentage] = useState(0);
  const safeWeight = isNaN(currentWeight) ? 0 : currentWeight;
  const safeTarget = isNaN(targetWeight) || targetWeight === 0 ? 1 : targetWeight;
  const safeMax = isNaN(maxCapacity) || maxCapacity === 0 ? 1 : maxCapacity;
  const safeTank = isNaN(tankWeight) ? 0 : tankWeight;
  const safeSilo = isNaN(siloWeight) ? 0 : siloWeight;
  
  const targetPercentage = (safeTarget / safeMax) * 100;

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
        {/* Target line */}
        <div
          className="absolute w-full h-0.5 bg-status-warning border-t-2 border-dashed border-status-warning z-10"
          style={{ bottom: `${targetPercentage}%` }}
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
            fillPercentage >= targetPercentage && "animate-pulse"
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
      <div className="grid grid-cols-2 gap-3 w-full">
        <div className="text-center">
          <div className="text-sm text-muted-foreground mb-1">Nå</div>
          <div className="text-xl font-mono font-bold text-foreground">
            {safeWeight.toFixed(0)}
          </div>
          <div className="text-xs text-muted-foreground">kg</div>
        </div>
        
        <div className="text-center">
          <div className="text-sm text-muted-foreground mb-1">Mål</div>
          <div className="text-xl font-mono font-bold text-status-warning">
            {safeTarget.toFixed(0)}
          </div>
          <div className="text-xs text-muted-foreground">kg</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-500"
          style={{ width: `${Math.min((safeWeight / safeTarget) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
};
