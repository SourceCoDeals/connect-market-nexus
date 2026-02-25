import { useState } from 'react';
import { useBuyerIntroductions } from '@/hooks/use-buyer-introductions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import type { CreateBuyerIntroductionInput } from '@/types/buyer-introductions';

interface AddBuyerIntroductionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId: string;
  listingTitle: string;
}

const initialForm: Omit<CreateBuyerIntroductionInput, 'listing_id' | 'company_name'> = {
  buyer_name: '',
  buyer_firm_name: '',
  buyer_email: '',
  buyer_phone: '',
  buyer_linkedin_url: '',
  targeting_reason: '',
  expected_deal_size_low: undefined,
  expected_deal_size_high: undefined,
  internal_champion: '',
  internal_champion_email: '',
};

export function AddBuyerIntroductionDialog({
  open,
  onOpenChange,
  listingId,
  listingTitle,
}: AddBuyerIntroductionDialogProps) {
  const { createIntroduction, isCreating } = useBuyerIntroductions(listingId);
  const [form, setForm] = useState(initialForm);

  const update = (field: string, value: string | number | undefined) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!form.buyer_name.trim()) {
      toast.error('Buyer name is required');
      return;
    }
    if (!form.buyer_firm_name.trim()) {
      toast.error('Buyer firm name is required');
      return;
    }

    createIntroduction(
      {
        ...form,
        buyer_name: form.buyer_name.trim(),
        buyer_firm_name: form.buyer_firm_name.trim(),
        buyer_email: form.buyer_email?.trim() || undefined,
        buyer_phone: form.buyer_phone?.trim() || undefined,
        buyer_linkedin_url: form.buyer_linkedin_url?.trim() || undefined,
        targeting_reason: form.targeting_reason?.trim() || undefined,
        internal_champion: form.internal_champion?.trim() || undefined,
        internal_champion_email: form.internal_champion_email?.trim() || undefined,
        listing_id: listingId,
        company_name: listingTitle,
      },
      {
        onSuccess: () => {
          setForm(initialForm);
          onOpenChange(false);
        },
      },
    );
  };

  const handleClose = () => {
    if (!isCreating) {
      setForm(initialForm);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !isCreating && onOpenChange(v)}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Buyer to Introduction Pipeline
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">{listingTitle}</p>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Buyer Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Buyer Name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.buyer_name}
                onChange={(e) => update('buyer_name', e.target.value)}
                placeholder="e.g. James Chen"
              />
            </div>
            <div className="space-y-2">
              <Label>
                Buyer Firm <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.buyer_firm_name}
                onChange={(e) => update('buyer_firm_name', e.target.value)}
                placeholder="e.g. O2 Investment Partners"
              />
            </div>
          </div>

          {/* Contact Info */}
          <div className="border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Contact Information
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.buyer_email || ''}
                  onChange={(e) => update('buyer_email', e.target.value)}
                  placeholder="james@o2partners.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={form.buyer_phone || ''}
                  onChange={(e) => update('buyer_phone', e.target.value)}
                  placeholder="(650) 555-0123"
                />
              </div>
            </div>
            <div className="space-y-2 mt-4">
              <Label>LinkedIn URL</Label>
              <Input
                value={form.buyer_linkedin_url || ''}
                onChange={(e) => update('buyer_linkedin_url', e.target.value)}
                placeholder="linkedin.com/in/james-chen"
              />
            </div>
          </div>

          {/* Deal Info */}
          <div className="border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Deal Details
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Targeting Reason</Label>
                <Textarea
                  value={form.targeting_reason || ''}
                  onChange={(e) => update('targeting_reason', e.target.value)}
                  placeholder="e.g. Strategic fit - PE firm with tech focus"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expected Deal Size (Low)</Label>
                  <Input
                    type="number"
                    value={form.expected_deal_size_low || ''}
                    onChange={(e) =>
                      update(
                        'expected_deal_size_low',
                        e.target.value ? Number(e.target.value) : undefined,
                      )
                    }
                    placeholder="35000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expected Deal Size (High)</Label>
                  <Input
                    type="number"
                    value={form.expected_deal_size_high || ''}
                    onChange={(e) =>
                      update(
                        'expected_deal_size_high',
                        e.target.value ? Number(e.target.value) : undefined,
                      )
                    }
                    placeholder="50000000"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Internal Champion */}
          <div className="border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Internal Champion
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.internal_champion || ''}
                  onChange={(e) => update('internal_champion', e.target.value)}
                  placeholder="Sarah Mitchell"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.internal_champion_email || ''}
                  onChange={(e) => update('internal_champion_email', e.target.value)}
                  placeholder="sarah@sourceco.com"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isCreating || !form.buyer_name.trim() || !form.buyer_firm_name.trim()}
          >
            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add to Pipeline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
