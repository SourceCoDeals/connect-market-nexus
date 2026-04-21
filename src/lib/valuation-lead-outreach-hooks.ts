/**
 * Hook-routing system for valuation lead outreach.
 *
 * The premise: a real analyst writing a one-off note to an owner picks ONE
 * thing that stood out about that specific lead and writes to it. Different
 * lead, different opening sentence, different cadence, different signoff.
 *
 * `rankHooks(lead)` scores 6 candidate angles against the lead's actual data.
 * `pickTopHook(lead)` returns the highest-scoring one (deterministic, so the
 * same lead always picks the same hook and previews are reproducible).
 *
 * The chosen hook routes to a hook-specific micro-template in
 * `valuation-lead-outreach-template.ts`. Each micro-template is 2 to 4
 * sentences with a distinct cadence and a distinct signoff rhythm.
 *
 * Tiny per-lead variance (opening punctuation, signoff style, mid-sentence
 * connector) is hashed off `leadId` so two leads on the same hook still feel
 * subtly different, while the same lead always renders the same email.
 *
 * Copy rule: never use em-dashes or en-dashes anywhere in generated copy.
 */

export type HookKind =
  | 'spread_anomaly'
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
  exitTiming?: string | null;
  qualityTier?: string | null;
  revenue?: number | null;
  ebitda?: number | null;
  valuationLow?: number | null;
  valuationMid?: number | null;
  valuationHigh?: number | null;
  websiteEnrichmentData?: Record<string, unknown> | null;
}

// --- Founded year extraction (best-effort) ---
export function extractFoundedYear(
  data: Record<string, unknown> | null | undefined,
): number | null {
  if (!data || typeof data !== 'object') return null;
  // Try common shapes
  const candidates: unknown[] = [
    (data as Record<string, unknown>).founded_year,
    (data as Record<string, unknown>).foundedYear,
    (data as Record<string, unknown>).year_founded,
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
  // Last-ditch: scan stringified blob for "since YYYY" / "founded in YYYY"
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

// --- Industry typical EBITDA margin band (very rough, deterministic) ---
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

// --- industryShortLabel , for subjects ("one HVAC thing") ---
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

// --- Spread band ---
export type SpreadBand = 'tight' | 'typical' | 'wide' | null;
export function spreadBand(
  low: number | null | undefined,
  high: number | null | undefined,
): SpreadBand {
  if (!low || !high || low <= 0 || high <= 0 || high < low) return null;
  const ratio = (high - low) / low;
  if (ratio < 0.2) return 'tight';
  if (ratio > 0.55) return 'wide';
  return 'typical';
}

// --- Margin band classification ---
export type MarginContrast = 'thin' | 'fat' | null;
export function marginContrast(
  revenue: number | null | undefined,
  ebitda: number | null | undefined,
  industry: string | null | undefined,
): MarginContrast {
  if (!revenue || !ebitda || revenue <= 0) return null;
  const margin = ebitda / revenue;
  const band = industryTypicalMarginBand(industry);
  if (band) {
    if (margin < band[0] * 0.7) return 'thin';
    if (margin > band[1] * 1.15) return 'fat';
    return null;
  }
  // Generic fallback
  if (margin < 0.08) return 'thin';
  if (margin > 0.32) return 'fat';
  return null;
}

// --- Timing classification ---
export type TimingBand = 'near' | 'mid' | 'far' | null;
export function timingBand(exitTiming: string | null | undefined): TimingBand {
  if (!exitTiming) return null;
  const t = exitTiming.toLowerCase();
  if (/(1.?2|18 ?month|next ?year|under ?2|short)/.test(t)) return 'near';
  if (/(2.?3|3.?5|mid|medium)/.test(t)) return 'mid';
  if (/(5\+|5 ?\+|5 ?years|never|not.*sell|no plans|just curious|exploring|long)/.test(t))
    return 'far';
  return null;
}

// --- Hook ranker ---
export function rankHooks(input: HookInputs): HookCandidate[] {
  const candidates: HookCandidate[] = [];

  // 1. spread_anomaly
  const sb = spreadBand(input.valuationLow, input.valuationHigh);
  if (sb === 'tight')
    candidates.push({ kind: 'spread_anomaly', score: 0.9, reason: 'tight spread' });
  else if (sb === 'wide')
    candidates.push({ kind: 'spread_anomaly', score: 0.85, reason: 'wide spread' });
  else if (sb === 'typical')
    candidates.push({ kind: 'spread_anomaly', score: 0.4, reason: 'typical spread' });

  // 2. tenure_signal
  const founded = extractFoundedYear(input.websiteEnrichmentData);
  const currentYear = new Date().getFullYear();
  if (founded && currentYear - founded >= 15)
    candidates.push({ kind: 'tenure_signal', score: 0.92, reason: `founded ${founded}` });
  else if (founded && currentYear - founded >= 10)
    candidates.push({ kind: 'tenure_signal', score: 0.78, reason: `founded ${founded}` });

  // 3. industry_quirk
  if (industryShortLabel(input.industry))
    candidates.push({
      kind: 'industry_quirk',
      score: 0.7,
      reason: `known industry: ${input.industry}`,
    });

  // 4. margin_contrast
  const mc = marginContrast(input.revenue, input.ebitda, input.industry);
  if (mc === 'thin')
    candidates.push({ kind: 'margin_contrast', score: 0.88, reason: 'thin margin vs industry' });
  else if (mc === 'fat')
    candidates.push({ kind: 'margin_contrast', score: 0.86, reason: 'fat margin vs industry' });

  // 5. timing_alignment
  const tb = timingBand(input.exitTiming);
  if (tb === 'near')
    candidates.push({ kind: 'timing_alignment', score: 0.82, reason: '1 to 2 year window' });
  else if (tb === 'far')
    candidates.push({ kind: 'timing_alignment', score: 0.75, reason: '5+ year window' });
  else if (tb === 'mid')
    candidates.push({ kind: 'timing_alignment', score: 0.6, reason: '2 to 3 year window' });

  // 6. tier_observation , always-present floor
  candidates.push({ kind: 'tier_observation', score: 0.3, reason: 'fallback' });

  return candidates.sort((a, b) => b.score - a.score);
}

export function pickTopHook(input: HookInputs): HookCandidate {
  const ranked = rankHooks(input);
  return ranked[0];
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
