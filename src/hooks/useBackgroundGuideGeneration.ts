import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeWithTimeout } from '@/lib/invoke-with-timeout';
import { toast } from 'sonner';
import { useGlobalGateCheck } from '@/hooks/remarketing/useGlobalActivityQueue';

interface GenerationStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  current_phase: string | null;
  phases_completed: number;
  total_phases: number;
  generated_content: any;
  error: string | null;
  started_at: string;
  completed_at: string | null;
}

interface UseBackgroundGuideGenerationProps {
  universeId: string;
  onComplete?: (content: string, criteria: any) => void;
  onError?: (error: string) => void;
}

export function useBackgroundGuideGeneration({
  universeId,
  onComplete,
  onError
}: UseBackgroundGuideGenerationProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentGeneration, setCurrentGeneration] = useState<GenerationStatus | null>(null);
  const [progress, setProgress] = useState(0);
  const { startOrQueueMajorOp } = useGlobalGateCheck();

  const pollIntervalRef = useRef<number | null>(null);
  const hasCompletedRef = useRef(false);

  // Check if there's an existing generation in progress when component mounts
  useEffect(() => {
    checkExistingGeneration();
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [universeId]);

  const checkExistingGeneration = async () => {
    try {
      // Check for in-progress generation first
      const { data: activeGen, error: activeError } = await supabase
        .from('ma_guide_generations')
        .select('*')
        .eq('universe_id', universeId)
        .in('status', ['pending', 'processing'])
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (!activeError && activeGen) {
        const generation = activeGen as GenerationStatus;
        setCurrentGeneration(generation);
        setIsGenerating(true);

        // Restore progress from the database record
        const progressPercent = Math.round((generation.phases_completed / generation.total_phases) * 100);
        setProgress(progressPercent);
        
        startPolling(generation.id);
      }
    } catch (err) {
      // No existing generation, that's fine
      console.log('No existing generation found');
    }
  };

  const startGeneration = async () => {
    if (isGenerating) {
      toast.error('Generation already in progress');
      return;
    }

    setIsGenerating(true);
    hasCompletedRef.current = false;

    try {
      // Gate check: register as major operation
      const { data: sessionData } = await supabase.auth.getUser();
      const { queued } = await startOrQueueMajorOp({
        operationType: 'guide_generation',
        totalItems: 14, // 14 phases
        description: 'Generate M&A Guide',
        userId: sessionData?.user?.id || 'unknown',
      });
      if (queued) {
        setIsGenerating(false);
        return;
      }

      // Call the background generation endpoint using supabase functions invoke
      const { data, error } = await invokeWithTimeout<{ generation_id: string }>('generate-ma-guide-background', {
        body: { universe_id: universeId },
        timeoutMs: 120_000,
      });

      if (error) {
        throw new Error(error.message || 'Failed to start generation');
      }

      toast.success('Guide generation started. You can navigate away - it will continue in the background.');

      // Start polling for progress
      startPolling(data.generation_id);

    } catch (error: any) {
      console.error('Failed to start generation:', error);
      toast.error(error.message || 'Failed to start guide generation');
      setIsGenerating(false);
      if (onError) {
        onError(error.message);
      }
    }
  };

  const startPolling = (generationId: string) => {
    // Clear any existing poll interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Poll every 2 seconds
    pollIntervalRef.current = window.setInterval(async () => {
      await checkGenerationStatus(generationId);
    }, 2000);

    // Also check immediately
    checkGenerationStatus(generationId);
  };

  const checkGenerationStatus = async (generationId: string) => {
    try {
      const { data, error } = await supabase
        .from('ma_guide_generations')
        .select('*')
        .eq('id', generationId)
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error('Generation not found');
      }

      const generation = data as GenerationStatus;
      setCurrentGeneration(generation);

      // Calculate progress percentage
      const progressPercent = Math.round((generation.phases_completed / generation.total_phases) * 100);
      setProgress(progressPercent);

      // Handle completion
      if (generation.status === 'completed' && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        handleGenerationComplete(generation);
      }

      // Handle failure
      if (generation.status === 'failed' && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        handleGenerationFailed(generation);
      }

      // Stop polling if no longer processing
      if (generation.status !== 'pending' && generation.status !== 'processing') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setIsGenerating(false);
      }

    } catch (error: any) {
      console.error('Error checking generation status:', error);

      // Don't show errors on every poll, just log them
      // Only show error if polling fails multiple times in a row
    }
  };

  const handleGenerationComplete = (generation: GenerationStatus) => {
    console.log('Generation completed:', generation);

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    setIsGenerating(false);

    const content = generation.generated_content?.content || '';
    const criteria = generation.generated_content?.criteria || null;

    toast.success('M&A Guide generation completed!', { duration: 5000 });

    if (onComplete) {
      onComplete(content, criteria);
    }
  };

  const handleGenerationFailed = (generation: GenerationStatus) => {
    console.error('Generation failed:', generation.error);

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    setIsGenerating(false);

    const errorMessage = generation.error || 'Generation failed for unknown reason';
    toast.error(`Guide generation failed: ${errorMessage}`, { duration: 10000 });

    if (onError) {
      onError(errorMessage);
    }
  };

  const cancelGeneration = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsGenerating(false);
    setCurrentGeneration(null);
    setProgress(0);
    toast.info('Stopped monitoring generation progress. The generation will continue in the background.');
  };

  return {
    isGenerating,
    currentGeneration,
    progress,
    startGeneration,
    cancelGeneration,
    phaseName: currentGeneration?.current_phase || '',
    phasesCompleted: currentGeneration?.phases_completed || 0,
    totalPhases: currentGeneration?.total_phases || 14
  };
}
