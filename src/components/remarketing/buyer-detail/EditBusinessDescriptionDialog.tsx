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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface EditBusinessDescriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: {
    industryVertical?: string | null;
    businessSummary?: string | null;
    servicesOffered?: string[] | null;
    specializedFocus?: string | null;
  };
  onSave: (data: {
    industry_vertical?: string;
    business_summary?: string;
    target_services?: string[];
    specialized_focus?: string;
  }) => void;
  isSaving?: boolean;
}

export const EditBusinessDescriptionDialog = ({
  open,
  onOpenChange,
  data,
  onSave,
  isSaving = false,
}: EditBusinessDescriptionDialogProps) => {
  const [formData, setFormData] = useState({
    industryVertical: data.industryVertical || "",
    businessSummary: data.businessSummary || "",
    servicesOffered: data.servicesOffered?.join(", ") || "",
    specializedFocus: data.specializedFocus || "",
  });

  useEffect(() => {
    setFormData({
      industryVertical: data.industryVertical || "",
      businessSummary: data.businessSummary || "",
      servicesOffered: data.servicesOffered?.join(", ") || "",
      specializedFocus: data.specializedFocus || "",
    });
  }, [data]);

  const handleSave = () => {
    onSave({
      industry_vertical: formData.industryVertical || undefined,
      business_summary: formData.businessSummary || undefined,
      target_services: formData.servicesOffered ? formData.servicesOffered.split(",").map(s => s.trim()).filter(Boolean) : undefined,
      specialized_focus: formData.specializedFocus || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Business Description</DialogTitle>
          <DialogDescription>Update the business description information</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="industryVertical">Industry Vertical</Label>
            <Input
              id="industryVertical"
              placeholder="e.g., Collision Repair / Auto Body"
              value={formData.industryVertical}
              onChange={(e) => setFormData({ ...formData, industryVertical: e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="businessSummary">Business Summary</Label>
            <Textarea
              id="businessSummary"
              placeholder="Brief company description and business model..."
              value={formData.businessSummary}
              onChange={(e) => setFormData({ ...formData, businessSummary: e.target.value })}
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="servicesOffered">Services Offered</Label>
            <Input
              id="servicesOffered"
              placeholder="Comma-separated list of services"
              value={formData.servicesOffered}
              onChange={(e) => setFormData({ ...formData, servicesOffered: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Separate multiple services with commas</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="specializedFocus">Specialized Focus</Label>
            <Textarea
              id="specializedFocus"
              placeholder="Any specialized focus areas or unique capabilities..."
              value={formData.specializedFocus}
              onChange={(e) => setFormData({ ...formData, specializedFocus: e.target.value })}
              rows={2}
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
