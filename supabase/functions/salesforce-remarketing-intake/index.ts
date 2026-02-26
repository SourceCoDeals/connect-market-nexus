/**
 * Salesforce Remarketing Intake Webhook
 *
 * Receives a webhook from Salesforce when Remarketing = True on an Account.
 * Creates/updates a listing (deal) and seller contact in the SourceCo platform.
 *
 * Direction: Salesforce → SourceCo (one-way push, nothing writes back).
 * Trigger:   Remarketing__c = True on a Salesforce Account record.
 * Auth:      Shared secret via x-sourceco-secret header.
 *
 * This endpoint does NOT require JWT auth — it uses a shared secret
 * (SF_WEBHOOK_SECRET) to verify incoming requests from Salesforce.
 *
 * Configure this URL in Salesforce Flow:
 *   POST {SUPABASE_URL}/functions/v1/salesforce-remarketing-intake
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  // Only accept POST
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── 1. AUTHENTICATE ──────────────────────────────────────────
  const secret = req.headers.get('x-sourceco-secret');
  const expectedSecret = Deno.env.get('SF_WEBHOOK_SECRET');

  if (!expectedSecret || secret !== expectedSecret) {
    console.error('[salesforce-remarketing-intake] Unauthorized webhook attempt');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── 2. PARSE PAYLOAD ─────────────────────────────────────────
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
    console.log('[salesforce-remarketing-intake] Received payload for:', payload.account_name);
  } catch (e) {
    console.error('[salesforce-remarketing-intake] Failed to parse payload:', e);
    return new Response(JSON.stringify({ error: 'Bad Request — invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate required fields
  if (!payload.salesforce_account_id || !payload.account_name) {
    console.error('[salesforce-remarketing-intake] Missing required fields');
    return new Response(
      JSON.stringify({ error: 'Bad Request — salesforce_account_id and account_name are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── 3. INIT SUPABASE CLIENT ──────────────────────────────────
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const now = new Date().toISOString();

  try {
    // ── 4. UPSERT LISTING (DEAL) ────────────────────────────────
    // The listings table is the deals table in this platform.
    // salesforce_account_id is the deduplication key — if the same Account
    // triggers the webhook again, the existing record is updated.
    const contactName = [
      payload.contact_first_name ?? '',
      payload.contact_last_name ?? '',
    ]
      .map((s) => String(s).trim())
      .filter(Boolean)
      .join(' ');

    const contactPhone = payload.contact_phone || payload.phone || null;
    const ndaBoolean =
      payload.nda === true || payload.nda === 'true' || payload.nda === 'True';

    // Build location string from address components
    const locationParts = [payload.city, payload.state]
      .map((s) => (s ? String(s).trim() : ''))
      .filter(Boolean);
    const location = locationParts.length > 0 ? locationParts.join(', ') : null;

    // Parse annual revenue as numeric
    const revenue = payload.annual_revenue
      ? parseFloat(String(payload.annual_revenue)) || null
      : null;
    const ebitda = payload.ebitda
      ? parseFloat(String(payload.ebitda)) || null
      : null;
    const sellerInterestScore = payload.seller_interest_score
      ? parseFloat(String(payload.seller_interest_score)) || null
      : null;

    // Normalize website
    let website = payload.website ? String(payload.website).trim() : null;
    if (website && !website.startsWith('http://') && !website.startsWith('https://')) {
      website = `https://${website}`;
    }

    const listingData: Record<string, unknown> = {
      salesforce_account_id: String(payload.salesforce_account_id),
      title: String(payload.account_name),
      internal_company_name: String(payload.account_name),
      description: payload.remarketing_reason
        ? String(payload.remarketing_reason)
        : null,
      website,
      revenue,
      ebitda,
      location,
      address_city: payload.city ? String(payload.city).trim() : null,
      address_state: payload.state ? String(payload.state).trim() : null,
      main_contact_name: contactName || null,
      main_contact_email: payload.contact_email
        ? String(payload.contact_email).trim()
        : null,
      main_contact_phone: contactPhone ? String(contactPhone).trim() : null,
      main_contact_title: payload.contact_title
        ? String(payload.contact_title).trim()
        : null,
      deal_source: 'salesforce_remarketing',
      status: 'active',
      is_internal_deal: true,
      pushed_to_all_deals: false,
      // SourceCo-specific metadata
      sf_remarketing_reason: payload.remarketing_reason
        ? String(payload.remarketing_reason)
        : null,
      sf_primary_client_account: payload.primary_client_account
        ? String(payload.primary_client_account)
        : null,
      sf_target_stage: payload.target_stage
        ? String(payload.target_stage)
        : null,
      sf_target_sub_stage: payload.target_sub_stage
        ? String(payload.target_sub_stage)
        : null,
      sf_interest_in_selling: payload.interest_in_selling
        ? String(payload.interest_in_selling)
        : null,
      sf_seller_interest_score: sellerInterestScore,
      sf_note_summary: payload.note_summary
        ? String(payload.note_summary)
        : null,
      sf_most_recent_update: payload.most_recent_update
        ? String(payload.most_recent_update)
        : null,
      sf_one_pager:
        payload.one_pager === true || payload.one_pager === 'true' || payload.one_pager === 'True',
      sf_lead_memo:
        payload.lead_memo === true || payload.lead_memo === 'true' || payload.lead_memo === 'True',
      sf_nda: ndaBoolean,
      updated_at: now,
    };

    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .upsert(listingData, {
        onConflict: 'salesforce_account_id',
        ignoreDuplicates: false,
      })
      .select('id')
      .single();

    if (listingError) {
      console.error('[salesforce-remarketing-intake] Listing upsert failed:', listingError);
      return new Response(
        JSON.stringify({ error: 'Listing upsert failed', detail: listingError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    console.log('[salesforce-remarketing-intake] Listing upserted:', listing.id);

    // ── 5. UPSERT SELLER CONTACT ────────────────────────────────
    // Seller contacts are unique by (email, listing_id) in the contacts table.
    // Only create a contact if we have an email address.
    const contactEmail = payload.contact_email
      ? String(payload.contact_email).trim().toLowerCase()
      : null;

    if (contactEmail) {
      const contactData: Record<string, unknown> = {
        first_name: payload.contact_first_name
          ? String(payload.contact_first_name).trim()
          : 'Unknown',
        last_name: payload.contact_last_name
          ? String(payload.contact_last_name).trim()
          : '',
        email: contactEmail,
        phone: contactPhone ? String(contactPhone).trim() : null,
        title: payload.contact_title
          ? String(payload.contact_title).trim()
          : null,
        linkedin_url: payload.linkedin_url
          ? String(payload.linkedin_url).trim()
          : null,
        contact_type: 'seller',
        source: 'salesforce',
        notes: payload.remarketing_reason
          ? String(payload.remarketing_reason)
          : null,
        nda_signed: ndaBoolean,
        fee_agreement_signed: false,
        archived: false,
        is_primary_seller_contact: true,
        company_name: String(payload.account_name),
        listing_id: listing.id,
        updated_at: now,
      };

      const { error: contactError } = await supabase
        .from('contacts')
        .upsert(contactData, {
          onConflict: 'idx_contacts_seller_email_listing_unique',
          ignoreDuplicates: false,
        });

      if (contactError) {
        // Log but don't fail — the listing was already created successfully
        console.error(
          '[salesforce-remarketing-intake] Contact upsert failed:',
          contactError,
        );
      } else {
        console.log(
          '[salesforce-remarketing-intake] Seller contact upserted for:',
          contactEmail,
        );
      }
    } else {
      console.warn(
        '[salesforce-remarketing-intake] No contact email — skipping contact creation for:',
        payload.account_name,
      );
    }

    // ── 6. SUCCESS ──────────────────────────────────────────────
    console.log(
      '[salesforce-remarketing-intake] Successfully processed:',
      payload.account_name,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        listing_id: listing.id,
        account_name: payload.account_name,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[salesforce-remarketing-intake] Unexpected error:', err);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        detail: err instanceof Error ? err.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
