/**
 * PHASE 2: SIZE SCORING (Deterministic)
 * Returns BOTH a size_score (0-100) AND a size_multiplier (0.0-1.0)
 * The size_multiplier is a GATE applied to the ENTIRE composite score.
 */

import { SCORING_CONFIG } from "../config.ts";
import type { Listing, Buyer, ScoringBehavior, SizeResult } from "../types.ts";

export function calculateSizeScore(
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
  // Compute sweet spots as midpoint of min/max (previously stored as separate fields)
  const revenueSweetSpot = (buyerMinRevenue && buyerMaxRevenue) ? (buyerMinRevenue + buyerMaxRevenue) / 2 : null;
  const ebitdaSweetSpot = (buyerMinEbitda && buyerMaxEbitda) ? (buyerMinEbitda + buyerMaxEbitda) / 2 : null;

  // Both deal revenue AND EBITDA are missing — differentiate by buyer flexibility
  if (dealRevenue == null && dealEbitda == null) {
    // No buyer size criteria either — both sides unknown, neutral
    if (buyerMinRevenue == null && buyerMaxRevenue == null && buyerMinEbitda == null && buyerMaxEbitda == null) {
      return {
        score: 60,
        multiplier: 1.0,
        reasoning: "Both sides missing financials — neutral, no size penalty"
      };
    }
    // Buyer has wide criteria range (max >= 3x min) — flexible buyer, better chance of fit
    const rangeRatio = (buyerMinRevenue && buyerMaxRevenue) ? buyerMaxRevenue / buyerMinRevenue : 0;
    if (rangeRatio >= 3) {
      return {
        score: 60,
        multiplier: 1.0,
        reasoning: "Deal missing financials — buyer has wide size range, neutral"
      };
    }
    // Buyer has narrow or specific criteria — can't verify, mild uncertainty
    return {
      score: 55,
      multiplier: 0.9,
      reasoning: "Deal missing financials — buyer has specific size criteria, fit unverified"
    };
  }

  // No buyer size criteria at all — use moderate default
  if (buyerMinRevenue == null && buyerMaxRevenue == null && buyerMinEbitda == null && buyerMaxEbitda == null) {
    return {
      score: 60,
      multiplier: 1.0,
      reasoning: "No buyer size criteria available — neutral scoring"
    };
  }

  let score = 60; // default
  let multiplier = 1.0;
  let reasoning = "";

  // === Revenue-based scoring ===
  if (dealRevenue != null && dealRevenue > 0) {
    // Sweet spot match (±10%)
    if (revenueSweetSpot && Math.abs(dealRevenue - revenueSweetSpot) / revenueSweetSpot <= SCORING_CONFIG.SWEET_SPOT_EXACT_TOLERANCE) {
      score = 97;
      multiplier = SCORING_CONFIG.SIZE_MULT_SWEET_EXACT;
      reasoning = `Revenue $${(dealRevenue/1e6).toFixed(1)}M — exact sweet spot match`;
    }
    // Sweet spot match (±20%)
    else if (revenueSweetSpot && Math.abs(dealRevenue - revenueSweetSpot) / revenueSweetSpot <= SCORING_CONFIG.SWEET_SPOT_NEAR_TOLERANCE) {
      score = 90;
      multiplier = SCORING_CONFIG.SIZE_MULT_SWEET_NEAR;
      reasoning = `Revenue $${(dealRevenue/1e6).toFixed(1)}M — near sweet spot ($${(revenueSweetSpot/1e6).toFixed(1)}M)`;
    }
    // Within buyer's stated range
    else if (buyerMinRevenue && buyerMaxRevenue && dealRevenue >= buyerMinRevenue && dealRevenue <= buyerMaxRevenue) {
      score = 80;
      multiplier = SCORING_CONFIG.SIZE_MULT_IN_RANGE;
      reasoning = `Revenue $${(dealRevenue/1e6).toFixed(1)}M — within buyer range ($${(buyerMinRevenue/1e6).toFixed(1)}M-$${(buyerMaxRevenue/1e6).toFixed(1)}M)`;
    }
    // 1-10% below minimum
    else if (buyerMinRevenue && dealRevenue < buyerMinRevenue && dealRevenue >= buyerMinRevenue * SCORING_CONFIG.BELOW_MIN_SLIGHT) {
      const percentBelow = Math.round(((buyerMinRevenue - dealRevenue) / buyerMinRevenue) * 100);
      score = 62;
      multiplier = SCORING_CONFIG.SIZE_MULT_SLIGHT_BELOW;
      reasoning = `Revenue ${percentBelow}% below minimum — slight undersize`;
    }
    // 10-30% below minimum
    else if (buyerMinRevenue && dealRevenue < buyerMinRevenue * SCORING_CONFIG.BELOW_MIN_SLIGHT && dealRevenue >= buyerMinRevenue * SCORING_CONFIG.BELOW_MIN_MODERATE) {
      const percentBelow = Math.round(((buyerMinRevenue - dealRevenue) / buyerMinRevenue) * 100);
      score = 45;
      multiplier = SCORING_CONFIG.SIZE_MULT_MODERATE_BELOW;
      reasoning = `Revenue ${percentBelow}% below minimum — undersized`;
    }
    // >30% below minimum
    else if (buyerMinRevenue && dealRevenue < buyerMinRevenue * SCORING_CONFIG.BELOW_MIN_MODERATE) {
      const percentBelow = Math.round(((buyerMinRevenue - dealRevenue) / buyerMinRevenue) * 100);
      if (behavior.below_minimum_handling === 'disqualify') {
        score = 0;
        multiplier = 0.0;
        reasoning = `DISQUALIFIED: Revenue ${percentBelow}% below minimum — hard disqualify`;
      } else if (behavior.below_minimum_handling === 'penalize') {
        score = 15;
        multiplier = SCORING_CONFIG.SIZE_MULT_HEAVY_PENALTY;
        reasoning = `Revenue ${percentBelow}% below minimum — heavy penalty`;
      } else {
        score = 30;
        multiplier = SCORING_CONFIG.SIZE_MULT_HEAVY_ALLOW;
        reasoning = `Revenue ${percentBelow}% below minimum — allowed with penalty`;
      }
    }
    // >50% above maximum
    else if (buyerMaxRevenue && dealRevenue > buyerMaxRevenue * SCORING_CONFIG.ABOVE_MAX_DISQUALIFY) {
      score = 0;
      multiplier = 0.0;
      reasoning = `DISQUALIFIED: Revenue $${(dealRevenue/1e6).toFixed(1)}M — way above buyer max ($${(buyerMaxRevenue/1e6).toFixed(1)}M)`;
    }
    // Above maximum but within 50%
    else if (buyerMaxRevenue && dealRevenue > buyerMaxRevenue) {
      const percentAbove = Math.round(((dealRevenue - buyerMaxRevenue) / buyerMaxRevenue) * 100);
      score = 50;
      multiplier = SCORING_CONFIG.SIZE_MULT_ABOVE_MAX;
      reasoning = `Revenue ${percentAbove}% above max — oversized`;
    }
    // Only has min, deal is above it
    else if (buyerMinRevenue && !buyerMaxRevenue && dealRevenue >= buyerMinRevenue) {
      score = 80;
      multiplier = 1.0;
      reasoning = `Revenue $${(dealRevenue/1e6).toFixed(1)}M — above buyer minimum`;
    }
    // Only has max, deal is below it
    else if (!buyerMinRevenue && buyerMaxRevenue && dealRevenue <= buyerMaxRevenue) {
      score = 75;
      multiplier = 1.0;
      reasoning = `Revenue $${(dealRevenue/1e6).toFixed(1)}M — within buyer max`;
    }
  }

  // === EBITDA-based scoring (sweet spot, supplement, or fallback) ===
  if (dealEbitda != null && dealEbitda <= 0) {
    // Negative or zero EBITDA — note in reasoning but don't use for size scoring
    reasoning += `. Note: EBITDA is ${dealEbitda <= 0 ? 'negative' : 'zero'} ($${(dealEbitda/1e6).toFixed(1)}M) — excluded from size scoring`;
  }
  if (dealEbitda != null && dealEbitda > 0) {
    // EBITDA sweet spot match (boost if revenue didn't already match)
    if (ebitdaSweetSpot && score < 90) {
      if (Math.abs(dealEbitda - ebitdaSweetSpot) / ebitdaSweetSpot <= 0.1) {
        score = Math.max(score, 95);
        multiplier = Math.max(multiplier, 1.0);
        reasoning += `. EBITDA $${(dealEbitda/1e6).toFixed(1)}M — exact EBITDA sweet spot`;
      } else if (Math.abs(dealEbitda - ebitdaSweetSpot) / ebitdaSweetSpot <= 0.2) {
        score = Math.max(score, 88);
        multiplier = Math.max(multiplier, 0.95);
        reasoning += `. EBITDA $${(dealEbitda/1e6).toFixed(1)}M — near EBITDA sweet spot`;
      }
    }
    // EBITDA below minimum — penalize
    if (buyerMinEbitda) {
      if (dealEbitda < buyerMinEbitda * 0.5) {
        if (score > 20) {
          score = 20;
          multiplier = Math.min(multiplier, 0.25);
          reasoning += `. EBITDA $${(dealEbitda/1e6).toFixed(1)}M — far below buyer min ($${(buyerMinEbitda/1e6).toFixed(1)}M)`;
        }
      } else if (dealEbitda < buyerMinEbitda) {
        if (score > 40) {
          score = Math.min(score, 40);
          multiplier = Math.min(multiplier, 0.6);
          reasoning += `. EBITDA below buyer minimum`;
        }
      }
    }
  }

  // === Single-location penalty ===
  if (behavior.penalize_single_location) {
    const locationCount = listing.location_count || 1;
    if (locationCount === 1) {
      score = Math.round(score * SCORING_CONFIG.SINGLE_LOCATION_PENALTY);
      reasoning += ". Single-location penalty applied";
    }
  }

  return { score: Math.max(0, Math.min(100, score)), multiplier, reasoning };
}
