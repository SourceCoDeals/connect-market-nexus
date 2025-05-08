
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { AdminConnectionRequest } from "@/types/admin";

interface ConnectionRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (comment: string) => Promise<void>;
  selectedRequest: AdminConnectionRequest | null;
  actionType: "approve" | "reject" | null;
  isLoading: boolean;
}

export function ConnectionRequestDialog({
  isOpen,
  onClose,
  onConfirm,
  selectedRequest,
  actionType,
  isLoading,
}: ConnectionRequestDialogProps) {
  const [adminComment, setAdminComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  // Reset comment when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setAdminComment("");
      setError(null);
    }
  }, [isOpen]);

  const getTitle = () => {
    if (!selectedRequest) return "Connection Request";
    
    const userName = selectedRequest.user 
      ? `${selectedRequest.user.first_name} ${selectedRequest.user.last_name}`
      : "User";
    
    const listingTitle = selectedRequest.listing?.title || "Listing";
    
    switch (actionType) {
      case "approve":
        return `Approve Connection Request`;
      case "reject":
        return `Reject Connection Request`;
      default:
        return `Connection Request Details`;
    }
  };

  const getDescription = () => {
    if (!selectedRequest) return "";
    
    const userName = selectedRequest.user 
      ? `${selectedRequest.user.first_name} ${selectedRequest.user.last_name}`
      : "User";
    
    const listingTitle = selectedRequest.listing?.title || "Listing";
    
    switch (actionType) {
      case "approve":
        return `Are you sure you want to approve ${userName}'s request to connect with "${listingTitle}"?`;
      case "reject":
        return `Are you sure you want to reject ${userName}'s request to connect with "${listingTitle}"?`;
      default:
        return `Connection request details for ${listingTitle}`;
    }
  };

  const handleConfirm = async () => {
    try {
      setError(null);
      await onConfirm(adminComment);
    } catch (err: any) {
      setError(err.message || "An error occurred while processing your request");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-destructive/15 text-destructive p-3 rounded-md">
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="admin-comment" className="text-sm font-medium">
            Comment (Optional)
          </label>
          <Textarea
            id="admin-comment"
            value={adminComment}
            onChange={(e) => setAdminComment(e.target.value)}
            placeholder={
              actionType === "approve"
                ? "Add any notes about this approval..."
                : "Provide a reason for rejection..."
            }
            className="min-h-[100px]"
          />
          {actionType === "reject" && (
            <p className="text-xs text-muted-foreground">
              This comment will be included in the notification to the user.
            </p>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isLoading}
            variant={actionType === "reject" ? "destructive" : "default"}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {actionType === "approve" && "Approve"}
            {actionType === "reject" && "Reject"}
            {!actionType && "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
