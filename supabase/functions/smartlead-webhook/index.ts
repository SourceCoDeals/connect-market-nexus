/**
 * Smartlead Webhook Receiver
 *
 * Receives webhook events from Smartlead (email replied, bounced,
 * unsubscribed, etc.) and logs them for processing.
 *
 * This endpoint does NOT require JWT auth — it uses a shared secret
 * (SMARTLEAD_WEBHOOK_SECRET) to verify incoming requests.
 *
 * Configure this URL in Smartlead campaign webhook settings:
 *   POST {SUPABASE_URL}/functions/v1/smartlead-webhook
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { timingSafeEqual } from '../_shared/security.ts';

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

  // ─── Verify webhook secret (mandatory) ──────────────────────────────────
  const webhookSecret = Deno.env.get('SMARTLEAD_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('[smartlead-webhook] SMARTLEAD_WEBHOOK_SECRET is not set — rejecting request');
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  // CTO audit: accept the secret ONLY from the header, never the query
  // param. Query params get logged in access logs and browser history,
  // leaking the shared secret. Header-only is the canonical webhook auth
  // convention.
  const providedSecret = req.headers.get('x-webhook-secret');

  if (!providedSecret || !timingSafeEqual(providedSecret, webhookSecret)) {
    console.warn('[smartlead-webhook] Invalid webhook secret');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const payload = await req.json();

    // Extract event details from Smartlead webhook payload
    const eventType = payload.event_type || payload.event || payload.type || 'unknown';

    const campaignId = payload.campaign_id || payload.sl_campaign_id || null;

    const leadEmail = payload.lead_email || payload.email || payload.to_email || null;

    // Log the webhook event
    const { error: insertError } = await supabase.from('smartlead_webhook_events').insert({
      smartlead_campaign_id: campaignId,
      event_type: eventType,
      lead_email: leadEmail,
      payload,
      processed: false,
    });

    if (insertError) {
      console.error('[smartlead-webhook] Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to log event' }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    // ─── Process specific event types ──────────────────────────────────
    if (campaignId && leadEmail) {
      // Update local lead tracking based on event type
      const { data: localCampaign } = await supabase
        .from('smartlead_campaigns')
        .select('id')
        .eq('smartlead_campaign_id', campaignId)
        .single();

      if (localCampaign) {
        const updateFields: Record<string, unknown> = {
          last_activity_at: new Date().toISOString(),
        };

        // Map Smartlead event types to local categories
        switch (eventType) {
          case 'EMAIL_REPLIED':
          case 'REPLIED':
            updateFields.lead_category = 'replied';
            updateFields.lead_status = 'replied';
            break;
          case 'EMAIL_BOUNCED':
          case 'BOUNCED':
            updateFields.lead_category = 'bounced';
            updateFields.lead_status = 'bounced';
            break;
          case 'UNSUBSCRIBED':
            updateFields.lead_category = 'unsubscribed';
            updateFields.lead_status = 'unsubscribed';
            break;
          case 'EMAIL_OPENED':
          case 'OPENED':
            updateFields.lead_status = 'opened';
            break;
          case 'LINK_CLICKED':
          case 'CLICKED':
            updateFields.lead_status = 'clicked';
            break;
          case 'INTERESTED':
            updateFields.lead_category = 'interested';
            updateFields.lead_status = 'interested';
            break;
          case 'NOT_INTERESTED':
            updateFields.lead_category = 'not_interested';
            updateFields.lead_status = 'not_interested';
            break;
        }

        await supabase
          .from('smartlead_campaign_leads')
          .update(updateFields)
          .eq('campaign_id', localCampaign.id)
          .eq('email', leadEmail);
      }

      // Mark as processed
      // (The event was just inserted — update by matching the latest unprocessed
      // event for this campaign/email combo)
      await supabase
        .from('smartlead_webhook_events')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('smartlead_campaign_id', campaignId)
        .eq('lead_email', leadEmail)
        .eq('event_type', eventType)
        .eq('processed', false)
        .order('created_at', { ascending: false })
        .limit(1);
    }

    // INTERESTED event → auto-create a "call back today" task so the SDR
    // doesn't have to watch the inbox. Scoped to contacts that exist in the
    // CRM (resolveOutreachContact semantics) — if the lead isn't a CRM
    // contact, we skip silently. Dedup by tag so repeat INTERESTED events
    // for the same lead don't pile up duplicate tasks.
    if ((eventType === 'INTERESTED' || eventType === 'EMAIL_REPLIED') && leadEmail) {
      try {
        const { data: contact } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, email, archived')
          .ilike('email', leadEmail)
          .eq('archived', false)
          .maybeSingle();

        if (contact?.id) {
          const name =
            [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email;
          const tag = `auto:smartlead-${eventType.toLowerCase()}:${contact.id}`;

          // Idempotent — skip if an open task with the same marker tag exists.
          const { data: existing } = await supabase
            .from('daily_standup_tasks')
            .select('id')
            .contains('tags', [tag])
            .in('status', ['pending', 'in_progress'])
            .limit(1);

          if (!existing || existing.length === 0) {
            const title =
              eventType === 'INTERESTED'
                ? `Call back: ${name} replied INTERESTED`
                : `Call back: ${name} replied to Smartlead`;
            await supabase.from('daily_standup_tasks').insert({
              title,
              description: `Auto-created from Smartlead ${eventType} event on ${new Date().toISOString().slice(0, 10)}.`,
              task_type: 'call',
              status: 'pending',
              due_date: new Date().toISOString().slice(0, 10),
              is_manual: false,
              priority_score: eventType === 'INTERESTED' ? 95 : 75,
              tags: [tag, 'smartlead', eventType.toLowerCase()],
              entity_type: 'contact',
              entity_id: contact.id,
            });
            console.log(
              `[smartlead-webhook] Auto-task created for ${eventType} reply from ${leadEmail}`,
            );
          }
        }
      } catch (err) {
        // Non-fatal — don't block the webhook on task creation failures.
        console.warn('[smartlead-webhook] Auto-task creation failed:', err);
      }
    }

    console.log(
      `[smartlead-webhook] Processed ${eventType} for campaign ${campaignId}, lead ${leadEmail}`,
    );

    // Real-time sync: kick off sync-smartlead-messages for this one campaign so
    // the new event lands in smartlead_messages within ~1 minute instead of
    // waiting up to 20 min for the next cron run. Fire-and-forget — we don't
    // block the webhook response on it, and failures are self-healing (the
    // regular cron picks up missed events on its next pass).
    if (campaignId) {
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (serviceRoleKey) {
        fetch(`${supabaseUrl}/functions/v1/sync-smartlead-messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ campaign_id: Number(campaignId), source: 'webhook-trigger' }),
        }).catch((err) => {
          console.warn('[smartlead-webhook] sync trigger failed (non-fatal):', err);
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: jsonHeaders,
    });
  } catch (err) {
    console.error('[smartlead-webhook] Error:', err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Internal error',
      }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
