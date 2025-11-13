import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DealOwnerWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerName: string;
  dealTitle: string;
  onConfirm: () => void;
}

export function DealOwnerWarningDialog({
  open,
  onOpenChange,
  ownerName,
  dealTitle,
  onConfirm,
}: DealOwnerWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Moving Another Owner's Deal</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              You're about to move a deal that belongs to <strong>{ownerName}</strong>.
            </p>
            <p className="text-sm">
              <strong>Deal:</strong> {dealTitle}
            </p>
            <p className="text-sm text-muted-foreground">
              {ownerName} will be notified of this change via email and in-app notification.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Continue Anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
