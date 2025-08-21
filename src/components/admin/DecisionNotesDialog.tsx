import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AdminConnectionRequest } from "@/types/admin";

interface DecisionNotesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (notes: string) => Promise<void>;
  request: AdminConnectionRequest | null;
  actionType: "approved" | "rejected" | "on_hold" | null;
  isLoading: boolean;
}

export const DecisionNotesDialog = ({
  isOpen,
  onClose,
  onConfirm,
  request,
  actionType,
  isLoading
}: DecisionNotesDialogProps) => {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    if (!notes.trim()) {
      setError("Decision notes are required");
      return;
    }

    try {
      await onConfirm(notes.trim());
      setNotes("");
      setError("");
      onClose();
    } catch (err) {
      setError("Failed to update request. Please try again.");
    }
  };

  const handleClose = () => {
    setNotes("");
    setError("");
    onClose();
  };

  const getActionText = () => {
    switch (actionType) {
      case "approved": return "approve";
      case "rejected": return "reject";
      case "on_hold": return "put on hold";
      default: return "update";
    }
  };

  if (!request || !actionType) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {getActionText().charAt(0).toUpperCase() + getActionText().slice(1)} Request
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            You're about to {getActionText()} the connection request from{" "}
            <span className="font-medium">
              {request.user?.first_name} {request.user?.last_name}
            </span>{" "}
            for <span className="font-medium">{request.listing?.title}</span>.
          </div>

          <div className="space-y-2">
            <Label htmlFor="decision-notes">
              Decision Notes <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="decision-notes"
              placeholder="Enter reason for this decision (e.g., 'platform fit', 'fund active', 'spoke to firm')..."
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                if (error) setError("");
              }}
              rows={3}
              className="resize-none"
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isLoading || !notes.trim()}
              variant={actionType === "rejected" ? "destructive" : "default"}
            >
              {isLoading ? "Updating..." : `${getActionText().charAt(0).toUpperCase() + getActionText().slice(1)} Request`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};