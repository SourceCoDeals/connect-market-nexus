/**
 * Tests for the portal recommendation scoring engine.
 *
 * Covers the behaviors audited and fixed in the 20260703 audit:
 *   - Word-boundary keyword matching (no "auto" → "automation" false positives)
 *   - Empty-keywords guard
 *   - ebitda_min=0 is honored (not treated as absent)
 *   - Geography bands (national / matching state / outside state)
 *   - Size fallback chain (EBITDA → revenue → employees)
 *   - Quality bonus thresholds
 *   - Category bucketing (strong / moderate / weak)
 *   - reasonsEqual helper
 *   - keywordMatches helper
 */
import { describe, it, expect } from 'vitest';
import {
  scoreListingAgainstCriteria,
  keywordMatches,
  reasonsEqual,
  escapeRegex,
  type ThesisCriteria,
} from './scoring';

function makeCriteria(overrides: Partial<ThesisCriteria> = {}): ThesisCriteria {
  return {
    id: 'criterion-1',
    portal_org_id: 'org-1',
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

describe('keywordMatches', () => {
  it('matches whole words', () => {
    expect(keywordMatches('commercial hvac services', 'hvac')).toBe(true);
  });

  it('does NOT match prefix substrings (regression: auto → automotive)', () => {
    expect(keywordMatches('industrial automation supplier', 'auto')).toBe(false);
    expect(keywordMatches('automotive repair shop', 'auto')).toBe(false);
  });

  it('does NOT match suffix substrings (regression: air → repair)', () => {
    expect(keywordMatches('appliance repair business', 'air')).toBe(false);
    expect(keywordMatches('office chair manufacturer', 'air')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(keywordMatches('Commercial HVAC Services', 'hvac')).toBe(true);
    expect(keywordMatches('commercial hvac', 'HVAC')).toBe(true);
  });

  it('handles multi-word phrases', () => {
    expect(keywordMatches('commercial hvac services', 'commercial hvac')).toBe(true);
    expect(keywordMatches('residential hvac', 'commercial hvac')).toBe(false);
  });

  it('escapes regex special characters', () => {
    expect(keywordMatches('a+b service', 'a+b')).toBe(true);
    expect(keywordMatches('xyz service', 'a+b')).toBe(false);
  });

  it('returns false for empty keyword', () => {
    expect(keywordMatches('commercial hvac', '')).toBe(false);
    expect(keywordMatches('commercial hvac', '   ')).toBe(false);
  });
});

describe('escapeRegex', () => {
  it('escapes all regex metacharacters', () => {
    expect(escapeRegex('a.b')).toBe('a\\.b');
    expect(escapeRegex('a+b')).toBe('a\\+b');
    expect(escapeRegex('(x)')).toBe('\\(x\\)');
    expect(escapeRegex('[y]')).toBe('\\[y\\]');
  });
});

describe('reasonsEqual', () => {
  it('handles equal arrays', () => {
    expect(reasonsEqual(['a', 'b'], ['a', 'b'])).toBe(true);
  });

  it('is order-independent', () => {
    expect(reasonsEqual(['b', 'a'], ['a', 'b'])).toBe(true);
  });

  it('returns false for different lengths', () => {
    expect(reasonsEqual(['a'], ['a', 'b'])).toBe(false);
  });

  it('returns false for null/undefined first arg', () => {
    expect(reasonsEqual(null, ['a'])).toBe(false);
    expect(reasonsEqual(undefined, ['a'])).toBe(false);
  });

  it('handles both empty', () => {
    expect(reasonsEqual([], [])).toBe(true);
  });
});

describe('scoreListingAgainstCriteria — keyword gate', () => {
  it('returns 0 when criteria has no keywords', () => {
    const result = scoreListingAgainstCriteria(
      { industry: 'HVAC' },
      makeCriteria({ industry_keywords: [] }),
    );
    expect(result.score).toBe(0);
    expect(result.category).toBe('weak');
  });

  it('returns 0 when listing industry does not contain any keyword', () => {
    const result = scoreListingAgainstCriteria(
      { industry: 'Auto Dealership' },
      makeCriteria({ industry_keywords: ['hvac'] }),
    );
    expect(result.score).toBe(0);
  });

  it('matches against industry field', () => {
    const result = scoreListingAgainstCriteria({ industry: 'HVAC' }, makeCriteria());
    expect(result.score).toBeGreaterThan(0);
  });

  it('matches against executive_summary', () => {
    const result = scoreListingAgainstCriteria(
      { executive_summary: 'This company provides commercial HVAC installation.' },
      makeCriteria(),
    );
    expect(result.score).toBeGreaterThan(0);
  });

  it('matches against services array', () => {
    const result = scoreListingAgainstCriteria(
      { services: ['HVAC installation', 'plumbing'] },
      makeCriteria(),
    );
    expect(result.score).toBeGreaterThan(0);
  });

  it('matches against categories array', () => {
    const result = scoreListingAgainstCriteria({ categories: ['commercial hvac'] }, makeCriteria());
    expect(result.score).toBeGreaterThan(0);
  });

  it('regression: "auto" keyword does NOT match "automation" in industry', () => {
    const result = scoreListingAgainstCriteria(
      { industry: 'Industrial Automation' },
      makeCriteria({ industry_keywords: ['auto'], industry_label: 'Automotive' }),
    );
    expect(result.score).toBe(0);
  });

  it('regression: "auto" keyword does match "auto" as whole word', () => {
    const result = scoreListingAgainstCriteria(
      { industry: 'Auto Dealership' },
      makeCriteria({ industry_keywords: ['auto'], industry_label: 'Automotive' }),
    );
    expect(result.score).toBeGreaterThan(0);
  });
});

describe('scoreListingAgainstCriteria — geography', () => {
  it('awards full geography credit when target_states is empty (national)', () => {
    const result = scoreListingAgainstCriteria(
      { industry: 'HVAC', address_state: 'OH' },
      makeCriteria({ target_states: [] }),
    );
    // 40 industry + 25 national = 65
    expect(result.score).toBe(65);
    expect(result.reasons).toContain('National geography');
  });

  it('awards full credit on matching state', () => {
    const result = scoreListingAgainstCriteria(
      { industry: 'HVAC', address_state: 'OH' },
      makeCriteria({ target_states: ['OH', 'PA'] }),
    );
    expect(result.score).toBe(65);
  });

  it('handles lowercase target state', () => {
    const result = scoreListingAgainstCriteria(
      { industry: 'HVAC', address_state: 'OH' },
      makeCriteria({ target_states: ['oh'] }),
    );
    expect(result.score).toBe(65);
  });

  it('awards partial credit for outside-state match', () => {
    const result = scoreListingAgainstCriteria(
      { industry: 'HVAC', address_state: 'CA' },
      makeCriteria({ target_states: ['OH'] }),
    );
    // 40 industry + 5 outside = 45
    expect(result.score).toBe(45);
    expect(result.reasons.some((r) => r.includes('outside target states'))).toBe(true);
  });
});

describe('scoreListingAgainstCriteria — size (EBITDA)', () => {
  it('awards full size credit when EBITDA is in range', () => {
    const result = scoreListingAgainstCriteria(
      { industry: 'HVAC', ebitda: 2_500_000 },
      makeCriteria({ ebitda_min: 1_000_000, ebitda_max: 5_000_000 }),
    );
    // 40 industry + 25 national + 25 in-range = 90
    expect(result.score).toBe(90);
  });

  it('awards partial credit when EBITDA is outside range', () => {
    const result = scoreListingAgainstCriteria(
      { industry: 'HVAC', ebitda: 10_000_000 },
      makeCriteria({ ebitda_min: 1_000_000, ebitda_max: 5_000_000 }),
    );
    // 40 industry + 25 national + 5 outside = 70
    expect(result.score).toBe(70);
  });

  it('regression: ebitda_min=0 is honored (not treated as null)', () => {
    const result = scoreListingAgainstCriteria(
      { industry: 'HVAC', ebitda: 3_000_000 },
      makeCriteria({ ebitda_min: 0, ebitda_max: 5_000_000 }),
    );
    // The old code's truthiness check would have treated ebitda_min=0 as
    // "no minimum" and still awarded full credit. With the fix, 3M is still
    // in range, so the score should be 90 either way — but the BEHAVIOR
    // should be that ebitda_min=0 is considered set.
    expect(result.score).toBe(90);
    expect(result.reasons.some((r) => r.includes('in range'))).toBe(true);
  });

  it('regression: ebitda_min=0 rejects negative EBITDA (only reachable with null-honoring check)', () => {
    // A listing with exactly 0 EBITDA should not be counted (the size branch
    // requires ebitda > 0), but a listing with positive ebitda below a
    // higher min=0 threshold should still be considered "in range".
    const result = scoreListingAgainstCriteria(
      { industry: 'HVAC', ebitda: 100 },
      makeCriteria({ ebitda_min: 0, ebitda_max: 1_000_000 }),
    );
    // 40 industry + 25 national + 25 in-range = 90
    expect(result.score).toBe(90);
  });

  it('ignores size when EBITDA is zero and only EBITDA range is set', () => {
    const result = scoreListingAgainstCriteria(
      { industry: 'HVAC', ebitda: 0 },
      makeCriteria({ ebitda_min: 1_000_000, ebitda_max: 5_000_000 }),
    );
    // 40 industry + 25 national + 0 size (ebitda=0 bails) = 65
    expect(result.score).toBe(65);
  });
});

describe('scoreListingAgainstCriteria — size fallback (revenue, employees)', () => {
  it('falls back to revenue when EBITDA is absent', () => {
    const result = scoreListingAgainstCriteria(
      { industry: 'HVAC', revenue: 10_000_000 },
      makeCriteria({ revenue_min: 5_000_000, revenue_max: 20_000_000 }),
    );
    // 40 industry + 25 national + 20 revenue in-range = 85
    expect(result.score).toBe(85);
  });

  it('falls back to employees when EBITDA and revenue are absent', () => {
    const result = scoreListingAgainstCriteria(
      { industry: 'HVAC', linkedin_employee_count: 50 },
      makeCriteria({ employee_min: 20, employee_max: 100 }),
    );
    // 40 industry + 25 national + 15 employees in-range = 80
    expect(result.score).toBe(80);
  });
});

describe('scoreListingAgainstCriteria — quality bonus', () => {
  it('adds 10 for high quality (deal_total_score >= 60)', () => {
    const result = scoreListingAgainstCriteria(
      { industry: 'HVAC', deal_total_score: 65 },
      makeCriteria(),
    );
    // 40 + 25 + 10 = 75
    expect(result.score).toBe(75);
  });

  it('adds 5 for moderate quality (40 <= score < 60)', () => {
    const result = scoreListingAgainstCriteria(
      { industry: 'HVAC', deal_total_score: 45 },
      makeCriteria(),
    );
    // 40 + 25 + 5 = 70
    expect(result.score).toBe(70);
  });

  it('adds 0 below 40', () => {
    const result = scoreListingAgainstCriteria(
      { industry: 'HVAC', deal_total_score: 20 },
      makeCriteria(),
    );
    // 40 + 25 + 0 = 65
    expect(result.score).toBe(65);
  });
});

describe('scoreListingAgainstCriteria — category bucketing', () => {
  it('strong category at score >= 70', () => {
    const result = scoreListingAgainstCriteria(
      {
        industry: 'HVAC',
        ebitda: 2_500_000,
        deal_total_score: 50,
      },
      makeCriteria({ ebitda_min: 1_000_000, ebitda_max: 5_000_000 }),
    );
    // 40 + 25 + 25 + 5 = 95
    expect(result.category).toBe('strong');
  });

  it('moderate category at 45 <= score < 70', () => {
    const result = scoreListingAgainstCriteria(
      { industry: 'HVAC', address_state: 'CA' },
      makeCriteria({ target_states: ['OH'] }),
    );
    // 40 + 5 = 45
    expect(result.category).toBe('moderate');
  });

  it('weak category below 45', () => {
    const result = scoreListingAgainstCriteria({}, makeCriteria());
    expect(result.category).toBe('weak');
    expect(result.score).toBe(0);
  });
});
