import { useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ErrorDetails } from "../GuideGenerationErrorPanel";
import { saveGuideToDocuments } from "./helpers";
import type {
  GenerationState,
  ExtractedCriteria,
  ClarificationContext,
} from "./types";

interface BackgroundPollingDeps {
  industryName: string;
  universeName?: string;
  universeId?: string;
  onGuideGenerated: (content: string, criteria: ExtractedCriteria, targetBuyerTypes?: ExtractedCriteria['target_buyer_types']) => void;
  onDocumentAdded?: (doc: { id: string; name: string; url: string; uploaded_at: string }) => void;
  setState: (s: GenerationState) => void;
  setCurrentPhase: (n: number) => void;
  setTotalPhases: (n: number) => void;
  setPhaseName: (s: string) => void;
  setContent: (s: string) => void;
  setWordCount: (n: number) => void;
  setExtractedCriteria: (c: ExtractedCriteria | null) => void;
  setErrorDetails: (e: ErrorDetails | null) => void;
  setShowCompletionDialog: (b: boolean) => void;
  setCompletedDocumentUrl: (s: string | null) => void;
  wordCount: number;
}

export function useBackgroundPolling(deps: BackgroundPollingDeps) {
  const pollIntervalRef = useRef<number | null>(null);
  const pollStartTimeRef = useRef<number | null>(null);

  const resumeBackgroundGeneration = (generationId: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollStartTimeRef.current = Date.now();
    const MAX_POLLING_DURATION_MS = 10 * 60 * 1000;

    pollIntervalRef.current = window.setInterval(async () => {
      if (pollStartTimeRef.current && Date.now() - pollStartTimeRef.current > MAX_POLLING_DURATION_MS) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        pollStartTimeRef.current = null;
        deps.setState('error');
        deps.setErrorDetails({
          code: 'polling_timeout',
          message: 'Background generation exceeded 10-minute timeout.',
          batchIndex: 0,
          isRecoverable: true,
          savedWordCount: deps.wordCount,
          timestamp: Date.now()
        });
        toast.error('Generation timed out after 10 minutes.');
        return;
      }

      const { data: generation, error } = await supabase
        .from('ma_guide_generations')
        .select('*')
        .eq('id', generationId)
        .maybeSingle();

      if (error || !generation) return;

      deps.setCurrentPhase(generation.phases_completed);
      deps.setTotalPhases(generation.total_phases);
      deps.setPhaseName(generation.current_phase || '');

      const generatedContent = generation.generated_content as { content?: string; criteria?: ExtractedCriteria } | null;
      if (generatedContent?.content) {
        deps.setContent(generatedContent.content);
        deps.setWordCount(generatedContent.content.split(/\s+/).length);
      }

      if (generation.status === 'completed') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        pollStartTimeRef.current = null;
        deps.setState('complete');

        const finalContent = generatedContent?.content || '';
        const criteria = generatedContent?.criteria;
        deps.setContent(finalContent);
        deps.setWordCount(finalContent.split(/\s+/).length);

        if (criteria) {
          deps.setExtractedCriteria(criteria);
          deps.onGuideGenerated(finalContent, criteria, criteria.target_buyer_types);
        }

        if (finalContent && deps.universeId && deps.onDocumentAdded) {
          saveGuideToDocuments(
            finalContent,
            deps.industryName || deps.universeName || 'M&A Guide',
            deps.universeId,
            deps.onDocumentAdded,
            (url) => deps.setCompletedDocumentUrl(url)
          );
        }

        deps.setShowCompletionDialog(true);
      }

      if (generation.status === 'failed') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        pollStartTimeRef.current = null;
        deps.setState('error');
        deps.setErrorDetails({
          code: 'generation_failed',
          message: generation.error || 'Generation failed',
          batchIndex: 0,
          isRecoverable: true,
          savedWordCount: 0,
          timestamp: Date.now()
        });
        toast.error(`Generation failed: ${generation.error}`);
      }
    }, 2000);
  };

  const handleBackgroundGenerate = async (clarificationContext: ClarificationContext) => {
    deps.setState('generating');
    deps.setCurrentPhase(0);
    deps.setContent("");
    deps.setWordCount(0);
    deps.setErrorDetails(null);

    try {
      if (deps.universeId && Object.keys(clarificationContext).length > 0) {
        const { error: ctxError } = await supabase
          .from('remarketing_buyer_universes')
          .update({ ma_guide_qa_context: clarificationContext })
          .eq('id', deps.universeId);
        if (ctxError) throw ctxError;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData?.session?.access_token;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ma-guide-background`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          },
          body: JSON.stringify({ universe_id: deps.universeId })
        }
      );

      if (!response.ok) throw new Error(`Failed to start generation: ${response.statusText}`);

      const data = await response.json();
      toast.success('Guide generation started in background.');
      resumeBackgroundGeneration(data.generation_id);

    } catch (error: unknown) {
      deps.setState('error');
      toast.error(error instanceof Error ? error.message : 'Failed to start background generation');
    }
  };

  const cleanup = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  return {
    resumeBackgroundGeneration,
    handleBackgroundGenerate,
    cleanup,
  };
}
