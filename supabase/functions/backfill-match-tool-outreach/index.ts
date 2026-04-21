import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/auth.ts';

/**
 * backfill-match-tool-outreach
 *
 * One-shot backfill that finds eligible historical match-tool leads and
 * invokes `send-match-tool-lead-outreach` for each. Skips anyone already
 * contacted (outreach_email_status IS NOT NULL), excluded, or missing email.
 *
 * Body: { dry_run?: boolean, limit?: number }
 *
 * Auth: admin (UI) OR service-role (internal).
 */

interface BackfillBody {
  dry_run?: boolean;
  limit?: number;
}

interface LeadRow {
  id: string;
  email: string | null;
  full_name: string | null;
  business_name: string | null;
  revenue: string | null;
  profit: string | null;
  industry: string | null;
  timeline: string | null;
  quality_tier: string | null;
  enrichment_data: Record<string, unknown> | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('authorization') || '';
    const internalSecret = req.headers.get('x-internal-secret') || '';
    const isServiceRole = authHeader.includes(serviceKey) || internalSecret === serviceKey;

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (!isServiceRole) {
      const auth = await requireAdmin(req, supabase);
      if (!auth.isAdmin) {
        return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
          status: auth.authenticated ? 403 : 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    let body: BackfillBody = {};
    try {
      body = (await req.json()) as BackfillBody;
    } catch {
      body = {};
    }
    const dryRun = body.dry_run === true;
    const limit = Math.min(Math.max(body.limit ?? 200, 1), 500);

    // Eligible: full_form, has email, not excluded, never sent (status IS NULL)
    const { data: leads, error } = await supabase
      .from('match_tool_leads')
      .select(
        'id, email, full_name, business_name, revenue, profit, industry, timeline, quality_tier, enrichment_data',
      )
      .eq('submission_stage', 'full_form')
      .not('email', 'is', null)
      .neq('email', '')
      .or('excluded.is.null,excluded.eq.false')
      .is('outreach_email_status', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const eligible = (leads || []) as LeadRow[];

    console.log(`[backfill-match-tool-outreach] eligible=${eligible.length} dry_run=${dryRun}`);

    if (dryRun) {
      return new Response(
        JSON.stringify({
          dry_run: true,
          evaluated: eligible.length,
          recipients: eligible.map((l) => ({
            id: l.id,
            email: l.email,
            full_name: l.full_name,
            business_name: l.business_name,
          })),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (let i = 0; i < eligible.length; i++) {
      const lead = eligible[i];
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/send-match-tool-lead-outreach`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
            'x-internal-secret': serviceKey,
          },
          body: JSON.stringify({
            matchToolLeadId: lead.id,
            leadEmail: lead.email,
            leadName: lead.full_name || '',
            businessName: lead.business_name,
            revenueBucket: lead.revenue,
            profitBucket: lead.profit,
            qualityTier: lead.quality_tier,
            industry: lead.industry,
            timeline: lead.timeline,
            enrichmentData: lead.enrichment_data,
          }),
        });
        const text = await resp.text();
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { raw: text };
        }

        if (resp.ok && (parsed.success === true || parsed.skipped === true)) {
          if (parsed.skipped === true) skipped++;
          else sent++;
        } else {
          failed++;
          errors.push({ id: lead.id, error: String(parsed.error || `HTTP ${resp.status}`) });
        }
      } catch (e) {
        failed++;
        errors.push({ id: lead.id, error: e instanceof Error ? e.message : 'unknown' });
      }

      // Throttle between sends (skip the trailing wait)
      if (i < eligible.length - 1) await sleep(1500);
    }

    console.log(
      `[backfill-match-tool-outreach] done evaluated=${eligible.length} sent=${sent} skipped=${skipped} failed=${failed}`,
    );

    return new Response(
      JSON.stringify({
        evaluated: eligible.length,
        sent,
        skipped,
        failed,
        errors: errors.slice(0, 10),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[backfill-match-tool-outreach] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
