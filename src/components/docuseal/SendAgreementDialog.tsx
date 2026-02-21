import { useState } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Send, Monitor, Mail } from 'lucide-react';
import { useCreateDocuSealSubmission } from '@/hooks/admin/use-docuseal';

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
 * Dialog for sending NDA or Fee Agreement via DocuSeal.
 * Admin can choose between embedded (in-app) or email signing flow.
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
  const [flow, setFlow] = useState<'embedded' | 'email'>('email');
  const createSubmission = useCreateDocuSealSubmission();

  const docLabel = documentType === 'nda' ? 'NDA' : 'Fee Agreement';
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSend = async () => {
    if (!isValidEmail) return;
    await createSubmission.mutateAsync({
      firmId,
      documentType,
      buyerEmail: email,
      buyerName,
      sendEmail: flow === 'email',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send {docLabel}</DialogTitle>
          <DialogDescription>
            Send {docLabel} signing request to {firmName || buyerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="buyer-email">Buyer Email</Label>
            <Input
              id="buyer-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Flow Selection */}
          <div className="space-y-2">
            <Label>Signing Method</Label>
            <RadioGroup
              value={flow}
              onValueChange={(v) => setFlow(v as 'embedded' | 'email')}
              className="space-y-2"
            >
              <div className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="email" id="flow-email" className="mt-0.5" />
                <label htmlFor="flow-email" className="cursor-pointer flex-1">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Email Link</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Buyer receives email with signing link. Best for remarketing buyers.
                  </p>
                </label>
              </div>
              <div className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="embedded" id="flow-embedded" className="mt-0.5" />
                <label htmlFor="flow-embedded" className="cursor-pointer flex-1">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">In-App Signing</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Buyer signs next time they visit the platform. Best for marketplace users.
                  </p>
                </label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!isValidEmail || createSubmission.isPending}
          >
            {createSubmission.isPending ? (
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
