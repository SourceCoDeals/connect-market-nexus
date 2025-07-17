
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { User } from "@/types";
import { Loader2 } from "lucide-react";

interface UserDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  selectedUser: User | null;
  actionType: "approve" | "reject" | "makeAdmin" | "revokeAdmin" | "delete" | null;
  isLoading: boolean;
}

export function UserDetailDialog({
  isOpen,
  onClose,
  onConfirm,
  selectedUser,
  actionType,
  isLoading,
}: UserDetailDialogProps) {
  const [rejectionReason, setRejectionReason] = useState("");
  
  // Reset reason when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setRejectionReason("");
    }
  }, [isOpen]);

  const getTitle = () => {
    if (!selectedUser || !actionType) return "";
    
    switch (actionType) {
      case "approve":
        return "Approve User";
      case "reject":
        return "Reject User";
      case "makeAdmin":
        return "Make Admin";
      case "revokeAdmin":
        return "Revoke Admin";
      case "delete":
        return "Delete User";
      default:
        return "";
    }
  };

  const getDescription = () => {
    if (!selectedUser || !actionType) return "";
    
    const userName = `${selectedUser.first_name} ${selectedUser.last_name}`;
    
    switch (actionType) {
      case "approve":
        return `Are you sure you want to approve ${userName}? They will gain access to the marketplace and receive an email notification.`;
      case "reject":
        return `Are you sure you want to reject ${userName}? They will be notified via email. Please provide a reason for rejection.`;
      case "makeAdmin":
        return `Are you sure you want to make ${userName} an admin? They will have full administrative privileges.`;
      case "revokeAdmin":
        return `Are you sure you want to revoke admin privileges from ${userName}? They will lose all administrative access.`;
      case "delete":
        return `Are you sure you want to permanently delete ${userName}? This action cannot be undone and will remove all user data.`;
      default:
        return "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        {actionType === "reject" && (
          <div className="grid w-full gap-1.5">
            <label htmlFor="rejection-reason" className="text-sm font-medium">
              Reason for rejection
            </label>
            <Textarea
              id="rejection-reason"
              placeholder="Please provide a reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>
        )}
        
        {(actionType === "makeAdmin" || actionType === "revokeAdmin") && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> This action will {actionType === "makeAdmin" ? "grant" : "remove"} administrative privileges {actionType === "makeAdmin" ? "to" : "from"} this user. Admin users can manage listings, approve other users, and access all administrative features.
            </p>
          </div>
        )}
        
        {actionType === "delete" && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-800">
              <strong>Warning:</strong> This action is permanent and cannot be undone. All user data, including their profile, saved listings, and connection requests will be permanently deleted.
            </p>
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={() => onConfirm(actionType === "reject" ? rejectionReason : undefined)}
            disabled={isLoading || (actionType === "reject" && !rejectionReason.trim())}
            variant={actionType === "reject" || actionType === "delete" ? "destructive" : "default"}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {actionType === "approve" && "Approve User"}
            {actionType === "reject" && "Reject User"}
            {actionType === "makeAdmin" && "Make Admin"}
            {actionType === "revokeAdmin" && "Revoke Admin"}
            {actionType === "delete" && "Delete User"}
            {!actionType && "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
