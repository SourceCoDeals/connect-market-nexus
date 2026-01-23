import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  X,
  File,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";

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
  dealInfo?: {
    company_name?: string;
    industry?: string;
    location?: string;
    revenue?: number;
    ebitda?: number;
  };
}

export function DealTranscriptSection({ dealId, transcripts, isLoading, dealInfo }: DealTranscriptSectionProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTranscript, setNewTranscript] = useState("");
  const [transcriptTitle, setTranscriptTitle] = useState("");
  const [transcriptUrl, setTranscriptUrl] = useState("");
  const [callDate, setCallDate] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [isListExpanded, setIsListExpanded] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const resetForm = () => {
    setNewTranscript("");
    setTranscriptTitle("");
    setTranscriptUrl("");
    setCallDate("");
    setSelectedFile(null);
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    const validTypes = ['.pdf', '.txt', '.doc', '.docx'];
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validTypes.includes(fileExt)) {
      toast.error('Please upload a PDF, TXT, DOC, or DOCX file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setIsUploadingFile(true);
    
    try {
      // For text files, read directly
      if (fileExt === '.txt') {
        const text = await file.text();
        setNewTranscript(text);
        toast.success('Text file loaded');
      } else {
        // For PDF/DOC, send to edge function for parsing
        const formData = new FormData();
        formData.append('file', file);

        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(
          `https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/parse-transcript-file`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
            },
            body: formData,
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to parse file');
        }

        const result = await response.json();
        setNewTranscript(result.text);
        toast.success(`Extracted ${result.text.length.toLocaleString()} characters from ${file.name}`);
      }
      
      // Auto-set title from filename if not set
      if (!transcriptTitle) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setTranscriptTitle(nameWithoutExt);
      }
    } catch (error: any) {
      console.error('File upload error:', error);
      toast.error(error.message || 'Failed to process file');
      setSelectedFile(null);
    } finally {
      setIsUploadingFile(false);
    }
  };

  // Add transcript mutation
  const addMutation = useMutation({
    mutationFn: async () => {
      // If there's a file, upload it to storage first
      let fileUrl = null;
      let fileName = null;
      
      if (selectedFile) {
        const filePath = `${dealId}/${uuidv4()}-${selectedFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('deal-transcripts')
          .upload(filePath, selectedFile);
          
        if (uploadError) {
          console.warn('File upload to storage failed:', uploadError);
          // Continue without file URL - the text is already extracted
        } else {
          const { data: urlData } = supabase.storage
            .from('deal-transcripts')
            .getPublicUrl(filePath);
          fileUrl = urlData.publicUrl;
          fileName = selectedFile.name;
        }
      }

      const { error } = await supabase
        .from('deal_transcripts')
        .insert({
          listing_id: dealId,
          transcript_text: newTranscript,
          source: transcriptUrl || (selectedFile ? 'file_upload' : 'manual'),
          title: transcriptTitle || null,
          transcript_url: transcriptUrl || fileUrl || null,
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
        body: { 
          transcriptId: transcript.id, 
          transcriptText: transcript.transcript_text,
          dealInfo
        }
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal-transcripts', dealId] });
      toast.success(`Extracted ${data.fieldsExtracted || 0} fields`);
    } catch (error: any) {
      toast.error(error.message || "Failed to extract intelligence");
    } finally {
      setProcessingId(null);
    }
  };

  // Apply extracted data to deal - expanded field mapping
  const handleApply = async (transcript: DealTranscript) => {
    if (!transcript.extracted_data) {
      toast.error("No extracted data to apply");
      return;
    }

    setApplyingId(transcript.id);
    try {
      const extracted = transcript.extracted_data as Record<string, unknown>;
      const updateData: Record<string, unknown> = {};

      // Financial fields
      if (extracted.revenue) updateData.revenue = extracted.revenue;
      if (extracted.ebitda) updateData.ebitda = extracted.ebitda;
      if (extracted.ebitda_margin) updateData.ebitda_margin = extracted.ebitda_margin;
      if (extracted.asking_price) updateData.asking_price = extracted.asking_price;
      
      // Business basics
      if (extracted.full_time_employees) updateData.full_time_employees = extracted.full_time_employees;
      if (extracted.location) updateData.location = extracted.location;
      if (extracted.headquarters_address) updateData.headquarters_address = extracted.headquarters_address;
      if (extracted.founded_year) updateData.founded_year = extracted.founded_year;
      if (extracted.industry) updateData.industry = extracted.industry;
      if (extracted.website) updateData.website = extracted.website;
      
      // Services & Business model
      if (extracted.services) updateData.services = extracted.services;
      if (extracted.service_mix) updateData.service_mix = extracted.service_mix;
      if (extracted.business_model) updateData.business_model = extracted.business_model;
      
      // Geography
      if (extracted.geographic_states) updateData.geographic_states = extracted.geographic_states;
      if (extracted.number_of_locations) updateData.number_of_locations = extracted.number_of_locations;
      
      // Owner & Transaction
      if (extracted.owner_goals) updateData.owner_goals = extracted.owner_goals;
      if (extracted.transition_preferences) updateData.transition_preferences = extracted.transition_preferences;
      if (extracted.special_requirements) updateData.special_requirements = extracted.special_requirements;
      if (extracted.timeline_notes) updateData.timeline_notes = extracted.timeline_notes;
      
      // Customers
      if (extracted.customer_types) updateData.customer_types = extracted.customer_types;
      if (extracted.end_market_description) updateData.end_market_description = extracted.end_market_description;
      
      // Strategic info
      if (extracted.executive_summary) updateData.executive_summary = extracted.executive_summary;
      if (extracted.competitive_position) updateData.competitive_position = extracted.competitive_position;
      if (extracted.growth_trajectory) updateData.growth_trajectory = extracted.growth_trajectory;
      if (extracted.key_risks) updateData.key_risks = extracted.key_risks;
      if (extracted.technology_systems) updateData.technology_systems = extracted.technology_systems;
      if (extracted.real_estate_info) updateData.real_estate_info = extracted.real_estate_info;
      
      // Contact info
      if (extracted.primary_contact_name) updateData.primary_contact_name = extracted.primary_contact_name;
      if (extracted.primary_contact_email) updateData.primary_contact_email = extracted.primary_contact_email;
      if (extracted.primary_contact_phone) updateData.primary_contact_phone = extracted.primary_contact_phone;

      const fieldsCount = Object.keys(updateData).length;
      
      if (fieldsCount > 0) {
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
      toast.success(`Applied ${fieldsCount} fields to deal`);
    } catch (error: any) {
      toast.error(error.message || "Failed to apply data");
    } finally {
      setApplyingId(null);
    }
  };

  // Render the Add Transcript Dialog content
  const renderDialogContent = () => (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Add Call Transcript</DialogTitle>
        <DialogDescription>
          Add a transcript from a call. AI will extract key information about the deal.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="e.g., Discovery Call - Jan 15"
            value={transcriptTitle}
            onChange={(e) => setTranscriptTitle(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
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
          </div>
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="transcript">Notes / Transcript Content</Label>
          <Textarea
            id="transcript"
            placeholder="Paste the call transcript or notes here..."
            value={newTranscript}
            onChange={(e) => setNewTranscript(e.target.value)}
            rows={8}
            className="font-mono text-sm"
          />
        </div>
        
        {/* File Upload Area */}
        <div 
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            isUploadingFile ? 'bg-muted/50' : 'hover:bg-muted/50'
          }`}
          onClick={() => !isUploadingFile && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.doc,.docx"
            onChange={handleFileUpload}
            className="hidden"
            disabled={isUploadingFile}
          />
          {isUploadingFile ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm">Processing file...</span>
            </div>
          ) : selectedFile ? (
            <div className="flex items-center justify-center gap-2">
              <File className="h-5 w-5 text-primary" />
              <span className="font-medium text-sm">{selectedFile.name}</span>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-6 w-6 p-0"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setSelectedFile(null);
                  setNewTranscript("");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm font-medium">Or upload a file instead</p>
              <p className="text-xs text-muted-foreground">
                Supports PDF, TXT, DOC, DOCX (max 10MB)
              </p>
            </>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => {
          setIsAddDialogOpen(false);
          resetForm();
        }}>
          Cancel
        </Button>
        <Button 
          onClick={() => addMutation.mutate()}
          disabled={!newTranscript.trim() || addMutation.isPending || isUploadingFile}
        >
          {addMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Adding...
            </>
          ) : "Add Transcript"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="py-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
      </Card>
    );
  }

  // Compact view when no transcripts
  if (transcripts.length === 0) {
    return (
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Call Transcripts
            </CardTitle>
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
              {renderDialogContent()}
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="py-2 pt-0">
          <p className="text-sm text-muted-foreground">No transcripts linked yet.</p>
        </CardContent>
      </Card>
    );
  }

  // Has transcripts - show compact expandable list
  return (
    <Card>
      <Collapsible open={isListExpanded} onOpenChange={setIsListExpanded}>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <div className="flex items-center gap-2 cursor-pointer">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Call Transcripts
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {transcripts.length}
                </Badge>
                {isListExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CollapsibleTrigger>
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
              {renderDialogContent()}
            </Dialog>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {transcripts.map((transcript) => {
              const isExpanded = expandedId === transcript.id;
              const hasExtracted = !!transcript.processed_at;
              const isApplied = transcript.applied_to_deal;
              const isProcessing = processingId === transcript.id;
              const isApplying = applyingId === transcript.id;

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
                      <div className="flex items-center justify-between p-3 hover:bg-muted/50">
                        <div className="flex items-center gap-3">
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
                          <div className="bg-primary/5 rounded-lg p-3">
                            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-primary" />
                              Extracted Intelligence
                            </h4>
                            <div className="grid gap-1 text-xs max-h-40 overflow-auto">
                              {Object.entries(transcript.extracted_data as Record<string, unknown>)
                                .filter(([key, value]) => key !== 'confidence' && value != null)
                                .map(([key, value]) => (
                                  <div key={key} className="flex justify-between gap-2">
                                    <span className="text-muted-foreground capitalize shrink-0">
                                      {key.replace(/_/g, ' ')}
                                    </span>
                                    <span className="font-medium truncate text-right">
                                      {Array.isArray(value) ? value.join(', ') : String(value)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

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
                              Extract
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
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
