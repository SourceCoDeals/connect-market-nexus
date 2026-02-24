/**
 * PhoneBurner Push Contacts — Multi-entity support
 *
 * Accepts entity_type + entity_ids to resolve contacts from any source:
 * - buyer_contacts: direct contact IDs (original flow)
 * - buyers: resolve via remarketing_buyer_contacts + buyer_contacts
 * - listings: resolve main_contact_* fields from listings table
 * - leads: resolve from inbound_leads table
 *
 * Falls back to legacy { contact_ids } for backward compatibility.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';

const PB_API_BASE = 'https://www.phoneburner.com/rest/1';

type EntityType = 'buyer_contacts' | 'buyers' | 'listings' | 'leads';

interface PushRequest {
  entity_type?: EntityType;
  entity_ids?: string[];
  contact_ids?: string[]; // Legacy — treated as buyer_contacts
  session_name?: string;
  skip_recent_days?: number;
}

interface ResolvedContact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  title: string | null;
  company: string | null;
  source_entity: string; // For logging
  last_contacted_date: string | null;
  extra_context?: Record<string, string>;
}

async function getValidToken(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  const { data: tokenRow } = await supabase
    .from('phoneburner_oauth_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!tokenRow) return null;

  const expiresAt = new Date(tokenRow.expires_at).getTime();
  if (Date.now() < expiresAt - 5 * 60 * 1000) {
    return tokenRow.access_token;
  }

  const clientId = Deno.env.get('PHONEBURNER_CLIENT_ID')!;
  const clientSecret = Deno.env.get('PHONEBURNER_CLIENT_SECRET')!;

  // Retry refresh up to 2 times for transient network failures
  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch('https://www.phoneburner.com/oauth/accesstoken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokenRow.refresh_token,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (res.ok) {
        const tokens = await res.json();
        if (!tokens.access_token) {
          console.error('Token refresh returned no access_token:', tokens);
          return null;
        }
        const newExpiresAt = new Date(
          Date.now() + (tokens.expires_in || 3600) * 1000,
        ).toISOString();

        await supabase
          .from('phoneburner_oauth_tokens')
          .update({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || tokenRow.refresh_token,
            expires_at: newExpiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        return tokens.access_token;
      }

      const errText = await res.text();
      lastError = `HTTP ${res.status}: ${errText}`;

      // 401/400 = token revoked or invalid → delete stale token so user gets re-auth prompt
      if (res.status === 401 || res.status === 400) {
        console.error(
          `Token refresh rejected (${res.status}) — deleting stale token for user ${userId}`,
        );
        await supabase.from('phoneburner_oauth_tokens').delete().eq('user_id', userId);
        return null;
      }

      // 5xx or other transient error → retry after short delay
      if (attempt < 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`Token refresh network error (attempt ${attempt + 1}):`, lastError);
      if (attempt < 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  console.error(`Token refresh failed after retries: ${lastError}`);
  return null;
}

// ─── Contact resolvers ───

async function resolveFromBuyerContacts(
  supabase: ReturnType<typeof createClient>,
  ids: string[],
): Promise<ResolvedContact[]> {
  const { data: contacts } = await supabase
    .from('buyer_contacts')
    .select('id, name, email, phone, title, buyer_id, company_type, last_contacted_date')
    .in('id', ids);

  if (!contacts?.length) return [];

  const buyerIds = [...new Set(contacts.map((c) => c.buyer_id))];
  const { data: buyers } = await supabase
    .from('remarketing_buyers')
    .select('id, company_name, pe_firm_name, buyer_type, target_services, target_geographies')
    .in('id', buyerIds);
  const buyerMap = new Map((buyers || []).map((b) => [b.id, b]));

  return contacts.map((c) => {
    const buyer = buyerMap.get(c.buyer_id);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      title: c.title,
      company: buyer?.company_name || c.company_type || null,
      source_entity: 'buyer_contact',
      last_contacted_date: c.last_contacted_date,
      extra_context: {
        buyer_type: buyer?.buyer_type || '',
        pe_firm: buyer?.pe_firm_name || '',
        target_services: Array.isArray(buyer?.target_services)
          ? buyer.target_services.join(', ')
          : '',
        target_geographies: Array.isArray(buyer?.target_geographies)
          ? buyer.target_geographies.join(', ')
          : '',
      },
    };
  });
}

async function resolveFromBuyers(
  supabase: ReturnType<typeof createClient>,
  buyerIds: string[],
): Promise<ResolvedContact[]> {
  // Get contacts from remarketing_buyer_contacts first
  const { data: rmContacts } = await supabase
    .from('remarketing_buyer_contacts')
    .select('id, buyer_id, name, email, phone, role, company_type, is_primary')
    .in('buyer_id', buyerIds);

  // Also get from buyer_contacts
  const { data: bcContacts } = await supabase
    .from('buyer_contacts')
    .select(
      'id, buyer_id, name, email, phone, title, company_type, last_contacted_date, is_primary_contact',
    )
    .in('buyer_id', buyerIds);

  const { data: buyers } = await supabase
    .from('remarketing_buyers')
    .select(
      'id, company_name, pe_firm_name, buyer_type, contact_name, contact_email, contact_phone',
    )
    .in('id', buyerIds);
  const buyerMap = new Map((buyers || []).map((b) => [b.id, b]));

  const seen = new Set<string>();
  const result: ResolvedContact[] = [];
  const buyersWithContacts = new Set<string>();

  // Prefer remarketing_buyer_contacts (primary first)
  for (const c of (rmContacts || []).sort(
    (a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0),
  )) {
    const key = `${c.email?.toLowerCase() || ''}-${c.phone || ''}`;
    if (seen.has(key) && key !== '-') continue;
    seen.add(key);
    buyersWithContacts.add(c.buyer_id);
    const buyer = buyerMap.get(c.buyer_id);
    result.push({
      id: `rm-${c.id}`,
      name: c.name,
      phone: c.phone,
      email: c.email,
      title: c.role,
      company: buyer?.company_name || c.company_type || null,
      source_entity: 'remarketing_buyer',
      last_contacted_date: null,
    });
  }

  // Add buyer_contacts not already seen
  for (const c of bcContacts || []) {
    const key = `${c.email?.toLowerCase() || ''}-${c.phone || ''}`;
    if (seen.has(key) && key !== '-') continue;
    seen.add(key);
    buyersWithContacts.add(c.buyer_id);
    const buyer = buyerMap.get(c.buyer_id);
    result.push({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      title: c.title,
      company: buyer?.company_name || c.company_type || null,
      source_entity: 'buyer_contact',
      last_contacted_date: c.last_contacted_date,
    });
  }

  // Fallback: For buyers with NO sub-contacts, use the buyer's own contact fields
  for (const buyerId of buyerIds) {
    if (buyersWithContacts.has(buyerId)) continue;
    const buyer = buyerMap.get(buyerId);
    if (!buyer?.contact_name) continue;
    const key = `${buyer.contact_email?.toLowerCase() || ''}-${buyer.contact_phone || ''}`;
    if (seen.has(key) && key !== '-') continue;
    seen.add(key);
    result.push({
      id: `buyer-${buyerId}`,
      name: buyer.contact_name,
      phone: buyer.contact_phone,
      email: buyer.contact_email,
      title: null,
      company: buyer.company_name || buyer.pe_firm_name || null,
      source_entity: 'remarketing_buyer_direct',
      last_contacted_date: null,
    });
  }

  return result;
}

async function resolveFromListings(
  supabase: ReturnType<typeof createClient>,
  listingIds: string[],
): Promise<ResolvedContact[]> {
  const { data: listings } = await supabase
    .from('listings')
    .select(
      'id, title, internal_company_name, main_contact_name, main_contact_email, main_contact_phone, main_contact_title, deal_source',
    )
    .in('id', listingIds);

  if (!listings?.length) return [];

  return listings
    .filter((l) => l.main_contact_name)
    .map((l) => ({
      id: `listing-${l.id}`,
      name: l.main_contact_name!,
      phone: l.main_contact_phone,
      email: l.main_contact_email,
      title: l.main_contact_title,
      company: l.internal_company_name || l.title || null,
      source_entity: `listing:${l.deal_source || 'unknown'}`,
      last_contacted_date: null,
    }));
}

async function resolveFromLeads(
  supabase: ReturnType<typeof createClient>,
  leadIds: string[],
): Promise<ResolvedContact[]> {
  const { data: leads } = await supabase
    .from('inbound_leads')
    .select('id, name, email, phone_number, company_name, role')
    .in('id', leadIds);

  if (!leads?.length) return [];

  return leads.map((l) => ({
    id: `lead-${l.id}`,
    name: l.name || l.email || 'Unknown',
    phone: l.phone_number,
    email: l.email,
    title: l.role,
    company: l.company_name,
    source_entity: 'inbound_lead',
    last_contacted_date: null,
  }));
}

// ─── Main handler ───

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Auth check
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
  const token = authHeader.replace('Bearer ', '');
  const {
    data: { user },
    error: authError,
  } = await anonClient.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: isAdmin } = await supabase.rpc('is_admin', { user_id: user.id });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'Admin access required' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get PhoneBurner access token
  const pbToken = await getValidToken(supabase, user.id);
  if (!pbToken) {
    return new Response(
      JSON.stringify({
        error: 'PhoneBurner not connected. Please connect your account first.',
        code: 'PB_NOT_CONNECTED',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const body: PushRequest = await req.json();
  const { session_name, skip_recent_days = 7 } = body;

  // Resolve entity_type + entity_ids (with legacy fallback)
  const entityType: EntityType = body.entity_type || 'buyer_contacts';
  const entityIds = body.entity_ids || body.contact_ids || [];

  if (!entityIds.length) {
    return new Response(JSON.stringify({ error: 'No entities provided' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Resolve to contacts
  let contacts: ResolvedContact[];
  switch (entityType) {
    case 'buyer_contacts':
      contacts = await resolveFromBuyerContacts(supabase, entityIds);
      break;
    case 'buyers':
      contacts = await resolveFromBuyers(supabase, entityIds);
      break;
    case 'listings':
      contacts = await resolveFromListings(supabase, entityIds);
      break;
    case 'leads':
      contacts = await resolveFromLeads(supabase, entityIds);
      break;
    default:
      return new Response(JSON.stringify({ error: `Unknown entity_type: ${entityType}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
  }

  if (!contacts.length) {
    return new Response(JSON.stringify({ error: 'No contacts found for the given entities' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Filter: skip recently contacted + no phone
  const skipCutoff = new Date(Date.now() - skip_recent_days * 24 * 60 * 60 * 1000);
  const eligible: ResolvedContact[] = [];
  const excluded: { name: string; reason: string }[] = [];

  for (const contact of contacts) {
    if (!contact.phone) {
      excluded.push({ name: contact.name, reason: 'No phone number' });
      continue;
    }
    if (contact.last_contacted_date && new Date(contact.last_contacted_date) > skipCutoff) {
      excluded.push({ name: contact.name, reason: `Contacted within ${skip_recent_days} days` });
      continue;
    }
    eligible.push(contact);
  }

  if (eligible.length === 0) {
    return new Response(
      JSON.stringify({
        success: false,
        contacts_added: 0,
        contacts_failed: 0,
        contacts_excluded: excluded.length,
        exclusions: excluded,
        error: 'All contacts were excluded (no phone number or recently contacted)',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Push to PhoneBurner
  let added = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const contact of eligible) {
    const nameParts = contact.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const pbContact = {
      first_name: firstName,
      last_name: lastName,
      phone: contact.phone,
      email: contact.email || '',
      company: contact.company || '',
      title: contact.title || '',
      custom_fields: {
        sourceco_id: contact.id,
        source_entity: contact.source_entity,
        contact_source: 'SourceCo Push to Dialer',
        ...(contact.extra_context || {}),
      },
    };

    try {
      const pbRes = await fetch(`${PB_API_BASE}/contacts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${pbToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pbContact),
      });

      if (pbRes.ok) {
        added++;
      } else {
        const errBody = await pbRes.text();
        console.error(`PB push failed for ${contact.name}:`, errBody);
        errors.push(`${contact.name}: ${errBody.slice(0, 100)}`);
        failed++;
      }
    } catch (err) {
      console.error(`PB push error for ${contact.name}:`, err);
      errors.push(`${contact.name}: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  // Log the push session
  await supabase.from('phoneburner_sessions').insert({
    session_name: session_name || `Push - ${new Date().toLocaleDateString()}`,
    session_type:
      entityType === 'buyer_contacts' || entityType === 'buyers' ? 'buyer_outreach' : entityType,
    total_contacts_added: added,
    session_status: 'active',
    created_by_user_id: user.id,
    started_at: new Date().toISOString(),
  });

  return new Response(
    JSON.stringify({
      success: true,
      contacts_added: added,
      contacts_failed: failed,
      contacts_excluded: excluded.length,
      exclusions: excluded,
      errors: errors.length > 0 ? errors : undefined,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
