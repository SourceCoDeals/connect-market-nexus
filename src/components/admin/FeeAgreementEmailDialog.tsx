import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { User } from "@/types";
import { useLogFeeAgreementEmail } from "@/hooks/admin/use-fee-agreement";

interface FeeAgreementEmailDialogProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_EMAIL_TEMPLATE = `{firstName},

When you get a chance, please review and sign the attached fee agreement, then return it to us.

Thanks!

Best regards,
The Business Marketplace Team`;

export function FeeAgreementEmailDialog({ user, isOpen, onClose }: FeeAgreementEmailDialogProps) {
  const [emailContent, setEmailContent] = useState("");
  const [subject, setSubject] = useState("Fee Agreement");
  const logEmailMutation = useLogFeeAgreementEmail();

  // Reset form when dialog opens with a new user
  useEffect(() => {
    if (user && isOpen) {
      const personalizedContent = DEFAULT_EMAIL_TEMPLATE
        .replace("{firstName}", user.first_name || "Valued Client");
      setEmailContent(personalizedContent);
      setSubject("Fee Agreement");
    }
  }, [user, isOpen]);

  const handleSend = async () => {
    if (!user) return;

    try {
      await logEmailMutation.mutateAsync({
        userId: user.id,
        userEmail: user.email,
        notes: `Custom email sent with subject: "${subject}"`
      });
      onClose();
    } catch (error) {
      console.error('Failed to send fee agreement email:', error);
    }
  };

  const handleClose = () => {
    onClose();
    // Reset form after closing
    setTimeout(() => {
      setEmailContent("");
      setSubject("Fee Agreement");
    }, 300);
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Fee Agreement Email</DialogTitle>
          <DialogDescription>
            Send a customized fee agreement email to {user.first_name} {user.last_name} ({user.email})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient</Label>
            <Input
              id="recipient"
              value={`${user.first_name} ${user.last_name} <${user.email}>`}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Email Content</Label>
            <Textarea
              id="content"
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              placeholder="Email content..."
              rows={15}
              className="resize-none"
            />
          </div>

          <div className="text-xs text-muted-foreground p-3 bg-muted rounded-md">
            <p className="font-medium mb-1">Note:</p>
            <p>This email will be logged in the fee agreement tracking system. The actual fee agreement document should be attached separately through your email client or document management system.</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSend}
              disabled={logEmailMutation.isPending || !emailContent.trim()}
            >
              {logEmailMutation.isPending ? "Sending..." : "Send Email"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}