import { useState, useRef, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithTimeout } from "@/lib/invoke-with-timeout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
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
  Loader2,
  RefreshCw,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { SingleDealEnrichmentDialog, type SingleDealEnrichmentResult } from "./SingleDealEnrichmentDialog";
import { v4 as uuidv4 } from "uuid";

// Sub-components
import { FirefliesLinkPanel } from "./transcript/FirefliesLinkPanel";
import { ExtractedIntelligenceView } from "./transcript/ExtractedIntelligenceView";
import { TranscriptAddDialog } from "./transcript/TranscriptAddDialog";
import { EnrichmentProgressCard } from "./transcript/EnrichmentProgressCard";
import { TranscriptListItem } from "./transcript/TranscriptListItem";

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
    main_contact_email?: string;
  };
  /** Fireflies sync props */
  contactEmail?: string | null;
  contactName?: string | null;
  companyName?: string;
  onSyncComplete?: () => void;
  onTranscriptLinked?: () => void;
}

export function DealTranscriptSection({ dealId, transcripts, isLoading, dealInfo, contactEmail, contactName, companyName, onSyncComplete, onTranscriptLinked }: DealTranscriptSectionProps) {
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

  // Fireflies sync state
  const [syncLoading, setSyncLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [linkedCount, setLinkedCount] = useState(transcripts?.filter((t: any) => t.source === 'fireflies').length || 0);

  // Fireflies manual link state
  const [ffQuery, setFfQuery] = useState(companyName || '');
  const [ffSearchLoading, setFfSearchLoading] = useState(false);
  const [ffResults, setFfResults] = useState<any[]>([]);
  const [ffLinking, setFfLinking] = useState<string | null>(null);
  const [firefliesUrl, setFirefliesUrl] = useState("");
  const [linkingUrl, setLinkingUrl] = useState(false);
  const [ffUploading, setFfUploading] = useState(false);
  const ffFileInputRef = useRef<HTMLInputElement>(null);
  const [showLinkPanel, setShowLinkPanel] = useState(false);

  // Fireflies sync handler
  const handleFirefliesSync = async () => {
    if (!contactEmail) return;
    setSyncLoading(true);
    const toastId = toast.loading(`Searching Fireflies for ${contactEmail}...`);
    try {
      const { data, error } = await supabase.functions.invoke('sync-fireflies-transcripts', {
        body: { listingId: dealId, contactEmail, limit: 50 },
      });
      if (error) throw error;
      if (data.linked > 0) {
        toast.success(`Linked ${data.linked} new transcript${data.linked !== 1 ? 's' : ''}`, { id: toastId });
        setLinkedCount(prev => prev + data.linked);
        onSyncComplete?.();
      } else if (data.skipped > 0) {
        toast.info(`All ${data.skipped} transcript${data.skipped !== 1 ? 's' : ''} already linked`, { id: toastId });
      } else {
        toast.info(`No Fireflies calls found for ${contactEmail}`, { id: toastId });
      }
      setLastSynced(new Date());
      if (data.errors?.length > 0) {
        toast.warning(`${data.errors.length} transcript${data.errors.length !== 1 ? 's' : ''} failed to link`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? `Failed: ${error.message}` : "Failed to sync", { id: toastId });
    } finally {
      setSyncLoading(false);
    }
  };

  // Fireflies quick search handler (link panel)
  const handleFfQuickSearch = async () => {
    const trimmed = ffQuery.trim();
    if (!trimmed) return;
    setFfSearchLoading(true);
    const toastId = toast.loading(`Searching Fireflies for "${trimmed}"...`);
    try {
      const { data, error } = await supabase.functions.invoke('search-fireflies-for-buyer', {
        body: { query: trimmed, limit: 30 },
      });
      if (error) throw error;
      setFfResults(data.results || []);
      toast[data.results?.length ? 'success' : 'info'](
        data.results?.length ? `Found ${data.results.length} call${data.results.length !== 1 ? 's' : ''}` : `No calls found`,
        { id: toastId }
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search failed", { id: toastId });
    } finally {
      setFfSearchLoading(false);
    }
  };

  // Link a search result
  const handleLinkSearchResult = async (transcript: any) => {
    setFfLinking(transcript.id);
    try {
      const { error } = await supabase.from('deal_transcripts').insert({
        listing_id: dealId,
        fireflies_transcript_id: transcript.id,
        fireflies_meeting_id: transcript.id,
        transcript_url: transcript.meeting_url,
        title: transcript.title,
        call_date: transcript.date,
        participants: transcript.participants,
        duration_minutes: transcript.duration_minutes,
        transcript_text: transcript.summary || 'Fireflies transcript',
        source: 'fireflies',
        auto_linked: false,
      });
      if (error) {
        if (error.code === '23505') toast.info("Already linked");
        else throw error;
      } else {
        toast.success("Transcript linked");
        setFfResults(prev => prev.filter(r => r.id !== transcript.id));
        onTranscriptLinked?.();
      }
    } catch (error) {
      toast.error("Failed to link transcript");
    } finally {
      setFfLinking(null);
    }
  };

  // Link by URL
  const handleLinkByUrl = async () => {
    const url = firefliesUrl.trim();
    if (!url) return;
    setLinkingUrl(true);
    try {
      const match = url.match(/fireflies\.ai\/view\/([^/?#]+)/);
      const transcriptId = match ? match[1] : `url-${Date.now()}`;
      const { error } = await supabase.from('deal_transcripts').insert({
        listing_id: dealId,
        fireflies_transcript_id: transcriptId,
        transcript_url: url,
        title: match ? `Fireflies: ${transcriptId}` : 'Fireflies Transcript',
        transcript_text: 'Linked via URL - pending fetch',
        source: 'fireflies',
        auto_linked: false,
      });
      if (error) {
        if (error.code === '23505') toast.info("Already linked");
        else throw error;
      } else {
        toast.success("Transcript linked");
        setFirefliesUrl("");
        onTranscriptLinked?.();
      }
    } catch (error) {
      toast.error("Failed to link");
    } finally {
      setLinkingUrl(false);
    }
  };

  // File upload handler (link panel)
  const handleFfFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setFfUploading(true);
    let successCount = 0;
    for (const file of Array.from(files)) {
      const toastId = toast.loading(`Uploading ${file.name}...`);
      try {
        const textTypes = ['.txt', '.vtt', '.srt', '.md'];
        const isTextFile = textTypes.some(ext => file.name.toLowerCase().endsWith(ext));
        let transcriptText = '';
        if (isTextFile) {
          transcriptText = await file.text();
        } else {
          transcriptText = `Uploaded file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        }
        const docTypes = ['.pdf', '.doc', '.docx'];
        if (docTypes.some(ext => file.name.toLowerCase().endsWith(ext))) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('listingId', dealId);
            const { data, error } = await supabase.functions.invoke('parse-transcript-file', { body: formData });
            if (!error && data?.text) transcriptText = data.text;
          } catch { /* file parse failed, use fallback text */ }
        }
        const { error } = await supabase.from('deal_transcripts').insert({
          listing_id: dealId,
          fireflies_transcript_id: `upload-${Date.now()}-${file.name}`,
          title: file.name.replace(/\.[^/.]+$/, ''),
          transcript_text: transcriptText || `Uploaded: ${file.name}`,
          source: 'upload',
          auto_linked: false,
        });
        if (error) {
          if (error.code === '23505') toast.info(`${file.name} already linked`, { id: toastId });
          else throw error;
        } else {
          toast.success(`${file.name} uploaded`, { id: toastId });
          successCount++;
        }
      } catch {
        toast.error(`Failed to upload ${file.name}`, { id: toastId });
      }
    }
    if (successCount > 0) onTranscriptLinked?.();
    setFfUploading(false);
    if (ffFileInputRef.current) ffFileInputRef.current.value = '';
  };

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
      const { queueDealEnrichment } = await import("@/lib/remarketing/queueEnrichment");
      await queueDealEnrichment([dealId]);

      if (pollInterval) clearInterval(pollInterval);

      setEnrichmentResult({
        success: true,
        message: 'Deal queued for background enrichment',
        fieldsUpdated: [],
      });
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

  // === Add Dialog state ===
  const [selectedFiles, setSelectedFiles] = useState<{file: File; title: string; status: 'pending' | 'processing' | 'done' | 'error'; text?: string}[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isMultiFileMode, setIsMultiFileMode] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });

  // Fireflies search state (add dialog)
  const [addMode, setAddMode] = useState<'manual' | 'fireflies'>('manual');
  const [firefliesEmail, setFirefliesEmail] = useState(dealInfo?.main_contact_email || '');
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

      // Single transcript mode — URL or file is required, text is optional
      if (!transcriptUrl.trim() && !isMultiFileMode) {
        throw new Error('Please provide a transcript URL or upload a file');
      }

      const safeSingleText = (newTranscript || '').trim().length > 0
        ? newTranscript
        : `[Transcript link: ${transcriptUrl}]`;

      // Detect Fireflies URLs so enrichment pipeline can fetch content automatically
      const isFirefliesUrl = transcriptUrl &&
        /app\.fireflies\.ai\/view\//i.test(transcriptUrl);

      const { error } = await supabase
        .from('deal_transcripts')
        .insert({
          listing_id: dealId,
          transcript_text: safeSingleText,
          source: isFirefliesUrl ? 'fireflies' : (transcriptUrl || 'manual'),
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
      const { data, error } = await invokeWithTimeout<any>('extract-deal-transcript', {
        body: {
          transcriptId: transcript.id,
          transcriptText: transcript.transcript_text,
          dealInfo,
          applyToDeal: true // Automatically apply to listing per spec
        },
        timeoutMs: 120_000,
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

      // Track what we're applying for detailed feedback
      const appliedFields: string[] = [];
      const skippedFields: string[] = [];

      // Financial fields
      if (extracted.revenue) { updateData.revenue = extracted.revenue; appliedFields.push('Revenue'); }
      if (extracted.ebitda) { updateData.ebitda = extracted.ebitda; appliedFields.push('EBITDA'); }

      // Business basics
      if (extracted.location) { updateData.location = extracted.location; appliedFields.push('Location'); }
      if (extracted.industry) { updateData.industry = extracted.industry; appliedFields.push('Industry'); }
      if (extracted.website) { updateData.website = extracted.website; appliedFields.push('Website'); }
      // Services
      if (extracted.service_mix) { updateData.service_mix = extracted.service_mix; appliedFields.push('Service Mix'); }

      // Services array (now has column!)
      const mergedServices = mergeArrays(
        currentData?.services as string[] | undefined,
        extracted.services as string[] | undefined
      );
      if (mergedServices) { updateData.services = mergedServices; appliedFields.push('Services'); }

      // Geography - normalize state codes to uppercase 2-letter format
      let extractedStates = extracted.geographic_states as string[] | undefined;
      if (extractedStates) {
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

      // Customers
      if (extracted.customer_types) { updateData.customer_types = extracted.customer_types; appliedFields.push('Customer Types'); }

      // Strategic info
      if (extracted.executive_summary) { updateData.executive_summary = extracted.executive_summary; appliedFields.push('Executive Summary'); }
      if (extracted.growth_trajectory) { updateData.growth_trajectory = extracted.growth_trajectory; appliedFields.push('Growth Trajectory'); }

      // Contact info
      if (extracted.main_contact_name) { updateData.main_contact_name = extracted.main_contact_name; appliedFields.push('Contact Name'); }
      if (extracted.main_contact_email) { updateData.main_contact_email = extracted.main_contact_email; appliedFields.push('Contact Email'); }
      if (extracted.main_contact_phone) { updateData.main_contact_phone = extracted.main_contact_phone; appliedFields.push('Contact Phone'); }

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

  // === Fireflies Search Handler (Add Dialog) ===
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

  // === Shared UI pieces ===
  const enrichButton = (
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
  );

  const addTranscriptDialog = (
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
      <TranscriptAddDialog
        transcriptTitle={transcriptTitle}
        onTranscriptTitleChange={setTranscriptTitle}
        transcriptUrl={transcriptUrl}
        onTranscriptUrlChange={setTranscriptUrl}
        callDate={callDate}
        onCallDateChange={setCallDate}
        newTranscript={newTranscript}
        onNewTranscriptChange={setNewTranscript}
        fileInputRef={fileInputRef}
        selectedFiles={selectedFiles}
        onSelectedFilesChange={setSelectedFiles}
        isMultiFileMode={isMultiFileMode}
        onFileUpload={handleFileUpload}
        addMutationPending={addMutation.isPending}
        onAddMutate={() => addMutation.mutate()}
        processingProgress={processingProgress}
        addMode={addMode}
        onAddModeChange={setAddMode}
        firefliesEmail={firefliesEmail}
        onFirefliesEmailChange={setFirefliesEmail}
        firefliesSearching={firefliesSearching}
        onFirefliesSearch={handleFirefliesSearch}
        firefliesResults={firefliesResults}
        selectedFirefliesIds={selectedFirefliesIds}
        onToggleFirefliesId={(id) => {
          setSelectedFirefliesIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
        }}
        onToggleAllFireflies={() => {
          if (selectedFirefliesIds.size === firefliesResults.length) {
            setSelectedFirefliesIds(new Set());
          } else {
            setSelectedFirefliesIds(new Set(firefliesResults.map((r: any) => r.id)));
          }
        }}
        firefliesImporting={firefliesImporting}
        onFirefliesImport={handleFirefliesImport}
        firefliesSearchInfo={firefliesSearchInfo}
        onClose={() => {
          setIsAddDialogOpen(false);
          resetForm();
        }}
      />
    </Dialog>
  );

  const enrichmentResultDialog = (
    <SingleDealEnrichmentDialog
      open={showEnrichmentDialog}
      onOpenChange={setShowEnrichmentDialog}
      result={enrichmentResult}
      onRetry={() => handleEnrichDeal(false)}
    />
  );

  const linkPanel = (
    <FirefliesLinkPanel
      contactEmail={contactEmail}
      contactName={contactName}
      lastSynced={lastSynced}
      syncLoading={syncLoading}
      onSync={handleFirefliesSync}
      firefliesUrl={firefliesUrl}
      onFirefliesUrlChange={setFirefliesUrl}
      linkingUrl={linkingUrl}
      onLinkByUrl={handleLinkByUrl}
      ffFileInputRef={ffFileInputRef}
      ffUploading={ffUploading}
      onFfFileUpload={handleFfFileUpload}
      ffQuery={ffQuery}
      onFfQueryChange={setFfQuery}
      ffSearchLoading={ffSearchLoading}
      onFfQuickSearch={handleFfQuickSearch}
      ffResults={ffResults}
      ffLinking={ffLinking}
      onLinkSearchResult={handleLinkSearchResult}
    />
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
              {enrichButton}
              {addTranscriptDialog}
            </div>
          </div>
        </CardHeader>

        {/* Progress indicator during enrichment */}
        {isEnriching && (
          <CardContent className="py-3 pt-0">
            <EnrichmentProgressCard
              enrichmentPhase={enrichmentPhase}
              enrichmentProgress={enrichmentProgress}
              primaryCounter
            />
          </CardContent>
        )}

        <CardContent className="py-2 pt-0 space-y-3">
          {linkPanel}
          <p className="text-sm text-muted-foreground">No transcripts linked yet.</p>
        </CardContent>

        {enrichmentResultDialog}
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
              {enrichButton}
              {addTranscriptDialog}
            </div>
          </div>
        </CardHeader>

        {/* Progress indicator during enrichment */}
        {isEnriching && (
          <CardContent className="py-3 pt-0">
            <EnrichmentProgressCard
              enrichmentPhase={enrichmentPhase}
              enrichmentProgress={enrichmentProgress}
            />
          </CardContent>
        )}

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {/* Link Panel - Fireflies sync + manual linking */}
            {linkPanel}
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
            {transcripts.map((transcript) => (
              <TranscriptListItem
                key={transcript.id}
                transcript={transcript}
                isExpanded={expandedId === transcript.id}
                onToggleExpanded={(open) => setExpandedId(open ? transcript.id : null)}
                isSelected={selectedTranscriptIds.has(transcript.id)}
                onToggleSelected={toggleTranscriptSelection}
                isProcessing={processingId === transcript.id}
                isApplying={applyingId === transcript.id}
                onExtract={handleExtract}
                onApply={handleApply}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </CardContent>
        </CollapsibleContent>

        {enrichmentResultDialog}
      </Collapsible>
    </Card>
  );
}
