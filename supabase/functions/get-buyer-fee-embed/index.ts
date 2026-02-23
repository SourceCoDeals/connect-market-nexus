import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

/**
 * get-buyer-fee-embed
 * Buyer-facing endpoint: returns the DocuSeal embed_src for the buyer's Fee Agreement.
 * If no submission exists yet, returns an error (admin must send first).
 * Only returns data for the authenticated buyer's own firm.
 */

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.userId) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userId = auth.userId;

    // Get buyer's firm membership
    const { data: membership } = await supabaseAdmin
      .from("firm_members")
      .select("firm_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "No firm found for this buyer", hasFirm: false }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const firmId = membership.firm_id;

    // Get firm agreement
    const { data: firm } = await supabaseAdmin
      .from("firm_agreements")
      .select("id, fee_agreement_signed, fee_docuseal_submission_id, fee_docuseal_status")
      .eq("id", firmId)
      .single();

    if (!firm) {
      return new Response(
        JSON.stringify({ error: "Firm agreement not found", hasFirm: false }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // If already signed, no embed needed
    if (firm.fee_agreement_signed) {
      return new Response(
        JSON.stringify({ feeSigned: true, embedSrc: null }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // No submission exists — admin hasn't sent one yet
    if (!firm.fee_docuseal_submission_id) {
      return new Response(
        JSON.stringify({ feeSigned: false, embedSrc: null, noSubmission: true }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const docusealApiKey = Deno.env.get("DOCUSEAL_API_KEY");
    if (!docusealApiKey) {
      return new Response(
        JSON.stringify({ error: "DocuSeal not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get buyer profile email for submitter matching
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single();

    // Fetch submitter details to get embed_src
    const submitterRes = await fetch(
      `https://api.docuseal.com/submitters?submission_id=${firm.fee_docuseal_submission_id}`,
      {
        headers: { "X-Auth-Token": docusealApiKey },
      }
    );

    if (submitterRes.ok) {
      const submitters = await submitterRes.json();
      const data = Array.isArray(submitters?.data) ? submitters.data : Array.isArray(submitters) ? submitters : [];
      const submitter = data.find((s: any) => s.email === profile?.email) || data[0];
      if (submitter?.embed_src) {
        return new Response(
          JSON.stringify({ feeSigned: false, embedSrc: submitter.embed_src }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    return new Response(
      JSON.stringify({ feeSigned: false, embedSrc: null, error: "Could not retrieve signing form" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("❌ Error in get-buyer-fee-embed:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
