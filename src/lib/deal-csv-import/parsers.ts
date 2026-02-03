/**
 * Unified parsing utilities for Deal CSV Import
 */

/**
 * Normalize CSV header (strip BOM and whitespace)
 */
export function normalizeHeader(header: string): string {
  return header.replace(/^\uFEFF/, "").trim();
}

/**
 * Parse numeric value with support for currency symbols and M/K suffixes
 * Examples: "$3,000,000" -> 3000000, "2.5M" -> 2500000, "450K" -> 450000
 */
export function parseNumericValue(value: string | null | undefined): number | null {
  if (!value) return null;
  
  let cleaned = String(value).trim();
  if (!cleaned || cleaned === '-' || cleaned.toLowerCase() === 'n/a') return null;
  
  let multiplier = 1;
  
  // Handle M suffix (millions)
  if (/M$/i.test(cleaned) || /\bM\b/i.test(cleaned)) {
    multiplier = 1_000_000;
    cleaned = cleaned.replace(/M/gi, "");
  }
  // Handle K suffix (thousands)
  else if (/K$/i.test(cleaned) || /\bK\b/i.test(cleaned)) {
    multiplier = 1_000;
    cleaned = cleaned.replace(/K/gi, "");
  }
  
  // Remove currency symbols, commas, and other non-numeric characters
  cleaned = cleaned.replace(/[$,]/g, "");
  cleaned = cleaned.replace(/[^0-9.\-]/g, "");
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num * multiplier;
}

/**
 * Parse integer value (rounds to nearest whole number)
 */
export function parseIntegerValue(value: string | null | undefined): number | null {
  const num = parseNumericValue(value);
  return num !== null ? Math.round(num) : null;
}

/**
 * Parse array value from comma/semicolon separated string
 */
export function parseArrayValue(value: string | null | undefined): string[] {
  if (!value) return [];
  return String(value)
    .split(/[,;|]/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Normalize state code to 2-letter abbreviation
 */
export function normalizeStateCode(value: string): string | null {
  if (!value) return null;
  
  const cleaned = value.trim().toUpperCase();
  
  // Already a 2-letter code
  if (/^[A-Z]{2}$/.test(cleaned)) {
    return cleaned;
  }
  
  // Try to extract 2-letter code from longer string
  const match = cleaned.match(/\b([A-Z]{2})\b/);
  if (match) return match[1];
  
  // State name to abbreviation map
  const stateMap: Record<string, string> = {
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
    'WISCONSIN': 'WI', 'WYOMING': 'WY',
  };
  
  return stateMap[cleaned] || null;
}

/**
 * Street address indicators for filtering
 */
const STREET_INDICATORS = /\b(rd\.?|road|st\.?|street|ave\.?|avenue|blvd\.?|boulevard|ln\.?|lane|dr\.?|drive|ct\.?|court|pl\.?|place|way|pkwy|park|hwy|highway|industrial|park)\b/i;

/**
 * Extract city, state, zip from a full address string
 * Handles multi-line addresses and various formats
 */
export function extractAddressComponents(rawAddress: string): {
  city?: string;
  state?: string;
  zip?: string;
} {
  if (!rawAddress) return {};
  
  // Split by newlines and get the last meaningful line
  const lines = rawAddress
    .split(/[\n\r]+/)
    .map(l => l.trim())
    .filter(Boolean);
  
  // Try each line from last to first to find city/state pattern
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    
    // Pattern: "City, ST 12345" or "City, ST"
    const match = line.match(/([^,]+),\s*([A-Z]{2})\s*(\d{5})?/i);
    if (match) {
      const potentialCity = match[1].trim();
      const state = match[2].toUpperCase();
      const zip = match[3];
      
      // Only use as city if it doesn't look like a street address
      const city = STREET_INDICATORS.test(potentialCity) ? undefined : potentialCity;
      
      return { city, state, zip: zip || undefined };
    }
  }
  
  return {};
}

/**
 * Parse date string to ISO format
 */
export function parseDateValue(value: string | null | undefined): string | null {
  if (!value) return null;
  
  try {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  } catch {
    // Invalid date
  }
  
  return null;
}
