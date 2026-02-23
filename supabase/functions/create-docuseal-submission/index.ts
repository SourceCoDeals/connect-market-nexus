import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";

/**
 * create-docuseal-submission
 * Creates a DocuSeal submission for NDA or Fee Agreement signing.
 * Supports both embedded (iframe) and email delivery modes.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_DOC_TYPES = ["nda", "fee_agreement"] as const;

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

    // H1: Input validation
    if (!firmId || !documentType || !signerEmail || !signerName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: firmId, documentType, signerEmail, signerName" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!UUID_REGEX.test(firmId)) {
      return new Response(
        JSON.stringify({ error: "Invalid firmId format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!VALID_DOC_TYPES.includes(documentType as any)) {
      return new Response(
        JSON.stringify({ error: "Invalid documentType. Must be 'nda' or 'fee_agreement'" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!EMAIL_REGEX.test(signerEmail)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (deliveryMode && !["embedded", "email"].includes(deliveryMode)) {
      return new Response(
        JSON.stringify({ error: "Invalid deliveryMode. Must be 'embedded' or 'email'" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Resolve template ID
    const docusealApiKey = Deno.env.get("DOCUSEAL_API_KEY");
    if (!docusealApiKey) {
      return new Response(
        JSON.stringify({ error: "DocuSeal not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const templateId =
      documentType === "nda"
        ? Deno.env.get("DOCUSEAL_NDA_TEMPLATE_ID")
        : Deno.env.get("DOCUSEAL_FEE_TEMPLATE_ID");

    if (!templateId) {
      return new Response(
        JSON.stringify({ error: `Template not configured for ${documentType}` }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`📝 Creating DocuSeal submission`, { firmId, documentType, deliveryMode, templateId });

    // Look up firm info for prefill
    const { data: firm } = await supabaseAdmin
      .from("firm_agreements")
      .select("primary_company_name, email_domain, website_domain")
      .eq("id", firmId)
      .single();

    // Sanitize metadata values — strip HTML tags
    const sanitizedMetadata: Record<string, string> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === "string") {
        sanitizedMetadata[key] = value.replace(/<[^>]*>/g, "");
      }
    }

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

    // M1: Call DocuSeal API with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let docusealResponse: Response;
    try {
      docusealResponse = await fetch("https://api.docuseal.com/submissions", {
        method: "POST",
        headers: {
          "X-Auth-Token": docusealApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submissionPayload),
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      clearTimeout(timeout);
      if (fetchError.name === "AbortError") {
        return new Response(
          JSON.stringify({ error: "DocuSeal API timeout" }),
          { status: 504, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      throw fetchError;
    } finally {
      clearTimeout(timeout);
    }

    if (!docusealResponse.ok) {
      const errorText = await docusealResponse.text();
      console.error("❌ DocuSeal API error:", errorText);
      // H2: Don't leak external API details
      return new Response(
        JSON.stringify({ error: "Failed to create signing submission. Please try again." }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const docusealResult = await docusealResponse.json();

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

    // Log the event
    await supabaseAdmin.from("docuseal_webhook_log").insert({
      event_type: "submission_created",
      submission_id: submissionId,
      document_type: documentType,
      external_id: firmId,
      raw_payload: { created_by: auth.userId },
    });

    // Create buyer notification and system message (all delivery modes)
    {
      const { data: buyerProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", signerEmail)
        .maybeSingle();

      if (buyerProfile?.id) {
        const docLabel = documentType === "nda" ? "NDA" : "Fee Agreement";
        const notificationMessage =
          documentType === "nda"
            ? "This is our standard NDA so we can freely exchange confidential information about the companies on our platform. Sign it to unlock full deal access."
            : "Here is our fee agreement — you only pay a fee if you close a deal you meet on our platform. Sign to continue the process.";

        // Insert notification
        await supabaseAdmin.from("user_notifications").insert({
          user_id: buyerProfile.id,
          notification_type: "agreement_pending",
          title: `${docLabel} Ready to Sign`,
          message: notificationMessage,
          metadata: {
            document_type: documentType,
            firm_id: firmId,
            submission_id: submissionId,
            delivery_mode: deliveryMode,
          },
        });
        console.log(`🔔 Created notification for buyer ${buyerProfile.id} — ${docLabel} pending (${deliveryMode})`);

        // Send a system message to the buyer's most recent connection request thread
        const { data: latestRequest } = await supabaseAdmin
          .from("connection_requests")
          .select("id")
          .eq("user_id", buyerProfile.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestRequest?.id) {
          const systemMessageBody =
            documentType === "nda"
              ? "📋 **NDA Ready to Sign**\n\nThis is our standard Non-Disclosure Agreement so we can freely exchange confidential information about the companies on our platform. It's a one-time signing — once done, you'll have full access to every deal.\n\nYou can sign it directly from your notification bell or the banner on the My Deals page."
              : "📋 **Fee Agreement Ready to Sign**\n\nHere is our fee agreement. You only pay a fee if you successfully close a deal with a company you first meet on our platform — no upfront cost.\n\nYou can sign it directly from your notification bell or the banner on the My Deals page.";

          await supabaseAdmin.from("connection_messages").insert({
            connection_request_id: latestRequest.id,
            sender_role: "admin",
            sender_id: null,
            body: systemMessageBody,
            message_type: "system",
            is_read_by_admin: true,
            is_read_by_buyer: false,
          });
          console.log(`💬 Sent system message to connection ${latestRequest.id} for ${docLabel}`);
        }
      }
    }

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
    // H2: Don't leak internal error details
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
