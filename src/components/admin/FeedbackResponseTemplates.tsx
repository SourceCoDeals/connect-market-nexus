import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Copy, Edit, Trash2, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Template {
  id: string;
  name: string;
  category: string;
  content: string;
  tags: string[];
}

interface FeedbackResponseTemplatesProps {
  onSelectTemplate: (content: string) => void;
}

export function FeedbackResponseTemplates({ onSelectTemplate }: FeedbackResponseTemplatesProps) {
  const [templates] = useState<Template[]>([
    {
      id: '1',
      name: 'Bug Report Acknowledgment',
      category: 'bug',
      content: `Thank you for reporting this bug. We've logged this issue and our development team will investigate it shortly. 

We'll keep you updated on the progress and let you know when it's resolved.

Best regards,
The SourcecodeAls Team`,
      tags: ['bug', 'acknowledgment']
    },
    {
      id: '2',
      name: 'Feature Request Response',
      category: 'feature',
      content: `Thank you for your feature suggestion! We really appreciate users who take the time to share their ideas.

We've added this to our product roadmap for consideration. While we can't guarantee implementation, we'll evaluate it based on user demand and technical feasibility.

Best regards,
The SourcecodeAls Team`,
      tags: ['feature', 'roadmap']
    },
    {
      id: '3',
      name: 'General Inquiry',
      category: 'general',
      content: `Thank you for reaching out to us! We've received your message and will get back to you within 24 hours.

If this is urgent, please don't hesitate to contact us directly.

Best regards,
The SourcecodeAls Team`,
      tags: ['general', 'inquiry']
    }
  ]);

  const handleUseTemplate = (template: Template) => {
    onSelectTemplate(template.content);
    toast({
      title: "Template applied",
      description: `"${template.name}" template has been applied to your response.`,
    });
  };

  const handleCopyTemplate = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Template copied",
      description: "Template content has been copied to your clipboard.",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Response Templates</h3>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Template
        </Button>
      </div>
      
      <div className="grid gap-3">
        {templates.map((template) => (
          <Card key={template.id} className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-medium">{template.name}</h4>
                <div className="flex gap-1 mt-1">
                  {template.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyTemplate(template.content)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUseTemplate(template)}
                >
                  Use
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {template.content}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}