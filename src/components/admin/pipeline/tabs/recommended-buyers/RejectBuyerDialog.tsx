import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { XCircle, Loader2 } from 'lucide-react';

const REJECTION_REASONS = [
  'Not a fit',
  'Already engaged',
  'Poor track record',
  'Conflict of interest',
  'Other',
] as const;

interface RejectBuyerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyerName: string;
  onConfirm: (reason: string, notes?: string) => void;
  isLoading?: boolean;
}

export function RejectBuyerDialog({
  open,
  onOpenChange,
  buyerName,
  onConfirm,
  isLoading = false,
}: RejectBuyerDialogProps) {
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    onConfirm(reason, notes || undefined);
    setReason('');
    setNotes('');
  };

  const handleClose = () => {
    setReason('');
    setNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            Reject {buyerName}
          </DialogTitle>
          <DialogDescription>
            This buyer will be removed from recommendations for this deal.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="rejection-reason">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {REJECTION_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rejection-notes">Notes (optional)</Label>
            <Textarea
              id="rejection-notes"
              placeholder="Add any additional context..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || !reason}
            className="bg-red-600 hover:bg-red-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Rejecting...
              </>
            ) : (
              'Confirm Rejection'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
