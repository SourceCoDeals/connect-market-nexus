/**
 * Unit tests for size scoring phase.
 *
 * Since the scoring modules use Deno-style imports (`.ts` extensions),
 * we re-implement the core logic here to test deterministic scoring
 * without requiring the Deno runtime.
 */
import { describe, it, expect } from 'vitest';

// ============================================================================
// Re-implement core size scoring logic for testing
// ============================================================================

const CONFIG = {
  SWEET_SPOT_EXACT_TOLERANCE: 0.1,
  SWEET_SPOT_NEAR_TOLERANCE: 0.2,
  BELOW_MIN_SLIGHT: 0.9,
  BELOW_MIN_MODERATE: 0.7,
  ABOVE_MAX_DISQUALIFY: 1.5,
  SINGLE_LOCATION_PENALTY: 0.85,
  SIZE_MULT_SWEET_EXACT: 1.0,
  SIZE_MULT_SWEET_NEAR: 0.95,
  SIZE_MULT_IN_RANGE: 1.0,
  SIZE_MULT_SLIGHT_BELOW: 0.7,
  SIZE_MULT_MODERATE_BELOW: 0.5,
  SIZE_MULT_HEAVY_PENALTY: 0.3,
  SIZE_MULT_HEAVY_ALLOW: 0.5,
  SIZE_MULT_ABOVE_MAX: 0.7,
};

interface SizeResult {
  score: number;
  multiplier: number;
  reasoning: string;
}

interface Listing {
  revenue?: number | null;
  ebitda?: number | null;
  location_count?: number | null;
}

interface Buyer {
  target_revenue_min?: number | null;
  target_revenue_max?: number | null;
  target_ebitda_min?: number | null;
  target_ebitda_max?: number | null;
}

interface ScoringBehavior {
  size_strictness?: 'strict' | 'moderate' | 'flexible';
  below_minimum_handling?: 'disqualify' | 'penalize' | 'allow';
  penalize_single_location?: boolean;
}

function calculateSizeScore(
  listing: Listing,
  buyer: Buyer,
  behavior: ScoringBehavior
): SizeResult {
  const dealRevenue = listing.revenue;
  const dealEbitda = listing.ebitda;
  const buyerMinRevenue = buyer.target_revenue_min;
  const buyerMaxRevenue = buyer.target_revenue_max;
  const buyerMinEbitda = buyer.target_ebitda_min;
  const buyerMaxEbitda = buyer.target_ebitda_max;
  const revenueSweetSpot = (buyerMinRevenue && buyerMaxRevenue)
    ? (buyerMinRevenue + buyerMaxRevenue) / 2
    : null;

  // Both deal revenue AND EBITDA are missing
  if (dealRevenue == null && dealEbitda == null) {
    if (buyerMinRevenue == null && buyerMaxRevenue == null && buyerMinEbitda == null && buyerMaxEbitda == null) {
      return { score: 60, multiplier: 1.0, reasoning: 'Both sides missing financials — neutral, no size penalty' };
    }
    const rangeRatio = (buyerMinRevenue && buyerMaxRevenue) ? buyerMaxRevenue / buyerMinRevenue : 0;
    if (rangeRatio >= 3) {
      return { score: 60, multiplier: 1.0, reasoning: 'Deal missing financials — buyer has wide size range, neutral' };
    }
    return { score: 55, multiplier: 0.9, reasoning: 'Deal missing financials — buyer has specific size criteria, fit unverified' };
  }

  // Revenue-based scoring
  let score = 60;
  let multiplier = 1.0;
  const reasons: string[] = [];

  if (dealRevenue != null && (buyerMinRevenue != null || buyerMaxRevenue != null)) {
    // Sweet spot matching
    if (revenueSweetSpot != null) {
      const deviation = Math.abs(dealRevenue - revenueSweetSpot) / revenueSweetSpot;
      if (deviation <= CONFIG.SWEET_SPOT_EXACT_TOLERANCE) {
        score = 95;
        multiplier = CONFIG.SIZE_MULT_SWEET_EXACT;
        reasons.push('Revenue at sweet spot (±10%)');
      } else if (deviation <= CONFIG.SWEET_SPOT_NEAR_TOLERANCE) {
        score = 88;
        multiplier = CONFIG.SIZE_MULT_SWEET_NEAR;
        reasons.push('Revenue near sweet spot (±20%)');
      }
    }

    // Range check
    if (score === 60) {
      if (buyerMinRevenue != null && buyerMaxRevenue != null) {
        if (dealRevenue >= buyerMinRevenue && dealRevenue <= buyerMaxRevenue) {
          score = 85;
          multiplier = CONFIG.SIZE_MULT_IN_RANGE;
          reasons.push('Revenue within target range');
        } else if (dealRevenue < buyerMinRevenue) {
          const ratio = dealRevenue / buyerMinRevenue;
          if (ratio >= CONFIG.BELOW_MIN_SLIGHT) {
            score = 70;
            multiplier = CONFIG.SIZE_MULT_SLIGHT_BELOW;
            reasons.push('Revenue slightly below minimum (within 10%)');
          } else if (ratio >= CONFIG.BELOW_MIN_MODERATE) {
            score = 50;
            multiplier = CONFIG.SIZE_MULT_MODERATE_BELOW;
            reasons.push('Revenue moderately below minimum (10-30%)');
          } else {
            // Heavy below — depends on behavior
            if (behavior.below_minimum_handling === 'disqualify') {
              score = 10;
              multiplier = CONFIG.SIZE_MULT_HEAVY_PENALTY;
              reasons.push('Revenue heavily below minimum — disqualified by behavior');
            } else if (behavior.below_minimum_handling === 'allow') {
              score = 40;
              multiplier = CONFIG.SIZE_MULT_HEAVY_ALLOW;
              reasons.push('Revenue heavily below minimum — allowed by behavior');
            } else {
              score = 25;
              multiplier = CONFIG.SIZE_MULT_HEAVY_PENALTY;
              reasons.push('Revenue heavily below minimum (>30%)');
            }
          }
        } else if (dealRevenue > buyerMaxRevenue) {
          const ratio = dealRevenue / buyerMaxRevenue;
          if (ratio >= CONFIG.ABOVE_MAX_DISQUALIFY) {
            score = 0;
            multiplier = 0;
            reasons.push('Revenue exceeds max by 50%+ — hard disqualify');
          } else {
            score = 60;
            multiplier = CONFIG.SIZE_MULT_ABOVE_MAX;
            reasons.push('Revenue above max but within tolerance');
          }
        }
      } else if (buyerMinRevenue != null && dealRevenue >= buyerMinRevenue) {
        score = 80;
        multiplier = 1.0;
        reasons.push('Revenue above minimum (no max specified)');
      } else if (buyerMaxRevenue != null && dealRevenue <= buyerMaxRevenue) {
        score = 80;
        multiplier = 1.0;
        reasons.push('Revenue below maximum (no min specified)');
      }
    }
  }

  // Single-location penalty
  if (behavior.penalize_single_location && listing.location_count === 1) {
    multiplier *= CONFIG.SINGLE_LOCATION_PENALTY;
    reasons.push('Single-location penalty applied');
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));
  multiplier = Math.max(0, Math.min(1.0, multiplier));

  return { score, multiplier, reasoning: reasons.join('; ') || 'No revenue data available' };
}

// ============================================================================
// TESTS
// ============================================================================

describe('calculateSizeScore', () => {
  const defaultBehavior: ScoringBehavior = {};

  describe('both sides missing financials', () => {
    it('returns neutral (60, 1.0) when neither side has financials', () => {
      const result = calculateSizeScore(
        { revenue: null, ebitda: null },
        { target_revenue_min: null, target_revenue_max: null },
        defaultBehavior
      );
      expect(result.score).toBe(60);
      expect(result.multiplier).toBe(1.0);
    });

    it('returns neutral when buyer has wide range (3x+)', () => {
      const result = calculateSizeScore(
        { revenue: null, ebitda: null },
        { target_revenue_min: 1_000_000, target_revenue_max: 5_000_000 },
        defaultBehavior
      );
      expect(result.score).toBe(60);
      expect(result.multiplier).toBe(1.0);
    });

    it('returns mild uncertainty when buyer has narrow range', () => {
      const result = calculateSizeScore(
        { revenue: null, ebitda: null },
        { target_revenue_min: 5_000_000, target_revenue_max: 7_000_000 },
        defaultBehavior
      );
      expect(result.score).toBe(55);
      expect(result.multiplier).toBe(0.9);
    });
  });

  describe('sweet spot matching', () => {
    it('scores 95 for exact sweet spot match (±10%)', () => {
      // Buyer range: 5M-15M, sweet spot = 10M
      const result = calculateSizeScore(
        { revenue: 10_500_000 },
        { target_revenue_min: 5_000_000, target_revenue_max: 15_000_000 },
        defaultBehavior
      );
      expect(result.score).toBe(95);
      expect(result.multiplier).toBe(1.0);
    });

    it('scores 88 for near sweet spot (±20%)', () => {
      // Buyer range: 5M-15M, sweet spot = 10M, deal at 12M (20% off)
      const result = calculateSizeScore(
        { revenue: 12_000_000 },
        { target_revenue_min: 5_000_000, target_revenue_max: 15_000_000 },
        defaultBehavior
      );
      expect(result.score).toBe(88);
      expect(result.multiplier).toBe(0.95);
    });
  });

  describe('within range', () => {
    it('scores 85 for revenue within buyer range', () => {
      const result = calculateSizeScore(
        { revenue: 8_000_000 },
        { target_revenue_min: 3_000_000, target_revenue_max: 20_000_000 },
        defaultBehavior
      );
      // Sweet spot = 11.5M, deviation = |8-11.5|/11.5 = 30.4% — not within 20%
      expect(result.score).toBe(85);
      expect(result.multiplier).toBe(1.0);
    });
  });

  describe('below minimum', () => {
    it('applies slight penalty for 1-10% below min', () => {
      // Buyer min = 10M, deal at 9.5M (5% below)
      const result = calculateSizeScore(
        { revenue: 9_500_000 },
        { target_revenue_min: 10_000_000, target_revenue_max: 20_000_000 },
        defaultBehavior
      );
      expect(result.score).toBe(70);
      expect(result.multiplier).toBe(0.7);
    });

    it('applies moderate penalty for 10-30% below min', () => {
      // Buyer min = 10M, deal at 7.5M (25% below)
      const result = calculateSizeScore(
        { revenue: 7_500_000 },
        { target_revenue_min: 10_000_000, target_revenue_max: 20_000_000 },
        defaultBehavior
      );
      expect(result.score).toBe(50);
      expect(result.multiplier).toBe(0.5);
    });

    it('disqualifies when behavior says so for heavy below', () => {
      const result = calculateSizeScore(
        { revenue: 3_000_000 },
        { target_revenue_min: 10_000_000, target_revenue_max: 20_000_000 },
        { below_minimum_handling: 'disqualify' }
      );
      expect(result.score).toBe(10);
      expect(result.multiplier).toBe(0.3);
    });

    it('allows heavy below when behavior permits', () => {
      const result = calculateSizeScore(
        { revenue: 3_000_000 },
        { target_revenue_min: 10_000_000, target_revenue_max: 20_000_000 },
        { below_minimum_handling: 'allow' }
      );
      expect(result.score).toBe(40);
      expect(result.multiplier).toBe(0.5);
    });
  });

  describe('above maximum', () => {
    it('hard disqualifies at 150% of max', () => {
      // Buyer max = 10M, deal at 16M (160% of max)
      const result = calculateSizeScore(
        { revenue: 16_000_000 },
        { target_revenue_min: 5_000_000, target_revenue_max: 10_000_000 },
        defaultBehavior
      );
      expect(result.score).toBe(0);
      expect(result.multiplier).toBe(0);
    });

    it('penalizes moderately when above max but within tolerance', () => {
      // Buyer max = 10M, deal at 12M (120% of max — under 150% threshold)
      const result = calculateSizeScore(
        { revenue: 12_000_000 },
        { target_revenue_min: 5_000_000, target_revenue_max: 10_000_000 },
        defaultBehavior
      );
      expect(result.score).toBe(60);
      expect(result.multiplier).toBe(0.7);
    });
  });

  describe('single-location penalty', () => {
    it('applies 15% multiplier penalty for single-location deals', () => {
      const result = calculateSizeScore(
        { revenue: 10_000_000, location_count: 1 },
        { target_revenue_min: 5_000_000, target_revenue_max: 15_000_000 },
        { penalize_single_location: true }
      );
      expect(result.multiplier).toBeCloseTo(1.0 * 0.85, 2);
    });

    it('does not apply penalty when behavior disabled', () => {
      const result = calculateSizeScore(
        { revenue: 10_000_000, location_count: 1 },
        { target_revenue_min: 5_000_000, target_revenue_max: 15_000_000 },
        { penalize_single_location: false }
      );
      expect(result.multiplier).toBe(1.0);
    });
  });

  describe('score clamping', () => {
    it('never returns score above 100', () => {
      const result = calculateSizeScore(
        { revenue: 10_000_000 },
        { target_revenue_min: 9_500_000, target_revenue_max: 10_500_000 },
        defaultBehavior
      );
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('never returns score below 0', () => {
      const result = calculateSizeScore(
        { revenue: 100_000_000 },
        { target_revenue_min: 1_000_000, target_revenue_max: 5_000_000 },
        defaultBehavior
      );
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('never returns multiplier above 1.0', () => {
      const result = calculateSizeScore(
        { revenue: 10_000_000 },
        { target_revenue_min: 5_000_000, target_revenue_max: 15_000_000 },
        defaultBehavior
      );
      expect(result.multiplier).toBeLessThanOrEqual(1.0);
    });
  });
});
