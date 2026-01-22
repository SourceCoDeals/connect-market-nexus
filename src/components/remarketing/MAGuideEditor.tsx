import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import { 
  FileText, 
  Eye, 
  Edit3, 
  Sparkles,
  Loader2,
  Copy,
  Check
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MAGuideEditorProps {
  content: string;
  onChange: (content: string) => void;
  universeName?: string;
  fitCriteria?: string;
}

// Pre-built templates for MA Guide sections
const MA_GUIDE_TEMPLATES = {
  overview: `<h2>Investment Overview</h2>
<p>This M&A guide is designed to help identify and evaluate potential acquisition targets that align with our buyer universe criteria.</p>

<h3>Target Profile</h3>
<ul>
<li><strong>Industry Focus:</strong> [Industry sectors]</li>
<li><strong>Revenue Range:</strong> $[X]M - $[Y]M</li>
<li><strong>EBITDA Range:</strong> $[X]M - $[Y]M</li>
<li><strong>Geographic Focus:</strong> [Regions/States]</li>
</ul>

<h3>Key Value Drivers</h3>
<ul>
<li>Recurring revenue streams</li>
<li>Strong customer relationships</li>
<li>Experienced management team</li>
<li>Scalable operations</li>
</ul>`,

  process: `<h2>Deal Process</h2>

<h3>Phase 1: Initial Outreach</h3>
<ol>
<li>Send teaser to qualified buyers</li>
<li>Execute NDAs with interested parties</li>
<li>Share Confidential Information Memorandum (CIM)</li>
</ol>

<h3>Phase 2: Due Diligence</h3>
<ol>
<li>Management presentations</li>
<li>Site visits</li>
<li>Data room access</li>
<li>Q&A sessions</li>
</ol>

<h3>Phase 3: Negotiation & Close</h3>
<ol>
<li>Letter of Intent (LOI)</li>
<li>Definitive agreements</li>
<li>Closing conditions</li>
</ol>`,

  criteria: `<h2>Buyer Evaluation Criteria</h2>

<h3>Strategic Fit</h3>
<p>We prioritize buyers who demonstrate:</p>
<ul>
<li>Alignment with our investment thesis</li>
<li>Complementary geographic presence</li>
<li>Relevant industry expertise</li>
<li>Track record of successful acquisitions</li>
</ul>

<h3>Financial Capability</h3>
<ul>
<li>Adequate capital resources</li>
<li>Realistic valuation expectations</li>
<li>Flexible deal structure capability</li>
</ul>

<h3>Cultural Alignment</h3>
<ul>
<li>Respect for existing management and employees</li>
<li>Long-term investment horizon</li>
<li>Shared values and vision</li>
</ul>`,

  talking_points: `<h2>Key Talking Points</h2>

<h3>Investment Highlights</h3>
<ul>
<li><strong>Market Position:</strong> [Description of competitive advantage]</li>
<li><strong>Growth Trajectory:</strong> [Historical and projected growth]</li>
<li><strong>Operational Excellence:</strong> [Key operational strengths]</li>
<li><strong>Management Team:</strong> [Leadership strengths]</li>
</ul>

<h3>Value Creation Opportunities</h3>
<ul>
<li>Geographic expansion</li>
<li>Service line extensions</li>
<li>Operational improvements</li>
<li>Technology investments</li>
</ul>

<h3>Risk Mitigations</h3>
<ul>
<li>[Address key risk factor 1]</li>
<li>[Address key risk factor 2]</li>
<li>[Address key risk factor 3]</li>
</ul>`
};

export const MAGuideEditor = ({
  content,
  onChange,
  universeName,
  fitCriteria
}: MAGuideEditorProps) => {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleInsertTemplate = (templateKey: keyof typeof MA_GUIDE_TEMPLATES) => {
    const template = MA_GUIDE_TEMPLATES[templateKey];
    const newContent = content ? `${content}\n\n${template}` : template;
    onChange(newContent);
    toast.success('Template inserted');
  };

  const handleGenerateWithAI = async () => {
    if (!fitCriteria) {
      toast.error('Add fit criteria first to generate AI content');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ma-guide', {
        body: {
          universe_name: universeName,
          fit_criteria: fitCriteria,
          existing_content: content
        }
      });

      if (error) throw error;

      if (data?.content) {
        onChange(data.content);
        toast.success('MA Guide generated');
      }
    } catch (error) {
      console.error('Failed to generate MA Guide:', error);
      toast.error('Failed to generate - using template instead');
      // Fallback to combining templates
      const combined = Object.values(MA_GUIDE_TEMPLATES).join('\n\n<hr />\n\n');
      onChange(combined);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      // Convert HTML to plain text for clipboard
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      await navigator.clipboard.writeText(tempDiv.textContent || '');
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              M&A Guide
            </CardTitle>
            <CardDescription>
              Create talking points and process documentation for this buyer universe
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyToClipboard}
              disabled={!content}
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateWithAI}
              disabled={isGenerating || !fitCriteria}
            >
              {isGenerating ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1 h-4 w-4" />
              )}
              Generate
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Template Quick Insert */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground mr-2">Insert:</span>
          <Badge 
            variant="outline" 
            className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
            onClick={() => handleInsertTemplate('overview')}
          >
            Overview
          </Badge>
          <Badge 
            variant="outline" 
            className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
            onClick={() => handleInsertTemplate('process')}
          >
            Process
          </Badge>
          <Badge 
            variant="outline" 
            className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
            onClick={() => handleInsertTemplate('criteria')}
          >
            Criteria
          </Badge>
          <Badge 
            variant="outline" 
            className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
            onClick={() => handleInsertTemplate('talking_points')}
          >
            Talking Points
          </Badge>
        </div>

        {/* Mode Toggle */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'edit' | 'preview')}>
          <TabsList className="grid w-full grid-cols-2 max-w-[200px]">
            <TabsTrigger value="edit" className="gap-1.5">
              <Edit3 className="h-3.5 w-3.5" />
              Edit
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="mt-4">
            <RichTextEditor
              content={content}
              onChange={(html) => onChange(html)}
              placeholder="Start writing your M&A guide, or use the templates above..."
            />
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            {content ? (
              <div className="border rounded-lg p-4 min-h-[300px] bg-background">
                <RichTextDisplay content={content} />
              </div>
            ) : (
              <div className="border rounded-lg p-8 min-h-[300px] bg-muted/30 flex items-center justify-center">
                <p className="text-muted-foreground text-center">
                  No content yet. Start editing or insert a template.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
