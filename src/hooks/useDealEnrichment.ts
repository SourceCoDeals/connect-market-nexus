import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export interface DealEnrichmentStatus {
  dealId: string;
  status: 'pending' | 'enriching' | 'success' | 'error' | 'skipped';
  error?: string;
  errorCode?: string;
}

export interface DealEnrichmentProgress {
  current: number;
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  statuses: Map<string, DealEnrichmentStatus>;
  isRunning: boolean;
  isCancelled: boolean;
  creditsDepleted: boolean;
}

const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 1500;

export function useDealEnrichment(universeId?: string) {
  const queryClient = useQueryClient();
  const cancelledRef = useRef(false);
  
  const [progress, setProgress] = useState<DealEnrichmentProgress>({
    current: 0,
    total: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    statuses: new Map(),
    isRunning: false,
    isCancelled: false,
    creditsDepleted: false,
  });

  const updateStatus = useCallback((dealId: string, status: DealEnrichmentStatus) => {
    setProgress(prev => {
      const newStatuses = new Map(prev.statuses);
      newStatuses.set(dealId, status);
      return { ...prev, statuses: newStatuses };
    });
  }, []);

  const enrichDeals = useCallback(async (
    deals: Array<{ id: string; listingId: string; enrichedAt?: string | null; hasWebsite?: boolean }>
  ) => {
    // Filter to deals that need enrichment (not yet enriched, or force refresh)
    const enrichableDeals = deals.filter(d => d.listingId);

    if (enrichableDeals.length === 0) {
      toast.info('No deals to enrich');
      return;
    }

    cancelledRef.current = false;
    
    // Initialize statuses
    const initialStatuses = new Map<string, DealEnrichmentStatus>();
    enrichableDeals.forEach(d => {
      initialStatuses.set(d.listingId, { dealId: d.listingId, status: 'pending' });
    });

    setProgress({
      current: 0,
      total: enrichableDeals.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      statuses: initialStatuses,
      isRunning: true,
      isCancelled: false,
      creditsDepleted: false,
    });

    let successful = 0;
    let failed = 0;
    let skipped = 0;
    let creditsDepleted = false;
    let rateLimited = false;

    // Process in parallel batches
    for (let i = 0; i < enrichableDeals.length; i += BATCH_SIZE) {
      // Check for cancellation
      if (cancelledRef.current) {
        setProgress(prev => ({ ...prev, isRunning: false, isCancelled: true }));
        toast.info(`Enrichment cancelled. ${successful} of ${enrichableDeals.length} deals enriched.`);
        break;
      }

      const batch = enrichableDeals.slice(i, i + BATCH_SIZE);
      
      // Mark batch as enriching
      batch.forEach(deal => {
        updateStatus(deal.listingId, { dealId: deal.listingId, status: 'enriching' });
      });

      // Process batch in parallel
      const results = await Promise.allSettled(
        batch.map(async (deal) => {
          const { data, error } = await supabase.functions.invoke('enrich-deal', {
            body: { dealId: deal.listingId }
          });
          
          if (error) throw error;
          
          // Check for error in response body
          if (data && !data.success) {
            const errorObj = new Error(data.error || 'Enrichment failed');
            (errorObj as any).errorCode = data.error_code;
            throw errorObj;
          }
          
          return data;
        })
      );

      // Process results
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const deal = batch[j];
        
        if (result.status === 'fulfilled') {
          successful++;
          updateStatus(deal.listingId, { 
            dealId: deal.listingId, 
            status: 'success'
          });
        } else {
          failed++;
          const error = result.reason;
          const errorMessage = error?.message || 'Unknown error';
          const errorCode = (error as any)?.errorCode;
          
          updateStatus(deal.listingId, { 
            dealId: deal.listingId, 
            status: 'error', 
            error: errorMessage,
            errorCode 
          });

          // Check for payment/credits error - fail fast
          if (
            errorCode === 'payment_required' ||
            errorMessage.includes('402') ||
            errorMessage.includes('credits') ||
            errorMessage.includes('payment')
          ) {
            creditsDepleted = true;
            setProgress(prev => ({ 
              ...prev, 
              current: i + batch.length,
              successful,
              failed,
              skipped,
              isRunning: false,
              creditsDepleted: true
            }));
            
            toast.error(
              'AI credits depleted. Please add credits in Settings → Workspace → Usage to continue enrichment.',
              { duration: 10000 }
            );
            
            // Invalidate queries to show partial results
            if (universeId) {
              queryClient.invalidateQueries({ queryKey: ['remarketing', 'universe-deals', universeId] });
            }
            
            return { successful, failed, skipped, creditsDepleted: true };
          }

          // Check for rate limit error - fail fast
          if (
            errorCode === 'rate_limited' ||
            errorMessage.includes('429') ||
            errorMessage.toLowerCase().includes('rate limit')
          ) {
            rateLimited = true;

            setProgress(prev => ({
              ...prev,
              current: i + batch.length,
              successful,
              failed,
              skipped,
              isRunning: false,
            }));

            toast.warning(
              'Rate limit reached. Please wait ~1–2 minutes and run enrichment again.',
              { duration: 10000 }
            );

            // Invalidate queries to show partial results
            if (universeId) {
              queryClient.invalidateQueries({ queryKey: ['remarketing', 'universe-deals', universeId] });
            }

            return { successful, failed, skipped, creditsDepleted: false };
          }
        }
      }

      // Update progress
      setProgress(prev => ({
        ...prev,
        current: Math.min(i + BATCH_SIZE, enrichableDeals.length),
        successful,
        failed,
        skipped,
      }));

      // Refresh table after each batch so data appears incrementally
      if (universeId) {
        queryClient.invalidateQueries({ queryKey: ['remarketing', 'universe-deals', universeId] });
      }

      // Delay between batches (not after last batch)
      if (i + BATCH_SIZE < enrichableDeals.length && !cancelledRef.current) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    // Complete
    if (!creditsDepleted && !rateLimited && !cancelledRef.current) {
      setProgress(prev => ({ ...prev, isRunning: false }));
      
      if (successful > 0) {
        toast.success(`Enriched ${successful} of ${enrichableDeals.length} deals`);
      }
      if (failed > 0 && !creditsDepleted) {
        toast.warning(`${failed} deals failed to enrich`);
      }
    }

    // Invalidate queries
    if (universeId) {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'universe-deals', universeId] });
    }

    return { successful, failed, skipped, creditsDepleted };
  }, [queryClient, universeId, updateStatus]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = false;
    setProgress({
      current: 0,
      total: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      statuses: new Map(),
      isRunning: false,
      isCancelled: false,
      creditsDepleted: false,
    });
  }, []);

  return {
    progress,
    enrichDeals,
    cancel,
    reset,
  };
}
