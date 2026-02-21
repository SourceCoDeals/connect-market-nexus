import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";

/**
 * create-docuseal-submission
 *
 * Creates a DocuSeal signing submission for NDA or Fee Agreement.
 * Supports two flows:
 *   - Embedded (send_email=false): Returns embed_src for inline signing
 *   - Email (send_email=true): DocuSeal sends email with signing link
 *
 * Input: { firm_id, document_type, buyer_email, buyer_name, send_email }
 * Output: { embed_src, submission_id, submitter_id }
 */

interface CreateSubmissionRequest {
  firm_id: string;
  document_type: "nda" | "fee_agreement";
  buyer_email: string;
  buyer_name: string;
  send_email: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Auth check
  const auth = await requireAdmin(req, supabaseAdmin);
  if (!auth.isAdmin) {
    return new Response(
      JSON.stringify({ error: auth.error }),
      {
        status: auth.authenticated ? 403 : 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const body: CreateSubmissionRequest = await req.json();
    const { firm_id, document_type, buyer_email, buyer_name, send_email } = body;

    // Validate required fields
    if (!firm_id || !document_type || !buyer_email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: firm_id, document_type, buyer_email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["nda", "fee_agreement"].includes(document_type)) {
      return new Response(
        JSON.stringify({ error: "document_type must be 'nda' or 'fee_agreement'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get DocuSeal config
    const docusealApiKey = Deno.env.get("DOCUSEAL_API_KEY");
    if (!docusealApiKey) {
      return new Response(
        JSON.stringify({ error: "DocuSeal API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const templateId = document_type === "nda"
      ? Deno.env.get("DOCUSEAL_NDA_TEMPLATE_ID")
      : Deno.env.get("DOCUSEAL_FEE_TEMPLATE_ID");

    if (!templateId) {
      return new Response(
        JSON.stringify({ error: `DocuSeal template ID not configured for ${document_type}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create DocuSeal submission
    const externalId = `firm_${firm_id}_${document_type}`;

    const docusealResponse = await fetch("https://api.docuseal.com/submissions", {
      method: "POST",
      headers: {
        "X-Auth-Token": docusealApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_id: parseInt(templateId),
        send_email: send_email,
        submitters: [
          {
            role: "First Party",
            email: buyer_email,
            name: buyer_name || buyer_email,
            external_id: externalId,
          },
        ],
      }),
    });

    if (!docusealResponse.ok) {
      const errorText = await docusealResponse.text();
      console.error("[create-docuseal-submission] DocuSeal API error:", docusealResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to create DocuSeal submission", details: errorText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const submitters = await docusealResponse.json();
    const submitter = Array.isArray(submitters) ? submitters[0] : submitters;

    // Update firm_agreements with submission info
    const statusColumn = document_type === "nda" ? "nda_docuseal_status" : "fee_docuseal_status";
    const submissionIdColumn = document_type === "nda" ? "nda_docuseal_submission_id" : "fee_docuseal_submission_id";
    const emailSentColumn = document_type === "nda" ? "nda_email_sent" : "fee_agreement_email_sent";
    const emailSentAtColumn = document_type === "nda" ? "nda_email_sent_at" : "fee_agreement_email_sent_at";

    const updateData: Record<string, unknown> = {
      [submissionIdColumn]: String(submitter.submission_id || submitter.id),
      [statusColumn]: "sent",
      updated_at: new Date().toISOString(),
    };

    if (send_email) {
      updateData[emailSentColumn] = true;
      updateData[emailSentAtColumn] = new Date().toISOString();
    }

    const { error: updateError } = await supabaseAdmin
      .from("firm_agreements")
      .update(updateData)
      .eq("id", firm_id);

    if (updateError) {
      console.error("[create-docuseal-submission] DB update error:", updateError);
      // Don't fail the request - the submission was created successfully
    }

    console.log(`[create-docuseal-submission] Created ${document_type} submission for firm ${firm_id}, send_email=${send_email}`);

    return new Response(
      JSON.stringify({
        embed_src: submitter.embed_src,
        submission_id: submitter.submission_id || submitter.id,
        submitter_id: submitter.id,
        status: "sent",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[create-docuseal-submission] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
