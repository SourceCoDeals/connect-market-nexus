import { useRef } from "react";
import { toast } from "sonner";
import type { ErrorDetails } from "../GuideGenerationErrorPanel";
import type { GenerationSummary } from "../GenerationSummaryPanel";
import { getSessionToken } from "./helpers";
import type {
  GenerationState,
  QualityResult,
  ExtractedCriteria,
  ClarificationContext,
  SavedProgress,
} from "./types";

interface BatchGenerationDeps {
  industryName: string;
  industryDescription: string;
  existingContent?: string;
  universeId?: string;
  onDocumentAdded?: (doc: { id: string; name: string; url: string; uploaded_at: string }) => void;
  state: GenerationState;
  setState: (s: GenerationState) => void;
  setCurrentPhase: (n: number) => void;
  setTotalPhases: (n: number) => void;
  setPhaseName: (s: string) => void;
  setContent: (s: string) => void;
  setWordCount: (n: number) => void;
  setQualityResult: (r: QualityResult | null) => void;
  setExtractedCriteria: (c: ExtractedCriteria | null) => void;
  setMissingElements: (m: string[]) => void;
  setErrorDetails: (e: ErrorDetails | null) => void;
  setGenerationSummary: (s: GenerationSummary | null) => void;
  setCurrentBatch: (n: number) => void;
  setTotalBatches: (n: number) => void;
  setSavedProgress: (p: SavedProgress | null) => void;
  generationStartTimeRef: React.MutableRefObject<number>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  totalBatches: number;
  wordCount: number;
  saveProgressBoth: (data: {
    industryName: string;
    batchIndex: number;
    content: string;
    clarificationContext: ClarificationContext;
    lastPhaseId?: string;
    lastPhase?: number;
    wordCount?: number;
  }) => void;
  markCompletedInDb: () => void;
  saveGuideToDocuments: (
    content: string,
    industryName: string,
    universeId: string,
    onDocumentAdded: (doc: { id: string; name: string; url: string; uploaded_at: string }) => void,
    onComplete?: (documentUrl: string) => void
  ) => Promise<string | null>;
}

export function useBatchGeneration(deps: BatchGenerationDeps) {
  const MAX_BATCH_RETRIES = 5;
  const batchRetryCountRef = useRef<Record<number, number>>({});
  const nextBatchInfo = useRef<{
    index: number;
    content: string;
    clarificationContext: ClarificationContext;
  } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const generateBatch = async (
    batchIndex: number,
    previousContent: string,
    clarificationContext: ClarificationContext
  ) => {
    let batchWordCount = previousContent ? previousContent.split(/\s+/).length : 0;

    try {
      deps.setCurrentBatch(batchIndex);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ma-guide`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await getSessionToken()}`,
          },
          body: JSON.stringify({
            industry_name: deps.industryName,
            industry_description: deps.industryDescription || undefined,
            existing_content: deps.existingContent,
            clarification_context: clarificationContext,
            stream: true,
            batch_index: batchIndex,
            previous_content: previousContent
          }),
          signal: deps.abortControllerRef.current?.signal
        }
      );

      if (!response.ok) {
        if (response.status === 402) {
          toast.error("AI credits depleted.", { duration: 10000 });
          deps.setState('error');
          return;
        }
        if (response.status === 429) {
          toast.warning("Rate limit reached.");
          deps.setState('error');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = previousContent;
      let sawBatchComplete = false;
      let parseErrorCount = 0;
      const PARSE_ERROR_THRESHOLD = 5;
      let accumulatedWordCount = previousContent ? previousContent.split(/\s+/).length : 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
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
                break;
              case 'batch_start':
                deps.setTotalBatches(event.total_batches);
                deps.setCurrentBatch(event.batch_index);
                break;
              case 'phase_start':
                deps.setCurrentPhase(event.phase);
                deps.setTotalPhases(event.total);
                deps.setPhaseName(event.name);
                break;
              case 'content':
                fullContent += event.content;
                accumulatedWordCount = fullContent.split(/\s+/).length;
                batchWordCount = accumulatedWordCount;
                deps.setContent(fullContent);
                deps.setWordCount(accumulatedWordCount);
                if (contentRef.current) {
                  contentRef.current.scrollTop = contentRef.current.scrollHeight;
                }
                break;
              case 'phase_complete':
                accumulatedWordCount = event.wordCount || fullContent.split(/\s+/).length;
                batchWordCount = accumulatedWordCount;
                deps.setWordCount(accumulatedWordCount);
                if (event.content) {
                  fullContent = event.content;
                  accumulatedWordCount = fullContent.split(/\s+/).length;
                  deps.saveProgressBoth({
                    industryName: deps.industryName,
                    batchIndex,
                    content: event.content,
                    clarificationContext,
                    lastPhaseId: event.phaseId,
                    lastPhase: event.phase,
                    wordCount: accumulatedWordCount
                  });
                }
                break;
              case 'batch_complete':
                sawBatchComplete = true;
                if (batchRetryCountRef.current[batchIndex]) {
                  delete batchRetryCountRef.current[batchIndex];
                }
                if (!event.is_final && event.next_batch_index !== null) {
                  nextBatchInfo.current = {
                    index: event.next_batch_index,
                    content: event.content,
                    clarificationContext
                  };
                  deps.saveProgressBoth({
                    industryName: deps.industryName,
                    batchIndex: event.next_batch_index,
                    content: event.content,
                    clarificationContext,
                    lastPhaseId: `batch_${batchIndex}_complete`,
                    lastPhase: batchIndex + 1,
                    wordCount: event.wordCount || event.content?.split(/\s+/).length || 0
                  });
                }
                break;
              case 'quality_check_start':
                deps.setState('quality_check');
                break;
              case 'quality_check_result':
                deps.setQualityResult(event.result);
                break;
              case 'gap_fill_start':
                deps.setState('gap_filling');
                deps.setMissingElements(event.missingElements || []);
                break;
              case 'gap_fill_complete':
              case 'final_quality':
                if (event.result) deps.setQualityResult(event.result);
                break;
              case 'criteria_extraction_start':
                break;
              case 'criteria':
                deps.setExtractedCriteria(event.criteria);
                break;
              case 'complete': {
                deps.setState('complete');
                const finalContent = event.content || fullContent;
                const finalWordCount = event.totalWords || finalContent.split(/\s+/).length;
                deps.setContent(finalContent);
                deps.setWordCount(finalWordCount);
                localStorage.removeItem('ma_guide_progress');
                deps.setSavedProgress(null);
                deps.markCompletedInDb();
                deps.setGenerationSummary({
                  outcome: 'success',
                  startTime: deps.generationStartTimeRef.current,
                  endTime: Date.now(),
                  batchesCompleted: deps.totalBatches,
                  totalBatches: deps.totalBatches,
                  wordCount: finalWordCount,
                  isRecoverable: false
                });
                toast.success("M&A Guide generated successfully!");
                if (deps.universeId && deps.onDocumentAdded) {
                  deps.saveGuideToDocuments(finalContent, deps.industryName, deps.universeId, deps.onDocumentAdded);
                }
                break;
              }
              case 'error': {
                const errorCode = event.error_code || 'unknown';
                deps.setErrorDetails({
                  code: errorCode,
                  message: event.message || 'Unknown error',
                  batchIndex: event.batch_index ?? batchIndex,
                  phaseName: undefined,
                  isRecoverable: event.recoverable ?? true,
                  retryAfterMs: event.retry_after_ms,
                  savedWordCount: event.saved_word_count || fullContent.split(/\s+/).length,
                  timestamp: Date.now()
                });
                if (errorCode === 'payment_required') {
                  toast.error("AI credits depleted.", { duration: 10000 });
                  deps.setState('error');
                  return;
                }
                if (errorCode === 'rate_limited') {
                  const rateLimitErr = new Error(event.message) as Error & { isRateLimited: boolean; retryAfterMs: number };
                  rateLimitErr.isRateLimited = true;
                  rateLimitErr.retryAfterMs = event.retry_after_ms || 30000;
                  throw rateLimitErr;
                }
                throw new Error(event.message);
              }
              case 'timeout_warning':
                toast.warning(event.message || 'Approaching time limit, saving progress...', { duration: 5000 });
                break;
            }
          } catch (e) {
            parseErrorCount++;
            console.warn('[useBatchGeneration] Failed to parse SSE event', {
              batchIndex,
              snippet: jsonStr.slice(0, 200),
              error: e,
              parseErrorCount
            });
            if (parseErrorCount === PARSE_ERROR_THRESHOLD) {
              toast.warning(
                `Detected ${PARSE_ERROR_THRESHOLD} stream parsing errors.`,
                { duration: 8000 }
              );
            }
          }
        }
      }

      if (!sawBatchComplete) {
        const timeoutError = new Error(
          `Stream ended unexpectedly during batch ${batchIndex + 1}.`
        );
        const augmentedError = timeoutError as Error & { code: string };
        augmentedError.code = 'function_timeout';
        throw augmentedError;
      }

      if (nextBatchInfo.current) {
        const { index, content: nextContent, clarificationContext: ctx } = nextBatchInfo.current;
        nextBatchInfo.current = null;
        const interBatchDelay = index >= 11 ? 5000 : (index >= 8 ? 3000 : 1000);
        await new Promise(r => setTimeout(r, interBatchDelay));
        toast.info(`Batch ${batchIndex + 1} complete, starting batch ${index + 1}...`);
        deps.abortControllerRef.current = new AbortController();
        await generateBatch(index, nextContent, ctx);
        return;
      }

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        deps.setGenerationSummary({
          outcome: 'cancelled',
          startTime: deps.generationStartTimeRef.current,
          endTime: Date.now(),
          batchesCompleted: batchIndex,
          totalBatches: deps.totalBatches,
          wordCount: deps.wordCount,
          isRecoverable: true
        });
        toast.info("Generation cancelled");
        deps.setState('idle');
        deps.setErrorDetails(null);
      } else {
        const typedError = error as Error & { code?: string; isRateLimited?: boolean; retryAfterMs?: number };
        const message = typedError.message || 'Unknown error';
        const errorCode = typedError.code || 'unknown';

        const isStreamCutoff = message.includes('Stream ended unexpectedly') || errorCode === 'function_timeout';
        const isRateLimited =
          typedError.isRateLimited ||
          message.includes('Rate limit') ||
          message.includes('rate_limited') ||
          message.includes('RESOURCE_EXHAUSTED');

        const currentRetries = batchRetryCountRef.current[batchIndex] ?? 0;
        if (deps.state === 'generating' && (isStreamCutoff || isRateLimited) && currentRetries < MAX_BATCH_RETRIES) {
          batchRetryCountRef.current[batchIndex] = currentRetries + 1;
          const baseBackoff = isRateLimited ? 30000 : Math.min(5000 * Math.pow(2, currentRetries), 30000);
          const batchPenalty = batchIndex >= 8 ? 5000 * (batchIndex - 7) : 0;
          const backoffMs = typedError.retryAfterMs || (baseBackoff + batchPenalty);

          toast.info(
            isRateLimited
              ? `Rate limit hit. Waiting ${Math.round(backoffMs / 1000)}s (${currentRetries + 1}/${MAX_BATCH_RETRIES})...`
              : `Batch ${batchIndex + 1} timeout. Retrying (${currentRetries + 1}/${MAX_BATCH_RETRIES})...`
          );

          await new Promise((r) => setTimeout(r, backoffMs));
          deps.abortControllerRef.current = new AbortController();
          await generateBatch(batchIndex, previousContent, clarificationContext);
          return;
        }

        const outcomeType = isRateLimited ? 'rate_limited' : (isStreamCutoff ? 'timeout' : 'error');
        deps.setGenerationSummary({
          outcome: outcomeType,
          startTime: deps.generationStartTimeRef.current,
          endTime: Date.now(),
          batchesCompleted: batchIndex,
          totalBatches: deps.totalBatches,
          wordCount: batchWordCount,
          errorMessage: message,
          isRecoverable: isRateLimited || isStreamCutoff
        });

        deps.setErrorDetails({
          code: isRateLimited ? 'rate_limited' : (isStreamCutoff ? 'function_timeout' : errorCode),
          message,
          batchIndex,
          isRecoverable: isRateLimited || isStreamCutoff,
          retryAfterMs: isRateLimited ? (typedError.retryAfterMs || 30000) : undefined,
          savedWordCount: batchWordCount,
          timestamp: Date.now()
        });

        deps.setState('error');
      }
    }
  };

  const resetRetries = () => {
    batchRetryCountRef.current = {};
  };

  return { generateBatch, resetRetries };
}
