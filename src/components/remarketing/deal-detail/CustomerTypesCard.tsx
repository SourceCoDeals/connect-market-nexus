import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

interface CustomerTypesCardProps {
  customerTypes: string | null;
  customerConcentration?: string | null;
  customerGeography?: string | null;
  onSave: (data: { 
    customerTypes: string; 
    customerConcentration?: string;
    customerGeography?: string;
  }) => Promise<void>;
}

export const CustomerTypesCard = ({ 
  customerTypes,
  customerConcentration,
  customerGeography,
  onSave 
}: CustomerTypesCardProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editedTypes, setEditedTypes] = useState(customerTypes || "");
  const [editedConcentration, setEditedConcentration] = useState(customerConcentration || "");
  const [editedGeography, setEditedGeography] = useState(customerGeography || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        customerTypes: editedTypes,
        customerConcentration: editedConcentration,
        customerGeography: editedGeography,
      });
      setIsEditOpen(false);
      toast.success("Customer information updated");
    } catch (error) {
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = () => {
    setEditedTypes(customerTypes || "");
    setEditedConcentration(customerConcentration || "");
    setEditedGeography(customerGeography || "");
    setIsEditOpen(true);
  };

  const hasAnyData = customerTypes || customerConcentration || customerGeography;

  return (
    <>
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              End Market / Customers
            </CardTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={openEdit}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Customer Types / Segments */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Customer Types / Segments
            </p>
            <p className="text-sm">
              {customerTypes || (
                <span className="text-muted-foreground italic">Not specified</span>
              )}
            </p>
          </div>
          
          {/* Customer Concentration */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Customer Concentration
            </p>
            <p className="text-sm">
              {customerConcentration || (
                <span className="text-muted-foreground italic">Not specified</span>
              )}
            </p>
          </div>
          
          {/* Customer Geography */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Customer Geography
            </p>
            <p className="text-sm">
              {customerGeography || (
                <span className="text-muted-foreground italic">Not specified</span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit End Market / Customers</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="customer-types" className="text-sm font-medium">
                Customer Types / Segments
              </Label>
              <Textarea
                id="customer-types"
                placeholder="e.g., B2B commercial clients (60%), residential homeowners (40%), insurance referrals..."
                value={editedTypes}
                onChange={(e) => setEditedTypes(e.target.value)}
                className="min-h-[80px] mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="customer-concentration" className="text-sm font-medium">
                Customer Concentration
              </Label>
              <Input
                id="customer-concentration"
                placeholder="e.g., No customer >10% of revenue, diversified base"
                value={editedConcentration}
                onChange={(e) => setEditedConcentration(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="customer-geography" className="text-sm font-medium">
                Customer Geography
              </Label>
              <Input
                id="customer-geography"
                placeholder="e.g., 80% within 50 miles of HQ, regional presence"
                value={editedGeography}
                onChange={(e) => setEditedGeography(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CustomerTypesCard;
