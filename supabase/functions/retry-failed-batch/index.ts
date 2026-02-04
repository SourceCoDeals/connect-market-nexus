import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Retry configuration
const RETRY_CONFIG: Record<string, { retryable: boolean; maxAttempts: number; initialDelayMs: number }> = {
  'network_error': { retryable: true, maxAttempts: 3, initialDelayMs: 2000 },
  'timeout': { retryable: true, maxAttempts: 3, initialDelayMs: 3000 },
  'service_overloaded': { retryable: true, maxAttempts: 2, initialDelayMs: 15000 },
  'rate_limited': { retryable: true, maxAttempts: 2, initialDelayMs: 30000 },
  'payment_required': { retryable: false, maxAttempts: 0, initialDelayMs: 0 },
  'missing_api_key': { retryable: false, maxAttempts: 0, initialDelayMs: 0 },
};

interface RetryRequest {
  universe_id: string;
  batch_index: number;
  error_code: string;
  previous_content: string;
  industry_name: string;
  clarification_context?: any;
  attempt: number;
}

interface RetryResult {
  success: boolean;
  shouldRetry: boolean;
  nextRetryDelayMs?: number;
  maxAttemptsReached: boolean;
  message: string;
}

/**
 * Retry a failed batch with exponential backoff
 *
 * POST /functions/v1/retry-failed-batch
 * {
 *   "universe_id": "uuid",
 *   "batch_index": 2,
 *   "error_code": "network_error",
 *   "previous_content": "...saved content...",
 *   "industry_name": "Healthcare Services",
 *   "attempt": 1
 * }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RetryRequest = await req.json();
    const { universe_id, batch_index, error_code, previous_content, industry_name, clarification_context, attempt = 1 } = body;

    // Validate required fields
    if (!universe_id || batch_index === undefined || !error_code || !previous_content || !industry_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = RETRY_CONFIG[error_code];

    if (!config) {
      return new Response(
        JSON.stringify({
          success: false,
          shouldRetry: false,
          maxAttemptsReached: true,
          message: `Unknown error code: ${error_code}`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if error is retryable
    if (!config.retryable) {
      return new Response(
        JSON.stringify({
          success: false,
          shouldRetry: false,
          maxAttemptsReached: true,
          message: `Error "${error_code}" is not retryable. Please resolve the underlying issue.`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if max attempts reached
    if (attempt > config.maxAttempts) {
      return new Response(
        JSON.stringify({
          success: false,
          shouldRetry: false,
          maxAttemptsReached: true,
          message: `Max retry attempts (${config.maxAttempts}) reached for error "${error_code}". Please contact support.`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate exponential backoff: baseDelay * (2 ^ (attempt - 1))
    const nextRetryDelayMs = config.initialDelayMs * Math.pow(2, attempt - 1);

    console.log(`Scheduling retry for universe ${universe_id}, batch ${batch_index + 1}, attempt ${attempt + 1}. Error: ${error_code}. Retry in ${nextRetryDelayMs}ms`);

    // Don't actually retry here - just return the delay to the client
    // The client should wait and then call resume-guide-generation
    return new Response(
      JSON.stringify({
        success: true,
        shouldRetry: true,
        nextRetryDelayMs,
        maxAttemptsReached: false,
        message: `Ready to retry. Wait ${nextRetryDelayMs}ms before calling resume-guide-generation again.`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in retry-failed-batch:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        shouldRetry: false,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
