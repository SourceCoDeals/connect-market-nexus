import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export interface EnrichmentStatus {
  buyerId: string;
  status: 'pending' | 'enriching' | 'success' | 'error' | 'warning';
  error?: string;
  errorCode?: string;
  fieldsExtracted?: number;
}

export interface EnrichmentProgress {
  current: number;
  total: number;
  successful: number;
  failed: number;
  statuses: Map<string, EnrichmentStatus>;
  isRunning: boolean;
  isCancelled: boolean;
  creditsDepleted: boolean;
}

const BATCH_SIZE = 2; // Reduced from 5 to avoid Gemini rate limits (each buyer makes 6 API calls)
const BATCH_DELAY_MS = 2000; // Increased from 1000ms for better rate limit handling

export function useBuyerEnrichment(universeId?: string) {
  const queryClient = useQueryClient();
  const cancelledRef = useRef(false);
  
  const [progress, setProgress] = useState<EnrichmentProgress>({
    current: 0,
    total: 0,
    successful: 0,
    failed: 0,
    statuses: new Map(),
    isRunning: false,
    isCancelled: false,
    creditsDepleted: false,
  });

  const updateStatus = useCallback((buyerId: string, status: EnrichmentStatus) => {
    setProgress(prev => {
      const newStatuses = new Map(prev.statuses);
      newStatuses.set(buyerId, status);
      return { ...prev, statuses: newStatuses };
    });
  }, []);

  const enrichBuyers = useCallback(async (
    buyers: Array<{ id: string; platform_website?: string | null; pe_firm_website?: string | null; company_website?: string | null }>
  ) => {
    // Filter to buyers with websites
    const enrichableBuyers = buyers.filter(
      b => b.platform_website || b.pe_firm_website || b.company_website
    );

    if (enrichableBuyers.length === 0) {
      toast.info('No buyers with websites to enrich');
      return;
    }

    cancelledRef.current = false;
    
    // Initialize statuses
    const initialStatuses = new Map<string, EnrichmentStatus>();
    enrichableBuyers.forEach(b => {
      initialStatuses.set(b.id, { buyerId: b.id, status: 'pending' });
    });

    setProgress({
      current: 0,
      total: enrichableBuyers.length,
      successful: 0,
      failed: 0,
      statuses: initialStatuses,
      isRunning: true,
      isCancelled: false,
      creditsDepleted: false,
    });

    let successful = 0;
    let failed = 0;
    let creditsDepleted = false;

    // Process in parallel batches
    for (let i = 0; i < enrichableBuyers.length; i += BATCH_SIZE) {
      // Check for cancellation
      if (cancelledRef.current) {
        setProgress(prev => ({ ...prev, isRunning: false, isCancelled: true }));
        toast.info(`Enrichment cancelled. ${successful} of ${enrichableBuyers.length} buyers enriched.`);
        break;
      }

      const batch = enrichableBuyers.slice(i, i + BATCH_SIZE);
      
      // Mark batch as enriching
      batch.forEach(buyer => {
        updateStatus(buyer.id, { buyerId: buyer.id, status: 'enriching' });
      });

      // Process batch in parallel
      const results = await Promise.allSettled(
        batch.map(async (buyer) => {
          const { data, error } = await supabase.functions.invoke('enrich-buyer', {
            body: { buyerId: buyer.id }
          });
          
          if (error) throw error;
          
          // Check for error in response body (edge function may return 200 with error in body)
          if (data && !data.success) {
            const errorObj = new Error(data.error || 'Enrichment failed');
            (errorObj as any).errorCode = data.error_code;
            throw errorObj;
          }
          
          return data;
        })
      );

      // Process results
      let batchWarnings = 0;
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const buyer = batch[j];
        
        if (result.status === 'fulfilled') {
          const enrichResult = result.value;
          
          // Check if enrichment succeeded but extracted no data
          const fieldsExtracted = enrichResult?.data?.fieldsExtracted?.length || 0;
          if (fieldsExtracted === 0) {
            batchWarnings++;
            updateStatus(buyer.id, { 
              buyerId: buyer.id, 
              status: 'warning',
              error: 'No data extracted from website',
              fieldsExtracted: 0
            });
          } else {
            successful++;
            updateStatus(buyer.id, { 
              buyerId: buyer.id, 
              status: 'success',
              fieldsExtracted
            });
          }
        } else {
          failed++;
          const error = result.reason;
          const errorMessage = error?.message || 'Unknown error';
          const errorCode = (error as any)?.errorCode;
          
          updateStatus(buyer.id, { 
            buyerId: buyer.id, 
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
              isRunning: false,
              creditsDepleted: true
            }));
            
            toast.error(
              'AI credits depleted. Please add credits in Settings → Workspace → Usage to continue enrichment.',
              { duration: 10000 }
            );
            
            // Invalidate queries to show partial results
            queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers'] });
            if (universeId) {
              queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers', 'universe', universeId] });
            }
            
            return { successful, failed, creditsDepleted: true };
          }
        }
      }

      // Update progress
      setProgress(prev => ({
        ...prev,
        current: Math.min(i + BATCH_SIZE, enrichableBuyers.length),
        successful,
        failed,
      }));

      // Delay between batches (not after last batch)
      if (i + BATCH_SIZE < enrichableBuyers.length && !cancelledRef.current) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    // Complete
    if (!creditsDepleted && !cancelledRef.current) {
      setProgress(prev => ({ ...prev, isRunning: false }));
      
      if (successful > 0) {
        toast.success(`Enriched ${successful} of ${enrichableBuyers.length} buyers`);
      }
      if (failed > 0 && !creditsDepleted) {
        toast.warning(`${failed} buyers failed to enrich`);
      }
    }

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers'] });
    if (universeId) {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers', 'universe', universeId] });
    }

    return { successful, failed, creditsDepleted };
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
      statuses: new Map(),
      isRunning: false,
      isCancelled: false,
      creditsDepleted: false,
    });
  }, []);

  return {
    progress,
    enrichBuyers,
    cancel,
    reset,
  };
}
