/**
 * Geography Utilities for Proximity-Based Scoring
 *
 * Provides state adjacency lookups and proximity scoring for buyer-deal matching.
 * Adjacent states are considered ~100 miles apart on average.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Cache for adjacency data to avoid repeated DB queries
// TTL of 30 minutes to pick up DB changes without restarting the isolate
const CACHE_TTL_MS = 30 * 60 * 1000;
let adjacencyCache: Map<string, string[]> | null = null;
let regionCache: Map<string, string> | null = null;
let cacheLoadedAt: number = 0;

/**
 * Initialize adjacency cache from database
 */
async function initializeCache(supabaseUrl: string, supabaseKey: string) {
  const now = Date.now();
  if (adjacencyCache && regionCache && (now - cacheLoadedAt) < CACHE_TTL_MS) return;

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('geographic_adjacency')
    .select('state_code, adjacent_states, region');

  if (error) {
    console.error('Failed to load geographic adjacency data:', error);
    throw error;
  }

  adjacencyCache = new Map();
  regionCache = new Map();

  for (const row of data || []) {
    adjacencyCache.set(row.state_code, row.adjacent_states);
    regionCache.set(row.state_code, row.region);
  }

  cacheLoadedAt = Date.now();
  console.log(`Loaded adjacency data for ${adjacencyCache.size} states`);
}

/**
 * Get adjacent states for a given state
 *
 * @param stateCode - 2-letter state code (e.g., "CO")
 * @returns Array of adjacent state codes
 */
export async function getAdjacentStates(
  stateCode: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<string[]> {
  await initializeCache(supabaseUrl, supabaseKey);

  const normalized = stateCode.toUpperCase().trim();
  return adjacencyCache?.get(normalized) || [];
}

/**
 * Check if two states are adjacent (share a border)
 *
 * @param state1 - First state code
 * @param state2 - Second state code
 * @returns true if states share a border
 */
export async function isAdjacent(
  state1: string,
  state2: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<boolean> {
  await initializeCache(supabaseUrl, supabaseKey);

  const normalized1 = state1.toUpperCase().trim();
  const normalized2 = state2.toUpperCase().trim();

  if (normalized1 === normalized2) return false; // Same state, not adjacent

  const adjacent = adjacencyCache?.get(normalized1) || [];
  return adjacent.includes(normalized2);
}

/**
 * Get region for a state
 *
 * @param stateCode - 2-letter state code
 * @returns Region name (Northeast, Southeast, Midwest, Southwest, West, Pacific)
 */
export async function getRegion(
  stateCode: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<string | null> {
  await initializeCache(supabaseUrl, supabaseKey);

  const normalized = stateCode.toUpperCase().trim();
  return regionCache?.get(normalized) || null;
}

/**
 * Check if two states are in the same region
 *
 * @param state1 - First state code
 * @param state2 - Second state code
 * @returns true if states are in the same region
 */
export async function isSameRegion(
  state1: string,
  state2: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<boolean> {
  await initializeCache(supabaseUrl, supabaseKey);

  const normalized1 = state1.toUpperCase().trim();
  const normalized2 = state2.toUpperCase().trim();

  const region1 = regionCache?.get(normalized1);
  const region2 = regionCache?.get(normalized2);

  return region1 !== null && region1 === region2;
}

/**
 * Calculate proximity score between deal state and buyer states
 *
 * Scoring:
 * - Exact match: 90-100 points
 * - Adjacent state (1-hop ~100 miles): 60-80 points
 * - Same region: 40-60 points
 * - Different region: 0-30 points
 *
 * @param dealState - Deal's primary state
 * @param buyerStates - Array of buyer's target or footprint states
 * @returns Proximity score (0-100)
 */
export async function calculateProximityScore(
  dealState: string,
  buyerStates: string[],
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ score: number; reasoning: string }> {
  if (!dealState || !buyerStates || buyerStates.length === 0) {
    return { score: 0, reasoning: 'No geography data available' };
  }

  await initializeCache(supabaseUrl, supabaseKey);

  const normalizedDealState = dealState.toUpperCase().trim();
  const normalizedBuyerStates = buyerStates.map(s => s.toUpperCase().trim());

  // Check for exact match
  if (normalizedBuyerStates.includes(normalizedDealState)) {
    return {
      score: 95,
      reasoning: `Exact state match: ${normalizedDealState}`
    };
  }

  // Check for adjacent states
  const adjacentStates = adjacencyCache?.get(normalizedDealState) || [];
  const adjacentMatches = normalizedBuyerStates.filter(s => adjacentStates.includes(s));

  if (adjacentMatches.length > 0) {
    const score = 70 + (adjacentMatches.length * 5); // Bonus for multiple adjacent states
    return {
      score: Math.min(score, 85), // Cap at 85
      reasoning: `Adjacent state match (~100 miles): ${adjacentMatches.join(', ')}`
    };
  }

  // Check for same region
  const dealRegion = regionCache?.get(normalizedDealState);
  if (dealRegion) {
    const regionalMatches = normalizedBuyerStates.filter(s => {
      const buyerRegion = regionCache?.get(s);
      return buyerRegion === dealRegion;
    });

    if (regionalMatches.length > 0) {
      const score = 45 + (regionalMatches.length * 3); // Bonus for multiple regional states
      return {
        score: Math.min(score, 60), // Cap at 60
        reasoning: `Same region (${dealRegion}): ${regionalMatches.join(', ')}`
      };
    }
  }

  // Different region - low score
  return {
    score: 20,
    reasoning: `Different region - no proximity match`
  };
}

/**
 * Calculate distance tier between deal and buyer
 *
 * @returns 'exact' | 'adjacent' | 'regional' | 'distant'
 */
export async function getProximityTier(
  dealState: string,
  buyerStates: string[],
  supabaseUrl: string,
  supabaseKey: string
): Promise<'exact' | 'adjacent' | 'regional' | 'distant'> {
  if (!dealState || !buyerStates || buyerStates.length === 0) {
    return 'distant';
  }

  await initializeCache(supabaseUrl, supabaseKey);

  const normalizedDealState = dealState.toUpperCase().trim();
  const normalizedBuyerStates = buyerStates.map(s => s.toUpperCase().trim());

  // Exact match
  if (normalizedBuyerStates.includes(normalizedDealState)) {
    return 'exact';
  }

  // Adjacent
  const adjacentStates = adjacencyCache?.get(normalizedDealState) || [];
  if (normalizedBuyerStates.some(s => adjacentStates.includes(s))) {
    return 'adjacent';
  }

  // Regional
  const dealRegion = regionCache?.get(normalizedDealState);
  if (dealRegion && normalizedBuyerStates.some(s => regionCache?.get(s) === dealRegion)) {
    return 'regional';
  }

  return 'distant';
}

/**
 * Normalize state code variations to 2-letter uppercase
 *
 * @param state - State name, code, or variant
 * @returns 2-letter state code or null if invalid
 */
export function normalizeStateCode(state: string): string | null {
  if (!state || typeof state !== 'string') return null;

  const trimmed = state.trim().toUpperCase();

  // Already 2-letter code
  if (trimmed.length === 2 && /^[A-Z]{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Common state name to code mappings (add more as needed)
  const stateNames: Record<string, string> = {
    'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR',
    'CALIFORNIA': 'CA', 'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE',
    'FLORIDA': 'FL', 'GEORGIA': 'GA', 'HAWAII': 'HI', 'IDAHO': 'ID',
    'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA', 'KANSAS': 'KS',
    'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
    'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS',
    'MISSOURI': 'MO', 'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV',
    'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
    'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH', 'OKLAHOMA': 'OK',
    'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
    'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT',
    'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV',
    'WISCONSIN': 'WI', 'WYOMING': 'WY', 'DISTRICT OF COLUMBIA': 'DC'
  };

  return stateNames[trimmed] || null;
}
