/**
 * PhoneBurner OAuth Callback — DEPRECATED
 *
 * OAuth flow has been removed. PhoneBurner tokens are now added manually
 * via the admin settings page (paste access token directly).
 *
 * This stub is kept so the deployed edge function returns a clear message
 * instead of a 404.
 */

import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  return new Response(
    JSON.stringify({
      error: "PhoneBurner OAuth has been removed. Use manual access tokens instead.",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
