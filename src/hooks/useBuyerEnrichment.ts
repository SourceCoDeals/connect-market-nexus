import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeWithTimeout } from '@/lib/invoke-with-timeout';
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

// Gemini processing config — serialize to avoid client-side rate limit storms
const BATCH_SIZE = 1;
const BATCH_DELAY_MS = 500;

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
      message = `API credits depleted. Please add credits to your Gemini account.`;
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
    const enrichableBuyers = buyers.filter(
      b => b.platform_website || b.pe_firm_website || b.company_website
    );

    if (enrichableBuyers.length === 0) {
      toast.info('No buyers with websites to enrich');
      return;
    }

    setProgress(prev => ({
      ...prev,
      current: 0,
      total: enrichableBuyers.length,
      isRunning: true,
      isCancelled: false,
      creditsDepleted: false,
      rateLimited: false,
    }));

    try {
      const { queueBuyerEnrichment } = await import("@/lib/remarketing/queueEnrichment");
      const queued = await queueBuyerEnrichment(enrichableBuyers.map(b => b.id), universeId);

      setProgress(prev => ({
        ...prev,
        current: queued,
        successful: queued,
        isRunning: false,
      }));

      const summary: EnrichmentSummary = {
        total: enrichableBuyers.length,
        successful: queued,
        failed: 0,
        warnings: 0,
        results: [],
        creditsDepleted: false,
        rateLimited: false,
      };

      return { successful: queued, failed: 0, creditsDepleted: false, summary };
    } catch (error) {
      console.error('Failed to queue enrichment:', error);
      toast.error('Failed to queue enrichment');
      setProgress(prev => ({ ...prev, isRunning: false }));
      return { successful: 0, failed: enrichableBuyers.length, creditsDepleted: false };
    }
  }, [universeId]);

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
