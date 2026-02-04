import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export interface EnrichmentProgress {
  current: number;
  total: number;
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
  const {
    onComplete,
    maxRetries = 3,
    retryDelayMs = 2000,
    // Default to 6.5s to comfortably stay under 10 calls/hour per user (server-side limit)
    // and reduce burstiness when users click repeatedly.
    betweenItemDelayMs = 6500,
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
      const { data, error } = await supabase.functions.invoke('enrich-buyer', {
        body: { buyerId },
      });

      if (error) {
        const parsed = parseInvokeError(error);
        const isRateLimited = parsed.status === 429 || parsed.code === 'RATE_LIMIT_EXCEEDED';
        const isPaymentRequired = parsed.status === 402 || parsed.code === 'payment_required';
        const extra = parsed.resetTime ? ` (reset: ${new Date(parsed.resetTime).toLocaleTimeString()})` : '';
        return {
          success: false,
          reason: `${parsed.message}${extra}`,
          rateLimited: isRateLimited || isPaymentRequired,
        };
      }

      if (!data?.success) {
        const isRateLimited = data?.error_code === 'rate_limited' || data?.code === 'RATE_LIMIT_EXCEEDED';
        const isPaymentRequired = data?.error_code === 'payment_required';
        return {
          success: false,
          reason: data?.error || 'Unknown error',
          rateLimited: isRateLimited || isPaymentRequired,
        };
      }

      return { success: true, partial: !!data.warning };
    } catch (err) {
      return { success: false, reason: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, []);

  const enrichDeal = useCallback(async (
    dealId: string,
    deal: { transcript_link?: string; additional_info?: string; company_website?: string }
  ): Promise<{ success: boolean; reason?: string }> => {
    let enriched = false;

    try {
      if (deal.transcript_link) {
        const { error } = await supabase.functions.invoke('extract-deal-transcript', {
          body: { dealId },
        });
        if (!error) enriched = true;
      }

      if (deal.additional_info) {
        const { error } = await supabase.functions.invoke('analyze-deal-notes', {
          body: { dealId, notes: deal.additional_info, applyToRecord: true },
        });
        if (!error) enriched = true;
      }

      if (deal.company_website) {
        const { error } = await supabase.functions.invoke('enrich-deal', {
          body: { dealId, onlyFillEmpty: true },
        });
        if (!error) enriched = true;
      }

      return { success: enriched, reason: enriched ? undefined : 'No data sources available' };
    } catch (err) {
      return { success: false, reason: err instanceof Error ? err.message : 'Unknown error' };
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
    setProgress({ current: 0, total: unenrichedBuyers.length });

    let enrichedCount = 0;
    let failedCount = 0;
    let partialCount = 0;
    let rateLimited = false;

    try {
      for (let i = 0; i < unenrichedBuyers.length; i++) {
        const buyer = unenrichedBuyers[i];
        setEnrichingIds(prev => new Set(prev).add(buyer.id));
        setProgress({ current: i + 1, total: unenrichedBuyers.length });

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
    const enrichableDeals = deals.filter(d => d.transcript_link || d.additional_info || d.company_website);

    if (enrichableDeals.length === 0) {
      toast({
        title: 'No deals to enrich',
        description: 'Add transcripts, notes, or websites to deals first',
        variant: 'destructive',
      });
      return { success: false, enrichedCount: 0, failedCount: 0, partialCount: 0 };
    }

    setIsEnriching(true);
    setProgress({ current: 0, total: enrichableDeals.length });

    let enrichedCount = 0;
    let failedCount = 0;

    try {
      for (let i = 0; i < enrichableDeals.length; i++) {
        const deal = enrichableDeals[i];
        setEnrichingIds(prev => new Set(prev).add(deal.id));
        setProgress({ current: i + 1, total: enrichableDeals.length });

        const result = await enrichDeal(deal.id, deal);

        if (result.success) {
          enrichedCount++;
        } else {
          failedCount++;
        }

        setEnrichingIds(prev => {
          const next = new Set(prev);
          next.delete(deal.id);
          return next;
        });

        if (i < enrichableDeals.length - 1) {
          await new Promise(resolve => setTimeout(resolve, betweenItemDelayMs));
        }
      }

      const result = { success: true, enrichedCount, failedCount, partialCount: 0 };
      onComplete?.(result);

      toast({
        title: 'Deal enrichment complete',
        description: `Successfully enriched ${enrichedCount} of ${enrichableDeals.length} deals${failedCount > 0 ? `. ${failedCount} failed.` : '.'}`,
      });

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
