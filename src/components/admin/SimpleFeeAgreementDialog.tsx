import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Upload, 
  X, 
  User, 
  Mail, 
  Send
} from "lucide-react";
import { User as UserType } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAdminProfile } from "@/lib/admin-profiles";
import { EditableSignature } from "@/components/admin/EditableSignature";

interface SimpleFeeAgreementDialogProps {
  user: UserType | null;
  isOpen: boolean;
  onClose: () => void;
}

const TEMPLATES = {
  quick: {
    name: "Quick",
    subject: "Fee Agreement | SourceCo",
    content: `Dear {{userName}},

Please review and sign the attached fee agreement to proceed with your connection request.

Best regards,`
  },
  standard: {
    name: "Standard", 
    subject: "Fee Agreement | SourceCo",
    content: `Dear {{userName}},

We're pleased to present our Fee Agreement for your review. This document outlines our transparent fee structure and professional service terms for successful transactions.

Upon execution, you'll receive priority access to our premium deal flow and enhanced advisory services.

Please review, execute, and return at your earliest convenience.

Best regards,`
  },
  executive: {
    name: "Executive",
    subject: "Exclusive Fee Agreement | SourceCo",
    content: `Dear {{userName}},

We're honored to present our Executive Fee Agreement, designed for sophisticated buyers seeking premium market access.

This agreement provides exclusive access to our curated deal pipeline, priority advisory services, and institutional-grade transaction support aligned with your acquisition strategy.

Please review and execute to activate your exclusive membership benefits.

Best regards,`
  }
};

export function SimpleFeeAgreementDialog({
  user,
  isOpen,
  onClose
}: SimpleFeeAgreementDialogProps) {
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customSignatureHtml, setCustomSignatureHtml] = useState("");
  const [customSignatureText, setCustomSignatureText] = useState("");
  
  const { user: adminUser } = useAuth();

  useEffect(() => {
    if (user && isOpen) {
      // Start with blank email
      setSubject("");
      setContent("");
      setAttachments([]);
    }
  }, [user, isOpen]);

  const userName = user?.first_name && user?.last_name 
    ? `${user.first_name} ${user.last_name}` 
    : user?.email?.split('@')[0] || "";

  const adminName = adminUser?.first_name && adminUser?.last_name
    ? `${adminUser.first_name} ${adminUser.last_name}`
    : adminUser?.email || "Admin";

  const loadTemplate = (templateKey: keyof typeof TEMPLATES) => {
    const template = TEMPLATES[templateKey];
    const filledSubject = template.subject.replace("{{userName}}", userName);
    const filledContent = template.content.replace(/{{userName}}/g, userName);
    
    setSubject(filledSubject);
    setContent(filledContent);
    toast.success(`${template.name} template loaded`);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length !== files.length) {
      toast.error("Only PDF files are allowed");
      return;
    }

    if (pdfFiles.length + attachments.length > 3) {
      toast.error("Maximum 3 attachments allowed");
      return;
    }

    setAttachments(prev => [...prev, ...pdfFiles]);
    toast.success(`Added ${pdfFiles.length} file(s)`);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const convertFilesToBase64 = async (files: File[]): Promise<Array<{name: string, content: string}>> => {
    const convertedAttachments = [];
    
    for (const file of files) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        const base64Content = base64.split(',')[1];
        convertedAttachments.push({
          name: file.name,
          content: base64Content
        });
      } catch (error) {
        console.error(`Error converting ${file.name}:`, error);
        toast.error(`Failed to process ${file.name}`);
      }
    }
    
    return convertedAttachments;
  };

  const handleSend = async () => {
    if (!user || !adminUser) return;
    
    if (!subject.trim()) {
      toast.error("Subject is required");
      return;
    }

    if (!content.trim()) {
      toast.error("Email content is required");
      return;
    }

    setIsLoading(true);
    try {
      // Get enhanced admin profile for signature
      const enhancedProfile = getAdminProfile(adminUser.email || '');
      const effectiveAdminName = enhancedProfile?.name || adminName;

      const base64Attachments = await convertFilesToBase64(attachments);
      
      const { data, error } = await supabase.functions.invoke('send-fee-agreement-email', {
        body: {
          userId: user.id,
          userEmail: user.email,
          subject: subject.trim(),
          content: content.trim(),
          useTemplate: false,
          adminId: adminUser.id,
          adminEmail: adminUser.email,
          adminName: effectiveAdminName,
          attachments: base64Attachments,
          customSignatureHtml: customSignatureHtml || undefined,
          customSignatureText: customSignatureText || undefined
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to send email');
      }

      await supabase.rpc('log_fee_agreement_email', {
        target_user_id: user.id,
        recipient_email: user.email,
        admin_notes: `Email sent with subject: "${subject}"`
      });

      toast.success("Fee agreement email sent!");
      handleClose();
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(error.message || "Failed to send email");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSubject("");
    setContent("");
    setAttachments([]);
    setCustomSignatureHtml("");
    setCustomSignatureText("");
    onClose();
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <FileText className="h-5 w-5" />
            Send Fee Agreement
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto max-h-[75vh]">
          {/* User Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Recipient
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm">{user.email}</span>
                  <span className="text-sm text-muted-foreground">({userName})</span>
                </div>
                <div className="flex gap-2">
                  <Badge variant={user.fee_agreement_signed ? "default" : "secondary"}>
                    {user.fee_agreement_signed ? "Signed" : "Pending"}
                  </Badge>
                  <Badge variant={user.fee_agreement_email_sent ? "default" : "outline"}>
                    {user.fee_agreement_email_sent ? "Email Sent" : "Not Sent"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Template Buttons */}
          <div className="space-y-2">
            <Label>Load Template (one-click)</Label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(TEMPLATES).map(([key, template]) => (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  onClick={() => loadTemplate(key as keyof typeof TEMPLATES)}
                >
                  Load {template.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Email Fields */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject..."
              />
            </div>

            <div>
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter email content..."
                className="min-h-[300px]"
              />
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <Label>PDF Attachments</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handleFileUpload}
                    className="flex-1"
                  />
                  <Badge variant="outline">
                    {attachments.length}/3
                  </Badge>
                </div>
                
                {attachments.length > 0 && (
                  <div className="space-y-2">
                    {attachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm">{file.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAttachment(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSend} 
              disabled={isLoading || !subject.trim() || !content.trim()}
            >
              {isLoading && <Upload className="h-4 w-4 mr-2 animate-spin" />}
              <Send className="h-4 w-4 mr-2" />
              Send Email
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}