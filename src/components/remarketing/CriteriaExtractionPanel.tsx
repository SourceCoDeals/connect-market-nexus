import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Upload,
  MessageSquare,
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CriteriaExtractionPanelProps {
  universeId: string;
  universeName: string;
  maGuideContent?: string;
  onExtractionComplete?: () => void;
}

interface ExtractionSource {
  id: string;
  source_type: 'ai_guide' | 'uploaded_document' | 'call_transcript';
  source_name: string;
  extraction_status: 'pending' | 'processing' | 'completed' | 'failed';
  confidence_scores?: {
    size?: number;
    service?: number;
    geography?: number;
    buyer_types?: number;
    overall?: number;
  };
  extraction_error?: string;
  created_at: string;
}

export const CriteriaExtractionPanel = ({
  universeId,
  universeName,
  maGuideContent,
  onExtractionComplete
}: CriteriaExtractionPanelProps) => {
  const [activeTab, setActiveTab] = useState<'guide' | 'document' | 'transcript'>('guide');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionSources, setExtractionSources] = useState<ExtractionSource[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [transcriptText, setTranscriptText] = useState('');
  const [participants, setParticipants] = useState('');

  // Load existing extraction sources
  const loadExtractionSources = async () => {
    const { data, error } = await supabase
      .from('criteria_extraction_sources')
      .select('*')
      .eq('universe_id', universeId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Failed to load extraction sources:', error);
      return;
    }

    setExtractionSources(data || []);
  };

  // Extract criteria from AI-generated guide
  const handleExtractFromGuide = async () => {
    if (!maGuideContent || maGuideContent.length < 1000) {
      toast.error('M&A guide must have at least 1000 characters to extract criteria');
      return;
    }

    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-buyer-criteria', {
        body: {
          universe_id: universeId,
          guide_content: maGuideContent,
          source_name: `${universeName} M&A Guide`,
          industry_name: universeName
        }
      });

      if (error) throw error;

      toast.success('Criteria extracted from guide successfully', {
        description: `Overall confidence: ${data.criteria.overall_confidence}%`
      });

      loadExtractionSources();
      onExtractionComplete?.();
    } catch (error: any) {
      console.error('Guide extraction error:', error);
      toast.error('Failed to extract criteria from guide', {
        description: error.message
      });
    } finally {
      setIsExtracting(false);
    }
  };

  // Extract criteria from uploaded document
  const handleExtractFromDocument = async () => {
    if (!uploadFile) {
      toast.error('Please select a document to upload');
      return;
    }

    setIsExtracting(true);
    try {
      // Upload document to Supabase Storage
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${Date.now()}-${uploadFile.name}`;
      const filePath = `${universeId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, uploadFile);

      if (uploadError) throw uploadError;

      // Extract criteria from document
      const { data, error } = await supabase.functions.invoke('extract-deal-document', {
        body: {
          universe_id: universeId,
          document_url: filePath,
          document_name: uploadFile.name,
          industry_name: universeName
        }
      });

      if (error) throw error;

      toast.success('Criteria extracted from document successfully', {
        description: `Overall confidence: ${data.criteria.overall_confidence}%`
      });

      setUploadFile(null);
      loadExtractionSources();
      onExtractionComplete?.();
    } catch (error: any) {
      console.error('Document extraction error:', error);
      toast.error('Failed to extract criteria from document', {
        description: error.message
      });
    } finally {
      setIsExtracting(false);
    }
  };

  // Extract criteria from transcript
  const handleExtractFromTranscript = async () => {
    if (!transcriptText || transcriptText.length < 200) {
      toast.error('Transcript must have at least 200 characters');
      return;
    }

    setIsExtracting(true);
    try {
      const participantsList = participants
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);

      const { data, error } = await supabase.functions.invoke('extract-buyer-transcript', {
        body: {
          universe_id: universeId,
          transcript_text: transcriptText,
          participants: participantsList
        }
      });

      if (error) throw error;

      toast.success('Insights extracted from transcript successfully', {
        description: `${data.key_quotes_count} key quotes captured`
      });

      setTranscriptText('');
      setParticipants('');
      loadExtractionSources();
      onExtractionComplete?.();
    } catch (error: any) {
      console.error('Transcript extraction error:', error);
      toast.error('Failed to extract insights from transcript', {
        description: error.message
      });
    } finally {
      setIsExtracting(false);
    }
  };

  // Render confidence score badge
  const renderConfidenceBadge = (score?: number) => {
    if (!score) return null;

    const variant = score >= 80 ? 'default' : score >= 60 ? 'secondary' : 'destructive';
    const label = score >= 80 ? 'High' : score >= 60 ? 'Medium' : 'Low';

    return (
      <Badge variant={variant} className="ml-2">
        {label} ({score}%)
      </Badge>
    );
  };

  // Render status icon
  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Extract Buyer Fit Criteria
        </CardTitle>
        <CardDescription>
          Extract structured criteria from AI guides, documents, or transcripts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="guide" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              AI Guide
            </TabsTrigger>
            <TabsTrigger value="document" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Document
            </TabsTrigger>
            <TabsTrigger value="transcript" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Transcript
            </TabsTrigger>
          </TabsList>

          {/* AI Guide Tab */}
          <TabsContent value="guide" className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Extract buyer fit criteria from your AI-generated M&A guide. The guide should contain comprehensive industry research and buyer profiles.
            </div>

            {maGuideContent ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <strong>Guide Length:</strong> {maGuideContent.length.toLocaleString()} characters
                    ({Math.round(maGuideContent.split(/\s+/).length).toLocaleString()} words)
                  </div>
                </div>

                <Button
                  onClick={handleExtractFromGuide}
                  disabled={isExtracting}
                  className="w-full"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Extracting Criteria...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Extract Criteria from Guide
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-lg">
                No M&A guide content available. Generate an M&A guide first to extract criteria.
              </div>
            )}
          </TabsContent>

          {/* Document Upload Tab */}
          <TabsContent value="document" className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Upload industry research reports, deal memos, or other documents containing buyer targeting criteria.
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="document-upload">Select Document</Label>
                <Input
                  id="document-upload"
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  disabled={isExtracting}
                />
                {uploadFile && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <Button
                onClick={handleExtractFromDocument}
                disabled={isExtracting || !uploadFile}
                className="w-full"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing Document...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload & Extract
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Transcript Tab */}
          <TabsContent value="transcript" className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Paste a call or meeting transcript to extract buyer insights. This is the highest priority source (priority: 100) as it captures actual buyer statements.
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="participants">Participants (comma-separated)</Label>
                <Input
                  id="participants"
                  placeholder="John Doe (Buyer), Jane Smith (Broker)"
                  value={participants}
                  onChange={(e) => setParticipants(e.target.value)}
                  disabled={isExtracting}
                />
              </div>

              <div>
                <Label htmlFor="transcript">Transcript Text</Label>
                <Textarea
                  id="transcript"
                  placeholder="Paste transcript here..."
                  value={transcriptText}
                  onChange={(e) => setTranscriptText(e.target.value)}
                  rows={10}
                  disabled={isExtracting}
                />
                {transcriptText && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {transcriptText.length.toLocaleString()} characters
                  </p>
                )}
              </div>

              <Button
                onClick={handleExtractFromTranscript}
                disabled={isExtracting || transcriptText.length < 200}
                className="w-full"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Extracting Insights...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Extract Insights
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Extraction History */}
        {extractionSources.length > 0 && (
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Recent Extractions</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadExtractionSources}
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>

            <div className="space-y-2">
              {extractionSources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between p-3 border rounded-lg text-sm"
                >
                  <div className="flex items-center gap-2 flex-1">
                    {renderStatusIcon(source.extraction_status)}
                    <div className="flex-1">
                      <div className="font-medium">{source.source_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(source.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {source.extraction_status === 'completed' && source.confidence_scores?.overall && (
                    <div className="text-right">
                      {renderConfidenceBadge(source.confidence_scores.overall)}
                    </div>
                  )}

                  {source.extraction_status === 'failed' && (
                    <Badge variant="destructive">Failed</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
