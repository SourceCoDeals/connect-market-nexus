import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  onSave: (customerTypes: string) => Promise<void>;
}

export const CustomerTypesCard = ({ 
  customerTypes, 
  onSave 
}: CustomerTypesCardProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editedTypes, setEditedTypes] = useState(customerTypes || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editedTypes);
      setIsEditOpen(false);
      toast.success("Customer types updated");
    } catch (error) {
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = () => {
    setEditedTypes(customerTypes || "");
    setIsEditOpen(true);
  };

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
        <CardContent>
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
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit End Market / Customers</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Textarea
                placeholder="e.g., B2B commercial clients (60%), residential homeowners (40%), insurance referrals..."
                value={editedTypes}
                onChange={(e) => setEditedTypes(e.target.value)}
                className="min-h-[100px]"
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
