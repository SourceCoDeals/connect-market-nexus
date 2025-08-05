import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { User } from "@/types";

interface UserRejectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  reason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export function UserRejectionDialog({
  open,
  onOpenChange,
  user,
  reason,
  onReasonChange,
  onConfirm,
  isLoading
}: UserRejectionDialogProps) {
  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reject User Application</DialogTitle>
          <DialogDescription>
            Are you sure you want to reject <span className="font-medium">{user.firstName} {user.lastName}</span>?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">Reason for rejection (optional)</Label>
            <Textarea
              id="rejection-reason"
              placeholder="Enter reason for rejection..."
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Rejecting..." : "Reject User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}