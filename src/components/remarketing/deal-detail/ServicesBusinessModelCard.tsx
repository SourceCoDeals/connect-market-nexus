import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  onSave: (data: { serviceMix: string }) => Promise<void>;
}

export const ServicesBusinessModelCard = ({
  serviceMix,
  onSave
}: ServicesBusinessModelCardProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editedServiceMix, setEditedServiceMix] = useState(serviceMix || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ serviceMix: editedServiceMix });
      setIsEditOpen(false);
      toast.success("Service mix updated");
    } catch (error) {
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = () => {
    setEditedServiceMix(serviceMix || "");
    setIsEditOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Services
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
              Service Mix
            </p>
            <p className="text-sm">
              {serviceMix || <span className="text-muted-foreground italic">Not specified</span>}
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Service Mix</DialogTitle>
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
