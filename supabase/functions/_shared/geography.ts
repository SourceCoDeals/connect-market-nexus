// Shared geography normalization utilities for edge functions
// This is the single source of truth for geography normalization

// All valid US state abbreviations
export const ALL_US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY'
];

// Map full state names to abbreviations
export const STATE_NAME_TO_ABBREV: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'district of columbia': 'DC', 'florida': 'FL',
  'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN',
  'iowa': 'IA', 'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME',
  'maryland': 'MD', 'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH',
  'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND',
  'ohio': 'OH', 'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
};

// Common misspellings
export const GEO_MISSPELLINGS: Record<string, string> = {
  'conneticut': 'CT', 'conecticut': 'CT', 'conneticutt': 'CT',
  'massachusets': 'MA', 'massachussetts': 'MA', 'massachucetts': 'MA',
  'pennsilvania': 'PA', 'pensylvania': 'PA',
  'tennesee': 'TN', 'tennesse': 'TN',
  'missisipi': 'MS', 'mississipi': 'MS', 'missisippi': 'MS',
  'louisianna': 'LA', 'lousiana': 'LA',
  'virgina': 'VA',
  'north carolia': 'NC', 'n carolina': 'NC', 'n. carolina': 'NC',
  'south carolia': 'SC', 's carolina': 'SC', 's. carolina': 'SC',
  'west virgina': 'WV', 'w virginia': 'WV', 'w. virginia': 'WV',
  'new jersery': 'NJ',
};

// Regional mappings - translate region names to their constituent states
export const REGION_TO_STATES: Record<string, string[]> = {
  // Standard US Census regions
  'midwest': ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'],
  'the midwest': ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'],
  'midwestern': ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'],
  'northeast': ['CT', 'ME', 'MA', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'],
  'the northeast': ['CT', 'ME', 'MA', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'],
  'northeastern': ['CT', 'ME', 'MA', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'],
  'new england': ['CT', 'ME', 'MA', 'NH', 'RI', 'VT'],
  'south': ['AL', 'AR', 'DE', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV'],
  'the south': ['AL', 'AR', 'DE', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV'],
  'southern': ['AL', 'AR', 'DE', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV'],
  'southeast': ['AL', 'FL', 'GA', 'KY', 'MS', 'NC', 'SC', 'TN', 'VA', 'WV'],
  'the southeast': ['AL', 'FL', 'GA', 'KY', 'MS', 'NC', 'SC', 'TN', 'VA', 'WV'],
  'southeastern': ['AL', 'FL', 'GA', 'KY', 'MS', 'NC', 'SC', 'TN', 'VA', 'WV'],
  'southwest': ['AZ', 'NM', 'OK', 'TX'],
  'the southwest': ['AZ', 'NM', 'OK', 'TX'],
  'southwestern': ['AZ', 'NM', 'OK', 'TX'],
  'west': ['AK', 'AZ', 'CA', 'CO', 'HI', 'ID', 'MT', 'NV', 'NM', 'OR', 'UT', 'WA', 'WY'],
  'the west': ['AK', 'AZ', 'CA', 'CO', 'HI', 'ID', 'MT', 'NV', 'NM', 'OR', 'UT', 'WA', 'WY'],
  'western': ['AK', 'AZ', 'CA', 'CO', 'HI', 'ID', 'MT', 'NV', 'NM', 'OR', 'UT', 'WA', 'WY'],
  'pacific northwest': ['OR', 'WA', 'ID'],
  'the pacific northwest': ['OR', 'WA', 'ID'],
  'pnw': ['OR', 'WA', 'ID'],
  'northwest': ['OR', 'WA', 'ID', 'MT', 'WY'],
  'the northwest': ['OR', 'WA', 'ID', 'MT', 'WY'],
  'northwestern': ['OR', 'WA', 'ID', 'MT', 'WY'],
  'mountain west': ['AZ', 'CO', 'ID', 'MT', 'NV', 'NM', 'UT', 'WY'],
  'rocky mountain': ['CO', 'ID', 'MT', 'UT', 'WY'],
  'rockies': ['CO', 'ID', 'MT', 'UT', 'WY'],
  'great plains': ['KS', 'NE', 'ND', 'OK', 'SD', 'TX'],
  'plains states': ['KS', 'NE', 'ND', 'OK', 'SD'],
  'mid-atlantic': ['DE', 'MD', 'NJ', 'NY', 'PA'],
  'mid atlantic': ['DE', 'MD', 'NJ', 'NY', 'PA'],
  'midatlantic': ['DE', 'MD', 'NJ', 'NY', 'PA'],
  'east coast': ['CT', 'DE', 'FL', 'GA', 'MA', 'MD', 'ME', 'NC', 'NH', 'NJ', 'NY', 'PA', 'RI', 'SC', 'VA', 'VT'],
  'eastern seaboard': ['CT', 'DE', 'FL', 'GA', 'MA', 'MD', 'ME', 'NC', 'NH', 'NJ', 'NY', 'PA', 'RI', 'SC', 'VA', 'VT'],
  'west coast': ['CA', 'OR', 'WA'],
  'pacific': ['CA', 'OR', 'WA', 'AK', 'HI'],
  'gulf coast': ['AL', 'FL', 'LA', 'MS', 'TX'],
  'gulf states': ['AL', 'FL', 'LA', 'MS', 'TX'],
  'sun belt': ['AL', 'AZ', 'CA', 'FL', 'GA', 'LA', 'MS', 'NM', 'NV', 'SC', 'TX'],
  'sunbelt': ['AL', 'AZ', 'CA', 'FL', 'GA', 'LA', 'MS', 'NM', 'NV', 'SC', 'TX'],
  'rust belt': ['IL', 'IN', 'MI', 'OH', 'PA', 'WI'],
  'rustbelt': ['IL', 'IN', 'MI', 'OH', 'PA', 'WI'],
  'tri-state': ['CT', 'NJ', 'NY'],
  'tristate': ['CT', 'NJ', 'NY'],
  'carolinas': ['NC', 'SC'],
  'the carolinas': ['NC', 'SC'],
  'dakotas': ['ND', 'SD'],
  'the dakotas': ['ND', 'SD'],
  'upper midwest': ['IA', 'MN', 'ND', 'SD', 'WI'],
  'lower midwest': ['IL', 'IN', 'KS', 'MO', 'NE', 'OH'],
  'deep south': ['AL', 'GA', 'LA', 'MS', 'SC'],
  'texas triangle': ['TX'],
};

// Patterns to skip - UI text, URLs, garbage data
const SKIP_PATTERNS = [
  /find\s*(a\s*)?shop/i,
  /near\s*(you|me)/i,
  /body-shop/i,
  /locations?$/i,
  /^https?:\/\//i,
  /\.com/i,
  /\.net/i,
  /\.org/i,
  /click\s*here/i,
  /learn\s*more/i,
  /view\s*all/i,
  /see\s*all/i,
  /^\d+\s*\d*\s*\d*\s*\d*\s*\d*\s*\d*$/,
];

/**
 * Normalize geography input to standardized 2-letter US state abbreviations.
 * Handles various input formats:
 * - Full state names (California → CA)
 * - Misspellings (Conneticut → CT)
 * - City, State format (Jackson, Mississippi → MS)
 * - Regional terms (Midwest, Southeast → expanded states)
 * - National/Nationwide/USA → All 50 states
 * - "X states" patterns (41 states → All 50 if ≥30)
 */
export function normalizeGeography(items: string[] | string | null | undefined): string[] {
  if (!items) return [];
  
  // Convert string input to array
  const inputItems = typeof items === 'string' 
    ? items.split(',').map(s => s.trim()).filter(Boolean)
    : items;
  
  if (!Array.isArray(inputItems) || inputItems.length === 0) return [];

  const normalized: string[] = [];
  
  for (const item of inputItems) {
    if (!item || typeof item !== 'string') continue;
    
    const trimmed = item.trim();
    const upper = trimmed.toUpperCase();
    const lower = trimmed.toLowerCase();
    
    // Skip garbage data patterns
    if (SKIP_PATTERNS.some(pattern => pattern.test(trimmed))) {
      console.log(`[normalizeGeography] Skipping garbage: "${item}"`);
      continue;
    }
    
    // Skip very short or very long entries
    if (trimmed.length < 2 || trimmed.length > 100) {
      continue;
    }
    
    // Check if already valid 2-letter abbreviation
    if (ALL_US_STATES.includes(upper)) {
      normalized.push(upper);
      continue;
    }
    
    // Convert full state name to abbreviation
    const abbrev = STATE_NAME_TO_ABBREV[lower];
    if (abbrev) {
      normalized.push(abbrev);
      continue;
    }
    
    // Handle common misspellings
    if (GEO_MISSPELLINGS[lower]) {
      console.log(`[normalizeGeography] Fixed misspelling: "${item}" → "${GEO_MISSPELLINGS[lower]}"`);
      normalized.push(GEO_MISSPELLINGS[lower]);
      continue;
    }
    
    // Check if it's a regional term (Midwest, Southeast, etc.)
    const regionStates = REGION_TO_STATES[lower];
    if (regionStates) {
      console.log(`[normalizeGeography] Expanding region "${item}" to states: ${regionStates.join(', ')}`);
      normalized.push(...regionStates);
      continue;
    }
    
    // "national"/"nationwide"/"USA" → all 50 states
    if (['national', 'nationwide', 'usa', 'us', 'united states', 'all states'].includes(lower)) {
      console.log(`[normalizeGeography] Expanding "${item}" to all 50 states`);
      normalized.push(...ALL_US_STATES);
      continue;
    }
    
    // Handle "X states" pattern (e.g., "41 states", "50 states")
    const statesMatch = lower.match(/^(\d+)\s*states?$/);
    if (statesMatch) {
      const count = parseInt(statesMatch[1], 10);
      if (count >= 30) {
        console.log(`[normalizeGeography] Expanding "${item}" (${count} states) to all 50`);
        normalized.push(...ALL_US_STATES);
        continue;
      }
      // Less than 30 - skip, we need specific states
      continue;
    }
    
    // Handle "City, State" format with full state name (e.g., "Jackson, Mississippi")
    const cityFullStateMatch = trimmed.match(/,\s*([A-Za-z\s]+)$/);
    if (cityFullStateMatch) {
      const statePart = cityFullStateMatch[1].trim().toLowerCase();
      // Remove parenthetical text like "(and 5 surrounding towns)"
      const cleanedState = statePart.replace(/\s*\([^)]*\)\s*/g, '').trim();
      
      // Check if it's a 2-letter abbreviation
      if (cleanedState.length === 2 && ALL_US_STATES.includes(cleanedState.toUpperCase())) {
        normalized.push(cleanedState.toUpperCase());
        continue;
      }
      
      // Check if it's a full state name
      const stateAbbrev = STATE_NAME_TO_ABBREV[cleanedState];
      if (stateAbbrev) {
        console.log(`[normalizeGeography] Extracted "${stateAbbrev}" from "${item}"`);
        normalized.push(stateAbbrev);
        continue;
      }
    }
    
    // Handle space-separated abbreviations (e.g., "TX OK AR LA")
    if (/^[A-Z]{2}(\s+[A-Z]{2})+$/i.test(trimmed)) {
      const parts = upper.split(/\s+/);
      let allValid = true;
      for (const part of parts) {
        if (ALL_US_STATES.includes(part)) {
          normalized.push(part);
        } else {
          allValid = false;
        }
      }
      if (allValid && parts.length > 1) {
        console.log(`[normalizeGeography] Parsed space-separated from "${item}"`);
        continue;
      }
    }
    
    // Skip invalid entries
    console.warn(`[normalizeGeography] Skipping invalid: "${item}"`);
  }
  
  // Remove duplicates and return sorted
  const unique = [...new Set(normalized)];
  return unique.sort();
}

/**
 * Merge geography arrays - union existing with new values
 */
export function mergeGeography(existing: string[] | null, newValues: string[] | null): string[] | null {
  const existingSet = new Set(existing || []);
  const newSet = new Set(newValues || []);
  const merged = new Set([...existingSet, ...newSet]);
  return merged.size > 0 ? Array.from(merged).sort() : null;
}

/**
 * Extract state abbreviation from a city/state string like "Houston, TX" or "Houston, Texas"
 */
export function extractStateFromHeadquarters(headquarters: string | null | undefined): string | null {
  if (!headquarters) return null;
  
  const trimmed = headquarters.trim();
  
  // Try to match "City, ST" or "City, State Name" pattern
  const cityStateMatch = trimmed.match(/,\s*([A-Za-z\s]+)$/);
  if (cityStateMatch) {
    const statePart = cityStateMatch[1].trim();
    const upper = statePart.toUpperCase();
    const lower = statePart.toLowerCase();
    
    // Check if it's already a 2-letter abbreviation
    if (statePart.length === 2 && ALL_US_STATES.includes(upper)) {
      return upper;
    }
    
    // Check if it's a full state name
    const abbrev = STATE_NAME_TO_ABBREV[lower];
    if (abbrev) {
      return abbrev;
    }
    
    // Check misspellings
    if (GEO_MISSPELLINGS[lower]) {
      return GEO_MISSPELLINGS[lower];
    }
  }
  
  return null;
}
