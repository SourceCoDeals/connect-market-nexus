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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EditFinancialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: {
    revenue?: number | null;
    ebitda?: number | null;
    revenue_confidence?: string | null;
    ebitda_confidence?: string | null;
  };
  onSave: (data: {
    revenue?: number;
    ebitda?: number;
    revenue_confidence?: string;
    ebitda_confidence?: string;
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
    revenueConfidence: data.revenue_confidence || "medium",
    ebitdaConfidence: data.ebitda_confidence || "medium",
  });

  useEffect(() => {
    setFormData({
      revenue: data.revenue?.toString() || "",
      ebitda: data.ebitda?.toString() || "",
      revenueConfidence: data.revenue_confidence || "medium",
      ebitdaConfidence: data.ebitda_confidence || "medium",
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
      revenue_confidence: formData.revenueConfidence,
      ebitda_confidence: formData.ebitdaConfidence,
      _manualEdit: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Financial Overview</DialogTitle>
          <DialogDescription>Update revenue, EBITDA, and confidence levels</DialogDescription>
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
            <Label htmlFor="revenueConfidence">Revenue Confidence</Label>
            <Select
              value={formData.revenueConfidence}
              onValueChange={(v) => setFormData({ ...formData, revenueConfidence: v })}
            >
              <SelectTrigger id="revenueConfidence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
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

          <div className="space-y-2">
            <Label htmlFor="ebitdaConfidence">EBITDA Confidence</Label>
            <Select
              value={formData.ebitdaConfidence}
              onValueChange={(v) => setFormData({ ...formData, ebitdaConfidence: v })}
            >
              <SelectTrigger id="ebitdaConfidence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
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
