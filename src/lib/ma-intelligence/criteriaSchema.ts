/**
 * Standardized Criteria Schema v1.0
 * Single source of truth for all criteria structures across the M&A system.
 * Used by: generate-ma-guide, parse-fit-criteria, score-deal, score-buyer-deal, AIResearchSection
 */

// =============================================================================
// SIZE CRITERIA
// =============================================================================
export interface SizeCriteria {
  min_revenue?: number;        // In millions (e.g., 2.5 = $2.5M)
  max_revenue?: number;        // In millions
  min_ebitda?: number;         // In millions
  max_ebitda?: number;         // In millions
  min_locations?: number;
  max_locations?: number;
  min_employees?: number;
  max_employees?: number;
  min_revenue_per_location?: number;  // In millions
  min_sqft_per_location?: number;
  // Valuation multiples (separate from dollar amounts!)
  ebitda_multiple_min?: string;  // e.g., "3x"
  ebitda_multiple_max?: string;  // e.g., "8x"
  revenue_multiple_min?: string;
  revenue_multiple_max?: string;
}

// =============================================================================
// SERVICE CRITERIA
// =============================================================================
export interface ServiceCriteria {
  primary_focus: string[];      // CRITICAL: Primary services buyers target
  required_services: string[];   // Must-have services
  preferred_services: string[];  // Nice-to-have services
  excluded_services: string[];   // Deal-breaker services
  business_model?: string;       // B2B, B2C, Mixed
  recurring_revenue_min?: number; // As percentage (e.g., 30 = 30%)
  customer_profile?: string;
}

// =============================================================================
// GEOGRAPHY CRITERIA
// =============================================================================
export interface GeographyCriteria {
  required_regions: string[];    // Must be in these regions
  preferred_regions: string[];   // Bonus for these regions
  excluded_regions: string[];    // Avoid these regions
  priority_metros: string[];     // Specific metro areas to target
  min_market_population?: number; // Minimum MSA population
  coverage_type?: 'national' | 'regional' | 'local';
  hq_requirements?: string;
}

// =============================================================================
// BUYER TYPE CRITERIA
// =============================================================================
export interface BuyerType {
  type_name: string;
  priority_order: number;
  description?: string;
  ownership_profile?: string;    // "Large PE-backed", "Family office", etc.
  min_ebitda?: number;           // In millions
  max_ebitda?: number;           // In millions
  min_locations?: number;
  max_locations?: number;
  min_revenue?: number;          // In millions
  max_revenue?: number;          // In millions
  geographic_scope?: string;     // "National", "Regional", "Local"
  geographic_rules?: string;     // Specific rules for matching
  acquisition_style?: string;    // "Multi-location", "Single location OK", "Platform only"
  deal_requirements?: string;
  exclusions?: string;
  fit_notes?: string;
  // Valuation multiples
  ebitda_multiple_min?: string;
  ebitda_multiple_max?: string;
}

export interface BuyerTypesCriteria {
  buyer_types: BuyerType[];
}

// =============================================================================
// COMPLETE TRACKER CRITERIA
// =============================================================================
export interface TrackerCriteria {
  size_criteria: SizeCriteria | null;
  service_criteria: ServiceCriteria | null;
  geography_criteria: GeographyCriteria | null;
  buyer_types_criteria: BuyerTypesCriteria | null;
}

// =============================================================================
// VALIDATION RESULT
// =============================================================================
export interface CriteriaValidationResult {
  isValid: boolean;
  status: 'complete' | 'partial' | 'insufficient';
  completenessScore: number;  // 0-100
  missingFields: string[];
  warnings: string[];
  details: {
    hasSize: boolean;
    hasService: boolean;
    hasGeography: boolean;
    hasBuyerTypes: boolean;
    hasPrimaryFocus: boolean;
  };
}

// =============================================================================
// SCORING STATUS
// =============================================================================
export interface ScoringStatus {
  canScore: boolean;
  status: 'ready' | 'needs_review' | 'insufficient_data';
  missingCriteria: string[];
  message: string;
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate criteria completeness before scoring
 */
export function validateCriteria(criteria: TrackerCriteria): CriteriaValidationResult {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  const hasSize = !!(
    criteria.size_criteria &&
    (criteria.size_criteria.min_revenue || criteria.size_criteria.min_ebitda)
  );

  const hasService = !!(
    criteria.service_criteria &&
    criteria.service_criteria.primary_focus &&
    criteria.service_criteria.primary_focus.length > 0
  );

  const hasPrimaryFocus = !!(
    criteria.service_criteria?.primary_focus &&
    criteria.service_criteria.primary_focus.length > 0
  );

  const hasGeography = !!(
    criteria.geography_criteria &&
    (
      (criteria.geography_criteria.required_regions?.length || 0) > 0 ||
      (criteria.geography_criteria.preferred_regions?.length || 0) > 0
    )
  );

  const hasBuyerTypes = !!(
    criteria.buyer_types_criteria?.buyer_types &&
    criteria.buyer_types_criteria.buyer_types.length > 0
  );

  // Build missing fields list
  if (!hasSize) missingFields.push('size_criteria');
  if (!hasService) missingFields.push('service_criteria');
  if (!hasPrimaryFocus) missingFields.push('primary_focus');
  if (!hasGeography) missingFields.push('geography_criteria');
  if (!hasBuyerTypes) missingFields.push('buyer_types');

  // Add warnings
  if (hasService && !hasPrimaryFocus) {
    warnings.push('Service criteria defined but no primary_focus - scoring will give benefit of doubt');
  }

  if (criteria.service_criteria?.excluded_services?.length === 0) {
    warnings.push('No excluded_services defined - cannot filter off-thesis deals');
  }

  // Calculate completeness score
  let score = 0;
  if (hasSize) score += 25;
  if (hasService) score += 25;
  if (hasPrimaryFocus) score += 15; // Bonus for primary focus specifically
  if (hasGeography) score += 20;
  if (hasBuyerTypes) score += 15;

  // Determine status
  let status: 'complete' | 'partial' | 'insufficient';
  if (score >= 80 && hasPrimaryFocus) {
    status = 'complete';
  } else if (score >= 40) {
    status = 'partial';
  } else {
    status = 'insufficient';
  }

  return {
    isValid: status !== 'insufficient',
    status,
    completenessScore: score,
    missingFields,
    warnings,
    details: {
      hasSize,
      hasService,
      hasGeography,
      hasBuyerTypes,
      hasPrimaryFocus,
    }
  };
}

/**
 * Check if criteria is sufficient for accurate scoring
 */
export function getScoringStatus(criteria: TrackerCriteria | null): ScoringStatus {
  if (!criteria) {
    return {
      canScore: false,
      status: 'insufficient_data',
      missingCriteria: ['all'],
      message: 'No criteria configured. Please generate or configure criteria first.'
    };
  }

  const validation = validateCriteria(criteria);

  if (validation.status === 'complete') {
    return {
      canScore: true,
      status: 'ready',
      missingCriteria: [],
      message: 'Criteria complete. Scoring will be accurate.'
    };
  }

  if (validation.status === 'partial') {
    return {
      canScore: true,
      status: 'needs_review',
      missingCriteria: validation.missingFields,
      message: `Partial criteria. Missing: ${validation.missingFields.join(', ')}. Results may be less accurate.`
    };
  }

  return {
    canScore: false,
    status: 'insufficient_data',
    missingCriteria: validation.missingFields,
    message: `Insufficient criteria for scoring. Missing: ${validation.missingFields.join(', ')}`
  };
}

// =============================================================================
// PARSING UTILITIES
// =============================================================================

/**
 * Parse raw criteria from database or API into typed structure
 */
export function parseCriteria(raw: {
  size_criteria?: any;
  service_criteria?: any;
  geography_criteria?: any;
  buyer_types_criteria?: any;
}): TrackerCriteria {
  return {
    size_criteria: parseSizeCriteria(raw.size_criteria),
    service_criteria: parseServiceCriteria(raw.service_criteria),
    geography_criteria: parseGeographyCriteria(raw.geography_criteria),
    buyer_types_criteria: parseBuyerTypesCriteria(raw.buyer_types_criteria),
  };
}

function parseSizeCriteria(raw: any): SizeCriteria | null {
  if (!raw) return null;
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return {
    min_revenue: parseNumber(data.min_revenue),
    max_revenue: parseNumber(data.max_revenue),
    min_ebitda: parseNumber(data.min_ebitda),
    max_ebitda: parseNumber(data.max_ebitda),
    min_locations: parseNumber(data.min_locations),
    max_locations: parseNumber(data.max_locations),
    min_employees: parseNumber(data.min_employees),
    max_employees: parseNumber(data.max_employees),
    min_revenue_per_location: parseNumber(data.min_revenue_per_location),
    min_sqft_per_location: parseNumber(data.min_sqft_per_location),
    ebitda_multiple_min: data.ebitda_multiple_min,
    ebitda_multiple_max: data.ebitda_multiple_max,
    revenue_multiple_min: data.revenue_multiple_min,
    revenue_multiple_max: data.revenue_multiple_max,
  };
}

function parseServiceCriteria(raw: any): ServiceCriteria | null {
  if (!raw) return null;
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return {
    primary_focus: ensureArray(data.primary_focus || data.primaryFocusServices),
    required_services: ensureArray(data.required_services),
    preferred_services: ensureArray(data.preferred_services),
    excluded_services: ensureArray(data.excluded_services || data.excludedServices),
    business_model: data.business_model,
    recurring_revenue_min: parseNumber(data.recurring_revenue_min),
    customer_profile: data.customer_profile,
  };
}

function parseGeographyCriteria(raw: any): GeographyCriteria | null {
  if (!raw) return null;
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return {
    required_regions: ensureArray(data.required_regions),
    preferred_regions: ensureArray(data.preferred_regions),
    excluded_regions: ensureArray(data.excluded_regions),
    priority_metros: ensureArray(data.priority_metros),
    min_market_population: parseNumber(data.min_market_population),
    coverage_type: data.coverage_type,
    hq_requirements: data.hq_requirements,
  };
}

function parseBuyerTypesCriteria(raw: any): BuyerTypesCriteria | null {
  if (!raw) return null;
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const buyerTypes = ensureArray(data.buyer_types || data.buyerTypes);

  return {
    buyer_types: buyerTypes.map((bt: any) => ({
      type_name: bt.type_name || bt.typeName || 'Unknown',
      priority_order: parseNumber(bt.priority_order || bt.priorityOrder) || 99,
      description: bt.description,
      ownership_profile: bt.ownership_profile || bt.ownershipProfile,
      min_ebitda: parseNumber(bt.min_ebitda || bt.minEbitda),
      max_ebitda: parseNumber(bt.max_ebitda || bt.maxEbitda),
      min_locations: parseNumber(bt.min_locations || bt.minLocations),
      max_locations: parseNumber(bt.max_locations || bt.maxLocations),
      min_revenue: parseNumber(bt.min_revenue || bt.minRevenue),
      max_revenue: parseNumber(bt.max_revenue || bt.maxRevenue),
      geographic_scope: bt.geographic_scope || bt.geographicScope,
      geographic_rules: bt.geographic_rules || bt.geographicRules,
      acquisition_style: bt.acquisition_style || bt.acquisitionStyle,
      deal_requirements: bt.deal_requirements || bt.dealRequirements,
      exclusions: bt.exclusions,
      fit_notes: bt.fit_notes || bt.fitNotes,
      ebitda_multiple_min: bt.ebitda_multiple_min,
      ebitda_multiple_max: bt.ebitda_multiple_max,
    })),
  };
}

// Helper functions
function parseNumber(val: any): number | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'number') return val;

  // Handle string values like "$2.5M", "2.5", "2,500,000"
  const strVal = String(val).replace(/[$,]/g, '');

  // Handle millions notation
  if (/[mM]$/i.test(strVal)) {
    return parseFloat(strVal.replace(/[mM]$/i, ''));
  }

  // Handle thousands notation
  if (/[kK]$/i.test(strVal)) {
    return parseFloat(strVal.replace(/[kK]$/i, '')) / 1000;
  }

  const num = parseFloat(strVal);
  return isNaN(num) ? undefined : num;
}

function ensureArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map(v => String(v).trim()).filter(Boolean);
  }
  if (typeof val === 'string') {
    // Try to parse as JSON array
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) {
        return parsed.map(v => String(v).trim()).filter(Boolean);
      }
    } catch {
      // Not JSON, treat as single item
      return [val.trim()].filter(Boolean);
    }
  }
  return [];
}

// =============================================================================
// FIELD MAPPINGS (for consistent naming across systems)
// =============================================================================
export const CRITERIA_FIELD_MAPPINGS = {
  // Size fields
  size: {
    minRevenue: ['min_revenue', 'minRevenue', 'minimum_revenue'],
    maxRevenue: ['max_revenue', 'maxRevenue', 'maximum_revenue'],
    minEbitda: ['min_ebitda', 'minEbitda', 'minimum_ebitda'],
    maxEbitda: ['max_ebitda', 'maxEbitda', 'maximum_ebitda'],
  },
  // Service fields
  service: {
    primaryFocus: ['primary_focus', 'primaryFocusServices', 'primaryFocus', 'required_services'],
    excludedServices: ['excluded_services', 'excludedServices', 'services_to_avoid'],
  },
  // Geography fields
  geography: {
    requiredRegions: ['required_regions', 'requiredRegions', 'priority_regions'],
    preferredRegions: ['preferred_regions', 'preferredRegions'],
    excludedRegions: ['excluded_regions', 'excludedRegions', 'regions_to_avoid'],
  },
} as const;
