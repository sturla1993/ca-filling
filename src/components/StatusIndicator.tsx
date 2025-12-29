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
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("w-3 h-3 rounded-full animate-pulse", statusColors[status])} />
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
  );
};
