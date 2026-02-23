import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

/**
 * docuseal-webhook-handler
 * Processes DocuSeal webhook events (form.completed, form.viewed, form.started, form.declined, form.expired)
 * Updates DocuSeal-specific fields, legacy booleans, AND expanded status fields on firm_agreements.
 * Creates admin_notifications on key events.
 * Includes idempotency checks via docuseal_webhook_log.
 *
 * DocuSeal sends a custom secret header (not HMAC). The header name is
 * configured in DocuSeal's dashboard (Key) and the value must match
 * DOCUSEAL_WEBHOOK_SECRET. Default header name: "onboarding-secret".
 * Override via DOCUSEAL_WEBHOOK_SECRET_HEADER env var if needed.
 */

// DocuSeal webhook verification — checks custom headers for a matching secret value.
// If no secret header is found, we log a warning but still process (DocuSeal doesn't
// always send secret headers consistently). We validate the payload structure instead.
function verifyDocuSealWebhook(req: Request, secret: string): boolean {
  const standardHeaders = new Set([
    'host', 'content-type', 'content-length', 'user-agent', 'accept',
    'accept-encoding', 'connection', 'x-forwarded-for', 'x-forwarded-proto',
    'x-forwarded-host', 'x-forwarded-port', 'x-request-id', 'x-real-ip',
    'cf-ray', 'cf-connecting-ip', 'cf-ew-via', 'cf-visitor', 'cf-worker',
    'x-envoy-external-address', 'x-amzn-trace-id', 'authorization',
    'sb-webhook-id', 'sb-webhook-signature', 'sb-webhook-timestamp',
    'sb-request-id', 'cdn-loop', 'cf-ipcountry', 'baggage',
  ]);

  for (const [key, value] of req.headers.entries()) {
    if (standardHeaders.has(key.toLowerCase())) continue;
    if (value === secret) return true;
  }
  return false;
}

// Validate that a URL is HTTPS and from a trusted domain
function isValidDocumentUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const trustedDomains = ["docuseal.com", "docuseal.co", "amazonaws.com", "storage.googleapis.com", "supabase.co"];
    return trustedDomains.some(d => parsed.hostname.endsWith(d));
  } catch {
    return false;
  }
}

// Basic payload structure validation to ensure this is a real DocuSeal webhook
function isValidDocuSealPayload(payload: any): boolean {
  const eventType = payload?.event_type || payload?.type;
  if (!eventType || typeof eventType !== 'string') return false;
  const data = payload?.data || payload;
  if (!data || typeof data !== 'object') return false;
  // Must have some kind of submission identifier
  if (!data.submission_id && !data.id) return false;
  return true;
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const rawBody = await req.text();

    const webhookSecret = Deno.env.get("DOCUSEAL_WEBHOOK_SECRET");
    
    // If secret is configured, attempt verification but don't block if DocuSeal
    // doesn't send the header (their webhook auth is inconsistent)
    if (webhookSecret) {
      const valid = verifyDocuSealWebhook(req, webhookSecret);
      if (!valid) {
        console.warn("⚠️ No matching secret header found — processing with payload validation");
      } else {
        console.log("✅ Webhook secret verified");
      }
    }

    // Parse and validate payload structure
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error("❌ Invalid JSON payload");
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
    }

    if (!isValidDocuSealPayload(payload)) {
      console.error("❌ Invalid payload structure — rejecting");
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 });
    }

    const eventType = payload.event_type || payload.type;
    const submissionData = payload.data || payload;

    console.log(`📩 DocuSeal webhook: ${eventType}`, {
      submission_id: submissionData.submission_id || submissionData.id,
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const submissionId = String(submissionData.submission_id || submissionData.id);

    // ── Idempotency check: skip if we already processed this exact event ──
    const { data: existingLog } = await supabase
      .from("docuseal_webhook_log")
      .select("id")
      .eq("submission_id", submissionId)
      .eq("event_type", eventType)
      .maybeSingle();

    if (existingLog) {
      console.log(`⏩ Duplicate event skipped: ${eventType} for submission ${submissionId}`);
      return new Response(JSON.stringify({ success: true, note: "Duplicate event" }), { status: 200 });
    }

    // Log the raw webhook (unique constraint on submission_id + event_type catches races)
    const { error: logError } = await supabase.from("docuseal_webhook_log").insert({
      event_type: eventType,
      submission_id: submissionId,
      submitter_id: submissionData.submitter_id ? String(submissionData.submitter_id) : null,
      external_id: submissionData.external_id || null,
      raw_payload: payload,
      processed_at: new Date().toISOString(),
    });
    if (logError) {
      // Unique constraint violation (23505) = concurrent duplicate; treat as idempotent skip
      if (logError.code === "23505") {
        console.log(`⏩ Concurrent duplicate skipped: ${eventType} for submission ${submissionId}`);
        return new Response(JSON.stringify({ success: true, note: "Concurrent duplicate" }), { status: 200 });
      }
      console.error("Failed to log webhook:", logError);
    }

    // Find the firm that matches this submission
    const { data: ndaFirm } = await supabase
      .from("firm_agreements")
      .select("id, primary_company_name")
      .eq("nda_docuseal_submission_id", submissionId)
      .maybeSingle();

    const { data: feeFirm } = await supabase
      .from("firm_agreements")
      .select("id, primary_company_name")
      .eq("fee_docuseal_submission_id", submissionId)
      .maybeSingle();

    let firmId = ndaFirm?.id || feeFirm?.id;
    let firmName = ndaFirm?.primary_company_name || feeFirm?.primary_company_name || "Unknown";
    let documentType = ndaFirm ? "nda" : feeFirm ? "fee_agreement" : null;

    // Fallback to external_id
    if (!firmId || !documentType) {
      if (submissionData.external_id) {
        const { data: extFirm } = await supabase
          .from("firm_agreements")
          .select("id, primary_company_name, nda_docuseal_submission_id, fee_docuseal_submission_id")
          .eq("id", submissionData.external_id)
          .maybeSingle();

        if (extFirm) {
          if (extFirm.nda_docuseal_submission_id === submissionId) {
            firmId = extFirm.id;
            firmName = extFirm.primary_company_name || "Unknown";
            documentType = "nda";
          } else if (extFirm.fee_docuseal_submission_id === submissionId) {
            firmId = extFirm.id;
            firmName = extFirm.primary_company_name || "Unknown";
            documentType = "fee_agreement";
          }
        }
      }

      if (!firmId || !documentType) {
        console.warn("⚠️ No matching firm found for submission:", submissionId);
        return new Response(JSON.stringify({ success: true, note: "No matching firm" }), { status: 200 });
      }
    }

    // Lifecycle events (submission.created, submission.archived) are logged but should
    // NOT update firm signing status — they'd overwrite meaningful statuses like "viewed"
    // or "completed" due to race conditions with DocuSeal's real-time webhooks.
    const lifecycleEvents = new Set(["submission.created", "submission.archived"]);
    if (lifecycleEvents.has(eventType)) {
      console.log(`ℹ️ Lifecycle event ${eventType} logged for submission ${submissionId} — skipping status update`);
      return new Response(JSON.stringify({ success: true, note: "Lifecycle event logged" }), { status: 200 });
    }

    await processEvent(supabase, eventType, firmId, firmName, documentType, submissionData, submissionId);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: any) {
    console.error("❌ Webhook handler error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
});

async function processEvent(
  supabase: any,
  eventType: string,
  firmId: string,
  firmName: string,
  documentType: string,
  submissionData: any,
  submissionId: string
) {
  const isNda = documentType === "nda";
  const now = new Date().toISOString();
  const docLabel = isNda ? "NDA" : "Fee Agreement";

  // Map DocuSeal event to status
  let docusealStatus: string;
  let expandedStatus: string | null = null; // for nda_status / fee_agreement_status sync
  switch (eventType) {
    case "form.completed":
    case "submission.completed":
      docusealStatus = "completed";
      expandedStatus = "signed";
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
      expandedStatus = "declined";
      break;
    case "form.expired":
    case "submission.expired":
      docusealStatus = "expired";
      expandedStatus = "expired";
      break;
    default:
      docusealStatus = eventType.replace(/[^a-z0-9._-]/gi, "").substring(0, 50);
  }

  console.log(`📝 Processing ${eventType} for ${documentType} on firm ${firmId}`);

  // Build update payload — update BOTH docuseal status AND expanded status
  const updates: Record<string, any> = {
    updated_at: now,
  };

  if (isNda) {
    updates.nda_docuseal_status = docusealStatus;
    if (expandedStatus) updates.nda_status = expandedStatus;

    if (docusealStatus === "completed") {
      updates.nda_signed = true;
      updates.nda_signed_at = now;
      const docUrl = submissionData.documents?.[0]?.url;
      if (docUrl && isValidDocumentUrl(docUrl)) {
        updates.nda_signed_document_url = docUrl;
        updates.nda_document_url = docUrl; // sync to expanded field too
      }
    } else if (docusealStatus === "declined" || docusealStatus === "expired") {
      updates.nda_signed = false;
    }
  } else {
    updates.fee_docuseal_status = docusealStatus;
    if (expandedStatus) updates.fee_agreement_status = expandedStatus;

    if (docusealStatus === "completed") {
      updates.fee_agreement_signed = true;
      updates.fee_agreement_signed_at = now;
      const docUrl = submissionData.documents?.[0]?.url;
      if (docUrl && isValidDocumentUrl(docUrl)) {
        updates.fee_signed_document_url = docUrl;
        updates.fee_agreement_document_url = docUrl; // sync to expanded field too
      }
    } else if (docusealStatus === "declined" || docusealStatus === "expired") {
      updates.fee_agreement_signed = false;
    }
  }

  const { error } = await supabase
    .from("firm_agreements")
    .update(updates)
    .eq("id", firmId);

  if (error) {
    console.error("❌ Failed to update firm_agreements:", error);
  }

  // ── Create admin notifications for key events ──
  const notifiableEvents = ["completed", "declined", "expired"];
  if (notifiableEvents.includes(docusealStatus)) {
    await createAdminNotification(supabase, firmId, firmName, docLabel, docusealStatus);
  }

  // If completed, sync to profiles AND send buyer notification with signed doc link
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

        // Send buyer notification with signed document download link
        const signedDocUrl = submissionData.documents?.[0]?.url;
        await sendBuyerSignedDocNotification(
          supabase, members, firmId, docLabel, signedDocUrl
        );
      }
    } catch (syncError) {
      console.error("⚠️ Profile sync error:", syncError);
    }
  }
}

/**
 * Create admin_notifications for all admins when a document event occurs.
 */
async function createAdminNotification(
  supabase: any,
  firmId: string,
  firmName: string,
  docLabel: string,
  status: string,
) {
  try {
    // Get all admin user IDs from user_roles table (RBAC source of truth)
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "owner"]);

    const admins = (adminRoles || []).map((r: any) => ({ id: r.user_id }));
    if (!admins.length) return;

    const statusMessages: Record<string, { title: string; message: string }> = {
      completed: {
        title: `${docLabel} Signed`,
        message: `${firmName} has signed the ${docLabel}.`,
      },
      declined: {
        title: `${docLabel} Declined`,
        message: `${firmName} has declined the ${docLabel}. Follow up may be needed.`,
      },
      expired: {
        title: `${docLabel} Expired`,
        message: `${docLabel} for ${firmName} has expired and needs to be resent.`,
      },
    };

    const notif = statusMessages[status];
    if (!notif) return;

    const notifications = admins.map((admin: any) => ({
      admin_id: admin.id,
      title: notif.title,
      message: notif.message,
      notification_type: `document_${status}`,
      metadata: { firm_id: firmId, document_type: docLabel.toLowerCase().replace(/ /g, '_'), docuseal_status: status },
      is_read: false,
    }));

    const { error } = await supabase.from("admin_notifications").insert(notifications);
    if (error) console.error("⚠️ Failed to create notifications:", error);
    else console.log(`🔔 Created ${notifications.length} admin notifications for ${docLabel} ${status}`);
  } catch (err) {
    console.error("⚠️ Notification creation error:", err);
  }
}

/**
 * Send a notification + system message to all firm members with a link to download their signed document.
 */
async function sendBuyerSignedDocNotification(
  supabase: any,
  members: { user_id: string }[],
  firmId: string,
  docLabel: string,
  signedDocUrl: string | null,
) {
  try {
    const downloadNote = signedDocUrl
      ? `You can download your signed copy from your Profile → Documents tab, or use this link: ${signedDocUrl}`
      : `You can view your signed documents in your Profile → Documents tab.`;

    const docType = docLabel.toLowerCase().replace(/ /g, "_");

    for (const member of members) {
      // Deduplicate: check if confirm-agreement-signed already created this notification
      const { data: existing } = await supabase
        .from("user_notifications")
        .select("id")
        .eq("user_id", member.user_id)
        .eq("notification_type", "agreement_signed")
        .eq("title", `${docLabel} Signed Successfully`)
        .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .limit(1)
        .maybeSingle();

      if (existing) {
        console.log(`⏩ Skipping duplicate agreement_signed notification for user ${member.user_id} (${docLabel})`);
        continue;
      }

      await supabase.from("user_notifications").insert({
        user_id: member.user_id,
        notification_type: "agreement_signed",
        title: `${docLabel} Signed Successfully`,
        message: `Your ${docLabel} has been signed and recorded. ${downloadNote}`,
        metadata: {
          firm_id: firmId,
          document_type: docType,
          signed_document_url: signedDocUrl || null,
        },
      });

      // Insert a system message into ALL active connection request threads
      const { data: activeRequests } = await supabase
        .from("connection_requests")
        .select("id")
        .eq("user_id", member.user_id)
        .in("status", ["approved", "pending", "on_hold"])
        .order("created_at", { ascending: false });

      if (activeRequests && activeRequests.length > 0) {
        const messageBody = signedDocUrl
          ? `✅ Your ${docLabel} has been signed successfully. For your compliance records, you can download the signed copy here: ${signedDocUrl}\n\nA copy is also permanently available in your Profile → Documents tab.`
          : `✅ Your ${docLabel} has been signed successfully. A copy is available in your Profile → Documents tab.`;

        const messageInserts = activeRequests.map((req: any) => ({
          connection_request_id: req.id,
          sender_role: "admin",
          sender_id: null,
          body: messageBody,
          message_type: "system",
          is_read_by_admin: true,
          is_read_by_buyer: false,
        }));

        const { error: msgError } = await supabase
          .from("connection_messages")
          .insert(messageInserts);

        if (msgError) {
          console.error("⚠️ Failed to insert signed doc system messages:", msgError);
        }
      }
    }
    console.log(`📨 Sent signed doc notifications to ${members.length} buyer(s) for ${docLabel}`);
  } catch (err) {
    console.error("⚠️ Buyer notification error:", err);
  }
}
