import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface IBCVisualizationProps {
  currentWeight: number;
  targetWeight: number;
  maxCapacity: number;
}

export const IBCVisualization = ({ currentWeight, targetWeight, maxCapacity }: IBCVisualizationProps) => {
  const [fillPercentage, setFillPercentage] = useState(0);
  const targetPercentage = (targetWeight / maxCapacity) * 100;

  useEffect(() => {
    setFillPercentage((currentWeight / maxCapacity) * 100);
  }, [currentWeight, maxCapacity]);

  return (
    <div className="flex flex-col items-center gap-2 p-2 bg-card rounded border border-border">
      <h3 className="text-sm font-semibold text-foreground">IBC Container</h3>
      
      {/* IBC Container Visualization */}
      <div className="relative w-32 h-44 bg-tank-empty border-2 border-border rounded-lg overflow-hidden">
        {/* Target line */}
        <div
          className="absolute w-full h-0.5 bg-status-warning border-t-2 border-dashed border-status-warning z-10"
          style={{ bottom: `${targetPercentage}%` }}
        />
        
        {/* Fill level */}
        <div
          className={cn(
            "absolute bottom-0 w-full bg-tank-fill transition-all duration-500 ease-out",
            fillPercentage >= targetPercentage && "animate-pulse"
          )}
          style={{ height: `${Math.min(fillPercentage, 100)}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-tank-fill to-transparent opacity-50" />
        </div>
        
        {/* Capacity markers */}
        {[25, 50, 75, 100].map((mark) => (
          <div
            key={mark}
            className="absolute w-full flex items-center"
            style={{ bottom: `${mark}%` }}
          >
            <div className="w-1.5 h-px bg-muted-foreground" />
            <span className="ml-1 text-[10px] text-muted-foreground">{mark}%</span>
          </div>
        ))}
      </div>

      {/* Weight displays */}
      <div className="grid grid-cols-3 gap-1 w-full">
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
        
        <div className="text-center">
          <div className="text-[10px] text-muted-foreground mb-0.5">Max</div>
          <div className="text-sm font-mono font-bold text-muted-foreground">
            {maxCapacity}
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
