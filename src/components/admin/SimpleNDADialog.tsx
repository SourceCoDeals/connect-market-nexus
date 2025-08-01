import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Mail, User, Calendar } from "lucide-react";
import { User as UserType, Listing } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { EditableSignature } from "@/components/admin/EditableSignature";
import { useLogNDAEmail } from "@/hooks/admin/use-nda";

interface SimpleNDADialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserType | null;
  listing?: Listing;
  onSendEmail: (user: UserType, options?: { subject?: string; message?: string; customSignatureHtml?: string; customSignatureText?: string }) => Promise<void>;
}

export const SimpleNDADialog = ({ open, onOpenChange, user, listing, onSendEmail }: SimpleNDADialogProps) => {
  const [customSubject, setCustomSubject] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [customSignatureText, setCustomSignatureText] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<'quick' | 'standard' | 'executive'>('standard');

  // Use the unified hook for consistent state management
  const logNDAEmail = useLogNDAEmail();

  const handleSend = async () => {
    if (!user) return;
    
    try {
      // Use the unified hook to send email + update state
      await logNDAEmail.mutateAsync({
        userId: user.id,
        userEmail: user.email,
        adminNotes: 'NDA email sent from connection requests'
      });

      onOpenChange(false);
      setCustomSubject("");
      setCustomMessage("");
      setCustomSignatureText("");
      
      // Call the callback for any additional processing
      await onSendEmail(user);
    } catch (error) {
      console.error('Error sending NDA email:', error);
    }
  };

  // Early return AFTER all hooks are declared
  if (!user) return null;

  const quickTemplate = {
    subject: "NDA Required | SourceCo",
    message: `Dear ${user.first_name || user.email},

Please sign the attached NDA to access confidential deal information.

Best regards,`
  };

  const defaultSubject = quickTemplate.subject;
  const defaultMessage = quickTemplate.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden">
        <div className="overflow-y-auto max-h-[85vh]">
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

          {/* Template Selection */}
          <div className="space-y-4">
            <div className="space-y-3">
              <Label>Email Template</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setCustomSubject(quickTemplate.subject);
                  setCustomMessage(quickTemplate.message);
                }}
                className="text-xs"
              >
                Load Quick Template
              </Button>
            </div>

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
                setCustomSignatureText(text);
              }}
            />
          </div>
        </div>
        </div>

        <div className="flex-shrink-0 p-6 pt-0">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={logNDAEmail.isPending}>
              {logNDAEmail.isPending ? (
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};