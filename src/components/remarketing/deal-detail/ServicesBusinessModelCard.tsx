import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Loader2, Briefcase } from "lucide-react";
import { toast } from "sonner";

interface ServicesBusinessModelCardProps {
  serviceMix: string | null;
  businessModel: string | null;
  onSave: (data: { serviceMix: string; businessModel: string }) => Promise<void>;
}

export const ServicesBusinessModelCard = ({ 
  serviceMix, 
  businessModel, 
  onSave 
}: ServicesBusinessModelCardProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editedServiceMix, setEditedServiceMix] = useState(serviceMix || "");
  const [editedBusinessModel, setEditedBusinessModel] = useState(businessModel || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ 
        serviceMix: editedServiceMix, 
        businessModel: editedBusinessModel 
      });
      setIsEditOpen(false);
      toast.success("Services & business model updated");
    } catch (error) {
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = () => {
    setEditedServiceMix(serviceMix || "");
    setEditedBusinessModel(businessModel || "");
    setIsEditOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Services & Business Model
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
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Service Mix
            </p>
            <p className="text-sm">
              {serviceMix || <span className="text-muted-foreground italic">Not specified</span>}
            </p>
          </div>
          <Separator />
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Business Model
            </p>
            <p className="text-sm">
              {businessModel || <span className="text-muted-foreground italic">Not specified</span>}
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Services & Business Model</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="serviceMix">Service Mix</Label>
              <Textarea
                id="serviceMix"
                placeholder="e.g., Residential roofing 60%, Commercial 30%, Repairs 10%"
                value={editedServiceMix}
                onChange={(e) => setEditedServiceMix(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="businessModel">Business Model</Label>
              <Textarea
                id="businessModel"
                placeholder="e.g., B2B with DRP partnerships, retail walk-ins"
                value={editedBusinessModel}
                onChange={(e) => setEditedBusinessModel(e.target.value)}
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

export default ServicesBusinessModelCard;
