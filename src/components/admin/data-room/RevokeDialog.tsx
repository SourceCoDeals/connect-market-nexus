import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Calendar } from '@/components/ui/calendar';
import {
  AlertTriangle,
  Ban,
  Clock,
  Mail,
  Send,
} from 'lucide-react';
import type { DataRoomAccessRecord } from '@/hooks/admin/data-room/use-data-room';

// ─── Inline Revoke Alert Dialog (used per-row) ───

interface RevokeAccessButtonProps {
  record: DataRoomAccessRecord;
  onRevoke: (params: { accessId: string; dealId: string }) => void;
  dealId: string;
}

export function RevokeAccessButton({ record, onRevoke, dealId }: RevokeAccessButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
          <Ban className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke access?</AlertDialogTitle>
          <AlertDialogDescription>
            This will immediately revoke all data room access for {record.buyer_name}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onRevoke({ accessId: record.access_id, dealId })}
            className="bg-destructive text-destructive-foreground"
          >
            Revoke
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Send Email Dialog ───

interface SendEmailDialogProps {
  record: DataRoomAccessRecord | null;
  onClose: () => void;
  email: string;
  onEmailChange: (email: string) => void;
  onSend: () => void;
}

export function SendEmailDialog({
  record,
  onClose,
  email,
  onEmailChange,
  onSend,
}: SendEmailDialogProps) {
  return (
    <Dialog
      open={!!record}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Tracked Link
          </DialogTitle>
          <DialogDescription>
            Send a tracked document access link to {record?.buyer_name} via email.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Email address</label>
            <Input
              type="email"
              placeholder="buyer@example.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">What happens:</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>Your email client opens with a pre-filled message</li>
              <li>The link will be tracked — you'll see when it's accessed</li>
              <li>The send is logged in the buyer's audit trail</li>
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSend} disabled={!email}>
            <Send className="mr-2 h-4 w-4" />
            Open Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Expiration Date Dialog ───

interface ExpirationDialogProps {
  record: DataRoomAccessRecord | null;
  onClose: () => void;
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  onSave: () => void;
}

export function ExpirationDialog({
  record,
  onClose,
  date,
  onDateChange,
  onSave,
}: ExpirationDialogProps) {
  return (
    <Dialog
      open={!!record}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Set Access Expiration
          </DialogTitle>
          <DialogDescription>
            Set an expiration date for {record?.buyer_name}'s access. After this date, they won't
            be able to view documents.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center">
          <Calendar
            mode="single"
            selected={date}
            onSelect={onDateChange}
            disabled={(d) => d < new Date()}
            className="rounded-md border"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!date}>
            Set Expiration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Fee Agreement Warning Dialog ───

interface FeeWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overrideReason: string;
  onOverrideReasonChange: (reason: string) => void;
  onOverride: () => void;
  onCancel: () => void;
}

export function FeeWarningDialog({
  open,
  onOpenChange,
  overrideReason,
  onOverrideReasonChange,
  onOverride,
  onCancel,
}: FeeWarningDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Fee Agreement Required
          </DialogTitle>
          <DialogDescription>
            This buyer does not have a signed fee agreement. Releasing the full memo reveals the
            company name. Do you want to proceed anyway?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="text-sm font-medium">Override reason (required)</label>
          <Textarea
            placeholder="Why is it okay to share the full memo without a fee agreement?"
            value={overrideReason}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              onOverrideReasonChange(e.target.value)
            }
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onOverride}
            disabled={!overrideReason.trim()}
            className="bg-amber-600 hover:bg-amber-700"
          >
            Override & Grant Access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
