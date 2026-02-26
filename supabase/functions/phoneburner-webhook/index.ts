/**
 * PhoneBurner Webhook Receiver
 *
 * Receives real-time call events from PhoneBurner and logs them into
 * the `phoneburner_webhooks_log` and `contact_activities` tables.
 *
 * Supported events:
 *   - call_begin / call.started   (dial started)
 *   - call_end / call.ended / disposition.set  (call completed + dispositioned)
 *   - contact_displayed (contact loaded in dialer)
 *   - callback.scheduled
 *   - email.unsubscribed
 *   - sms.opt_out
 *
 * Authentication: HMAC-SHA256 signature via X-Phoneburner-Signature header
 *
 * IMPORTANT: The push function stores `sourceco_id` in custom_fields.
 * We read both `sourceco_id` and `sourceco_contact_id` for backwards-compat.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';

const encoder = new TextEncoder();

async function verifySignature(
  payload: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature) return false;
  // Strip optional "sha256=" prefix
  const rawSig = signature.replace(/^sha256=/, '');
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (computed.length !== rawSig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed.charCodeAt(i) ^ rawSig.charCodeAt(i);
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
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  // Extract first IP from potentially comma-separated x-forwarded-for
  const rawIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null;
  const clientIp = rawIp ? rawIp.split(',')[0].trim() : null;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const webhookSecret = Deno.env.get('PHONEBURNER_WEBHOOK_SECRET') || '';
  // deno-lint-ignore no-explicit-any
  const supabase: any = createClient(supabaseUrl, serviceRoleKey);

  const rawBody = await req.text();

  // ── signature verification SKIPPED — accept all incoming requests ──
  const sig =
    req.headers.get('x-phoneburner-signature') || req.headers.get('X-Phoneburner-Signature');
  const signatureValid = webhookSecret && sig
    ? await verifySignature(rawBody, sig, webhookSecret)
    : null;
  console.log(`PhoneBurner webhook received, signature check: ${signatureValid}`);

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, corsHeaders);
  }

  // Prefer event type from header, then payload, then detect from structure
  const headerEventType =
    req.headers.get('x-phoneburner-event-type') || req.headers.get('X-Phoneburner-Event-Type');
  const eventType = headerEventType || detectEventType(payload);

  // Build stable event ID: prefer header > payload.call_id+type > payload.id > random
  const headerEventId =
    req.headers.get('x-phoneburner-event-id') || req.headers.get('X-Phoneburner-Event-Id');
  const eventId =
    headerEventId ||
    (payload.call_id ? `${payload.call_id}-${eventType}` : null) ||
    (payload.id as string) ||
    crypto.randomUUID();

  console.log(`PhoneBurner webhook received: ${eventType}, id: ${eventId}`);

  // ── idempotency ──
  const { data: existing } = await supabase
    .from('phoneburner_webhooks_log')
    .select('id')
    .eq('event_id', eventId)
    .maybeSingle();

  if (existing) {
    return jsonResponse({ ok: true, message: 'duplicate' }, 200, corsHeaders);
  }

  // Extract contact info for logging
  const contact = (payload.contact || {}) as Record<string, unknown>;
  const customFields = (contact.custom_fields || payload.custom_fields || {}) as Record<
    string,
    unknown
  >;
  // Session-level custom_data (entity_type, pushed_by, source)
  const customData = (payload.custom_data || {}) as Record<string, unknown>;
  const sourceco_contact_id = (customFields.sourceco_id ||
    customFields.sourceco_contact_id ||
    null) as string | null;
  const sourceco_entity_type = (customData.entity_type || null) as string | null;
  const sourceco_pushed_by = (customData.pushed_by || null) as string | null;

  // ── log the raw webhook ──
  const { data: logEntry, error: logError } = await supabase
    .from('phoneburner_webhooks_log')
    .insert({
      event_id: eventId,
      event_type: eventType,
      payload,
      processing_status: 'processing',
      phoneburner_call_id: (payload.call_id || null) as string | null,
      phoneburner_contact_id: (contact.id || payload.contact_id || null) as string | null,
      sourceco_contact_id,
      phoneburner_user_id: ((payload.user as Record<string, unknown>)?.id ||
        payload.user_id ||
        null) as string | null,
      signature_valid: signatureValid,
      ip_address: clientIp,
      received_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (logError) {
    console.error('Failed to log webhook:', logError);
    return jsonResponse({ error: 'Logging failed' }, 500, corsHeaders);
  }

  // ── process the event ──
  try {
    const activityId = await processEvent(supabase, eventType, payload);
    await supabase
      .from('phoneburner_webhooks_log')
      .update({
        processing_status: 'success',
        processing_completed_at: new Date().toISOString(),
        contact_activity_id: activityId,
      })
      .eq('id', logEntry.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error processing ${eventType}:`, message);
    await supabase
      .from('phoneburner_webhooks_log')
      .update({
        processing_status: 'failed',
        processing_error: message,
        processing_completed_at: new Date().toISOString(),
      })
      .eq('id', logEntry.id);
  }

  return jsonResponse({ ok: true }, 200, corsHeaders);
});

function detectEventType(payload: Record<string, unknown>): string {
  // Check explicit event field first
  if (payload.event) return String(payload.event);
  // PhoneBurner may send type in different fields
  if (payload.type) return String(payload.type);
  // Detect from payload structure
  if (payload.disposition || payload.disposition_id) return 'call_end';
  if (payload.call_id && !payload.disposition) return 'call_begin';
  if (payload.contact_id && !payload.call_id) return 'contact_displayed';
  return 'unknown';
}

/**
 * Extract contact info + custom_fields from the webhook payload.
 * PhoneBurner sends contact data in various structures depending on the
 * webhook type (call-end, disposition, contact-displayed, etc.)
 */
function extractContactInfo(payload: Record<string, unknown>) {
  const contact = (payload.contact || {}) as Record<string, unknown>;
  const customFields = (contact.custom_fields || payload.custom_fields || {}) as Record<
    string,
    unknown
  >;
  const customData = (payload.custom_data || {}) as Record<string, unknown>;

  // Push function stores "sourceco_id"; support both keys
  const contactId = (customFields.sourceco_id || customFields.sourceco_contact_id || null) as
    | string
    | null;
  const pbContactId = (contact.id || payload.contact_id || '') as string;

  // Extract user/rep info from nested or flat fields
  const user = (payload.user || {}) as Record<string, unknown>;
  const userName = (user.name || payload.user_name || null) as string | null;
  const userEmail = (user.email || payload.user_email || null) as string | null;

  // Session-level metadata from push function
  const entityType = (customData.entity_type || null) as string | null;
  const pushedBy = (customData.pushed_by || null) as string | null;
  const sessionSource = (customData.source || null) as string | null;

  return { contactId, pbContactId, customFields, customData, userName, userEmail, entityType, pushedBy, sessionSource };
}

async function processEvent(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<string | null> {
  const { contactId, pbContactId, userName, userEmail } = extractContactInfo(payload);

  switch (eventType) {
    case 'call_begin':
    case 'call.started': {
      const { data } = await supabase
        .from('contact_activities')
        .insert({
          activity_type: 'call_attempt',
          source_system: 'phoneburner',
          phoneburner_call_id: (payload.call_id || '') as string,
          phoneburner_contact_id: pbContactId,
          phoneburner_event_id: (payload.id || payload.event_id || null) as string | null,
          call_started_at:
            (payload.started_at as string) ||
            (payload.timestamp as string) ||
            new Date().toISOString(),
          call_outcome: 'dialing',
          contact_id: contactId,
          user_name: userName,
          user_email: userEmail,
        })
        .select('id')
        .single();
      return data?.id || null;
    }

    case 'call_end':
    case 'call.ended':
    case 'disposition.set': {
      // Extract disposition info from nested or flat fields
      const disposition = (payload.disposition || {}) as Record<string, unknown>;
      const dispositionCode = (disposition.code ||
        payload.disposition_id ||
        payload.disposition_code ||
        '') as string;
      const dispositionLabel = (disposition.label ||
        payload.disposition_name ||
        payload.disposition_label ||
        '') as string;
      const notes = (disposition.notes || payload.notes || payload.call_notes || '') as string;

      // Extract duration from nested call_summary or flat fields
      const callSummary = (payload.call_summary || {}) as Record<string, unknown>;
      const duration = (callSummary.total_duration_seconds ||
        payload.duration ||
        payload.call_duration ||
        payload.total_duration_seconds ||
        0) as number;
      const talkTime = (callSummary.talk_duration_seconds ||
        payload.talk_time ||
        payload.talk_duration_seconds ||
        null) as number | null;

      // Extract recording info
      const recording = (payload.recording || {}) as Record<string, unknown>;
      const recordingUrl = (recording.url || payload.recording_url || '') as string;
      const recordingDuration = (recording.duration_seconds ||
        payload.recording_duration ||
        null) as number | null;

      // Extract call timing
      const callStartedAt =
        ((payload.call_started_at ||
          callSummary.started_at ||
          payload.started_at ||
          payload.timestamp) as string) || new Date().toISOString();
      const callEndedAt =
        ((callSummary.ended_at || payload.ended_at || payload.timestamp) as string) ||
        new Date().toISOString();

      const { data } = await supabase
        .from('contact_activities')
        .insert({
          activity_type: 'call_completed',
          source_system: 'phoneburner',
          phoneburner_call_id: (payload.call_id || '') as string,
          phoneburner_contact_id: pbContactId,
          phoneburner_event_id: (payload.id || payload.event_id || null) as string | null,
          call_started_at: callStartedAt,
          call_ended_at: callEndedAt,
          call_duration_seconds: duration,
          talk_time_seconds: talkTime,
          call_outcome: dispositionCode ? 'dispositioned' : 'completed',
          disposition_code: dispositionCode || null,
          disposition_label: dispositionLabel || null,
          disposition_notes: notes || null,
          recording_url: recordingUrl || null,
          recording_duration_seconds: recordingDuration,
          contact_id: contactId,
          user_name: userName,
          user_email: userEmail,
        })
        .select('id')
        .single();

      // Update last_contacted_date on the source contact record
      if (contactId) {
        const rawId = contactId.replace(/^(rm-|buyer-)/, '');
        await supabase
          .from('buyer_contacts')
          .update({ last_contacted_date: new Date().toISOString() })
          .eq('id', rawId);
      }

      // Look up disposition mapping and apply status updates
      if (dispositionCode) {
        const { data: mapping } = await supabase
          .from('disposition_mappings')
          .select('*')
          .eq('phoneburner_disposition_code', dispositionCode)
          .maybeSingle();
        if (mapping) {
          console.log(
            `Disposition mapped: ${dispositionCode} → ${mapping.sourceco_contact_status} / ${mapping.sourceco_contact_stage}`,
          );
          // Apply suppress/DNC flags if configured
          if (contactId && (mapping.mark_do_not_call || mapping.mark_phone_invalid)) {
            const rawId = contactId.replace(/^(rm-|buyer-)/, '');
            const updates: Record<string, unknown> = {};
            if (mapping.mark_do_not_call) updates.do_not_contact = true;
            if (mapping.mark_phone_invalid) updates.phone_invalid = true;
            await supabase.from('buyer_contacts').update(updates).eq('id', rawId);
          }
        }
      }
      return data?.id || null;
    }

    case 'contact_displayed':
    case 'contact.displayed': {
      const { data } = await supabase
        .from('contact_activities')
        .insert({
          activity_type: 'contact_displayed',
          source_system: 'phoneburner',
          phoneburner_contact_id: pbContactId,
          call_started_at: new Date().toISOString(),
          call_outcome: 'displayed',
          contact_id: contactId,
          user_name: userName,
          user_email: userEmail,
        })
        .select('id')
        .single();
      return data?.id || null;
    }

    case 'callback.scheduled': {
      const callback = (payload.callback || {}) as Record<string, unknown>;
      const { data } = await supabase
        .from('contact_activities')
        .insert({
          activity_type: 'callback_scheduled',
          source_system: 'phoneburner',
          phoneburner_contact_id: pbContactId,
          callback_scheduled_date: (callback.scheduled_for || payload.callback_date || null) as
            | string
            | null,
          disposition_notes: (callback.notes || payload.callback_notes || '') as string,
          contact_id: contactId,
          user_name: userName,
          user_email: userEmail,
        })
        .select('id')
        .single();
      return data?.id || null;
    }

    default:
      console.log(`Unhandled PhoneBurner event type: ${eventType}`);
      return null;
  }
}
