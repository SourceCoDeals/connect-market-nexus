import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Upload, X, User, Mail } from "lucide-react";
import { User as UserType } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface EnhancedFeeAgreementEmailDialogProps {
  user: UserType | null;
  isOpen: boolean;
  onClose: () => void;
  onSend: (emailData: { 
    userId: string; 
    userEmail: string; 
    subject: string; 
    content: string; 
    attachments?: File[];
    useTemplate: boolean;
  }) => Promise<void>;
}

const DEFAULT_TEMPLATE = {
  subject: "Fee Agreement",
  content: `{{userName}},

When you get a chance, please review and sign the attached fee agreement.

Thanks!

Best regards,
{{adminName}}`
};

export function EnhancedFeeAgreementEmailDialog({
  user,
  isOpen,
  onClose,
  onSend
}: EnhancedFeeAgreementEmailDialogProps) {
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("template");
  
  const { user: adminUser } = useAuth();

  useEffect(() => {
    if (user && isOpen) {
      // Reset form when dialog opens
      setSubject("");
      setContent("");
      setAttachments([]);
      setActiveTab("template");
    }
  }, [user, isOpen]);

  const fillTemplate = () => {
    if (!user || !adminUser) return;
    
    const userName = user.first_name && user.last_name 
      ? `${user.first_name} ${user.last_name}` 
      : user.email;
    
    const adminName = adminUser.first_name && adminUser.last_name
      ? `${adminUser.first_name} ${adminUser.last_name}`
      : adminUser.email;

    const filledSubject = DEFAULT_TEMPLATE.subject.replace("{{userName}}", userName);
    const filledContent = DEFAULT_TEMPLATE.content
      .replace(/{{userName}}/g, userName)
      .replace(/{{adminName}}/g, adminName);

    setSubject(filledSubject);
    setContent(filledContent);
    setActiveTab("compose");
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length !== files.length) {
      toast.error("Only PDF files are allowed for fee agreements");
      return;
    }

    setAttachments(prev => [...prev, ...pdfFiles]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async (useTemplate: boolean) => {
    if (!user) return;
    
    if (!subject.trim() || !content.trim()) {
      toast.error("Please fill in both subject and content");
      return;
    }

    setIsLoading(true);
    try {
      await onSend({
        userId: user.id,
        userEmail: user.email,
        subject: subject.trim(),
        content: content.trim(),
        attachments,
        useTemplate
      });
      handleClose();
    } catch (error) {
      console.error("Error sending email:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSubject("");
    setContent("");
    setAttachments([]);
    setActiveTab("template");
    onClose();
  };

  if (!user) return null;

  const userName = user.first_name && user.last_name 
    ? `${user.first_name} ${user.last_name}` 
    : user.email;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Send Fee Agreement
          </DialogTitle>
        </DialogHeader>

        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Recipient Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Name:</span>
              <span className="text-sm">{userName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span className="text-sm font-medium">Email:</span>
              <span className="text-sm">{user.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              <Badge variant={user.fee_agreement_signed ? "success" : "secondary"}>
                {user.fee_agreement_signed ? "Signed" : "Not Signed"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="template">Use Template</TabsTrigger>
            <TabsTrigger value="compose">Compose Email</TabsTrigger>
          </TabsList>

          <TabsContent value="template" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Professional Template</CardTitle>
                <CardDescription>
                  Use our pre-written professional template with automatic personalization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Template Preview:</Label>
                  <div className="p-3 bg-muted rounded-md text-sm">
                    <div className="font-medium">Subject: {DEFAULT_TEMPLATE.subject.replace("{{userName}}", userName)}</div>
                    <Separator className="my-2" />
                    <div className="whitespace-pre-line text-muted-foreground">
                      {DEFAULT_TEMPLATE.content
                        .replace(/{{userName}}/g, userName)
                        .replace(/{{adminName}}/g, adminUser?.first_name && adminUser?.last_name 
                          ? `${adminUser.first_name} ${adminUser.last_name}` 
                          : adminUser?.email || "Admin")
                        .substring(0, 300)}...
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={fillTemplate} variant="outline" className="flex-1">
                    Load Template
                  </Button>
                  <Button 
                    onClick={() => handleSend(true)} 
                    disabled={isLoading}
                    className="flex-1"
                  >
                    Send Template Email
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compose" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter email subject..."
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Email Content</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter your email content here..."
                  className="min-h-[300px] w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>Attachments (PDF only)</Label>
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handleFileUpload}
                    className="w-full"
                  />
                  
                  {attachments.length > 0 && (
                    <div className="space-y-2">
                      {attachments.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
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
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={() => handleSend(false)} 
                disabled={isLoading || !subject.trim() || !content.trim()}
                className="flex-1"
              >
                {isLoading ? "Sending..." : "Send Custom Email"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="text-xs text-muted-foreground border-t pt-3">
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            <span>Note: This email will be logged in the system and the user's "Email Sent" status will be updated automatically.</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}