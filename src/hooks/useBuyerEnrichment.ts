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

// Claude has much higher rate limits than Gemini - can process more buyers in parallel
const BATCH_SIZE = 3; // Increased from 2 now that we use Claude (only 2 AI calls per buyer instead of 6)
const BATCH_DELAY_MS = 1500; // Reduced delay since Claude has ~100 RPM vs Gemini's 15 RPM

export function useBuyerEnrichment(universeId?: string) {
  const queryClient = useQueryClient();
  const cancelledRef = useRef(false);

  const parseInvokeError = (err: unknown): {
    message: string;
    status?: number;
    code?: string;
    resetTime?: string;
  } => {
    const anyErr = err as any;
    const status = anyErr?.context?.status as number | undefined;
    const json = anyErr?.context?.json as any | undefined;
    return {
      message:
        json?.error ||
        anyErr?.message ||
        (status ? `Request failed (HTTP ${status})` : 'Request failed'),
      status,
      code: json?.code,
      resetTime: json?.resetTime,
    };
  };
  
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
    let rateLimited = false;

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

      // Process batch in parallel with timeout protection
      const results = await Promise.allSettled(
        batch.map(async (buyer) => {
          const { data, error } = await supabase.functions.invoke('enrich-buyer', {
            body: { buyerId: buyer.id }
          });
          
          if (error) {
            // Preserve status/code/resetTime for downstream fail-fast handling
            const parsed = parseInvokeError(error);
            const e = new Error(parsed.message);
            (e as any).status = parsed.status;
            (e as any).code = parsed.code;
            (e as any).resetTime = parsed.resetTime;
            throw e;
          }
          
          // Check for error in response body (edge function may return 200 with error in body)
          if (data && !data.success) {
            const errorObj = new Error(data.error || 'Enrichment failed');
            (errorObj as any).errorCode = data.error_code;
            (errorObj as any).status = data?.status;
            (errorObj as any).code = data?.code;
            (errorObj as any).resetTime = data?.resetTime;
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
          const parsed = parseInvokeError(error);
          const status = (error as any)?.status as number | undefined;
          const code = (error as any)?.code as string | undefined;
          const resetTime = (error as any)?.resetTime as string | undefined;
          const errorMessage = parsed.message || 'Unknown error';
          const errorCode = (error as any)?.errorCode || code;
          const extra = resetTime ? ` (reset: ${new Date(resetTime).toLocaleTimeString()})` : '';
          
          updateStatus(buyer.id, { 
            buyerId: buyer.id, 
            status: 'error', 
            error: `${errorMessage}${extra}`,
            errorCode 
          });

          // Check for payment/credits error - fail fast
          if (
            errorCode === 'payment_required' ||
            status === 402 ||
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

          // Check for rate limit error - fail fast (avoid hammering the API)
          if (
            errorCode === 'rate_limited' ||
            status === 429 ||
            errorMessage.includes('429') ||
            errorMessage.toLowerCase().includes('rate limit')
          ) {
            rateLimited = true;

            setProgress(prev => ({
              ...prev,
              current: i + batch.length,
              successful,
              failed,
              isRunning: false,
            }));

            toast.warning(
              resetTime
                ? `Rate limit reached. Try again after ${new Date(resetTime).toLocaleTimeString()}.`
                : 'Rate limit reached. Please wait ~1–2 minutes and run enrichment again.',
              { duration: 10000 }
            );

            // Invalidate queries to show partial results
            queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers'] });
            if (universeId) {
              queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers', 'universe', universeId] });
            }

            return { successful, failed, creditsDepleted: false };
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

      // Invalidate queries after each batch to update table in real-time
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers'] });
      if (universeId) {
        queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers', 'universe', universeId] });
      }

      // Delay between batches (not after last batch)
      if (i + BATCH_SIZE < enrichableBuyers.length && !cancelledRef.current) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    // Complete
    if (!creditsDepleted && !rateLimited && !cancelledRef.current) {
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
