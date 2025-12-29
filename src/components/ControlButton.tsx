import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface ControlButtonProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  status?: "running" | "stopped" | "idle";
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export const ControlButton = ({
  icon: Icon,
  label,
  active = false,
  status = "idle",
  onClick,
  disabled = false,
  className,
}: ControlButtonProps) => {
  const statusColors = {
    running: "border-status-running bg-status-running/20",
    stopped: "border-status-stopped bg-status-stopped/20",
    idle: "border-border bg-card",
  };

  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center justify-center h-24 w-full gap-2 border-2 transition-all",
        statusColors[status],
        active && "ring-2 ring-primary",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      variant="outline"
    >
      <Icon className="w-8 h-8" />
      <span className="text-base font-semibold">{label}</span>
    </Button>
  );
};
