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

interface EditFinancialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: {
    revenue?: number | null;
    ebitda?: number | null;
  };
  onSave: (data: {
    revenue?: number;
    ebitda?: number;
    _manualEdit?: boolean;
  }) => void;
  isSaving?: boolean;
}

export const EditFinancialsDialog = ({
  open,
  onOpenChange,
  data,
  onSave,
  isSaving = false,
}: EditFinancialsDialogProps) => {
  const [formData, setFormData] = useState({
    revenue: data.revenue?.toString() || "",
    ebitda: data.ebitda?.toString() || "",
  });

  useEffect(() => {
    setFormData({
      revenue: data.revenue?.toString() || "",
      ebitda: data.ebitda?.toString() || "",
    });
  }, [data]);

  const parseNumber = (value: string): number | undefined => {
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
  };

  const handleSave = () => {
    onSave({
      revenue: parseNumber(formData.revenue),
      ebitda: parseNumber(formData.ebitda),
      _manualEdit: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Financial Overview</DialogTitle>
          <DialogDescription>Update revenue and EBITDA values</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="revenue">Annual Revenue (USD)</Label>
            <Input
              id="revenue"
              type="number"
              placeholder="e.g., 5000000"
              value={formData.revenue}
              onChange={(e) => setFormData({ ...formData, revenue: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ebitda">Annual EBITDA (USD)</Label>
            <Input
              id="ebitda"
              type="number"
              placeholder="e.g., 1000000"
              value={formData.ebitda}
              onChange={(e) => setFormData({ ...formData, ebitda: e.target.value })}
            />
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
