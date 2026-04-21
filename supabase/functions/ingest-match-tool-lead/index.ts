import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  checkWebsiteReachability,
  checkScrapedContent,
  evaluateLeadLegitimacy,
} from '../_shared/lead-legitimacy.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const COMPANY_SCHEMA = {
  name: 'extract_company',
  description: 'Extract a structured company profile from website content.',
  parameters: {
    type: 'object',
    properties: {
      company_name: { type: 'string', description: 'Official company name' },
      one_liner: { type: 'string', description: 'One sentence describing what they do and where' },
      services: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific services they offer',
      },
      industry: { type: 'string', description: "Industry vertical (e.g. 'Home Services — HVAC')" },
      geography: { type: 'string', description: 'Primary location/service area' },
      employee_estimate: { type: 'string', description: "Estimated size range (e.g. '10-25')" },
      year_founded: { type: 'string', description: 'Year founded or null' },
      revenue_estimate: { type: 'string', description: 'Estimated revenue range if inferable' },
      notable_signals: {
        type: 'array',
        items: { type: 'string' },
        description: 'Notable business signals',
      },
    },
    required: ['company_name', 'one_liner', 'services', 'industry', 'geography'],
    additionalProperties: false,
  },
};

async function enrichLead(
  supabase: any,
  leadId: string,
  website: string,
  leadRow?: { revenue?: string | null; profit?: string | null },
) {
  try {
    const { data: existing } = await supabase
      .from('match_tool_leads')
      .select('enrichment_data, location, revenue, profit')
      .eq('id', leadId)
      .single();

    if (existing?.enrichment_data) return;

    const revenue = leadRow?.revenue ?? existing?.revenue ?? null;
    const profit = leadRow?.profit ?? existing?.profit ?? null;

    let formattedUrl = website.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    // ─── 1. Website reachability gate ───────────────────────────────────
    const reach = await checkWebsiteReachability(formattedUrl);
    if (!reach.ok) {
      console.log(`[enrich] ${leadId} reachability fail: ${reach.reason}`);
      await supabase
        .from('match_tool_leads')
        .update({
          excluded: true,
          exclusion_reason: reach.reason,
          last_enriched_at: new Date().toISOString(),
        })
        .eq('id', leadId);
      return;
    }

    // Scrape via Firecrawl
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (!FIRECRAWL_API_KEY) {
      console.warn('[enrich] FIRECRAWL_API_KEY not configured, skipping');
      return;
    }

    console.log(`[enrich] Scraping: ${formattedUrl}`);

    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
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

    let markdown = '';
    if (scrapeResponse.ok) {
      const scrapeResult = await scrapeResponse.json();
      markdown = scrapeResult.data?.markdown || scrapeResult.markdown || '';
    } else {
      console.warn(`[enrich] Firecrawl failed: ${scrapeResponse.status}`);
    }

    // ─── 2. Content reality check ───────────────────────────────────────
    const content = checkScrapedContent(markdown);
    if (!content.ok) {
      console.log(`[enrich] ${leadId} content fail: ${content.reason}`);
      await supabase
        .from('match_tool_leads')
        .update({
          excluded: true,
          exclusion_reason: content.reason,
          last_enriched_at: new Date().toISOString(),
        })
        .eq('id', leadId);
      return;
    }

    // Extract with OpenAI
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.warn('[enrich] OPENAI_API_KEY not configured, skipping');
      return;
    }

    const truncatedMarkdown = markdown.slice(0, 8000);

    const prompt = `Analyze this company website content and extract a structured profile. Be concise and factual. If information is not available, use null.

Website: ${formattedUrl}
Content:
${truncatedMarkdown || '(No content available - infer from URL only)'}`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content:
              'Extract structured company data from the provided website content. Be concise and factual.',
          },
          { role: 'user', content: prompt },
        ],
        tools: [{ type: 'function', function: COMPANY_SCHEMA }],
        tool_choice: { type: 'function', function: { name: 'extract_company' } },
      }),
    });

    if (!aiResponse.ok) {
      console.error(`[enrich] OpenAI error: ${aiResponse.status}`);
      return;
    }

    const aiResult = await aiResponse.json();

    let enrichmentData;
    try {
      const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        enrichmentData =
          typeof toolCall.function.arguments === 'string'
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments;
      } else {
        const content = aiResult.choices?.[0]?.message?.content || '{}';
        enrichmentData = JSON.parse(content);
      }
    } catch {
      console.error('[enrich] Failed to parse AI response');
      enrichmentData = { company_name: null, one_liner: 'Could not analyze website' };
    }

    enrichmentData.enriched_at = new Date().toISOString();

    // ─── 3. Geo-aware legitimacy gate ───────────────────────────────────
    const verdict = evaluateLeadLegitimacy({
      websiteUrl: formattedUrl,
      revenue,
      profit,
      enrichment: enrichmentData,
      markdown,
    });

    // Also persist location if not already set, so it's queryable / sortable / exportable
    const NOISE_GEO = new Set([
      '',
      'not specified',
      'global',
      'unknown',
      'not sure',
      'international',
      'n/a',
    ]);
    const geo = (enrichmentData.geography || '').toString().trim();
    const updatePayload: Record<string, unknown> = {
      enrichment_data: enrichmentData,
      last_enriched_at: new Date().toISOString(),
    };
    if (geo && !NOISE_GEO.has(geo.toLowerCase()) && !existing?.location) {
      updatePayload.location = geo;
    }
    if (!verdict.pass) {
      updatePayload.excluded = true;
      updatePayload.exclusion_reason = verdict.reason;
      console.log(`[enrich] ${leadId} legitimacy fail: ${verdict.reason} (tier=${verdict.tier})`);
    }

    await supabase.from('match_tool_leads').update(updatePayload).eq('id', leadId);

    console.log(
      `[enrich] Successfully enriched lead ${leadId} — tier=${verdict.tier}, kept=${verdict.pass}`,
    );
  } catch (err) {
    console.error('[enrich] Background enrichment error:', err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const payload = await req.json();
    const { website, revenue, profit, full_name, email, phone, timeline, raw_inputs, source } =
      payload;

    if (!website) {
      return json({ error: 'website is required' }, 400);
    }

    let submission_stage = 'browse';
    if (full_name && email) {
      submission_stage = 'full_form';
    } else if (revenue || profit) {
      submission_stage = 'financials';
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data, error } = await supabase.rpc('merge_match_tool_lead', {
      p_website: website,
      p_email: email || null,
      p_full_name: full_name || null,
      p_phone: phone || null,
      p_revenue: typeof revenue === 'number' ? String(revenue) : revenue || null,
      p_profit: typeof profit === 'number' ? String(profit) : profit || null,
      p_timeline: timeline || null,
      p_submission_stage: submission_stage,
      p_raw_inputs: raw_inputs ? JSON.stringify(raw_inputs) : JSON.stringify(payload),
      p_source: source || 'deal-match-ai',
    });

    if (error) {
      console.error('merge_match_tool_lead RPC error:', error);

      const { error: insertError } = await supabase.from('match_tool_leads').insert({
        website: website.toLowerCase().trim(),
        email: email || null,
        full_name: full_name || null,
        phone: phone || null,
        revenue: typeof revenue === 'number' ? String(revenue) : revenue || null,
        profit: typeof profit === 'number' ? String(profit) : profit || null,
        timeline: timeline || null,
        submission_stage,
        raw_inputs: raw_inputs || payload,
        source: source || 'deal-match-ai',
      });

      if (insertError) {
        console.error('Fallback insert error:', insertError);
      }
    }

    // Fire-and-forget enrichment + outreach (full_form leads only)
    const leadId = data;
    if (leadId && website) {
      enrichLead(supabase, leadId, website, { revenue, profit })
        .catch((e) => console.error('[ingest] enrichment fire-and-forget error:', e))
        .finally(() => {
          // Auto-send hyper-personalized outreach for "Wants Buyers" cohort
          // (full form complete + valid email). Defer 8s so enrichment data is
          // available for the strongest hook selection. Quarantine guard +
          // suppression check live inside the send function.
          if (submission_stage === 'full_form' && email) {
            setTimeout(() => {
              const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
              const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
              fetch(`${supabaseUrl}/functions/v1/send-match-tool-lead-outreach`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${serviceKey}`,
                  'x-internal-secret': serviceKey,
                },
                body: JSON.stringify({ matchToolLeadId: leadId }),
              })
                .then(async (r) => {
                  const txt = await r.text();
                  console.log(
                    `[ingest] outreach trigger result lead=${leadId} status=${r.status} body=${txt.slice(0, 200)}`,
                  );
                })
                .catch((e) => console.error('[ingest] outreach trigger error:', e));
            }, 8_000);
          }
        });
    }

    return json({ success: true, id: data });
  } catch (err) {
    console.error('ingest-match-tool-lead error:', err);
    return json({ error: 'Internal error', success: false });
  }
});
