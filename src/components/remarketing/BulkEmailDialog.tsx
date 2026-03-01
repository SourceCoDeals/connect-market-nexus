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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Mail, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scores: Array<{
    id: string;
    buyer_id: string;
    buyer?: {
      company_name?: string;
      email?: string;
      first_name?: string;
      last_name?: string;
    };
  }>;
  listing: {
    id?: string;
    title?: string;
    internal_company_name?: string;
  } | null;
  onSent?: (buyerIds: string[]) => void;
}

export const BulkEmailDialog = ({
  open,
  onOpenChange,
  scores,
  listing,
  onSent,
}: BulkEmailDialogProps) => {
  const [subject, setSubject] = useState(
    `Acquisition Opportunity: ${listing?.title || 'New Deal'}`,
  );
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Please fill in both subject and message body');
      return;
    }

    setIsSending(true);
    try {
      const buyerIds = scores.map((s) => s.buyer_id);
      const { error } = await supabase.functions.invoke('send-bulk-outreach', {
        body: {
          listing_id: listing?.id,
          buyer_ids: buyerIds,
          subject: subject.trim(),
          message: body.trim(),
          score_ids: scores.map((s) => s.id),
        },
      });

      if (error) throw error;

      toast.success(`Sent emails to ${scores.length} buyer${scores.length !== 1 ? 's' : ''}`);
      onSent?.(buyerIds);
      onOpenChange(false);
      setBody('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send emails';
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-500" />
            Bulk Email Outreach
          </DialogTitle>
          <DialogDescription>
            Send outreach emails to {scores.length} selected buyer
            {scores.length !== 1 ? 's' : ''} for {listing?.title || 'this deal'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Recipients preview */}
          <div>
            <Label className="text-sm font-medium">Recipients</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5 max-h-24 overflow-y-auto">
              {scores.map((s) => (
                <Badge key={s.id} variant="secondary" className="text-xs">
                  {s.buyer?.company_name || s.buyer?.email || 'Unknown'}
                </Badge>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <Label htmlFor="email-subject" className="text-sm font-medium">
              Subject
            </Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject line"
              className="mt-1.5"
              disabled={isSending}
            />
          </div>

          {/* Body */}
          <div>
            <Label htmlFor="email-body" className="text-sm font-medium">
              Message
            </Label>
            <Textarea
              id="email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your outreach message..."
              rows={6}
              className="mt-1.5"
              disabled={isSending}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || !subject.trim() || !body.trim()}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send to {scores.length} Buyer{scores.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkEmailDialog;
