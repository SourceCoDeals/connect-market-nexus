/**
 * Geography Utilities for Proximity-Based Scoring
 *
 * Provides state adjacency lookups and proximity scoring for buyer-deal matching.
 * Uses a built-in adjacency map with optional DB override via geographic_adjacency table.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { normalizeState } from './geography.ts';

// Cache for adjacency data
const CACHE_TTL_MS = 30 * 60 * 1000;
let adjacencyCache: Map<string, string[]> | null = null;
let regionCache: Map<string, string> | null = null;
let cacheLoadedAt: number = 0;

// ============================================================================
// BUILT-IN STATE ADJACENCY + REGION DATA (fallback when DB table missing)
// ============================================================================

const BUILT_IN_ADJACENCY: Record<string, string[]> = {
  AL: ['FL','GA','MS','TN'], AK: [], AZ: ['CA','NM','NV','UT'],
  AR: ['LA','MO','MS','OK','TN','TX'], CA: ['AZ','NV','OR'], CO: ['KS','NE','NM','OK','UT','WY'],
  CT: ['MA','NY','RI'], DE: ['MD','NJ','PA'], FL: ['AL','GA'],
  GA: ['AL','FL','NC','SC','TN'], HI: [], ID: ['MT','NV','OR','UT','WA','WY'],
  IL: ['IN','IA','KY','MO','WI'], IN: ['IL','KY','MI','OH'], IA: ['IL','MN','MO','NE','SD','WI'],
  KS: ['CO','MO','NE','OK'], KY: ['IL','IN','MO','OH','TN','VA','WV'],
  LA: ['AR','MS','TX'], ME: ['NH'], MD: ['DE','PA','VA','WV','DC'],
  MA: ['CT','NH','NY','RI','VT'], MI: ['IN','OH','WI'], MN: ['IA','ND','SD','WI'],
  MS: ['AL','AR','LA','TN'], MO: ['AR','IL','IA','KS','KY','NE','OK','TN'],
  MT: ['ID','ND','SD','WY'], NE: ['CO','IA','KS','MO','SD','WY'],
  NV: ['AZ','CA','ID','OR','UT'], NH: ['MA','ME','VT'], NJ: ['DE','NY','PA'],
  NM: ['AZ','CO','OK','TX','UT'], NY: ['CT','MA','NJ','PA','VT'],
  NC: ['GA','SC','TN','VA'], ND: ['MN','MT','SD'], OH: ['IN','KY','MI','PA','WV'],
  OK: ['AR','CO','KS','MO','NM','TX'], OR: ['CA','ID','NV','WA'],
  PA: ['DE','MD','NJ','NY','OH','WV'], RI: ['CT','MA'], SC: ['GA','NC'],
  SD: ['IA','MN','MT','ND','NE','WY'], TN: ['AL','AR','GA','KY','MO','MS','NC','VA'],
  TX: ['AR','LA','NM','OK'], UT: ['AZ','CO','ID','NM','NV','WY'],
  VT: ['MA','NH','NY'], VA: ['KY','MD','NC','TN','WV','DC'], WA: ['ID','OR'],
  WV: ['KY','MD','OH','PA','VA'], WI: ['IA','IL','MI','MN'], WY: ['CO','ID','MT','NE','SD','UT'],
  DC: ['MD','VA'],
};

const BUILT_IN_REGIONS: Record<string, string> = {
  CT: 'Northeast', ME: 'Northeast', MA: 'Northeast', NH: 'Northeast', RI: 'Northeast', VT: 'Northeast',
  NJ: 'Northeast', NY: 'Northeast', PA: 'Northeast',
  IL: 'Midwest', IN: 'Midwest', MI: 'Midwest', OH: 'Midwest', WI: 'Midwest',
  IA: 'Midwest', KS: 'Midwest', MN: 'Midwest', MO: 'Midwest', NE: 'Midwest', ND: 'Midwest', SD: 'Midwest',
  DE: 'Southeast', FL: 'Southeast', GA: 'Southeast', MD: 'Southeast', NC: 'Southeast', SC: 'Southeast',
  VA: 'Southeast', DC: 'Southeast', WV: 'Southeast', AL: 'Southeast', KY: 'Southeast',
  MS: 'Southeast', TN: 'Southeast', AR: 'Southeast', LA: 'Southeast',
  AZ: 'Southwest', NM: 'Southwest', OK: 'Southwest', TX: 'Southwest',
  CO: 'West', ID: 'West', MT: 'West', NV: 'West', UT: 'West', WY: 'West',
  AK: 'Pacific', CA: 'Pacific', HI: 'Pacific', OR: 'Pacific', WA: 'Pacific',
};

/**
 * Initialize adjacency cache — tries DB first, falls back to built-in data
 */
async function initializeCache(supabaseUrl: string, supabaseKey: string) {
  const now = Date.now();
  if (adjacencyCache && regionCache && (now - cacheLoadedAt) < CACHE_TTL_MS) return;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from('geographic_adjacency')
      .select('state_code, adjacent_states, region');

    if (!error && data && data.length > 0) {
      adjacencyCache = new Map();
      regionCache = new Map();
      for (const row of data) {
        adjacencyCache.set(row.state_code, row.adjacent_states);
        regionCache.set(row.state_code, row.region);
      }
      cacheLoadedAt = Date.now();
      console.log(`Loaded adjacency data from DB for ${adjacencyCache.size} states`);
      return;
    }
  } catch {
    // DB table doesn't exist or query failed — use built-in
  }

  // Fall back to built-in adjacency data
  adjacencyCache = new Map(Object.entries(BUILT_IN_ADJACENCY));
  regionCache = new Map(Object.entries(BUILT_IN_REGIONS));
  cacheLoadedAt = Date.now();
  console.log(`Using built-in adjacency data for ${adjacencyCache.size} states`);
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

  return region1 !== undefined && region1 !== null && region1 === region2;
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
 * Normalize state code variations to 2-letter uppercase.
 * Delegates to the canonical STATE_MAPPINGS in geography.ts.
 *
 * @param state - State name, code, or variant
 * @returns 2-letter state code or null if invalid
 */
export function normalizeStateCode(state: string): string | null {
  if (!state || typeof state !== 'string') return null;

  const trimmed = state.trim().toUpperCase();

  // Already 2-letter code — pass through (preserves original behavior)
  if (trimmed.length === 2 && /^[A-Z]{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Delegate to canonical normalizeState from geography.ts
  return normalizeState(state);
}
