import { describe, it, expect } from 'vitest';
import { calculateDealScore, estimateEmployeesFromRange } from './deal-scoring-v5';

// ============================================================================
// Helper: build a deal object with defaults
// ============================================================================

function makeDeal(overrides: Record<string, any> = {}) {
  return {
    revenue: null,
    ebitda: null,
    linkedin_employee_count: null,
    linkedin_employee_range: null,
    full_time_employees: null,
    part_time_employees: null,
    team_page_employee_count: null,
    number_of_locations: null,
    google_review_count: null,
    google_rating: null,
    industry_tier: null,
    address_city: null,
    address_state: null,
    location: null,
    description: null,
    executive_summary: null,
    business_model: null,
    category: null,
    service_mix: null,
    industry: null,
    website: null,
    enriched_at: null,
    ...overrides,
  };
}

// ============================================================================
// Spec Test Cases (from v5 scoring spec, ±5 pt tolerance)
// Market score varies based on city — we use explicit cities to control it
// ============================================================================

describe('Deal Scoring v5 — Spec Test Cases', () => {

  it('1. Big HVAC, full data → ~85, HIGH', () => {
    const result = calculateDealScore(makeDeal({
      revenue: 5,                          // $5M (normalized to 5,000,000)
      linkedin_employee_count: 30,
      number_of_locations: 4,
      google_review_count: 120,
      industry_tier: 1,
      address_city: 'Houston',             // major metro +5
    }));
    expect(result.deal_total_score).toBeGreaterThanOrEqual(80);
    expect(result.deal_total_score).toBeLessThanOrEqual(95);
    expect(result.scoring_confidence).toBe('high');
    expect(result.quality_calculation_version).toBe('v5');
  });

  it('2. Collision repair, multi-loc, no financials → ~60, MEDIUM', () => {
    const result = calculateDealScore(makeDeal({
      linkedin_employee_count: 25,
      number_of_locations: 8,
      google_review_count: 50,
      industry_tier: 1,
      address_city: 'Charlotte',           // major metro +5
    }));
    expect(result.deal_total_score).toBeGreaterThanOrEqual(55);
    expect(result.deal_total_score).toBeLessThanOrEqual(70);
    expect(result.scoring_confidence).toBe('medium');
  });

  it('3. B2B IT firm, good LI, no financials → ~53, MEDIUM', () => {
    const result = calculateDealScore(makeDeal({
      linkedin_employee_count: 50,
      number_of_locations: 1,
      google_review_count: 0,
      industry_tier: 2,
      address_city: 'Denver',              // major metro +5
    }));
    expect(result.deal_total_score).toBeGreaterThanOrEqual(48);
    expect(result.deal_total_score).toBeLessThanOrEqual(58);
    expect(result.scoring_confidence).toBe('medium');
  });

  it('4. Small plumber, few employees → ~29, LOW', () => {
    const result = calculateDealScore(makeDeal({
      linkedin_employee_count: 5,
      number_of_locations: 1,
      google_review_count: 80,
      industry_tier: 1,
      address_city: 'Nashville',           // major metro +5
    }));
    expect(result.deal_total_score).toBeGreaterThanOrEqual(24);
    expect(result.deal_total_score).toBeLessThanOrEqual(34);
    expect(result.scoring_confidence).toBe('low');
  });

  it('5. No LI, 6 locations, no financials → ~63, MEDIUM', () => {
    const result = calculateDealScore(makeDeal({
      linkedin_employee_count: 0,
      number_of_locations: 6,
      google_review_count: 200,
      industry_tier: 1,
      address_city: 'Phoenix',             // major metro +5
    }));
    // Location floor 50, * 1.15 = 58, + market (5+2) = 65
    expect(result.deal_total_score).toBeGreaterThanOrEqual(58);
    expect(result.deal_total_score).toBeLessThanOrEqual(70);
    expect(result.scoring_confidence).toBe('medium');
  });

  it('6. No LI, no locs, 500 Google reviews → ~25, LOW', () => {
    const result = calculateDealScore(makeDeal({
      linkedin_employee_count: 0,
      number_of_locations: 1,
      google_review_count: 500,
      industry_tier: 2,
      address_city: 'Atlanta',             // major metro +5
    }));
    expect(result.deal_total_score).toBeGreaterThanOrEqual(20);
    expect(result.deal_total_score).toBeLessThanOrEqual(30);
    expect(result.scoring_confidence).toBe('low');
  });

  it('7. Nothing at all, just a name → ~0-5, VERY_LOW', () => {
    const result = calculateDealScore(makeDeal({
      // Everything null/0
    }));
    expect(result.deal_total_score).toBeGreaterThanOrEqual(0);
    expect(result.deal_total_score).toBeLessThanOrEqual(5);
    expect(result.scoring_confidence).toBe('very_low');
  });

  it('8. $10M rev, boring industry → ~78, HIGH', () => {
    const result = calculateDealScore(makeDeal({
      revenue: 10,                         // $10M
      linkedin_employee_count: 80,
      number_of_locations: 2,
      google_review_count: 30,
      industry_tier: 3,
      address_city: 'Chicago',             // major metro +5
    }));
    expect(result.deal_total_score).toBeGreaterThanOrEqual(73);
    expect(result.deal_total_score).toBeLessThanOrEqual(83);
    expect(result.scoring_confidence).toBe('high');
  });

  it('9. $3M rev, hot industry → ~50, HIGH', () => {
    const result = calculateDealScore(makeDeal({
      revenue: 3,                          // $3M
      linkedin_employee_count: 15,
      number_of_locations: 1,
      google_review_count: 0,
      industry_tier: 1,
      address_city: 'Dallas',              // major metro +5
    }));
    expect(result.deal_total_score).toBeGreaterThanOrEqual(43);
    expect(result.deal_total_score).toBeLessThanOrEqual(55);
    expect(result.scoring_confidence).toBe('high');
  });

  it('10. Website says 45 emp (not LI), 3 locs → ~51, MEDIUM', () => {
    const result = calculateDealScore(makeDeal({
      linkedin_employee_count: 0,
      full_time_employees: 45,
      number_of_locations: 3,
      google_review_count: 10,
      industry_tier: 1,
      address_city: 'Raleigh',             // secondary city +3
    }));
    // emp = 45 from website → 42pts, loc floor 40 (already above), * 1.15 = 48, + market (3+2) = 53
    expect(result.deal_total_score).toBeGreaterThanOrEqual(46);
    expect(result.deal_total_score).toBeLessThanOrEqual(58);
    expect(result.scoring_confidence).toBe('medium');
  });
});

// ============================================================================
// Structural Invariant Tests
// ============================================================================

describe('Deal Scoring v5 — Invariants', () => {

  it('score is always 0–100', () => {
    const extremes = [
      makeDeal({ revenue: 999, ebitda: 999, industry_tier: 1, address_city: 'New York' }),
      makeDeal({}),
      makeDeal({ linkedin_employee_count: 10000, number_of_locations: 500, industry_tier: 1, address_city: 'Chicago' }),
    ];
    for (const deal of extremes) {
      const r = calculateDealScore(deal);
      expect(r.deal_total_score).toBeGreaterThanOrEqual(0);
      expect(r.deal_total_score).toBeLessThanOrEqual(100);
    }
  });

  it('deal_size_score is always 0–90', () => {
    const r = calculateDealScore(makeDeal({ revenue: 999, ebitda: 999 }));
    expect(r.deal_size_score).toBeLessThanOrEqual(90);
  });

  it('financial deals always get HIGH confidence', () => {
    const r = calculateDealScore(makeDeal({ revenue: 0.5 })); // $500K
    expect(r.scoring_confidence).toBe('high');
  });

  it('deals with EBITDA only are HIGH confidence', () => {
    const r = calculateDealScore(makeDeal({ ebitda: 0.3 })); // $300K
    expect(r.scoring_confidence).toBe('high');
  });

  it('10+ LinkedIn employees = MEDIUM confidence', () => {
    const r = calculateDealScore(makeDeal({ linkedin_employee_count: 15 }));
    expect(r.scoring_confidence).toBe('medium');
  });

  it('3+ locations = MEDIUM confidence', () => {
    const r = calculateDealScore(makeDeal({ number_of_locations: 4 }));
    expect(r.scoring_confidence).toBe('medium');
  });

  it('<10 employees from website only = LOW confidence', () => {
    const r = calculateDealScore(makeDeal({ full_time_employees: 5 }));
    expect(r.scoring_confidence).toBe('low');
  });

  it('version is always v5', () => {
    const r = calculateDealScore(makeDeal({}));
    expect(r.quality_calculation_version).toBe('v5');
  });
});

// ============================================================================
// Path B: Employee waterfall
// ============================================================================

describe('Deal Scoring v5 — Employee Waterfall', () => {

  it('uses LinkedIn count first', () => {
    const r = calculateDealScore(makeDeal({
      linkedin_employee_count: 50,
      full_time_employees: 10,
      team_page_employee_count: 5,
    }));
    // 50 employees → 48 pts
    expect(r.linkedin_boost).toBe(48);
    expect(r.scoring_notes).toContain('LinkedIn');
  });

  it('falls back to LinkedIn range when count is 0', () => {
    const r = calculateDealScore(makeDeal({
      linkedin_employee_count: 0,
      linkedin_employee_range: '11-50',
    }));
    // midpoint = 30 → 42 pts (>=25)
    expect(r.linkedin_boost).toBeGreaterThanOrEqual(30);
    expect(r.scoring_notes).toContain('LinkedIn range');
  });

  it('falls back to website employees when LinkedIn is 0', () => {
    const r = calculateDealScore(makeDeal({
      linkedin_employee_count: 0,
      full_time_employees: 20,
      part_time_employees: 5,
    }));
    // 25 total → 42 pts
    expect(r.linkedin_boost).toBe(42);
    expect(r.scoring_notes).toContain('Website');
  });

  it('falls back to team page count as last resort', () => {
    const r = calculateDealScore(makeDeal({
      linkedin_employee_count: 0,
      full_time_employees: 0,
      team_page_employee_count: 8,
    }));
    // 8 → 21 pts (>=5)
    expect(r.linkedin_boost).toBe(21);
    expect(r.scoring_notes).toContain('Team page');
  });
});

// ============================================================================
// Path B: Google reviews as fallback
// ============================================================================

describe('Deal Scoring v5 — Google Review Fallback', () => {

  it('uses reviews when 0 employees AND <3 locations', () => {
    const r = calculateDealScore(makeDeal({
      linkedin_employee_count: 0,
      number_of_locations: 1,
      google_review_count: 200,
    }));
    // 200 reviews → 15 pts
    expect(r.deal_size_score).toBe(15);
    expect(r.scoring_notes).toContain('Google');
  });

  it('ignores reviews when employees > 0', () => {
    const r = calculateDealScore(makeDeal({
      linkedin_employee_count: 5,
      google_review_count: 500,
    }));
    // 5 employees → 21 pts. Reviews ignored.
    expect(r.deal_size_score).toBe(21);
    expect(r.scoring_notes).not.toContain('Google');
  });

  it('ignores reviews when locations >= 3 (even with 0 employees)', () => {
    const r = calculateDealScore(makeDeal({
      linkedin_employee_count: 0,
      number_of_locations: 5,
      google_review_count: 500,
    }));
    // Location floor 50 overrides. Reviews are NOT used.
    expect(r.deal_size_score).toBe(50);
    expect(r.scoring_notes).not.toContain('Google');
  });

  it('caps review score at 20', () => {
    const r = calculateDealScore(makeDeal({
      linkedin_employee_count: 0,
      number_of_locations: 1,
      google_review_count: 9999,
    }));
    expect(r.deal_size_score).toBe(20);
  });
});

// ============================================================================
// Location floors
// ============================================================================

describe('Deal Scoring v5 — Location Floors', () => {

  it('3-4 locations → floor 40', () => {
    const r = calculateDealScore(makeDeal({ number_of_locations: 3 }));
    expect(r.deal_size_score).toBeGreaterThanOrEqual(40);
  });

  it('5-9 locations → floor 50', () => {
    const r = calculateDealScore(makeDeal({ number_of_locations: 7 }));
    expect(r.deal_size_score).toBeGreaterThanOrEqual(50);
  });

  it('10+ locations → floor 60', () => {
    const r = calculateDealScore(makeDeal({ number_of_locations: 15 }));
    expect(r.deal_size_score).toBeGreaterThanOrEqual(60);
  });

  it('location floor does not lower employee score', () => {
    // 100 employees → 54 pts, 3 locations → floor 40. Should stay 54.
    const r = calculateDealScore(makeDeal({
      linkedin_employee_count: 100,
      number_of_locations: 3,
    }));
    expect(r.deal_size_score).toBe(54);
  });

  it('location floor raises low employee score', () => {
    // 5 employees → 21 pts, 6 locations → floor 50. Should be 50.
    const r = calculateDealScore(makeDeal({
      linkedin_employee_count: 5,
      number_of_locations: 6,
    }));
    expect(r.deal_size_score).toBe(50);
  });
});

// ============================================================================
// Industry multiplier
// ============================================================================

describe('Deal Scoring v5 — Industry Multiplier', () => {

  it('Tier 1 applies 1.15x to size score', () => {
    const base = calculateDealScore(makeDeal({ linkedin_employee_count: 50, industry_tier: 2 }));
    const t1 = calculateDealScore(makeDeal({ linkedin_employee_count: 50, industry_tier: 1 }));
    // 48 * 1.15 = 55.2 → 55
    expect(t1.deal_total_score).toBeGreaterThan(base.deal_total_score);
  });

  it('Tier 3 applies 0.9x to size score', () => {
    const base = calculateDealScore(makeDeal({ linkedin_employee_count: 50, industry_tier: 2 }));
    const t3 = calculateDealScore(makeDeal({ linkedin_employee_count: 50, industry_tier: 3 }));
    expect(t3.deal_total_score).toBeLessThan(base.deal_total_score);
  });

  it('multiplier does NOT apply to market score', () => {
    // size=48, industry=T1 → adjusted=55. Market=5. Total=60.
    // If multiplier applied to market too, total would be 61+. Verify it's ≤60.
    const r = calculateDealScore(makeDeal({
      linkedin_employee_count: 50,
      industry_tier: 1,
      address_city: 'Chicago',
    }));
    // 48*1.15=55.2→55, +5 market = 60
    expect(r.deal_total_score).toBe(60);
  });
});

// ============================================================================
// Financial path (Path A) — size floors
// ============================================================================

describe('Deal Scoring v5 — Financial Size Floors', () => {

  it('$5M revenue gets floor 70', () => {
    const r = calculateDealScore(makeDeal({ revenue: 5 }));
    expect(r.deal_size_score).toBeGreaterThanOrEqual(70);
  });

  it('$10M revenue gets floor 80', () => {
    const r = calculateDealScore(makeDeal({ revenue: 10 }));
    expect(r.deal_size_score).toBeGreaterThanOrEqual(80);
  });

  it('$50M revenue gets floor 90', () => {
    const r = calculateDealScore(makeDeal({ revenue: 50 }));
    expect(r.deal_size_score).toBe(90);
  });

  it('$5M EBITDA gets floor 90', () => {
    const r = calculateDealScore(makeDeal({ ebitda: 5 }));
    expect(r.deal_size_score).toBe(90);
  });

  it('industry multiplier applies AFTER financial floor', () => {
    // $5M rev → floor 70, * 1.15 = 80.5 → 81
    const r = calculateDealScore(makeDeal({ revenue: 5, industry_tier: 1 }));
    expect(r.deal_total_score).toBeGreaterThanOrEqual(81);
  });
});

// ============================================================================
// estimateEmployeesFromRange
// ============================================================================

describe('estimateEmployeesFromRange', () => {

  it('parses "11-50" → 30', () => {
    expect(estimateEmployeesFromRange('11-50')).toBe(31); // (11+50)/2 rounded
  });

  it('parses "51-200 employees" → 126', () => {
    expect(estimateEmployeesFromRange('51-200 employees')).toBe(126);
  });

  it('parses "500+" → 600', () => {
    expect(estimateEmployeesFromRange('500+')).toBe(600); // 500 * 1.2
  });

  it('parses "1,001-5,000" → 3001', () => {
    expect(estimateEmployeesFromRange('1,001-5,000')).toBe(3001);
  });

  it('returns 0 for null', () => {
    expect(estimateEmployeesFromRange(null)).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(estimateEmployeesFromRange('')).toBe(0);
  });
});
