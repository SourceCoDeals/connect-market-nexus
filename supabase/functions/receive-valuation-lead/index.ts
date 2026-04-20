import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';

/** Safely read a nested .value from calculator_inputs objects. */
function inputVal(inputs: Record<string, unknown>, key: string): unknown {
  const obj = inputs?.[key];
  if (obj == null) return null;
  if (typeof obj === 'object' && 'value' in (obj as Record<string, unknown>)) {
    return (obj as Record<string, unknown>).value;
  }
  return obj;
}

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

/**
 * Email validity check — mirror of src/lib/email-validation.ts.
 * Rejects junk strings the enricher writes (e.g. "no email found", "none").
 */
function isValidEmail(s?: string | null): boolean {
  if (!s) return false;
  const t = String(s).trim().toLowerCase();
  if (!t || t.length < 5) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return false;
  if (t.includes('no email')) return false;
  if (t === 'none' || t === 'n/a' || t === 'na' || t === 'null' || t === 'undefined') return false;
  return true;
}

function pickValidEmail(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    if (isValidEmail(c)) return (c as string).trim();
  }
  return null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  const corsHeaders = getCorsHeaders(req);

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    console.log('[receive-valuation-lead] Full body:', JSON.stringify(body));

    const { full_name, email, website, calculator_inputs, valuation_result } = body;

    // Validate required fields
    const missing: string[] = [];
    if (!full_name) missing.push('full_name');
    if (!email) missing.push('email');
    if (!calculator_inputs) missing.push('calculator_inputs');
    if (!valuation_result) missing.push('valuation_result');

    if (missing.length > 0) {
      return new Response(
        JSON.stringify({ error: `Missing required fields: ${missing.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const leadSource = body.lead_source ?? 'auto_shop_calculator';
    console.log(
      'Payload debug:',
      JSON.stringify({
        full_name,
        email,
        lead_source: leadSource,
        ci_keys: calculator_inputs ? Object.keys(calculator_inputs) : null,
      }),
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ─── 1. Insert into incoming_leads (preserve both submissions as audit trail) ──
    const incomingRow = {
      external_lead_id: body.external_lead_id ?? null,
      full_name,
      email,
      website: website ?? '',
      lead_source: leadSource,
      calculator_inputs,
      valuation_result,
      ip_address: body.ip_address ?? null,
      city: body.city ?? null,
      region: body.region ?? null,
      country: body.country ?? null,
      country_code: body.country_code ?? null,
      received_at: new Date().toISOString(),
      raw_body: body,
    };

    const { error: incomingError } = await supabaseAdmin
      .from('incoming_leads')
      .upsert(incomingRow, { onConflict: 'email', ignoreDuplicates: false });

    if (incomingError) {
      console.error('incoming_leads upsert error:', incomingError);
    }

    // ─── 2. Extract structured fields & upsert into valuation_leads ──
    const ci = calculator_inputs as Record<string, unknown>;
    const vr = valuation_result as Record<string, unknown>;

    const toNum = (v: unknown): number | null => {
      if (v == null) return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    };
    const toInt = (v: unknown): number | null => {
      const n = toNum(v);
      return n == null ? null : Math.round(n);
    };
    const toStr = (v: unknown): string | null => {
      if (v == null) return null;
      return String(v);
    };

    const revenue = toNum(inputVal(ci, 'revenue_ltm'));
    const ebitda = toNum(inputVal(ci, 'ebitda_ltm'));
    const serviceType = toStr(inputVal(ci, 'service_type'));
    const locationsCount = toInt(inputVal(ci, 'locations_count'));
    const ownerDependency = toStr(inputVal(ci, 'owner_dependency'));
    const growthTrend = toStr(inputVal(ci, 'trend_24m'));

    const businessValue = vr?.businessValue as Record<string, number> | null;
    const qualityLabel = vr?.qualityLabel as Record<string, string> | null;
    const buyerLane = vr?.buyerLane as Record<string, string> | null;
    const propertyValue = vr?.propertyValue ?? null;

    const city = body.city as string | null;
    const region = body.region as string | null;
    const locationStr = [city, region].filter(Boolean).join(', ') || null;

    // Extract exit intent fields from top-level body (general calculator)
    // or from calculator_inputs (auto_shop calculator)
    const exitTiming = toStr(body.exit_timing) || toStr(inputVal(ci, 'exit_timing'));
    const openToIntros =
      body.open_to_buyer ?? (inputVal(ci, 'open_to_intros') as boolean | null) ?? null;

    // Determine calculator type from lead source
    const calculatorType = leadSource === 'valuation_calculator' ? 'general' : 'auto_shop';

    const now = new Date().toISOString();

    // ─── Extract new complete payload sections ──
    const bp = body.business_profile as Record<string, unknown> | null;
    const fd = body.financial_details as Record<string, unknown> | null;
    const ei = body.exit_intent as Record<string, unknown> | null;
    const rd = body.readiness_drivers as Record<string, unknown> | null;
    const cr = body.calculated_results as Record<string, unknown> | null;
    const bodyTags = body.tags as Record<string, unknown> | null;
    const sessionMeta = body.session_metadata as Record<string, unknown> | null;

    // Flattened fields from new payload (with fallback to old format)
    const grossMargin = toNum(bp?.grossMargin) ?? toNum(inputVal(ci, 'gross_margin'));
    const prevRevenue = toNum(bp?.prevRevenue);
    const yearsInBusiness = toStr(bp?.yearsInBusiness) ?? toStr(inputVal(ci, 'years_in_business'));
    const ownedAssets = toNum(bp?.ownedAssets);
    const customIndustry = toStr(bp?.customIndustry);
    const exitStructure = toStr(ei?.structure);
    const exitInvolvement = toStr(ei?.involvement);
    const buyerIntroPhone = toStr(ei?.buyerIntroPhone);
    const buyerIntroEmail = toStr(ei?.buyerIntroEmail);
    const marketingOptIn = body.marketing_opt_in ?? null;
    const calcSessionId = toStr(body.session_id);
    const userLocation = toStr(body.user_location);

    // Valuation insights from calculated_results
    const valuationInsights = cr?.insights ?? vr?.insights ?? null;

    // Readiness score from calculated_results or valuation_result
    const readinessScore =
      toNum(cr?.readinessScore) ?? toNum(vr?.readinessScore) ?? toNum(vr?.readiness_score);
    const businessName = businessNameFromDomain(website) ?? null;

    try {
      const { data: mergedId, error: rpcError } = await supabaseAdmin.rpc('merge_valuation_lead', {
        p_calculator_type: calculatorType,
        p_full_name: full_name,
        p_email: email,
        p_website: website ?? null,
        p_business_name: businessName,
        p_industry: serviceType ?? toStr(bp?.industry) ?? null,
        p_region: region ?? toStr(bp?.region) ?? null,
        p_location: locationStr,
        p_revenue: revenue ?? toNum(bp?.revenue),
        p_ebitda: ebitda ?? toNum(bp?.ebitda),
        p_valuation_low: toNum(businessValue?.low) ?? toNum(cr?.valuationLow),
        p_valuation_mid: toNum(businessValue?.mid) ?? toNum(cr?.valuationMid),
        p_valuation_high: toNum(businessValue?.high) ?? toNum(cr?.valuationHigh),
        p_quality_tier: (vr?.tier as string) ?? toStr(cr?.tier) ?? null,
        p_quality_label: qualityLabel?.label ?? toStr(cr?.qualityLabel) ?? null,
        p_buyer_lane: buyerLane?.title ?? null,
        p_growth_trend: growthTrend ?? toStr(bp?.revenueGrowthRate),
        p_owner_dependency: ownerDependency ?? toStr(rd?.ownerDependency),
        p_locations_count: locationsCount,
        p_lead_source: leadSource,
        p_source_submission_id: body.external_lead_id ?? null,
        p_raw_calculator_inputs: calculator_inputs,
        p_raw_valuation_results: valuation_result,
        p_calculator_specific_data: propertyValue ? { propertyValue } : null,
        p_exit_timing: exitTiming ?? toStr(ei?.timeline),
        p_open_to_intros: openToIntros ?? (ei?.openToBuyer as boolean | null) ?? null,
        // New complete payload fields
        p_marketing_opt_in: marketingOptIn,
        p_calculator_session_id: calcSessionId,
        p_user_location: userLocation,
        p_gross_margin: grossMargin,
        p_prev_revenue: prevRevenue,
        p_years_in_business: yearsInBusiness,
        p_owned_assets: ownedAssets,
        p_custom_industry: customIndustry,
        p_exit_structure: exitStructure,
        p_exit_involvement: exitInvolvement,
        p_buyer_intro_phone: buyerIntroPhone,
        p_buyer_intro_email: buyerIntroEmail,
        p_financial_details: fd ?? null,
        p_readiness_drivers: rd ?? null,
        p_exit_intent_details: ei ?? null,
        p_tags: bodyTags ?? null,
        p_session_metadata: sessionMeta ?? null,
        p_valuation_insights: valuationInsights
          ? Array.isArray(valuationInsights)
            ? valuationInsights
            : [valuationInsights]
          : null,
        p_readiness_score: readinessScore,
      });

      if (rpcError) {
        throw new Error(`merge_valuation_lead RPC failed: ${rpcError.message}`);
      }

      console.log(
        `Lead merged atomically: ${email} → valuation_leads id=${mergedId} (type=${calculatorType}, source=${leadSource})`,
      );

      // Fire-and-forget: auto-find LinkedIn and phone for the new lead
      if (mergedId) {
        triggerContactFinding(supabaseAdmin, {
          valuation_lead_id: mergedId,
          full_name,
          email,
          website: website ?? undefined,
          business_name: businessName ?? undefined,
        });

        // Fire-and-forget: enrich company data from website
        if (website) {
          triggerWebsiteEnrichment(supabaseAdmin, {
            valuation_lead_id: mergedId,
            website,
          });
        }

        // Fire-and-forget: auto-send owner outreach email
        // Gates: valid (non-junk) email + opted in (marketing or open to intros) +
        // not auto-quarantined by the trigger.
        // Prefer the explicit buyer_intro_email if it's valid; otherwise fall back
        // to the submitted email. Junk strings like "no email found" are rejected.
        const outreachEmail = pickValidEmail(buyerIntroEmail, email);
        const optedIn = marketingOptIn === true || openToIntros === true;
        if (outreachEmail && optedIn) {
          triggerOwnerOutreach(supabaseAdmin, {
            valuation_lead_id: mergedId,
            email: outreachEmail,
            full_name,
            business_name: businessName ?? undefined,
            revenue: revenue ?? toNum(bp?.revenue) ?? undefined,
            ebitda: ebitda ?? toNum(bp?.ebitda) ?? undefined,
            valuation_mid: toNum(businessValue?.mid) ?? toNum(cr?.valuationMid) ?? undefined,
            valuation_low: toNum(businessValue?.low) ?? toNum(cr?.valuationLow) ?? undefined,
            valuation_high: toNum(businessValue?.high) ?? toNum(cr?.valuationHigh) ?? undefined,
            quality_tier: (vr?.tier as string) ?? toStr(cr?.tier) ?? undefined,
            industry: serviceType ?? toStr(bp?.industry) ?? undefined,
            exit_timing: exitTiming ?? toStr(ei?.timeline) ?? undefined,
          });
        } else {
          console.log(
            `[receive-valuation-lead] Outreach skipped for ${email}: validEmail=${!!outreachEmail}, optedIn=${optedIn}`,
          );
        }
      }
    } catch (structuredErr) {
      // ─── FALLBACK: minimal safe insert so the lead is NEVER lost ──
      console.error('Structured merge failed, attempting minimal fallback:', structuredErr);

      try {
        const { data: fallbackRows, error: fallbackErr } = await supabaseAdmin
          .from('valuation_leads')
          .upsert(
            {
              email,
              full_name,
              calculator_type: calculatorType || 'unknown',
              lead_source: leadSource,
              website: website ?? null,
              business_name: businessName,
              region: region ?? null,
              location: locationStr,
              raw_calculator_inputs: calculator_inputs,
              raw_valuation_results: valuation_result,
              updated_at: now,
            },
            { onConflict: 'email,calculator_type' },
          )
          .select('id')
          .single();

        if (fallbackErr) {
          console.error('Minimal fallback also failed:', fallbackErr);
        } else {
          console.log(
            `Lead saved via FALLBACK: ${email} → valuation_leads (minimal, type=${calculatorType})`,
          );

          if (fallbackRows?.id) {
            triggerContactFinding(supabaseAdmin, {
              valuation_lead_id: fallbackRows.id,
              full_name,
              email,
              website: website ?? undefined,
              business_name: businessName ?? undefined,
            });

            if (website) {
              triggerWebsiteEnrichment(supabaseAdmin, {
                valuation_lead_id: fallbackRows.id,
                website,
              });
            }
          }
        }
      } catch (fallbackCatchErr) {
        console.error('Fallback catch error:', fallbackCatchErr);
      }
    }
    // Always return 200 — incoming_leads is the source of truth backup
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('receive-valuation-lead error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Fire-and-forget: invoke find-valuation-lead-contacts to auto-discover
 * the lead's LinkedIn URL and phone number.
 */
function triggerContactFinding(
  supabaseAdmin: ReturnType<typeof createClient>,
  payload: {
    valuation_lead_id: string;
    full_name: string;
    email: string;
    website?: string;
    business_name?: string;
  },
): void {
  supabaseAdmin.functions
    .invoke('find-valuation-lead-contacts', {
      body: payload,
      headers: {
        'x-internal-secret': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      },
    })
    .then((res) => {
      if (res.error) {
        console.error(
          `[receive-valuation-lead] Contact finding failed for ${payload.email}:`,
          res.error,
        );
      } else {
        console.log(
          `[receive-valuation-lead] Contact finding completed for ${payload.email}:`,
          JSON.stringify(res.data),
        );
      }
    })
    .catch((err: unknown) => {
      console.error(
        `[receive-valuation-lead] Contact finding invocation error for ${payload.email}:`,
        err,
      );
    });
}

/**
 * Fire-and-forget: invoke enrich-valuation-lead-website to scrape
 * and extract company intelligence from the lead's website.
 */
function triggerWebsiteEnrichment(
  supabaseAdmin: ReturnType<typeof createClient>,
  payload: {
    valuation_lead_id: string;
    website: string;
  },
): void {
  supabaseAdmin.functions
    .invoke('enrich-valuation-lead-website', {
      body: payload,
      headers: {
        'x-internal-secret': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      },
    })
    .then((res) => {
      if (res.error) {
        console.error(
          `[receive-valuation-lead] Website enrichment failed for ${payload.website}:`,
          res.error,
        );
      } else {
        console.log(
          `[receive-valuation-lead] Website enrichment completed for ${payload.website}:`,
          JSON.stringify(res.data),
        );
      }
    })
    .catch((err: unknown) => {
      console.error(
        `[receive-valuation-lead] Website enrichment invocation error for ${payload.website}:`,
        err,
      );
    });
}

/**
 * Fire-and-forget: invoke send-valuation-lead-outreach to send a 1:1
 * intro email to the business owner who just submitted a valuation.
 * Only called when the lead has a valid email and explicitly opted in.
 */
function triggerOwnerOutreach(
  supabaseAdmin: ReturnType<typeof createClient>,
  payload: {
    valuation_lead_id: string;
    email: string;
    full_name: string;
    business_name?: string;
    revenue?: number;
    ebitda?: number;
    valuation_mid?: number;
    valuation_low?: number;
    valuation_high?: number;
    quality_tier?: string;
    industry?: string;
    exit_timing?: string;
  },
): void {
  // Defer slightly so the lead row + any synchronous triggers settle.
  setTimeout(() => {
    supabaseAdmin.functions
      .invoke('send-valuation-lead-outreach', {
        body: {
          valuationLeadId: payload.valuation_lead_id,
          leadEmail: payload.email,
          leadName: payload.full_name,
          businessName: payload.business_name ?? null,
          templateKind: 'intro',
          // Default sender for auto-sends — Adam Haile, Head of Growth
          senderEmail: 'adam.haile@sourcecodeals.com',
          senderName: 'Adam Haile',
          senderTitle: 'Head of Growth',
          isResend: false,
          revenue: payload.revenue ?? null,
          ebitda: payload.ebitda ?? null,
          valuationMid: payload.valuation_mid ?? null,
          valuationLow: payload.valuation_low ?? null,
          valuationHigh: payload.valuation_high ?? null,
          qualityTier: payload.quality_tier ?? null,
          industry: payload.industry ?? null,
          exitTiming: payload.exit_timing ?? null,
        },
        headers: {
          'x-internal-secret': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        },
      })
      .then((res) => {
        if (res.error) {
          console.error(
            `[receive-valuation-lead] Owner outreach failed for ${payload.email}:`,
            res.error,
          );
        } else {
          console.log(
            `[receive-valuation-lead] Owner outreach sent for ${payload.email}:`,
            JSON.stringify(res.data),
          );
        }
      })
      .catch((err: unknown) => {
        console.error(
          `[receive-valuation-lead] Owner outreach invocation error for ${payload.email}:`,
          err,
        );
      });
  }, 2_000);
}
