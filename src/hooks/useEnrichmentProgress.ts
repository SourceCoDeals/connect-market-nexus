import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface EnrichmentProgress {
  isEnriching: boolean;
  completedCount: number;
  totalCount: number;
  pendingCount: number;
  processingCount: number;
  failedCount: number;
  progress: number;
  estimatedTimeRemaining: string;
  processingRate: number;
}

export function useEnrichmentProgress() {
  const [progress, setProgress] = useState<EnrichmentProgress>({
    isEnriching: false,
    completedCount: 0,
    totalCount: 0,
    pendingCount: 0,
    processingCount: 0,
    failedCount: 0,
    progress: 0,
    estimatedTimeRemaining: '',
    processingRate: 0,
  });

  // Track timing for rate calculation
  const startTimeRef = useRef<number | null>(null);
  const initialCompletedRef = useRef<number>(0);

  const fetchQueueStatus = useCallback(async () => {
    try {
      // Get counts by status
      const { data, error } = await supabase
        .from('enrichment_queue')
        .select('status')
        .in('status', ['pending', 'processing', 'completed', 'failed']);

      if (error) throw error;

      const counts = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      };

      data?.forEach((row) => {
        const status = row.status as keyof typeof counts;
        if (counts[status] !== undefined) {
          counts[status]++;
        }
      });

      const totalActive = counts.pending + counts.processing;
      const totalCount = totalActive + counts.completed;
      const isEnriching = totalActive > 0;

      // Track timing for rate calculation
      if (isEnriching && !startTimeRef.current) {
        startTimeRef.current = Date.now();
        initialCompletedRef.current = counts.completed;
      } else if (!isEnriching) {
        startTimeRef.current = null;
        initialCompletedRef.current = 0;
      }

      // Calculate processing rate (deals per minute)
      let processingRate = 0;
      if (startTimeRef.current && counts.completed > initialCompletedRef.current) {
        const elapsedMinutes = (Date.now() - startTimeRef.current) / 60000;
        if (elapsedMinutes > 0.1) { // Wait at least 6 seconds before calculating rate
          const completedSinceStart = counts.completed - initialCompletedRef.current;
          processingRate = completedSinceStart / elapsedMinutes;
        }
      }

      // Calculate estimated time remaining
      let estimatedTimeRemaining = '';
      if (processingRate > 0 && totalActive > 0) {
        const minutesRemaining = totalActive / processingRate;
        if (minutesRemaining < 1) {
          estimatedTimeRemaining = 'less than 1 min';
        } else if (minutesRemaining < 60) {
          estimatedTimeRemaining = `${Math.ceil(minutesRemaining)} min`;
        } else {
          const hours = Math.floor(minutesRemaining / 60);
          const mins = Math.ceil(minutesRemaining % 60);
          estimatedTimeRemaining = `${hours}h ${mins}m`;
        }
      } else if (totalActive > 0 && !processingRate) {
        // Use historical rate of ~20 deals/min based on memory
        const estimatedMins = Math.ceil(totalActive / 20);
        estimatedTimeRemaining = estimatedMins < 1 ? 'less than 1 min' : `~${estimatedMins} min`;
      }

      const progressPercent = totalCount > 0 ? (counts.completed / totalCount) * 100 : 0;

      setProgress({
        isEnriching,
        completedCount: counts.completed,
        totalCount,
        pendingCount: counts.pending,
        processingCount: counts.processing,
        failedCount: counts.failed,
        progress: progressPercent,
        estimatedTimeRemaining,
        processingRate,
      });

    } catch (error) {
      console.error('Error fetching enrichment queue status:', error);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchQueueStatus();

    // Subscribe to changes on enrichment_queue
    const channel = supabase
      .channel('enrichment-progress')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'enrichment_queue',
        },
        () => {
          fetchQueueStatus();
        }
      )
      .subscribe();

    // Also poll every 5 seconds as a fallback
    const interval = setInterval(fetchQueueStatus, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchQueueStatus]);

  return progress;
}
