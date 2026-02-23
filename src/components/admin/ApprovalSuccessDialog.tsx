import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Mail, AlertTriangle } from "lucide-react";
import { User } from "@/types";

interface ApprovalSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  emailSent: boolean;
}

export function ApprovalSuccessDialog({ open, onOpenChange, user, emailSent }: ApprovalSuccessDialogProps) {
  if (!user) return null;

  const userName = user.first_name && user.last_name
    ? `${user.first_name} ${user.last_name}`
    : user.first_name || user.email?.split('@')[0] || "User";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-lg">User Approved Successfully</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-center py-2">
          <p className="text-sm text-foreground">
            <span className="font-semibold">{userName}</span> has been approved and can now access the marketplace.
          </p>

          {emailSent ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-2">
              <Mail className="h-4 w-4 text-primary" />
              <span>Welcome email sent to <span className="font-medium">{user.email}</span></span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Welcome email failed to send. User was still approved.</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
