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

interface EditCustomerInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: {
    primaryCustomerSize?: string | null;
    customerGeographicReach?: string | null;
    customerIndustries?: string[] | null;
    targetCustomerProfile?: string | null;
  };
  onSave: (data: {
    primary_customer_size?: string;
    customer_geographic_reach?: string;
    customer_industries?: string[];
    target_customer_profile?: string;
  }) => void;
  isSaving?: boolean;
}

export const EditCustomerInfoDialog = ({
  open,
  onOpenChange,
  data,
  onSave,
  isSaving = false,
}: EditCustomerInfoDialogProps) => {
  const [formData, setFormData] = useState({
    primaryCustomerSize: data.primaryCustomerSize || "",
    customerGeographicReach: data.customerGeographicReach || "",
    customerIndustries: data.customerIndustries?.join(", ") || "",
    targetCustomerProfile: data.targetCustomerProfile || "",
  });

  useEffect(() => {
    setFormData({
      primaryCustomerSize: data.primaryCustomerSize || "",
      customerGeographicReach: data.customerGeographicReach || "",
      customerIndustries: data.customerIndustries?.join(", ") || "",
      targetCustomerProfile: data.targetCustomerProfile || "",
    });
  }, [data]);

  const handleSave = () => {
    onSave({
      primary_customer_size: formData.primaryCustomerSize || undefined,
      customer_geographic_reach: formData.customerGeographicReach || undefined,
      customer_industries: formData.customerIndustries ? formData.customerIndustries.split(",").map(s => s.trim()).filter(Boolean) : undefined,
      target_customer_profile: formData.targetCustomerProfile || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Customer / End Market Info</DialogTitle>
          <DialogDescription>Update customer and market information</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primaryCustomerSize">Primary Customer Size</Label>
              <Input
                id="primaryCustomerSize"
                placeholder="e.g., SMB, Enterprise"
                value={formData.primaryCustomerSize}
                onChange={(e) => setFormData({ ...formData, primaryCustomerSize: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="customerGeographicReach">Customer Geographic Reach</Label>
              <Input
                id="customerGeographicReach"
                placeholder="e.g., Local, Regional, National"
                value={formData.customerGeographicReach}
                onChange={(e) => setFormData({ ...formData, customerGeographicReach: e.target.value })}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="customerIndustries">Customer Industries</Label>
            <Input
              id="customerIndustries"
              placeholder="Comma-separated list of industries"
              value={formData.customerIndustries}
              onChange={(e) => setFormData({ ...formData, customerIndustries: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Industries their customers are in</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="targetCustomerProfile">Target Customer Profile</Label>
            <Textarea
              id="targetCustomerProfile"
              placeholder="Description of ideal end customer..."
              value={formData.targetCustomerProfile}
              onChange={(e) => setFormData({ ...formData, targetCustomerProfile: e.target.value })}
              rows={3}
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
