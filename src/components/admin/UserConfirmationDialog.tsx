import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User } from "@/types";

interface UserConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  title: string;
  description: string;
  confirmText: string;
  confirmVariant?: "default" | "destructive";
  onConfirm: () => void;
  isLoading: boolean;
}

export function UserConfirmationDialog({
  open,
  onOpenChange,
  user,
  title,
  description,
  confirmText,
  confirmVariant = "default",
  onConfirm,
  isLoading
}: UserConfirmationDialogProps) {
  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="confirmation-dialog-description">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div id="confirmation-dialog-description">
          <p className="text-sm text-muted-foreground">
            {description.replace("{userName}", `${user.firstName} ${user.lastName}`)}
          </p>
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
            variant={confirmVariant} 
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}