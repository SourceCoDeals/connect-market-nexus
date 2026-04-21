/**
 * Lead legitimacy gating for match-tool leads.
 *
 * Two checks:
 *   1. checkWebsiteReachability — DNS resolves, returns 2xx/3xx
 *   2. evaluateLeadLegitimacy   — content + scale + GPT signals
 *
 * Used by ingest-match-tool-lead, enrich-match-tool-lead, and
 * backfill-match-tool-leads-enrichment to populate `excluded` / `exclusion_reason`.
 */

import { classifyGeoTier, type GeoTier } from './geo-tiers.ts';

export interface ReachabilityResult {
  ok: boolean;
  reason?: string;
  status?: number;
}

/**
 * HEAD-fetch the URL with a hard timeout. Returns ok:false with a reason
 * suitable for `exclusion_reason` on DNS / network / 4xx-5xx failure.
 */
export async function checkWebsiteReachability(
  websiteUrl: string,
  timeoutMs = 6_000,
): Promise<ReachabilityResult> {
  let formatted = websiteUrl.trim();
  if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
    formatted = `https://${formatted}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let res: Response;
    try {
      res = await fetch(formatted, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
      });
    } catch {
      // Some servers reject HEAD — fall back to GET range
      res = await fetch(formatted, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        redirect: 'follow',
        signal: controller.signal,
      });
    }

    if (res.status >= 200 && res.status < 400) {
      return { ok: true, status: res.status };
    }
    if (res.status >= 400 && res.status < 500) {
      return {
        ok: false,
        status: res.status,
        reason: `Website returns HTTP ${res.status} (page not found or blocked)`,
      };
    }
    return {
      ok: false,
      status: res.status,
      reason: `Website returns HTTP ${res.status} (server error)`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('aborted') || msg.includes('Abort')) {
      return { ok: false, reason: 'Website did not respond within 6 seconds' };
    }
    if (
      msg.includes('ENOTFOUND') ||
      msg.includes('dns') ||
      msg.includes('getaddrinfo') ||
      msg.includes('error sending request') ||
      msg.includes('failed to lookup')
    ) {
      return { ok: false, reason: 'Website does not resolve (DNS lookup failed)' };
    }
    return { ok: false, reason: `Website unreachable: ${msg.slice(0, 120)}` };
  } finally {
    clearTimeout(timer);
  }
}

const PARKED_PHRASES = [
  'this domain is for sale',
  'buy this domain',
  'parked by',
  'domain parking',
  'domain for sale',
  'this site is under construction',
  'website coming soon',
  'page not found',
  'default page',
  'apache2 default',
  'nginx welcome',
  'index of /',
];

export interface ContentCheckResult {
  ok: boolean;
  reason?: string;
}

/** Lightweight content health check on the scraped markdown. */
export function checkScrapedContent(markdown: string | null | undefined): ContentCheckResult {
  const text = (markdown || '').trim();
  if (text.length < 200) {
    return { ok: false, reason: 'Website has no real content (under 200 chars scraped)' };
  }
  const lower = text.toLowerCase();
  // If 2+ parked-domain phrases appear AND total content is small, it's likely a parking page
  const matched = PARKED_PHRASES.filter((p) => lower.includes(p));
  if (matched.length > 0 && text.length < 800) {
    return { ok: false, reason: `Website appears to be a parked / placeholder page` };
  }
  return { ok: true };
}

/** Deal-worthy revenue/profit buckets that auto-pass the legitimacy gate. */
const SCALE_REVENUE_OK = new Set([
  '5m_10m',
  '10m_25m',
  '25m_50m',
  '50m_plus',
  '5m+',
  '10m+',
  '25m+',
  '50m+',
]);
const SCALE_PROFIT_OK = new Set(['1m_3m', '3m_5m', '5m_plus', '1m+', '3m+', '5m+']);

const TIER_1_GEO_HINTS = [
  'united states',
  'usa',
  'u.s.',
  'u.s.a',
  'america',
  'united kingdom',
  'uk ',
  ' uk',
  'britain',
  'england',
  'scotland',
  'wales',
  'canada',
  'australia',
  'new zealand',
  'ireland',
  'germany',
  'france',
  'netherlands',
  'sweden',
  'norway',
  'denmark',
  'finland',
  'switzerland',
  'austria',
  'belgium',
  'singapore',
  'japan',
];

export interface LegitimacyInput {
  websiteUrl: string;
  revenue?: string | null;
  profit?: string | null;
  enrichment?: Record<string, unknown> | null;
  markdown?: string | null;
}

export interface LegitimacyResult {
  pass: boolean;
  tier: GeoTier;
  reason?: string;
  signals: string[];
}

/**
 * Combined gate: classify geo, then for TIER_3 require any legitimacy signal.
 * TIER_1 / TIER_2 always pass (this gate doesn't quarantine them).
 *
 * Caller is still responsible for calling reachability + content checks first.
 */
export function evaluateLeadLegitimacy(input: LegitimacyInput): LegitimacyResult {
  const { websiteUrl, revenue, profit, enrichment, markdown } = input;
  const geographyText = (enrichment?.geography as string | undefined) ?? null;
  const { tier } = classifyGeoTier(websiteUrl, geographyText);

  if (tier !== 'TIER_3') {
    return { pass: true, tier, signals: [] };
  }

  const signals: string[] = [];

  // 1. Scale signal
  if (revenue && SCALE_REVENUE_OK.has(revenue)) signals.push(`revenue=${revenue}`);
  if (profit && SCALE_PROFIT_OK.has(profit)) signals.push(`profit=${profit}`);

  // 2. Content depth + extraction quality
  const md = (markdown || '').trim();
  const services = Array.isArray(enrichment?.services) ? (enrichment!.services as unknown[]) : [];
  const yearFounded = enrichment?.year_founded;
  const employeeEst = enrichment?.employee_estimate;
  if (md.length >= 800 && services.length >= 3 && (yearFounded || employeeEst)) {
    signals.push('content_depth');
  }

  // 3. Tier-1 geography mention OR primarily English B2B
  if (geographyText) {
    const lower = geographyText.toLowerCase();
    if (TIER_1_GEO_HINTS.some((hint) => lower.includes(hint))) {
      signals.push('tier1_geo_mention');
    }
  }

  // 4. Notable signals from GPT (awards, funding, press)
  const notable = Array.isArray(enrichment?.notable_signals)
    ? (enrichment!.notable_signals as unknown[])
    : [];
  if (notable.length > 0) signals.push('notable_signals');

  if (signals.length > 0) {
    return { pass: true, tier, signals };
  }

  return {
    pass: false,
    tier,
    reason: 'Risky geography with no scale, depth, or notable signals',
    signals: [],
  };
}
