/**
 * Standardized error response helper for edge functions.
 *
 * All error responses follow the schema:
 *   { error: string, error_code?: string }
 *
 * Use this helper to ensure consistent error shapes across all functions.
 */

export interface ErrorResponseBody {
  error: string;
  error_code?: string;
}

/**
 * Build a JSON error Response with consistent schema.
 *
 * @param message  Human-readable error description (never include PII or stack traces)
 * @param status   HTTP status code (default 500)
 * @param corsHeaders  CORS headers to include
 * @param errorCode  Optional machine-readable error code (e.g. "rate_limited", "unauthorized")
 */
export function errorResponse(
  message: string,
  status: number,
  corsHeaders: Record<string, string>,
  errorCode?: string,
): Response {
  const body: ErrorResponseBody = { error: message };
  if (errorCode) body.error_code = errorCode;
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
