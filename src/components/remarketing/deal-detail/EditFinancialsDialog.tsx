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

const formatWithCommas = (value: string): string => {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.length > 1 ? `${parts[0]}.${parts[1]}` : parts[0];
};

const stripCommas = (value: string): string => {
  return value.replace(/,/g, "");
};

const numberToFormatted = (value: number | null | undefined): string => {
  if (value == null) return "";
  return formatWithCommas(value.toString());
};

export const EditFinancialsDialog = ({
  open,
  onOpenChange,
  data,
  onSave,
  isSaving = false,
}: EditFinancialsDialogProps) => {
  const [formData, setFormData] = useState({
    revenue: numberToFormatted(data.revenue),
    ebitda: numberToFormatted(data.ebitda),
  });

  useEffect(() => {
    setFormData({
      revenue: numberToFormatted(data.revenue),
      ebitda: numberToFormatted(data.ebitda),
    });
  }, [data]);

  const handleChange = (field: "revenue" | "ebitda", value: string) => {
    const formatted = formatWithCommas(value);
    setFormData((prev) => ({ ...prev, [field]: formatted }));
  };

  const parseNumber = (value: string): number | undefined => {
    const num = parseFloat(stripCommas(value));
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
              type="text"
              inputMode="decimal"
              placeholder="e.g., 5,000,000"
              value={formData.revenue}
              onChange={(e) => handleChange("revenue", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ebitda">Annual EBITDA (USD)</Label>
            <Input
              id="ebitda"
              type="text"
              inputMode="decimal"
              placeholder="e.g., 1,000,000"
              value={formData.ebitda}
              onChange={(e) => handleChange("ebitda", e.target.value)}
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
