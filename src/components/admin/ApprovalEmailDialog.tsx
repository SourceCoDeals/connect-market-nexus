import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  Send, 
  User, 
  Mail
} from "lucide-react";
import { User as UserType } from "@/types";
import { EditableSignature } from "./EditableSignature";

interface ApprovalEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserType | null;
  onSendApprovalEmail: (user: UserType, options: {
    subject: string;
    message: string;
    customSignatureHtml?: string;
    customSignatureText?: string;
  }) => Promise<void>;
}

const APPROVAL_TEMPLATES = {
  standard: {
    name: "Standard",
    subject: "Account Approved | SourceCo",
    message: `Dear {{userName}},

Congratulations! Your account has been approved and you now have full access to our marketplace.

You can now:
• Browse all available listings
• Submit connection requests
• Access detailed business information
• Save listings to your portfolio

Welcome to SourceCo's exclusive marketplace.

Best regards,`
  },
  executive: {
    name: "Executive",
    subject: "Welcome to SourceCo | Account Approved",
    message: `Dear {{userName}},

We're delighted to welcome you to SourceCo's exclusive marketplace. Your account has been approved for our premium member services.

As an approved member, you now have access to:
• Our complete portfolio of curated opportunities
• Priority connection requests with immediate processing
• Detailed financial data and due diligence materials
• Direct access to our advisory team

We look forward to supporting your acquisition journey.

Best regards,`
  },
  quick: {
    name: "Quick",
    subject: "Account Approved | SourceCo",
    message: `Dear {{userName}},

Your SourceCo account has been approved. You now have full marketplace access.

Best regards,`
  }
};

export function ApprovalEmailDialog({ 
  open, 
  onOpenChange, 
  user, 
  onSendApprovalEmail 
}: ApprovalEmailDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<'standard' | 'executive' | 'quick'>('standard');
  const [customSubject, setCustomSubject] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [customSignatureHtml, setCustomSignatureHtml] = useState("");
  const [customSignatureText, setCustomSignatureText] = useState("");

  const userName = user?.first_name && user?.last_name 
    ? `${user.first_name} ${user.last_name}` 
    : user?.first_name || user?.email?.split('@')[0] || "";

  const currentTemplate = APPROVAL_TEMPLATES[selectedTemplate];
  const defaultSubject = currentTemplate.subject;
  const defaultMessage = currentTemplate.message.replace(/{{userName}}/g, userName);

  const handleSend = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      await onSendApprovalEmail(user, {
        subject: customSubject || defaultSubject,
        message: customMessage || defaultMessage,
        customSignatureHtml: customSignatureHtml || undefined,
        customSignatureText: customSignatureText || undefined
      });
      
      onOpenChange(false);
      setCustomSubject("");
      setCustomMessage("");
      setCustomSignatureHtml("");
      setCustomSignatureText("");
    } catch (error) {
      console.error('Error sending approval email:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Send Approval Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Information */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{userName}</span>
              <Badge variant="outline">{user.email}</Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              Approval status: {user.approval_status}
            </div>
          </div>

          {/* Template Selection */}
          <div className="space-y-3">
            <Label>Email Template</Label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(APPROVAL_TEMPLATES).map(([key, template]) => (
                <Button
                  key={key}
                  type="button"
                  variant={selectedTemplate === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTemplate(key as keyof typeof APPROVAL_TEMPLATES)}
                  className="text-xs"
                >
                  {template.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Email Customization */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Email Subject (optional)</Label>
              <Input
                id="subject"
                placeholder={defaultSubject}
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Custom Message (optional)</Label>
              <Textarea
                id="message"
                placeholder={defaultMessage}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={6}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use the selected template
              </p>
            </div>

            {/* Email Signature */}
            <EditableSignature 
              showInline
              onSignatureChange={(html, text) => {
                setCustomSignatureHtml(html);
                setCustomSignatureText(text);
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isLoading}>
            {isLoading ? (
              <>
                <Mail className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Approval Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}