/**
 * HeyReach Webhook Receiver
 *
 * Receives webhook events from HeyReach (connection accepted, message received,
 * reply, etc.) and logs them for processing.
 *
 * This endpoint does NOT require JWT auth — it uses a shared secret
 * (HEYREACH_WEBHOOK_SECRET) to verify incoming requests.
 *
 * Configure this URL in HeyReach webhook settings:
 *   POST {SUPABASE_URL}/functions/v1/heyreach-webhook
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';

const encoder = new TextEncoder();

/** Timing-safe HMAC-SHA256 verification (mirrors PhoneBurner webhook). */
async function verifyHmac(
  payload: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature) return false;
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);
  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  // ─── Verify webhook secret (mandatory, HMAC-SHA256) ─────────────────────
  const webhookSecret = Deno.env.get('HEYREACH_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('[heyreach-webhook] HEYREACH_WEBHOOK_SECRET not configured');
    return new Response(JSON.stringify({ error: 'Webhook auth not configured' }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  // Read raw body for HMAC verification
  const rawBody = await req.text();
  const hmacSignature =
    req.headers.get('x-webhook-signature') || req.headers.get('x-webhook-secret');

  // Try HMAC first, fall back to plain header match for backwards compat
  const hmacValid = hmacSignature ? await verifyHmac(rawBody, hmacSignature, webhookSecret) : false;
  const headerMatch = hmacSignature === webhookSecret;

  if (!hmacValid && !headerMatch) {
    console.warn('[heyreach-webhook] Invalid webhook signature');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const payload = JSON.parse(rawBody);

    // Extract event details from HeyReach webhook payload
    const eventType = payload.event_type || payload.event || payload.type || 'unknown';
    const campaignId = payload.campaign_id || payload.campaignId || null;
    const leadLinkedInUrl =
      payload.lead_linkedin_url ||
      payload.linkedInUrl ||
      payload.linkedin_url ||
      payload.profileUrl ||
      null;
    const leadEmail = payload.lead_email || payload.email || null;

    // Log the webhook event
    const { error: insertError } = await supabase.from('heyreach_webhook_events').insert({
      heyreach_campaign_id: campaignId,
      event_type: eventType,
      lead_linkedin_url: leadLinkedInUrl,
      lead_email: leadEmail,
      payload,
      processed: false,
    });

    if (insertError) {
      console.error('[heyreach-webhook] Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to log event' }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    // ─── Process specific event types ──────────────────────────────────
    if (campaignId && leadLinkedInUrl) {
      const { data: localCampaign } = await supabase
        .from('heyreach_campaigns')
        .select('id')
        .eq('heyreach_campaign_id', campaignId)
        .single();

      if (localCampaign) {
        const updateFields: Record<string, unknown> = {
          last_activity_at: new Date().toISOString(),
        };

        // Map HeyReach event types to local categories
        switch (eventType) {
          case 'CONNECTION_REQUEST_SENT':
            updateFields.lead_status = 'connection_sent';
            break;
          case 'CONNECTION_REQUEST_ACCEPTED':
            updateFields.lead_status = 'connected';
            updateFields.lead_category = 'connected';
            break;
          case 'MESSAGE_SENT':
          case 'INMAIL_SENT':
            updateFields.lead_status = 'messaged';
            break;
          case 'MESSAGE_RECEIVED':
          case 'INMAIL_RECEIVED':
          case 'LEAD_REPLIED':
            updateFields.lead_status = 'replied';
            updateFields.lead_category = 'replied';
            break;
          case 'LEAD_INTERESTED':
            updateFields.lead_category = 'interested';
            updateFields.lead_status = 'interested';
            break;
          case 'LEAD_NOT_INTERESTED':
            updateFields.lead_category = 'not_interested';
            updateFields.lead_status = 'not_interested';
            break;
          case 'PROFILE_VIEWED':
            updateFields.lead_status = 'profile_viewed';
            break;
        }

        await supabase
          .from('heyreach_campaign_leads')
          .update(updateFields)
          .eq('campaign_id', localCampaign.id)
          .eq('linkedin_url', leadLinkedInUrl);
      }

      // Mark as processed
      await supabase
        .from('heyreach_webhook_events')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('heyreach_campaign_id', campaignId)
        .eq('lead_linkedin_url', leadLinkedInUrl)
        .eq('event_type', eventType)
        .eq('processed', false)
        .order('created_at', { ascending: false })
        .limit(1);
    }

    // ─── Sync linkedin_url to contacts table ───────────────────────────
    // If we have a lead's LinkedIn URL, make sure it's captured on any
    // matching contact records (matched by email or by heyreach_campaign_leads link)
    if (leadLinkedInUrl) {
      try {
        // Strategy 1: Match via heyreach_campaign_leads → buyer_contact_id / remarketing_buyer_id
        if (campaignId) {
          const { data: leads } = await supabase
            .from('heyreach_campaign_leads')
            .select('buyer_contact_id, remarketing_buyer_id, email, first_name, last_name')
            .eq('linkedin_url', leadLinkedInUrl)
            .limit(5);

          for (const lead of leads || []) {
            // Update unified contacts table by remarketing_buyer_id + email match
            if (lead.remarketing_buyer_id && lead.email) {
              await supabase
                .from('contacts')
                .update({ linkedin_url: leadLinkedInUrl })
                .eq('remarketing_buyer_id', lead.remarketing_buyer_id)
                .ilike('email', lead.email)
                .is('linkedin_url', null);
            }
          }
        }

        // Strategy 2: Match any contact by email if we have it
        if (leadEmail) {
          await supabase
            .from('contacts')
            .update({ linkedin_url: leadLinkedInUrl })
            .ilike('email', leadEmail)
            .is('linkedin_url', null);
        }
      } catch (syncErr) {
        // Non-fatal: log but don't fail the webhook
        console.warn('[heyreach-webhook] Contact linkedin_url sync error:', syncErr);
      }
    }

    console.log(
      `[heyreach-webhook] Processed ${eventType} for campaign ${campaignId}, lead ${leadLinkedInUrl}`,
    );

    return new Response(JSON.stringify({ success: true }), {
      headers: jsonHeaders,
    });
  } catch (err) {
    console.error('[heyreach-webhook] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
