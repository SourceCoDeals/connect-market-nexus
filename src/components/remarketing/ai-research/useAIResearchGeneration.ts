import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithTimeout } from "@/lib/invoke-with-timeout";
import { useGuideGenerationState } from "@/hooks/remarketing/useGuideGenerationState";
import type { ErrorDetails } from "../GuideGenerationErrorPanel";
import type { GenerationSummary } from "../GenerationSummaryPanel";
import { saveGuideToDocuments } from "./helpers";
import { useGuideUpload } from "./useGuideUpload";
import { useClarification } from "./useClarification";
import { useBatchGeneration } from "./useBatchGeneration";
import { useBackgroundPolling } from "./useBackgroundPolling";
import type {
  GenerationState,
  QualityResult,
  ExtractedCriteria,
  ClarificationContext,
  AIResearchSectionProps,
  SavedProgress,
} from "./types";

export function useAIResearchGeneration(props: AIResearchSectionProps) {
  const { onGuideGenerated, universeName, existingContent, universeId, onDocumentAdded } = props;

  const [isOpen, setIsOpen] = useState(!!existingContent && existingContent.length > 100);
  const [industryName, setIndustryName] = useState(universeName || "");
  const [industryDescription, setIndustryDescription] = useState("");
  const [state, setState] = useState<GenerationState>('idle');
  const [currentPhase, setCurrentPhase] = useState(0);
  const [totalPhases, setTotalPhases] = useState(14);
  const [phaseName, setPhaseName] = useState("");
  const [content, setContent] = useState(existingContent || "");
  const [wordCount, setWordCount] = useState(0);
  const [qualityResult, setQualityResult] = useState<QualityResult | null>(null);
  const [, setExtractedCriteria] = useState<ExtractedCriteria | null>(null);
  const [missingElements, setMissingElements] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { isLoadingProgress, saveProgress: saveProgressToDb, markCompleted: markCompletedInDb, clearProgress: clearProgressInDb, getResumableProgress } = useGuideGenerationState(universeId);

  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [generationSummary, setGenerationSummary] = useState<GenerationSummary | null>(null);
  const generationStartTimeRef = useRef<number>(0);
  const lastClarificationContextRef = useRef<ClarificationContext>({});
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [completedDocumentUrl, setCompletedDocumentUrl] = useState<string | null>(null);
  const [, setIsExtracting] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(13);
  const [savedProgress, setSavedProgress] = useState<SavedProgress | null>(null);

  // Sub-hooks
  const { guideFileInputRef, isUploadingGuide, handleUploadGuide } = useGuideUpload({ universeId, onGuideGenerated, onDocumentAdded });

  const saveProgressBoth = useCallback((progressData: {
    industryName: string; batchIndex: number; content: string; clarificationContext: ClarificationContext;
    lastPhaseId?: string; lastPhase?: number; wordCount?: number;
  }) => {
    localStorage.setItem('ma_guide_progress', JSON.stringify(progressData));
    setSavedProgress(progressData);
    saveProgressToDb(progressData);
  }, [saveProgressToDb]);

  const batchGeneration = useBatchGeneration({
    industryName, industryDescription, existingContent, universeId, onDocumentAdded,
    state, setState, setCurrentPhase, setTotalPhases, setPhaseName, setContent, setWordCount,
    setQualityResult, setExtractedCriteria, setMissingElements, setErrorDetails, setGenerationSummary,
    setCurrentBatch, setTotalBatches, setSavedProgress,
    generationStartTimeRef, abortControllerRef, totalBatches, wordCount,
    saveProgressBoth, markCompletedInDb, saveGuideToDocuments,
  });

  const backgroundPolling = useBackgroundPolling({
    industryName, universeName, universeId, onGuideGenerated, onDocumentAdded,
    setState, setCurrentPhase, setTotalPhases, setPhaseName, setContent, setWordCount,
    setExtractedCriteria, setErrorDetails, setShowCompletionDialog, setCompletedDocumentUrl,
    wordCount,
  });

  const clearProgress = useCallback(() => {
    localStorage.removeItem('ma_guide_progress');
    setSavedProgress(null);
    clearProgressInDb();
  }, [clearProgressInDb]);

  const handleGenerate = useCallback(async (clarificationContext: ClarificationContext) => {
    if (universeId) {
      setGenerationSummary(null);
      generationStartTimeRef.current = Date.now();
      await backgroundPolling.handleBackgroundGenerate(clarificationContext);
      return;
    }
    setState('generating');
    setCurrentPhase(0); setCurrentBatch(0); setContent(""); setWordCount(0);
    setQualityResult(null); setExtractedCriteria(null); setMissingElements([]);
    setErrorDetails(null); setGenerationSummary(null);
    clearProgress();
    lastClarificationContextRef.current = clarificationContext;
    generationStartTimeRef.current = Date.now();
    abortControllerRef.current = new AbortController();
    await batchGeneration.generateBatch(0, "", clarificationContext);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universeId, clearProgress]);

  const clarification = useClarification(industryName, industryDescription, existingContent, handleGenerate);

  const handleStartClarification = async () => {
    setState('clarifying');
    const result = await clarification.handleStartClarification();
    if (result === 'idle') setState('idle');
  };

  const proceedWithClarification = async () => {
    setState('clarifying');
    const result = await clarification.proceedWithClarification();
    if (result === 'idle') setState('idle');
  };

  useEffect(() => { if (universeName && !industryName) setIndustryName(universeName); }, [universeName, industryName]);
  useEffect(() => { if (existingContent) { setContent(existingContent); setWordCount(existingContent.split(/\s+/).length); } }, [existingContent]);

  // Check for existing generation on mount
  const checkExistingGenerationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkExistingGeneration = useCallback(async () => {
    if (!universeId) return;
    try {
      const { data: activeGen, error: activeError } = await supabase.from('ma_guide_generations').select('*').eq('universe_id', universeId).in('status', ['pending', 'processing']).order('created_at', { ascending: false }).limit(1);
      if (!activeError && activeGen && activeGen.length > 0) {
        const gen = activeGen[0];
        toast.info('Resuming M&A guide generation in progress...');
        setIsOpen(true);
        setCurrentPhase(gen.phases_completed || 0);
        setTotalPhases(gen.total_phases || 14);
        setPhaseName(gen.current_phase || 'Resuming...');
        const gc = gen.generated_content as { content?: string; criteria?: ExtractedCriteria } | null;
        if (gc?.content) { setContent(gc.content); setWordCount(gc.content.split(/\s+/).length); }
        setState('generating');
        backgroundPolling.resumeBackgroundGeneration(gen.id);
        return;
      }
      const { data: completedGen, error: completedError } = await supabase.from('ma_guide_generations').select('*').eq('universe_id', universeId).eq('status', 'completed').order('completed_at', { ascending: false }).limit(1);
      if (!completedError && completedGen && completedGen.length > 0) {
        const gc = completedGen[0].generated_content as { content?: string; criteria?: ExtractedCriteria } | null;
        if (gc?.content) {
          setState('complete'); setContent(gc.content); setWordCount(gc.content.split(/\s+/).length);
          if (gc.criteria) { setExtractedCriteria(gc.criteria); onGuideGenerated(gc.content, gc.criteria, gc.criteria.target_buyer_types); }
          return;
        }
      }
      if (existingContent && existingContent.length > 500) setState('complete');
    } catch (err) { console.error('[AIResearchSection] checkExistingGeneration failed:', err); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universeId, existingContent]);

  checkExistingGenerationRef.current = checkExistingGeneration;
  useEffect(() => { if (universeId) checkExistingGenerationRef.current(); }, [universeId]);
  useEffect(() => { return () => backgroundPolling.cleanup(); }, [backgroundPolling]);

  // Check for saved progress on mount
  useEffect(() => {
    if (!isLoadingProgress) {
      const dbResumable = getResumableProgress();
      if (dbResumable && dbResumable.content) {
        setSavedProgress({ industryName: universeName || industryName, batchIndex: dbResumable.batchIndex, content: dbResumable.content, clarificationContext: {} });
        return;
      }
    }
    const saved = localStorage.getItem('ma_guide_progress');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.industryName === industryName || parsed.industryName === universeName) setSavedProgress(parsed);
      } catch { localStorage.removeItem('ma_guide_progress'); }
    }
  }, [industryName, universeName, isLoadingProgress, getResumableProgress]);

  const resumeGeneration = (progress: SavedProgress | null) => {
    if (!progress) return;
    setState('generating'); setCurrentBatch(progress.batchIndex); setContent(progress.content);
    setWordCount(progress.content.split(/\s+/).length); setGenerationSummary(null);
    if (!generationStartTimeRef.current) generationStartTimeRef.current = Date.now();
    abortControllerRef.current = new AbortController();
    toast.info(`Resuming from batch ${progress.batchIndex + 1}...`);
    batchGeneration.generateBatch(progress.batchIndex, progress.content, progress.clarificationContext);
  };

  const handleCancel = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setState('idle'); clarification.resetClarification(); setErrorDetails(null);
  };

  const handleExtractCriteria = async () => {
    const guideContent = existingContent || content;
    if (!guideContent || guideContent.length < 1000) { toast.error("Guide must have at least 1,000 characters"); return; }
    if (!universeId) { toast.error("Universe ID is required"); return; }
    setIsExtracting(true);
    try {
      const { data, error } = await invokeWithTimeout<{ criteria?: Record<string, unknown> }>('extract-buyer-criteria', {
        body: { universe_id: universeId, guide_content: guideContent, source_name: `${universeName || industryName} M&A Guide`, industry_name: universeName || industryName },
        timeoutMs: 120_000,
      });
      if (error) { if (error.message?.includes('402')) { toast.error("AI credits depleted.", { duration: 10000 }); return; } if (error.message?.includes('429')) { toast.warning("Rate limit reached."); return; } throw error; }
      if (!data?.success) throw new Error(data?.error || 'Extraction failed');
      const mapped: ExtractedCriteria = { size_criteria: data.criteria?.size_criteria, geography_criteria: data.criteria?.geography_criteria, service_criteria: data.criteria?.service_criteria, buyer_types_criteria: data.criteria?.buyer_types_criteria };
      setExtractedCriteria(mapped);
      onGuideGenerated(guideContent, mapped, data.target_buyer_types);
      toast.success(`Criteria extracted (${data.confidence || 0}% confidence)`, { duration: 5000 });
    } catch (error) { toast.error(`Failed: ${(error as Error).message}`); } finally { setIsExtracting(false); }
  };
  void handleExtractCriteria;

  const handleErrorRetry = () => { setErrorDetails(null); handleGenerate(lastClarificationContextRef.current); };
  const handleErrorResume = () => {
    if (savedProgress) { setErrorDetails(null); resumeGeneration(savedProgress); }
    else if (content && errorDetails) { setErrorDetails(null); setState('generating'); abortControllerRef.current = new AbortController(); batchGeneration.generateBatch(errorDetails.batchIndex, content, lastClarificationContextRef.current); }
  };
  const handleErrorCancel = () => { setErrorDetails(null); setState('idle'); };

  const progressPercent = totalPhases > 0 ? (currentPhase / totalPhases) * 100 : 0;

  return {
    isOpen, setIsOpen, industryName, setIndustryName, industryDescription, setIndustryDescription,
    state, currentPhase, totalPhases, phaseName, content, wordCount,
    qualityResult, missingElements, errorDetails, generationSummary, setGenerationSummary,
    showCompletionDialog, setShowCompletionDialog, completedDocumentUrl,
    clarifyingQuestions: clarification.clarifyingQuestions, clarifyAnswers: clarification.clarifyAnswers,
    clarifyingStatus: clarification.clarifyingStatus, setClarifyingStatus: clarification.setClarifyingStatus,
    showDuplicateWarning: clarification.showDuplicateWarning, setShowDuplicateWarning: clarification.setShowDuplicateWarning,
    currentBatch, totalBatches, savedProgress, isUploadingGuide, guideFileInputRef, progressPercent,
    handleUploadGuide, handleStartClarification, proceedWithClarification,
    handleSelectOption: clarification.handleSelectOption, handleTextAnswer: clarification.handleTextAnswer,
    handleConfirmAndGenerate: clarification.handleConfirmAndGenerate, handleSkipClarification: clarification.handleSkipClarification,
    handleCancel, handleErrorRetry, handleErrorResume, handleErrorCancel, resumeGeneration, clearProgress,
  };
}
