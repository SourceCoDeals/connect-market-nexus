// One-shot backfill: re-evaluates all non-quarantined match_tool_leads against
// the geo-tier + legitimacy gate using their existing enrichment_data.
// Does NOT call Firecrawl/OpenAI — purely re-classifies what's already in the DB.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/auth.ts';
import { evaluateLeadLegitimacy } from '../_shared/lead-legitimacy.ts';

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return corsPreflightResponse(req);

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const auth = await requireAdmin(req, supabase);
    if (!auth.authenticated || !auth.isAdmin) {
      return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
        status: auth.authenticated ? 403 : 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: leads, error } = await supabase
      .from('match_tool_leads')
      .select('id, website, revenue, profit, enrichment_data')
      .eq('excluded', false)
      .not('enrichment_data', 'is', null);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let evaluated = 0;
    let quarantined = 0;
    let kept = 0;
    const reasonCounts: Record<string, number> = {};

    for (const lead of leads || []) {
      evaluated += 1;
      let formatted = (lead.website || '').trim();
      if (!formatted.startsWith('http')) formatted = `https://${formatted}`;

      const verdict = evaluateLeadLegitimacy({
        websiteUrl: formatted,
        revenue: lead.revenue,
        profit: lead.profit,
        enrichment: lead.enrichment_data as Record<string, unknown> | null,
        markdown: null, // backfill only — no fresh scrape
      });

      if (!verdict.pass) {
        await supabase
          .from('match_tool_leads')
          .update({
            excluded: true,
            exclusion_reason: verdict.reason,
          })
          .eq('id', lead.id);
        quarantined += 1;
        const r = verdict.reason || 'Unknown';
        reasonCounts[r] = (reasonCounts[r] || 0) + 1;
      } else {
        kept += 1;
      }
    }

    return new Response(
      JSON.stringify({ success: true, evaluated, quarantined, kept, reasonCounts }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    console.error('[quarantine-tier3-leads] error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
