import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Mail, User, Calendar } from "lucide-react";
import { User as UserType } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { EditableSignature } from "@/components/admin/EditableSignature";

interface SimpleNDADialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserType | null;
  onSendEmail: (user: UserType, options?: { subject?: string; message?: string; customSignatureHtml?: string; customSignatureText?: string }) => Promise<void>;
}

export const SimpleNDADialog = ({ open, onOpenChange, user, onSendEmail }: SimpleNDADialogProps) => {
  const [customSubject, setCustomSubject] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [customSignatureHtml, setCustomSignatureHtml] = useState("");
  const [customSignatureText, setCustomSignatureText] = useState("");

  const handleSend = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      await onSendEmail(user, {
        subject: customSubject || undefined,
        message: customMessage || undefined,
        customSignatureHtml: customSignatureHtml || undefined,
        customSignatureText: customSignatureText || undefined
      });
      onOpenChange(false);
      setCustomSubject("");
      setCustomMessage("");
      setCustomSignatureHtml("");
      setCustomSignatureText("");
    } catch (error) {
      console.error('Error sending NDA email:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  const defaultSubject = "Non-Disclosure Agreement | SourceCo";
  const defaultMessage = `Dear ${user.first_name || user.email},

We are pleased to present our Non-Disclosure Agreement for your review and execution. This document establishes the confidentiality framework necessary for our business discussions.

Key Provisions:
• Strict confidentiality of all shared information
• Protection of proprietary business data
• Professional obligations and legal safeguards
• Mutual respect for sensitive commercial details

This agreement enables us to provide detailed business intelligence, financial data, and investment opportunities that match your acquisition criteria.

Upon execution, you will gain immediate access to our comprehensive deal flow and proprietary market insights.

Please review, execute, and return at your earliest convenience.

Best regards,`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Send NDA Email
          </DialogTitle>
          <DialogDescription>
            Send a Non-Disclosure Agreement to the selected user
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Information */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{user.first_name} {user.last_name}</span>
              <Badge variant="outline">{user.email}</Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">NDA Status:</span>
                  <Badge variant={user.nda_signed ? "default" : "secondary"}>
                    {user.nda_signed ? "Signed" : "Not Signed"}
                  </Badge>
                </div>
                {user.nda_signed && user.nda_signed_at && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Signed:</span>
                    <span>{formatDistanceToNow(new Date(user.nda_signed_at), { addSuffix: true })}</span>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Email Status:</span>
                  <Badge variant={user.nda_email_sent ? "default" : "secondary"}>
                    {user.nda_email_sent ? "Sent" : "Not Sent"}
                  </Badge>
                </div>
                {user.nda_email_sent && user.nda_email_sent_at && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Sent:</span>
                    <span>{formatDistanceToNow(new Date(user.nda_email_sent_at), { addSuffix: true })}</span>
                  </div>
                )}
              </div>
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
                rows={8}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use the default professional message template
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
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending NDA...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send NDA Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};