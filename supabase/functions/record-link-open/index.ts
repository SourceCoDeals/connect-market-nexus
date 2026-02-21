/**
 * record-link-open: Tracks when a buyer opens a tracked document link
 *
 * PUBLIC endpoint — no authentication required.
 * GET /view/:link_token
 *
 * Actions:
 *   1. Fetch document_tracked_links by link_token
 *   2. Validate: exists, is_active, not expired
 *   3. Increment open_count, update last_opened_at
 *   4. If first open: set first_opened_at, update release log
 *   5. Generate 60-second signed URL for the document
 *   6. Return { redirect_url, document_title, first_open }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const BUCKET_NAME = "deal-documents";
const SIGNED_URL_EXPIRY = 60; // 60 seconds

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // Allow GET in addition to OPTIONS for this public endpoint
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // ── Extract link_token from URL path (GET) or body (POST) ──
    let linkToken: string | null = null;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        linkToken = body.link_token || null;
      } catch {
        // Fall through to path extraction
      }
    }

    if (!linkToken) {
      // Supabase edge functions receive the path after the function name,
      // e.g. /record-link-open/view/<token> or just /record-link-open/<token>
      const url = new URL(req.url);
      const pathSegments = url.pathname.split("/").filter(Boolean);
      const lastSegment = pathSegments[pathSegments.length - 1];
      if (lastSegment && lastSegment !== "record-link-open") {
        linkToken = lastSegment;
      }
    }

    if (!linkToken) {
      return new Response(
        JSON.stringify({ error: "link_token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Fetch tracked link ──

    const { data: trackedLink, error: fetchError } = await supabaseAdmin
      .from("document_tracked_links")
      .select("*, deal_documents(id, file_path, title, document_type)")
      .eq("link_token", linkToken)
      .single();

    if (fetchError || !trackedLink) {
      return new Response(
        JSON.stringify({ error: "Link not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Validate link is active ──

    if (!trackedLink.is_active) {
      return new Response(
        JSON.stringify({ error: "This link has been revoked" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Validate link has not expired ──

    if (trackedLink.expires_at) {
      const expiresAt = new Date(trackedLink.expires_at);
      if (expiresAt < new Date()) {
        return new Response(
          JSON.stringify({ error: "This link has expired" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Track the open (atomic increment via RPC to avoid race conditions) ──

    let isFirstOpen = !trackedLink.first_opened_at;

    const { data: rpcResult, error: rpcError } = await supabaseAdmin
      .rpc("increment_link_open_count", { p_link_id: trackedLink.id });

    if (rpcError) {
      console.error("Failed to increment open count:", rpcError);
      // Continue anyway — do not block the buyer from viewing the document
    } else if (rpcResult) {
      isFirstOpen = rpcResult.first_open === true;
    }

    // ── Generate signed URL for the document ──

    const document = trackedLink.deal_documents;

    if (!document || !document.file_path) {
      return new Response(
        JSON.stringify({ error: "Document file not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(document.file_path, SIGNED_URL_EXPIRY);

    if (urlError || !signedUrlData) {
      console.error("Signed URL error:", urlError);
      return new Response(
        JSON.stringify({ error: "Failed to generate document access URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      `Link opened: ${trackedLink.id} (token: ${linkToken}) by ${trackedLink.buyer_email} — open #${(trackedLink.open_count || 0) + 1}${isFirstOpen ? " [FIRST OPEN]" : ""}`
    );

    return new Response(
      JSON.stringify({
        redirect_url: signedUrlData.signedUrl,
        document_title: document.title || null,
        first_open: isFirstOpen,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Record link open error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
