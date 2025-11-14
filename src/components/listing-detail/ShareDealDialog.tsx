import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSendDealReferral } from '@/hooks/use-deal-referrals';

interface ShareDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId: string;
  listingTitle: string;
}

export function ShareDealDialog({
  open,
  onOpenChange,
  listingId,
  listingTitle,
}: ShareDealDialogProps) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [ccSelf, setCcSelf] = useState(false);
  
  const { mutate: sendReferral, isPending } = useSendDealReferral();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!recipientEmail) return;

    sendReferral(
      {
        listingId,
        recipientEmail,
        recipientName: recipientName || undefined,
        personalMessage: personalMessage || undefined,
        ccSelf,
      },
      {
        onSuccess: () => {
          setRecipientEmail('');
          setRecipientName('');
          setPersonalMessage('');
          setCcSelf(false);
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Forward to colleague</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Share {listingTitle} with someone who might be interested
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="colleague@company.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              required
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Name (optional)
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Their name"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message" className="text-sm font-medium">
              Personal note (optional)
            </Label>
            <Textarea
              id="message"
              placeholder="Add a message for your colleague..."
              value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="ccSelf"
              checked={ccSelf}
              onChange={(e) => setCcSelf(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="ccSelf" className="text-sm font-normal cursor-pointer">
              Send me a copy
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              size="sm"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !recipientEmail}
              size="sm"
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              {isPending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
