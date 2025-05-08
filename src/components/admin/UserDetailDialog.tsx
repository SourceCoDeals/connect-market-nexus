
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { User } from "@/types";
import { Loader2 } from "lucide-react";

interface UserDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  selectedUser: User | null;
  actionType: "approve" | "reject" | "makeAdmin" | "revokeAdmin" | null;
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

  const getTitle = () => {
    switch (actionType) {
      case "approve":
        return "Approve User";
      case "reject":
        return "Reject User";
      case "makeAdmin":
        return "Make User Admin";
      case "revokeAdmin":
        return "Revoke Admin Status";
      default:
        return "User Details";
    }
  };

  const getDescription = () => {
    if (!selectedUser) return "";
    
    switch (actionType) {
      case "approve":
        return `Are you sure you want to approve ${selectedUser.first_name} ${selectedUser.last_name}? This will grant them access to the marketplace.`;
      case "reject":
        return `Are you sure you want to reject ${selectedUser.first_name} ${selectedUser.last_name}? They will not be able to access the marketplace.`;
      case "makeAdmin":
        return `Are you sure you want to make ${selectedUser.first_name} ${selectedUser.last_name} an admin? This will grant them full administrative privileges.`;
      case "revokeAdmin":
        return `Are you sure you want to revoke admin status from ${selectedUser.first_name} ${selectedUser.last_name}? They will lose all administrative privileges.`;
      default:
        return `User details for ${selectedUser.first_name} ${selectedUser.last_name}`;
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
          <div className="space-y-2">
            <label htmlFor="reason" className="text-sm font-medium">
              Rejection Reason (Optional)
            </label>
            <Textarea
              id="reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Please provide a reason for rejecting this user..."
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">
              This will be included in the email sent to the user.
            </p>
          </div>
        )}

        {(actionType === "makeAdmin" || actionType === "revokeAdmin") && (
          <div className="bg-muted p-3 rounded-md text-sm">
            <p className="font-medium">Important:</p>
            <p>
              {actionType === "makeAdmin"
                ? "This action will grant the user full administrative access to the platform, including user management and listing approvals."
                : "This action will remove all administrative privileges from this user. They will still have normal user access."}
            </p>
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={() => onConfirm(actionType === "reject" ? rejectionReason : undefined)} 
            disabled={isLoading}
            variant={actionType === "reject" ? "destructive" : "default"}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {actionType === "approve" && "Approve"}
            {actionType === "reject" && "Reject"}
            {actionType === "makeAdmin" && "Make Admin"}
            {actionType === "revokeAdmin" && "Revoke Admin"}
            {!actionType && "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
