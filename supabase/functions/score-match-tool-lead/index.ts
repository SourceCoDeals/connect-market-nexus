/**
 * score-match-tool-lead
 *
 * Lightweight scorer for match_tool_leads. Stage + financials + contact
 * completeness drive a 0-100 score and quality_label / quality_tier.
 *
 * POST body: { lead_ids?: string[], mode?: 'all' | 'unscored' }
 * Auth: admin JWT or x-internal-secret (service role)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';

// ── Bucket → numeric midpoints (match buildListingFromMatchToolLead) ──
const REVENUE_MIDPOINTS: Record<string, number> = {
  under_500k: 250_000,
  '500k_1m': 750_000,
  '1m_5m': 3_000_000,
  '5m_10m': 7_500_000,
  '10m_25m': 17_500_000,
  '25m_50m': 37_500_000,
  '50m_plus': 75_000_000,
};
const PROFIT_MIDPOINTS: Record<string, number> = {
  under_100k: 50_000,
  '100k_500k': 300_000,
  '500k_1m': 750_000,
  '1m_3m': 2_000_000,
  '3m_5m': 4_000_000,
  '5m_plus': 7_500_000,
};

// Stage-based base scores (0-25)
const STAGE_BASE: Record<string, number> = {
  full_form: 25, // Wants buyers — highest intent
  financials: 18, // Submitted financials
  browse: 5, // Just browsing
};

// Timeline → urgency points (0-15)
const TIMELINE_SCORES: Record<string, number> = {
  less_than_6_months: 15,
  '6_to_12_months': 10,
  '1_to_2_years': 5,
  '2_plus_years': 2,
  not_sure: 0,
};

interface ScoreRequest {
  lead_ids?: string[];
  mode?: 'all' | 'unscored';
}

interface MatchToolLeadRow {
  id: string;
  submission_stage: string;
  revenue: string | null;
  profit: string | null;
  timeline: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  website: string | null;
  business_name: string | null;
  industry: string | null;
  enrichment_data: Record<string, unknown> | null;
}

function scoreLead(lead: MatchToolLeadRow): {
  score: number;
  quality_label: string;
  quality_tier: string;
  notes: string;
} {
  const parts: string[] = [];
  let score = 0;

  // 1) Stage (0-25)
  const stagePts = STAGE_BASE[lead.submission_stage] ?? 0;
  score += stagePts;
  parts.push(`stage:${lead.submission_stage}=${stagePts}`);

  // 2) Financials (0-30) — bigger business = higher signal
  let finPts = 0;
  const rev = lead.revenue ? (REVENUE_MIDPOINTS[lead.revenue] ?? 0) : 0;
  const profit = lead.profit ? (PROFIT_MIDPOINTS[lead.profit] ?? 0) : 0;
  if (profit >= 5_000_000) finPts = 30;
  else if (profit >= 1_000_000) finPts = 25;
  else if (profit >= 500_000) finPts = 18;
  else if (profit >= 100_000) finPts = 10;
  else if (profit > 0) finPts = 5;
  else if (rev >= 10_000_000) finPts = 18;
  else if (rev >= 5_000_000) finPts = 12;
  else if (rev >= 1_000_000) finPts = 7;
  else if (rev > 0) finPts = 3;
  score += finPts;
  parts.push(`financials=${finPts}`);

  // 3) Timeline urgency (0-15)
  const timelinePts = lead.timeline ? (TIMELINE_SCORES[lead.timeline] ?? 0) : 0;
  score += timelinePts;
  parts.push(`timeline=${timelinePts}`);

  // 4) Contact completeness (0-20)
  let contactPts = 0;
  if (lead.full_name && lead.email) contactPts += 10;
  if (lead.phone) contactPts += 5;
  if (lead.linkedin_url) contactPts += 5;
  score += contactPts;
  parts.push(`contact=${contactPts}`);

  // 5) Enrichment depth (0-10)
  let enrichPts = 0;
  const enrich = lead.enrichment_data as Record<string, unknown> | null;
  if (enrich) {
    const keys = Object.keys(enrich);
    if (keys.length >= 6) enrichPts = 10;
    else if (keys.length >= 3) enrichPts = 6;
    else enrichPts = 3;
  }
  score += enrichPts;
  parts.push(`enrichment=${enrichPts}`);

  score = Math.min(100, score);

  let quality_label: string;
  let quality_tier: string;
  if (score >= 80) {
    quality_label = 'Very Strong';
    quality_tier = 'premium';
  } else if (score >= 65) {
    quality_label = 'Strong';
    quality_tier = 'premium';
  } else if (score >= 50) {
    quality_label = 'Solid';
    quality_tier = 'medium';
  } else if (score >= 30) {
    quality_label = 'Average';
    quality_tier = 'medium';
  } else {
    quality_label = 'Needs Work';
    quality_tier = 'cheap';
  }

  return {
    score,
    quality_label,
    quality_tier,
    notes: `${parts.join(' + ')} = ${score}`,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Auth: admin JWT or service-role x-internal-secret
  const internalSecret = req.headers.get('x-internal-secret');
  const isServiceCall = internalSecret === supabaseServiceKey;
  if (!isServiceCall) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') || supabaseServiceKey,
    );
    const {
      data: { user },
    } = await anonClient.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  let body: ScoreRequest = {};
  try {
    body = await req.json();
  } catch {
    // empty body OK
  }

  let query = supabase
    .from('match_tool_leads')
    .select(
      'id, submission_stage, revenue, profit, timeline, full_name, email, phone, linkedin_url, website, business_name, industry, enrichment_data',
    )
    .eq('excluded', false)
    .limit(500);

  if (body.lead_ids && body.lead_ids.length > 0) {
    query = query.in('id', body.lead_ids);
  } else if (body.mode === 'unscored') {
    query = query.is('lead_score', null);
  }

  const { data: leads, error: fetchError } = await query;
  if (fetchError) {
    console.error('[score-match-tool-lead] Fetch error:', fetchError);
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!leads || leads.length === 0) {
    return new Response(JSON.stringify({ scored: 0, message: 'No leads to score' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let scored = 0;
  const errors: string[] = [];
  for (const lead of leads as MatchToolLeadRow[]) {
    try {
      const result = scoreLead(lead);
      const { error: updateError } = await supabase
        .from('match_tool_leads')
        .update({
          lead_score: result.score,
          quality_label: result.quality_label,
          quality_tier: result.quality_tier,
          scoring_notes: result.notes,
        })
        .eq('id', lead.id);
      if (updateError) errors.push(`${lead.id}: ${updateError.message}`);
      else scored++;
    } catch (err) {
      errors.push(`${lead.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  console.log(`[score-match-tool-lead] Scored ${scored}/${leads.length}. Errors: ${errors.length}`);
  return new Response(
    JSON.stringify({
      success: true,
      scored,
      total: leads.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
