import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export interface RejectionData {
  reason: string;
  notes: string;
}

export const REJECTION_REASONS = [
  'Not a fit for this deal',
  'Already engaged offline',
  'Poor previous experience',
  'Conflict of interest',
  'Other',
] as const;

interface RejectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyerName: string;
  onConfirm: (data: RejectionData) => void;
}

export function RejectionModal({
  open,
  onOpenChange,
  buyerName,
  onConfirm,
}: RejectionModalProps) {
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    if (!reason) return;
    onConfirm({ reason, notes });
    setReason('');
    setNotes('');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setReason('');
      setNotes('');
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-base">Reject Buyer from Top 5</DialogTitle>
          <DialogDescription className="text-sm">
            Remove <span className="font-medium text-foreground">{buyerName}</span> from the Top 5
            shortlist for this deal. This does not delete the buyer from the broader scored pool.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Rejection Reason <span className="text-destructive">*</span>
            </label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
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
            <label className="text-sm font-medium">
              Additional Notes <span className="text-muted-foreground text-xs">(optional)</span>
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional context about this rejection..."
              rows={3}
              className="text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={!reason}
          >
            Confirm Rejection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
