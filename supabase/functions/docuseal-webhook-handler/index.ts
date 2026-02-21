import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

/**
 * docuseal-webhook-handler
 * Processes DocuSeal webhook events (form.completed, form.viewed, etc.)
 * Updates both DocuSeal-specific fields and legacy boolean fields on firm_agreements.
 */

// Verify webhook signature using HMAC-SHA256
async function verifyWebhookSignature(
  body: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) return false;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const expectedHex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return expectedHex === signature;
  } catch {
    return false;
  }
}

serve(async (req: Request) => {
  // Webhooks are POST only — no CORS needed (server-to-server)
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const rawBody = await req.text();
    const webhookSecret = Deno.env.get("DOCUSEAL_WEBHOOK_SECRET");

    // Verify signature if secret is set
    if (webhookSecret) {
      const signature = req.headers.get("x-docuseal-signature");
      const valid = await verifyWebhookSignature(rawBody, signature, webhookSecret);
      if (!valid) {
        console.error("❌ Invalid webhook signature");
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.event_type || payload.type;
    const submissionData = payload.data || payload;

    console.log(`📩 DocuSeal webhook: ${eventType}`, {
      submission_id: submissionData.submission_id || submissionData.id,
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const submissionId = String(submissionData.submission_id || submissionData.id);

    // Log the raw webhook
    await supabase.from("docuseal_webhook_log").insert({
      event_type: eventType,
      submission_id: submissionId,
      submitter_id: submissionData.submitter_id ? String(submissionData.submitter_id) : null,
      external_id: submissionData.external_id || null,
      raw_payload: payload,
      processed_at: new Date().toISOString(),
    });

    // Find the firm that matches this submission
    // Check both nda and fee columns
    const { data: ndaFirm } = await supabase
      .from("firm_agreements")
      .select("id")
      .eq("nda_docuseal_submission_id", submissionId)
      .maybeSingle();

    const { data: feeFirm } = await supabase
      .from("firm_agreements")
      .select("id")
      .eq("fee_docuseal_submission_id", submissionId)
      .maybeSingle();

    const firmId = ndaFirm?.id || feeFirm?.id;
    const documentType = ndaFirm ? "nda" : feeFirm ? "fee_agreement" : null;

    if (!firmId || !documentType) {
      // Also try external_id as fallback
      if (submissionData.external_id) {
        const { data: extFirm } = await supabase
          .from("firm_agreements")
          .select("id, nda_docuseal_submission_id, fee_docuseal_submission_id")
          .eq("id", submissionData.external_id)
          .maybeSingle();

        if (extFirm) {
          console.log("✅ Found firm via external_id:", extFirm.id);
          // Determine doc type from which column matches
          const docType = extFirm.nda_docuseal_submission_id === submissionId ? "nda" : "fee_agreement";
          await processEvent(supabase, eventType, extFirm.id, docType, submissionData, submissionId);
          return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
      }

      console.warn("⚠️ No matching firm found for submission:", submissionId);
      return new Response(JSON.stringify({ success: true, note: "No matching firm" }), { status: 200 });
    }

    await processEvent(supabase, eventType, firmId, documentType, submissionData, submissionId);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: any) {
    console.error("❌ Webhook handler error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

async function processEvent(
  supabase: any,
  eventType: string,
  firmId: string,
  documentType: string,
  submissionData: any,
  submissionId: string
) {
  const isNda = documentType === "nda";
  const now = new Date().toISOString();

  // Map DocuSeal event to status
  let docusealStatus: string;
  switch (eventType) {
    case "form.completed":
    case "submission.completed":
      docusealStatus = "completed";
      break;
    case "form.viewed":
    case "submission.viewed":
      docusealStatus = "viewed";
      break;
    case "form.started":
    case "submission.started":
      docusealStatus = "started";
      break;
    case "form.declined":
    case "submission.declined":
      docusealStatus = "declined";
      break;
    default:
      docusealStatus = eventType;
  }

  console.log(`📝 Processing ${eventType} for ${documentType} on firm ${firmId} → status: ${docusealStatus}`);

  // Build update payload
  const updates: Record<string, any> = {
    updated_at: now,
  };

  if (isNda) {
    updates.nda_docuseal_status = docusealStatus;

    if (docusealStatus === "completed") {
      updates.nda_signed = true;
      updates.nda_signed_at = now;
      // Extract signed document URL if available
      if (submissionData.documents?.[0]?.url) {
        updates.nda_signed_document_url = submissionData.documents[0].url;
      }
    }
  } else {
    updates.fee_docuseal_status = docusealStatus;

    if (docusealStatus === "completed") {
      updates.fee_agreement_signed = true;
      updates.fee_agreement_signed_at = now;
      if (submissionData.documents?.[0]?.url) {
        updates.fee_signed_document_url = submissionData.documents[0].url;
      }
    }
  }

  const { error } = await supabase
    .from("firm_agreements")
    .update(updates)
    .eq("id", firmId);

  if (error) {
    console.error("❌ Failed to update firm_agreements:", error);
  } else {
    console.log(`✅ Updated firm ${firmId}: ${documentType} → ${docusealStatus}`);
  }

  // If completed, also sync to firm_members profiles
  if (docusealStatus === "completed") {
    try {
      const { data: members } = await supabase
        .from("firm_members")
        .select("user_id")
        .eq("firm_id", firmId);

      if (members?.length) {
        const profileUpdates = isNda
          ? { nda_signed: true, nda_signed_at: now }
          : { fee_agreement_signed: true, fee_agreement_signed_at: now };

        for (const member of members) {
          await supabase
            .from("profiles")
            .update({ ...profileUpdates, updated_at: now })
            .eq("id", member.user_id);
        }
        console.log(`✅ Synced ${documentType} status to ${members.length} member profiles`);
      }
    } catch (syncError) {
      console.error("⚠️ Profile sync error:", syncError);
    }
  }
}
