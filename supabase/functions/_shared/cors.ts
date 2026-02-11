/**
 * Shared CORS configuration for edge functions.
 *
 * Uses an allowlist of origins so that only your own frontend(s) can call
 * these endpoints from a browser. Server-to-server calls (cron, internal
 * function invocations) are unaffected because they don't send an Origin header.
 *
 * To add a new allowed origin (e.g. a staging domain), append it to
 * ALLOWED_ORIGINS below or set the CORS_ALLOWED_ORIGINS env var as a
 * comma-separated list.
 */

const DEFAULT_ALLOWED_ORIGINS = [
  "https://connect-market-nexus.lovable.app",
  "https://app.sourcecoconnect.com",
  "https://sourcecoconnect.com",
  "http://localhost:5173", // local dev
  "http://localhost:3000",
];

function getAllowedOrigins(): string[] {
  const envOrigins = Deno.env.get("CORS_ALLOWED_ORIGINS");
  if (envOrigins) {
    return envOrigins.split(",").map((o) => o.trim()).filter(Boolean);
  }
  return DEFAULT_ALLOWED_ORIGINS;
}

/**
 * Build CORS headers for a given request.
 * Reflects the request's Origin if it is in the allowlist; otherwise
 * returns the first allowed origin (browsers will block the response).
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = getAllowedOrigins();
  const reflectedOrigin = allowed.includes(origin) ? origin : allowed[0];

  return {
    "Access-Control-Allow-Origin": reflectedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

/**
 * Convenience: build a preflight (OPTIONS) response.
 */
export function corsPreflightResponse(req: Request): Response {
  return new Response("ok", { headers: getCorsHeaders(req) });
}
