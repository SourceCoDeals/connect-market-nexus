import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../_shared/ai-providers.ts";

/**
 * backfill-industry: One-time batch classifier for deals missing industry.
 * Uses Gemini to infer industry from title, executive_summary, description, service_mix.
 * Self-continues to process all ~4800+ deals.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 50;
const CONCURRENCY = 10;
const MAX_RUNTIME_MS = 45000;

async function classifyIndustry(
  deal: { id: string; title: string; executive_summary?: string; description?: string; service_mix?: string; category?: string; services?: string[] },
  apiKey: string,
): Promise<string | null> {
  const context = [
    deal.title && `Company: ${deal.title}`,
    deal.executive_summary && `Summary: ${String(deal.executive_summary).substring(0, 400)}`,
    deal.description && `Description: ${String(deal.description).substring(0, 200)}`,
    deal.service_mix && `Services: ${String(deal.service_mix).substring(0, 200)}`,
    deal.category && `Category: ${deal.category}`,
    deal.services?.length && `Service List: ${deal.services.join(', ')}`,
  ].filter(Boolean).join('\n');

  if (!context || context.length < 10) return null;

  try {
    const res = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: getGeminiHeaders(apiKey),
      body: JSON.stringify({
        model: DEFAULT_GEMINI_MODEL,
        messages: [
          { role: 'system', content: 'You classify businesses into concise industry labels. Return ONLY the industry label, nothing else. Be specific but concise (2-4 words). Examples: "HVAC Services", "Commercial Plumbing", "IT Managed Services", "Environmental Remediation", "Healthcare Staffing", "Event Venue", "Contract Manufacturing", "Physical Therapy", "Printing Services".' },
          { role: 'user', content: `Classify this business:\n${context}` },
        ],
        max_tokens: 20,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`[classifyIndustry] API returned ${res.status} for deal ${deal.id}`);
      return null;
    }
    const data = await res.json();
    const industry = data.choices?.[0]?.message?.content?.trim();
    if (industry && industry.length > 1 && industry.length < 60) return industry;
  } catch (err) {
    console.warn(`[classifyIndustry] Error for deal ${deal.id}:`, err);
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

  if (!geminiApiKey) {
    return new Response(JSON.stringify({ error: 'No AI API key configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const startTime = Date.now();

  // Parse optional offset
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const offset = body.offset || 0;

  // Fetch batch of deals missing industry
  const { data: deals, error: fetchErr } = await supabase
    .from('listings')
    .select('id, title, executive_summary, description, service_mix, category, services')
    .not('enriched_at', 'is', null)
    .or('industry.is.null,industry.eq.')
    .order('enriched_at', { ascending: true })
    .range(0, BATCH_SIZE - 1); // always fetch from top since we update as we go

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!deals || deals.length === 0) {
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'All deals have industry classified!',
      totalProcessed: offset,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let classified = 0;
  let failed = 0;

  // Process in concurrent chunks
  for (let i = 0; i < deals.length; i += CONCURRENCY) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) break;

    const chunk = deals.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map(async (deal) => {
        const industry = await classifyIndustry(deal as any, geminiApiKey);
        if (industry) {
          const { error } = await supabase
            .from('listings')
            .update({ industry })
            .eq('id', deal.id);
          if (error) throw error;
          return industry;
        }
        return null;
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) classified++;
      else failed++;
    }
  }

  const totalProcessed = offset + classified + failed;

  // Self-continue if there are more deals
  if (deals.length === BATCH_SIZE && Date.now() - startTime < MAX_RUNTIME_MS + 5000) {
    // Trigger next batch
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    try {
      fetch(`${supabaseUrl}/functions/v1/backfill-industry`, {
        method: 'POST',
        headers: {
          apikey: anonKey!,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ offset: totalProcessed }),
      }).catch(() => {}); // fire-and-forget
    } catch { /* ignore */ }
  }

  return new Response(JSON.stringify({
    success: true,
    batchClassified: classified,
    batchFailed: failed,
    totalProcessed,
    hasMore: deals.length === BATCH_SIZE,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
