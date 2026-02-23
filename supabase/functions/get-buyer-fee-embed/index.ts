import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

/**
 * get-buyer-fee-embed
 * Buyer-facing endpoint: returns the DocuSeal embed_src for the buyer's fee agreement.
 * If no submission exists yet, creates one via DocuSeal API.
 * Mirrors get-buyer-nda-embed but for fee_agreement document type.
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

    // Authenticate buyer (any logged-in user)
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

    // Get firm agreement — fee agreement fields
    const { data: firm } = await supabaseAdmin
      .from("firm_agreements")
      .select("id, fee_agreement_signed, fee_agreement_docuseal_submission_id, fee_agreement_docuseal_status")
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

    // Get buyer profile for email/name
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, first_name, last_name")
      .eq("id", userId)
      .single();

    if (!profile?.email) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const buyerName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email;

    // DocuSeal API key
    const docusealApiKey = Deno.env.get("DOCUSEAL_API_KEY");
    if (!docusealApiKey) {
      return new Response(
        JSON.stringify({ error: "DocuSeal not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // If submission already exists, fetch embed_src from DocuSeal API
    if (firm.fee_agreement_docuseal_submission_id) {
      const submitterRes = await fetch(
        `https://api.docuseal.com/submitters?submission_id=${firm.fee_agreement_docuseal_submission_id}`,
        {
          headers: { "X-Auth-Token": docusealApiKey },
        }
      );

      if (submitterRes.ok) {
        const submitters = await submitterRes.json();
        const data = Array.isArray(submitters?.data) ? submitters.data : Array.isArray(submitters) ? submitters : [];
        const submitter = data.find((s: any) => s.email === profile.email) || data[0];
        if (submitter?.embed_src) {
          return new Response(
            JSON.stringify({ feeSigned: false, embedSrc: submitter.embed_src }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }
    }

    // No existing submission — create new one
    const feeTemplateId = Deno.env.get("DOCUSEAL_FEE_AGREEMENT_TEMPLATE_ID");
    if (!feeTemplateId) {
      return new Response(
        JSON.stringify({ error: "Fee agreement template not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const submissionPayload = {
      template_id: parseInt(feeTemplateId),
      send_email: false,
      submitters: [
        {
          role: "First Party",
          email: profile.email,
          name: buyerName,
          external_id: firmId,
        },
      ],
    };

    const docusealResponse = await fetch("https://api.docuseal.com/submissions", {
      method: "POST",
      headers: {
        "X-Auth-Token": docusealApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(submissionPayload),
    });

    if (!docusealResponse.ok) {
      const errorText = await docusealResponse.text();
      console.error("❌ DocuSeal API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to create signing form" }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const result = await docusealResponse.json();
    const submitter = Array.isArray(result) ? result[0] : result;
    const submissionId = String(submitter.submission_id || submitter.id);
    const embedSrc = submitter.embed_src || null;

    // Update firm_agreements with fee agreement submission
    await supabaseAdmin
      .from("firm_agreements")
      .update({
        fee_agreement_docuseal_submission_id: submissionId,
        fee_agreement_docuseal_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", firmId);

    // Log
    await supabaseAdmin.from("docuseal_webhook_log").insert({
      event_type: "submission_created",
      submission_id: submissionId,
      document_type: "fee_agreement",
      external_id: firmId,
      raw_payload: { created_by_buyer: userId },
    });

    console.log(`✅ Created fee agreement submission ${submissionId} for buyer ${userId}`);

    return new Response(
      JSON.stringify({ feeSigned: false, embedSrc }),
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
