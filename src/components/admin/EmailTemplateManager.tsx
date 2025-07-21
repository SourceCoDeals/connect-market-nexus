import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Send, Eye, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  category: string;
  variables: string[];
  created_at: string;
  updated_at: string;
}

interface EmailPreview {
  to: string;
  subject: string;
  content: string;
}

export function EmailTemplateManager() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [previewData, setPreviewData] = useState<EmailPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    content: '',
    category: 'general'
  });

  const emailCategories = [
    { value: 'general', label: 'General Response' },
    { value: 'bug', label: 'Bug Report Response' },
    { value: 'feature', label: 'Feature Request Response' },
    { value: 'contact', label: 'Contact Response' },
    { value: 'support', label: 'Support Response' },
    { value: 'urgent', label: 'Urgent Response' },
    { value: 'follow-up', label: 'Follow-up' },
    { value: 'resolution', label: 'Resolution Notification' }
  ];

  const commonVariables = [
    '{{user_name}}',
    '{{user_email}}',
    '{{user_company}}',
    '{{feedback_message}}',
    '{{feedback_category}}',
    '{{admin_name}}',
    '{{response_date}}',
    '{{ticket_id}}',
    '{{resolution_time}}'
  ];

  const defaultTemplates = [
    {
      name: 'General Response',
      subject: 'Thank you for your feedback - {{ticket_id}}',
      content: `Dear {{user_name}},

Thank you for reaching out to us regarding your feedback about {{feedback_category}}.

We have received your message:
"{{feedback_message}}"

Our team is reviewing your feedback and will get back to you shortly. We appreciate your patience and value your input.

Best regards,
{{admin_name}}
Support Team

---
This is an automated response. Please do not reply to this email.`,
      category: 'general'
    },
    {
      name: 'Bug Report Acknowledgment',
      subject: 'Bug Report Received - {{ticket_id}}',
      content: `Hi {{user_name}},

We have received your bug report and our development team is investigating the issue.

Bug Details:
{{feedback_message}}

We will keep you updated on the progress and notify you once the issue is resolved.

Thank you for helping us improve our platform.

Best regards,
{{admin_name}}
Development Team`,
      category: 'bug'
    },
    {
      name: 'Feature Request Response',
      subject: 'Feature Request - {{ticket_id}}',
      content: `Hello {{user_name}},

Thank you for your feature request. We've added your suggestion to our product roadmap for consideration.

Your request:
{{feedback_message}}

We'll evaluate this feature based on user demand and technical feasibility. You'll be notified if we decide to implement it.

Best regards,
{{admin_name}}
Product Team`,
      category: 'feature'
    },
    {
      name: 'Issue Resolution',
      subject: 'Issue Resolved - {{ticket_id}}',
      content: `Dear {{user_name}},

Great news! We have resolved the issue you reported.

Original issue:
{{feedback_message}}

The issue was resolved in {{resolution_time}}. Please let us know if you continue to experience any problems.

Thank you for your patience.

Best regards,
{{admin_name}}
Support Team`,
      category: 'resolution'
    }
  ];

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      // For now, we'll use localStorage to store templates
      // In a real app, this would be stored in the database
      const storedTemplates = localStorage.getItem('email_templates');
      if (storedTemplates) {
        setTemplates(JSON.parse(storedTemplates));
      } else {
        // Initialize with default templates
        const initialTemplates = defaultTemplates.map((template, index) => ({
          id: `template_${index}`,
          ...template,
          variables: extractVariables(template.content + template.subject),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        setTemplates(initialTemplates);
        localStorage.setItem('email_templates', JSON.stringify(initialTemplates));
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const extractVariables = (text: string): string[] => {
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const matches = text.match(variableRegex) || [];
    return [...new Set(matches)];
  };

  const saveTemplate = async (template: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at' | 'variables'>) => {
    try {
      const now = new Date().toISOString();
      const newTemplate: EmailTemplate = {
        ...template,
        id: `template_${Date.now()}`,
        variables: extractVariables(template.content + template.subject),
        created_at: now,
        updated_at: now
      };

      const updatedTemplates = [...templates, newTemplate];
      setTemplates(updatedTemplates);
      localStorage.setItem('email_templates', JSON.stringify(updatedTemplates));

      toast({
        title: "Template saved",
        description: "Email template has been saved successfully.",
      });
      
      setIsCreateDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Error",
        description: "Failed to save template.",
        variant: "destructive",
      });
    }
  };

  const updateTemplate = async (id: string, template: Partial<EmailTemplate>) => {
    try {
      const updatedTemplates = templates.map(t => 
        t.id === id 
          ? { 
              ...t, 
              ...template, 
              variables: extractVariables((template.content || t.content) + (template.subject || t.subject)),
              updated_at: new Date().toISOString() 
            }
          : t
      );
      setTemplates(updatedTemplates);
      localStorage.setItem('email_templates', JSON.stringify(updatedTemplates));

      toast({
        title: "Template updated",
        description: "Email template has been updated successfully.",
      });
      
      setIsEditDialogOpen(false);
      setSelectedTemplate(null);
      resetForm();
    } catch (error) {
      console.error('Error updating template:', error);
      toast({
        title: "Error",
        description: "Failed to update template.",
        variant: "destructive",
      });
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      const updatedTemplates = templates.filter(t => t.id !== id);
      setTemplates(updatedTemplates);
      localStorage.setItem('email_templates', JSON.stringify(updatedTemplates));

      toast({
        title: "Template deleted",
        description: "Email template has been deleted successfully.",
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: "Error",
        description: "Failed to delete template.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      subject: '',
      content: '',
      category: 'general'
    });
  };

  const handleEdit = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      content: template.content,
      category: template.category
    });
    setIsEditDialogOpen(true);
  };

  const handlePreview = (template: EmailTemplate) => {
    // Mock data for preview
    const mockData = {
      user_name: 'John Doe',
      user_email: 'john@example.com',
      user_company: 'Example Corp',
      feedback_message: 'This is a sample feedback message for preview purposes.',
      feedback_category: 'general',
      admin_name: 'Admin User',
      response_date: new Date().toLocaleDateString(),
      ticket_id: 'TK-12345',
      resolution_time: '2 hours'
    };

    let previewSubject = template.subject;
    let previewContent = template.content;

    // Replace variables with mock data
    Object.entries(mockData).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      previewSubject = previewSubject.replace(new RegExp(placeholder, 'g'), value);
      previewContent = previewContent.replace(new RegExp(placeholder, 'g'), value);
    });

    setPreviewData({
      to: mockData.user_email,
      subject: previewSubject,
      content: previewContent
    });
    setIsPreviewDialogOpen(true);
  };

  const handleSendTestEmail = async (template: EmailTemplate) => {
    // This would integrate with your email service
    toast({
      title: "Test email sent",
      description: "A test email has been sent to your admin email address.",
    });
  };

  const copyTemplate = (template: EmailTemplate) => {
    setFormData({
      name: `${template.name} (Copy)`,
      subject: template.subject,
      content: template.content,
      category: template.category
    });
    setIsCreateDialogOpen(true);
  };

  const TemplateDialog = ({ isOpen, onClose, title, onSave, isEdit = false }: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    onSave: () => void;
    isEdit?: boolean;
  }) => (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter template name"
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {emailCategories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="subject">Subject Line</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="Enter email subject"
            />
          </div>

          <div>
            <Label htmlFor="content">Email Content</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Enter email content"
              rows={10}
            />
          </div>

          <div>
            <Label>Available Variables</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {commonVariables.map((variable) => (
                <Badge
                  key={variable}
                  variant="secondary"
                  className="cursor-pointer hover:bg-secondary/80"
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      content: prev.content + ' ' + variable
                    }));
                  }}
                >
                  {variable}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={!formData.name || !formData.subject || !formData.content}>
              {isEdit ? 'Update' : 'Save'} Template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Email Templates</h2>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Templates</TabsTrigger>
          {emailCategories.map((category) => (
            <TabsTrigger key={category.value} value={category.value}>
              {category.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <Badge variant="secondary" className="mt-1">
                        {emailCategories.find(c => c.value === template.category)?.label || template.category}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Subject:</p>
                      <p className="text-sm truncate">{template.subject}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Variables:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {template.variables.slice(0, 3).map((variable, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {variable}
                          </Badge>
                        ))}
                        {template.variables.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{template.variables.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePreview(template)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyTemplate(template)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(template)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteTemplate(template.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {emailCategories.map((category) => (
          <TabsContent key={category.value} value={category.value} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.filter(t => t.category === category.value).map((template) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Subject:</p>
                        <p className="text-sm truncate">{template.subject}</p>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreview(template)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(template)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteTemplate(template.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Create Template Dialog */}
      <TemplateDialog
        isOpen={isCreateDialogOpen}
        onClose={() => {
          setIsCreateDialogOpen(false);
          resetForm();
        }}
        title="Create New Email Template"
        onSave={() => saveTemplate(formData)}
      />

      {/* Edit Template Dialog */}
      <TemplateDialog
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setSelectedTemplate(null);
          resetForm();
        }}
        title="Edit Email Template"
        onSave={() => selectedTemplate && updateTemplate(selectedTemplate.id, formData)}
        isEdit={true}
      />

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          {previewData && (
            <div className="space-y-4">
              <div>
                <Label>To:</Label>
                <p className="text-sm">{previewData.to}</p>
              </div>
              <div>
                <Label>Subject:</Label>
                <p className="text-sm font-medium">{previewData.subject}</p>
              </div>
              <div>
                <Label>Content:</Label>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <pre className="text-sm whitespace-pre-wrap">{previewData.content}</pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}