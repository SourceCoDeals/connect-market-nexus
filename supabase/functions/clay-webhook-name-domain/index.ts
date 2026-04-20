/**
 * Clay Webhook — Name + Domain Results Receiver
 *
 * Receives enriched contact data back from Clay after its waterfall enrichment.
 * Clay sends results to this endpoint after processing a name+domain lookup.
 * Correlation is done via request_id (echoed back by Clay).
 *
 * Idempotency: duplicate request_id callbacks are safely ignored.
 *
 * Hardening:
 *   - Sentinel "no email found" / "not found" / "n/a" / "" strings are
 *     normalized to null and never written to work_email.
 *   - LinkedIn URL is parsed from any of several possible payload field names.
 *   - When Clay returns a LinkedIn URL but no phone, the phone enrichment
 *     step is automatically continued via clay-webhook-phone fan-out.
 *
 * POST /clay-webhook-name-domain
 * Body: { request_id, email, ... } (flexible — user configures Clay output)
 */

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import { timingSafeEqual } from '../_shared/security.ts';

const FAILURE_SENTINELS = new Set([
  '',
  'n/a',
  'na',
  'none',
  'null',
  'undefined',
  'no email found',
  'no email',
  'not found',
  'no result',
  'no results',
  'no linkedin found',
  'no linkedin',
  'no phone found',
  'no phone',
  'email not found',
  'linkedin not found',
  'phone not found',
]);

function cleanResultString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (FAILURE_SENTINELS.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

function extractLinkedInUrl(payload: Record<string, unknown>): string | null {
  const candidates = [
    payload.linkedin_url,
    payload.linkedinUrl,
    payload.linkedin,
    payload.linkedin_profile,
    payload.linkedinProfile,
    payload.li_url,
    payload.profile_url,
  ];
  for (const c of candidates) {
    const cleaned = cleanResultString(c);
    if (cleaned && cleaned.toLowerCase().includes('linkedin.com/')) {
      try {
        const u = new URL(cleaned.startsWith('http') ? cleaned : `https://${cleaned}`);
        return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
      } catch {
        return cleaned;
      }
    }
  }
  return null;
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    // 0. Verify webhook secret
    const webhookSecret = Deno.env.get('CLAY_WEBHOOK_SECRET');
    if (webhookSecret) {
      const providedSecret =
        req.headers.get('x-webhook-secret') || new URL(req.url).searchParams.get('secret');
      if (!providedSecret || !timingSafeEqual(providedSecret, webhookSecret)) {
        console.warn('[clay-webhook-name-domain] Invalid webhook secret');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
      }
    }

    // 1. Parse payload
    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
    }

    // 2. Extract request_id — required for correlation
    const requestId = payload.request_id as string;
    if (!requestId || typeof requestId !== 'string') {
      console.error('[clay-webhook-name-domain] Missing request_id in payload');
      return new Response(JSON.stringify({ error: 'request_id is required' }), { status: 400 });
    }

    console.log(`[clay-webhook-name-domain] Received callback for request_id: ${requestId}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 3. Look up the tracking row
    const { data: request, error: lookupErr } = await supabase
      .from('clay_enrichment_requests')
      .select('*')
      .eq('request_id', requestId)
      .maybeSingle();

    if (lookupErr) {
      console.error(`[clay-webhook-name-domain] DB lookup error: ${lookupErr.message}`);
      return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
    }

    if (!request) {
      console.warn(`[clay-webhook-name-domain] No matching request found for: ${requestId}`);
      return new Response(JSON.stringify({ success: true, note: 'No matching request' }), {
        status: 200,
      });
    }

    // 4. Idempotency — skip if already completed
    if (request.status === 'completed') {
      console.log(`[clay-webhook-name-domain] Duplicate callback skipped for: ${requestId}`);
      return new Response(JSON.stringify({ success: true, note: 'Duplicate callback' }), {
        status: 200,
      });
    }

    // 5. Extract & sanitize email and LinkedIn from flexible payload
    const resultEmail = cleanResultString(payload.email) || cleanResultString(payload.work_email);
    const resultLinkedIn = extractLinkedInUrl(payload);

    // 6. Update tracking row
    const status = resultEmail || resultLinkedIn ? 'completed' : 'failed';
    const { error: updateErr } = await supabase
      .from('clay_enrichment_requests')
      .update({
        status,
        result_email: resultEmail,
        result_data: payload,
        completed_at: new Date().toISOString(),
        raw_callback_payload: payload,
      })
      .eq('request_id', requestId);

    if (updateErr) {
      console.error(`[clay-webhook-name-domain] Update failed: ${updateErr.message}`);
    }

    // 7. If we got a usable result, save to contacts via RPC
    if (resultEmail || resultLinkedIn) {
      const fullName = `${request.first_name || ''} ${request.last_name || ''}`.trim();

      if (resultEmail) {
        await supabase.rpc('contacts_upsert', {
          p_identity: {
            email: resultEmail,
            linkedin_url: resultLinkedIn || request.linkedin_url || null,
          },
          p_fields: {
            first_name: request.first_name || 'Unknown',
            last_name: request.last_name || '',
            title: request.title || null,
            email: resultEmail,
            linkedin_url: resultLinkedIn || request.linkedin_url || null,
            contact_type: 'buyer',
          },
          p_source: 'clay_name_domain',
          p_enrichment: {
            provider: 'clay_name_domain',
            confidence: 'medium',
            source_query: `clay:${request.first_name} ${request.last_name}@${request.domain}`,
          },
        });
      }

      // 8. Update source entity with result
      if (request.source_entity_id) {
        if (request.source_function === 'find-valuation-lead-contacts') {
          // Valuation lead enrichment — Clay may return LinkedIn URL alongside email
          const leadUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (resultLinkedIn) leadUpdates.linkedin_url = resultLinkedIn;
          // Save enriched email as work_email (don't overwrite submission email)
          if (resultEmail) leadUpdates.work_email = resultEmail;

          if (Object.keys(leadUpdates).length > 1) {
            const { error: leadUpdateErr } = await supabase
              .from('valuation_leads')
              .update(leadUpdates)
              .eq('id', request.source_entity_id);

            if (leadUpdateErr) {
              console.warn(
                `[clay-webhook-name-domain] Valuation lead update failed for ${request.source_entity_id}: ${leadUpdateErr.message}`,
              );
            } else {
              console.log(
                `[clay-webhook-name-domain] Updated valuation_lead ${request.source_entity_id} with Clay result (li=${resultLinkedIn ? 'Y' : 'N'} email=${resultEmail ? 'Y' : 'N'})`,
              );
            }
          }

          // 9. Continue the chain: if Clay just discovered a LinkedIn URL, fire
          //    the phone enrichment step automatically. Otherwise the lead is
          //    stuck halfway with LinkedIn but no phone.
          if (resultLinkedIn) {
            await continuePhoneEnrichment(
              supabase,
              request.source_entity_id,
              resultLinkedIn,
              request.first_name,
              request.last_name,
              request.company_name,
            );
          }
        } else {
          // Default: update contacts table via RPC (only if we have an email)
          if (resultEmail) {
            const { error: contactUpdateErr } = await supabase.rpc('contacts_upsert', {
              p_identity: { email: resultEmail },
              p_fields: { email: resultEmail },
              p_source: 'clay_name_domain',
              p_enrichment: {
                provider: 'clay_name_domain',
                confidence: 'medium',
                source_query: `clay:${request.first_name} ${request.last_name}@${request.domain}`,
              },
            });

            if (contactUpdateErr) {
              console.warn(
                `[clay-webhook-name-domain] Contact update failed for ${request.source_entity_id}: ${contactUpdateErr.message}`,
              );
            } else {
              console.log(
                `[clay-webhook-name-domain] Updated contact ${request.source_entity_id} with Clay result`,
              );
            }
          }
        }
      }

      console.log(
        `[clay-webhook-name-domain] Enrichment saved — email=${resultEmail || 'NONE'} li=${resultLinkedIn || 'NONE'} for ${fullName}`,
      );
    } else {
      console.log(
        `[clay-webhook-name-domain] No usable result for ${requestId} (email/linkedin both empty or sentinels)`,
      );
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: unknown) {
    console.error('[clay-webhook-name-domain] Handler error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});

/**
 * If Clay just discovered a LinkedIn URL during the name+domain step, fire the
 * phone enrichment step so the lead doesn't dead-end at "LinkedIn but no phone".
 * Creates a clay_enrichment_requests row and calls the Clay phone webhook.
 */
async function continuePhoneEnrichment(
  supabase: ReturnType<typeof createClient>,
  valuationLeadId: string,
  linkedinUrl: string,
  firstName: string | null,
  lastName: string | null,
  companyName: string | null,
): Promise<void> {
  try {
    // Skip if the lead already has a phone
    const { data: lead } = await supabase
      .from('valuation_leads')
      .select('phone')
      .eq('id', valuationLeadId)
      .maybeSingle();

    if (lead?.phone) {
      console.log(
        `[clay-webhook-name-domain] Lead ${valuationLeadId} already has phone — skipping phone chain`,
      );
      return;
    }

    const requestId = crypto.randomUUID();
    const SYSTEM_WORKSPACE_ID = '00000000-0000-0000-0000-000000000000';

    const { error: insertErr } = await supabase.from('clay_enrichment_requests').insert({
      request_id: requestId,
      request_type: 'phone',
      status: 'pending',
      workspace_id: SYSTEM_WORKSPACE_ID,
      first_name: firstName || null,
      last_name: lastName || null,
      linkedin_url: linkedinUrl,
      company_name: companyName || null,
      source_function: 'find-valuation-lead-contacts',
      source_entity_id: valuationLeadId,
    });

    if (insertErr) {
      console.warn(
        `[clay-webhook-name-domain] Failed to insert chained phone request: ${insertErr.message}`,
      );
      return;
    }

    // Fire the Clay phone webhook directly
    const clayPhoneWebhookUrl = Deno.env.get('CLAY_PHONE_WEBHOOK_URL');
    if (!clayPhoneWebhookUrl) {
      console.warn(
        `[clay-webhook-name-domain] CLAY_PHONE_WEBHOOK_URL not set — phone chain not sent`,
      );
      return;
    }

    fetch(clayPhoneWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: requestId,
        linkedin_url: linkedinUrl,
        first_name: firstName,
        last_name: lastName,
      }),
    })
      .then((res) => {
        if (!res.ok) {
          console.warn(
            `[clay-webhook-name-domain] Clay phone webhook returned ${res.status} for chained request`,
          );
        } else {
          console.log(
            `[clay-webhook-name-domain] ✅ Chained phone enrichment fired for ${valuationLeadId} (request=${requestId})`,
          );
        }
      })
      .catch((err) =>
        console.error(
          `[clay-webhook-name-domain] Clay phone chain fetch failed: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
  } catch (err) {
    console.warn(
      `[clay-webhook-name-domain] continuePhoneEnrichment failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
