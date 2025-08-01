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
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, 
  Upload, 
  X, 
  User, 
  Mail, 
  Crown, 
  Send, 
  Eye, 
  CheckCircle2,
  AlertCircle,
  Clock
} from "lucide-react";
import { User as UserType } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ProfessionalFeeAgreementDialogProps {
  user: UserType | null;
  isOpen: boolean;
  onClose: () => void;
}

const EMAIL_TEMPLATES = {
  standard: {
    name: "Professional Standard",
    description: "Clean, professional template for general business clients",
    subject: "Fee Agreement - {{userName}} | SourceCo Advisory Services",
    preview: "A comprehensive yet approachable fee agreement email with clear terms and professional presentation..."
  },
  executive: {
    name: "Executive Premium", 
    description: "Luxury template for high-value clients and strategic partnerships",
    subject: "Executive Fee Agreement - {{userName}} | SourceCo Advisory Services",
    preview: "An elevated, premium presentation designed for executive-level clients with enhanced visual design..."
  },
  custom: {
    name: "Custom Compose",
    description: "Create your own personalized email from scratch",
    subject: "",
    preview: "Write your own custom email content with full creative control..."
  }
};

export function ProfessionalFeeAgreementDialog({
  user,
  isOpen,
  onClose
}: ProfessionalFeeAgreementDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<'standard' | 'executive' | 'custom'>('standard');
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  
  const { user: adminUser } = useAuth();

  useEffect(() => {
    if (user && isOpen) {
      // Reset form when dialog opens
      setSelectedTemplate('standard');
      setSubject("");
      setContent("");
      setAttachments([]);
      setCurrentStep(1);
      setShowPreview(false);
    }
  }, [user, isOpen]);

  const userName = user?.first_name && user?.last_name 
    ? `${user.first_name} ${user.last_name}` 
    : user?.email || "";

  const adminName = adminUser?.first_name && adminUser?.last_name
    ? `${adminUser.first_name} ${adminUser.last_name}`
    : adminUser?.email || "Admin";

  const fillTemplateContent = (templateKey: 'standard' | 'executive') => {
    const template = EMAIL_TEMPLATES[templateKey];
    const filledSubject = template.subject.replace("{{userName}}", userName);
    
    setSubject(filledSubject);
    setCurrentStep(2);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length !== files.length) {
      toast.error("Only PDF files are allowed for fee agreements");
      return;
    }

    if (pdfFiles.length + attachments.length > 3) {
      toast.error("Maximum 3 attachments allowed");
      return;
    }

    setAttachments(prev => [...prev, ...pdfFiles]);
    toast.success(`Added ${pdfFiles.length} attachment(s)`);
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
        
        // Remove the data URL prefix to get just the base64 content
        const base64Content = base64.split(',')[1];
        convertedAttachments.push({
          name: file.name,
          content: base64Content
        });
      } catch (error) {
        console.error(`Error converting ${file.name} to base64:`, error);
        toast.error(`Failed to process ${file.name}`);
      }
    }
    
    return convertedAttachments;
  };

  const handleSendEmail = async () => {
    if (!user || !adminUser) return;
    
    if (selectedTemplate === 'custom' && (!subject.trim() || !content.trim())) {
      toast.error("Please fill in both subject and content for custom emails");
      return;
    }

    setIsLoading(true);
    try {
      // Convert attachments to base64
      const base64Attachments = await convertFilesToBase64(attachments);
      
      // Call the edge function
      const { data, error } = await supabase.functions.invoke('send-fee-agreement-email', {
        body: {
          userId: user.id,
          userEmail: user.email,
          subject: subject.trim(),
          content: content.trim(),
          useTemplate: selectedTemplate !== 'custom',
          adminId: adminUser.id,
          adminEmail: adminUser.email,
          adminName: adminName,
          attachments: base64Attachments,
          templateType: selectedTemplate
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to send email');
      }

      // Log the email action
      await supabase.rpc('log_fee_agreement_email', {
        target_user_id: user.id,
        recipient_email: user.email,
        admin_notes: `Email sent using ${selectedTemplate} template with subject: "${subject}"`
      });

      toast.success("Fee agreement email sent successfully!");
      handleClose();
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(error.message || "Failed to send email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedTemplate('standard');
    setSubject("");
    setContent("");
    setAttachments([]);
    setCurrentStep(1);
    setShowPreview(false);
    onClose();
  };

  if (!user) return null;

  const progressValue = currentStep === 1 ? 33 : currentStep === 2 ? 66 : 100;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <FileText className="h-6 w-6 text-primary" />
            Professional Fee Agreement System
          </DialogTitle>
          <div className="space-y-3">
            <Progress value={progressValue} className="w-full" />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Step {currentStep} of 3</span>
              <span>Professional Email Delivery</span>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[75vh]">
          <div className="space-y-6">
            {/* User Information Card */}
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Client Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
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
                    <span className="text-sm font-medium">Agreement Status:</span>
                    <Badge variant={user.fee_agreement_signed ? "success" : "secondary"}>
                      {user.fee_agreement_signed ? "Signed" : "Pending"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Email Sent:</span>
                    <Badge variant={user.fee_agreement_email_sent ? "success" : "outline"}>
                      {user.fee_agreement_email_sent ? "Yes" : "No"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 1: Template Selection */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Step 1: Choose Email Template
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(EMAIL_TEMPLATES).map(([key, template]) => (
                    <Card 
                      key={key}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedTemplate === key ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setSelectedTemplate(key as any)}
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          {key === 'executive' && <Crown className="h-4 w-4 text-amber-500" />}
                          {key === 'standard' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                          {key === 'custom' && <FileText className="h-4 w-4 text-blue-500" />}
                          {template.name}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {template.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground line-clamp-3">
                          {template.preview}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => {
                      if (selectedTemplate === 'custom') {
                        setCurrentStep(2);
                      } else {
                        fillTemplateContent(selectedTemplate);
                      }
                    }}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Content & Attachments */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Step 2: Email Content & Attachments
                </h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject">Email Subject</Label>
                    <Input
                      id="subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Enter email subject..."
                      className="w-full"
                    />
                  </div>

                  {selectedTemplate === 'custom' && (
                    <div className="space-y-2">
                      <Label htmlFor="content">Email Content</Label>
                      <Textarea
                        id="content"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Enter your custom email content here..."
                        className="min-h-[200px] w-full"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>PDF Attachments (Optional)</Label>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept=".pdf"
                          multiple
                          onChange={handleFileUpload}
                          className="flex-1"
                        />
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {attachments.length}/3 files
                        </Badge>
                      </div>
                      
                      {attachments.length > 0 && (
                        <div className="space-y-2">
                          {attachments.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-md">
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

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(1)}>
                    Back
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowPreview(true)}>
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                    <Button onClick={() => setCurrentStep(3)}>
                      Continue
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Review & Send */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Step 3: Review & Send
                </h3>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Email Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Template:</span> {EMAIL_TEMPLATES[selectedTemplate].name}
                      </div>
                      <div>
                        <span className="font-medium">Recipient:</span> {user.email}
                      </div>
                      <div>
                        <span className="font-medium">Subject:</span> {subject}
                      </div>
                      <div>
                        <span className="font-medium">Attachments:</span> {attachments.length} files
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {attachments.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Attachments</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {attachments.map((file, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <FileText className="h-4 w-4" />
                            <span>{file.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-800">Important Notes:</p>
                      <ul className="mt-1 text-amber-700 list-disc list-inside space-y-1">
                        <li>This email will be logged in the fee agreement tracking system</li>
                        <li>User's "Email Sent" status will be updated automatically</li>
                        <li>Email delivery confirmation will be provided</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(2)}>
                    Back
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleClose}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSendEmail}
                      disabled={isLoading}
                      className="min-w-[120px]"
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Sending...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Send className="h-4 w-4" />
                          Send Email
                        </div>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}