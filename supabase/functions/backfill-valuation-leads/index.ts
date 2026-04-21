import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';

/** Extract a business name from a website domain */
function businessNameFromDomain(website: string | null): string | null {
  if (!website) return null;
  try {
    const domain = website
      .trim()
      .toLowerCase()
      .replace(/^[a-z]{3,6}:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .split('?')[0]
      .split('.')[0];
    if (domain && domain.length > 1) {
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    }
  } catch {
    /* ignore */
  }
  return null;
}

const toNum = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
};
const toStr = (v: unknown): string | null => {
  if (v == null) return null;
  return String(v);
};

/**
 * Helper to extract value from enriched calculator_inputs fields.
 * Fields may be plain values or objects like { value: X, label: Y }.
 */
function getVal(inputs: Record<string, unknown> | null, key: string): unknown {
  if (!inputs) return null;
  const field = inputs[key];
  if (field && typeof field === 'object' && 'value' in (field as Record<string, unknown>)) {
    return (field as Record<string, unknown>).value;
  }
  return field;
}

function getLabel(inputs: Record<string, unknown> | null, key: string): string | null {
  if (!inputs) return null;
  const field = inputs[key];
  if (field && typeof field === 'object' && 'label' in (field as Record<string, unknown>)) {
    return String((field as Record<string, unknown>).label ?? '');
  }
  return field != null ? String(field) : null;
}

/**
 * One-time backfill: reads from the external Valuation Insights project
 * (ref: gwtmbbntcrftqohnlxid) and upserts into the local valuation_leads
 * table via the merge_valuation_lead RPC.
 *
 * External table schema (valuation_leads):
 *   id, full_name, email, website, calculator_inputs (JSONB),
 *   valuation_result (JSONB), lead_source, ip_address, city, region,
 *   country, country_code, created_at
 */
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);
  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const { source_url, source_key } = await req.json();
    if (!source_url || !source_key) {
      return new Response(JSON.stringify({ error: 'source_url and source_key are required' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    // ── Connect to source & local projects ──
    let sourceLeads: Record<string, unknown>[];

    if (source_key.startsWith('sb_secret_')) {
      // New key format — use REST API directly
      console.log('[backfill] Using REST API (new key format)');
      const restUrl = `${source_url}/rest/v1/valuation_leads?select=*&order=created_at.asc`;
      const resp = await fetch(restUrl, {
        headers: {
          apikey: source_key,
          Authorization: `Bearer ${source_key}`,
          'Content-Type': 'application/json',
        },
      });
      if (!resp.ok) {
        const text = await resp.text();
        return new Response(
          JSON.stringify({ error: `Source fetch failed (${resp.status}): ${text}` }),
          { status: 500, headers: jsonHeaders },
        );
      }
      sourceLeads = await resp.json();
    } else {
      // Legacy JWT key — use supabase-js
      console.log('[backfill] Using supabase-js (legacy key)');
      const sourceClient = createClient(source_url, source_key);
      const { data, error: fetchErr } = await sourceClient
        .from('valuation_leads')
        .select('*')
        .order('created_at', { ascending: true });

      if (fetchErr) {
        return new Response(JSON.stringify({ error: `Failed to fetch: ${fetchErr.message}` }), {
          status: 500,
          headers: jsonHeaders,
        });
      }
      sourceLeads = (data ?? []) as Record<string, unknown>[];
    }

    if (!sourceLeads || sourceLeads.length === 0) {
      return new Response(JSON.stringify({ message: 'No leads found in source', total: 0 }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    console.log(`[backfill] Found ${sourceLeads.length} leads to process`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let processed = 0;
    let errors = 0;
    const errorDetails: Array<{ email: string; error: string }> = [];

    for (const row of sourceLeads) {
      try {
        const email = toStr(row.email);
        if (!email) {
          console.log(`[backfill] Skipping ${row.id} — no email`);
          continue;
        }

        const fullName = toStr(row.full_name) || 'Unknown';
        const website = toStr(row.website);
        const businessName = businessNameFromDomain(website);

        const ci = row.calculator_inputs as Record<string, unknown> | null;
        const vr = row.valuation_result as Record<string, unknown> | null;

        // Extract structured valuation results
        const bv = vr?.businessValue as Record<string, number> | null;
        const ql = vr?.qualityLabel as Record<string, string> | null;
        const bl = vr?.buyerLane as Record<string, string> | null;

        // Determine calculator type from lead_source
        const leadSource = toStr(row.lead_source) || 'initial_unlock';
        const calculatorType = leadSource === 'auto_shop_calculator' ? 'auto_shop' : 'general';

        // Build location string
        const city = toStr(row.city);
        const region = toStr(row.region);
        const locationStr = [city, region].filter(Boolean).join(', ') || null;

        const { error: rpcError } = await supabaseAdmin.rpc('merge_valuation_lead', {
          p_calculator_type: calculatorType,
          p_full_name: fullName,
          p_email: email,
          p_website: website,
          p_business_name: businessName,
          p_industry: getLabel(ci, 'service_type'),
          p_region: region,
          p_location: locationStr,
          p_revenue: toNum(getVal(ci, 'revenue_ltm')),
          p_ebitda: toNum(getVal(ci, 'ebitda_ltm')),
          p_valuation_low: toNum(bv?.low),
          p_valuation_mid: toNum(bv?.mid),
          p_valuation_high: toNum(bv?.high),
          p_quality_tier: toStr(vr?.tier),
          p_quality_label: toStr(ql?.label),
          p_buyer_lane: toStr(bl?.title),
          p_growth_trend: getLabel(ci, 'trend_24m'),
          p_owner_dependency: getLabel(ci, 'owner_dependency'),
          p_locations_count: toNum(getVal(ci, 'locations_count')),
          p_lead_source: leadSource,
          p_source_submission_id: toStr(row.id),
          p_raw_calculator_inputs: ci ?? null,
          p_raw_valuation_results: vr ?? null,
          p_calculator_specific_data: vr?.propertyValue
            ? { propertyValue: vr.propertyValue }
            : null,
          p_exit_timing: null,
          p_open_to_intros: null,
          p_marketing_opt_in: null,
          p_calculator_session_id: null,
          p_user_location: toStr(row.country) || null,
          p_gross_margin: null,
          p_prev_revenue: null,
          p_years_in_business: null,
          p_owned_assets: null,
          p_custom_industry: null,
          p_exit_structure: null,
          p_exit_involvement: null,
          p_buyer_intro_phone: null,
          p_buyer_intro_email: null,
          p_financial_details: null,
          p_readiness_drivers: null,
          p_exit_intent_details: null,
          p_tags: null,
          p_session_metadata: row.ip_address
            ? {
                ip_address: row.ip_address,
                city: row.city,
                country: row.country,
                country_code: row.country_code,
              }
            : null,
          p_valuation_insights: vr?.insights
            ? Array.isArray(vr.insights)
              ? vr.insights
              : [vr.insights]
            : null,
        });

        if (rpcError) {
          console.error(`[backfill] RPC error for ${email}:`, rpcError.message);
          errors++;
          errorDetails.push({ email, error: rpcError.message });
        } else {
          processed++;
        }

        if ((processed + errors) % 50 === 0) {
          console.log(`[backfill] Progress: ${processed + errors}/${sourceLeads.length}`);
        }
      } catch (e: unknown) {
        errors++;
        const email = toStr(row.email) || 'unknown';
        const msg = e instanceof Error ? e.message : 'Unknown error';
        errorDetails.push({ email, error: msg });
        console.error(`[backfill] Error processing ${email}:`, msg);
      }
    }

    const summary = {
      total_leads: sourceLeads.length,
      processed,
      errors,
      error_details: errorDetails.slice(0, 20),
    };

    console.log(`[backfill] Complete:`, JSON.stringify(summary));
    return new Response(JSON.stringify(summary), { status: 200, headers: jsonHeaders });
  } catch (err) {
    console.error('[backfill] Fatal error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
