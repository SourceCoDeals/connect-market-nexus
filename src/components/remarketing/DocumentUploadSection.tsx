import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalGateCheck, useGlobalActivityMutations } from "@/hooks/remarketing/useGlobalActivityQueue";
import { DocumentReference } from "@/types/remarketing";
import { 
  FileText, 
  Upload, 
  X, 
  ExternalLink, 
  Loader2,
  File,
  FileSpreadsheet,
  FileImage,
  RotateCcw,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from 'uuid';

interface DocumentUploadSectionProps {
  universeId: string;
  documents: DocumentReference[];
  onDocumentsChange: (documents: DocumentReference[]) => void;
  onReanalyze?: () => void;
  isReanalyzing?: boolean;
  industryName?: string;
}

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return <FileText className="h-3.5 w-3.5 text-red-500" />;
    case 'xlsx':
    case 'xls':
    case 'csv':
      return <FileSpreadsheet className="h-3.5 w-3.5 text-green-500" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
      return <FileImage className="h-3.5 w-3.5 text-blue-500" />;
    default:
      return <File className="h-3.5 w-3.5 text-muted-foreground" />;
  }
};

export const DocumentUploadSection = ({
  universeId,
  documents,
  onDocumentsChange,
  onReanalyze,
  isReanalyzing = false,
  industryName = 'Unknown Industry'
}: DocumentUploadSectionProps) => {
  const { registerMinorOp } = useGlobalGateCheck();
  const { updateProgress, completeOperation } = useGlobalActivityMutations();
  const [isUploading, setIsUploading] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0, successes: 0, failures: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newDocuments: DocumentReference[] = [];

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${universeId}/${uuidv4()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('universe-documents')
          .upload(fileName, file);

        if (uploadError) {
          if (uploadError.message.includes('Bucket not found')) {
            toast.error('Document storage not configured. Please contact admin.');
            continue;
          }
          throw uploadError;
        }

        const { data: urlData } = supabase.storage
          .from('universe-documents')
          .getPublicUrl(fileName);

        newDocuments.push({
          id: uuidv4(),
          name: file.name,
          url: urlData.publicUrl,
          path: fileName,
          uploaded_at: new Date().toISOString()
        });
      }

      if (newDocuments.length > 0) {
        onDocumentsChange([...documents, ...newDocuments]);
        toast.success(`${newDocuments.length} document(s) uploaded`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload document');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveDocument = (docId: string) => {
    onDocumentsChange(documents.filter(d => d.id !== docId));
    toast.success('Document removed');
  };

  const handleEnrichFromDocuments = async () => {
    const enrichableDocs = documents.filter(d => (d as any).type !== 'ma_guide');
    if (enrichableDocs.length === 0) {
      toast.error('No documents to enrich from');
      return;
    }

    setIsEnriching(true);
    setEnrichProgress({ current: 0, total: enrichableDocs.length, successes: 0, failures: 0 });
    let successes = 0;
    let failures = 0;

    // Register in global activity queue
    let queueId: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const item = await registerMinorOp({
          operationType: 'deal_enrichment',
          totalItems: enrichableDocs.length,
          description: `Document enrichment (${enrichableDocs.length} docs)`,
          userId: user.id,
        });
        queueId = item.id;
        setActiveQueueId(item.id);
      }
    } catch (e) {
      console.warn('Failed to register in activity queue:', e);
    }

    for (let i = 0; i < enrichableDocs.length; i++) {
      const doc = enrichableDocs[i];

      try {
        // Resolve the actual storage path — priority: path field > url extraction > fallback
        let storagePath: string;
        if ((doc as any).path) {
          storagePath = (doc as any).path;
        } else if (doc.url) {
          const urlParts = doc.url.split('/universe-documents/');
          storagePath = urlParts.length > 1 ? decodeURIComponent(urlParts[1]) : doc.url;
        } else {
          storagePath = `${universeId}/${doc.name}`;
        }

        console.log(`[ENRICH] Doc "${doc.name}" → storage path: "${storagePath}"`);

        const { data, error } = await supabase.functions.invoke('extract-deal-document', {
          body: {
            universe_id: universeId,
            document_url: storagePath,
            document_name: doc.name,
            industry_name: industryName,
          }
        });

        if (error) throw error;
        if (data?.success) {
          successes++;
        } else {
          failures++;
          console.error(`Extraction failed for ${doc.name}:`, data?.error);
        }
      } catch (err) {
        failures++;
        console.error(`Error enriching ${doc.name}:`, err);
      }

      setEnrichProgress({ current: i + 1, total: enrichableDocs.length, successes, failures });

      // Update activity queue progress
      if (queueId) {
        try {
          updateProgress.mutate({
            id: queueId,
            completedItems: successes + failures,
            failedItems: failures,
          });
        } catch {}
      }

      if (i < enrichableDocs.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    // Complete activity queue item
    if (queueId) {
      try {
        completeOperation.mutate({
          id: queueId,
          finalStatus: failures === enrichableDocs.length ? 'failed' : 'completed',
        });
      } catch {}
    }

    setIsEnriching(false);
    setActiveQueueId(null);
    if (successes > 0) {
      toast.success(`Enriched from ${successes} document${successes !== 1 ? 's' : ''}`);
    }
    if (failures > 0) {
      toast.error(`${failures} document${failures !== 1 ? 's' : ''} failed to process`);
    }
  };

  const truncateName = (name: string, maxLength: number = 30) => {
    if (name.length <= maxLength) return name;
    const ext = name.split('.').pop();
    const nameWithoutExt = name.slice(0, name.lastIndexOf('.'));
    const truncatedName = nameWithoutExt.slice(0, maxLength - (ext?.length || 0) - 4);
    return `${truncatedName}...${ext}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Supporting Documents</CardTitle>
            {documents.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {documents.length}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              Add Documents
            </Button>
            {onReanalyze && documents.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onReanalyze}
                disabled={isReanalyzing}
              >
                {isReanalyzing ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-1" />
                )}
                Re-analyze
              </Button>
            )}
            {documents.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnrichFromDocuments}
                disabled={isEnriching}
              >
                {isEnriching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    {enrichProgress.current}/{enrichProgress.total}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-1" />
                    Enrich from Documents
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          Upload CIMs, deal memos, or other documents for AI context during scoring
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Hidden file input */}
        <Input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
          onChange={handleFileUpload}
          disabled={isUploading}
          className="hidden"
        />

        {/* Enrichment Progress Bar */}
        {isEnriching && (
          <div className="mb-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                <span className="font-medium">Enriching from documents...</span>
              </div>
              <span className="text-muted-foreground">
                {enrichProgress.current} of {enrichProgress.total}
              </span>
            </div>
            <Progress value={enrichProgress.total > 0 ? (enrichProgress.current / enrichProgress.total) * 100 : 0} className="h-2" />
            {(enrichProgress.successes > 0 || enrichProgress.failures > 0) && (
              <div className="flex gap-3 text-xs text-muted-foreground">
                {enrichProgress.successes > 0 && <span className="text-emerald-600">{enrichProgress.successes} successful</span>}
                {enrichProgress.failures > 0 && <span className="text-destructive">{enrichProgress.failures} failed</span>}
              </div>
            )}
          </div>
        )}


        {documents.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border rounded-full hover:bg-muted transition-colors group"
              >
                {getFileIcon(doc.name)}
                <span className="text-sm font-medium max-w-[180px] truncate">
                  {truncateName(doc.name)}
                </span>
                {doc.url && (
                  <a 
                    href={doc.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <button
                  onClick={() => handleRemoveDocument(doc.id)}
                  className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {documents.length === 0 && (
          <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
            <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No documents attached yet</p>
            <p className="text-xs">Click "Add Documents" to upload files</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
