/**
 * PhoneBurner OAuth Callback Handler
 *
 * Handles the OAuth authorization code exchange and stores tokens.
 * 
 * Flow:
 *   1. Frontend redirects user to PhoneBurner OAuth authorize URL
 *   2. PhoneBurner redirects back to our callback with ?code=xxx
 *   3. This function exchanges the code for access/refresh tokens
 *   4. Tokens are stored in phoneburner_oauth_tokens table
 *   5. Redirects user back to the app
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const clientId = Deno.env.get("PHONEBURNER_CLIENT_ID");
  const clientSecret = Deno.env.get("PHONEBURNER_CLIENT_SECRET");
  const siteUrl = Deno.env.get("SITE_URL") || "https://connect-market-nexus.lovable.app";

  if (!clientId || !clientSecret) {
    return new Response(
      JSON.stringify({ error: "PhoneBurner OAuth not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  if (req.method === "GET") {
    // Handle OAuth callback redirect from PhoneBurner
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // Contains user_id

    if (!code || !state) {
      return Response.redirect(`${siteUrl}/admin/settings?error=missing_code`, 302);
    }

    try {
      // Exchange authorization code for tokens
      const tokenRes = await fetch("https://www.phoneburner.com/oauth/accesstoken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: `${supabaseUrl}/functions/v1/phoneburner-oauth-callback`,
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error("PhoneBurner token exchange failed:", errText);
        return Response.redirect(`${siteUrl}/admin/settings?error=token_exchange_failed`, 302);
      }

      const tokens = await tokenRes.json();
      const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

      // Upsert tokens for this user
      const { error: upsertError } = await supabase
        .from("phoneburner_oauth_tokens")
        .upsert({
          user_id: state,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_type: tokens.token_type || "Bearer",
          expires_at: expiresAt,
          scope: tokens.scope || null,
        }, { onConflict: "user_id" });

      if (upsertError) {
        console.error("Failed to store tokens:", upsertError);
        return Response.redirect(`${siteUrl}/admin/settings?error=storage_failed`, 302);
      }

      return Response.redirect(`${siteUrl}/admin/settings?phoneburner=connected`, 302);
    } catch (err) {
      console.error("OAuth callback error:", err);
      return Response.redirect(`${siteUrl}/admin/settings?error=callback_failed`, 302);
    }
  }

  if (req.method === "POST") {
    // POST: Generate the authorization URL for the frontend
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redirectUri = `${supabaseUrl}/functions/v1/phoneburner-oauth-callback`;
    const authorizeUrl = `https://www.phoneburner.com/oauth/authorize?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&state=${user.id}`;

    return new Response(
      JSON.stringify({ authorize_url: authorizeUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
