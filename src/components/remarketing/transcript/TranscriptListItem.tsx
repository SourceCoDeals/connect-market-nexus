import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Check,
  Trash2,
  Loader2,
  Link as LinkIcon,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { ExtractedIntelligenceView } from "./ExtractedIntelligenceView";

interface DealTranscript {
  id: string;
  listing_id: string;
  transcript_text: string;
  source: string | null;
  extracted_data: unknown;
  applied_to_deal: boolean | null;
  applied_at: string | null;
  processed_at: string | null;
  created_at: string;
  created_by?: string | null;
  updated_at?: string;
  title?: string | null;
  transcript_url?: string | null;
  call_date?: string | null;
}

interface TranscriptListItemProps {
  transcript: DealTranscript;
  isExpanded: boolean;
  onToggleExpanded: (open: boolean) => void;
  isSelected: boolean;
  onToggleSelected: (id: string, e?: React.MouseEvent) => void;
  isProcessing: boolean;
  isApplying: boolean;
  onExtract: (transcript: DealTranscript) => void;
  onApply: (transcript: DealTranscript) => void;
  onDelete: (id: string) => void;
}

export function TranscriptListItem({
  transcript,
  isExpanded,
  onToggleExpanded,
  isSelected,
  onToggleSelected,
  isProcessing,
  isApplying,
  onExtract,
  onApply,
  onDelete,
}: TranscriptListItemProps) {
  const hasExtracted = !!transcript.processed_at;
  const isApplied = transcript.applied_to_deal;

  const displayTitle = transcript.title ||
    `Transcript from ${format(new Date(transcript.created_at), 'MMM d, yyyy')}`;

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={onToggleExpanded}
    >
      <div className="border rounded-lg">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelected(transcript.id)}
                />
              </div>
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div className="text-left">
                <p className="font-medium text-sm">{displayTitle}</p>
                {transcript.call_date && (
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(transcript.call_date), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {transcript.transcript_url && (
                <a
                  href={transcript.transcript_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-primary hover:underline"
                >
                  <LinkIcon className="h-4 w-4" />
                </a>
              )}
              {hasExtracted && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Sparkles className="h-3 w-3" />
                  Extracted
                </Badge>
              )}
              {isApplied && (
                <Badge variant="default" className="gap-1 text-xs">
                  <Check className="h-3 w-3" />
                  Applied
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this transcript?')) {
                    onDelete(transcript.id);
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t p-4 space-y-4">
            <div className="bg-muted/50 rounded-lg p-3 max-h-48 overflow-auto">
              <pre className="text-xs whitespace-pre-wrap font-mono">
                {transcript.transcript_text}
              </pre>
            </div>

            {hasExtracted && transcript.extracted_data && (
              <ExtractedIntelligenceView extractedData={transcript.extracted_data as Record<string, unknown>} />
            )}

            <div className="flex items-center gap-2">
              {!hasExtracted ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onExtract(transcript)}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Extract Intelligence
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onExtract(transcript)}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Re-extract
                </Button>
              )}
              {hasExtracted && !isApplied && (
                <Button
                  size="sm"
                  onClick={() => onApply(transcript)}
                  disabled={isApplying}
                >
                  {isApplying ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Apply to Deal
                </Button>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
