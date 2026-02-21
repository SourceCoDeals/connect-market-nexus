import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";

/**
 * create-docuseal-submission
 * Creates a DocuSeal submission for NDA or Fee Agreement signing.
 * Supports both embedded (iframe) and email delivery modes.
 */

interface CreateSubmissionRequest {
  firmId: string;
  documentType: "nda" | "fee_agreement";
  signerEmail: string;
  signerName: string;
  deliveryMode?: "embedded" | "email"; // default: embedded
  metadata?: Record<string, string>; // prefill fields
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Admin-only
    const auth = await requireAdmin(req, supabaseAdmin);
    if (!auth.isAdmin) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.authenticated ? 403 : 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const {
      firmId,
      documentType,
      signerEmail,
      signerName,
      deliveryMode = "embedded",
      metadata = {},
    }: CreateSubmissionRequest = await req.json();

    if (!firmId || !documentType || !signerEmail || !signerName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: firmId, documentType, signerEmail, signerName" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Resolve template ID
    const docusealApiKey = Deno.env.get("DOCUSEAL_API_KEY");
    if (!docusealApiKey) {
      return new Response(
        JSON.stringify({ error: "DOCUSEAL_API_KEY not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const templateId =
      documentType === "nda"
        ? Deno.env.get("DOCUSEAL_NDA_TEMPLATE_ID")
        : Deno.env.get("DOCUSEAL_FEE_TEMPLATE_ID");

    if (!templateId) {
      return new Response(
        JSON.stringify({ error: `Template ID not configured for ${documentType}` }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`📝 Creating DocuSeal submission`, {
      firmId,
      documentType,
      signerEmail,
      deliveryMode,
      templateId,
    });

    // Look up firm info for prefill
    const { data: firm } = await supabaseAdmin
      .from("firm_agreements")
      .select("primary_company_name, email_domain, website_domain")
      .eq("id", firmId)
      .single();

    // Build DocuSeal submission payload
    const submissionPayload: any = {
      template_id: parseInt(templateId),
      send_email: deliveryMode === "email",
      submitters: [
        {
          role: "First Party",
          email: signerEmail,
          name: signerName,
          external_id: firmId,
          ...(Object.keys(metadata).length > 0
            ? {
                fields: Object.entries(metadata).map(([name, value]) => ({
                  name,
                  default_value: value,
                })),
              }
            : {}),
        },
      ],
    };

    // Call DocuSeal API
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
        JSON.stringify({ error: "DocuSeal API error", details: errorText }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const docusealResult = await docusealResponse.json();
    console.log("✅ DocuSeal submission created:", docusealResult);

    // The API returns an array of submitters; get the first one
    const submitter = Array.isArray(docusealResult)
      ? docusealResult[0]
      : docusealResult;

    const submissionId = String(submitter.submission_id || submitter.id);
    const embedSrc = submitter.embed_src || null;
    const slug = submitter.slug || null;

    // Update firm_agreements with submission info
    const columnPrefix = documentType === "nda" ? "nda" : "fee";
    const { error: updateError } = await supabaseAdmin
      .from("firm_agreements")
      .update({
        [`${columnPrefix}_docuseal_submission_id`]: submissionId,
        [`${columnPrefix}_docuseal_status`]: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", firmId);

    if (updateError) {
      console.error("⚠️ Failed to update firm_agreements:", updateError);
    }

    // Log the webhook event
    await supabaseAdmin.from("docuseal_webhook_log").insert({
      event_type: "submission_created",
      submission_id: submissionId,
      document_type: documentType,
      external_id: firmId,
      raw_payload: { ...submitter, created_by: auth.userId },
    });

    return new Response(
      JSON.stringify({
        success: true,
        submissionId,
        embedSrc,
        slug,
        documentType,
        deliveryMode,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("❌ Error in create-docuseal-submission:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
