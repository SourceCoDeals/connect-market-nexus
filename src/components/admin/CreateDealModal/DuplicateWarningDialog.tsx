// React is auto-imported via JSX transform
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { DuplicateDeal } from './schema';

interface DuplicateWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateDeal[];
  onCreateAnyway: () => void;
  onCancel: () => void;
}

export function DuplicateWarningDialog({
  open,
  onOpenChange,
  duplicates,
  onCreateAnyway,
  onCancel,
}: DuplicateWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Possible Duplicate Deal Found
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              A deal with the same contact email and listing already exists:
            </p>
            <div className="bg-muted p-3 rounded-md space-y-2">
              {duplicates.map((dup) => (
                <div key={dup.id} className="text-sm">
                  <div className="font-medium text-foreground">{dup.title}</div>
                  <div className="text-muted-foreground">
                    Contact: {dup.contact_name ?? 'N/A'} • Created: {dup.created_at ? format(new Date(dup.created_at), 'PP') : 'N/A'}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm">
              Do you want to create this deal anyway? This might represent a new opportunity from the same contact.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={onCreateAnyway}>
            Create Anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
