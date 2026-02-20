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

interface EditDealStructureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: {
    minRevenue?: number | null;
    maxRevenue?: number | null;
    minEbitda?: number | null;
    maxEbitda?: number | null;
    acquisitionAppetite?: string | null;
    acquisitionTimeline?: string | null;
  };
  onSave: (data: {
    target_revenue_min?: number;
    target_revenue_max?: number;
    target_ebitda_min?: number;
    target_ebitda_max?: number;
    acquisition_appetite?: string;
    acquisition_timeline?: string;
  }) => void;
  isSaving?: boolean;
}

export const EditDealStructureDialog = ({
  open,
  onOpenChange,
  data,
  onSave,
  isSaving = false,
}: EditDealStructureDialogProps) => {
  const [formData, setFormData] = useState({
    minRevenue: data.minRevenue?.toString() || "",
    maxRevenue: data.maxRevenue?.toString() || "",
    minEbitda: data.minEbitda?.toString() || "",
    maxEbitda: data.maxEbitda?.toString() || "",
    acquisitionAppetite: data.acquisitionAppetite || "",
    acquisitionTimeline: data.acquisitionTimeline || "",
  });

  useEffect(() => {
    setFormData({
      minRevenue: data.minRevenue?.toString() || "",
      maxRevenue: data.maxRevenue?.toString() || "",
      minEbitda: data.minEbitda?.toString() || "",
      maxEbitda: data.maxEbitda?.toString() || "",
      acquisitionAppetite: data.acquisitionAppetite || "",
      acquisitionTimeline: data.acquisitionTimeline || "",
    });
  }, [data]);

  const parseNumber = (value: string): number | undefined => {
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
  };

  const handleSave = () => {
    onSave({
      target_revenue_min: parseNumber(formData.minRevenue),
      target_revenue_max: parseNumber(formData.maxRevenue),
      target_ebitda_min: parseNumber(formData.minEbitda),
      target_ebitda_max: parseNumber(formData.maxEbitda),
      acquisition_appetite: formData.acquisitionAppetite || undefined,
      acquisition_timeline: formData.acquisitionTimeline || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Deal Structure</DialogTitle>
          <DialogDescription>Update size criteria and deal preferences</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label className="text-sm font-medium">Revenue Range (USD)</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="space-y-1">
                <Label htmlFor="minRevenue" className="text-xs text-muted-foreground">Min</Label>
                <Input
                  id="minRevenue"
                  type="number"
                  placeholder="e.g., 3000000"
                  value={formData.minRevenue}
                  onChange={(e) => setFormData({ ...formData, minRevenue: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="maxRevenue" className="text-xs text-muted-foreground">Max</Label>
                <Input
                  id="maxRevenue"
                  type="number"
                  placeholder="e.g., 10000000"
                  value={formData.maxRevenue}
                  onChange={(e) => setFormData({ ...formData, maxRevenue: e.target.value })}
                />
              </div>
            </div>
          </div>
          
          <div>
            <Label className="text-sm font-medium">EBITDA Range (USD)</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="space-y-1">
                <Label htmlFor="minEbitda" className="text-xs text-muted-foreground">Min</Label>
                <Input
                  id="minEbitda"
                  type="number"
                  placeholder="e.g., 300000"
                  value={formData.minEbitda}
                  onChange={(e) => setFormData({ ...formData, minEbitda: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="maxEbitda" className="text-xs text-muted-foreground">Max</Label>
                <Input
                  id="maxEbitda"
                  type="number"
                  placeholder="e.g., 2500000"
                  value={formData.maxEbitda}
                  onChange={(e) => setFormData({ ...formData, maxEbitda: e.target.value })}
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="acquisitionAppetite">Acquisition Appetite</Label>
            <Input
              id="acquisitionAppetite"
              placeholder="e.g., Very active - looking to acquire add-ons"
              value={formData.acquisitionAppetite}
              onChange={(e) => setFormData({ ...formData, acquisitionAppetite: e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="acquisitionTimeline">Acquisition Timeline</Label>
            <Input
              id="acquisitionTimeline"
              placeholder="e.g., Looking to push forward immediately"
              value={formData.acquisitionTimeline}
              onChange={(e) => setFormData({ ...formData, acquisitionTimeline: e.target.value })}
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
