import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email-sender.ts';
import { requireAdmin } from '../_shared/auth.ts';

/**
 * send-match-tool-lead-outreach
 *
 * Sends a 1:1 owner outreach email tied to a match_tool_leads record.
 *
 * Architecture mirrors send-valuation-lead-outreach: hook-routed micro-templates
 * with per-lead deterministic micro-variance. The match-tool data shape differs
 * (bucketed revenue/profit, no valuation band), so spread_anomaly is dropped
 * and margin_contrast uses bucket midpoints.
 *
 * Copy rule: never use em-dashes or en-dashes anywhere in generated copy.
 *
 * Auth: service-role (internal auto-send) OR authenticated admin (UI).
 */

type TemplateKind = 'intro' | 'followup' | 'custom';

type HookKind =
  | 'tenure_signal'
  | 'industry_quirk'
  | 'margin_contrast'
  | 'timing_alignment'
  | 'tier_observation';

interface RequestBody {
  matchToolLeadId: string;
  leadEmail: string;
  leadName?: string;
  businessName?: string | null;
  templateKind?: TemplateKind;
  senderEmail?: string;
  senderName?: string;
  senderTitle?: string;
  isResend?: boolean;
  customSubject?: string;
  customBodyHtml?: string;
  customBodyText?: string;
  // Personalization data
  revenueBucket?: string | null;
  profitBucket?: string | null;
  qualityTier?: string | null;
  industry?: string | null;
  timeline?: string | null;
  enrichmentData?: Record<string, unknown> | null;
}

// --- Email validity ---
function isValidEmail(s?: string | null): boolean {
  if (!s) return false;
  const t = String(s).trim().toLowerCase();
  if (!t || t.length < 5) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return false;
  if (t.includes('no email')) return false;
  if (t === 'none' || t === 'n/a' || t === 'na' || t === 'null' || t === 'undefined') return false;
  return true;
}

// --- Bucket → midpoint number mapping ---
// Mirrors REVENUE_LABELS / PROFIT_LABELS in MatchToolLeadPanel.
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

function bucketToRevenue(b?: string | null): number | null {
  if (!b) return null;
  return REVENUE_MIDPOINTS[b] ?? null;
}
function bucketToProfit(b?: string | null): number | null {
  if (!b) return null;
  return PROFIT_MIDPOINTS[b] ?? null;
}

// --- Formatters ---
function fmtCurrency(n: number | null | undefined): string {
  if (n == null || !isFinite(n) || n <= 0) return '';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function tierBand(tier: string | null | undefined): string {
  if (!tier) return 'mid';
  const t = tier.toLowerCase();
  if (t.includes('high') || t === 'a' || t.includes('premium')) return 'top';
  if (t.includes('low') || t === 'c' || t === 'd') return 'value';
  return 'mid';
}

function tierInsight(tier: string | null | undefined): string {
  switch (tierBand(tier)) {
    case 'top':
      return 'owner-independence and recurring-revenue mix';
    case 'value':
      return 'EBITDA margin trend and how clean your add-backs are';
    default:
      return 'documented financials and customer concentration';
  }
}

function firstNameOnly(name: string): string {
  return (name || '').trim().split(/\s+/)[0] || name || '';
}

function htmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function textToHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .map((p) => `<p>${htmlEscape(p).replace(/\n/g, '<br/>')}</p>`)
    .join('\n');
}

function wrapHtml(inner: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#222;">
${inner}
</body>
</html>`;
}

// --- Industry helpers ---
function industryShortLabel(industry: string | null | undefined): string | null {
  if (!industry) return null;
  const i = industry.toLowerCase();
  if (/\bhvac/.test(i)) return 'HVAC';
  if (/\bplumb/.test(i)) return 'plumbing';
  if (/\belectric/.test(i)) return 'electrical';
  if (/\broof/.test(i)) return 'roofing';
  if (/\b(auto|repair|tire|collision|body shop)/.test(i)) return 'auto-repair';
  if (/\b(restaurant|cafe|bar|bakery)/.test(i)) return 'restaurant';
  if (/\b(food|catering)/.test(i)) return 'F&B';
  if (/\bsaas/.test(i)) return 'SaaS';
  if (/\b(software|app|platform)/.test(i)) return 'software';
  if (/\b(ecom|e-com|shopify|amazon|dtc|d2c|online retail)/.test(i)) return 'e-com';
  if (/\b(agency|marketing|advert|creative)/.test(i)) return 'agency';
  if (/\b(manufactur|fabric|industrial)/.test(i)) return 'manufacturing';
  if (/\b(consult|advisory|professional services)/.test(i)) return 'services';
  if (/\b(account|legal|law|cpa)/.test(i)) return 'professional';
  if (/\b(landscap|lawn|cleaning|janitorial|pest|home service)/.test(i)) return 'home-services';
  if (/\b(health|medical|dental|clinic|wellness|therapy|chiro)/.test(i)) return 'healthcare';
  if (/\b(logistic|trucking|freight|distribution|warehouse)/.test(i)) return 'logistics';
  if (/\b(retail|store|shop)/.test(i)) return 'retail';
  return null;
}

function industryTypicalMarginBand(industry: string | null | undefined): [number, number] | null {
  if (!industry) return null;
  const i = industry.toLowerCase();
  if (/\b(saas|software|app|platform)/.test(i)) return [0.18, 0.35];
  if (/\b(ecom|e-com|shopify|amazon|dtc|d2c|online retail)/.test(i)) return [0.08, 0.18];
  if (/\b(restaurant|food|cafe|bar|bakery|catering)/.test(i)) return [0.08, 0.15];
  if (/\b(hvac|plumb|electric|mechanical|roof)/.test(i)) return [0.12, 0.22];
  if (/\b(auto|repair|tire|collision|body shop)/.test(i)) return [0.12, 0.2];
  if (/\b(agency|marketing|advert|creative|design)/.test(i)) return [0.15, 0.3];
  if (/\b(manufactur|fabric|industrial)/.test(i)) return [0.1, 0.18];
  if (/\b(consult|advisory|account|legal|law|cpa|professional services)/.test(i)) return [0.2, 0.4];
  if (/\b(landscap|lawn|cleaning|janitorial|pest|home service)/.test(i)) return [0.12, 0.22];
  if (/\b(health|medical|dental|clinic|wellness|therapy|chiro)/.test(i)) return [0.15, 0.3];
  if (/\b(logistic|trucking|freight|distribution|warehouse)/.test(i)) return [0.08, 0.15];
  if (/\b(retail|store|shop)/.test(i)) return [0.05, 0.12];
  return null;
}

// --- Hook signal extractors ---
function extractFoundedYear(data: Record<string, unknown> | null | undefined): number | null {
  if (!data || typeof data !== 'object') return null;
  const candidates: unknown[] = [
    (data as Record<string, unknown>).year_founded,
    (data as Record<string, unknown>).founded_year,
    (data as Record<string, unknown>).foundedYear,
    (data as Record<string, unknown>).established,
    (data as Record<string, unknown>).since,
  ];
  for (const c of candidates) {
    if (typeof c === 'number' && c > 1800 && c < 2100) return c;
    if (typeof c === 'string') {
      const m = c.match(/(18|19|20)\d{2}/);
      if (m) {
        const n = parseInt(m[0], 10);
        if (n > 1800 && n < 2100) return n;
      }
    }
  }
  return null;
}

type MarginContrast = 'thin' | 'fat' | null;
function marginContrast(
  revenue: number | null | undefined,
  profit: number | null | undefined,
  industry: string | null | undefined,
): MarginContrast {
  if (!revenue || !profit || revenue <= 0) return null;
  const margin = profit / revenue;
  const band = industryTypicalMarginBand(industry);
  if (band) {
    if (margin < band[0] * 0.7) return 'thin';
    if (margin > band[1] * 1.15) return 'fat';
    return null;
  }
  if (margin < 0.08) return 'thin';
  if (margin > 0.32) return 'fat';
  return null;
}

type TimingBand = 'near' | 'mid' | 'far' | null;
function timingBand(timeline: string | null | undefined): TimingBand {
  if (!timeline) return null;
  const t = timeline.toLowerCase();
  if (t === 'less_than_6_months' || t === '6_to_12_months') return 'near';
  if (t === '1_to_2_years') return 'mid';
  if (t === '2_plus_years') return 'far';
  // Loose fallback for free-form text
  if (/(6 ?month|12 ?month|under ?1|next ?year|1 ?year)/.test(t)) return 'near';
  if (/(2.?3|3.?5|mid|medium)/.test(t)) return 'mid';
  if (/(5\+|5 ?\+|never|not.*sell|no plans|just curious|exploring|long)/.test(t)) return 'far';
  return null;
}

interface HookInputs {
  leadId: string;
  industry?: string | null;
  timeline?: string | null;
  qualityTier?: string | null;
  revenue?: number | null;
  profit?: number | null;
  enrichmentData?: Record<string, unknown> | null;
}

function pickTopHook(input: HookInputs): { kind: HookKind; score: number; reason: string } {
  const candidates: { kind: HookKind; score: number; reason: string }[] = [];

  const founded = extractFoundedYear(input.enrichmentData);
  const cy = new Date().getFullYear();
  if (founded && cy - founded >= 15)
    candidates.push({ kind: 'tenure_signal', score: 0.92, reason: `${founded}` });
  else if (founded && cy - founded >= 10)
    candidates.push({ kind: 'tenure_signal', score: 0.78, reason: `${founded}` });

  if (industryShortLabel(input.industry))
    candidates.push({ kind: 'industry_quirk', score: 0.7, reason: 'industry' });

  const mc = marginContrast(input.revenue, input.profit, input.industry);
  if (mc === 'thin') candidates.push({ kind: 'margin_contrast', score: 0.88, reason: 'thin' });
  else if (mc === 'fat') candidates.push({ kind: 'margin_contrast', score: 0.86, reason: 'fat' });

  const tb = timingBand(input.timeline);
  if (tb === 'near') candidates.push({ kind: 'timing_alignment', score: 0.82, reason: 'near' });
  else if (tb === 'far') candidates.push({ kind: 'timing_alignment', score: 0.75, reason: 'far' });
  else if (tb === 'mid') candidates.push({ kind: 'timing_alignment', score: 0.6, reason: 'mid' });

  candidates.push({ kind: 'tier_observation', score: 0.3, reason: 'fallback' });
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

// --- Per-lead micro-variance ---
function hash32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function hashedVariant(leadId: string, slot: string, n: number): number {
  return hash32(`${leadId}:${slot}`) % n;
}
function openingSep(leadId: string): string {
  // No em-dashes or en-dashes anywhere. Comma or colon only.
  const v = hashedVariant(leadId, 'open', 3);
  return v === 1 ? ':' : ',';
}
function signoff(leadId: string, senderFirst: string): string {
  const v = hashedVariant(leadId, 'sign', 3);
  if (v === 1) return `Best,\n${senderFirst}`;
  return senderFirst;
}

// --- Intro micro-templates ---
function introBody(args: {
  hook: HookKind;
  firstName: string;
  businessName: string;
  industry: string | null | undefined;
  qualityTier: string | null | undefined;
  revenue: number | null | undefined;
  profit: number | null | undefined;
  enrichmentData: Record<string, unknown> | null | undefined;
  leadId: string;
}): string {
  const {
    hook,
    firstName,
    businessName,
    industry,
    qualityTier,
    revenue,
    profit,
    enrichmentData,
    leadId,
  } = args;

  const sep = openingSep(leadId);
  const insight = tierInsight(qualityTier);
  const revStr = fmtCurrency(revenue);
  const indLabel = industryShortLabel(industry) || (industry || '').trim() || 'your space';

  switch (hook) {
    case 'tenure_signal': {
      const founded = extractFoundedYear(enrichmentData);
      const years = founded ? new Date().getFullYear() - founded : null;
      if (founded) {
        return `${firstName}${sep} noticed ${businessName} has been around since ${founded}. ${years && years >= 20 ? `${years} years` : 'A run that long'} changes the comp set more than people realize. Buyers weight tenure heavily because it's the one variable nobody can fake.

When you're ready to look at what the market would actually pay, that history is the line that does most of the lifting.`;
      }
      return `${firstName}${sep} ${businessName} reads as a business that's been built carefully over real time. That tends to show up in the multiple in ways the topline number alone doesn't capture.`;
    }

    case 'industry_quirk':
      return `${firstName}${sep} ran through what came in on ${businessName}. In ${indLabel} at your size, the variable that almost always ends up doing the most work on the multiple isn't topline. It's ${insight}.

Most owners I see at this stage haven't started tracking it that way yet, which is the opportunity if a transition conversation is anywhere on the horizon.`;

    case 'margin_contrast': {
      if (!revenue || !profit) {
        return `${firstName}${sep} the margin profile on ${businessName} stands out. Worth a longer think than the headline number suggests.`;
      }
      const margin = (profit / revenue) * 100;
      const marginStr = `${margin.toFixed(0)}%`;
      if (margin < 10) {
        return `${firstName}${sep} the ${marginStr} profit line on ${businessName} is the part I keep coming back to. In ${indLabel}, that usually means there's real EBITDA hiding in add-backs that haven't been credited yet.

The cleanup work on that line tends to move what a buyer would pay more than topline growth would.`;
      }
      return `${firstName}${sep} the ${marginStr} margin on ${businessName} is well above where most ${indLabel} businesses your size land. That's the kind of number that gets a second read from anyone underwriting the comp set${revStr ? `, especially against ${revStr} in revenue` : ''}.

That's the angle worth leading with whenever a buyer conversation comes up.`;
    }

    case 'timing_alignment':
      return `${firstName}${sep} saw ${businessName} come through. The piece worth flagging early, ${insight}, is usually the variable that surprises owners later if it's not being tracked already.

Most of the work on it is the kind that compounds, so the sooner the better.`;

    case 'tier_observation':
    default: {
      const numberLine = revStr ? `On ${revStr} of revenue` : `On the profile that came through`;
      return `${firstName}${sep} quick read on ${businessName}. ${numberLine} puts you in a band where ${insight} tends to do most of the heavy lifting on the multiple.

Not always the topline story, but it's the one that usually plays out.`;
    }
  }
}

// --- Followup micro-templates ---
function followupBody(args: {
  hook: HookKind;
  firstName: string;
  businessName: string;
  industry: string | null | undefined;
  qualityTier: string | null | undefined;
  revenue: number | null | undefined;
  profit: number | null | undefined;
  leadId: string;
}): string {
  const { hook, firstName, businessName, industry, qualityTier, revenue, profit, leadId } = args;
  const sep = openingSep(leadId);
  const insight = tierInsight(qualityTier);
  const indLabel = industryShortLabel(industry) || 'your space';

  switch (hook) {
    case 'tenure_signal':
      return `${firstName}${sep} one more on ${businessName}. The longer the operating history, the more the conversation eventually shifts to who else inside the business carries the institutional knowledge. Most owners at your stage underestimate how much that one detail moves the read on transferability.

That's the one I'd quietly start mapping if you haven't already.`;

    case 'industry_quirk':
      return `${firstName}${sep} second pass on ${businessName}. The ${indLabel}-specific thing worth knowing: the businesses that end up with the cleanest reads later are the ones who started tracking ${insight} 12 to 18 months before any kind of transition conversation. It's the lead-time variable.

Not asking anything, just the pattern I see most.`;

    case 'margin_contrast':
      if (revenue && profit) {
        const margin = (profit / revenue) * 100;
        if (margin < 10) {
          return `${firstName}${sep} thought more about the ${businessName} margin line. The single highest-leverage move at this stage is usually a clean walk through add-backs with someone who's done it before. Owner comp, one-time items, real estate adjustments. That work routinely lifts the reported margin by 200 to 400 bps without changing anything operationally.

Just the most honest version of the answer.`;
        }
      }
      return `${firstName}${sep} one more on ${businessName}. With margins where they are, the variable that becomes most valuable to document carefully is what's actually driving them. Pricing power, mix, operating discipline. Buyers and bankers both underwrite the explanation more than the number.

Worth getting written down while it's all fresh.`;

    case 'timing_alignment':
      return `${firstName}${sep} kept thinking about the ${businessName} note. The single thing that compounds most between now and any future conversation is ${insight}. Not because it's complicated. Because it takes calendar time to build a clean record of, and there's no shortcut for that.

Felt worth writing down.`;

    case 'tier_observation':
    default:
      return `${firstName}${sep} second read on ${businessName}. The one piece I'd flag if it were my own number to manage: ${insight} is the variable that quietly moves the band the most over a 12 to 24 month window. Nothing dramatic, just the one that compounds.

That's it.`;
  }
}

// --- Subjects ---
function introSubject(
  hook: HookKind,
  businessName: string,
  industry: string | null | undefined,
): string {
  const biz = businessName || 'your business';
  switch (hook) {
    case 'tenure_signal':
      return `${biz}, the long view`;
    case 'industry_quirk': {
      const label = industryShortLabel(industry);
      return label ? `${biz}, one ${label} thing` : `${biz}, one thing`;
    }
    case 'margin_contrast':
      return `${biz} margins`;
    case 'timing_alignment':
      return `${biz}, the window`;
    case 'tier_observation':
    default:
      return `${biz}, quick read`;
  }
}

function followupSubject(hook: HookKind, businessName: string): string {
  const biz = businessName || 'your business';
  switch (hook) {
    case 'tenure_signal':
      return `${biz}, second look`;
    case 'industry_quirk':
      return `${biz}, second pass`;
    case 'margin_contrast':
      return `${biz}, one more`;
    case 'timing_alignment':
      return `${biz}, kept thinking`;
    case 'tier_observation':
    default:
      return `${biz}, second read`;
  }
}

// --- Main builder ---
function buildEmailContent(params: {
  templateKind: TemplateKind;
  leadId: string;
  firstName: string;
  businessName: string;
  senderName: string;
  revenue?: number | null;
  profit?: number | null;
  qualityTier?: string | null;
  industry?: string | null;
  timeline?: string | null;
  enrichmentData?: Record<string, unknown> | null;
}): { subject: string; htmlContent: string; textContent: string; hookKind: HookKind } {
  const {
    templateKind,
    leadId,
    firstName,
    businessName,
    senderName,
    revenue,
    profit,
    qualityTier,
    industry,
    timeline,
    enrichmentData,
  } = params;

  const safeFirst = firstName?.trim() || 'there';
  const safeBiz = businessName?.trim() || 'your business';
  const senderFirst = firstNameOnly(senderName) || senderName;

  const hook = pickTopHook({
    leadId,
    industry,
    timeline,
    qualityTier,
    revenue,
    profit,
    enrichmentData,
  });

  if (templateKind === 'followup') {
    const subject = followupSubject(hook.kind, safeBiz);
    const body = followupBody({
      hook: hook.kind,
      firstName: safeFirst,
      businessName: safeBiz,
      industry,
      qualityTier,
      revenue,
      profit,
      leadId,
    });
    const text = `${body}\n\n${signoff(leadId, senderFirst)}`;
    return {
      subject,
      textContent: text,
      htmlContent: wrapHtml(textToHtml(text)),
      hookKind: hook.kind,
    };
  }

  const subject = introSubject(hook.kind, safeBiz, industry);
  const body = introBody({
    hook: hook.kind,
    firstName: safeFirst,
    businessName: safeBiz,
    industry,
    qualityTier,
    revenue,
    profit,
    enrichmentData,
    leadId,
  });
  const text = `${body}\n\n${signoff(leadId, senderFirst)}`;
  return {
    subject,
    textContent: text,
    htmlContent: wrapHtml(textToHtml(text)),
    hookKind: hook.kind,
  };
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return corsPreflightResponse(req);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('authorization') || '';
    const internalSecret = req.headers.get('x-internal-secret') || '';
    const isServiceRole = authHeader.includes(serviceKey) || internalSecret === serviceKey;

    if (!isServiceRole) {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const auth = await requireAdmin(req, supabaseAdmin);
      if (!auth.isAdmin) {
        return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
          status: auth.authenticated ? 403 : 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = (await req.json()) as RequestBody;
    const {
      matchToolLeadId,
      leadEmail,
      leadName,
      businessName,
      templateKind = 'intro',
      senderEmail,
      senderName,
      senderTitle: _senderTitle,
      isResend,
      customSubject,
      customBodyHtml,
      customBodyText,
      revenueBucket,
      profitBucket,
      qualityTier,
      industry,
      timeline,
      enrichmentData,
    } = body;

    if (!matchToolLeadId) {
      return new Response(JSON.stringify({ error: 'Missing matchToolLeadId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Hydrate from DB if minimal payload (auto-trigger from ingest sends only the id)
    if (!leadEmail || !leadName || !businessName || enrichmentData === undefined) {
      const { data: row } = await supabase
        .from('match_tool_leads')
        .select(
          'email, full_name, business_name, revenue, profit, quality_tier, timeline, enrichment_data, excluded',
        )
        .eq('id', matchToolLeadId)
        .maybeSingle();

      const r = row as Record<string, unknown> | null;
      if (r?.excluded) {
        console.log(`[send-match-tool-lead-outreach] SKIP | quarantined lead=${matchToolLeadId}`);
        return new Response(JSON.stringify({ skipped: true, reason: 'quarantined' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
      leadEmail = leadEmail || (r?.email as string | undefined) || '';
      leadName = leadName || (r?.full_name as string | undefined) || '';
      const enrich = (r?.enrichment_data as Record<string, unknown> | null) || null;
      const enrichedName =
        enrich && typeof enrich.company_name === 'string' ? (enrich.company_name as string) : null;
      businessName = businessName || enrichedName || (r?.business_name as string | undefined) || '';
      revenueBucket = revenueBucket || (r?.revenue as string | undefined) || null;
      profitBucket = profitBucket || (r?.profit as string | undefined) || null;
      qualityTier = qualityTier || (r?.quality_tier as string | undefined) || null;
      timeline = timeline || (r?.timeline as string | undefined) || null;
      industry =
        industry ||
        (enrich && typeof enrich.industry === 'string' ? (enrich.industry as string) : null);
      enrichmentData = enrichmentData ?? enrich;
    }

    if (!isValidEmail(leadEmail)) {
      console.log(
        `[send-match-tool-lead-outreach] REJECT | invalid leadEmail="${leadEmail}" lead=${matchToolLeadId}`,
      );
      return new Response(JSON.stringify({ error: 'Invalid or junk email address', leadEmail }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const emailLc = leadEmail.toLowerCase().trim();

    console.log(
      `[send-match-tool-lead-outreach] START | lead=${matchToolLeadId} | to=${emailLc} | kind=${templateKind} | resend=${!!isResend}`,
    );

    // Suppression check
    try {
      const { data: suppressed } = await supabase
        .from('suppressed_emails')
        .select('email')
        .eq('email', emailLc)
        .maybeSingle();
      if (suppressed) {
        console.log(`[send-match-tool-lead-outreach] SKIP | suppressed=${emailLc}`);
        await supabase
          .from('match_tool_leads')
          .update({ outreach_email_status: 'suppressed' })
          .eq('id', matchToolLeadId);
        return new Response(JSON.stringify({ skipped: true, reason: 'suppressed' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    } catch (_e) {
      /* suppression table may not exist in some envs, proceed */
    }

    const firstName = (leadName || '').trim().split(/\s+/)[0] || 'there';
    const resolvedSenderName = senderName || 'Adam Haile';
    const resolvedSenderEmail = senderEmail || 'adam.haile@sourcecodeals.com';
    const resolvedBusinessName = businessName || 'your business';

    const revenueNum = bucketToRevenue(revenueBucket);
    const profitNum = bucketToProfit(profitBucket);

    let subject: string;
    let htmlContent: string;
    let textContent: string;
    let hookKind: HookKind | undefined;

    if (templateKind === 'custom' && (customBodyHtml || customBodyText)) {
      subject = customSubject || `quick note on ${resolvedBusinessName}`;
      textContent = customBodyText || '';
      htmlContent = customBodyHtml || wrapHtml(textToHtml(customBodyText || ''));
    } else {
      const generated = buildEmailContent({
        templateKind: templateKind === 'custom' ? 'intro' : templateKind,
        leadId: matchToolLeadId,
        firstName,
        businessName: resolvedBusinessName,
        senderName: resolvedSenderName,
        revenue: revenueNum,
        profit: profitNum,
        qualityTier,
        industry,
        timeline,
        enrichmentData,
      });
      subject = customSubject || generated.subject;
      htmlContent = customBodyHtml || generated.htmlContent;
      textContent = customBodyText || generated.textContent;
      hookKind = generated.hookKind;
    }

    const emailResult = await sendEmail({
      templateName: 'match_tool_lead_outreach',
      to: emailLc,
      toName: leadName || emailLc,
      subject,
      textContent,
      htmlContent,
      senderName: resolvedSenderName,
      senderEmail: resolvedSenderEmail,
      replyTo: resolvedSenderEmail,
      isTransactional: true,
      metadata: {
        matchToolLeadId,
        templateKind,
        hookKind,
        isResend: !!isResend,
        businessName: resolvedBusinessName,
      },
    });

    console.log(
      `[send-match-tool-lead-outreach] result | success=${emailResult.success} | hook=${hookKind || 'custom'} | emailId=${emailResult.emailId}`,
    );

    const correlationId = emailResult.correlationId || crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const { data: current } = await supabase
      .from('match_tool_leads')
      .select('outreach_send_count')
      .eq('id', matchToolLeadId)
      .maybeSingle();

    const newCount =
      (((current as Record<string, unknown> | null)?.outreach_send_count as number | null) ?? 0) +
      (emailResult.success ? 1 : 0);

    await supabase
      .from('match_tool_leads')
      .update({
        outreach_email_sent_at: emailResult.success ? nowIso : null,
        outreach_email_status: emailResult.success ? 'sent' : 'failed',
        outreach_sender_email: resolvedSenderEmail,
        outreach_outbound_id: emailResult.emailId || null,
        outreach_send_count: newCount,
        outreach_last_template: templateKind,
        outreach_hook_kind: hookKind || null,
      })
      .eq('id', matchToolLeadId);

    if (!emailResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: emailResult.error || 'Failed to send',
          correlationId,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailId: emailResult.emailId,
        hookKind,
        correlationId,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  } catch (err) {
    console.error('[send-match-tool-lead-outreach] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
    });
  }
});
