import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Loader2, Target } from "lucide-react";
import { toast } from "sonner";

interface OwnerGoalsCardProps {
  ownerGoals: string | null;
  ownershipStructure: string | null;
  specialRequirements: string | null;
  onSave: (data: { 
    ownerGoals: string; 
    specialRequirements: string 
  }) => Promise<void>;
}

export const OwnerGoalsCard = ({ 
  ownerGoals, 
  ownershipStructure,
  specialRequirements,
  onSave 
}: OwnerGoalsCardProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editedGoals, setEditedGoals] = useState(ownerGoals || "");
  const [editedRequirements, setEditedRequirements] = useState(specialRequirements || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ 
        ownerGoals: editedGoals, 
        specialRequirements: editedRequirements 
      });
      setIsEditOpen(false);
      toast.success("Owner goals updated");
    } catch (error) {
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = () => {
    setEditedGoals(ownerGoals || "");
    setEditedRequirements(specialRequirements || "");
    setIsEditOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />
              Owner Goals & Transition
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
              Owner Goals
            </p>
            <p className="text-sm">
              {ownerGoals || <span className="text-muted-foreground italic">Not specified</span>}
            </p>
          </div>
          <Separator />
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Ownership Structure
            </p>
            <p className="text-sm">
              {ownershipStructure || <span className="text-muted-foreground italic">Not specified</span>}
            </p>
          </div>
          <Separator />
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Special Requirements
            </p>
            <p className="text-sm">
              {specialRequirements || <span className="text-muted-foreground italic">Not specified</span>}
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Owner Goals & Transition</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="ownerGoals">Owner Goals</Label>
              <Textarea
                id="ownerGoals"
                placeholder="e.g., Looking to retire in 2-3 years, wants to stay on part-time..."
                value={editedGoals}
                onChange={(e) => setEditedGoals(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="specialRequirements">Special Requirements</Label>
              <Textarea
                id="specialRequirements"
                placeholder="e.g., Must retain all employees, real estate not included..."
                value={editedRequirements}
                onChange={(e) => setEditedRequirements(e.target.value)}
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

export default OwnerGoalsCard;
