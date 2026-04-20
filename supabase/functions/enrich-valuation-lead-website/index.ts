import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { logEnrichmentEvent } from '../_shared/enrichment-events.ts';
import { requireAdmin } from '../_shared/auth.ts';
import {
  GEMINI_API_URL,
  DEFAULT_GEMINI_MODEL,
  getGeminiApiKey,
  getGeminiHeaders,
  fetchWithAutoRetry,
} from '../_shared/ai-providers.ts';

const FUNCTION_NAME = 'enrich-valuation-lead-website';

// ─── Deterministic credibility signals — no AI required ───
// Returns partial credibility data merged with whatever the AI extracts.
function deterministicCredibility(
  scrapeStatusOk: boolean,
  markdown: string,
  rawHtml: string,
): { reasons: string[]; tierFloor: 'shell' | 'low_signal' | null } {
  const reasons: string[] = [];
  let tierFloor: 'shell' | 'low_signal' | null = null;

  if (!scrapeStatusOk) {
    reasons.push('Website failed to load (HTTP error)');
    tierFloor = 'shell';
  }
  if (markdown && markdown.length < 400) {
    reasons.push(`Very thin content (${markdown.length} chars on home page)`);
    if (tierFloor !== 'shell') tierFloor = 'low_signal';
  }

  // Detect free-tier / no-code template hosts in either the markdown or HTML.
  // These don't always mean "not a real business" — but for a M&A target
  // they're a strong negative signal worth flagging.
  const haystack = `${markdown}\n${rawHtml}`.toLowerCase();
  const templates: Array<[RegExp, string]> = [
    [/lovable\.app|lovable\.dev/, 'Built on Lovable (no-code template)'],
    [/bubbleapps\.io|bubble\.io/, 'Built on Bubble (no-code template)'],
    [/carrd\.co/, 'Built on Carrd (single-page template)'],
    [/webflow\.io(?!\/)/, 'Hosted on free Webflow subdomain'],
    [/\.vercel\.app|\.netlify\.app/, 'Hosted on free Vercel/Netlify subdomain'],
    [/wixsite\.com|\.wix\.com/, 'Free Wix subdomain'],
    [/squarespace\.com\/.*?(coming-soon|under-construction)/, 'Squarespace placeholder'],
    [/godaddysites\.com/, 'GoDaddy template subdomain'],
  ];
  for (const [rx, reason] of templates) {
    if (rx.test(haystack)) {
      reasons.push(reason);
      if (tierFloor !== 'shell') tierFloor = 'low_signal';
      break;
    }
  }

  // "Coming soon" / placeholder copy
  if (/coming\s+soon|under\s+construction|site\s+is\s+being\s+built/i.test(markdown)) {
    reasons.push('"Coming soon" / placeholder copy');
    if (tierFloor !== 'shell') tierFloor = 'low_signal';
  }

  return { reasons, tierFloor };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    // ─── Auth: x-internal-secret OR admin JWT ───
    const internalSecret = req.headers.get('x-internal-secret');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    let isAuthorized = internalSecret === serviceKey;

    if (!isAuthorized) {
      const adminCheck = await requireAdmin(
        req,
        createClient(Deno.env.get('SUPABASE_URL')!, serviceKey),
      );
      isAuthorized = adminCheck.isAdmin;
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

    const { valuation_lead_id, website, force } = await req.json();

    if (!valuation_lead_id || !website) {
      return new Response(JSON.stringify({ error: 'valuation_lead_id and website are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── Save-forever policy ───
    // If enrichment data exists, skip unless explicit force=true (admin Retry).
    const { data: existing } = await supabaseAdmin
      .from('valuation_leads')
      .select('website_enriched_at, website_enrichment_data')
      .eq('id', valuation_lead_id)
      .single();

    if (existing?.website_enriched_at && !force) {
      console.log(
        `[${FUNCTION_NAME}] Skipping ${valuation_lead_id} — already enriched (save-forever)`,
      );
      return new Response(
        JSON.stringify({
          skipped: true,
          reason: 'already_enriched',
          website_enrichment_data: existing.website_enrichment_data,
          website_enriched_at: existing.website_enriched_at,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ─── Step 1: Firecrawl scrape ───
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (!FIRECRAWL_API_KEY) {
      console.error(`[${FUNCTION_NAME}] FIRECRAWL_API_KEY not configured`);
      logEnrichmentEvent(supabaseAdmin, {
        entityType: 'deal',
        entityId: valuation_lead_id,
        provider: 'firecrawl',
        functionName: FUNCTION_NAME,
        status: 'failure',
        errorMessage: 'FIRECRAWL_API_KEY not configured',
      });
      return new Response(JSON.stringify({ error: 'FIRECRAWL_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalizedUrl = website.startsWith('http') ? website : `https://${website}`;
    console.log(`[${FUNCTION_NAME}] Scraping ${normalizedUrl} for lead ${valuation_lead_id}`);

    const scrapeStart = Date.now();
    let scrapeData: {
      markdown?: string;
      html?: string;
      branding?: Record<string, unknown>;
      metadata?: { statusCode?: number };
    } | null = null;
    let scrapeStatusOk = true;

    try {
      const scrapeResponse = await fetchWithAutoRetry(
        'https://api.firecrawl.dev/v1/scrape',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: normalizedUrl,
            formats: ['markdown', 'html', 'branding'],
            onlyMainContent: true,
            waitFor: 2000,
            timeout: 25000,
          }),
        },
        { maxRetries: 1, callerName: FUNCTION_NAME },
      );

      if (!scrapeResponse.ok) {
        const errText = await scrapeResponse.text();
        throw new Error(`Firecrawl ${scrapeResponse.status}: ${errText.substring(0, 200)}`);
      }

      const scrapeResult = await scrapeResponse.json();
      scrapeData = scrapeResult.data || scrapeResult;
      const sc = scrapeData?.metadata?.statusCode;
      if (typeof sc === 'number' && sc >= 400) scrapeStatusOk = false;

      logEnrichmentEvent(supabaseAdmin, {
        entityType: 'deal',
        entityId: valuation_lead_id,
        provider: 'firecrawl',
        functionName: FUNCTION_NAME,
        status: 'success',
        durationMs: Date.now() - scrapeStart,
      });
    } catch (scrapeErr) {
      const errMsg = scrapeErr instanceof Error ? scrapeErr.message : String(scrapeErr);
      console.error(`[${FUNCTION_NAME}] Firecrawl error:`, errMsg);
      logEnrichmentEvent(supabaseAdmin, {
        entityType: 'deal',
        entityId: valuation_lead_id,
        provider: 'firecrawl',
        functionName: FUNCTION_NAME,
        status: 'failure',
        durationMs: Date.now() - scrapeStart,
        errorMessage: errMsg.substring(0, 500),
      });
      // Continue with empty scrape data — we can still try favicon fallback
      scrapeData = null;
      scrapeStatusOk = false;
    }

    // ─── Compute deterministic credibility signals ───
    const det = deterministicCredibility(
      scrapeStatusOk,
      scrapeData?.markdown || '',
      scrapeData?.html || '',
    );

    // ─── Step 2: AI extraction via Gemini ───
    const geminiKey = getGeminiApiKey();
    const domain = normalizedUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    let enrichmentData: Record<string, unknown> = {
      favicon_url: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    };

    if (scrapeData?.markdown && geminiKey) {
      const markdown = scrapeData.markdown.substring(0, 8000); // Limit token usage
      const branding = scrapeData.branding;

      const extractionPrompt = `Analyze this company website content and extract structured company intelligence.

Website: ${normalizedUrl}
${branding ? `\nBranding data: ${JSON.stringify(branding)}` : ''}

Website content:
${markdown}

Extract the following fields as JSON. Use null for any field you cannot determine with confidence:
{
  "company_name": "Official company name",
  "tagline": "Company tagline or slogan (one line)",
  "description": "ONE sentence, max 25 words, plain factual — what they do and who they serve. No marketing fluff.",
  "services": ["Service 1", "Service 2", "Service 3"],
  "founded_year": 2005,
  "employee_count_estimate": "10-50",
  "headquarters": "City, State",
  "logo_url": "URL to company logo if found in branding data",
  "social_links": {"facebook": "url", "linkedin": "url", "twitter": "url"},
  "key_differentiators": ["Differentiator 1", "Differentiator 2"],
  "target_customers": "Who their customers are (short phrase)",
  "credibility_tier": "established | emerging | low_signal | shell",
  "credibility_score": 0-100,
  "credibility_reasons": ["Specific reason 1", "Specific reason 2"]
}

CREDIBILITY RUBRIC — be strict, this drives whether reps spend time on this lead:
- "established": Has team page OR named founders OR street address OR phone OR real customer logos OR active blog OR clearly multi-page content with case studies. Founded year present is a plus. (score 70-100)
- "emerging": Real domain, real content, but missing team/contact info or feels new. Could be a small but real business. (score 45-69)
- "low_signal": One-page landing, generic stock copy, no contact info, AI-template feel, no real product evidence. (score 20-44)
- "shell": "Coming soon", placeholder, parked domain, or clearly built in an afternoon (e.g., obvious Lovable/Bubble/Carrd template with placeholder copy). (score 0-19)

For credibility_reasons: list the SPECIFIC missing/present signals (e.g., "No team page", "No phone listed", "Single landing page", "Built on Lovable template", "Has founders bio + 5 real case studies"). Max 4 items, each under 60 chars.

Constraints: services and key_differentiators arrays must each contain AT MOST 5 items.

Return ONLY valid JSON, no markdown fencing.`;

      const aiStart = Date.now();
      try {
        const aiResponse = await fetchWithAutoRetry(
          GEMINI_API_URL,
          {
            method: 'POST',
            headers: getGeminiHeaders(geminiKey),
            body: JSON.stringify({
              model: DEFAULT_GEMINI_MODEL,
              messages: [
                {
                  role: 'system',
                  content:
                    'You are a company intelligence analyst. Extract structured data from website content. Return only valid JSON.',
                },
                { role: 'user', content: extractionPrompt },
              ],
              temperature: 0,
              max_tokens: 1200,
            }),
          },
          { maxRetries: 1, callerName: `${FUNCTION_NAME}/gemini` },
        );

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          throw new Error(`Gemini ${aiResponse.status}: ${errText.substring(0, 200)}`);
        }

        const aiResult = await aiResponse.json();
        const content = aiResult.choices?.[0]?.message?.content || '';

        // Parse JSON from response (handle possible markdown fencing)
        const jsonStr = content
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        const parsed = JSON.parse(jsonStr);

        // Merge with branding logo if AI didn't find one
        if (!parsed.logo_url && branding?.logo) {
          parsed.logo_url = branding.logo;
        }

        enrichmentData = {
          ...enrichmentData,
          ...parsed,
        };

        logEnrichmentEvent(supabaseAdmin, {
          entityType: 'deal',
          entityId: valuation_lead_id,
          provider: 'openrouter',
          functionName: FUNCTION_NAME,
          status: 'success',
          stepName: 'ai_extraction',
          durationMs: Date.now() - aiStart,
          tokensUsed: aiResult.usage?.total_tokens || 0,
        });
      } catch (aiErr) {
        const errMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
        console.error(`[${FUNCTION_NAME}] AI extraction error:`, errMsg);
        logEnrichmentEvent(supabaseAdmin, {
          entityType: 'deal',
          entityId: valuation_lead_id,
          provider: 'openrouter',
          functionName: FUNCTION_NAME,
          status: 'failure',
          stepName: 'ai_extraction',
          durationMs: Date.now() - aiStart,
          errorMessage: errMsg.substring(0, 500),
        });
        // Still save branding-only data if available
        if (branding) {
          if (branding.logo) enrichmentData.logo_url = branding.logo;
          if (branding.colors) enrichmentData.brand_colors = branding.colors;
        }
      }
    }

    // ─── Apply deterministic floor + merge reasons ───
    // The deterministic checks act as a *floor*: if the AI said "established"
    // but we deterministically know the site is built on Lovable, we override
    // to at least "low_signal".
    const aiTier = enrichmentData.credibility_tier as string | undefined;
    const TIER_RANK: Record<string, number> = {
      established: 3,
      emerging: 2,
      low_signal: 1,
      shell: 0,
    };
    let finalTier = aiTier ?? null;

    if (det.tierFloor) {
      if (!finalTier || TIER_RANK[finalTier] > TIER_RANK[det.tierFloor]) {
        finalTier = det.tierFloor;
      }
    }
    // If we have no AI tier and no floor (e.g., scrape worked but AI failed),
    // and we have *some* markdown, default to "emerging" so the badge stays neutral.
    if (!finalTier && (scrapeData?.markdown?.length ?? 0) > 0) {
      finalTier = 'emerging';
    }
    // If we have nothing at all, mark as shell
    if (!finalTier) finalTier = 'shell';

    const aiReasons = Array.isArray(enrichmentData.credibility_reasons)
      ? (enrichmentData.credibility_reasons as string[])
      : [];
    const mergedReasons = Array.from(new Set([...det.reasons, ...aiReasons])).slice(0, 5);

    enrichmentData.credibility_tier = finalTier;
    enrichmentData.credibility_reasons = mergedReasons;
    if (typeof enrichmentData.credibility_score !== 'number') {
      // Approximate score from tier when AI didn't supply one
      enrichmentData.credibility_score =
        finalTier === 'established'
          ? 80
          : finalTier === 'emerging'
            ? 55
            : finalTier === 'low_signal'
              ? 30
              : 10;
    }

    // ─── Step 3: Update valuation_leads ───
    const enrichedAt = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('valuation_leads')
      .update({
        website_enrichment_data: enrichmentData,
        website_enriched_at: enrichedAt,
      })
      .eq('id', valuation_lead_id);

    if (updateError) {
      console.error(`[${FUNCTION_NAME}] Update error:`, updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fieldsExtracted = Object.keys(enrichmentData).filter(
      (k) => enrichmentData[k] != null && enrichmentData[k] !== '',
    ).length;

    console.log(
      `[${FUNCTION_NAME}] Enriched lead ${valuation_lead_id}: ${fieldsExtracted} fields, credibility=${finalTier}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        fields_extracted: fieldsExtracted,
        website_enrichment_data: enrichmentData,
        website_enriched_at: enrichedAt,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error(`[${FUNCTION_NAME}] Error:`, err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
