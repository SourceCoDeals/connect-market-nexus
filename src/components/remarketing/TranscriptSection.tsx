import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FileText,
  Sparkles,
  Loader2,
  Check,
  Clock,
  AlertCircle,
  MapPin,
  Briefcase,
  DollarSign,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TranscriptSectionProps {
  buyerId: string;
  buyerName: string;
}

interface ExtractedData {
  thesis_updates?: string;
  target_geographies?: string[];
  target_services?: string[];
  target_revenue_min?: number;
  target_revenue_max?: number;
  target_ebitda_min?: number;
  target_ebitda_max?: number;
  geographic_footprint?: string[];
  recent_interests?: string;
  concerns?: string;
  timeline?: string;
  key_contacts_mentioned?: string[];
  summary?: string;
}

interface Transcript {
  id: string;
  transcript_text: string;
  source: string;
  extracted_data: ExtractedData;
  processed_at: string | null;
  created_at: string;
}

const SOURCE_OPTIONS = [
  { value: 'call', label: 'Phone Call' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'email', label: 'Email' },
  { value: 'other', label: 'Other' },
];

export const TranscriptSection = ({ buyerId, buyerName }: TranscriptSectionProps) => {
  const queryClient = useQueryClient();
  const [transcriptText, setTranscriptText] = useState("");
  const [source, setSource] = useState("call");

  // Fetch existing transcripts
  const { data: transcripts, isLoading } = useQuery({
    queryKey: ['remarketing', 'transcripts', buyerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('buyer_transcripts')
        .select('*')
        .eq('buyer_id', buyerId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as Transcript[];
    },
  });

  // Extract mutation
  const extractMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('extract-transcript', {
        body: {
          buyerId,
          transcriptText,
          source,
        },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'transcripts', buyerId] });
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyer', buyerId] });
      toast.success('Transcript processed successfully', {
        description: `Updated ${data.fieldsUpdated?.length || 0} fields`,
      });
      setTranscriptText("");
    },
    onError: (error: any) => {
      console.error('Extract error:', error);
      toast.error('Failed to process transcript', {
        description: error.message,
      });
    },
  });

  const formatCurrency = (value: number | undefined) => {
    if (!value) return null;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  return (
    <div className="space-y-6">
      {/* New Transcript Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Process New Transcript
          </CardTitle>
          <CardDescription>
            Paste a call transcript, meeting notes, or email to extract buyer intelligence using AI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Source Type</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transcript">Transcript Text</Label>
            <Textarea
              id="transcript"
              placeholder={`Paste your ${source === 'call' ? 'call transcript' : source === 'meeting' ? 'meeting notes' : source === 'email' ? 'email content' : 'text'} here...

Example:
"In our call today, John mentioned they're looking to expand into Texas and Florida markets. Their ideal target is $5-15M revenue with strong EBITDA margins above 15%. They're particularly interested in HVAC and plumbing companies with multiple locations..."`}
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              The AI will extract target criteria, interests, concerns, and other intelligence
            </p>
          </div>

          <Button
            onClick={() => extractMutation.mutate()}
            disabled={!transcriptText.trim() || extractMutation.isPending}
            className="w-full sm:w-auto"
          >
            {extractMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Extract Intelligence
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Transcript History */}
      <Card>
        <CardHeader>
          <CardTitle>Transcript History</CardTitle>
          <CardDescription>
            Previously processed transcripts and extracted data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : transcripts?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>No transcripts processed yet</p>
              <p className="text-sm">Paste a transcript above to get started</p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {transcripts?.map((transcript) => (
                <AccordionItem key={transcript.id} value={transcript.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <Badge variant="outline" className="capitalize">
                        {transcript.source}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(transcript.created_at).toLocaleDateString()} at{' '}
                        {new Date(transcript.created_at).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                      {transcript.processed_at && (
                        <Check className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {/* Extracted Summary */}
                      {transcript.extracted_data?.summary && (
                        <div className="bg-primary/5 p-3 rounded-lg border border-primary/10">
                          <p className="text-sm font-medium text-primary mb-1">AI Summary</p>
                          <p className="text-sm">{transcript.extracted_data.summary}</p>
                        </div>
                      )}

                      {/* Extracted Fields */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        {/* Geographies */}
                        {transcript.extracted_data?.target_geographies?.length > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              Target Geographies
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {transcript.extracted_data.target_geographies.map((geo, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {geo}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Services */}
                        {transcript.extracted_data?.target_services?.length > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                              <Briefcase className="h-3 w-3" />
                              Target Services
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {transcript.extracted_data.target_services.map((svc, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {svc}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Revenue Range */}
                        {(transcript.extracted_data?.target_revenue_min || transcript.extracted_data?.target_revenue_max) && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                              <DollarSign className="h-3 w-3" />
                              Target Revenue
                            </div>
                            <p className="text-sm">
                              {formatCurrency(transcript.extracted_data.target_revenue_min)} - {formatCurrency(transcript.extracted_data.target_revenue_max)}
                            </p>
                          </div>
                        )}

                        {/* EBITDA Range */}
                        {(transcript.extracted_data?.target_ebitda_min || transcript.extracted_data?.target_ebitda_max) && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                              <DollarSign className="h-3 w-3" />
                              Target EBITDA
                            </div>
                            <p className="text-sm">
                              {formatCurrency(transcript.extracted_data.target_ebitda_min)} - {formatCurrency(transcript.extracted_data.target_ebitda_max)}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Interests & Concerns */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        {transcript.extracted_data?.recent_interests && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Interests</p>
                            <p className="text-sm">{transcript.extracted_data.recent_interests}</p>
                          </div>
                        )}
                        {transcript.extracted_data?.concerns && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                              <AlertCircle className="h-3 w-3 text-amber-500" />
                              Concerns
                            </p>
                            <p className="text-sm">{transcript.extracted_data.concerns}</p>
                          </div>
                        )}
                      </div>

                      {/* Timeline */}
                      {transcript.extracted_data?.timeline && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Timeline
                          </p>
                          <p className="text-sm">{transcript.extracted_data.timeline}</p>
                        </div>
                      )}

                      {/* Thesis Updates */}
                      {transcript.extracted_data?.thesis_updates && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Thesis Updates</p>
                          <p className="text-sm">{transcript.extracted_data.thesis_updates}</p>
                        </div>
                      )}

                      {/* Original Transcript */}
                      <details className="group">
                        <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                          View Original Transcript
                        </summary>
                        <div className="mt-2 p-3 bg-muted/30 rounded-md">
                          <pre className="text-xs whitespace-pre-wrap font-mono">
                            {transcript.transcript_text.length > 1000 
                              ? `${transcript.transcript_text.substring(0, 1000)}...` 
                              : transcript.transcript_text}
                          </pre>
                        </div>
                      </details>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TranscriptSection;
