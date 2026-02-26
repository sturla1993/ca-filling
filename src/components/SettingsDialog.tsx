import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Settings, Droplets, Package } from "lucide-react";

interface SettingsDialogProps {
  tankTarget: number;
  siloTarget: number;
  tankFineThreshold: number;
  tankOverrun: number;
  siloOverrun: number;
  onSave: (tankTarget: number, siloTarget: number, tankFineThreshold: number, tankOverrun: number, siloOverrun: number) => void;
}

export const SettingsDialog = ({ tankTarget, siloTarget, tankFineThreshold, tankOverrun, siloOverrun, onSave }: SettingsDialogProps) => {
  const [tempTankTarget, setTempTankTarget] = useState(tankTarget);
  const [tempSiloTarget, setTempSiloTarget] = useState(siloTarget);
  const [tempTankFineThreshold, setTempTankFineThreshold] = useState(tankFineThreshold);
  const [tempTankOverrun, setTempTankOverrun] = useState(tankOverrun);
  const [tempSiloOverrun, setTempSiloOverrun] = useState(siloOverrun);
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    onSave(tempTankTarget, tempSiloTarget, tempTankFineThreshold, tempTankOverrun, tempSiloOverrun);
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
          <DialogTitle className="text-foreground">Innstillinger</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-4">
          {/* Vannfylling-seksjon */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Droplets className="w-5 h-5" />
              <h3 className="font-semibold text-foreground text-base">Vannfylling</h3>
            </div>
            
            <div className="space-y-2 pl-7">
              <Label htmlFor="tank-target" className="text-foreground">
                Målmengde (kg)
              </Label>
              <Input
                id="tank-target"
                type="number"
                value={tempTankTarget}
                onChange={(e) => setTempTankTarget(Number(e.target.value))}
                className="font-mono text-lg bg-input border-border text-foreground"
              />
            </div>

            <div className="space-y-2 pl-7">
              <Label htmlFor="tank-fine-threshold" className="text-foreground">
                Start finfylling ved (kg)
              </Label>
              <p className="text-xs text-muted-foreground">
                Pumpe + grovventil slås av, finventil startes
              </p>
              <Input
                id="tank-fine-threshold"
                type="number"
                min="0"
                max={tempTankTarget}
                value={tempTankFineThreshold}
                onChange={(e) => setTempTankFineThreshold(Number(e.target.value))}
                className="font-mono text-lg bg-input border-border text-foreground"
              />
            </div>

            <div className="space-y-2 pl-7">
              <Label htmlFor="tank-overrun" className="text-foreground">
                Etterrenning (kg)
              </Label>
              <p className="text-xs text-muted-foreground">
                Kompensasjon for materiale etter stopp av finventil
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
          </div>

          <Separator />

          {/* Tørrstoff-seksjon */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Package className="w-5 h-5" />
              <h3 className="font-semibold text-foreground text-base">Tørrstofffylling</h3>
            </div>
            
            <div className="space-y-2 pl-7">
              <Label htmlFor="silo-target" className="text-foreground">
                Målmengde (kg)
              </Label>
              <Input
                id="silo-target"
                type="number"
                value={tempSiloTarget}
                onChange={(e) => setTempSiloTarget(Number(e.target.value))}
                className="font-mono text-lg bg-input border-border text-foreground"
              />
            </div>

            <div className="space-y-2 pl-7">
              <Label htmlFor="silo-overrun" className="text-foreground">
                Etterrenning (kg)
              </Label>
              <p className="text-xs text-muted-foreground">
                Kompensasjon for materiale etter stopp av spjeld
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
          </div>

          <Button onClick={handleSave} className="w-full" size="lg">
            Lagre innstillinger
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
