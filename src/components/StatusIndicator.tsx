import { cn } from "@/lib/utils";

type Status = "running" | "stopped" | "idle" | "warning";

interface StatusIndicatorProps {
  status: Status;
  label: string;
  className?: string;
}

export const StatusIndicator = ({ status, label, className }: StatusIndicatorProps) => {
  const statusColors = {
    running: "bg-status-running",
    stopped: "bg-status-stopped",
    idle: "bg-status-idle",
    warning: "bg-status-warning",
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className={cn("w-2 h-2 rounded-full animate-pulse", statusColors[status])} />
      <span className="text-xs font-medium text-foreground">{label}</span>
    </div>
  );
};
