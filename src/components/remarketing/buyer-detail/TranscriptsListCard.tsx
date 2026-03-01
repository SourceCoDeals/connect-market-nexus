import { useState } from "react";
import { FileText, Sparkles, Link2, Trash2, ChevronDown, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TranscriptStatusBadge } from "@/components/transcripts/TranscriptStatusBadge";
import { BuyerTranscriptLinkPanel } from "./BuyerTranscriptLinkPanel";

interface Transcript {
  id: string;
  transcript_text: string;
  source?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  processed_at?: string | null;
  extraction_status?: string | null;
  extracted_data?: Record<string, unknown> | null;
  created_at: string;
}

interface TranscriptsListCardProps {
  transcripts: Transcript[];
  buyerId: string;
  companyName?: string;
  onAddTranscript: (text: string, source: string, fileName?: string, fileUrl?: string, triggerExtract?: boolean) => Promise<unknown> | void;
  onExtract: (transcriptId: string) => void;
  onExtractAll: () => void;
  onDelete: (transcriptId: string) => void;
  
  isExtracting?: boolean;
  extractionProgress?: { current: number; total: number; isRunning: boolean };
}

export const TranscriptsListCard = ({
  transcripts,
  buyerId,
  companyName,
  onAddTranscript,
  onExtract,
  onExtractAll,
  onDelete,
  isExtracting = false,
  extractionProgress,
}: TranscriptsListCardProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pendingCount = transcripts.length;

  const getDisplayName = (transcript: Transcript): string => {
    if (transcript.file_name) return transcript.file_name;
    const source = transcript.source || "transcript";
    const date = new Date(transcript.created_at).toLocaleDateString();
    return `${source.charAt(0).toUpperCase() + source.slice(1)} - ${date}`;
  };

  const handleTranscriptLinked = () => {
    // Trigger refresh via parent - onAddTranscript with empty will be handled by parent's invalidation
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <FileText className="h-4 w-4" />
            Transcripts & Call Intelligence
          </CardTitle>
          <div className="flex items-center gap-2">
            {transcripts.length > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={onExtractAll}
                disabled={isExtracting || pendingCount === 0}
              >
                {isExtracting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {isExtracting ? 'Extracting...' : `Re-extract All (${pendingCount})`}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {extractionProgress?.isRunning && (
          <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
              <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Extracting intelligence... {extractionProgress.current}/{extractionProgress.total}
              </span>
            </div>
            <div className="w-full bg-amber-200 dark:bg-amber-800 rounded-full h-2">
              <div 
                className="bg-amber-500 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${Math.max(5, (extractionProgress.current / extractionProgress.total) * 100)}%` }} 
              />
            </div>
          </div>
        )}

        {/* Always show the 3-tab link panel (Paste Link / Upload / Search) */}
        <BuyerTranscriptLinkPanel
          buyerId={buyerId}
          companyName={companyName}
          onTranscriptLinked={handleTranscriptLinked}
          onAddTranscript={onAddTranscript}
        />

        {/* Transcript list */}
        {transcripts.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4">
            No transcripts linked yet.
          </p>
        ) : (
          <div className="space-y-2 mt-4">
            {transcripts.map((transcript) => (
              <Collapsible 
                key={transcript.id}
                open={expandedId === transcript.id}
                onOpenChange={(open) => setExpandedId(open ? transcript.id : null)}
              >
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {getDisplayName(transcript)}
                    </span>
                    <TranscriptStatusBadge 
                      processedAt={transcript.processed_at} 
                      extractionStatus={transcript.extraction_status}
                    />
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {transcript.file_url && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <a href={transcript.file_url} target="_blank" rel="noopener noreferrer">
                          <Link2 className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {!transcript.processed_at && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onExtract(transcript.id)} disabled={isExtracting}>
                        <Sparkles className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(transcript.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ChevronDown className={`h-4 w-4 transition-transform ${expandedId === transcript.id ? "rotate-180" : ""}`} />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>
                
                <CollapsibleContent>
                  <div className="mt-2 p-4 rounded-lg border bg-background">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Transcript Preview</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">{transcript.transcript_text}</p>
                    {transcript.extracted_data && Object.keys(transcript.extracted_data).length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Extracted Data</p>
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                          {JSON.stringify(transcript.extracted_data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
