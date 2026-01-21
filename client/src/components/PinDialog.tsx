import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useCreatePin } from "@/hooks/use-pins";
import { Trees, Trash2, PawPrint, HelpCircle } from "lucide-react";
import clsx from "clsx";

interface PinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: { lat: number; lng: number } | null;
}

type PinType = "animal" | "pollution" | "trail" | "other";

export function PinDialog({ open, onOpenChange, location }: PinDialogProps) {
  const [type, setType] = useState<PinType>("animal");
  const [description, setDescription] = useState("");
  const createPin = useCreatePin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) return;

    createPin.mutate({
      lat: location.lat,
      lng: location.lng,
      type,
      description,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setDescription("");
        setType("animal");
      }
    });
  };

  const types = [
    { id: "animal", label: "Wildlife", icon: PawPrint, color: "bg-orange-100 text-orange-600 border-orange-200" },
    { id: "trail", label: "Trail/Park", icon: Trees, color: "bg-green-100 text-green-600 border-green-200" },
    { id: "pollution", label: "Concern", icon: Trash2, color: "bg-red-100 text-red-600 border-red-200" },
    { id: "other", label: "Other", icon: HelpCircle, color: "bg-blue-100 text-blue-600 border-blue-200" },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-2xl overflow-hidden border-none shadow-2xl">
        <DialogHeader className="bg-primary/5 p-6 pb-2">
          <DialogTitle className="font-display text-2xl text-primary">Drop a Pin</DialogTitle>
          <DialogDescription>
            Share an environmental observation at this location.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 pt-2 space-y-6">
          <div className="space-y-3">
            <Label>What did you see?</Label>
            <div className="grid grid-cols-2 gap-3">
              {types.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setType(t.id as PinType)}
                  className={clsx(
                    "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200",
                    type === t.id 
                      ? `${t.color} border-current shadow-md` 
                      : "bg-secondary/20 border-transparent hover:bg-secondary/40 text-muted-foreground"
                  )}
                >
                  <t.icon className="w-6 h-6 mb-1" />
                  <span className="text-xs font-semibold">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the wildlife, trail condition, or pollution source..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="resize-none h-24 rounded-xl border-border bg-background focus:ring-primary/20"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-xl"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createPin.isPending}
              className="flex-1 rounded-xl bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
            >
              {createPin.isPending ? "Dropping..." : "Drop Pin"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
