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

const DEFAULT_APPROVAL_EMAIL = {
  subject: "Your SourceCo account is now approved",
  message: `Your SourceCo account is now approved.

Access granted to:

• Off-market business acquisition opportunities
• Ability to request connections directly to the owners
• Request full access to listings that match your criteria

Next steps:
• Explore the marketplace: https://marketplace.sourcecodeals.com
• Set up deal alerts for automated notifications of new opportunities matching your criteria (new deals added every week)
• Fully complete your profile for enhanced matching (let us know exactly what targets you are looking for)

Questions? Reply to this email.`
};

export function ApprovalEmailDialog({ 
  open, 
  onOpenChange, 
  user, 
  onSendApprovalEmail 
}: ApprovalEmailDialogProps) {
  const [customSubject, setCustomSubject] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [customSignatureHtml, setCustomSignatureHtml] = useState("");
  const [customSignatureText, setCustomSignatureText] = useState("");

  const userName = user?.first_name && user?.last_name 
    ? `${user.first_name} ${user.last_name}` 
    : user?.first_name || user?.email?.split('@')[0] || "";

  const defaultSubject = DEFAULT_APPROVAL_EMAIL.subject;
  const defaultMessage = DEFAULT_APPROVAL_EMAIL.message.replace(/{{userName}}/g, userName);

  const handleSend = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Don't close dialog here - let UserActions handle it to prevent race condition
      await onSendApprovalEmail(user, {
        subject: customSubject || defaultSubject,
        message: customMessage || defaultMessage,
        customSignatureHtml: customSignatureHtml || undefined,
        customSignatureText: customSignatureText || undefined
      });
      
      // Reset form
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader className="space-y-2 sm:space-y-3">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-primary" />
            Approve User & Send Welcome Email
          </DialogTitle>
          <p className="text-xs sm:text-sm text-muted-foreground">
            This will approve the user's account and send them a professional welcome email.
          </p>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 md:space-y-6">
          {/* User Information */}
          <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-2 sm:p-3 md:p-4 rounded-lg border border-primary/20">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 md:gap-3">
              <User className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="font-medium text-foreground text-sm sm:text-base">{userName}</span>
                <Badge variant="outline" className="w-fit text-xs">{user.email}</Badge>
              </div>
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
              Current status: <span className="capitalize">{user.approval_status}</span>
            </div>
          </div>

          {/* Email Customization */}
          <div className="space-y-3 sm:space-y-4">
            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="subject" className="text-xs sm:text-sm font-medium">Email Subject</Label>
              <Input
                id="subject"
                placeholder={defaultSubject}
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                className="text-xs sm:text-sm h-8 sm:h-9 md:h-10"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use default: "{defaultSubject}"
              </p>
            </div>

            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="message" className="text-xs sm:text-sm font-medium">Welcome Message</Label>
              <Textarea
                id="message"
                placeholder={defaultMessage}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={6}
                className="resize-none text-xs sm:text-sm min-h-[120px] sm:min-h-[160px]"
              />
              <p className="text-xs text-muted-foreground">
                Customize the welcome message or leave empty to use the professional default template
              </p>
            </div>

            {/* Email Signature */}
            <div className="space-y-1 sm:space-y-2">
              <Label className="text-xs sm:text-sm font-medium">Email Signature</Label>
              <EditableSignature 
                showInline
                onSignatureChange={(html, text) => {
                  setCustomSignatureHtml(html);
                  setCustomSignatureText(text);
                }}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 pt-3 sm:pt-4">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto h-9 sm:h-10 text-sm min-h-[44px] sm:min-h-[40px]"
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={isLoading}
            className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary h-9 sm:h-10 text-sm min-h-[44px] sm:min-h-[40px]"
          >
            {isLoading ? (
              <>
                <Mail className="h-3 w-3 sm:h-4 sm:w-4 mr-2 animate-spin" />
                Approving & Sending...
              </>
            ) : (
              <>
                <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                Approve User & Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}