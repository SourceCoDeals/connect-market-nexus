/**
 * Enrichment Event Logger
 *
 * Tracks enrichment outcomes per provider call for observability.
 * CTO Audit 4.3.1: "Enrichment Success Rate by Source"
 *
 * All writes are non-blocking (fire-and-forget) to avoid slowing
 * the enrichment pipeline if the events table is under load.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type EnrichmentEventStatus = 'success' | 'failure' | 'timeout' | 'rate_limited' | 'skipped';
export type EntityType = 'deal' | 'buyer';

export interface EnrichmentEventParams {
  entityType: EntityType;
  entityId: string;
  provider: string;
  functionName: string;
  status: EnrichmentEventStatus;
  stepName?: string;
  jobId?: string;
  errorMessage?: string;
  durationMs?: number;
  fieldsUpdated?: number;
  tokensUsed?: number;
}

/**
 * Log an enrichment event (non-blocking).
 * Swallows errors to prevent event logging from breaking the pipeline.
 *
 * BUG-5 FIX: Upgraded from console.warn to console.error for RPC failures so they
 * appear in Supabase function error logs. Also added a direct INSERT fallback when
 * the RPC doesn't exist (e.g., migration not applied), so events aren't silently lost.
 */
export function logEnrichmentEvent(
  supabase: SupabaseClient,
  params: EnrichmentEventParams
): void {
  const rpcParams = {
    p_entity_type: params.entityType,
    p_entity_id: params.entityId,
    p_provider: params.provider,
    p_function_name: params.functionName,
    p_status: params.status,
    p_step_name: params.stepName || null,
    p_job_id: params.jobId || null,
    p_error_message: params.errorMessage?.substring(0, 500) || null,
    p_duration_ms: params.durationMs || null,
    p_fields_updated: params.fieldsUpdated || 0,
    p_tokens_used: params.tokensUsed || 0,
  };

  Promise.resolve(
    supabase.rpc('log_enrichment_event', rpcParams)
  ).then((result: any) => {
    if (result?.error) {
      // RPC doesn't exist — fall back to direct INSERT so events aren't silently lost
      if (result.error.code === 'PGRST202' || result.error.code === '42883') {
        return supabase.from('enrichment_events').insert({
          entity_type: params.entityType,
          entity_id: params.entityId,
          provider: params.provider,
          function_name: params.functionName,
          status: params.status,
          step_name: params.stepName || null,
          job_id: params.jobId || null,
          error_message: params.errorMessage?.substring(0, 500) || null,
          duration_ms: params.durationMs || null,
          fields_updated: params.fieldsUpdated || 0,
          tokens_used: params.tokensUsed || 0,
        }).then((insertResult: any) => {
          if (insertResult?.error) {
            console.error('[enrichment-events] Direct INSERT also failed:', insertResult.error.message);
          }
        });
      }
      console.error('[enrichment-events] RPC failed to log event:', result.error.message,
        `(entity=${params.entityType}:${params.entityId}, status=${params.status})`);
    }
  }).catch((err: unknown) => {
    console.error('[enrichment-events] Event logging error:', err);
  });
}

/**
 * Convenience: log an enrichment step with timing.
 * Returns the result of the step function, logging success/failure automatically.
 */
export async function withEventLogging<T>(
  supabase: SupabaseClient,
  params: Omit<EnrichmentEventParams, 'status' | 'durationMs' | 'errorMessage'>,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    logEnrichmentEvent(supabase, {
      ...params,
      status: 'success',
      durationMs: Date.now() - start,
    });
    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const status: EnrichmentEventStatus =
      errorMessage.includes('timeout') || errorMessage.includes('abort') ? 'timeout' :
      errorMessage.includes('429') || errorMessage.includes('rate') ? 'rate_limited' :
      'failure';

    logEnrichmentEvent(supabase, {
      ...params,
      status,
      durationMs: Date.now() - start,
      errorMessage,
    });
    throw err;
  }
}
