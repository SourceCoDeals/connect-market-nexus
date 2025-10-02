import React, { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useSoftDeleteDeal } from '@/hooks/admin/use-deals';
import type { Deal } from '@/hooks/admin/use-deals';

interface DeleteDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Deal | null;
  onDeleted?: () => void;
}

export function DeleteDealDialog({ open, onOpenChange, deal, onDeleted }: DeleteDealDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');
  const softDeleteMutation = useSoftDeleteDeal();

  const handleDelete = async () => {
    if (!deal || confirmText !== deal.deal_title) return;

    await softDeleteMutation.mutateAsync({
      dealId: deal.deal_id,
      reason: reason.trim() || undefined,
    });

    onDeleted?.();
    handleClose();
  };

  const handleClose = () => {
    setConfirmText('');
    setReason('');
    onOpenChange(false);
  };

  const isValid = confirmText === deal?.deal_title;

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Deal
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2">
              <p>
                You are about to delete this deal. This action will move it to deleted items where it can be restored later if needed.
              </p>

              {deal && (
                <Alert>
                  <AlertDescription>
                    <div className="space-y-1 text-sm">
                      <div><strong>Deal:</strong> {deal.deal_title}</div>
                      <div><strong>Listing:</strong> {deal.listing_title}</div>
                      <div><strong>Contact:</strong> {deal.contact_name} ({deal.contact_email})</div>
                      <div><strong>Value:</strong> ${deal.deal_value?.toLocaleString() || 0}</div>
                      <div><strong>Stage:</strong> {deal.stage_name}</div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="reason">
                  Deletion Reason (Optional)
                </Label>
                <Textarea
                  id="reason"
                  placeholder="e.g., Duplicate entry, Lost to competitor, etc."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-destructive">
                  Type "<strong>{deal?.deal_title}</strong>" to confirm deletion *
                </Label>
                <Input
                  id="confirm"
                  placeholder="Enter deal title to confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!isValid || softDeleteMutation.isPending}
            className="bg-destructive hover:bg-destructive/90"
          >
            {softDeleteMutation.isPending ? 'Deleting...' : 'Delete Deal'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
