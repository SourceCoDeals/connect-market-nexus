import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * docuseal-webhook-handler
 *
 * Receives webhook events from DocuSeal and updates firm_agreements accordingly.
 * Logs every event to docuseal_webhook_log for legal compliance.
 *
 * Events handled:
 *   - form.completed: Sets document as signed (both DocuSeal status AND legacy boolean)
 *   - form.viewed: Updates status to 'viewed'
 *   - form.started: Updates status to 'started' (if still 'sent')
 *   - form.declined: Updates status to 'declined'
 *
 * No JWT verification — webhook is authenticated via secret header.
 * Configure verify_jwt = false in config.toml for this function.
 */

const handler = async (req: Request): Promise<Response> => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Verify webhook secret if configured
  const webhookSecret = Deno.env.get("DOCUSEAL_WEBHOOK_SECRET");
  if (webhookSecret) {
    const providedSecret = req.headers.get("X-Docuseal-Webhook-Secret") ||
                           req.headers.get("x-docuseal-webhook-secret");
    if (providedSecret !== webhookSecret) {
      console.error("[docuseal-webhook] Invalid webhook secret");
      return new Response("Unauthorized", { status: 401 });
    }
  }

  try {
    const payload = await req.json();
    const eventType = payload.event_type || payload.event;
    const submitterData = payload.data?.submitter || payload.data || {};
    const submissionData = payload.data?.submission || {};

    const externalId = submitterData.external_id || "";
    const submitterId = String(submitterData.id || "");
    const submissionId = String(submitterData.submission_id || submissionData.id || "");

    console.log(`[docuseal-webhook] Event: ${eventType}, external_id: ${externalId}, submission_id: ${submissionId}`);

    // Step 1: Log the webhook event immediately (before processing)
    const { error: logError } = await supabaseAdmin
      .from("docuseal_webhook_log")
      .insert({
        event_type: eventType,
        submission_id: submissionId,
        submitter_id: submitterId,
        external_id: externalId,
        document_type: parseDocumentType(externalId),
        raw_payload: payload,
        processed_at: new Date().toISOString(),
      });

    if (logError) {
      console.error("[docuseal-webhook] Failed to log event:", logError);
    }

    // Step 2: Parse external_id to get firm_id and document_type
    // Format: firm_{firm_id}_{document_type}
    const parsed = parseExternalId(externalId);
    if (!parsed) {
      console.warn(`[docuseal-webhook] Could not parse external_id: ${externalId}`);
      return new Response(JSON.stringify({ received: true, processed: false, reason: "invalid external_id" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { firmId, documentType } = parsed;

    // Step 3: Process based on event type
    switch (eventType) {
      case "form.completed": {
        const completedAt = submitterData.completed_at || new Date().toISOString();
        const signerName = submitterData.name || submitterData.email || "";
        const documents = submitterData.documents || submissionData.documents || [];
        const signedDocUrl = documents[0]?.url || null;

        const updateData: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (documentType === "nda") {
          updateData.nda_docuseal_status = "signed";
          updateData.nda_signed = true;
          updateData.nda_signed_at = completedAt;
          updateData.nda_signed_by_name = signerName;
          if (signedDocUrl) updateData.nda_signed_document_url = signedDocUrl;
        } else {
          updateData.fee_docuseal_status = "signed";
          updateData.fee_agreement_signed = true;
          updateData.fee_agreement_signed_at = completedAt;
          updateData.fee_agreement_signed_by_name = signerName;
          if (signedDocUrl) updateData.fee_signed_document_url = signedDocUrl;
        }

        const { error } = await supabaseAdmin
          .from("firm_agreements")
          .update(updateData)
          .eq("id", firmId);

        if (error) {
          console.error("[docuseal-webhook] form.completed update error:", error);
        } else {
          console.log(`[docuseal-webhook] Marked ${documentType} as signed for firm ${firmId}`);
        }
        break;
      }

      case "form.viewed": {
        // Only update if current status is 'sent' (don't regress from signed)
        const statusColumn = documentType === "nda" ? "nda_docuseal_status" : "fee_docuseal_status";

        const { error } = await supabaseAdmin
          .from("firm_agreements")
          .update({ [statusColumn]: "viewed", updated_at: new Date().toISOString() })
          .eq("id", firmId)
          .in(statusColumn, ["sent", "not_sent"]);

        if (error) {
          console.error("[docuseal-webhook] form.viewed update error:", error);
        }
        break;
      }

      case "form.started": {
        const statusColumn = documentType === "nda" ? "nda_docuseal_status" : "fee_docuseal_status";

        const { error } = await supabaseAdmin
          .from("firm_agreements")
          .update({ [statusColumn]: "viewed", updated_at: new Date().toISOString() })
          .eq("id", firmId)
          .in(statusColumn, ["sent", "not_sent"]);

        if (error) {
          console.error("[docuseal-webhook] form.started update error:", error);
        }
        break;
      }

      case "form.declined": {
        const statusColumn = documentType === "nda" ? "nda_docuseal_status" : "fee_docuseal_status";

        const { error } = await supabaseAdmin
          .from("firm_agreements")
          .update({ [statusColumn]: "declined", updated_at: new Date().toISOString() })
          .eq("id", firmId);

        if (error) {
          console.error("[docuseal-webhook] form.declined update error:", error);
        } else {
          console.log(`[docuseal-webhook] ${documentType} declined for firm ${firmId}`);
        }
        break;
      }

      default:
        console.log(`[docuseal-webhook] Unhandled event type: ${eventType}`);
    }

    return new Response(
      JSON.stringify({ received: true, processed: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[docuseal-webhook] Error:", error);
    // Return 200 to prevent DocuSeal from retrying on our errors
    return new Response(
      JSON.stringify({ received: true, processed: false, error: error.message }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
};

/**
 * Parse external_id format: firm_{firm_id}_{document_type}
 */
function parseExternalId(externalId: string): { firmId: string; documentType: "nda" | "fee_agreement" } | null {
  if (!externalId) return null;

  const match = externalId.match(/^firm_(.+)_(nda|fee_agreement)$/);
  if (!match) return null;

  return {
    firmId: match[1],
    documentType: match[2] as "nda" | "fee_agreement",
  };
}

/**
 * Extract document type from external_id for logging
 */
function parseDocumentType(externalId: string): string | null {
  const parsed = parseExternalId(externalId);
  return parsed?.documentType || null;
}

serve(handler);
