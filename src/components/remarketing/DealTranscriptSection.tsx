import { useState, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
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
  Search,
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
    primary_contact_email?: string;
    primary_contact_name?: string;
    main_contact_email?: string;
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
      const dynamicTimeout = Math.max(300000, 30000 + (totalToProcess * 25000) + 30000);
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

  // Fireflies search state
  const [addMode, setAddMode] = useState<'manual' | 'fireflies'>('manual');
  const [firefliesEmail, setFirefliesEmail] = useState(dealInfo?.main_contact_email || dealInfo?.primary_contact_email || '');
  const [firefliesSearching, setFirefliesSearching] = useState(false);
  const [firefliesResults, setFirefliesResults] = useState<any[]>([]);
  const [selectedFirefliesIds, setSelectedFirefliesIds] = useState<Set<string>>(new Set());
  const [firefliesImporting, setFirefliesImporting] = useState(false);
  const [firefliesSearchInfo, setFirefliesSearchInfo] = useState<string>('');

  const resetForm = () => {
    setNewTranscript("");
    setTranscriptTitle("");
    setTranscriptUrl("");
    setCallDate("");
    setSelectedFiles([]);
    setIsMultiFileMode(false);
    setAddMode('manual');
    setFirefliesResults([]);
    setSelectedFirefliesIds(new Set());
    setFirefliesImporting(false);
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
        let skippedCount = 0;
        const totalFiles = selectedFiles.length;
        setProcessingProgress({ current: 0, total: totalFiles });

        // Fetch existing transcript titles to prevent duplicates
        const { data: existing } = await supabase
          .from('deal_transcripts')
          .select('title')
          .eq('listing_id', dealId);
        const existingTitles = new Set(
          (existing || []).map(t => (t.title || '').replace(/\.(pdf|docx?|txt|vtt|srt)$/i, '').trim().toLowerCase())
        );
        
        for (let i = 0; i < selectedFiles.length; i++) {
          const sf = selectedFiles[i];

          // Skip duplicates
          const normalizedTitle = sf.title.replace(/\.(pdf|docx?|txt|vtt|srt)$/i, '').trim().toLowerCase();
          if (existingTitles.has(normalizedTitle)) {
            setSelectedFiles(prev => prev.map((f, idx) => 
              idx === i ? { ...f, status: 'error' as const } : f
            ));
            skippedCount++;
            toast.info(`Skipped "${sf.title}" — already exists`);
            continue;
          }
          existingTitles.add(normalizedTitle); // prevent dupes within same batch
          
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
        if (successCount === 0 && skippedCount === 0) throw new Error('No files were uploaded successfully');
        if (successCount === 0 && skippedCount > 0) throw new Error(`All ${skippedCount} file(s) already exist — no new transcripts added`);
        return { count: successCount, failed: totalFiles - successCount - skippedCount, skipped: skippedCount };
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
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal-transcripts', dealId] });
      const parts: string[] = [];
      if (data?.count > 0) parts.push(`${data.count} transcript${data.count > 1 ? 's' : ''} added`);
      if (data?.skipped > 0) parts.push(`${data.skipped} skipped (duplicates)`);
      if (data?.failed > 0) parts.push(`${data.failed} failed`);
      toast.success(parts.join(', ') || 'Transcript added');
      resetForm();
      setIsAddDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setProcessingProgress({ current: 0, total: 0 });
    }
  });

  const [selectedTranscriptIds, setSelectedTranscriptIds] = useState<Set<string>>(new Set());

  const toggleTranscriptSelection = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedTranscriptIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllTranscripts = (transcripts: DealTranscript[]) => {
    setSelectedTranscriptIds(prev => 
      prev.size === transcripts.length ? new Set() : new Set(transcripts.map(t => t.id))
    );
  };

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

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('deal_transcripts')
        .delete()
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      setSelectedTranscriptIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal-transcripts', dealId] });
      toast.success(`${ids.length} transcript${ids.length > 1 ? 's' : ''} deleted`);
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

  // === Fireflies Search Handler ===
  const handleFirefliesSearch = async () => {
    if (!firefliesEmail.trim()) return;

    setFirefliesSearching(true);
    setFirefliesResults([]);
    setSelectedFirefliesIds(new Set());
    setFirefliesSearchInfo('');

    try {
      const input = firefliesEmail.trim();

      // Extract domain from email (or use as-is if already a domain)
      const domain = input.includes('@')
        ? input.split('@')[1].toLowerCase()
        : input.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();

      // Skip common email providers — these aren't company domains
      const genericDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'];
      const isCompanyDomain = domain && !genericDomains.includes(domain);

      const allResults: any[] = [];

      if (isCompanyDomain) {
        // STEP 1: Find all known contacts at this domain
        setFirefliesSearchInfo(`Finding all contacts at @${domain}...`);

        const { data: domainContacts } = await supabase
          .from('remarketing_buyer_contacts')
          .select('email, name')
          .ilike('email', `%@${domain}`);

        const emailSet = new Set<string>();
        if (input.includes('@')) emailSet.add(input.toLowerCase());
        if (domainContacts) {
          domainContacts.forEach((c: any) => {
            if (c.email) emailSet.add(c.email.toLowerCase());
          });
        }

        const allEmails = Array.from(emailSet);

        if (allEmails.length > 0) {
          setFirefliesSearchInfo(`Searching Fireflies for ${allEmails.length} contact${allEmails.length !== 1 ? 's' : ''} at @${domain}...`);

          const { data: participantData, error: participantError } = await supabase.functions.invoke(
            'search-fireflies-for-buyer',
            {
              body: {
                query: domain,
                participantEmails: allEmails,
                limit: 50
              }
            }
          );

          if (!participantError && participantData?.results) {
            allResults.push(...participantData.results);
          }
        }

        // STEP 3: Also do keyword search for the company name
        const companyKeyword = domain.replace(/\.com|\.net|\.org|\.io/g, '').replace(/[.-]/g, ' ');
        if (companyKeyword.length >= 3) {
          setFirefliesSearchInfo(prev => prev + ` Also searching for "${companyKeyword}"...`);

          const { data: keywordData, error: keywordError } = await supabase.functions.invoke(
            'search-fireflies-for-buyer',
            { body: { query: companyKeyword, limit: 20 } }
          );

          if (!keywordError && keywordData?.results) {
            allResults.push(...keywordData.results);
          }
        }
      } else {
        // Generic email — just search by the specific email
        setFirefliesSearchInfo(`Searching for ${input}...`);

        const { data, error } = await supabase.functions.invoke('search-fireflies-for-buyer', {
          body: {
            query: input,
            participantEmails: input.includes('@') ? [input] : undefined,
            limit: 50
          }
        });

        if (!error && data?.results) {
          allResults.push(...data.results);
        }
      }

      // Deduplicate by transcript ID
      const seen = new Set<string>();
      const uniqueResults = allResults.filter((r: any) => {
        if (!r.id || seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });

      // Filter out transcripts already linked to this deal
      const existingIds = new Set(
        transcripts
          .filter((t: any) => t.fireflies_transcript_id)
          .map((t: any) => t.fireflies_transcript_id)
      );

      const newResults = uniqueResults.filter((r: any) => !existingIds.has(r.id));

      // Sort by date, most recent first
      newResults.sort((a: any, b: any) => {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        return dateB - dateA;
      });

      setFirefliesResults(newResults);

      if (newResults.length === 0 && uniqueResults.length > 0) {
        toast.info('All found transcripts are already linked to this deal');
      } else if (newResults.length === 0) {
        toast.info(`No Fireflies transcripts found for ${isCompanyDomain ? `@${domain}` : input}`);
      } else {
        setFirefliesSearchInfo(`Found ${newResults.length} transcript${newResults.length !== 1 ? 's' : ''}${isCompanyDomain ? ` with @${domain} contacts` : ''}`);
      }
    } catch (err) {
      console.error('Fireflies search error:', err);
      toast.error('Failed to search Fireflies');
      setFirefliesSearchInfo('');
    } finally {
      setFirefliesSearching(false);
    }
  };

  // === Fireflies Import Handler ===
  const handleFirefliesImport = async () => {
    if (selectedFirefliesIds.size === 0) return;

    setFirefliesImporting(true);
    const toastId = toast.loading(`Importing ${selectedFirefliesIds.size} transcripts...`);

    try {
      let imported = 0;
      let failed = 0;

      for (const ffId of selectedFirefliesIds) {
        const result = firefliesResults.find((r: any) => r.id === ffId);
        if (!result) continue;

        try {
          const { error: insertError } = await supabase
            .from('deal_transcripts')
            .insert({
              listing_id: dealId,
              fireflies_transcript_id: result.id,
              fireflies_meeting_id: result.id,
              transcript_url: result.meeting_url || null,
              title: result.title || `Call - ${new Date(result.date).toLocaleDateString()}`,
              call_date: result.date || null,
              participants: result.participants || [],
              meeting_attendees: Array.isArray(result.participants)
                ? result.participants.map((p: any) => typeof p === 'string' ? p : p.email).filter(Boolean)
                : [],
              duration_minutes: result.duration_minutes || null,
              source: 'fireflies',
              auto_linked: false,
              transcript_text: '',
            });

          if (insertError) {
            console.error(`Failed to import ${result.id}:`, insertError);
            failed++;
          } else {
            imported++;
          }
        } catch (err) {
          console.error(`Error importing transcript ${ffId}:`, err);
          failed++;
        }
      }

      if (imported > 0) {
        toast.success(`Imported ${imported} transcript${imported !== 1 ? 's' : ''}`, { id: toastId });
        queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal-transcripts', dealId] });
      }
      if (failed > 0) {
        toast.warning(`${failed} transcript${failed !== 1 ? 's' : ''} failed to import`);
      }

      setIsAddDialogOpen(false);
      resetForm();
      setFirefliesResults([]);
      setSelectedFirefliesIds(new Set());

    } catch (err) {
      console.error('Fireflies import error:', err);
      toast.error('Failed to import transcripts', { id: toastId });
    } finally {
      setFirefliesImporting(false);
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

      {/* Tab switcher */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={addMode === 'manual' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setAddMode('manual')}
        >
          Manual Entry
        </Button>
        <Button
          variant={addMode === 'fireflies' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setAddMode('fireflies')}
        >
          <Search className="h-4 w-4 mr-2" />
          Pull from Fireflies
        </Button>
      </div>

      {addMode === 'fireflies' ? (
        <div className="space-y-4 py-4">
          {/* Email/domain input */}
          <div className="space-y-2">
            <Label>Contact Email or Company Domain</Label>
            <div className="flex gap-2">
              <Input
                placeholder="email@company.com or company.com"
                value={firefliesEmail}
                onChange={(e) => setFirefliesEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !firefliesSearching && handleFirefliesSearch()}
              />
              <Button
                onClick={handleFirefliesSearch}
                disabled={!firefliesEmail.trim() || firefliesSearching}
              >
                {firefliesSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Search'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter an email to find all Fireflies calls with anyone at that company's domain.
              For example, entering <code>tyler@saltcreekcap.com</code> will find calls with ALL contacts at <code>@saltcreekcap.com</code>.
            </p>
            {firefliesSearchInfo && (
              <p className="text-xs text-primary">{firefliesSearchInfo}</p>
            )}
          </div>

          {/* Results list */}
          {firefliesResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{firefliesResults.length} transcripts found</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (selectedFirefliesIds.size === firefliesResults.length) {
                      setSelectedFirefliesIds(new Set());
                    } else {
                      setSelectedFirefliesIds(new Set(firefliesResults.map((r: any) => r.id)));
                    }
                  }}
                >
                  {selectedFirefliesIds.size === firefliesResults.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="max-h-80 overflow-y-auto space-y-2">
                {firefliesResults.map((result: any) => (
                  <Card
                    key={result.id}
                    className={`p-3 cursor-pointer transition-colors ${
                      selectedFirefliesIds.has(result.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => {
                      setSelectedFirefliesIds(prev => {
                        const next = new Set(prev);
                        if (next.has(result.id)) next.delete(result.id);
                        else next.add(result.id);
                        return next;
                      });
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedFirefliesIds.has(result.id)}
                        readOnly
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{result.title}</p>
                        <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                          {result.date && (
                            <span>{new Date(result.date).toLocaleDateString()}</span>
                          )}
                          {result.duration_minutes && (
                            <span>{result.duration_minutes} min</span>
                          )}
                        </div>
                        {result.summary && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {typeof result.summary === 'string' ? result.summary : result.summary.short_summary}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
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
      )}
      <DialogFooter>
        <Button variant="outline" onClick={() => {
          setIsAddDialogOpen(false);
          resetForm();
        }}>
          Cancel
        </Button>
        {addMode === 'fireflies' ? (
          <Button
            onClick={handleFirefliesImport}
            disabled={selectedFirefliesIds.size === 0 || firefliesImporting}
          >
            {firefliesImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              `Import ${selectedFirefliesIds.size} Transcript${selectedFirefliesIds.size !== 1 ? 's' : ''}`
            )}
          </Button>
        ) : (
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
        )}
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
            {/* Deduplicate + failed extraction cleanup */}
            {(() => {
              // Normalize title: strip .pdf/.docx/.doc suffix for grouping
              const normalize = (title: string) => title.replace(/\.(pdf|docx?|txt|vtt|srt)$/i, '').trim();
              
              // Group by normalized title, keep the best one (longest text, preferring processed)
              const groups = new Map<string, typeof transcripts>();
              transcripts.forEach(t => {
                const key = normalize(t.title || t.transcript_text?.substring(0, 100) || t.id);
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(t);
              });

              const dupeIds: string[] = [];
              const failedIds: string[] = [];
              
              for (const [, group] of groups) {
                if (group.length > 1) {
                  // Sort: processed first, then by text length desc
                  group.sort((a, b) => {
                    if (a.processed_at && !b.processed_at) return -1;
                    if (!a.processed_at && b.processed_at) return 1;
                    return (b.transcript_text?.length || 0) - (a.transcript_text?.length || 0);
                  });
                  // Keep first, mark rest as dupes
                  for (let i = 1; i < group.length; i++) {
                    dupeIds.push(group[i].id);
                  }
                }
              }
              
              // Also detect failed extraction placeholders (< 200 chars with bracket markers)
              transcripts.forEach(t => {
                if (!dupeIds.includes(t.id) && t.transcript_text && t.transcript_text.length < 200 && 
                    (t.transcript_text.includes('[text extraction pending') || t.transcript_text.includes('[File uploaded:'))) {
                  failedIds.push(t.id);
                }
              });

              const totalCleanup = dupeIds.length + failedIds.length;
              if (totalCleanup > 0) {
                return (
                  <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span>
                        {dupeIds.length > 0 && `${dupeIds.length} duplicate${dupeIds.length > 1 ? 's' : ''}`}
                        {dupeIds.length > 0 && failedIds.length > 0 && ' + '}
                        {failedIds.length > 0 && `${failedIds.length} failed extraction${failedIds.length > 1 ? 's' : ''}`}
                        {' detected'}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={async () => {
                        const allIds = [...dupeIds, ...failedIds];
                        if (!confirm(`Delete ${allIds.length} transcript${allIds.length > 1 ? 's' : ''} (${dupeIds.length} duplicates, ${failedIds.length} failed)?`)) return;
                        const { error } = await supabase
                          .from('deal_transcripts')
                          .delete()
                          .in('id', allIds);
                        if (error) {
                          toast.error('Failed to delete');
                        } else {
                          toast.success(`Cleaned up ${allIds.length} transcript${allIds.length > 1 ? 's' : ''}`);
                          queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal-transcripts', dealId] });
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Clean Up
                    </Button>
                  </div>
                );
              }
              return null;
            })()}
            {/* Select all + bulk actions bar */}
            {transcripts.length > 1 && (
              <div className="flex items-center justify-between px-3 py-2 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedTranscriptIds.size === transcripts.length}
                    onCheckedChange={() => toggleAllTranscripts(transcripts)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {selectedTranscriptIds.size > 0 
                      ? `${selectedTranscriptIds.size} selected` 
                      : 'Select all'}
                  </span>
                </div>
                {selectedTranscriptIds.size > 0 && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      if (confirm(`Delete ${selectedTranscriptIds.size} transcript${selectedTranscriptIds.size > 1 ? 's' : ''}?`)) {
                        bulkDeleteMutation.mutate(Array.from(selectedTranscriptIds));
                      }
                    }}
                    disabled={bulkDeleteMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete Selected
                  </Button>
                )}
              </div>
            )}
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
                          <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedTranscriptIds.has(transcript.id)}
                              onCheckedChange={() => toggleTranscriptSelection(transcript.id)}
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
                                deleteMutation.mutate(transcript.id);
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
