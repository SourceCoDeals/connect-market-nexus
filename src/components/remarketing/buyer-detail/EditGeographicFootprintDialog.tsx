import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EditGeographicFootprintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: {
    targetGeographies?: string[] | null;
  };
  onSave: (data: {
    target_geographies?: string[];
  }) => void;
  isSaving?: boolean;
}

export const EditGeographicFootprintDialog = ({
  open,
  onOpenChange,
  data,
  onSave,
  isSaving = false,
}: EditGeographicFootprintDialogProps) => {
  const [formData, setFormData] = useState({
    targetGeographies: data.targetGeographies?.join(", ") || "",
  });

  useEffect(() => {
    setFormData({
      targetGeographies: data.targetGeographies?.join(", ") || "",
    });
  }, [data]);

  const handleSave = () => {
    onSave({
      target_geographies: formData.targetGeographies ? formData.targetGeographies.split(",").map(s => s.trim()).filter(Boolean) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Geographic Footprint</DialogTitle>
          <DialogDescription>Update target geographies</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="targetGeographies">Target Geographies</Label>
            <Input
              id="targetGeographies"
              placeholder="e.g., CA, OR, TX, Southeast"
              value={formData.targetGeographies}
              onChange={(e) => setFormData({ ...formData, targetGeographies: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Separate states or regions with commas (e.g., CA, TX, OR, Southeast)
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
