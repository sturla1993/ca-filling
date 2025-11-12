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
  const targetPercentage = (targetWeight / maxCapacity) * 100;

  useEffect(() => {
    setFillPercentage((currentWeight / maxCapacity) * 100);
    setTankPercentage((tankWeight / maxCapacity) * 100);
    setSiloPercentage((siloWeight / maxCapacity) * 100);
  }, [currentWeight, maxCapacity, tankWeight, siloWeight]);

  return (
    <div className="flex flex-col items-center gap-2 p-2 bg-card rounded border border-border">
      <h3 className="text-sm font-semibold text-foreground">IBC</h3>
      
      {/* IBC Container Visualization */}
      <div className="relative w-32 h-44 bg-tank-empty border-2 border-border rounded-lg overflow-hidden">
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
        {[0, 25, 50, 75, 100].map((mark) => (
          <div
            key={mark}
            className="absolute w-full flex items-center"
            style={{ bottom: `${mark}%`, transform: 'translateY(50%)' }}
          >
            <div className="w-1.5 h-px bg-muted-foreground" />
            <span className="ml-1 text-[10px] text-muted-foreground">{mark}%</span>
          </div>
        ))}
      </div>

      {/* Weight displays */}
      <div className="grid grid-cols-2 gap-2 w-full">
        <div className="text-center">
          <div className="text-[10px] text-muted-foreground mb-0.5">Nå</div>
          <div className="text-sm font-mono font-bold text-foreground">
            {currentWeight.toFixed(1)}
          </div>
          <div className="text-[9px] text-muted-foreground">kg</div>
        </div>
        
        <div className="text-center">
          <div className="text-[10px] text-muted-foreground mb-0.5">Mål</div>
          <div className="text-sm font-mono font-bold text-status-warning">
            {targetWeight.toFixed(1)}
          </div>
          <div className="text-[9px] text-muted-foreground">kg</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-1.5">
        <div
          className="bg-primary h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${Math.min((currentWeight / targetWeight) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
};
