import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";

interface SettingsDialogProps {
  tankTarget: number;
  siloTarget: number;
  tankOverrun: number;
  siloOverrun: number;
  onSave: (tankTarget: number, siloTarget: number, tankOverrun: number, siloOverrun: number) => void;
}

export const SettingsDialog = ({ tankTarget, siloTarget, tankOverrun, siloOverrun, onSave }: SettingsDialogProps) => {
  const [tempTankTarget, setTempTankTarget] = useState(tankTarget);
  const [tempSiloTarget, setTempSiloTarget] = useState(siloTarget);
  const [tempTankOverrun, setTempTankOverrun] = useState(tankOverrun);
  const [tempSiloOverrun, setTempSiloOverrun] = useState(siloOverrun);
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    onSave(tempTankTarget, tempSiloTarget, tempTankOverrun, tempSiloOverrun);
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

          <div className="space-y-2">
            <Label htmlFor="tank-overrun" className="text-foreground">
              Etterrenning tank (kg)
            </Label>
            <p className="text-xs text-muted-foreground">
              Kompensasjon for materiale som renner etter stopp
            </p>
            <Input
              id="tank-overrun"
              type="number"
              min="0"
              value={tempTankOverrun}
              onChange={(e) => setTempTankOverrun(Number(e.target.value))}
              className="font-mono text-lg bg-input border-border text-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="silo-overrun" className="text-foreground">
              Etterrenning silo (kg)
            </Label>
            <p className="text-xs text-muted-foreground">
              Kompensasjon for materiale som renner etter stopp
            </p>
            <Input
              id="silo-overrun"
              type="number"
              min="0"
              value={tempSiloOverrun}
              onChange={(e) => setTempSiloOverrun(Number(e.target.value))}
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
