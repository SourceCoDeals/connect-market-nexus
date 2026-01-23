import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Loader2, Hash } from "lucide-react";
import { toast } from "sonner";

interface AdditionalInfoCardProps {
  otherNotes: string | null;
  internalNotes: string | null;
  onSave: (data: { otherNotes: string; internalNotes: string }) => Promise<void>;
}

export const AdditionalInfoCard = ({
  otherNotes,
  internalNotes,
  onSave,
}: AdditionalInfoCardProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editedOtherNotes, setEditedOtherNotes] = useState(otherNotes || "");
  const [editedInternalNotes, setEditedInternalNotes] = useState(internalNotes || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        otherNotes: editedOtherNotes,
        internalNotes: editedInternalNotes,
      });
      setIsEditOpen(false);
      toast.success("Additional info updated");
    } catch (error) {
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = () => {
    setEditedOtherNotes(otherNotes || "");
    setEditedInternalNotes(internalNotes || "");
    setIsEditOpen(true);
  };

  const hasContent = otherNotes || internalNotes;

  return (
    <>
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Additional Information
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
          {hasContent ? (
            <>
              {otherNotes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    OTHER NOTES
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{otherNotes}</p>
                </div>
              )}
              {internalNotes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    INTERNAL NOTES
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{internalNotes}</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <Hash className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No additional information</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={openEdit}
              >
                <Pencil className="h-3 w-3 mr-1" />
                Add Notes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Additional Information</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="otherNotes">Other Notes</Label>
              <Textarea
                id="otherNotes"
                placeholder="Additional notes about the deal..."
                value={editedOtherNotes}
                onChange={(e) => setEditedOtherNotes(e.target.value)}
                rows={4}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="internalNotes">Internal Notes</Label>
              <Textarea
                id="internalNotes"
                placeholder="Internal team notes (not visible externally)..."
                value={editedInternalNotes}
                onChange={(e) => setEditedInternalNotes(e.target.value)}
                rows={4}
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

export default AdditionalInfoCard;
