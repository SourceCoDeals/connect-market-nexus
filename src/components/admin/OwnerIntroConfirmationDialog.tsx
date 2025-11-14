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
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle, Mail } from "lucide-react";

interface OwnerIntroConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealTitle: string;
  dealOwner: { id: string; name: string; email: string } | null;
  primaryOwner: { id: string; name: string; email: string } | null;
  onConfirm: () => void;
  onAssignOwner: () => void;
}

export function OwnerIntroConfirmationDialog({
  open,
  onOpenChange,
  dealTitle,
  dealOwner,
  primaryOwner,
  onConfirm,
  onAssignOwner,
}: OwnerIntroConfirmationDialogProps) {
  const hasDealOwner = !!dealOwner;
  const hasPrimaryOwner = !!primaryOwner;

  // Case 1: Has both - Ideal scenario
  if (hasDealOwner && hasPrimaryOwner) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Send Owner Introduction Request?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 text-foreground">
              <p className="text-sm text-muted-foreground">
                Moving <strong className="text-foreground">{dealTitle}</strong> to: <strong className="text-foreground">Owner intro requested</strong>
              </p>
              
              <div className="space-y-3 bg-muted/50 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Deal Owner: {dealOwner.name}</p>
                    <p className="text-xs text-muted-foreground">{dealOwner.email}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Primary Owner: {primaryOwner.name}</p>
                    <p className="text-xs text-muted-foreground">{primaryOwner.email}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 bg-blue-500/10 p-3 rounded-lg border border-blue-500/20">
                <Mail className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm">
                  An email will be sent to the listing's primary owner introducing the buyer. {dealOwner.name} will be referenced as the deal coordinator.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>
              Send Notification & Move Stage
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Case 2: No deal owner but has primary owner
  if (!hasDealOwner && hasPrimaryOwner) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              No Deal Owner Assigned
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 text-foreground">
              <p className="text-sm text-muted-foreground">
                Moving <strong className="text-foreground">{dealTitle}</strong> to: <strong className="text-foreground">Owner intro requested</strong>
              </p>
              
              <div className="space-y-3 bg-muted/50 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Deal Owner: Not assigned</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Primary Owner: {primaryOwner.name}</p>
                    <p className="text-xs text-muted-foreground">{primaryOwner.email}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm">
                  The notification email will be sent, but no deal owner will be referenced. We recommend assigning an owner first.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="outline" onClick={onAssignOwner}>
              Assign Owner First
            </Button>
            <AlertDialogAction onClick={onConfirm}>
              Continue Without Owner
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Case 3: Has deal owner but no primary owner
  if (hasDealOwner && !hasPrimaryOwner) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Cannot Send Notification
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 text-foreground">
              <p className="text-sm text-muted-foreground">
                Moving <strong className="text-foreground">{dealTitle}</strong> to: <strong className="text-foreground">Owner intro requested</strong>
              </p>
              
              <div className="space-y-3 bg-muted/50 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Deal Owner: {dealOwner.name}</p>
                    <p className="text-xs text-muted-foreground">{dealOwner.email}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Primary Owner: Not configured</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <p className="text-sm">
                  This listing doesn't have a primary owner configured. The introduction notification cannot be sent.
                </p>
              </div>

              <p className="text-sm text-muted-foreground">
                You can still move the deal to this stage, but you'll need to contact the owner manually.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>
              Move Without Notification
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Case 4: Neither has owner - worst case
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Missing Required Information
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 text-foreground">
            <p className="text-sm text-muted-foreground">
              Moving <strong className="text-foreground">{dealTitle}</strong> to: <strong className="text-foreground">Owner intro requested</strong>
            </p>
            
            <div className="space-y-3 bg-muted/50 p-4 rounded-lg">
              <div className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Deal Owner: Not assigned</p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Primary Owner: Not configured</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 bg-destructive/10 p-3 rounded-lg border border-destructive/20">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm">
                This stage requires both a deal owner and a primary owner to send the introduction notification.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="outline" onClick={onAssignOwner}>
            Assign Owner & Continue
          </Button>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Continue Anyway (Not Recommended)
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
