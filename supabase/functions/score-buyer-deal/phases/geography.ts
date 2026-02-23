/**
 * PHASE 3: GEOGRAPHY SCORING (Deterministic + Adjacency Intelligence)
 */

import { SCORING_CONFIG } from "../config.ts";
import { calculateProximityScore, getProximityTier, normalizeStateCode } from "../../_shared/geography-utils.ts";
import { extractStatesFromText as sharedExtractStatesFromText } from "../../_shared/geography.ts";
import type { Listing, Buyer, IndustryTracker, GeographyResult } from "../types.ts";

export async function calculateGeographyScore(
  listing: Listing,
  buyer: Buyer,
  tracker: IndustryTracker | null,
  supabaseUrl: string,
  supabaseKey: string
): Promise<GeographyResult> {
  // Determine geography mode from tracker (defaults to 'critical')
  const geographyMode: string = tracker?.geography_mode || 'critical';

  // Determine mode factor and floor
  let modeFactor = 1.0;
  let scoreFloor = 0;
  switch (geographyMode) {
    case 'preferred':
      modeFactor = SCORING_CONFIG.GEO_MODE_PREFERRED;
      scoreFloor = 30;
      break;
    case 'minimal':
      modeFactor = SCORING_CONFIG.GEO_MODE_MINIMAL;
      scoreFloor = 50;
      break;
    default: // critical
      modeFactor = 1.0;
      scoreFloor = 0;
  }

  // Extract deal state — try regex first, then normalizeStateCode fallback
  const dealLocation = listing.location || "";
  let dealState = dealLocation.match(/,\s*([A-Z]{2})\s*$/i)?.[1]?.toUpperCase() || null;
  if (!dealState) {
    // Fallback: try to extract state from "City, State Name" or "City, ST ZIP" patterns
    const stateMatch = dealLocation.match(/,\s*([A-Za-z\s]+?)(?:\s+\d{5})?$/);
    if (stateMatch) {
      dealState = normalizeStateCode(stateMatch[1].trim());
    }
  }

  // Get buyer geographic data (priority order per spec)
  let buyerStates: string[] = [];

  // Helper: normalize a state entry to a 2-letter code (handles full names like "Georgia" → "GA")
  const normalizeEntry = (s: string): string | null => {
    const trimmed = s.trim().toUpperCase();
    // Already a 2-letter code
    if (/^[A-Z]{2}$/.test(trimmed)) return trimmed;
    // Try normalizing full state name to code
    return normalizeStateCode(s);
  };

  // Delegate to shared geography module for text-based state extraction
  const extractStatesFromText = sharedExtractStatesFromText;

  // 1. target_geographies (strongest signal)
  const targetGeos = (buyer.target_geographies || []).filter(Boolean)
    .map((s: string) => normalizeEntry(s)).filter((s: string | null): s is string => s !== null);
  if (targetGeos.length > 0) {
    buyerStates = targetGeos;
  }
  // 2. geographic_footprint (fallback)
  else {
    const footprint = (buyer.geographic_footprint || []).filter(Boolean)
      .map((s: string) => normalizeEntry(s)).filter((s: string | null): s is string => s !== null);
    if (footprint.length > 0) {
      buyerStates = footprint;
    }
    // 2.5. operating_locations — extract state codes from "City, ST" entries
    if (buyerStates.length === 0 && buyer.operating_locations?.length) {
      const locStates: string[] = [];
      for (const loc of buyer.operating_locations) {
        if (typeof loc !== 'string') continue;
        const stateMatch = loc.match(/,\s*([A-Z]{2})\s*$/i);
        if (stateMatch) {
          const code = stateMatch[1].toUpperCase();
          if (/^[A-Z]{2}$/.test(code)) locStates.push(code);
        }
      }
      const unique = [...new Set(locStates)];
      if (unique.length > 0) {
        buyerStates = unique;
        console.log(`[Geo] Parsed ${unique.length} states from operating_locations: ${unique.join(', ')}`);
      }
    }
    // 3. service_regions (broad coverage signal from enrichment)
    if (buyerStates.length === 0 && buyer.service_regions?.length) {
      const svcRegions = (buyer.service_regions || []).filter(Boolean)
        .map((s: string) => normalizeEntry(s)).filter((s: string | null): s is string => s !== null);
      if (svcRegions.length > 0) {
        buyerStates = svcRegions;
        console.log(`[Geo] Using ${svcRegions.length} states from service_regions: ${svcRegions.join(', ')}`);
      }
    }
    // 4. customer_geographic_reach (text field — parse state names from it)
    if (buyerStates.length === 0 && buyer.customer_geographic_reach && typeof buyer.customer_geographic_reach === 'string') {
      const reachText = buyer.customer_geographic_reach;
      // Skip vague national/global descriptions
      const isVague = /\b(national|nationwide|global|international|united states)\b/i.test(reachText) &&
                      !(/\b(minnesota|texas|florida|california|ohio)\b/i.test(reachText)); // Not vague if specific states listed
      if (!isVague) {
        const parsedStates = extractStatesFromText(reachText);
        if (parsedStates.length > 0) {
          buyerStates = parsedStates;
          console.log(`[Geo] Parsed ${parsedStates.length} states from customer_geographic_reach: ${parsedStates.join(', ')}`);
        }
      }
    }
    // 5. HQ state (weakest signal)
    if (buyerStates.length === 0 && buyer.hq_state) {
      const normalized = normalizeEntry(buyer.hq_state);
      if (normalized) buyerStates = [normalized];
    }
  }

  // Check hard disqualifiers FIRST
  // 1. Deal state in buyer's explicit geographic_exclusions
  const geoExclusions = (buyer.geographic_exclusions || []).map((s: string) => s?.toUpperCase().trim()).filter(Boolean);
  if (dealState && geoExclusions.includes(dealState)) {
    return {
      score: 0,
      modeFactor,
      reasoning: `DISQUALIFIED: Deal state ${dealState} in buyer's geographic exclusions`,
      tier: 'distant'
    };
  }

  // 2. Hard thesis geographic constraint
  const thesisGeoResult = parseThesisGeographicConstraint(buyer.thesis_summary, dealState);
  if (thesisGeoResult.hardDisqualify) {
    return {
      score: 0,
      modeFactor,
      reasoning: `DISQUALIFIED: ${thesisGeoResult.reasoning}`,
      tier: 'distant'
    };
  }

  // No deal state or no buyer states — limited data
  if (!dealState || buyerStates.length === 0) {
    let limitedScore = 50;
    let limitedReasoning = "Limited geography data available";

    // Use buyer signals to differentiate
    const geoReach = (buyer.customer_geographic_reach || '').toLowerCase();
    const buyerType = (buyer.buyer_type || '').toLowerCase();
    const thesis = (buyer.thesis_summary || '').toLowerCase();

    const isNational = /\b(national|nationwide|global|international|united states|all states|coast to coast)\b/.test(geoReach) ||
      /\b(national|nationwide)\b/.test(thesis);

    if (isNational) {
      limitedScore = 70;
      limitedReasoning = "Buyer appears national — geography likely not a constraint";
    } else if (buyerType === 'pe_firm' || buyerType === 'family_office') {
      limitedScore = 60;
      limitedReasoning = "PE/Family Office buyer — likely flexible on geography";
    }

    limitedScore = Math.max(scoreFloor, limitedScore);

    return {
      score: limitedScore,
      modeFactor,
      reasoning: limitedReasoning,
      tier: 'regional'
    };
  }

  // Calculate proximity using adjacency intelligence
  const { score: baseScore, reasoning: baseReasoning } = await calculateProximityScore(
    dealState,
    buyerStates,
    supabaseUrl,
    supabaseKey
  );

  const tier = await getProximityTier(dealState, buyerStates, supabaseUrl, supabaseKey);

  // Apply score floor from geography mode
  const finalScore = Math.max(scoreFloor, baseScore);

  const modeNote = geographyMode !== 'critical' ? ` [${geographyMode} mode, floor=${scoreFloor}]` : '';

  return {
    score: finalScore,
    modeFactor,
    reasoning: `${baseReasoning}${modeNote}`,
    tier
  };
}

// Parse thesis_summary for geographic focus patterns
export function parseThesisGeographicConstraint(
  thesis: string | null | undefined,
  dealState: string | null | undefined
): { hardDisqualify: boolean; reasoning: string } {
  if (!thesis || !dealState) return { hardDisqualify: false, reasoning: '' };

  const thesisLower = thesis.toLowerCase();

  // Regional patterns
  const regionPatterns: Array<{ pattern: RegExp; states: string[] }> = [
    { pattern: /pacific\s+northwest/i, states: ['WA', 'OR', 'ID'] },
    { pattern: /southeast\b/i, states: ['FL', 'GA', 'AL', 'MS', 'SC', 'NC', 'TN', 'VA', 'LA', 'AR'] },
    { pattern: /sun\s*belt/i, states: ['FL', 'GA', 'TX', 'AZ', 'NV', 'CA', 'SC', 'NC', 'TN'] },
    { pattern: /midwest/i, states: ['OH', 'IN', 'IL', 'MI', 'WI', 'MN', 'IA', 'MO', 'ND', 'SD', 'NE', 'KS'] },
    { pattern: /northeast/i, states: ['NY', 'NJ', 'PA', 'CT', 'MA', 'RI', 'VT', 'NH', 'ME'] },
    { pattern: /southwest/i, states: ['TX', 'OK', 'NM', 'AZ'] },
    { pattern: /mid[\s-]?atlantic/i, states: ['MD', 'DE', 'DC', 'VA', 'WV', 'NJ', 'PA'] },
  ];

  // Hard constraint language
  // Only truly exclusive language triggers hard disqualification ("focused on" is too broad)
  const hardPatterns = [/\bonly\s+in\b/i, /\bexclusively\b/i, /\blimited\s+to\b/i];

  for (const { pattern, states } of regionPatterns) {
    if (pattern.test(thesisLower)) {
      const isHard = hardPatterns.some(hp => hp.test(thesisLower));
      if (isHard && !states.includes(dealState)) {
        return {
          hardDisqualify: true,
          reasoning: `Buyer thesis has hard geographic constraint ("${thesisLower.match(pattern)?.[0]}") and deal state ${dealState} is outside`
        };
      }
    }
  }

  return { hardDisqualify: false, reasoning: '' };
}
