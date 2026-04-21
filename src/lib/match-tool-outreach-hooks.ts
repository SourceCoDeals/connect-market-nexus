/**
 * Hook-routing system for match-tool lead outreach.
 *
 * Mirrors `valuation-lead-outreach-hooks.ts` but for the match-tool data shape:
 * bucketed revenue/profit (no valuation band). The `spread_anomaly` hook is
 * dropped (no valuation spread to read), and `margin_contrast` reads margin
 * off bucket midpoints supplied by the caller.
 *
 * Keep in sync with `supabase/functions/send-match-tool-lead-outreach/index.ts`.
 *
 * Copy rule: never use em-dashes or en-dashes anywhere in generated copy.
 */

export type HookKind =
  | 'tenure_signal'
  | 'industry_quirk'
  | 'margin_contrast'
  | 'timing_alignment'
  | 'tier_observation';

export interface HookCandidate {
  kind: HookKind;
  score: number;
  reason: string;
}

export interface HookInputs {
  leadId: string;
  industry?: string | null;
  timeline?: string | null;
  qualityTier?: string | null;
  revenue?: number | null;
  profit?: number | null;
  enrichmentData?: Record<string, unknown> | null;
}

// --- Bucket -> midpoint helpers (mirror edge function) ---
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

export function bucketToRevenue(b?: string | null): number | null {
  if (!b) return null;
  return REVENUE_MIDPOINTS[b] ?? null;
}
export function bucketToProfit(b?: string | null): number | null {
  if (!b) return null;
  return PROFIT_MIDPOINTS[b] ?? null;
}

// --- Founded year extraction ---
export function extractFoundedYear(
  data: Record<string, unknown> | null | undefined,
): number | null {
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
  try {
    const blob = JSON.stringify(data).toLowerCase();
    const m = blob.match(/(?:since|founded(?:\s+in)?|established(?:\s+in)?)\s+((?:18|19|20)\d{2})/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > 1800 && n < 2100) return n;
    }
  } catch {
    /* ignore */
  }
  return null;
}

// --- Industry helpers ---
export function industryShortLabel(industry: string | null | undefined): string | null {
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

export type MarginContrast = 'thin' | 'fat' | null;
export function marginContrast(
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

export type TimingBand = 'near' | 'mid' | 'far' | null;
export function timingBand(timeline: string | null | undefined): TimingBand {
  if (!timeline) return null;
  const t = timeline.toLowerCase();
  if (t === 'less_than_6_months' || t === '6_to_12_months') return 'near';
  if (t === '1_to_2_years') return 'mid';
  if (t === '2_plus_years') return 'far';
  if (/(6 ?month|12 ?month|under ?1|next ?year|1 ?year)/.test(t)) return 'near';
  if (/(2.?3|3.?5|mid|medium)/.test(t)) return 'mid';
  if (/(5\+|5 ?\+|never|not.*sell|no plans|just curious|exploring|long)/.test(t)) return 'far';
  return null;
}

// --- Hook ranker ---
export function rankHooks(input: HookInputs): HookCandidate[] {
  const candidates: HookCandidate[] = [];

  const founded = extractFoundedYear(input.enrichmentData);
  const cy = new Date().getFullYear();
  if (founded && cy - founded >= 15)
    candidates.push({ kind: 'tenure_signal', score: 0.92, reason: `founded ${founded}` });
  else if (founded && cy - founded >= 10)
    candidates.push({ kind: 'tenure_signal', score: 0.78, reason: `founded ${founded}` });

  if (industryShortLabel(input.industry))
    candidates.push({ kind: 'industry_quirk', score: 0.7, reason: `industry: ${input.industry}` });

  const mc = marginContrast(input.revenue, input.profit, input.industry);
  if (mc === 'thin')
    candidates.push({ kind: 'margin_contrast', score: 0.88, reason: 'thin margin' });
  else if (mc === 'fat')
    candidates.push({ kind: 'margin_contrast', score: 0.86, reason: 'fat margin' });

  const tb = timingBand(input.timeline);
  if (tb === 'near')
    candidates.push({ kind: 'timing_alignment', score: 0.82, reason: 'near term' });
  else if (tb === 'far')
    candidates.push({ kind: 'timing_alignment', score: 0.75, reason: 'far term' });
  else if (tb === 'mid')
    candidates.push({ kind: 'timing_alignment', score: 0.6, reason: 'mid term' });

  candidates.push({ kind: 'tier_observation', score: 0.3, reason: 'fallback' });
  return candidates.sort((a, b) => b.score - a.score);
}

export function pickTopHook(input: HookInputs): HookCandidate {
  return rankHooks(input)[0];
}

// --- Stable hash for per-lead micro-variance ---
function hash32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function hashedVariant(leadId: string, slot: string, n: number): number {
  return hash32(`${leadId}:${slot}`) % n;
}
