/**
 * PhoneBurner Webhook Receiver
 *
 * Receives real-time call events from PhoneBurner and logs them into
 * the `phoneburner_webhooks_log` and `contact_activities` tables.
 *
 * Supported events:
 *   - call_begin / call.started   (dial started)
 *   - call_end / call.ended / disposition.set  (call completed)
 *   - contact_displayed (contact loaded in dialer)
 *   - callback.scheduled
 *
 * Authentication: HMAC-SHA256 signature via X-Phoneburner-Signature header
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

const encoder = new TextEncoder();

async function verifySignature(
  payload: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (computed.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  corsHeaders: Record<string, string>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const webhookSecret = Deno.env.get("PHONEBURNER_WEBHOOK_SECRET") || "";
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const rawBody = await req.text();

  // ── signature verification (skip if no secret configured) ──
  if (webhookSecret) {
    const sig =
      req.headers.get("x-phoneburner-signature") ||
      req.headers.get("X-Phoneburner-Signature");
    const valid = await verifySignature(rawBody, sig, webhookSecret);
    if (!valid) {
      console.error("PhoneBurner webhook signature verification failed");
      await supabase.from("phoneburner_webhooks_log").insert({
        event_type: "signature_failed",
        payload: {},
        processing_status: "failed",
        processing_error: "Invalid signature",
      });
      return jsonResponse({ error: "Invalid signature" }, 401, corsHeaders);
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400, corsHeaders);
  }

  const eventType = detectEventType(payload);
  const eventId =
    (payload.call_id as string) ||
    (payload.id as string) ||
    crypto.randomUUID();

  console.log(`PhoneBurner webhook received: ${eventType}, id: ${eventId}`);

  // ── idempotency ──
  const { data: existing } = await supabase
    .from("phoneburner_webhooks_log")
    .select("id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    return jsonResponse({ ok: true, message: "duplicate" }, 200, corsHeaders);
  }

  // ── log the raw webhook ──
  const { data: logEntry, error: logError } = await supabase
    .from("phoneburner_webhooks_log")
    .insert({
      event_id: eventId,
      event_type: eventType,
      payload,
      processing_status: "processing",
      phoneburner_call_id: (payload.call_id || null) as string | null,
      phoneburner_contact_id: ((payload.contact as Record<string, unknown>)?.id || payload.contact_id || null) as string | null,
    })
    .select("id")
    .single();

  if (logError) {
    console.error("Failed to log webhook:", logError);
    return jsonResponse({ error: "Logging failed" }, 500, corsHeaders);
  }

  // ── process the event ──
  try {
    await processEvent(supabase, eventType, payload);
    await supabase
      .from("phoneburner_webhooks_log")
      .update({ processing_status: "success" })
      .eq("id", logEntry.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error processing ${eventType}:`, message);
    await supabase
      .from("phoneburner_webhooks_log")
      .update({ processing_status: "failed", processing_error: message })
      .eq("id", logEntry.id);
  }

  return jsonResponse({ ok: true }, 200, corsHeaders);
});

function detectEventType(payload: Record<string, unknown>): string {
  if (payload.event) return String(payload.event);
  if (payload.disposition || payload.disposition_id) return "call_end";
  if (payload.call_id && !payload.disposition) return "call_begin";
  if (payload.contact_id && !payload.call_id) return "contact_displayed";
  return "unknown";
}

async function processEvent(
  supabase: ReturnType<typeof createClient>,
  eventType: string,
  payload: Record<string, unknown>,
) {
  const contact = (payload.contact || {}) as Record<string, unknown>;
  const customFields = (contact.custom_fields || payload.custom_fields || {}) as Record<string, unknown>;
  const contactId = (customFields.sourceco_contact_id || null) as string | null;
  const pbContactId = (contact.id || payload.contact_id || "") as string;

  switch (eventType) {
    case "call_begin":
    case "call.started": {
      await supabase.from("contact_activities").insert({
        activity_type: "call_attempt",
        source_system: "phoneburner",
        phoneburner_call_id: (payload.call_id || "") as string,
        phoneburner_contact_id: pbContactId,
        call_started_at: (payload.timestamp as string) || new Date().toISOString(),
        call_outcome: "dialing",
        contact_id: contactId,
      });
      break;
    }

    case "call_end":
    case "call.ended":
    case "disposition.set": {
      const disposition = (payload.disposition || {}) as Record<string, unknown>;
      const dispositionCode = (disposition.code || payload.disposition_id || "") as string;
      const dispositionLabel = (disposition.label || payload.disposition_name || "") as string;
      const notes = (disposition.notes || payload.notes || "") as string;
      const duration = (payload.duration || payload.call_duration || 0) as number;
      const recordingUrl = (payload.recording_url || "") as string;

      await supabase.from("contact_activities").insert({
        activity_type: "call_completed",
        source_system: "phoneburner",
        phoneburner_call_id: (payload.call_id || "") as string,
        phoneburner_contact_id: pbContactId,
        call_started_at: (payload.call_started_at as string) || (payload.timestamp as string) || new Date().toISOString(),
        call_ended_at: (payload.timestamp as string) || new Date().toISOString(),
        call_duration_seconds: duration,
        call_outcome: dispositionCode ? "dispositioned" : "completed",
        disposition_code: dispositionCode || null,
        disposition_label: dispositionLabel || null,
        disposition_notes: notes || null,
        recording_url: recordingUrl || null,
        contact_id: contactId,
      });

      // Look up disposition mapping
      if (dispositionCode) {
        const { data: mapping } = await supabase
          .from("disposition_mappings")
          .select("*")
          .eq("phoneburner_disposition_code", dispositionCode)
          .maybeSingle();
        if (mapping) {
          console.log(`Disposition mapped: ${dispositionCode} → ${mapping.sourceco_status} / ${mapping.sourceco_stage}`);
        }
      }
      break;
    }

    case "contact_displayed":
    case "contact.displayed": {
      await supabase.from("contact_activities").insert({
        activity_type: "contact_displayed",
        source_system: "phoneburner",
        phoneburner_contact_id: pbContactId,
        call_started_at: new Date().toISOString(),
        call_outcome: "displayed",
        contact_id: contactId,
      });
      break;
    }

    case "callback.scheduled": {
      await supabase.from("contact_activities").insert({
        activity_type: "callback_scheduled",
        source_system: "phoneburner",
        phoneburner_contact_id: pbContactId,
        callback_scheduled_date: (payload.callback_date as string) || null,
        disposition_notes: (payload.callback_notes || "") as string,
        contact_id: contactId,
      });
      break;
    }

    default:
      console.log(`Unhandled PhoneBurner event type: ${eventType}`);
  }
}
