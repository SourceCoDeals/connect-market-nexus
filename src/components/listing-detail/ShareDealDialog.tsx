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
  const [personalMessage, setPersonalMessage] = useState('');

  const handleCompose = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!recipientEmail) return;

    const listingUrl = `${window.location.origin}/listing/${listingId}`;
    
    const subject = `Check out this deal: ${listingTitle}`;
    
    let body = '';
    if (personalMessage) {
      body += `${personalMessage}\n\n`;
    }
    body += `I thought you might be interested in this deal:\n\n`;
    body += `${listingTitle}\n`;
    body += `${listingUrl}\n\n`;
    body += `Note: You'll need an approved account to view the listing details.\n`;
    
    const mailtoLink = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    window.location.href = mailtoLink;
    
    // Reset form and close dialog
    setRecipientEmail('');
    setPersonalMessage('');
    onOpenChange(false);
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
        <form onSubmit={handleCompose} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Colleague's email address
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

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              size="sm"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!recipientEmail}
              size="sm"
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              Open in Email Client
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
