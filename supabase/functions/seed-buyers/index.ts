/**
 * seed-buyers – AI Buyer Seeding Engine
 *
 * Uses Claude to discover PE firms, platform companies, and strategic acquirers
 * that match a deal's criteria, then inserts them into remarketing_buyers.
 *
 * Flow:
 * 1. Auth guard (admin only)
 * 2. Fetch deal details from listings table
 * 3. Check buyer_seed_cache for recent results (90-day TTL)
 * 4. Call Claude to discover matching buyers
 * 5. Deduplicate against existing remarketing_buyers (by company name / website domain)
 * 6. Insert new buyers with ai_seeded=true
 * 7. Log each action to buyer_seed_log
 * 8. Update buyer_seed_cache
 * 9. Return results
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { callClaude, CLAUDE_MODELS } from '../_shared/claude-client.ts';

// ── Types ──

interface SeedRequest {
  listingId: string;
  maxBuyers?: number;
  forceRefresh?: boolean;
}

interface AISuggestedBuyer {
  company_name: string;
  company_website: string | null;
  buyer_type: 'pe_firm' | 'platform' | 'strategic' | 'family_office';
  pe_firm_name: string | null;
  hq_city: string | null;
  hq_state: string | null;
  thesis_summary: string;
  why_relevant: string;
  target_services: string[];
  target_industries: string[];
  target_geographies: string[];
  known_acquisitions: string[];
  estimated_ebitda_min: number | null;
  estimated_ebitda_max: number | null;
}

interface SeedResult {
  buyer_id: string;
  company_name: string;
  action: 'inserted' | 'enriched_existing' | 'probable_duplicate';
  why_relevant: string;
  was_new_record: boolean;
}

// ── Helpers ──

function buildCacheKey(deal: {
  industry: string | null;
  categories: string[] | null;
  address_state: string | null;
  ebitda: number | null;
}): string {
  const industry = (deal.industry || 'unknown').toLowerCase().trim();
  const cats = (deal.categories || []).sort().join(',').toLowerCase();
  const state = (deal.address_state || 'unknown').toLowerCase().trim();
  const ebitdaBucket = deal.ebitda
    ? Math.floor(deal.ebitda / 500_000) * 500_000
    : 0;
  return `seed:${industry}:${cats}:${state}:${ebitdaBucket}`;
}

function extractDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+(inc|llc|corp|ltd|lp|group|partners|capital|holdings|company|co)\s*$/g, '')
    .trim();
}

function buildSystemPrompt(): string {
  return `You are an M&A buyer discovery specialist. Your job is to identify real PE firms, platform companies, and strategic acquirers that would be strong potential buyers for a specific deal.

CRITICAL RULES:
- Only suggest REAL companies that actually exist. Do not fabricate company names.
- Focus on firms that are actively acquiring in the deal's industry vertical.
- Include a mix of: PE firms with relevant platforms, standalone platform companies doing add-ons, and strategic acquirers.
- Prioritize firms with a track record of acquisitions in the sector.
- For each buyer, explain specifically WHY they are a good fit for THIS deal.
- Include the company's website if you know it.
- Be specific about geographic overlap and service/industry alignment.

You must respond with valid JSON only. No markdown, no code fences, no explanatory text outside the JSON.`;
}

function buildUserPrompt(deal: {
  industry: string | null;
  category: string | null;
  categories: string[] | null;
  ebitda: number | null;
  address_state: string | null;
  geographic_states: string[] | null;
  title: string | null;
  business_description: string | null;
}, maxBuyers: number): string {
  const ebitdaStr = deal.ebitda
    ? `$${(deal.ebitda / 1_000_000).toFixed(1)}M`
    : 'Unknown';

  const categories = deal.categories?.length
    ? deal.categories.join(', ')
    : deal.category || 'Not specified';

  const geoStates = deal.geographic_states?.length
    ? deal.geographic_states.join(', ')
    : deal.address_state || 'Not specified';

  return `Find up to ${maxBuyers} potential acquirers for this deal:

DEAL PROFILE:
- Industry: ${deal.industry || 'Not specified'}
- Service Categories: ${categories}
- EBITDA: ${ebitdaStr}
- Location: ${deal.address_state || 'Not specified'}
- Geographic Coverage: ${geoStates}
${deal.title ? `- Title: ${deal.title}` : ''}
${deal.business_description ? `- Description: ${deal.business_description}` : ''}

Return a JSON array of buyers. Each buyer object must have these exact fields:
{
  "company_name": "string (exact legal/common name)",
  "company_website": "string or null",
  "buyer_type": "pe_firm" | "platform" | "strategic" | "family_office",
  "pe_firm_name": "string or null (if this is a platform, name the PE sponsor)",
  "hq_city": "string or null",
  "hq_state": "string (2-letter state code) or null",
  "thesis_summary": "string (their acquisition thesis in 1-2 sentences)",
  "why_relevant": "string (why specifically good for THIS deal)",
  "target_services": ["array of service types they target"],
  "target_industries": ["array of industries they invest in"],
  "target_geographies": ["array of states/regions they cover"],
  "known_acquisitions": ["array of recent acquisition names if known"],
  "estimated_ebitda_min": number or null (minimum EBITDA they target, in dollars),
  "estimated_ebitda_max": number or null (maximum EBITDA they target, in dollars)
}

Return ONLY the JSON array. No other text.`;
}

function parseClaudeResponse(responseText: string): AISuggestedBuyer[] {
  // Strip any markdown fences if present
  let cleaned = responseText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) {
    throw new Error('Expected JSON array from Claude');
  }

  // Validate and clean each buyer
  return parsed.map((b: Record<string, unknown>) => ({
    company_name: String(b.company_name || '').trim(),
    company_website: b.company_website ? String(b.company_website).trim() : null,
    buyer_type: (['pe_firm', 'platform', 'strategic', 'family_office'].includes(String(b.buyer_type))
      ? String(b.buyer_type)
      : 'strategic') as AISuggestedBuyer['buyer_type'],
    pe_firm_name: b.pe_firm_name ? String(b.pe_firm_name).trim() : null,
    hq_city: b.hq_city ? String(b.hq_city).trim() : null,
    hq_state: b.hq_state ? String(b.hq_state).trim().toUpperCase().slice(0, 2) : null,
    thesis_summary: String(b.thesis_summary || '').trim(),
    why_relevant: String(b.why_relevant || '').trim(),
    target_services: Array.isArray(b.target_services) ? b.target_services.map(String) : [],
    target_industries: Array.isArray(b.target_industries) ? b.target_industries.map(String) : [],
    target_geographies: Array.isArray(b.target_geographies) ? b.target_geographies.map(String) : [],
    known_acquisitions: Array.isArray(b.known_acquisitions) ? b.known_acquisitions.map(String) : [],
    estimated_ebitda_min: typeof b.estimated_ebitda_min === 'number' ? b.estimated_ebitda_min : null,
    estimated_ebitda_max: typeof b.estimated_ebitda_max === 'number' ? b.estimated_ebitda_max : null,
  })).filter(b => b.company_name.length > 0);
}

// ── Main handler ──

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  const headers = getCorsHeaders(req);

  try {
    // ── Auth guard (mirrors score-deal-buyers pattern) ──
    const authHeader = req.headers.get('Authorization') || '';
    const callerToken = authHeader.replace('Bearer ', '').trim();
    if (!callerToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${callerToken}` } },
    });
    const { data: { user: callerUser }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin } = await supabase.rpc('is_admin', { user_id: callerUser.id });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: admin access required' }),
        { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } },
      );
    }
    // ── End auth guard ──

    const body: SeedRequest = await req.json();
    const { listingId, maxBuyers = 15, forceRefresh = false } = body;

    if (!listingId) {
      return new Response(
        JSON.stringify({ error: 'listingId is required' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } },
      );
    }

    // ── Fetch deal ──
    const { data: deal, error: dealError } = await supabase
      .from('listings')
      .select('id, title, industry, category, categories, ebitda, address_state, geographic_states, business_description')
      .eq('id', listingId)
      .single();

    if (dealError || !deal) {
      return new Response(
        JSON.stringify({ error: 'Deal not found', details: dealError?.message }),
        { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } },
      );
    }

    // ── Check seed cache ──
    const cacheKey = buildCacheKey(deal);

    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('buyer_seed_cache')
        .select('buyer_ids, seeded_at')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (cached && cached.buyer_ids?.length > 0) {
        // Return the cached buyer IDs with their details
        const { data: cachedBuyers } = await supabase
          .from('remarketing_buyers')
          .select('id, company_name, buyer_type, hq_state, hq_city, ai_seeded, thesis_summary')
          .in('id', cached.buyer_ids);

        return new Response(
          JSON.stringify({
            seeded_buyers: (cachedBuyers || []).map(b => ({
              buyer_id: b.id,
              company_name: b.company_name,
              action: 'cached' as const,
              why_relevant: b.thesis_summary || '',
              was_new_record: false,
            })),
            total: cachedBuyers?.length || 0,
            cached: true,
            seeded_at: cached.seeded_at,
            cache_key: cacheKey,
          }),
          { headers: { ...headers, 'Content-Type': 'application/json' } },
        );
      }
    }

    // ── Fetch existing buyers for deduplication ──
    const { data: existingBuyers } = await supabase
      .from('remarketing_buyers')
      .select('id, company_name, company_website')
      .or('archived.is.null,archived.eq.false');

    const existingNameSet = new Set(
      (existingBuyers || []).map(b => normalizeCompanyName(b.company_name)),
    );
    const existingDomainSet = new Set(
      (existingBuyers || [])
        .map(b => extractDomain(b.company_website))
        .filter(Boolean) as string[],
    );
    // Map normalized name → existing buyer id for enrichment
    const nameToId = new Map(
      (existingBuyers || []).map(b => [normalizeCompanyName(b.company_name), b.id]),
    );

    // ── Call Claude to discover buyers ──
    const cappedMax = Math.min(maxBuyers, 25);
    const claudeResponse = await callClaude({
      model: CLAUDE_MODELS.sonnet,
      maxTokens: 4096,
      systemPrompt: buildSystemPrompt(),
      messages: [
        { role: 'user', content: buildUserPrompt(deal, cappedMax) },
      ],
      timeoutMs: 60000,
    });

    // Extract text from response
    const responseText = claudeResponse.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    if (!responseText) {
      return new Response(
        JSON.stringify({
          error: 'Claude returned empty response',
          usage: claudeResponse.usage,
        }),
        { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } },
      );
    }

    const suggestedBuyers = parseClaudeResponse(responseText);

    // ── Deduplicate and insert ──
    const results: SeedResult[] = [];
    const newBuyerIds: string[] = [];
    const now = new Date().toISOString();

    for (const suggested of suggestedBuyers) {
      const normName = normalizeCompanyName(suggested.company_name);
      const domain = extractDomain(suggested.company_website);

      let action: SeedResult['action'];
      let buyerId: string;
      let wasNew = false;

      // Check for duplicate by name
      const existingId = nameToId.get(normName);
      // Check for duplicate by domain
      const domainMatch = domain && existingDomainSet.has(domain);

      if (existingId) {
        // Existing buyer — enrich with AI context
        action = 'enriched_existing';
        buyerId = existingId;

        // Update the existing record with AI seeding metadata
        await supabase
          .from('remarketing_buyers')
          .update({
            ai_seeded: true,
            ai_seeded_at: now,
            ai_seeded_from_deal_id: listingId,
          })
          .eq('id', buyerId);
      } else if (domainMatch) {
        // Probable duplicate via domain
        action = 'probable_duplicate';
        const domainBuyer = (existingBuyers || []).find(
          b => extractDomain(b.company_website) === domain,
        );
        buyerId = domainBuyer?.id || 'unknown';
      } else {
        // New buyer — insert
        action = 'inserted';
        wasNew = true;

        const { data: inserted, error: insertError } = await supabase
          .from('remarketing_buyers')
          .insert({
            company_name: suggested.company_name,
            company_website: suggested.company_website,
            buyer_type: suggested.buyer_type,
            pe_firm_name: suggested.pe_firm_name,
            hq_city: suggested.hq_city,
            hq_state: suggested.hq_state,
            thesis_summary: suggested.thesis_summary,
            target_services: suggested.target_services,
            target_industries: suggested.target_industries,
            target_geographies: suggested.target_geographies,
            target_ebitda_min: suggested.estimated_ebitda_min,
            target_ebitda_max: suggested.estimated_ebitda_max,
            ai_seeded: true,
            ai_seeded_at: now,
            ai_seeded_from_deal_id: listingId,
            verification_status: 'pending',
          })
          .select('id')
          .single();

        if (insertError || !inserted) {
          console.error(`Failed to insert buyer ${suggested.company_name}:`, insertError);
          continue;
        }

        buyerId = inserted.id;

        // Track in dedup sets for subsequent iterations
        existingNameSet.add(normName);
        if (domain) existingDomainSet.add(domain);
        nameToId.set(normName, buyerId);
      }

      newBuyerIds.push(buyerId);

      // Log to buyer_seed_log
      await supabase.from('buyer_seed_log').insert({
        remarketing_buyer_id: buyerId,
        source_deal_id: listingId,
        why_relevant: suggested.why_relevant,
        known_acquisitions: suggested.known_acquisitions,
        was_new_record: wasNew,
        action,
        seed_model: CLAUDE_MODELS.sonnet,
        category_cache_key: cacheKey,
      });

      results.push({
        buyer_id: buyerId,
        company_name: suggested.company_name,
        action,
        why_relevant: suggested.why_relevant,
        was_new_record: wasNew,
      });
    }

    // ── Update seed cache ──
    await supabase
      .from('buyer_seed_cache')
      .upsert(
        {
          cache_key: cacheKey,
          buyer_ids: newBuyerIds,
          seeded_at: now,
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: 'cache_key' },
      );

    const inserted = results.filter(r => r.action === 'inserted').length;
    const enriched = results.filter(r => r.action === 'enriched_existing').length;
    const dupes = results.filter(r => r.action === 'probable_duplicate').length;

    return new Response(
      JSON.stringify({
        seeded_buyers: results,
        total: results.length,
        inserted,
        enriched_existing: enriched,
        probable_duplicates: dupes,
        cached: false,
        seeded_at: now,
        cache_key: cacheKey,
        model: CLAUDE_MODELS.sonnet,
        usage: claudeResponse.usage,
      }),
      { headers: { ...headers, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('seed-buyers error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } },
    );
  }
});
