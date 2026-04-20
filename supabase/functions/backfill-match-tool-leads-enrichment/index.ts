// One-shot backfill: enrich all match_tool_leads where enrichment_data IS NULL.
// Reuses the same Firecrawl + OpenAI logic as ingest-match-tool-lead.
// Safe to call multiple times (skips already-enriched rows via the inner guard).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  checkWebsiteReachability,
  checkScrapedContent,
  evaluateLeadLegitimacy,
} from '../_shared/lead-legitimacy.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COMPANY_SCHEMA = {
  name: 'extract_company',
  description: 'Extract a structured company profile from website content.',
  parameters: {
    type: 'object',
    properties: {
      company_name: { type: 'string' },
      one_liner: { type: 'string' },
      services: { type: 'array', items: { type: 'string' } },
      industry: { type: 'string' },
      geography: { type: 'string' },
      employee_estimate: { type: 'string' },
      year_founded: { type: 'string' },
      revenue_estimate: { type: 'string' },
      notable_signals: { type: 'array', items: { type: 'string' } },
    },
    required: ['company_name', 'one_liner', 'services', 'industry', 'geography'],
    additionalProperties: false,
  },
};

const NOISE_GEO = new Set([
  '',
  'not specified',
  'global',
  'unknown',
  'not sure',
  'international',
  'n/a',
]);

async function enrichLead(supabase: any, leadId: string, website: string, force = false) {
  const { data: existing } = await supabase
    .from('match_tool_leads')
    .select('enrichment_data, location, revenue, profit')
    .eq('id', leadId)
    .single();
  if (existing?.enrichment_data && !force) return { id: leadId, status: 'skipped' };

  const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!FIRECRAWL_API_KEY || !OPENAI_API_KEY) {
    return { id: leadId, status: 'error', error: 'missing API keys' };
  }

  // Reachability gate up-front
  let preformatted = website.trim();
  if (!preformatted.startsWith('http')) preformatted = `https://${preformatted}`;
  const reach = await checkWebsiteReachability(preformatted);
  if (!reach.ok) {
    await supabase
      .from('match_tool_leads')
      .update({
        excluded: true,
        exclusion_reason: reach.reason,
        last_enriched_at: new Date().toISOString(),
      })
      .eq('id', leadId);
    return { id: leadId, status: 'quarantined', reason: reach.reason };
  }

  let formattedUrl = website.trim();
  if (!formattedUrl.startsWith('http')) formattedUrl = `https://${formattedUrl}`;

  let markdown = '';
  let metadata: any = {};
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 2000,
        timeout: 20000,
      }),
    });
    if (res.ok) {
      const j = await res.json();
      markdown = j.data?.markdown || j.markdown || '';
      metadata = j.data?.metadata || j.metadata || {};
    }
  } catch (e) {
    console.warn(`[${leadId}] firecrawl error`, e);
  }

  /** Heuristic location extraction from page content / metadata when OpenAI is unavailable. */
  function extractLocationHeuristic(): string | null {
    const haystack = `${markdown}\n${metadata?.description || ''}\n${metadata?.ogDescription || ''}`;

    // 1. US "City, ST" or "City, ST 12345"
    const usMatch = haystack.match(
      /\b([A-Z][a-zA-Z.\- ]{2,30}),\s*(A[LKZR]|C[AOT]|D[CE]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[AT]|W[AIVY])\b(?:\s+\d{5})?/,
    );
    if (usMatch) return `${usMatch[1].trim()}, ${usMatch[2]}`;

    // 2. ogLocale → country
    const localeToCountry: Record<string, string> = {
      en_us: 'United States',
      en_gb: 'United Kingdom',
      en_ca: 'Canada',
      en_au: 'Australia',
      en_ie: 'Ireland',
      en_nz: 'New Zealand',
      de_de: 'Germany',
      fr_fr: 'France',
      es_es: 'Spain',
      it_it: 'Italy',
      nl_nl: 'Netherlands',
      pt_br: 'Brazil',
    };
    const locale = (metadata?.ogLocale || '').toString().toLowerCase().replace('-', '_');
    if (localeToCountry[locale]) return localeToCountry[locale];

    // 3. Country name mentioned in content
    const countries = [
      'United Kingdom',
      'United States',
      'Canada',
      'Australia',
      'Ireland',
      'New Zealand',
      'Germany',
      'France',
      'Spain',
      'Italy',
      'Netherlands',
      'Belgium',
      'Sweden',
      'Norway',
      'Denmark',
      'Finland',
      'Switzerland',
      'Austria',
      'Poland',
      'Portugal',
      'Mexico',
      'Brazil',
      'India',
      'Singapore',
      'Japan',
      'South Africa',
      'UAE',
    ];
    for (const c of countries) {
      const re = new RegExp(`\\b${c}\\b`, 'i');
      if (re.test(haystack)) return c;
    }

    // 4. TLD fallback
    const tldMap: Record<string, string> = {
      '.co.uk': 'United Kingdom',
      '.uk': 'United Kingdom',
      '.ca': 'Canada',
      '.au': 'Australia',
      '.com.au': 'Australia',
      '.ie': 'Ireland',
      '.de': 'Germany',
      '.fr': 'France',
      '.es': 'Spain',
      '.it': 'Italy',
      '.nl': 'Netherlands',
      '.nz': 'New Zealand',
      '.co.nz': 'New Zealand',
      '.br': 'Brazil',
      '.com.br': 'Brazil',
      '.fom.br': 'Brazil',
      '.mx': 'Mexico',
      '.com.mx': 'Mexico',
      '.in': 'India',
      '.co.in': 'India',
      '.sg': 'Singapore',
      '.jp': 'Japan',
      '.co.jp': 'Japan',
      '.za': 'South Africa',
      '.co.za': 'South Africa',
      '.be': 'Belgium',
      '.se': 'Sweden',
      '.no': 'Norway',
      '.dk': 'Denmark',
      '.fi': 'Finland',
      '.ch': 'Switzerland',
      '.at': 'Austria',
      '.pl': 'Poland',
      '.pt': 'Portugal',
      '.ae': 'UAE',
      '.cl': 'Chile',
      '.ar': 'Argentina',
      '.com.ar': 'Argentina',
    };
    for (const [tld, country] of Object.entries(tldMap)) {
      if (
        formattedUrl.toLowerCase().endsWith(tld) ||
        formattedUrl.toLowerCase().includes(`${tld}/`)
      ) {
        return country;
      }
    }
    return null;
  }

  const truncated = markdown.slice(0, 8000);
  const prompt = `Analyze this company website and extract a structured profile.
Website: ${formattedUrl}
Content:
${truncated || '(No content available - infer from URL only)'}`;

  const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Extract structured company data from website content. Be concise and factual.',
        },
        { role: 'user', content: prompt },
      ],
      tools: [{ type: 'function', function: COMPANY_SCHEMA }],
      tool_choice: { type: 'function', function: { name: 'extract_company' } },
    }),
  });

  let enrichmentData: any = {};
  let openaiFailed = false;

  if (!aiRes.ok) {
    openaiFailed = true;
    console.warn(`[${leadId}] openai ${aiRes.status} — using heuristic fallback`);
    enrichmentData = {
      company_name: metadata?.title || null,
      one_liner: metadata?.description || metadata?.ogDescription || null,
      services: [],
      industry: null,
      geography: extractLocationHeuristic(),
      _source: 'heuristic_fallback',
    };
  } else {
    const aiJson = await aiRes.json();
    try {
      const tc = aiJson.choices?.[0]?.message?.tool_calls?.[0];
      enrichmentData =
        typeof tc?.function?.arguments === 'string'
          ? JSON.parse(tc.function.arguments)
          : tc?.function?.arguments || {};
    } catch {
      enrichmentData = { company_name: null, one_liner: 'Could not analyze website' };
    }
  }
  enrichmentData.enriched_at = new Date().toISOString();

  let geo = (enrichmentData.geography || '').toString().trim();
  if (!geo || NOISE_GEO.has(geo.toLowerCase())) {
    const fallback = extractLocationHeuristic();
    if (fallback) {
      geo = fallback;
      enrichmentData.geography = fallback;
    }
  }

  const update: Record<string, unknown> = {
    enrichment_data: enrichmentData,
    last_enriched_at: new Date().toISOString(),
  };
  if (geo && !NOISE_GEO.has(geo.toLowerCase()) && !existing?.location) {
    update.location = geo;
  }

  // Content + legitimacy gate
  const contentCheck = checkScrapedContent(markdown);
  if (!contentCheck.ok) {
    update.excluded = true;
    update.exclusion_reason = contentCheck.reason;
  } else {
    const verdict = evaluateLeadLegitimacy({
      websiteUrl: preformatted,
      revenue: existing?.revenue ?? null,
      profit: existing?.profit ?? null,
      enrichment: enrichmentData,
      markdown,
    });
    if (!verdict.pass) {
      update.excluded = true;
      update.exclusion_reason = verdict.reason;
    }
  }

  await supabase.from('match_tool_leads').update(update).eq('id', leadId);
  return {
    id: leadId,
    status: openaiFailed ? 'heuristic' : 'enriched',
    geography: geo || null,
    quarantined: !!update.excluded,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: leads, error } = await supabase
    .from('match_tool_leads')
    .select('id, website, enrichment_data, location')
    .eq('excluded', false)
    .or('enrichment_data.is.null,location.is.null');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results = [];
  for (const lead of leads || []) {
    try {
      // Force re-run for already-enriched-but-locationless rows so the heuristic can fill location
      const force = !!lead.enrichment_data && !lead.location;
      const r = await enrichLead(supabase, lead.id, lead.website, force);
      results.push(r);
      console.log(`[backfill] ${lead.website}: ${r.status}`);
    } catch (e) {
      results.push({ id: lead.id, status: 'error', error: String(e) });
    }
  }

  return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
