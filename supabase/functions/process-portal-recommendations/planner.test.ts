/**
 * Integration-level tests for the pure `planRecommendationWrites` function
 * that sits between the Supabase client and the scoring engine in
 * process-portal-recommendations/index.ts.
 *
 * These lock in the behaviors that previously lived only inside the
 * Deno runtime and were untested:
 *   - First-time insert for a matching listing
 *   - Update when score drifts on an existing pending row
 *   - Update when match_reasons drift at the same score
 *   - No-op when nothing changed
 *   - Reap pending rec whose deal no longer matches any criterion
 *   - Reap honors status filter: non-pending rows are never reaped
 *   - Reviewed rows (approved/pushed/dismissed) are never touched
 *   - Priority tiebreaker when two criteria in the same portal score equal
 *   - Best-per-org dedup when a listing matches multiple criteria in the same portal
 *   - Sub-threshold matches (score < 30) are dropped entirely
 */
import { describe, it, expect } from 'vitest';
import {
  planRecommendationWrites,
  type PlannerListing,
  type ThesisCriteria,
  type ExistingRecommendation,
} from './scoring';

function makeCriterion(overrides: Partial<ThesisCriteria> = {}): ThesisCriteria {
  return {
    id: 'criterion-1',
    portal_org_id: 'org-a',
    industry_label: 'HVAC',
    industry_keywords: ['hvac'],
    ebitda_min: null,
    ebitda_max: null,
    revenue_min: null,
    revenue_max: null,
    employee_min: null,
    employee_max: null,
    target_states: [],
    portfolio_buyer_id: null,
    priority: 3,
    ...overrides,
  };
}

function makeListing(overrides: Partial<PlannerListing> = {}): PlannerListing {
  return {
    id: 'listing-1',
    industry: 'HVAC',
    ...overrides,
  };
}

describe('planRecommendationWrites — inserts', () => {
  it('inserts a row for a new matching (listing, org) pair', () => {
    const plan = planRecommendationWrites([makeListing()], [makeCriterion()], []);
    expect(plan.toInsert).toHaveLength(1);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toReap).toHaveLength(0);

    const row = plan.toInsert[0];
    expect(row.portal_org_id).toBe('org-a');
    expect(row.listing_id).toBe('listing-1');
    expect(row.thesis_criteria_id).toBe('criterion-1');
    expect(row.status).toBe('pending');
    expect(row.match_score).toBeGreaterThan(0);
    expect(row.match_reasons.length).toBeGreaterThan(0);
  });

  it('inserts one row per portal org for the same listing', () => {
    const plan = planRecommendationWrites(
      [makeListing()],
      [
        makeCriterion({ id: 'c-a', portal_org_id: 'org-a' }),
        makeCriterion({ id: 'c-b', portal_org_id: 'org-b' }),
      ],
      [],
    );
    expect(plan.toInsert).toHaveLength(2);
    const orgs = plan.toInsert.map((r) => r.portal_org_id).sort();
    expect(orgs).toEqual(['org-a', 'org-b']);
  });

  it('does NOT insert sub-threshold matches (score < 30)', () => {
    // A listing with only a weak industry match against an outside-target
    // state would score 40 + 5 = 45, still > 30. Make it miss industry
    // entirely so the hard gate fails and score = 0.
    const plan = planRecommendationWrites(
      [makeListing({ industry: 'Auto Dealership' })],
      [makeCriterion({ industry_keywords: ['hvac'] })],
      [],
    );
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.toReap).toHaveLength(0);
  });
});

describe('planRecommendationWrites — updates', () => {
  it('updates a pending row when the score drifts', () => {
    const existing: ExistingRecommendation = {
      id: 'rec-1',
      portal_org_id: 'org-a',
      listing_id: 'listing-1',
      match_score: 50, // old score
      match_reasons: ['HVAC match', 'National geography'],
      status: 'pending',
    };
    // Give the listing a deal_total_score bonus so the new score differs.
    const plan = planRecommendationWrites(
      [makeListing({ deal_total_score: 70 })],
      [makeCriterion()],
      [existing],
    );
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.toUpdate[0].id).toBe('rec-1');
    expect(plan.toUpdate[0].patch.match_score).toBeGreaterThan(50);
  });

  it('updates when match_reasons drift even at the same score', () => {
    // Two criteria with the same scoring profile but different labels.
    // First run picks one, second run (with updated criterion order) picks
    // the other. Score stays the same, reasons change.
    const existing: ExistingRecommendation = {
      id: 'rec-1',
      portal_org_id: 'org-a',
      listing_id: 'listing-1',
      match_score: 65,
      match_reasons: ['Commercial HVAC match', 'National geography'],
      status: 'pending',
    };
    const plan = planRecommendationWrites(
      [makeListing()],
      [makeCriterion({ industry_label: 'HVAC' })], // different label → different reasons
      [existing],
    );
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.toUpdate[0].patch.match_reasons).toContain('HVAC match');
  });

  it('no-op when score and reasons are identical', () => {
    const existing: ExistingRecommendation = {
      id: 'rec-1',
      portal_org_id: 'org-a',
      listing_id: 'listing-1',
      match_score: 65, // 40 industry + 25 national
      match_reasons: ['HVAC match', 'National geography'],
      status: 'pending',
    };
    const plan = planRecommendationWrites([makeListing()], [makeCriterion()], [existing]);
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toReap).toHaveLength(0);
  });

  it('does NOT update non-pending rows even if score would change', () => {
    // Admin already reviewed this rec — planner should leave it alone
    // regardless of current scoring.
    const existing: ExistingRecommendation = {
      id: 'rec-1',
      portal_org_id: 'org-a',
      listing_id: 'listing-1',
      match_score: 50,
      match_reasons: ['old'],
      status: 'approved',
    };
    const plan = planRecommendationWrites(
      [makeListing({ deal_total_score: 80 })],
      [makeCriterion()],
      [existing],
    );
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.toReap).toHaveLength(0);
  });
});

describe('planRecommendationWrites — reaping', () => {
  it('reaps a pending rec whose deal no longer matches any criterion', () => {
    // The listing's industry doesn't match any active criterion anymore.
    const existing: ExistingRecommendation = {
      id: 'rec-stale',
      portal_org_id: 'org-a',
      listing_id: 'listing-1',
      match_score: 70,
      match_reasons: ['HVAC match'],
      status: 'pending',
    };
    const plan = planRecommendationWrites(
      [makeListing({ industry: 'Something Unrelated' })],
      [makeCriterion()],
      [existing],
    );
    expect(plan.toReap).toEqual(['rec-stale']);
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(0);
  });

  it('does NOT reap non-pending rows', () => {
    const approved: ExistingRecommendation = {
      id: 'rec-approved',
      portal_org_id: 'org-a',
      listing_id: 'listing-1',
      match_score: 70,
      match_reasons: ['HVAC match'],
      status: 'approved',
    };
    const dismissed: ExistingRecommendation = {
      id: 'rec-dismissed',
      portal_org_id: 'org-b',
      listing_id: 'listing-1',
      match_score: 70,
      match_reasons: ['HVAC match'],
      status: 'dismissed',
    };
    const plan = planRecommendationWrites(
      [makeListing({ industry: 'Unrelated' })],
      [makeCriterion()],
      [approved, dismissed],
    );
    expect(plan.toReap).toHaveLength(0);
  });

  it('does NOT reap when the deal still matches (just a different org is dropped)', () => {
    // Two orgs exist, but the criterion on org-b was removed. org-a still matches.
    // The org-b pending rec should be reaped; the org-a one stays.
    const orgAExisting: ExistingRecommendation = {
      id: 'rec-a',
      portal_org_id: 'org-a',
      listing_id: 'listing-1',
      match_score: 65,
      match_reasons: ['HVAC match', 'National geography'],
      status: 'pending',
    };
    const orgBExisting: ExistingRecommendation = {
      id: 'rec-b',
      portal_org_id: 'org-b',
      listing_id: 'listing-1',
      match_score: 65,
      match_reasons: ['HVAC match', 'National geography'],
      status: 'pending',
    };
    const plan = planRecommendationWrites(
      [makeListing()],
      // Only org-a has an active criterion now.
      [makeCriterion({ portal_org_id: 'org-a' })],
      [orgAExisting, orgBExisting],
    );
    expect(plan.toReap).toEqual(['rec-b']);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toInsert).toHaveLength(0);
  });
});

describe('planRecommendationWrites — best-per-org dedup + priority tiebreaker', () => {
  it('when a listing matches multiple criteria in one org, keeps only the best', () => {
    const plan = planRecommendationWrites(
      [makeListing({ industry: 'HVAC', ebitda: 2_000_000 })],
      [
        // Priority 2, EBITDA in range → 40 + 25 + 25 = 90
        makeCriterion({
          id: 'c-strong',
          industry_keywords: ['hvac'],
          ebitda_min: 1_000_000,
          ebitda_max: 5_000_000,
          priority: 2,
        }),
        // Priority 1, no size match → 40 + 25 = 65
        makeCriterion({
          id: 'c-weak',
          industry_keywords: ['hvac'],
          priority: 1,
        }),
      ],
      [],
    );
    expect(plan.toInsert).toHaveLength(1);
    // Should pick the higher-scoring one.
    expect(plan.toInsert[0].thesis_criteria_id).toBe('c-strong');
  });

  it('uses priority as tiebreaker when scores are equal (lower priority wins)', () => {
    const plan = planRecommendationWrites(
      [makeListing()],
      [
        // Two criteria that produce the identical score. The one with the
        // lower (= higher-priority) number should win.
        makeCriterion({ id: 'c-high-prio', priority: 1 }),
        makeCriterion({ id: 'c-low-prio', priority: 5 }),
      ],
      [],
    );
    expect(plan.toInsert).toHaveLength(1);
    expect(plan.toInsert[0].thesis_criteria_id).toBe('c-high-prio');
  });
});

describe('planRecommendationWrites — custom minScore threshold', () => {
  it('raising minScore drops moderate matches', () => {
    // A match scoring 65 (40 industry + 25 national, no size range).
    // With the default minScore=30 it's kept; with minScore=70 it's dropped.
    const kept = planRecommendationWrites([makeListing()], [makeCriterion()], [], 30);
    expect(kept.toInsert).toHaveLength(1);

    const dropped = planRecommendationWrites([makeListing()], [makeCriterion()], [], 70);
    expect(dropped.toInsert).toHaveLength(0);
  });
});
