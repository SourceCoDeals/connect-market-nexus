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
  /** Negative-match keywords — any match forces score=0 regardless of industry hit. */
  excluded_keywords?: string[];
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

  // Primary industry signal: structured taxonomy fields that SourceCo curates.
  // These are short, canonical labels ("HVAC", "Auto Body Repair") so a keyword
  // match here is high confidence.
  const primaryText = [
    listing.industry,
    listing.category,
    ...(Array.isArray(listing.categories) ? listing.categories : []),
    ...(Array.isArray(listing.services) ? listing.services : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Secondary signal: long-form prose (executive summary, service mix).
  // Broad keywords like "mechanical" or "cooling" trigger false positives here
  // — an auto body shop's summary says "mechanical repair" and "cooling
  // systems", which would wrongly match an HVAC thesis. We only accept a
  // secondary match when the primary industry field is MISSING; when a primary
  // industry is present but doesn't match, summary matches are ignored.
  const secondaryText = [listing.service_mix, listing.executive_summary]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const primaryMatch = criteria.industry_keywords.some((kw) => keywordMatches(primaryText, kw));
  const hasPrimaryIndustry =
    !!(listing.industry && String(listing.industry).trim()) ||
    !!(listing.category && String(listing.category).trim()) ||
    (Array.isArray(listing.categories) && listing.categories.length > 0);
  const secondaryMatch =
    !primaryMatch &&
    !hasPrimaryIndustry &&
    criteria.industry_keywords.some((kw) => keywordMatches(secondaryText, kw));

  if (!primaryMatch && !secondaryMatch) {
    return { score: 0, reasons: [], category: 'weak' };
  }

  // ── EXCLUDED KEYWORDS (hard negative gate) ──
  // If ANY excluded keyword appears in primary or secondary text, bail out.
  // Lets a reviewer say "HVAC thesis — but never roll-up a listing that
  // mentions 'auto body'" to kill the class of Alpine-style false positives.
  const excluded = criteria.excluded_keywords ?? [];
  if (excluded.length > 0) {
    const haystack = `${primaryText} ${secondaryText}`;
    const hit = excluded.find((kw) => keywordMatches(haystack, kw));
    if (hit) {
      return { score: 0, reasons: [`excluded keyword "${hit}"`], category: 'weak' };
    }
  }

  if (primaryMatch) {
    score += 40;
    reasons.push(`[primary] ${criteria.industry_label} match`);
  } else {
    // Weaker evidence — listing has no structured industry, so we fell back to
    // prose. Score lower and flag the reviewer so they know to verify.
    score += 20;
    reasons.push(`[secondary] ${criteria.industry_label} keyword in summary (weak)`);
  }

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

// ─────────────────────────────────────────────────────────────────────
// PLANNER — pure function that computes what writes should happen for
// a batch of listings given existing recommendations and active criteria.
// Separated from the runtime orchestration in index.ts so it can be
// unit tested without a real Supabase client.
// ─────────────────────────────────────────────────────────────────────

export interface PlannerListing {
  id: string;
  industry?: unknown;
  category?: unknown;
  categories?: unknown;
  services?: unknown;
  service_mix?: unknown;
  executive_summary?: unknown;
  address_state?: unknown;
  ebitda?: unknown;
  revenue?: unknown;
  linkedin_employee_count?: unknown;
  deal_total_score?: unknown;
}

export interface ExistingRecommendation {
  id: string;
  portal_org_id: string;
  listing_id: string;
  match_score: number;
  match_reasons: string[] | null;
  status: string;
}

export interface PlanInsert {
  portal_org_id: string;
  listing_id: string;
  thesis_criteria_id: string;
  portfolio_buyer_id: string | null;
  portfolio_company_name: string | null;
  match_score: number;
  match_reasons: string[];
  match_category: ScoreResult['category'];
  status: 'pending';
}

export interface PlanUpdate {
  id: string;
  patch: {
    match_score: number;
    match_reasons: string[];
    match_category: ScoreResult['category'];
    thesis_criteria_id: string;
    portfolio_buyer_id: string | null;
    portfolio_company_name: string | null;
  };
}

export interface PlanResult {
  toInsert: PlanInsert[];
  toUpdate: PlanUpdate[];
  /** Recommendation IDs whose deal no longer matches any criterion. */
  toReap: string[];
}

/**
 * Given a batch of listings, all active criteria, and the existing rows
 * in `portal_deal_recommendations` for those listings, compute what should
 * be inserted, updated, and reaped.
 *
 * The function is pure — no side effects, no async, no network calls.
 */
export function planRecommendationWrites(
  listings: PlannerListing[],
  criteria: ThesisCriteria[],
  existing: ExistingRecommendation[],
  minScore = 30,
): PlanResult {
  const toInsert: PlanInsert[] = [];
  const toUpdate: PlanUpdate[] = [];
  const toReap: string[] = [];

  // Index existing rows by (org, listing) for O(1) lookup.
  const existingMap = new Map<string, ExistingRecommendation>();
  for (const row of existing) {
    existingMap.set(`${row.portal_org_id}|${row.listing_id}`, row);
  }

  for (const listing of listings) {
    // Compute the best-scoring criterion per portal org for THIS listing.
    const bestByOrg = new Map<
      string,
      {
        criteria: ThesisCriteria;
        score: number;
        reasons: string[];
        category: ScoreResult['category'];
      }
    >();

    for (const criterion of criteria) {
      const result = scoreListingAgainstCriteria(
        listing as unknown as Record<string, unknown>,
        criterion,
      );

      if (result.score < minScore) continue;

      const best = bestByOrg.get(criterion.portal_org_id);
      if (
        !best ||
        result.score > best.score ||
        // Priority tiebreaker: smaller priority wins when scores are equal.
        (result.score === best.score && criterion.priority < best.criteria.priority)
      ) {
        bestByOrg.set(criterion.portal_org_id, { criteria: criterion, ...result });
      }
    }

    // Reap stale rows: an existing pending rec whose org no longer has a match.
    for (const row of existing) {
      if (row.listing_id !== listing.id) continue;
      if (row.status !== 'pending') continue;
      if (!bestByOrg.has(row.portal_org_id)) {
        toReap.push(row.id);
      }
    }

    // Decide inserts / updates for the winning matches.
    for (const [orgId, match] of bestByOrg) {
      const key = `${orgId}|${listing.id}`;
      const existingRow = existingMap.get(key);

      if (!existingRow) {
        toInsert.push({
          portal_org_id: orgId,
          listing_id: listing.id,
          thesis_criteria_id: match.criteria.id,
          portfolio_buyer_id: match.criteria.portfolio_buyer_id,
          portfolio_company_name: match.criteria.portfolio_company_name || null,
          match_score: match.score,
          match_reasons: match.reasons,
          match_category: match.category,
          status: 'pending',
        });
      } else if (
        existingRow.status === 'pending' &&
        (existingRow.match_score !== match.score ||
          !reasonsEqual(existingRow.match_reasons, match.reasons))
      ) {
        toUpdate.push({
          id: existingRow.id,
          patch: {
            match_score: match.score,
            match_reasons: match.reasons,
            match_category: match.category,
            thesis_criteria_id: match.criteria.id,
            portfolio_buyer_id: match.criteria.portfolio_buyer_id,
            portfolio_company_name: match.criteria.portfolio_company_name || null,
          },
        });
      }
    }
  }

  return { toInsert, toUpdate, toReap };
}
