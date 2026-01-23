import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Plus,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Check,
  MoreHorizontal,
  Trash2,
  Loader2,
  Link as LinkIcon,
  Calendar,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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

interface DealTranscriptSectionProps {
  dealId: string;
  transcripts: DealTranscript[];
  isLoading: boolean;
}

export function DealTranscriptSection({ dealId, transcripts, isLoading }: DealTranscriptSectionProps) {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTranscript, setNewTranscript] = useState("");
  const [transcriptTitle, setTranscriptTitle] = useState("");
  const [transcriptUrl, setTranscriptUrl] = useState("");
  const [callDate, setCallDate] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const resetForm = () => {
    setNewTranscript("");
    setTranscriptTitle("");
    setTranscriptUrl("");
    setCallDate("");
  };

  // Add transcript mutation
  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('deal_transcripts')
        .insert({
          listing_id: dealId,
          transcript_text: newTranscript,
          source: transcriptUrl || 'manual',
          title: transcriptTitle || null,
          transcript_url: transcriptUrl || null,
          call_date: callDate ? new Date(callDate).toISOString() : null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal-transcripts', dealId] });
      toast.success("Transcript added");
      resetForm();
      setIsAddDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  // Delete transcript mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('deal_transcripts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal-transcripts', dealId] });
      toast.success("Transcript deleted");
    }
  });

  // Extract intelligence from transcript
  const handleExtract = async (transcript: DealTranscript) => {
    setProcessingId(transcript.id);
    try {
      const { data, error } = await supabase.functions.invoke('extract-deal-transcript', {
        body: { transcriptId: transcript.id, transcriptText: transcript.transcript_text }
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal-transcripts', dealId] });
      toast.success("Intelligence extracted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to extract intelligence");
    } finally {
      setProcessingId(null);
    }
  };

  // Apply extracted data to deal
  const handleApply = async (transcript: DealTranscript) => {
    if (!transcript.extracted_data) {
      toast.error("No extracted data to apply");
      return;
    }

    setApplyingId(transcript.id);
    try {
      const extracted = transcript.extracted_data as any;
      const updateData: Record<string, unknown> = {};

      // Map extracted fields to listing fields
      if (extracted.revenue) updateData.revenue = extracted.revenue;
      if (extracted.ebitda) updateData.ebitda = extracted.ebitda;
      if (extracted.employees) updateData.full_time_employees = extracted.employees;
      if (extracted.location) updateData.location = extracted.location;
      
      // Additional fields from transcript extraction
      if (extracted.owner_goals) updateData.owner_goals = extracted.owner_goals;
      if (extracted.special_requirements) updateData.special_requirements = extracted.special_requirements;
      if (extracted.customer_types) updateData.customer_types = extracted.customer_types;
      if (extracted.service_mix) updateData.service_mix = extracted.service_mix;
      if (extracted.geographic_states) updateData.geographic_states = extracted.geographic_states;
      if (extracted.founded) updateData.founded_year = parseInt(extracted.founded);
      if (extracted.industry) updateData.industry = extracted.industry;
      if (extracted.timeline) updateData.timeline_notes = extracted.timeline;

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from('listings')
          .update(updateData)
          .eq('id', dealId);

        if (error) throw error;
      }

      // Mark as applied
      await supabase
        .from('deal_transcripts')
        .update({ applied_to_deal: true, applied_at: new Date().toISOString() })
        .eq('id', transcript.id);

      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal', dealId] });
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal-transcripts', dealId] });
      toast.success("Data applied to deal");
    } catch (error: any) {
      toast.error(error.message || "Failed to apply data");
    } finally {
      setApplyingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Call Transcripts
            </CardTitle>
            <CardDescription>
              Upload call transcripts to extract deal intelligence
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Transcript
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Call Transcript</DialogTitle>
                <DialogDescription>
                  Add a transcript from a call. AI will extract key information about the deal.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Discovery Call - Jan 15"
                    value={transcriptTitle}
                    onChange={(e) => setTranscriptTitle(e.target.value)}
                  />
                </div>

                {/* Transcript Link URL */}
                <div className="space-y-2">
                  <Label htmlFor="transcriptUrl" className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    Transcript Link URL
                  </Label>
                  <Input
                    id="transcriptUrl"
                    placeholder="e.g., https://app.fireflies.ai/view/..."
                    value={transcriptUrl}
                    onChange={(e) => setTranscriptUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional: Link to Fireflies, Otter, or other transcript source
                  </p>
                </div>

                {/* Call Date */}
                <div className="space-y-2">
                  <Label htmlFor="callDate" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Call Date
                  </Label>
                  <Input
                    id="callDate"
                    type="date"
                    value={callDate}
                    onChange={(e) => setCallDate(e.target.value)}
                  />
                </div>

                {/* Transcript Text */}
                <div className="space-y-2">
                  <Label htmlFor="transcript">Notes / Transcript Content</Label>
                  <Textarea
                    id="transcript"
                    placeholder="Paste the call transcript or notes here..."
                    value={newTranscript}
                    onChange={(e) => setNewTranscript(e.target.value)}
                    rows={10}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Tip: Include key details like revenue, EBITDA, owner goals, timeline, and special requirements
                  </p>
                </div>

                {/* File Upload Placeholder */}
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Or upload a file instead
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Coming soon: .txt, .docx file upload
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => addMutation.mutate()}
                  disabled={!newTranscript.trim() || addMutation.isPending}
                >
                  {addMutation.isPending ? "Adding..." : "Add Transcript"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {transcripts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No transcripts uploaded yet</p>
            <p className="text-sm">Add a call transcript to extract deal intelligence</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transcripts.map((transcript) => {
              const isExpanded = expandedId === transcript.id;
              const hasExtracted = !!transcript.processed_at;
              const isApplied = transcript.applied_to_deal;
              const isProcessing = processingId === transcript.id;
              const isApplying = applyingId === transcript.id;

              // Display title or fallback
              const displayTitle = transcript.title || 
                `Transcript from ${format(new Date(transcript.created_at), 'MMM d, yyyy')}`;

              return (
                <Collapsible
                  key={transcript.id}
                  open={isExpanded}
                  onOpenChange={(open) => setExpandedId(open ? transcript.id : null)}
                >
                  <div className="border rounded-lg">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-4 hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div className="text-left">
                            <p className="font-medium">{displayTitle}</p>
                            {transcript.call_date && (
                              <p className="text-xs text-muted-foreground">
                                Call date: {format(new Date(transcript.call_date), 'MMM d, yyyy')}
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground">
                              {transcript.transcript_text.substring(0, 80)}...
                            </p>
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
                            <Badge variant="secondary" className="gap-1">
                              <Sparkles className="h-3 w-3" />
                              Extracted
                            </Badge>
                          )}
                          {isApplied && (
                            <Badge variant="default" className="gap-1">
                              <Check className="h-3 w-3" />
                              Applied
                            </Badge>
                          )}
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
                        {/* Transcript text */}
                        <div className="bg-muted/50 rounded-lg p-4 max-h-64 overflow-auto">
                          <pre className="text-sm whitespace-pre-wrap font-mono">
                            {transcript.transcript_text}
                          </pre>
                        </div>

                        {/* Extracted data preview */}
                        {hasExtracted && transcript.extracted_data && (
                          <div className="bg-primary/5 rounded-lg p-4">
                            <h4 className="font-medium mb-2 flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-primary" />
                              Extracted Intelligence
                            </h4>
                            <div className="grid gap-2 text-sm">
                              {Object.entries(transcript.extracted_data as Record<string, unknown>).map(([key, value]) => (
                                <div key={key} className="flex justify-between">
                                  <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                                  <span className="font-medium">{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {!hasExtracted && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleExtract(transcript)}
                              disabled={isProcessing}
                            >
                              {isProcessing ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Sparkles className="h-4 w-4 mr-2" />
                              )}
                              Extract Intelligence
                            </Button>
                          )}
                          {hasExtracted && !isApplied && (
                            <Button 
                              size="sm"
                              onClick={() => handleApply(transcript)}
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => {
                                  if (confirm('Delete this transcript?')) {
                                    deleteMutation.mutate(transcript.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
