import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BuyerEnrichmentProgress {
  isEnriching: boolean;
  completedCount: number;
  totalCount: number;
  failedCount: number;
  progress: number;
  processingRate: number;
  estimatedTimeRemaining: string;
}

const EMPTY: BuyerEnrichmentProgress = {
  isEnriching: false,
  completedCount: 0,
  totalCount: 0,
  failedCount: 0,
  progress: 0,
  processingRate: 0,
  estimatedTimeRemaining: '',
};

/**
 * Global buyer enrichment progress — polls buyer_enrichment_queue
 * without requiring a universe filter. Works on the All Buyers page.
 */
export function useBuyerEnrichmentProgress() {
  const [progress, setProgress] = useState<BuyerEnrichmentProgress>(EMPTY);
  const startTimeRef = useRef<number | null>(null);
  const initialCompletedRef = useRef(0);
  const lastFetchRef = useRef(0);
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchRef.current < 3000) return;
    lastFetchRef.current = now;

    try {
      const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

      const [pendingRes, processingRes, completedRes, failedRes] = await Promise.all([
        supabase.from('buyer_enrichment_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending').gte('queued_at', cutoff),
        supabase.from('buyer_enrichment_queue').select('*', { count: 'exact', head: true }).eq('status', 'processing').gte('queued_at', cutoff),
        supabase.from('buyer_enrichment_queue').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('queued_at', cutoff),
        supabase.from('buyer_enrichment_queue').select('*', { count: 'exact', head: true }).eq('status', 'failed').gte('queued_at', cutoff),
      ]);

      const pending = pendingRes.count ?? 0;
      const processing = processingRes.count ?? 0;
      const completed = completedRes.count ?? 0;
      const failed = failedRes.count ?? 0;

      const totalActive = pending + processing;
      const totalCount = totalActive + completed + failed;
      const isEnriching = processing > 0 || (pending > 0 && completed > 0);

      if (isEnriching && !startTimeRef.current) {
        startTimeRef.current = Date.now();
        initialCompletedRef.current = completed;
      } else if (!isEnriching) {
        startTimeRef.current = null;
        initialCompletedRef.current = 0;
      }

      let processingRate = 0;
      if (startTimeRef.current && completed > initialCompletedRef.current) {
        const elapsedMin = (Date.now() - startTimeRef.current) / 60000;
        if (elapsedMin > 0.1) processingRate = (completed - initialCompletedRef.current) / elapsedMin;
      }

      let estimatedTimeRemaining = '';
      if (processingRate > 0 && totalActive > 0) {
        const mins = totalActive / processingRate;
        if (mins < 1) estimatedTimeRemaining = 'less than 1 min';
        else if (mins < 60) estimatedTimeRemaining = `${Math.ceil(mins)} min`;
        else estimatedTimeRemaining = `${Math.floor(mins / 60)}h ${Math.ceil(mins % 60)}m`;
      }

      setProgress({
        isEnriching,
        completedCount: completed + failed,
        totalCount,
        failedCount: failed,
        progress: totalCount > 0 ? (completed / totalCount) * 100 : 0,
        processingRate,
        estimatedTimeRemaining,
      });
    } catch (err) {
      console.error('Error fetching buyer enrichment status:', err);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    const channel = supabase
      .channel('buyer-enrichment-progress-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buyer_enrichment_queue' }, () => {
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = setTimeout(() => {
          lastFetchRef.current = 0;
          fetchStatus();
        }, 2000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    };
  }, [fetchStatus]);

  // Adjust polling rate based on activity
  useEffect(() => {
    const interval = progress.isEnriching ? 10000 : 120000;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchStatus, interval);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [progress.isEnriching, fetchStatus]);

  const cancel = useCallback(async () => {
    await supabase.from('buyer_enrichment_queue').delete().in('status', ['pending', 'processing']);
    startTimeRef.current = null;
    initialCompletedRef.current = 0;
    setProgress(EMPTY);
  }, []);

  return { progress, cancel };
}
