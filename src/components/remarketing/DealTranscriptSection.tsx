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
  RefreshCw,
  DollarSign,
  MapPin,
  Users,
  Building,
  Target,
  Quote,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Card as ProgressCard, CardContent as ProgressCardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SingleDealEnrichmentDialog, type SingleDealEnrichmentResult } from "./SingleDealEnrichmentDialog";
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
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentResult, setEnrichmentResult] = useState<SingleDealEnrichmentResult | null>(null);
  const [showEnrichmentDialog, setShowEnrichmentDialog] = useState(false);
  const [enrichmentPhase, setEnrichmentPhase] = useState<'transcripts' | 'website' | null>(null);
  const [enrichmentProgress, setEnrichmentProgress] = useState({ current: 0, total: 0 });
  // Enrich deal with AI
  const handleEnrichDeal = async (forceReExtract = false) => {
    setIsEnriching(true);
    setEnrichmentResult(null);
    
    const totalTranscripts = transcripts.length;
    const unprocessedTranscripts = transcripts.filter(t => !t.processed_at);
    const totalToProcess = forceReExtract ? totalTranscripts : unprocessedTranscripts.length;

    setEnrichmentPhase(totalTranscripts > 0 ? 'transcripts' : 'website');
    setEnrichmentProgress({ current: 0, total: totalToProcess });

    // Poll deal_transcripts for real-time progress during enrichment
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    if (totalToProcess > 0) {
      pollInterval = setInterval(async () => {
        try {
          const { data: updated } = await supabase
            .from('deal_transcripts')
            .select('id, processed_at, extracted_data')
            .eq('listing_id', dealId);
          if (updated) {
            const processed = updated.filter(t => t.processed_at && t.extracted_data).length;
            const remaining = totalToProcess - Math.min(processed, totalToProcess);
            setEnrichmentProgress(prev => ({
              ...prev,
              current: processed,
            }));
            // Switch to website phase when all transcripts are done
            if (processed >= totalToProcess) {
              setEnrichmentPhase('website');
            }
          }
        } catch {
          // Non-critical polling failure, ignore
        }
      }, 2000);
    }
    
    try {
      // Scale timeout based on transcript count: 30s base + 25s per transcript + 30s for website scrape
      const dynamicTimeout = Math.max(180000, 30000 + (totalToProcess * 25000) + 30000);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), dynamicTimeout);
      
      const { data, error } = await supabase.functions.invoke('enrich-deal', {
        body: { dealId, forceReExtract }
      });
      
      clearTimeout(timeoutId);
      if (pollInterval) clearInterval(pollInterval);
      
      if (error) throw error;
      
      const result: SingleDealEnrichmentResult = {
        success: true,
        message: data?.message || 'Deal enriched successfully',
        fieldsUpdated: data?.fieldsUpdated || [],
        extracted: data?.extracted,
        scrapeReport: data?.scrapeReport,
        transcriptReport: data?.transcriptReport,
      };
      
      setEnrichmentResult(result);
      setShowEnrichmentDialog(true);
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal', dealId] });
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal-transcripts', dealId] });
    } catch (error: any) {
      if (pollInterval) clearInterval(pollInterval);
      console.error('Enrich error:', error);
      
      const errorMessage = error.message || '';
      const isTimeout = errorMessage.includes('Failed to send') || 
                        errorMessage.includes('timeout') ||
                        errorMessage.includes('aborted') ||
                        errorMessage.includes('network');
      
      if (isTimeout) {
        queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal', dealId] });
        queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal-transcripts', dealId] });
        
        const result: SingleDealEnrichmentResult = {
          success: false,
          error: 'The enrichment request timed out, but it may still be processing. Please refresh in a moment to check results.',
        };
        setEnrichmentResult(result);
        setShowEnrichmentDialog(true);
      } else {
        const result: SingleDealEnrichmentResult = {
          success: false,
          error: errorMessage || 'Failed to enrich deal. Please try again.',
        };
        setEnrichmentResult(result);
        setShowEnrichmentDialog(true);
      }
    } finally {
      if (pollInterval) clearInterval(pollInterval);
      setIsEnriching(false);
      setEnrichmentPhase(null);
      setEnrichmentProgress({ current: 0, total: 0 });
    }
  };
  const [selectedFiles, setSelectedFiles] = useState<{file: File; title: string; status: 'pending' | 'processing' | 'done' | 'error'; text?: string}[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isMultiFileMode, setIsMultiFileMode] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });

  const resetForm = () => {
    setNewTranscript("");
    setTranscriptTitle("");
    setTranscriptUrl("");
    setCallDate("");
    setSelectedFiles([]);
    setIsMultiFileMode(false);
  };

  // Handle multiple file uploads
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const validTypes = ['.pdf', '.txt', '.doc', '.docx', '.vtt', '.srt'];
    const newFiles: typeof selectedFiles = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (!validTypes.includes(fileExt)) {
        toast.error(`${file.name}: unsupported file type`);
        continue;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: file too large (max 10MB)`);
        continue;
      }
      
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      newFiles.push({ file, title: nameWithoutExt, status: 'pending' });
    }
    
    if (newFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...newFiles]);
      setIsMultiFileMode(true);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Small delay to yield to UI thread
  const yieldToUI = () => new Promise(resolve => setTimeout(resolve, 50));

  // Process a single file to extract text with retry logic for rate limits
  const processFileText = async (file: File, retryCount = 0): Promise<string> => {
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (['.txt', '.vtt', '.srt'].includes(fileExt)) {
      return await file.text();
    } else {
      // For PDF/DOC, use the edge function
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

      // Handle rate limits with retry (longer delays for Gemini)
      if (response.status === 429 && retryCount < 5) {
        const waitTime = Math.pow(2, retryCount) * 3000; // 3s, 6s, 12s, 24s, 48s
        toast.info(`Rate limited, retrying ${file.name} in ${Math.round(waitTime/1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return processFileText(file, retryCount + 1);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Parse error for ${file.name}:`, errorText);
        throw new Error(`Failed to parse ${file.name} (${response.status})`);
      }

      const result = await response.json();
      return result.text || '';
    }
  };

  // Add transcript mutation - handles both single and multiple files
  const addMutation = useMutation({
    mutationFn: async () => {
      // Multi-file mode
      if (isMultiFileMode && selectedFiles.length > 0) {
        let successCount = 0;
        const totalFiles = selectedFiles.length;
        setProcessingProgress({ current: 0, total: totalFiles });
        
        for (let i = 0; i < selectedFiles.length; i++) {
          const sf = selectedFiles[i];
          
          // Add delay between files to avoid rate-limiting the AI parser
          if (i > 0) {
            await new Promise(r => setTimeout(r, 2000));
          }
          await yieldToUI();
          
          try {
            // Update status and progress
            setSelectedFiles(prev => prev.map((f, idx) => 
              idx === i ? { ...f, status: 'processing' as const } : f
            ));
            setProcessingProgress({ current: i + 1, total: totalFiles });

            // Extract text from file (has built-in retry for rate limits)
            let transcriptText = '';
            try {
              transcriptText = await processFileText(sf.file);
            } catch (parseErr: any) {
              console.warn(`Text extraction failed for ${sf.file.name}:`, parseErr.message);
              // Continue anyway - we'll save the file without extracted text
            }

            // Upload to storage
            const filePath = `${dealId}/${uuidv4()}-${sf.file.name}`;
            let fileUrl = null;
            
            const { error: uploadError } = await supabase.storage
              .from('deal-transcripts')
              .upload(filePath, sf.file);
              
            if (!uploadError) {
              const { data: urlData } = supabase.storage
                .from('deal-transcripts')
                .getPublicUrl(filePath);
              fileUrl = urlData.publicUrl;
            }

            // Insert transcript record in deal_transcripts table
            // Ensure we never save empty transcript_text (frontend validation expects non-empty)
            const safeTranscriptText = (transcriptText || '').trim().length > 0
              ? transcriptText
              : `[File uploaded: ${sf.file.name} — text extraction pending/failed]`;

            const { error } = await supabase
              .from('deal_transcripts')
              .insert({
                listing_id: dealId,
                transcript_text: safeTranscriptText,
                source: 'file_upload',
                title: sf.title.trim() || sf.file.name,
                transcript_url: fileUrl,
                call_date: callDate ? new Date(callDate).toISOString() : null,
              });

            if (error) throw error;
            
            setSelectedFiles(prev => prev.map((f, idx) => 
              idx === i ? { ...f, status: 'done' as const } : f
            ));
            successCount++;
          } catch (err: any) {
            console.error(`Error processing ${sf.file.name}:`, err);
            setSelectedFiles(prev => prev.map((f, idx) => 
              idx === i ? { ...f, status: 'error' as const } : f
            ));
          }
          
          // Small delay between files to prevent API rate limits
          if (i < selectedFiles.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        
        setProcessingProgress({ current: 0, total: 0 });
        if (successCount === 0) throw new Error('No files were uploaded successfully');
        return { count: successCount, failed: totalFiles - successCount };
      }
      
      // Single transcript mode (pasted text or link)
      const safeSingleText = (newTranscript || '').trim().length > 0
        ? newTranscript
        : (transcriptUrl ? `[Transcript link added: ${transcriptUrl}]` : '');

      if (!safeSingleText) {
        throw new Error('Transcript content cannot be empty');
      }

      const { error } = await supabase
        .from('deal_transcripts')
        .insert({
          listing_id: dealId,
          transcript_text: safeSingleText,
          source: transcriptUrl || 'manual',
          title: transcriptTitle || null,
          transcript_url: transcriptUrl || null,
          call_date: callDate ? new Date(callDate).toISOString() : null,
        });

      if (error) throw error;
      return { count: 1 };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal-transcripts', dealId] });
      const msg = data?.count && data.count > 1 
        ? `${data.count} transcripts added${data.failed ? ` (${data.failed} failed)` : ''}`
        : "Transcript added";
      toast.success(msg);
      resetForm();
      setIsAddDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setProcessingProgress({ current: 0, total: 0 });
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

  // Extract intelligence from transcript - now automatically applies to deal per spec
  const handleExtract = async (transcript: DealTranscript) => {
    setProcessingId(transcript.id);
    try {
      const { data, error } = await supabase.functions.invoke('extract-deal-transcript', {
        body: { 
          transcriptId: transcript.id, 
          transcriptText: transcript.transcript_text,
          dealInfo,
          applyToDeal: true // Automatically apply to listing per spec
        }
      });

      if (error) throw error;

      // Invalidate both transcript and deal queries since we now update the listing
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal-transcripts', dealId] });
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal', dealId] });
      
      // Show detailed success message per spec
      if (data.dealUpdated && data.fieldsUpdated?.length > 0) {
        toast.success(`Extracted ${data.fieldsExtracted || 0} fields and updated deal with: ${data.fieldsUpdated.slice(0, 3).join(', ')}${data.fieldsUpdated.length > 3 ? ` +${data.fieldsUpdated.length - 3} more` : ''}`);
      } else {
        toast.success(`Extracted ${data.fieldsExtracted || 0} fields from transcript`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to extract intelligence");
    } finally {
      setProcessingId(null);
    }
  };

  // Helper to format currency
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  };

  // Helper to merge arrays (deduped)
  const mergeArrays = (existing: string[] | null | undefined, newItems: string[] | null | undefined): string[] | undefined => {
    if (!newItems || newItems.length === 0) return undefined;
    const combined = [...(existing || []), ...newItems];
    return [...new Set(combined)];
  };

  // Apply extracted data to deal - with smart merge for arrays
  const handleApply = async (transcript: DealTranscript) => {
    if (!transcript.extracted_data) {
      toast.error("No extracted data to apply");
      return;
    }

    setApplyingId(transcript.id);
    try {
      // Fetch current deal data first for merging arrays
      const { data: currentDeal } = await supabase
        .from('listings')
        .select('*')
        .eq('id', dealId)
        .single();
      
      const currentData = currentDeal as Record<string, unknown> | null;

      const extracted = transcript.extracted_data as Record<string, unknown>;
      const updateData: Record<string, unknown> = {};

      // VALID COLUMNS in listings table (verified against schema):
      // Financial, Business, Geography, Strategic, Contact fields
      
      // Track what we're applying for detailed feedback
      const appliedFields: string[] = [];
      const skippedFields: string[] = [];
      
      // Financial fields
      if (extracted.revenue) { updateData.revenue = extracted.revenue; appliedFields.push('Revenue'); }
      if (extracted.ebitda) { updateData.ebitda = extracted.ebitda; appliedFields.push('EBITDA'); }
      // Note: ebitda_margin, asking_price are NOT in schema - store in general_notes if important
      
      // Business basics
      if (extracted.full_time_employees) { updateData.full_time_employees = extracted.full_time_employees; appliedFields.push('Employees'); }
      if (extracted.location) { updateData.location = extracted.location; appliedFields.push('Location'); }
      if (extracted.founded_year) { updateData.founded_year = extracted.founded_year; appliedFields.push('Founded Year'); }
      if (extracted.industry) { updateData.industry = extracted.industry; appliedFields.push('Industry'); }
      if (extracted.website) { updateData.website = extracted.website; appliedFields.push('Website'); }
      // Note: headquarters_address maps to 'address'
      if (extracted.headquarters_address) { updateData.address = extracted.headquarters_address; appliedFields.push('Address'); }
      
      // Services & Business model
      if (extracted.service_mix) { updateData.service_mix = extracted.service_mix; appliedFields.push('Service Mix'); }
      if (extracted.business_model) { updateData.business_model = extracted.business_model; appliedFields.push('Business Model'); }
      
      // Services array (now has column!)
      const mergedServices = mergeArrays(
        currentData?.services as string[] | undefined, 
        extracted.services as string[] | undefined
      );
      if (mergedServices) { updateData.services = mergedServices; appliedFields.push('Services'); }
      
      // Geography - normalize state codes to uppercase 2-letter format
      let extractedStates = extracted.geographic_states as string[] | undefined;
      if (extractedStates) {
        // Map full state names to abbreviations if needed
        const stateNameToCode: Record<string, string> = {
          'minnesota': 'MN', 'texas': 'TX', 'california': 'CA', 'florida': 'FL',
          'arizona': 'AZ', 'new york': 'NY', 'illinois': 'IL', 'ohio': 'OH',
          'georgia': 'GA', 'pennsylvania': 'PA', 'michigan': 'MI', 'washington': 'WA',
          'colorado': 'CO', 'north carolina': 'NC', 'virginia': 'VA', 'tennessee': 'TN',
          'indiana': 'IN', 'missouri': 'MO', 'wisconsin': 'WI', 'maryland': 'MD',
          'massachusetts': 'MA', 'oregon': 'OR', 'oklahoma': 'OK', 'utah': 'UT',
          'nevada': 'NV', 'new jersey': 'NJ', 'kentucky': 'KY', 'louisiana': 'LA',
          'alabama': 'AL', 'south carolina': 'SC', 'iowa': 'IA', 'connecticut': 'CT',
          'arkansas': 'AR', 'kansas': 'KS', 'mississippi': 'MS', 'nebraska': 'NE',
          'new mexico': 'NM', 'idaho': 'ID', 'west virginia': 'WV', 'maine': 'ME',
          'new hampshire': 'NH', 'hawaii': 'HI', 'rhode island': 'RI', 'montana': 'MT',
          'delaware': 'DE', 'south dakota': 'SD', 'north dakota': 'ND', 'alaska': 'AK',
          'vermont': 'VT', 'wyoming': 'WY'
        };
        extractedStates = extractedStates.map(s => {
          const lower = s.toLowerCase().trim();
          if (stateNameToCode[lower]) return stateNameToCode[lower];
          if (s.length === 2) return s.toUpperCase();
          return s;
        }).filter(s => s.length === 2);
      }
      const mergedStates = mergeArrays(
        currentData?.geographic_states as string[] | undefined, 
        extractedStates
      );
      if (mergedStates) { updateData.geographic_states = mergedStates; appliedFields.push('Geographic States'); }
      if (extracted.number_of_locations) { updateData.number_of_locations = extracted.number_of_locations; appliedFields.push('# of Locations'); }
      
      // Owner & Transaction
      if (extracted.owner_goals) { updateData.owner_goals = extracted.owner_goals; appliedFields.push('Owner Goals'); }
      if (extracted.special_requirements) { updateData.special_requirements = extracted.special_requirements; appliedFields.push('Special Requirements'); }
      // Note: transition_preferences, timeline_notes are NOT in schema
      
      // Customers
      if (extracted.customer_types) { updateData.customer_types = extracted.customer_types; appliedFields.push('Customer Types'); }
      // Note: end_market_description is NOT in schema
      
      // Strategic info
      if (extracted.executive_summary) { updateData.executive_summary = extracted.executive_summary; appliedFields.push('Executive Summary'); }
      if (extracted.competitive_position) { updateData.competitive_position = extracted.competitive_position; appliedFields.push('Competitive Position'); }
      if (extracted.growth_trajectory) { updateData.growth_trajectory = extracted.growth_trajectory; appliedFields.push('Growth Trajectory'); }
      if (extracted.key_risks) { updateData.key_risks = extracted.key_risks; appliedFields.push('Key Risks'); }
      if (extracted.technology_systems) { updateData.technology_systems = extracted.technology_systems; appliedFields.push('Technology'); }
      if (extracted.real_estate_info) { updateData.real_estate_info = extracted.real_estate_info; appliedFields.push('Real Estate'); }
      
      // Contact info
      if (extracted.primary_contact_name) { updateData.primary_contact_name = extracted.primary_contact_name; appliedFields.push('Contact Name'); }
      if (extracted.primary_contact_email) { updateData.primary_contact_email = extracted.primary_contact_email; appliedFields.push('Contact Email'); }
      if (extracted.primary_contact_phone) { updateData.primary_contact_phone = extracted.primary_contact_phone; appliedFields.push('Contact Phone'); }
      
      // Key Quotes (now has column!)
      const safeQuotesForMerge = Array.isArray(extracted.key_quotes) ? extracted.key_quotes : (typeof extracted.key_quotes === 'string' && extracted.key_quotes ? [extracted.key_quotes] : undefined);
      const mergedQuotes = mergeArrays(
        currentData?.key_quotes as string[] | undefined, 
        safeQuotesForMerge
      );
      if (mergedQuotes) { updateData.key_quotes = mergedQuotes; appliedFields.push('Key Quotes'); }
      
      // Build general_notes with extra extracted data that doesn't have a column
      const extraNotes: string[] = [];
      if (extracted.ebitda_margin) { extraNotes.push(`EBITDA Margin: ${((extracted.ebitda_margin as number) * 100).toFixed(1)}%`); skippedFields.push('EBITDA Margin'); }
      if (extracted.asking_price) { extraNotes.push(`Asking Price: $${(extracted.asking_price as number).toLocaleString()}`); skippedFields.push('Asking Price'); }
      if (extracted.transition_preferences) { extraNotes.push(`Transition: ${extracted.transition_preferences}`); skippedFields.push('Transition'); }
      if (extracted.timeline_notes) { extraNotes.push(`Timeline: ${extracted.timeline_notes}`); skippedFields.push('Timeline'); }
      if (extracted.end_market_description) { extraNotes.push(`End Market: ${extracted.end_market_description}`); skippedFields.push('End Market'); }
      
      if (extraNotes.length > 0) {
        const existingNotes = (currentData?.general_notes as string) || '';
        const newNotesBlock = `\n\n--- Extracted from Transcript (${new Date().toLocaleDateString()}) ---\n${extraNotes.join('\n')}`;
        updateData.general_notes = existingNotes + newNotesBlock;
      }

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
      
      // Show detailed feedback
      toast.success(
        <div className="space-y-1">
          <p className="font-medium">Applied {appliedFields.length} fields to deal</p>
          <p className="text-xs text-muted-foreground">
            {appliedFields.slice(0, 4).join(', ')}
            {appliedFields.length > 4 && ` +${appliedFields.length - 4} more`}
          </p>
        </div>
      );
      
      if (skippedFields.length > 0) {
        toast.info(`${skippedFields.length} fields added to notes: ${skippedFields.join(', ')}`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to apply data");
    } finally {
      setApplyingId(null);
    }
  };

  // Render extracted intelligence in a structured, readable format
  const renderExtractedIntelligence = (extractedData: Record<string, unknown>) => {
    const extracted = extractedData;
    const hasFinancial = extracted.revenue || extracted.ebitda || extracted.ebitda_margin || extracted.asking_price;
    const hasBusiness = extracted.industry || extracted.location || extracted.full_time_employees || extracted.founded_year;
    const hasServices = (extracted.services as string[] | undefined)?.length || extracted.service_mix || extracted.business_model;
    const hasGeography = (extracted.geographic_states as string[] | undefined)?.length || extracted.number_of_locations;
    const hasOwner = extracted.owner_goals || extracted.transition_preferences || extracted.timeline_notes;
    const hasStrategic = extracted.executive_summary || extracted.competitive_position || extracted.growth_trajectory || extracted.key_risks;
    const safeKeyQuotes = Array.isArray(extracted.key_quotes) ? extracted.key_quotes : (typeof extracted.key_quotes === 'string' && extracted.key_quotes ? [extracted.key_quotes] : []);
    const hasQuotes = safeKeyQuotes.length;
    
    const fieldCount = Object.entries(extracted)
      .filter(([key, value]) => key !== 'confidence' && value != null && 
        (Array.isArray(value) ? value.length > 0 : true))
      .length;

    return (
      <div className="bg-primary/5 rounded-lg p-4">
        <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Extracted Intelligence
          <Badge variant="secondary" className="text-xs">
            {fieldCount} fields
          </Badge>
        </h4>
        
        <div className="space-y-4 text-sm">
          {/* Financial Section */}
          {hasFinancial && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <DollarSign className="h-3 w-3" />
                Financial
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {extracted.revenue && (
                  <div className="bg-background rounded p-2">
                    <p className="text-xs text-muted-foreground">Revenue</p>
                    <p className="font-semibold">{formatCurrency(extracted.revenue as number)}</p>
                  </div>
                )}
                {extracted.ebitda && (
                  <div className="bg-background rounded p-2">
                    <p className="text-xs text-muted-foreground">EBITDA</p>
                    <p className="font-semibold">{formatCurrency(extracted.ebitda as number)}</p>
                  </div>
                )}
                {extracted.ebitda_margin && (
                  <div className="bg-background rounded p-2">
                    <p className="text-xs text-muted-foreground">Margin</p>
                    <p className="font-semibold">{((extracted.ebitda_margin as number) * 100).toFixed(1)}%</p>
                  </div>
                )}
                {extracted.asking_price && (
                  <div className="bg-background rounded p-2">
                    <p className="text-xs text-muted-foreground">Asking Price</p>
                    <p className="font-semibold">{formatCurrency(extracted.asking_price as number)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Business Basics Section */}
          {hasBusiness && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <Building className="h-3 w-3" />
                Business
              </div>
              <div className="grid grid-cols-2 gap-2">
                {extracted.industry && (
                  <div>
                    <span className="text-muted-foreground">Industry:</span>{' '}
                    <span className="font-medium">{extracted.industry as string}</span>
                  </div>
                )}
                {extracted.location && (
                  <div>
                    <span className="text-muted-foreground">Location:</span>{' '}
                    <span className="font-medium">{extracted.location as string}</span>
                  </div>
                )}
                {extracted.full_time_employees && (
                  <div>
                    <span className="text-muted-foreground">Employees:</span>{' '}
                    <span className="font-medium">{extracted.full_time_employees as number}</span>
                  </div>
                )}
                {extracted.founded_year && (
                  <div>
                    <span className="text-muted-foreground">Founded:</span>{' '}
                    <span className="font-medium">{extracted.founded_year as number}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Services Section */}
          {hasServices && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <Users className="h-3 w-3" />
                Services & Model
              </div>
              {(extracted.services as string[] | undefined)?.length ? (
                <div className="flex flex-wrap gap-1">
                  {(extracted.services as string[]).map((service, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {service}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {extracted.service_mix && (
                <p><span className="text-muted-foreground">Mix:</span> {extracted.service_mix as string}</p>
              )}
              {extracted.business_model && (
                <p><span className="text-muted-foreground">Model:</span> {extracted.business_model as string}</p>
              )}
            </div>
          )}

          {/* Geography Section */}
          {hasGeography && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <MapPin className="h-3 w-3" />
                Geography
              </div>
              <div className="flex flex-wrap gap-1 items-center">
                {(extracted.geographic_states as string[] | undefined)?.map((state, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {state}
                  </Badge>
                ))}
                {extracted.number_of_locations && (
                  <span className="text-sm ml-2">
                    ({extracted.number_of_locations as number} locations)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Owner Goals Section */}
          {hasOwner && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <Target className="h-3 w-3" />
                Owner & Transaction
              </div>
              {extracted.owner_goals && (
                <p><span className="text-muted-foreground">Goals:</span> {extracted.owner_goals as string}</p>
              )}
              {extracted.transition_preferences && (
                <p><span className="text-muted-foreground">Transition:</span> {extracted.transition_preferences as string}</p>
              )}
              {extracted.timeline_notes && (
                <p><span className="text-muted-foreground">Timeline:</span> {extracted.timeline_notes as string}</p>
              )}
            </div>
          )}

          {/* Strategic Summary */}
          {hasStrategic && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <Sparkles className="h-3 w-3" />
                Strategic
              </div>
              {extracted.executive_summary && (
                <p className="bg-background rounded p-2 text-sm">{extracted.executive_summary as string}</p>
              )}
              {extracted.competitive_position && (
                <p><span className="text-muted-foreground">Competitive Position:</span> {extracted.competitive_position as string}</p>
              )}
              {extracted.growth_trajectory && (
                <p><span className="text-muted-foreground">Growth:</span> {extracted.growth_trajectory as string}</p>
              )}
              {extracted.key_risks && (
                <p className="flex items-start gap-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                  <span><span className="text-muted-foreground">Risks:</span> {extracted.key_risks as string}</span>
                </p>
              )}
            </div>
          )}

          {/* Key Quotes */}
          {hasQuotes && (
            <div className="space-y-1.5 border-t pt-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <Quote className="h-3 w-3" />
                Key Quotes
              </div>
              <div className="space-y-2">
                {safeKeyQuotes.map((quote: string, i: number) => (
                  <blockquote 
                    key={i} 
                    className="text-sm italic border-l-2 border-primary/30 pl-3 text-muted-foreground"
                  >
                    "{quote}"
                  </blockquote>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
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
            addMutation.isPending ? 'bg-muted/50 cursor-not-allowed' : 'hover:bg-muted/50'
          }`}
          onClick={() => !addMutation.isPending && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.doc,.docx,.vtt,.srt"
            onChange={handleFileUpload}
            className="hidden"
            disabled={addMutation.isPending}
            multiple
          />
          <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
          <p className="text-sm font-medium">
            {selectedFiles.length > 0 ? 'Add more files' : 'Or upload files instead'}
          </p>
          <p className="text-xs text-muted-foreground">
            Supports PDF, TXT, DOC, DOCX, VTT, SRT (max 10MB each) • Select multiple files
          </p>
        </div>
        
        {/* Selected Files List */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{selectedFiles.length} file(s) selected</span>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-6 text-xs"
                onClick={() => setSelectedFiles([])}
                disabled={addMutation.isPending}
              >
                Clear all
              </Button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {selectedFiles.map((sf, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm bg-background rounded p-2">
                  {sf.status === 'processing' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : sf.status === 'done' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : sf.status === 'error' ? (
                    <X className="h-4 w-4 text-destructive" />
                  ) : (
                    <File className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Input
                    value={sf.title}
                    onChange={(e) => setSelectedFiles(prev => 
                      prev.map((f, i) => i === idx ? { ...f, title: e.target.value } : f)
                    )}
                    className="h-7 text-sm flex-1"
                    disabled={addMutation.isPending}
                    placeholder="Title"
                  />
                  <span className="text-xs text-muted-foreground truncate max-w-24">
                    {sf.file.name}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                    disabled={addMutation.isPending}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
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
          disabled={(isMultiFileMode ? selectedFiles.length === 0 : !newTranscript.trim()) || addMutation.isPending}
        >
          {addMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {processingProgress.total > 1 
                ? `Processing ${processingProgress.current}/${processingProgress.total}...` 
                : 'Adding...'}
            </>
          ) : selectedFiles.length > 1 ? `Add ${selectedFiles.length} Transcripts` : "Add Transcript"}
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
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="gap-2"
                    disabled={isEnriching}
                  >
                    {isEnriching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Enrich
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEnrichDeal(false)}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Enrich New Only
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleEnrichDeal(true)}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Re-extract All Transcripts
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
          </div>
        </CardHeader>
        
        {/* Progress indicator during enrichment */}
        {isEnriching && (
          <CardContent className="py-3 pt-0">
            <ProgressCard className="border-primary/30 bg-primary/5">
              <ProgressCardContent className="py-3">
                <div className="flex items-center gap-3">
                  <Zap className="h-4 w-4 text-primary animate-pulse flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="font-medium text-sm">
                        {enrichmentPhase === 'transcripts'
                          ? 'Processing transcripts...'
                          : 'Scraping website...'}
                      </p>
                      {enrichmentProgress.total > 0 && enrichmentPhase === 'transcripts' && (
                        <span className="text-xs font-medium text-primary">
                          {enrichmentProgress.current}/{enrichmentProgress.total}
                        </span>
                      )}
                    </div>
                    <Progress
                      value={
                        enrichmentProgress.total > 0
                          ? (enrichmentProgress.current / enrichmentProgress.total) * 100
                          : undefined
                      }
                      className="h-1.5"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {enrichmentPhase === 'transcripts' && enrichmentProgress.total > 0
                        ? `Extracting intelligence from ${enrichmentProgress.total} transcript${enrichmentProgress.total > 1 ? 's' : ''}`
                        : enrichmentPhase === 'website' ? 'Scraping website pages...' : 'Extracting deal intelligence'}
                    </p>
                  </div>
                </div>
              </ProgressCardContent>
            </ProgressCard>
          </CardContent>
        )}
        
        <CardContent className="py-2 pt-0">
          <p className="text-sm text-muted-foreground">No transcripts linked yet.</p>
        </CardContent>
        
        {/* Enrichment Result Dialog */}
        <SingleDealEnrichmentDialog
          open={showEnrichmentDialog}
          onOpenChange={setShowEnrichmentDialog}
          result={enrichmentResult}
          onRetry={() => handleEnrichDeal(false)}
        />
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
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="gap-2"
                    disabled={isEnriching}
                  >
                    {isEnriching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Enrich
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEnrichDeal(false)}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Enrich New Only
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleEnrichDeal(true)}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Re-extract All Transcripts
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
          </div>
        </CardHeader>

        {/* Progress indicator during enrichment */}
        {isEnriching && (
          <CardContent className="py-3 pt-0">
            <ProgressCard className="border-primary/30 bg-primary/5">
              <ProgressCardContent className="py-3">
                <div className="flex items-center gap-3">
                  <Zap className="h-4 w-4 text-primary animate-pulse flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="font-medium text-sm">
                        {enrichmentPhase === 'transcripts' 
                          ? 'Processing transcripts...' 
                          : 'Scraping website...'}
                      </p>
                      {enrichmentProgress.total > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {enrichmentProgress.current}/{enrichmentProgress.total}
                        </span>
                      )}
                    </div>
                    <Progress 
                      value={enrichmentProgress.total > 0 
                        ? (enrichmentProgress.current / enrichmentProgress.total) * 100 
                        : undefined} 
                      className="h-1.5" 
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {enrichmentPhase === 'transcripts' && enrichmentProgress.total > 0
                        ? `Extracting intelligence from ${enrichmentProgress.total} transcript${enrichmentProgress.total > 1 ? 's' : ''}`
                        : 'Extracting deal intelligence'}
                    </p>
                  </div>
                </div>
              </ProgressCardContent>
            </ProgressCard>
          </CardContent>
        )}

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
                          renderExtractedIntelligence(transcript.extracted_data as Record<string, unknown>)
                        )}

                        <div className="flex items-center gap-2">
                          {!hasExtracted ? (
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
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleExtract(transcript)}
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
        
        {/* Enrichment Result Dialog */}
        <SingleDealEnrichmentDialog
          open={showEnrichmentDialog}
          onOpenChange={setShowEnrichmentDialog}
          result={enrichmentResult}
          onRetry={() => handleEnrichDeal(false)}
        />
      </Collapsible>
    </Card>
  );
}
