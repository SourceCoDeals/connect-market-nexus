import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { 
  BookOpen, 
  Sparkles, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  Check,
  X,
  AlertCircle,
  Download,
  RefreshCw,
  MessageSquare,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { SizeCriteria, GeographyCriteria, ServiceCriteria, BuyerTypesCriteria, TargetBuyerTypeConfig } from "@/types/remarketing";
import { GuideGenerationErrorPanel, type ErrorDetails } from "./GuideGenerationErrorPanel";

type GenerationState = 'idle' | 'clarifying' | 'generating' | 'quality_check' | 'gap_filling' | 'complete' | 'error';

interface ClarifyQuestion {
  id: string;
  question: string;
  type: 'select' | 'multiSelect' | 'text';
  options?: string[];
  placeholder?: string;
}

interface QualityResult {
  passed: boolean;
  score: number;
  wordCount: number;
  tableCount: number;
  placeholderCount: number;
  hasCriteria: boolean;
  hasBuyerTypes: boolean;
  hasPrimaryFocus: boolean;
  missingElements: string[];
}

interface ExtractedCriteria {
  size_criteria?: SizeCriteria;
  geography_criteria?: GeographyCriteria;
  service_criteria?: ServiceCriteria;
  buyer_types_criteria?: BuyerTypesCriteria;
  target_buyer_types?: TargetBuyerTypeConfig[];
}

interface ClarificationContext {
  segments?: string[];
  example_companies?: string;
  geography_focus?: string;
  revenue_range?: string;
  [key: string]: string | string[] | undefined;
}

// Helper function to save guide to Supporting Documents
const saveGuideToDocuments = async (
  content: string,
  industryName: string,
  universeId: string,
  onDocumentAdded: (doc: { id: string; name: string; url: string; uploaded_at: string }) => void
) => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-guide-pdf`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          universeId,
          industryName,
          content
        }),
      }
    );

    if (!response.ok) {
      console.error('Failed to save guide to documents:', response.status);
      return;
    }

    const data = await response.json();
    if (data.success && data.document) {
      onDocumentAdded(data.document);
      toast.success("Guide saved to Supporting Documents");
    }
  } catch (error) {
    console.error('Error saving guide to documents:', error);
    // Don't show error toast - this is a background operation
  }
};

interface AIResearchSectionProps {
  onGuideGenerated: (content: string, criteria: ExtractedCriteria, targetBuyerTypes?: TargetBuyerTypeConfig[]) => void;
  universeName?: string;
  existingContent?: string;
  universeId?: string;
  onDocumentAdded?: (doc: { id: string; name: string; url: string; uploaded_at: string }) => void;
}

export const AIResearchSection = ({ 
  onGuideGenerated,
  universeName,
  existingContent,
  universeId,
  onDocumentAdded
}: AIResearchSectionProps) => {
  const [isOpen, setIsOpen] = useState(!!existingContent && existingContent.length > 100);
  const [industryName, setIndustryName] = useState(universeName || "");
  const [industryDescription, setIndustryDescription] = useState("");
  const [state, setState] = useState<GenerationState>('idle');
  const [currentPhase, setCurrentPhase] = useState(0);
  const [totalPhases, setTotalPhases] = useState(12);
  const [phaseName, setPhaseName] = useState("");
  const [content, setContent] = useState(existingContent || "");
  const [wordCount, setWordCount] = useState(0);
  const [qualityResult, setQualityResult] = useState<QualityResult | null>(null);
  const [extractedCriteria, setExtractedCriteria] = useState<ExtractedCriteria | null>(null);
  const [missingElements, setMissingElements] = useState<string[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Error details state for enhanced error panel
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);

  // Track last clarification context for resume/retry
  const lastClarificationContextRef = useRef<ClarificationContext>({});

  // Clarification state
  const [clarifyingQuestions, setClarifyingQuestions] = useState<ClarifyQuestion[]>([]);
  const [clarifyAnswers, setClarifyAnswers] = useState<Record<string, string | string[]>>({});

  // Auto-retry configuration (prevents manual Resume for transient stream cut-offs)
  const MAX_BATCH_RETRIES = 3;
  const batchRetryCountRef = useRef<Record<number, number>>({});

  useEffect(() => {
    if (universeName && !industryName) {
      setIndustryName(universeName);
    }
  }, [universeName]);

  useEffect(() => {
    if (existingContent) {
      setContent(existingContent);
      setWordCount(existingContent.split(/\s+/).length);
    }
  }, [existingContent]);

  // Check for existing guide and confirm before regenerating
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  const handleStartClarification = async () => {
    if (!industryName.trim()) {
      toast.error("Please enter an industry name");
      return;
    }

    // Check if guide already exists
    if (existingContent && existingContent.length > 1000) {
      setShowDuplicateWarning(true);
      return;
    }

    await proceedWithClarification();
  };

  const proceedWithClarification = async () => {
    setShowDuplicateWarning(false);
    setState('clarifying');
    setClarifyingQuestions([]);
    setClarifyAnswers({});

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clarify-industry`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ 
            industry_name: industryName,
            industry_description: industryDescription || undefined
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 402) {
          toast.error("AI credits depleted. Please add credits in Settings → Workspace → Usage.", {
            duration: 10000
          });
          setState('idle');
          return;
        }
        if (response.status === 429) {
          toast.warning("Rate limit reached. Please wait a moment and try again.");
          setState('idle');
          return;
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setClarifyingQuestions(data.questions || []);
      
      // Initialize answers
      const initialAnswers: Record<string, string | string[]> = {};
      (data.questions || []).forEach((q: ClarifyQuestion) => {
        initialAnswers[q.id] = q.type === 'multiSelect' ? [] : '';
      });
      setClarifyAnswers(initialAnswers);

    } catch (error) {
      console.error('Clarification error:', error);
      toast.error(`Failed to get clarifying questions: ${(error as Error).message}. Please check your Anthropic API key.`);
      // Stay in idle state so the user can retry - don't silently skip to generation
      setState('idle');
    }
  };

  const handleSelectOption = (questionId: string, option: string, isMulti: boolean) => {
    setClarifyAnswers(prev => {
      if (isMulti) {
        const current = (prev[questionId] as string[]) || [];
        if (current.includes(option)) {
          return { ...prev, [questionId]: current.filter(o => o !== option) };
        }
        return { ...prev, [questionId]: [...current, option] };
      }
      return { ...prev, [questionId]: option };
    });
  };

  const handleTextAnswer = (questionId: string, value: string) => {
    setClarifyAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleConfirmAndGenerate = () => {
    // Build clarification context
    const context: ClarificationContext = {};
    
    clarifyingQuestions.forEach(q => {
      const answer = clarifyAnswers[q.id];
      if (q.id === 'segment') {
        context.segments = Array.isArray(answer) ? answer : [answer].filter(Boolean);
      } else if (q.id === 'examples') {
        context.example_companies = answer as string;
      } else if (q.id === 'geography') {
        context.geography_focus = answer as string;
      } else if (q.id === 'size') {
        context.revenue_range = answer as string;
      } else {
        context[q.id] = answer;
      }
    });

    handleGenerate(context);
  };

  const handleSkipClarification = () => {
    handleGenerate({});
  };

  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(13); // 13 phases / 1 per batch = 13 batches
  const [savedProgress, setSavedProgress] = useState<{
    industryName: string;
    batchIndex: number;
    content: string;
    clarificationContext: ClarificationContext;
  } | null>(null);

  // Check for saved progress on mount
  useEffect(() => {
    const saved = localStorage.getItem('ma_guide_progress');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Only restore if it matches current universe
        if (parsed.industryName === industryName || parsed.industryName === universeName) {
          setSavedProgress(parsed);
        }
      } catch (e) {
        localStorage.removeItem('ma_guide_progress');
      }
    }
  }, [industryName, universeName]);

  const clearProgress = () => {
    localStorage.removeItem('ma_guide_progress');
    setSavedProgress(null);
  };

  const handleGenerate = async (clarificationContext: ClarificationContext) => {
    setState('generating');
    setCurrentPhase(0);
    setCurrentBatch(0);
    setContent("");
    setWordCount(0);
    setQualityResult(null);
    setExtractedCriteria(null);
    setMissingElements([]);
    setErrorDetails(null); // Clear any previous error
    clearProgress();

    // Save context for potential retry/resume
    lastClarificationContextRef.current = clarificationContext;

    batchRetryCountRef.current = {};

    abortControllerRef.current = new AbortController();

    // Start batch generation
    await generateBatch(0, "", clarificationContext);
  };

  const resumeGeneration = (progress: typeof savedProgress) => {
    if (!progress) return;
    
    setState('generating');
    setCurrentBatch(progress.batchIndex);
    setContent(progress.content);
    setWordCount(progress.content.split(/\s+/).length);
    
    abortControllerRef.current = new AbortController();
    
    toast.info(`Resuming from batch ${progress.batchIndex + 1}...`);
    generateBatch(progress.batchIndex, progress.content, progress.clarificationContext);
  };

  const generateBatch = async (
    batchIndex: number, 
    previousContent: string, 
    clarificationContext: ClarificationContext
  ) => {
    try {
      setCurrentBatch(batchIndex);
      
      // Note: Progress is now saved AFTER each phase completion (in phase_complete handler)
      // This prevents race conditions where saved content is stale
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ma-guide`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            industry_name: industryName,
            industry_description: industryDescription || undefined,
            existing_content: existingContent,
            clarification_context: clarificationContext,
            stream: true,
            batch_index: batchIndex,
            previous_content: previousContent
          }),
          signal: abortControllerRef.current?.signal
        }
      );

      if (!response.ok) {
        if (response.status === 402) {
          toast.error("AI credits depleted. Please add credits in Settings → Workspace → Usage to continue.", {
            duration: 10000
          });
          setState('error');
          return;
        }
        if (response.status === 429) {
          toast.warning("Rate limit reached. Please wait a moment and try again.");
          setState('error');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = previousContent;
      let sawBatchComplete = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE event blocks (separated by a blank line)
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || "";

        for (const block of blocks) {
          const dataLines = block
            .split("\n")
            .filter((l) => l.startsWith("data: "))
            .map((l) => l.slice(6));
          if (dataLines.length === 0) continue;

          const jsonStr = dataLines.join("\n").trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;

          try {
            const event = JSON.parse(jsonStr);

            switch (event.type) {
              case 'heartbeat':
                // Keep-alive, ignore
                break;

              case 'batch_start':
                setTotalBatches(event.total_batches);
                setCurrentBatch(event.batch_index);
                break;

              case 'phase_start':
                setCurrentPhase(event.phase);
                setTotalPhases(event.total);
                setPhaseName(event.name);
                break;

              case 'content':
                fullContent += event.content;
                setContent(fullContent);
                setWordCount(fullContent.split(/\s+/).length);
                // Auto-scroll
                if (contentRef.current) {
                  contentRef.current.scrollTop = contentRef.current.scrollHeight;
                }
                break;

              case 'phase_complete':
                setWordCount(event.wordCount || fullContent.split(/\s+/).length);
                // Save progress AFTER each phase completes (fixes race condition)
                if (event.content) {
                  fullContent = event.content;
                  localStorage.setItem('ma_guide_progress', JSON.stringify({
                    industryName,
                    // Use the batchIndex argument to avoid state timing issues.
                    batchIndex,
                    content: event.content,
                    clarificationContext,
                    lastPhaseId: event.phaseId,
                    lastPhase: event.phase
                  }));
                }
                break;

              case 'batch_complete':
                sawBatchComplete = true;

                // Batch succeeded; reset retry counter for this batch.
                if (batchRetryCountRef.current[batchIndex]) {
                  delete batchRetryCountRef.current[batchIndex];
                }

                // If not final, automatically start next batch
                if (!event.is_final && event.next_batch_index !== null) {
                  // Small delay before starting next batch
                  await new Promise(r => setTimeout(r, 500));
                  toast.info(`Batch ${event.batch_index + 1} complete, starting batch ${event.next_batch_index + 1}...`);
                  // Recursively call for next batch
                  await generateBatch(event.next_batch_index, event.content, clarificationContext);
                  return; // Exit this batch's processing
                }
                break;

              case 'quality_check_start':
                setState('quality_check');
                break;

              case 'quality_check_result':
                setQualityResult(event.result);
                break;

              case 'gap_fill_start':
                setState('gap_filling');
                setMissingElements(event.missingElements || []);
                break;

              case 'gap_fill_complete':
              case 'final_quality':
                if (event.result) {
                  setQualityResult(event.result);
                }
                break;

              case 'criteria_extraction_start':
                // Extracting criteria
                break;

              case 'criteria':
                setExtractedCriteria(event.criteria);
                break;

              case 'complete':
                setState('complete');
                const finalContent = event.content || fullContent;
                setContent(finalContent);
                setWordCount(event.totalWords || finalContent.split(/\s+/).length);
                // Clear saved progress on successful completion
                localStorage.removeItem('ma_guide_progress');
                setSavedProgress(null);
                toast.success("M&A Guide generated successfully!");
                
                // Auto-save guide to Supporting Documents
                if (universeId && onDocumentAdded) {
                  saveGuideToDocuments(finalContent, industryName, universeId, onDocumentAdded);
                }
                break;

              case 'error':
                // Set detailed error info for the error panel
                const errorCode = event.error_code || 'unknown';
                setErrorDetails({
                  code: errorCode,
                  message: event.message || 'Unknown error',
                  batchIndex: event.batch_index ?? batchIndex,
                  phaseName: phaseName || undefined,
                  isRecoverable: event.recoverable ?? true,
                  retryAfterMs: event.retry_after_ms,
                  savedWordCount: event.saved_word_count || fullContent.split(/\s+/).length,
                  timestamp: Date.now()
                });

                // Check for specific error codes
                if (errorCode === 'payment_required') {
                  toast.error("AI credits depleted. Please add credits to continue.", {
                    duration: 10000
                  });
                  setState('error');
                  return; // Don't retry billing errors
                }
                if (errorCode === 'rate_limited') {
                  // Throw with rate limit flag so catch block handles retry with backoff
                  const err = new Error(event.message);
                  (err as any).isRateLimited = true;
                  (err as any).retryAfterMs = event.retry_after_ms || 30000;
                  throw err;
                }
                throw new Error(event.message);

              case 'timeout_warning':
                // Show toast warning about approaching timeout
                toast.warning(event.message || 'Approaching time limit, saving progress...', {
                  duration: 5000
                });
                break;
            }
          } catch (e) {
            // Don't silently swallow parse issues; they often indicate a truncated SSE stream.
            console.warn('[AIResearchSection] Failed to parse SSE event', {
              batchIndex,
              snippet: jsonStr.slice(0, 200),
              error: e
            });
          }
        }
      }

      // If the stream ends without a batch_complete, treat as failure (edge hard timeout / proxy cut-off).
      if (!sawBatchComplete) {
        const timeoutError = new Error(
          `Stream ended unexpectedly during batch ${batchIndex + 1}. This usually means the edge function hit a hard timeout or the connection was closed.`
        );
        (timeoutError as any).code = 'function_timeout';
        throw timeoutError;
      }

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        toast.info("Generation cancelled");
        setState('idle');
        setErrorDetails(null);
      } else {
        const message = (error as Error).message || 'Unknown error';
        const errorCode = (error as any).code || 'unknown';

        // Auto-retry on likely transient stream cut-offs or rate limits so the user doesn't need to manually resume.
        const isStreamCutoff = message.includes('Stream ended unexpectedly during batch') || errorCode === 'function_timeout';
        const isRateLimited = 
          (error as any).isRateLimited || 
          message.includes('Rate limit') ||
          message.includes('rate_limited') ||
          message.includes('RESOURCE_EXHAUSTED');

        const currentRetries = batchRetryCountRef.current[batchIndex] ?? 0;
        if (state === 'generating' && (isStreamCutoff || isRateLimited) && currentRetries < MAX_BATCH_RETRIES) {
          batchRetryCountRef.current[batchIndex] = currentRetries + 1;
          
          // Use longer backoff for rate limits (30s) vs stream cutoffs (1-3s)
          const backoffMs = isRateLimited 
            ? ((error as any).retryAfterMs || 30000)
            : 1000 * (currentRetries + 1);
          
          toast.info(
            isRateLimited
              ? `Rate limit hit. Waiting ${Math.round(backoffMs / 1000)}s before retry (${currentRetries + 1}/${MAX_BATCH_RETRIES})...`
              : `Connection dropped during batch ${batchIndex + 1}. Retrying (${currentRetries + 1}/${MAX_BATCH_RETRIES})...`
          );
          
          await new Promise((r) => setTimeout(r, backoffMs));

          // New controller for the retry to ensure the previous stream is fully abandoned.
          abortControllerRef.current = new AbortController();
          await generateBatch(batchIndex, previousContent, clarificationContext);
          return;
        }

        console.error('Generation error:', error);

        // Set error details if not already set by SSE event
        if (!errorDetails) {
          setErrorDetails({
            code: isRateLimited ? 'rate_limited' : (isStreamCutoff ? 'function_timeout' : errorCode),
            message,
            batchIndex,
            phaseName: phaseName || undefined,
            isRecoverable: isRateLimited || isStreamCutoff,
            retryAfterMs: isRateLimited ? ((error as any).retryAfterMs || 30000) : undefined,
            savedWordCount: wordCount,
            timestamp: Date.now()
          });
        }

        setState('error');
      }
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState('idle');
    setClarifyingQuestions([]);
    setClarifyAnswers({});
    setErrorDetails(null);
  };

  const handleApply = () => {
    if (content && extractedCriteria) {
      onGuideGenerated(content, extractedCriteria, extractedCriteria.target_buyer_types);
      toast.success("Guide and criteria applied");
    }
  };

  const handleExport = () => {
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${industryName.replace(/\s+/g, '-')}-ma-guide.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Error panel handlers
  const handleErrorRetry = () => {
    setErrorDetails(null);
    handleGenerate(lastClarificationContextRef.current);
  };

  const handleErrorResume = () => {
    if (savedProgress) {
      setErrorDetails(null);
      resumeGeneration(savedProgress);
    } else if (content && errorDetails) {
      // Resume from current content if no saved progress
      setErrorDetails(null);
      setState('generating');
      abortControllerRef.current = new AbortController();
      generateBatch(errorDetails.batchIndex, content, lastClarificationContextRef.current);
    }
  };

  const handleErrorCancel = () => {
    setErrorDetails(null);
    setState('idle');
  };

  const progressPercent = totalPhases > 0 ? (currentPhase / totalPhases) * 100 : 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">M&A Research Guide</CardTitle>
              <CardDescription>
                {existingContent && existingContent.length > 100 
                  ? `${wordCount.toLocaleString()} word industry research guide`
                  : 'Generate comprehensive 30,000+ word industry research guide'
                }
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {state === 'complete' && (
              <Badge variant="default" className="bg-green-600">
                <Check className="h-3 w-3 mr-1" />
                Complete
              </Badge>
            )}
            {wordCount > 0 && state !== 'complete' && (
              <Badge variant="secondary">{wordCount.toLocaleString()} words</Badge>
            )}
            {/* Generate/Regenerate button always visible in header */}
            {(state === 'idle' || state === 'complete' || state === 'error') && !isOpen && (
              <Button 
                size="sm" 
                variant={existingContent && existingContent.length > 100 ? "outline" : "default"}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(true);
                  if (!existingContent || existingContent.length < 100) {
                    // Auto-trigger for new guides
                  }
                }}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                {existingContent && existingContent.length > 100 ? 'View Guide' : 'Run AI Research'}
              </Button>
            )}
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>
        </div>
        
        {/* Preview when collapsed and has content */}
        {!isOpen && existingContent && existingContent.length > 100 && (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground line-clamp-2">
              {existingContent.replace(/[#*`]/g, '').substring(0, 200)}...
            </p>
          </div>
        )}
      </CardHeader>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Duplicate guide warning */}
            {showDuplicateWarning && (
              <div className="flex items-center justify-between p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    A guide already exists ({(existingContent?.split(/\s+/).length || 0).toLocaleString()} words)
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Regenerating will replace the existing content.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={proceedWithClarification}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Regenerate Anyway
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowDuplicateWarning(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Resume interrupted generation */}
            {savedProgress && state === 'idle' && !showDuplicateWarning && (
              <div className="flex items-center justify-between p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Previous generation was interrupted at batch {savedProgress.batchIndex + 1}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {savedProgress.content.split(/\s+/).length.toLocaleString()} words generated
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => resumeGeneration(savedProgress)}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Resume
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clearProgress}>
                    Start Over
                  </Button>
                </div>
              </div>
            )}

            {/* Error Panel - shown when state is error and we have error details */}
            {state === 'error' && errorDetails && (
              <GuideGenerationErrorPanel
                errorDetails={errorDetails}
                onRetry={handleErrorRetry}
                onResume={handleErrorResume}
                onCancel={handleErrorCancel}
                hasCheckpoint={!!savedProgress || (content.length > 0 && errorDetails.savedWordCount !== undefined && errorDetails.savedWordCount > 0)}
                totalBatches={totalBatches}
              />
            )}

            {/* Industry Input - shown in idle state or error state without error panel */}
            {(state === 'idle' || state === 'complete' || (state === 'error' && !errorDetails)) && (
              <div className="space-y-4">
                <div className="flex gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="industry-name">Industry Name</Label>
                    <Input
                      id="industry-name"
                      placeholder="e.g., Collision Repair, HVAC, Pest Control, Restoration"
                      value={industryName}
                      onChange={(e) => setIndustryName(e.target.value)}
                    />
                  </div>
                  
                  <Button onClick={handleStartClarification} disabled={!industryName.trim()}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {state === 'complete' ? 'Regenerate' : 'Generate Guide'}
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="industry-description">Industry Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Textarea
                    id="industry-description"
                    placeholder="Provide a 2-3 sentence description of this industry to help guide the AI research. For example: 'Water damage restoration and mold remediation services for residential and commercial properties. Companies typically respond to insurance claims and emergency situations.'"
                    value={industryDescription}
                    onChange={(e) => setIndustryDescription(e.target.value)}
                    className="min-h-[80px] resize-none"
                  />
                </div>
              </div>
            )}

            {/* Clarification Questions UI */}
            {state === 'clarifying' && clarifyingQuestions.length > 0 && (
              <div className="border rounded-lg p-4 bg-muted/20 space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <MessageSquare className="h-5 w-5" />
                  <h3 className="font-semibold">Let's confirm the details before generating</h3>
                </div>
                
                <div className="space-y-4">
                  {clarifyingQuestions.map((q) => (
                    <div key={q.id} className="space-y-2">
                      <Label className="text-sm font-medium">{q.question}</Label>
                      
                      {q.type === 'text' ? (
                        <Textarea
                          placeholder={q.placeholder || 'Enter your answer...'}
                          value={(clarifyAnswers[q.id] as string) || ''}
                          onChange={(e) => handleTextAnswer(q.id, e.target.value)}
                          className="h-20"
                        />
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {q.options?.map((option) => {
                            const isSelected = q.type === 'multiSelect'
                              ? ((clarifyAnswers[q.id] as string[]) || []).includes(option)
                              : clarifyAnswers[q.id] === option;
                            
                            return (
                              <Button
                                key={option}
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleSelectOption(q.id, option, q.type === 'multiSelect')}
                                className="transition-all"
                              >
                                {isSelected && <Check className="h-3 w-3 mr-1" />}
                                {option}
                              </Button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button variant="outline" onClick={handleSkipClarification}>
                    Skip & Generate
                  </Button>
                  <Button onClick={handleConfirmAndGenerate}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Confirm & Generate
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Loading state for clarification */}
            {state === 'clarifying' && clarifyingQuestions.length === 0 && (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Analyzing industry...
              </div>
            )}

            {/* Progress - shown during generation */}
            {(state === 'generating' || state === 'quality_check' || state === 'gap_filling') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {state === 'generating' && (
                      <span>
                        Batch {currentBatch + 1}/{totalBatches} • Phase {currentPhase}/{totalPhases}: {phaseName}
                      </span>
                    )}
                    {state === 'quality_check' && 'Running quality check...'}
                    {state === 'gap_filling' && 'Filling content gaps...'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{wordCount.toLocaleString()} words</span>
                    <Button variant="ghost" size="sm" onClick={handleCancel}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Progress value={progressPercent} className="h-2" />
                <div className="text-xs text-muted-foreground text-center">
                  Auto-batching: 1 phase per batch for maximum reliability ({totalBatches} total batches)
                </div>
              </div>
            )}

            {/* Quality Result */}
            {qualityResult && (
              <div className={`p-3 rounded-lg border ${qualityResult.passed ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {qualityResult.passed ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                    )}
                    <span className="font-medium">
                      Quality Score: {qualityResult.score}/100
                    </span>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <Badge variant="outline">{qualityResult.wordCount.toLocaleString()} words</Badge>
                    <Badge variant="outline">{qualityResult.tableCount} tables</Badge>
                    {qualityResult.hasPrimaryFocus ? (
                      <Badge variant="default" className="bg-green-600">Primary Focus ✓</Badge>
                    ) : (
                      <Badge variant="destructive">Missing Primary Focus</Badge>
                    )}
                  </div>
                </div>
                {qualityResult.missingElements.length > 0 && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium">Needs improvement:</span> {qualityResult.missingElements.join(', ')}
                  </div>
                )}
              </div>
            )}

            {/* Content Preview */}
            {content && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Generated Content</Label>
                  <div className="flex gap-2">
                    {state === 'complete' && extractedCriteria && (
                      <Button size="sm" onClick={handleApply}>
                        <Check className="h-4 w-4 mr-1" />
                        Apply Criteria
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={handleExport}>
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </div>
                <ScrollArea className="h-[400px] border rounded-lg p-4" ref={contentRef}>
                  <div 
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: content }}
                  />
                </ScrollArea>
              </div>
            )}

            {/* Extracted Criteria Preview */}
            {extractedCriteria && state === 'complete' && (
              <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Extracted Criteria
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {extractedCriteria.size_criteria && (
                    <div>
                      <span className="text-muted-foreground">Size:</span>
                      <div className="font-medium">
                        {extractedCriteria.size_criteria.revenue_min && 
                          `$${(extractedCriteria.size_criteria.revenue_min / 1000000).toFixed(1)}M - $${((extractedCriteria.size_criteria.revenue_max || 0) / 1000000).toFixed(1)}M`}
                      </div>
                    </div>
                  )}
                  {extractedCriteria.geography_criteria?.target_states && (
                    <div>
                      <span className="text-muted-foreground">Geography:</span>
                      <div className="font-medium">
                        {extractedCriteria.geography_criteria.target_states.slice(0, 3).join(', ')}
                        {extractedCriteria.geography_criteria.target_states.length > 3 && 
                          ` +${extractedCriteria.geography_criteria.target_states.length - 3}`}
                      </div>
                    </div>
                  )}
                  {extractedCriteria.service_criteria?.primary_focus && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Primary Focus:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {extractedCriteria.service_criteria.primary_focus.map((s, i) => (
                          <Badge key={i} variant="default" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Gap Fill Progress */}
            {state === 'gap_filling' && missingElements.length > 0 && (
              <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
                  <span className="font-medium">Generating additional content for:</span>
                </div>
                <ul className="text-sm text-muted-foreground list-disc list-inside">
                  {missingElements.map((elem, i) => (
                    <li key={i}>{elem}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
