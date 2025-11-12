import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";

interface SettingsDialogProps {
  tankTarget: number;
  siloTarget: number;
  onSave: (tankTarget: number, siloTarget: number) => void;
}

export const SettingsDialog = ({ tankTarget, siloTarget, onSave }: SettingsDialogProps) => {
  const [tempTankTarget, setTempTankTarget] = useState(tankTarget);
  const [tempSiloTarget, setTempSiloTarget] = useState(siloTarget);
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    onSave(tempTankTarget, tempSiloTarget);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings className="w-4 h-4" />
          <span className="text-xs">Innst.</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Preprogrammer mengder</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="tank-target" className="text-foreground">
              Målmengde fra tank (kg)
            </Label>
            <Input
              id="tank-target"
              type="number"
              value={tempTankTarget}
              onChange={(e) => setTempTankTarget(Number(e.target.value))}
              className="font-mono text-lg bg-input border-border text-foreground"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="silo-target" className="text-foreground">
              Målmengde fra silo (kg)
            </Label>
            <Input
              id="silo-target"
              type="number"
              value={tempSiloTarget}
              onChange={(e) => setTempSiloTarget(Number(e.target.value))}
              className="font-mono text-lg bg-input border-border text-foreground"
            />
          </div>

          <Button onClick={handleSave} className="w-full" size="lg">
            Lagre innstillinger
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
