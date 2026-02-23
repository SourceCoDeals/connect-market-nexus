/**
 * Scoring configuration and constants.
 * All tunable thresholds in one place — values are identical to what was
 * previously hardcoded inline. This is a pure extraction, no behavior change.
 */

// ============================================================================
// SCORING CONFIGURATION
// ============================================================================

export const SCORING_CONFIG = {
  // --- Tier bands (composite score → letter grade) ---
  TIER_A_MIN: 80,
  TIER_B_MIN: 65,
  TIER_C_MIN: 50,
  TIER_D_MIN: 35,

  // --- Size scoring tolerances ---
  SWEET_SPOT_EXACT_TOLERANCE: 0.1,   // ±10% of sweet spot = perfect match
  SWEET_SPOT_NEAR_TOLERANCE: 0.2,    // ±20% of sweet spot = near match
  BELOW_MIN_SLIGHT: 0.9,             // 90% of min = 1-10% below
  BELOW_MIN_MODERATE: 0.7,           // 70% of min = 10-30% below
  ABOVE_MAX_DISQUALIFY: 1.5,         // 150% of max = hard disqualify
  SINGLE_LOCATION_PENALTY: 0.85,     // 15% penalty for single-location deals

  // --- Size multipliers applied to composite score ---
  SIZE_MULT_SWEET_EXACT: 1.0,
  SIZE_MULT_SWEET_NEAR: 0.95,
  SIZE_MULT_IN_RANGE: 1.0,
  SIZE_MULT_SLIGHT_BELOW: 0.7,
  SIZE_MULT_MODERATE_BELOW: 0.5,
  SIZE_MULT_HEAVY_PENALTY: 0.3,
  SIZE_MULT_HEAVY_ALLOW: 0.5,
  SIZE_MULT_ABOVE_MAX: 0.7,

  // --- Service multipliers (score → composite multiplier) ---
  SERVICE_MULT_ZERO: 0.0,
  SERVICE_MULT_BELOW_20: 0.4,
  SERVICE_MULT_BELOW_40: 0.6,
  SERVICE_MULT_BELOW_60: 0.8,
  SERVICE_MULT_BELOW_80: 0.9,
  SERVICE_MULT_ABOVE_80: 1.0,

  // --- Geography mode factors ---
  GEO_MODE_PREFERRED: 0.6,
  GEO_MODE_MINIMAL: 0.25,

  // --- Bonus/penalty caps ---
  THESIS_BONUS_MAX: 20,
  DATA_QUALITY_BONUS_MAX: 10,
  CUSTOM_BONUS_MAX: 25,
  LEARNING_PENALTY_MIN: -5,
  LEARNING_PENALTY_MAX: 25,

  // --- Needs-review thresholds ---
  REVIEW_SCORE_LOW: 50,
  REVIEW_SCORE_HIGH: 65,

  // --- Bulk scoring batch config ---
  BULK_BATCH_SIZE: 5,
  BULK_DELAY_LARGE: 600,   // >100 buyers
  BULK_DELAY_MEDIUM: 400,  // >50 buyers
  BULK_DELAY_SMALL: 300,   // <=50 buyers
} as const;

export type ScoringConfigType = typeof SCORING_CONFIG;

// ============================================================================
// DEFAULT SERVICE ADJACENCY MAP
// Database-configurable: trackers can override via service_adjacency_map field.
// This serves as the fallback when no tracker-specific map exists.
// ============================================================================

export const DEFAULT_SERVICE_ADJACENCY: Record<string, string[]> = {
  "fire restoration": ["water restoration", "mold remediation", "contents cleaning", "roofing", "reconstruction", "smoke damage", "restoration"],
  "water restoration": ["fire restoration", "mold remediation", "plumbing", "flood cleanup", "dehumidification", "restoration"],
  "restoration": ["fire restoration", "water restoration", "mold remediation", "reconstruction", "mitigation", "contents cleaning"],
  "mold remediation": ["water restoration", "fire restoration", "indoor air quality", "restoration"],
  "commercial hvac": ["residential hvac", "mechanical contracting", "plumbing", "building automation", "refrigeration", "controls", "hvac"],
  "residential hvac": ["commercial hvac", "plumbing", "electrical", "home services", "indoor air quality", "hvac"],
  "hvac": ["commercial hvac", "residential hvac", "mechanical contracting", "plumbing", "electrical"],
  "collision repair": ["auto body", "paintless dent repair", "auto glass", "fleet maintenance", "calibration", "automotive"],
  "auto body": ["collision repair", "paint", "auto glass", "fleet services", "automotive"],
  "landscaping": ["hardscaping", "irrigation", "tree care", "snow removal", "lawn maintenance"],
  "plumbing": ["hvac", "mechanical contracting", "water restoration", "drain cleaning", "septic"],
  "electrical": ["hvac", "low voltage", "fire alarm", "building automation", "solar"],
  "roofing": ["siding", "gutters", "exterior restoration", "storm damage", "waterproofing", "restoration"],
  "pest control": ["wildlife removal", "termite", "lawn care", "mosquito control"],
  "janitorial": ["commercial cleaning", "facility maintenance", "carpet cleaning", "window cleaning"],
  "mitigation": ["restoration", "water restoration", "fire restoration", "mold remediation"],
  "disaster recovery": ["restoration", "fire restoration", "water restoration", "mitigation", "mold remediation", "reconstruction"],
  "reconstruction": ["restoration", "fire restoration", "water restoration", "general contracting", "disaster recovery"],
  "contents cleaning": ["restoration", "fire restoration", "water restoration", "pack-out"],
  "automotive": ["auto body", "collision repair", "auto glass", "fleet maintenance", "calibration"],
  "auto glass": ["collision repair", "auto body", "calibration", "automotive"],
  "healthcare": ["medical", "dental", "urgent care", "physical therapy", "home health", "behavioral health"],
  "medical": ["healthcare", "dental", "urgent care", "home health", "physician services"],
  "dental": ["healthcare", "medical", "orthodontics"],
  "it services": ["managed services", "cybersecurity", "cloud", "msp", "technology"],
  "managed services": ["it services", "msp", "cybersecurity", "cloud", "saas"],
  "msp": ["managed services", "it services", "cybersecurity"],
  "accounting": ["tax", "bookkeeping", "financial services", "cpa", "advisory"],
  "engineering": ["consulting", "environmental", "surveying", "architecture"],
  "staffing": ["recruiting", "temp services", "workforce", "hr services"],
  "insurance": ["benefits", "risk management", "brokerage"],
  "home services": ["residential hvac", "plumbing", "electrical", "roofing", "landscaping", "pest control"],
  "solar": ["electrical", "renewable energy", "energy services"],
};

// ============================================================================
// AI FALLBACK TRACKING
// Track when AI scoring fails and falls back to rules-based scoring
// ============================================================================

const aiFallbackCounts: Record<string, number> = {
  service_fit: 0,
  owner_goals: 0,
  thesis_alignment: 0,
};

export function trackAiFallback(phase: string, error: unknown): void {
  aiFallbackCounts[phase] = (aiFallbackCounts[phase] || 0) + 1;
  console.warn(`[AI Fallback] ${phase} failed (count: ${aiFallbackCounts[phase]}):`, error instanceof Error ? error.message : 'unknown');
}

export function getAiFallbackCounts(): Record<string, number> {
  return { ...aiFallbackCounts };
}
