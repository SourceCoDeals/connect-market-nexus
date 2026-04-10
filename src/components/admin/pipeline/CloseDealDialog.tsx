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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type CloseOutcome = 'won' | 'lost';

export const LOST_REASONS: { value: string; label: string }[] = [
  { value: 'price_too_high', label: 'Price too high (buyer)' },
  { value: 'price_too_low', label: 'Price too low (seller)' },
  { value: 'no_fit', label: 'Strategic fit / mandate mismatch' },
  { value: 'competitor_won', label: 'Lost to competitor' },
  { value: 'buyer_walked', label: 'Buyer walked away' },
  { value: 'seller_walked', label: 'Seller walked away' },
  { value: 'financing_failed', label: 'Financing fell through' },
  { value: 'diligence_failed', label: 'Diligence failed' },
  { value: 'timing', label: 'Timing / postponed' },
  { value: 'regulatory', label: 'Regulatory / antitrust' },
  { value: 'other', label: 'Other' },
];

export interface CloseDealDialogResult {
  finalPrice?: number;
  closedAt: string;
  lostReason?: string;
  lostReasonDetail?: string;
  lostToCompetitor?: string;
}

interface CloseDealDialogProps {
  open: boolean;
  outcome: CloseOutcome;
  dealTitle: string;
  defaultValue?: number;
  onCancel: () => void;
  onConfirm: (result: CloseDealDialogResult) => void;
}

export function CloseDealDialog({
  open,
  outcome,
  dealTitle,
  defaultValue,
  onCancel,
  onConfirm,
}: CloseDealDialogProps) {
  const [finalPrice, setFinalPrice] = useState<string>(defaultValue ? String(defaultValue) : '');
  const [lostReason, setLostReason] = useState<string>('');
  const [lostReasonDetail, setLostReasonDetail] = useState('');
  const [lostToCompetitor, setLostToCompetitor] = useState('');

  const reset = () => {
    setFinalPrice(defaultValue ? String(defaultValue) : '');
    setLostReason('');
    setLostReasonDetail('');
    setLostToCompetitor('');
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const handleConfirm = () => {
    const closedAt = new Date().toISOString();
    if (outcome === 'won') {
      const parsed = finalPrice ? Number(finalPrice) : undefined;
      onConfirm({
        finalPrice: Number.isFinite(parsed) ? parsed : undefined,
        closedAt,
      });
    } else {
      onConfirm({
        closedAt,
        lostReason: lostReason || undefined,
        lostReasonDetail: lostReasonDetail.trim() || undefined,
        lostToCompetitor:
          lostReason === 'competitor_won' && lostToCompetitor.trim()
            ? lostToCompetitor.trim()
            : undefined,
      });
    }
    reset();
  };

  const canConfirm = outcome === 'won' ? true : Boolean(lostReason);

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? handleCancel() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {outcome === 'won' ? 'Close Deal as Won' : 'Close Deal as Lost'}
          </DialogTitle>
          <DialogDescription className="truncate">{dealTitle}</DialogDescription>
        </DialogHeader>

        {outcome === 'won' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="final-price">Final purchase price (USD)</Label>
              <Input
                id="final-price"
                type="number"
                inputMode="decimal"
                placeholder="e.g. 5250000"
                value={finalPrice}
                onChange={(e) => setFinalPrice(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank if the final price is confidential; the close date will still be
                recorded.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lost-reason">Reason *</Label>
              <Select value={lostReason} onValueChange={setLostReason}>
                <SelectTrigger id="lost-reason">
                  <SelectValue placeholder="Choose a reason…" />
                </SelectTrigger>
                <SelectContent>
                  {LOST_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {lostReason === 'competitor_won' && (
              <div className="space-y-2">
                <Label htmlFor="competitor">Competitor that won</Label>
                <Input
                  id="competitor"
                  placeholder="Broker or buyer name"
                  value={lostToCompetitor}
                  onChange={(e) => setLostToCompetitor(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="lost-detail">Post-mortem notes</Label>
              <Textarea
                id="lost-detail"
                placeholder="What happened? What would we do differently?"
                rows={4}
                value={lostReasonDetail}
                onChange={(e) => setLostReasonDetail(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {outcome === 'won' ? 'Mark Closed Won' : 'Mark Closed Lost'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
