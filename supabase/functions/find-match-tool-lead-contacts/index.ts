/**
 * find-match-tool-lead-contacts
 *
 * Auto-discovers LinkedIn URL and phone number for a Match Tool lead.
 * Mirrors `find-valuation-lead-contacts` but scoped to `match_tool_leads`.
 *
 * Pipeline:
 *   1. Skip if lead already has both linkedin_url and phone
 *   2. Find person's LinkedIn via Serper Google search
 *   3. If LinkedIn found → Blitz phone enrichment (synchronous)
 *   4. If Blitz misses → Clay waterfall fallback (async)
 *   5. Update match_tool_leads row with whatever we found synchronously
 *
 * POST body: { match_tool_lead_id, full_name, email, website?, business_name? }
 * Auth: admin JWT or x-internal-secret
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/auth.ts';
import { googleSearch } from '../_shared/serper-client.ts';
import { findPhone } from '../_shared/blitz-client.ts';
import { sendToClayNameDomain, sendToClayPhone } from '../_shared/clay-client.ts';

const SYSTEM_WORKSPACE_ID = '00000000-0000-0000-0000-000000000000';

const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'live.com',
  'msn.com',
  'mail.com',
  'protonmail.com',
  'proton.me',
  'pm.me',
  'fastmail.com',
  'hey.com',
  'comcast.net',
  'att.net',
  'verizon.net',
  'cox.net',
  'charter.net',
]);

interface FindContactsRequest {
  match_tool_lead_id: string;
  full_name: string;
  email: string;
  website?: string;
  business_name?: string;
}

function extractDomain(websiteOrUrl?: string): string | null {
  if (!websiteOrUrl) return null;
  try {
    const url = websiteOrUrl.startsWith('http')
      ? new URL(websiteOrUrl)
      : new URL(`https://${websiteOrUrl}`);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function extractEmailDomain(email: string): string | null {
  if (!email || !email.includes('@')) return null;
  return email.split('@')[1]?.toLowerCase().trim() || null;
}

async function findPersonLinkedIn(
  searchName: string,
  companyContext: string | null,
  website?: string,
): Promise<string | null> {
  const queries: string[] = [];
  if (companyContext) {
    queries.push(`"${searchName}" "${companyContext}" site:linkedin.com/in`);
  }
  if (website) {
    const domain = extractDomain(website);
    if (domain) queries.push(`"${searchName}" "${domain}" site:linkedin.com/in`);
  }
  queries.push(`"${searchName}" site:linkedin.com/in`);

  for (const q of queries) {
    try {
      const res = await googleSearch(q, 5);
      if (res.ok && res.data?.organic) {
        for (const result of res.data.organic) {
          const link: string = result.link || '';
          if (link.includes('linkedin.com/in/')) return link;
        }
      }
    } catch (err) {
      console.warn(`[find-match-tool-lead-contacts] Serper failed for "${q}":`, err);
    }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // Auth
  const internalSecret = req.headers.get('x-internal-secret');
  const isServiceCall = internalSecret === supabaseServiceKey;
  if (!isServiceCall) {
    const auth = await requireAdmin(req, supabaseAdmin);
    if (!auth.authenticated || !auth.isAdmin) {
      return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
        status: auth.authenticated ? 403 : 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  let body: FindContactsRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!body.match_tool_lead_id || !body.full_name?.trim()) {
    return new Response(
      JSON.stringify({ error: 'match_tool_lead_id and full_name are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const startTime = Date.now();
  const rawName = body.full_name.trim();

  // Effective company context
  const websiteDomain = extractDomain(body.website);
  const emailDomain = extractEmailDomain(body.email);
  const isGenericEmail = emailDomain ? GENERIC_EMAIL_DOMAINS.has(emailDomain) : true;
  const effectiveDomain = websiteDomain || (!isGenericEmail ? emailDomain : null);
  const companyContext =
    body.business_name?.trim() || (effectiveDomain ? effectiveDomain.split('.')[0] : null);

  console.log(
    `[find-match-tool-lead-contacts] Starting lead=${body.match_tool_lead_id} name="${rawName}" company="${companyContext || ''}" domain="${effectiveDomain || ''}"`,
  );

  try {
    // Existing values
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('match_tool_leads')
      .select('linkedin_url, phone')
      .eq('id', body.match_tool_lead_id)
      .single();
    if (fetchError) {
      console.error('[find-match-tool-lead-contacts] Lead not found:', fetchError.message);
      return new Response(JSON.stringify({ success: false, error: 'Lead not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const needsLinkedIn = !existing.linkedin_url;
    const needsPhone = !existing.phone;

    if (!needsLinkedIn && !needsPhone) {
      return new Response(
        JSON.stringify({
          success: true,
          linkedin_url: existing.linkedin_url,
          phone: existing.phone,
          skipped: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let linkedinUrl: string | null = existing.linkedin_url || null;
    let phone: string | null = existing.phone || null;
    let clayFallbackSent = false;

    // 1) LinkedIn via Serper
    if (needsLinkedIn && !linkedinUrl) {
      linkedinUrl = await findPersonLinkedIn(rawName, companyContext, body.website);
    }

    // 2) Phone via Blitz (synchronous)
    if (linkedinUrl && needsPhone && !phone) {
      try {
        const phoneRes = await findPhone(linkedinUrl);
        if (phoneRes.ok && phoneRes.data?.phone) {
          phone = phoneRes.data.phone;
          console.log(`[find-match-tool-lead-contacts] Found phone via Blitz`);
        }
      } catch (err) {
        console.warn(
          `[find-match-tool-lead-contacts] Blitz phone failed:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    // 3) Clay waterfall fallback
    const nameParts = rawName.split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    if (needsPhone && !phone && linkedinUrl) {
      try {
        await sendToClayPhone({
          workspace_id: SYSTEM_WORKSPACE_ID,
          buyer_id: body.match_tool_lead_id,
          linkedin_url: linkedinUrl,
          first_name: firstName,
          last_name: lastName,
          company: body.business_name,
          source: 'match_tool_lead_contact_search',
        });
        clayFallbackSent = true;
      } catch (err) {
        console.warn(`[find-match-tool-lead-contacts] Clay phone fallback failed:`, err);
      }
    }

    if (needsLinkedIn && !linkedinUrl && effectiveDomain) {
      try {
        await sendToClayNameDomain({
          workspace_id: SYSTEM_WORKSPACE_ID,
          buyer_id: body.match_tool_lead_id,
          first_name: firstName,
          last_name: lastName,
          domain: effectiveDomain,
          company: body.business_name,
          source: 'match_tool_lead_contact_search',
        });
        clayFallbackSent = true;
      } catch (err) {
        console.warn(`[find-match-tool-lead-contacts] Clay name+domain failed:`, err);
      }
    }

    // 4) Persist
    const updates: Record<string, unknown> = {};
    if (linkedinUrl && needsLinkedIn) updates.linkedin_url = linkedinUrl;
    if (phone && needsPhone) updates.phone = phone;

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { error: updateError } = await supabaseAdmin
        .from('match_tool_leads')
        .update(updates)
        .eq('id', body.match_tool_lead_id);
      if (updateError) {
        console.error('[find-match-tool-lead-contacts] Update failed:', updateError.message);
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      JSON.stringify({
        fn: 'find-match-tool-lead-contacts',
        lead_id: body.match_tool_lead_id,
        linkedin_found: !!linkedinUrl,
        phone_found: !!phone,
        clay_fallback_sent: clayFallbackSent,
        duration_ms: duration,
      }),
    );

    return new Response(
      JSON.stringify({
        success: true,
        linkedin_url: linkedinUrl,
        phone,
        skipped: false,
        from_cache: false,
        clay_fallback_sent: clayFallbackSent,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[find-match-tool-lead-contacts] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
