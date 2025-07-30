import { useState } from "react";
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

const DEFAULT_EMAIL_TEMPLATE = `Dear {firstName},

Thank you for your interest in our business listings platform. To proceed with connecting you to listing owners, we require a signed fee agreement.

Please review and sign the attached fee agreement at your earliest convenience. This agreement outlines our commission structure and terms of service for facilitating business acquisitions.

Key points:
• Our commission is only paid upon successful transaction completion
• No upfront fees or costs
• Professional representation throughout the process
• Access to vetted, quality business opportunities

Once signed, you'll have immediate access to connect with business owners and begin your acquisition journey.

If you have any questions about the agreement or our services, please don't hesitate to reach out.

Best regards,
The Business Marketplace Team

---

Please reply to this email with your signed agreement or any questions you may have.`;

export function FeeAgreementEmailDialog({ user, isOpen, onClose }: FeeAgreementEmailDialogProps) {
  const [emailContent, setEmailContent] = useState("");
  const [subject, setSubject] = useState("Fee Agreement Required - Business Marketplace");
  const logEmailMutation = useLogFeeAgreementEmail();

  // Reset form when dialog opens with a new user
  useState(() => {
    if (user && isOpen) {
      const personalizedContent = DEFAULT_EMAIL_TEMPLATE
        .replace("{firstName}", user.first_name || "Valued Client");
      setEmailContent(personalizedContent);
    }
  });

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
      setSubject("Fee Agreement Required - Business Marketplace");
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