import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useGlobalGateCheck } from '@/hooks/remarketing/useGlobalActivityQueue';
import { invokeWithTimeout } from '@/lib/invoke-with-timeout';

export interface EnrichmentProgress {
  current: number;
  total: number;
  startedAt?: number;
}

export interface BulkEnrichmentResult {
  success: boolean;
  enrichedCount: number;
  failedCount: number;
  partialCount: number;
  rateLimited?: boolean;
}

interface UseBulkEnrichmentOptions {
  onComplete?: (result: BulkEnrichmentResult) => void;
  maxRetries?: number;
  retryDelayMs?: number;
  betweenItemDelayMs?: number;
}

export function useBulkEnrichment(options: UseBulkEnrichmentOptions = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { startOrQueueMajorOp } = useGlobalGateCheck();
  const {
    onComplete,
    maxRetries = 3,
    retryDelayMs = 2000,
    // 1.5s delay between items — rate limits are managed by the queue/edge function layer
    betweenItemDelayMs = 1500,
  } = options;

  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<EnrichmentProgress>({ current: 0, total: 0 });

  // NOTE: parseInvokeError is defined once in this hook (kept below) to avoid duplicate const declarations.

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

  const enrichBuyer = useCallback(async (
    buyerId: string
  ): Promise<{ success: boolean; partial?: boolean; reason?: string; rateLimited?: boolean }> => {
    try {
      const { queueBuyerEnrichment } = await import("@/lib/remarketing/queueEnrichment");
      await queueBuyerEnrichment([buyerId]);
      return { success: true };
    } catch (err) {
      return { success: false, reason: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, []);

  const enrichDeal = useCallback(async (
    dealId: string,
    deal: { transcript_link?: string; additional_info?: string; company_website?: string }
  ): Promise<{ success: boolean; reason?: string; rateLimited?: boolean }> => {
    let enriched = false;

    const isRateLimitOrPaymentError = (err: Error | null): boolean => {
      if (!err) return false;
      const msg = err.message.toLowerCase();
      return msg.includes('429') || msg.includes('rate limit') ||
             msg.includes('402') || msg.includes('payment') || msg.includes('credit');
    };

    try {
      // FIX: Check for transcripts in deal_transcripts table, not transcript_link field
      // Query all transcripts for this listing/deal
      const { data: transcripts, error: fetchError } = await supabase
        .from('deal_transcripts')
        .select('id')
        .eq('listing_id', dealId);

      if (!fetchError && transcripts && transcripts.length > 0) {
        for (const transcript of transcripts) {
          const { error } = await invokeWithTimeout('extract-deal-transcript', {
            body: { transcriptId: transcript.id },
            timeoutMs: 120_000,
          });
          if (error && isRateLimitOrPaymentError(error)) {
            return { success: false, reason: error.message, rateLimited: true };
          }
          if (!error) enriched = true;
        }
      }

      if (deal.additional_info) {
        const { error } = await invokeWithTimeout('analyze-deal-notes', {
          body: { dealId, notes: deal.additional_info, applyToRecord: true },
          timeoutMs: 90_000,
        });
        if (error && isRateLimitOrPaymentError(error)) {
          return { success: false, reason: error.message, rateLimited: true };
        }
        if (!error) enriched = true;
      }

      if (deal.company_website) {
        const { queueDealEnrichment } = await import("@/lib/remarketing/queueEnrichment");
        await queueDealEnrichment([dealId]);
        enriched = true;
      }

      return { success: enriched, reason: enriched ? undefined : 'No data sources available' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (isRateLimitOrPaymentError(err instanceof Error ? err : new Error(msg))) {
        return { success: false, reason: msg, rateLimited: true };
      }
      return { success: false, reason: msg };
    }
  }, []);

  const enrichAllBuyers = useCallback(async (
    buyers: Array<{ id: string; platform_website?: string; pe_firm_website?: string }>,
    isEnrichedCheck: (buyer: any) => boolean
  ): Promise<BulkEnrichmentResult> => {
    const buyersWithWebsites = buyers.filter(b => b.platform_website || b.pe_firm_website);
    const unenrichedBuyers = buyersWithWebsites.filter(b => !isEnrichedCheck(b));

    if (unenrichedBuyers.length === 0) {
      toast({
        title: buyersWithWebsites.length === 0 ? 'No websites to scrape' : 'All buyers already enriched',
        description: buyersWithWebsites.length === 0 ? 'Add website URLs to buyers first' : `${buyersWithWebsites.length} buyers with websites are already enriched`,
      });
      return { success: true, enrichedCount: 0, failedCount: 0, partialCount: 0 };
    }

    setIsEnriching(true);
    setProgress({ current: 0, total: unenrichedBuyers.length, startedAt: Date.now() });

    let enrichedCount = 0;
    let failedCount = 0;
    let partialCount = 0;
    let rateLimited = false;

    try {
      // Gate check: register as major operation
      const { data: sessionData } = await supabase.auth.getUser();
      const { queued } = await startOrQueueMajorOp({
        operationType: 'buyer_enrichment',
        totalItems: unenrichedBuyers.length,
        description: `Enrich ${unenrichedBuyers.length} buyers`,
        userId: sessionData?.user?.id || 'unknown',
      });
      if (queued) {
        setIsEnriching(false);
        setProgress({ current: 0, total: 0 });
        return { success: true, enrichedCount: 0, failedCount: 0, partialCount: 0 };
      }

      for (let i = 0; i < unenrichedBuyers.length; i++) {
        const buyer = unenrichedBuyers[i];
        setEnrichingIds(prev => new Set(prev).add(buyer.id));
        setProgress(prev => ({ ...prev, current: i + 1 }));

        const result = await enrichBuyer(buyer.id);

        if (result.success) {
          enrichedCount++;
          if (result.partial) partialCount++;
          
          // Immediately invalidate queries for real-time UI updates
          void queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers'], refetchType: 'active' });
          void queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyer', buyer.id], refetchType: 'active' });
        } else {
          // Check if rate limited - stop processing immediately
          if (result.rateLimited) {
            rateLimited = true;
            toast({
              title: 'Rate limit reached',
              description: `Enriched ${enrichedCount} buyers. Please wait a minute before continuing.`,
              variant: 'destructive',
            });
            break;
          }
          failedCount++;
        }

        setEnrichingIds(prev => {
          const next = new Set(prev);
          next.delete(buyer.id);
          return next;
        });

        // Wait between items to respect rate limits
        if (i < unenrichedBuyers.length - 1 && !rateLimited) {
          await new Promise(resolve => setTimeout(resolve, betweenItemDelayMs));
        }
      }

      const result = { success: !rateLimited, enrichedCount, failedCount, partialCount, rateLimited };
      onComplete?.(result);

      if (enrichedCount === 0 && failedCount > 0) {
        toast({
          title: 'Enrichment failed',
          description: `All ${failedCount} buyers failed to enrich. Most common cause: rate limit exceeded—wait for the reset window and try again.`,
          variant: 'destructive',
        });
      } else if (!rateLimited) {
        toast({
          title: 'Bulk enrichment complete',
          description: `${enrichedCount} enriched${partialCount > 0 ? ` (${partialCount} partial)` : ''}${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
        });
      }

      return result;
    } finally {
      setIsEnriching(false);
      setEnrichingIds(new Set());
      setProgress({ current: 0, total: 0 });
      
      // Final refresh of data
      void queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers'], refetchType: 'active' });
    }
  }, [enrichBuyer, onComplete, betweenItemDelayMs, toast, queryClient]);

  const enrichAllDeals = useCallback(async (
    deals: Array<{ id: string; deal_name: string; transcript_link?: string; additional_info?: string; company_website?: string }>
  ): Promise<BulkEnrichmentResult> => {
    // All deals are enrichable — enrichDeal() checks the deal_transcripts table
    // for transcripts (not just the transcript_link field) and also tries website scraping.
    // Only skip deals with zero data sources (no website, no notes, AND no transcripts in DB).
    if (deals.length === 0) {
      toast({
        title: 'No deals to enrich',
        description: 'Add transcripts, notes, or websites to deals first',
        variant: 'destructive',
      });
      return { success: false, enrichedCount: 0, failedCount: 0, partialCount: 0 };
    }

    const enrichableDeals = deals;

    setIsEnriching(true);
    setProgress({ current: 0, total: enrichableDeals.length, startedAt: Date.now() });

    let enrichedCount = 0;
    let failedCount = 0;
    let rateLimited = false;

    try {
      // Gate check: register as major operation
      const { data: sessionData } = await supabase.auth.getUser();
      const { queued } = await startOrQueueMajorOp({
        operationType: 'deal_enrichment',
        totalItems: enrichableDeals.length,
        description: `Enrich ${enrichableDeals.length} deals`,
        userId: sessionData?.user?.id || 'unknown',
      });
      if (queued) {
        setIsEnriching(false);
        setProgress({ current: 0, total: 0 });
        return { success: true, enrichedCount: 0, failedCount: 0, partialCount: 0 };
      }

      for (let i = 0; i < enrichableDeals.length; i++) {
        const deal = enrichableDeals[i];
        setEnrichingIds(prev => new Set(prev).add(deal.id));
        setProgress(prev => ({ ...prev, current: i + 1 }));

        const result = await enrichDeal(deal.id, deal);

        if (result.success) {
          enrichedCount++;
        } else {
          if (result.rateLimited) {
            rateLimited = true;
            toast({
              title: 'Rate limit reached',
              description: `Enriched ${enrichedCount} deals. Please wait a minute before continuing.`,
              variant: 'destructive',
            });
            break;
          }
          failedCount++;
        }

        setEnrichingIds(prev => {
          const next = new Set(prev);
          next.delete(deal.id);
          return next;
        });

        if (i < enrichableDeals.length - 1 && !rateLimited) {
          await new Promise(resolve => setTimeout(resolve, betweenItemDelayMs));
        }
      }

      const result = { success: !rateLimited, enrichedCount, failedCount, partialCount: 0, rateLimited };
      onComplete?.(result);

      if (!rateLimited) {
        toast({
          title: 'Deal enrichment complete',
          description: `Successfully enriched ${enrichedCount} of ${enrichableDeals.length} deals${failedCount > 0 ? `. ${failedCount} failed.` : '.'}`,
        });
      }

      return result;
    } finally {
      setIsEnriching(false);
      setEnrichingIds(new Set());
      setProgress({ current: 0, total: 0 });
    }
  }, [enrichDeal, onComplete, betweenItemDelayMs, toast]);

  return {
    isEnriching,
    enrichingIds,
    progress,
    enrichBuyer,
    enrichDeal,
    enrichAllBuyers,
    enrichAllDeals,
  };
}
