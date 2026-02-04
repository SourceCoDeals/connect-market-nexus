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
  rateLimited: boolean;
  resetTime?: string;
}

export interface EnrichmentSummary {
  total: number;
  successful: number;
  failed: number;
  warnings: number;
  results: Array<{
    buyerId: string;
    buyerName?: string;
    status: 'success' | 'error' | 'warning';
    error?: string;
    errorCode?: string;
    fieldsExtracted?: number;
  }>;
  creditsDepleted?: boolean;
  rateLimited?: boolean;
  resetTime?: string;
}

// Claude has much higher rate limits than Gemini - can process more buyers in parallel
const BATCH_SIZE = 3; // Increased from 2 now that we use Claude (only 2 AI calls per buyer instead of 6)
const BATCH_DELAY_MS = 1500; // Reduced delay since Claude has ~100 RPM vs Gemini's 15 RPM

// Shared abort signal for immediate fail-fast across parallel requests
interface AbortState {
  aborted: boolean;
  reason?: 'rate_limited' | 'credits_depleted' | 'cancelled';
  resetTime?: string;
}

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

    // Build a helpful error message based on status code
    let message = json?.error || anyErr?.message || 'Request failed';

    // Add context for common HTTP status codes
    if (status === 401) {
      const detail = json?.error || 'Unauthorized';
      message = `Authentication failed: ${detail}. The enrich-buyer function requires authentication. Make sure you're logged in and the function is properly deployed.`;
    } else if (status === 403) {
      message = `Permission denied: ${json?.error || 'Forbidden'}. You may not have access to this feature.`;
    } else if (status === 429) {
      message = `Rate limit exceeded. Too many requests. Try again later.`;
    } else if (status === 402) {
      message = `API credits depleted. Please add credits to your Anthropic account.`;
    } else if (status === 500) {
      message = `Server error: ${json?.error || 'Internal server error'}. Check the edge function logs.`;
    } else if (status && !json?.error) {
      message = `Request failed (HTTP ${status})`;
    }

    return {
      message,
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
    rateLimited: false,
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
      rateLimited: false,
    });

    // Shared abort state for immediate fail-fast across parallel requests
    const abortState: AbortState = { aborted: false };
    
    let successful = 0;
    let failed = 0;
    let creditsDepleted = false;
    let rateLimited = false;

    // Process in parallel batches
    for (let i = 0; i < enrichableBuyers.length; i += BATCH_SIZE) {
      // Check for cancellation or abort (rate limit/credits)
      if (cancelledRef.current || abortState.aborted) {
        if (abortState.aborted) {
          // Already handled via toast in the batch processing
        } else {
          setProgress(prev => ({ ...prev, isRunning: false, isCancelled: true }));
          toast.info(`Enrichment cancelled. ${successful} of ${enrichableBuyers.length} buyers enriched.`);
        }
        break;
      }

      const batch = enrichableBuyers.slice(i, i + BATCH_SIZE);
      
      // Mark batch as enriching
      batch.forEach(buyer => {
        updateStatus(buyer.id, { buyerId: buyer.id, status: 'enriching' });
      });

      // Process batch in parallel with immediate abort on rate limit/credits
      const results = await Promise.allSettled(
        batch.map(async (buyer) => {
          // Check abort state BEFORE making request (for subsequent items in same batch)
          if (abortState.aborted) {
            const abortError = new Error(abortState.reason === 'rate_limited' ? 'Rate limit exceeded' : 'Aborted');
            (abortError as any).aborted = true;
            (abortError as any).reason = abortState.reason;
            throw abortError;
          }
          
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
            
            // IMMEDIATE abort on rate limit - set flag so other parallel requests skip
            if (parsed.status === 429 || parsed.code === 'RATE_LIMIT_EXCEEDED' || parsed.code === 'rate_limited') {
              abortState.aborted = true;
              abortState.reason = 'rate_limited';
              abortState.resetTime = parsed.resetTime;
            }
            // IMMEDIATE abort on payment required
            if (parsed.status === 402 || parsed.code === 'payment_required') {
              abortState.aborted = true;
              abortState.reason = 'credits_depleted';
            }
            
            throw e;
          }
          
          // Check for error in response body (edge function may return 200 with error in body)
          if (data && !data.success) {
            const errorObj = new Error(data.error || 'Enrichment failed');
            (errorObj as any).errorCode = data.error_code;
            (errorObj as any).status = data?.status;
            (errorObj as any).code = data?.code;
            (errorObj as any).resetTime = data?.resetTime;
            
            // Check for rate limit in response body
            if (data.code === 'RATE_LIMIT_EXCEEDED' || data.code === 'rate_limited' || data.error?.includes('Rate limit')) {
              abortState.aborted = true;
              abortState.reason = 'rate_limited';
              abortState.resetTime = data.resetTime;
            }
            // Check for payment required in response body
            if (data.code === 'payment_required' || data.error_code === 'payment_required') {
              abortState.aborted = true;
              abortState.reason = 'credits_depleted';
            }
            
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
          const error = result.reason;
          
          // Skip counting if this was an abort (already handled)
          if ((error as any)?.aborted) {
            // Mark as skipped/pending, not failed
            updateStatus(buyer.id, { 
              buyerId: buyer.id, 
              status: 'pending',
            });
            continue;
          }
          
          failed++;
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
        }
      }

      // After processing batch, check if we need to abort due to rate limit or credits
      if (abortState.aborted) {
        if (abortState.reason === 'credits_depleted') {
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
        } else if (abortState.reason === 'rate_limited') {
          rateLimited = true;
          setProgress(prev => ({
            ...prev,
            current: i + batch.length,
            successful,
            failed,
            isRunning: false,
            rateLimited: true,
            resetTime: abortState.resetTime,
          }));

          toast.warning(
            abortState.resetTime
              ? `Rate limit reached (200/hour). Try again after ${new Date(abortState.resetTime).toLocaleTimeString()}.`
              : 'Rate limit reached (200/hour). Please wait ~1 hour and run enrichment again.',
            { duration: 10000 }
          );
        }
        
        // Invalidate queries to show partial results
        await queryClient.invalidateQueries({ 
          queryKey: ['remarketing', 'buyers'], 
          refetchType: 'active' 
        });
        if (universeId) {
          await queryClient.invalidateQueries({ 
            queryKey: ['remarketing', 'buyers', 'universe', universeId], 
            refetchType: 'active' 
          });
        }
        
        return { successful, failed, creditsDepleted };
      }

      // Update progress
      setProgress(prev => ({
        ...prev,
        current: Math.min(i + BATCH_SIZE, enrichableBuyers.length),
        successful,
        failed,
      }));

      // Invalidate queries after each batch to update table in real-time
      // Use refetchType: 'active' to immediately refetch active queries
      console.log('[Enrichment] Invalidating buyer queries after batch', { universeId, batch: i + BATCH_SIZE });
      await queryClient.invalidateQueries({ 
        queryKey: ['remarketing', 'buyers'], 
        refetchType: 'active' 
      });
      if (universeId) {
        await queryClient.invalidateQueries({ 
          queryKey: ['remarketing', 'buyers', 'universe', universeId], 
          refetchType: 'active' 
        });
      }

      // Delay between batches (not after last batch)
      if (i + BATCH_SIZE < enrichableBuyers.length && !cancelledRef.current) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    // Complete
    if (!creditsDepleted && !rateLimited && !cancelledRef.current) {
      setProgress(prev => ({ ...prev, isRunning: false }));
    }

    // Invalidate queries
    await queryClient.invalidateQueries({
      queryKey: ['remarketing', 'buyers'],
      refetchType: 'active'
    });
    if (universeId) {
      await queryClient.invalidateQueries({
        queryKey: ['remarketing', 'buyers', 'universe', universeId],
        refetchType: 'active'
      });
    }

    // Build enrichment summary for results dialog
    const warnings = Array.from(progress.statuses.values()).filter(s => s.status === 'warning').length;
    const results = Array.from(progress.statuses.values()).map(status => ({
      buyerId: status.buyerId,
      status: status.status === 'success' ? 'success' as const
        : status.status === 'warning' ? 'warning' as const
        : 'error' as const,
      error: status.error,
      errorCode: status.errorCode,
      fieldsExtracted: status.fieldsExtracted
    }));

    const summary: EnrichmentSummary = {
      total: enrichableBuyers.length,
      successful,
      failed,
      warnings,
      results,
      creditsDepleted,
      rateLimited,
      resetTime: abortState.resetTime
    };

    return { successful, failed, creditsDepleted, summary };
  }, [queryClient, universeId, updateStatus, progress.statuses]);

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
      rateLimited: false,
    });
  }, []);

  return {
    progress,
    enrichBuyers,
    cancel,
    reset,
  };
}
