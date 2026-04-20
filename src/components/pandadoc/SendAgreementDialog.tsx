import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Send } from 'lucide-react';
import { sendAgreementEmail } from '@/lib/agreement-email';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { DEAL_OWNER_SENDERS } from '@/lib/admin-profiles';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SendAgreementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firmId: string;
  documentType: 'nda' | 'fee_agreement';
  buyerEmail: string;
  buyerName: string;
  firmName?: string;
}

/**
 * Admin dialog for sending NDA or Fee Agreement via email.
 */
export function SendAgreementDialog({
  open,
  onOpenChange,
  firmId,
  documentType,
  buyerEmail,
  buyerName,
  firmName,
}: SendAgreementDialogProps) {
  const [email, setEmail] = useState(buyerEmail);
  const [sending, setSending] = useState(false);
  const [senderEmail, setSenderEmail] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  useEffect(() => {
    if (open) {
      setEmail(buyerEmail);
      const adminEmail = currentUser?.email || '';
      const matched = DEAL_OWNER_SENDERS.find((s) => s.email === adminEmail);
      setSenderEmail(matched ? matched.email : DEAL_OWNER_SENDERS[0]?.email || '');
    }
  }, [open, buyerEmail, currentUser]);

  const docLabel = documentType === 'nda' ? 'NDA' : 'Fee Agreement';
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSend = async () => {
    if (!isValidEmail) return;
    setSending(true);
    try {
      const selectedSender = DEAL_OWNER_SENDERS.find((s) => s.email === senderEmail);
      const result = await sendAgreementEmail({
        documentType,
        recipientEmail: email,
        recipientName: buyerName,
        firmId,
        senderEmail: selectedSender?.email,
        senderName: selectedSender?.name,
      });

      if (!result.success) throw new Error(result.error || 'Failed to send');

      toast({
        title: `${docLabel} Sent`,
        description: `Document email sent to ${email}`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-document-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pending-doc-requests'] });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Failed to send',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send {docLabel}</DialogTitle>
          <DialogDescription>
            Send {docLabel} to {firmName || buyerName} via email
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="buyer-email">Recipient Email</Label>
            <Input
              id="buyer-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sender-email">Send from</Label>
            <Select value={senderEmail} onValueChange={setSenderEmail}>
              <SelectTrigger>
                <SelectValue placeholder="Select sender" />
              </SelectTrigger>
              <SelectContent>
                {DEAL_OWNER_SENDERS.map((sender) => (
                  <SelectItem key={sender.email} value={sender.email}>
                    {sender.name} — {sender.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-muted/40 border border-border/60 rounded-lg px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
            The recipient will receive the {docLabel.toLowerCase()} to review and sign. They should
            return the signed copy via email.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!isValidEmail || sending}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send {docLabel}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
