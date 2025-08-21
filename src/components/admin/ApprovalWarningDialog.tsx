import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { AdminConnectionRequest } from "@/types/admin-users";

interface ApprovalWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: AdminConnectionRequest | null;
  onConfirm: () => void;
  isLoading: boolean;
}

export function ApprovalWarningDialog({
  open,
  onOpenChange,
  request,
  onConfirm,
  isLoading
}: ApprovalWarningDialogProps) {
  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="approval-warning-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            Confirm Owner Meeting Approval
          </DialogTitle>
        </DialogHeader>
        <div id="approval-warning-description" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You're about to approve this connection request, which signals commitment to proceed with an owner meeting.
          </p>
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
            <p className="text-sm font-medium text-warning-foreground">
              ⚠️ This action will:
            </p>
            <ul className="text-sm text-warning-foreground/80 mt-2 space-y-1 list-disc list-inside">
              <li>Send approval notification to the buyer</li>
              <li>Signal readiness for owner meeting coordination</li>
              <li>Create expectation for next steps</li>
            </ul>
          </div>
          {request.followed_up && (
            <div className="bg-success/10 border border-success/20 rounded-lg p-2">
              <p className="text-xs text-success-foreground">
                ✓ Follow-up completed: Proper sequence maintained
              </p>
            </div>
          )}
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
            variant="default" 
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-warning hover:bg-warning/90 text-warning-foreground"
          >
            {isLoading ? "Approving..." : "Proceed with Approval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}