/**
 * Pure scoring engine for portal deal recommendations.
 *
 * This module intentionally has no Deno / Supabase / network dependencies
 * so it can be imported by both the edge function (Deno) and by vitest
 * tests running under Node.
 */

export interface ThesisCriteria {
  id: string;
  portal_org_id: string;
  industry_label: string;
  industry_keywords: string[];
  ebitda_min: number | null;
  ebitda_max: number | null;
  revenue_min: number | null;
  revenue_max: number | null;
  employee_min: number | null;
  employee_max: number | null;
  target_states: string[];
  portfolio_buyer_id: string | null;
  portfolio_company_name?: string;
  priority: number;
}

export interface ScoreResult {
  score: number;
  reasons: string[];
  category: 'strong' | 'moderate' | 'weak';
}

/** Escape a literal string for use in a RegExp. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whole-word (or multi-word phrase) keyword match.
 *
 * Uses \b word boundaries so "auto" does NOT match "automation" or
 * "automotive". Phrases with internal whitespace still work because \b
 * anchors the match at the first and last characters of the keyword,
 * not across its internal whitespace.
 */
export function keywordMatches(text: string, keyword: string): boolean {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return false;
  const re = new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i');
  return re.test(text);
}

/**
 * Shallow-compare two arrays of strings for equality (order-independent).
 * Used to decide if an existing pending row needs its match_reasons refreshed
 * even when the score is unchanged.
 */
export function reasonsEqual(a: string[] | null | undefined, b: string[]): boolean {
  if (!a || a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
  return true;
}

export function scoreListingAgainstCriteria(
  listing: Record<string, unknown>,
  criteria: ThesisCriteria,
): ScoreResult {
  const reasons: string[] = [];
  let score = 0;

  // ── INDUSTRY MATCH (0-40, hard gate) ──
  if (!criteria.industry_keywords || criteria.industry_keywords.length === 0) {
    return { score: 0, reasons: [], category: 'weak' };
  }

  const listingText = [
    listing.industry,
    listing.category,
    ...(Array.isArray(listing.categories) ? listing.categories : []),
    ...(Array.isArray(listing.services) ? listing.services : []),
    listing.service_mix,
    listing.executive_summary,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const industryMatch = criteria.industry_keywords.some((kw) => keywordMatches(listingText, kw));

  if (!industryMatch) {
    return { score: 0, reasons: [], category: 'weak' };
  }

  score += 40;
  reasons.push(`${criteria.industry_label} match`);

  // ── GEOGRAPHY MATCH (0-25) ──
  const targetStates = criteria.target_states || [];
  const listingState = String(listing.address_state || '')
    .toUpperCase()
    .trim();

  if (targetStates.length === 0) {
    score += 25;
    reasons.push('National geography');
  } else if (listingState && targetStates.some((s) => s.toUpperCase() === listingState)) {
    score += 25;
    reasons.push(`${listingState} geography match`);
  } else if (listingState) {
    score += 5;
    reasons.push(`${listingState} outside target states`);
  }

  // ── SIZE MATCH (0-25) ──
  // Use `!= null` (not truthiness) so ebitda_min=0 is NOT treated as absent.
  const ebitda = Number(listing.ebitda) || 0;
  const revenue = Number(listing.revenue) || 0;
  const hasEbitdaRange = criteria.ebitda_min != null || criteria.ebitda_max != null;
  const hasRevenueRange = criteria.revenue_min != null || criteria.revenue_max != null;
  const hasEmployeeRange = criteria.employee_min != null || criteria.employee_max != null;

  if (ebitda > 0 && hasEbitdaRange) {
    const inRange =
      (criteria.ebitda_min == null || ebitda >= criteria.ebitda_min) &&
      (criteria.ebitda_max == null || ebitda <= criteria.ebitda_max);
    if (inRange) {
      score += 25;
      reasons.push(`EBITDA $${(ebitda / 1_000_000).toFixed(1)}M in range`);
    } else {
      score += 5;
      reasons.push(`EBITDA $${(ebitda / 1_000_000).toFixed(1)}M outside range`);
    }
  } else if (revenue > 0 && hasRevenueRange) {
    const inRange =
      (criteria.revenue_min == null || revenue >= criteria.revenue_min) &&
      (criteria.revenue_max == null || revenue <= criteria.revenue_max);
    if (inRange) {
      score += 20;
      reasons.push(`Revenue $${(revenue / 1_000_000).toFixed(1)}M in range`);
    } else {
      score += 5;
      reasons.push(`Revenue outside range`);
    }
  } else {
    const emp = Number(listing.linkedin_employee_count) || 0;
    if (emp > 0 && hasEmployeeRange) {
      const inRange =
        (criteria.employee_min == null || emp >= criteria.employee_min) &&
        (criteria.employee_max == null || emp <= criteria.employee_max);
      if (inRange) {
        score += 15;
        reasons.push(`${emp} employees (proxy, in range)`);
      } else {
        score += 3;
        reasons.push(`${emp} employees (proxy, outside range)`);
      }
    }
  }

  // ── QUALITY BONUS (0-10) ──
  const dealScore = Number(listing.deal_total_score) || 0;
  if (dealScore >= 60) {
    score += 10;
    reasons.push('High quality score');
  } else if (dealScore >= 40) {
    score += 5;
    reasons.push('Moderate quality score');
  }

  const category: ScoreResult['category'] =
    score >= 70 ? 'strong' : score >= 45 ? 'moderate' : 'weak';
  return { score, reasons, category };
}
