/**
 * Criteria Validation Utilities
 * Provides validation, sanitization, and error detection for criteria data
 */

import {
  TrackerCriteria,
  SizeCriteria,
  ServiceCriteria,
  GeographyCriteria,
  BuyerTypesCriteria,
  CriteriaValidationResult
} from './criteriaSchema';

// =============================================================================
// PLACEHOLDER DETECTION
// =============================================================================

const PLACEHOLDER_PATTERNS = [
  /\$\[X\]/gi,
  /\[X\]/gi,
  /\$X/gi,
  /X%/g,
  /\[VALUE\]/gi,
  /\[NAME\]/gi,
  /\[CITY\]/gi,
  /\[INDUSTRY\]/gi,
  /\[INSERT.*?\]/gi,
  /\{.*?TBD.*?\}/gi,
  /XX,XXX/g,
  /\$\d*X+/gi,
  /varies/gi,
  /depends/gi,
  /typically$/i,
];

export function detectPlaceholders(text: string): string[] {
  const placeholders: string[] = [];
  for (const pattern of PLACEHOLDER_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      placeholders.push(...matches);
    }
  }
  return [...new Set(placeholders)];
}

export function hasPlaceholders(text: string): boolean {
  return PLACEHOLDER_PATTERNS.some(pattern => pattern.test(text));
}

export function cleanPlaceholders(text: string): string {
  let cleaned = text;
  for (const pattern of PLACEHOLDER_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[NEEDS REVIEW]');
  }
  return cleaned;
}

// =============================================================================
// FIELD VALIDATION
// =============================================================================

export interface FieldValidationResult {
  valid: boolean;
  value: unknown;
  error?: string;
  warning?: string;
}

export function validateNumber(value: unknown, fieldName: string, options?: {
  min?: number;
  max?: number;
  required?: boolean;
}): FieldValidationResult {
  if (value === undefined || value === null) {
    if (options?.required) {
      return { valid: false, value: null, error: `${fieldName} is required` };
    }
    return { valid: true, value: null };
  }

  let numValue: number;
  if (typeof value === 'number') {
    numValue = value;
  } else if (typeof value === 'string') {
    // Parse string values like "$2.5M", "2.5", "$2,500,000"
    const cleaned = value.replace(/[$,]/g, '');
    if (/[mM]$/i.test(cleaned)) {
      numValue = parseFloat(cleaned.replace(/[mM]$/i, ''));
    } else if (/[kK]$/i.test(cleaned)) {
      numValue = parseFloat(cleaned.replace(/[kK]$/i, '')) / 1000;
    } else {
      numValue = parseFloat(cleaned);
    }
  } else {
    return { valid: false, value: null, error: `${fieldName} must be a number` };
  }

  if (isNaN(numValue)) {
    return { valid: false, value: null, error: `${fieldName} is not a valid number` };
  }

  if (options?.min !== undefined && numValue < options.min) {
    return { valid: false, value: numValue, error: `${fieldName} must be at least ${options.min}` };
  }

  if (options?.max !== undefined && numValue > options.max) {
    return { valid: false, value: numValue, error: `${fieldName} must be at most ${options.max}` };
  }

  return { valid: true, value: numValue };
}

export function validateStringArray(value: unknown, fieldName: string, options?: {
  minLength?: number;
  maxLength?: number;
  required?: boolean;
}): FieldValidationResult {
  if (value === undefined || value === null) {
    if (options?.required) {
      return { valid: false, value: [], error: `${fieldName} is required` };
    }
    return { valid: true, value: [] };
  }

  let arr: string[];
  if (Array.isArray(value)) {
    arr = value.map(v => String(v).trim()).filter(Boolean);
  } else if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        arr = parsed.map(v => String(v).trim()).filter(Boolean);
      } else {
        arr = [value.trim()].filter(Boolean);
      }
    } catch {
      arr = [value.trim()].filter(Boolean);
    }
  } else {
    return { valid: false, value: [], error: `${fieldName} must be an array of strings` };
  }

  if (options?.minLength !== undefined && arr.length < options.minLength) {
    return {
      valid: false,
      value: arr,
      error: `${fieldName} must have at least ${options.minLength} item(s)`
    };
  }

  if (options?.maxLength !== undefined && arr.length > options.maxLength) {
    return {
      valid: false,
      value: arr.slice(0, options.maxLength),
      warning: `${fieldName} truncated to ${options.maxLength} items`
    };
  }

  return { valid: true, value: arr };
}

// =============================================================================
// CRITERIA-LEVEL VALIDATION
// =============================================================================

export interface DetailedValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  placeholders: string[];
  missingRequired: string[];
  completenessScore: number;
}

export function validateSizeCriteriaDetailed(criteria: SizeCriteria | null): DetailedValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const placeholders: string[] = [];
  const missingRequired: string[] = [];

  if (!criteria) {
    return {
      valid: false,
      errors: ['Size criteria is missing'],
      warnings: [],
      placeholders: [],
      missingRequired: ['size_criteria'],
      completenessScore: 0
    };
  }

  // Check for at least one threshold
  const hasAnyThreshold = !!(
    criteria.min_revenue || criteria.max_revenue ||
    criteria.min_ebitda || criteria.max_ebitda ||
    criteria.min_locations
  );

  if (!hasAnyThreshold) {
    missingRequired.push('min_revenue or min_ebitda or min_locations');
    warnings.push('No size thresholds defined - cannot filter by size');
  }

  // Check for logical consistency
  if (criteria.min_revenue && criteria.max_revenue && criteria.min_revenue > criteria.max_revenue) {
    errors.push('min_revenue cannot be greater than max_revenue');
  }

  if (criteria.min_ebitda && criteria.max_ebitda && criteria.min_ebitda > criteria.max_ebitda) {
    errors.push('min_ebitda cannot be greater than max_ebitda');
  }

  if (criteria.min_locations && criteria.max_locations && criteria.min_locations > criteria.max_locations) {
    errors.push('min_locations cannot be greater than max_locations');
  }

  // Calculate completeness
  let filledFields = 0;
  const totalFields = 6;
  if (criteria.min_revenue) filledFields++;
  if (criteria.max_revenue) filledFields++;
  if (criteria.min_ebitda) filledFields++;
  if (criteria.max_ebitda) filledFields++;
  if (criteria.min_locations) filledFields++;
  if (criteria.max_locations) filledFields++;

  return {
    valid: errors.length === 0 && hasAnyThreshold,
    errors,
    warnings,
    placeholders,
    missingRequired,
    completenessScore: Math.round((filledFields / totalFields) * 100)
  };
}

export function validateServiceCriteriaDetailed(criteria: ServiceCriteria | null): DetailedValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const placeholders: string[] = [];
  const missingRequired: string[] = [];

  if (!criteria) {
    return {
      valid: false,
      errors: ['Service criteria is missing'],
      warnings: [],
      placeholders: [],
      missingRequired: ['service_criteria'],
      completenessScore: 0
    };
  }

  // CRITICAL: Check primary_focus
  if (!criteria.primary_focus || criteria.primary_focus.length === 0) {
    missingRequired.push('primary_focus');
    errors.push('Primary focus services are required for accurate scoring');
  } else {
    // Check for placeholders in primary focus
    for (const service of criteria.primary_focus) {
      const detected = detectPlaceholders(service);
      if (detected.length > 0) {
        placeholders.push(...detected);
        errors.push(`Primary focus contains placeholder: ${service}`);
      }
    }
  }

  // Check for logical overlaps
  if (criteria.required_services && criteria.excluded_services) {
    const overlap = criteria.required_services.filter(s =>
      criteria.excluded_services?.some(e =>
        e.toLowerCase() === s.toLowerCase()
      )
    );
    if (overlap.length > 0) {
      errors.push(`Services cannot be both required and excluded: ${overlap.join(', ')}`);
    }
  }

  // Warnings for empty excluded services
  if (!criteria.excluded_services || criteria.excluded_services.length === 0) {
    warnings.push('No excluded services defined - cannot filter off-thesis deals');
  }

  // Calculate completeness
  let filledFields = 0;
  const totalFields = 5;
  if (criteria.primary_focus?.length) filledFields += 2; // Extra weight for primary focus
  if (criteria.required_services?.length) filledFields++;
  if (criteria.preferred_services?.length) filledFields++;
  if (criteria.excluded_services?.length) filledFields++;

  return {
    valid: errors.length === 0 && (criteria.primary_focus?.length ?? 0) > 0,
    errors,
    warnings,
    placeholders,
    missingRequired,
    completenessScore: Math.min(100, Math.round((filledFields / totalFields) * 100))
  };
}

export function validateGeographyCriteriaDetailed(criteria: GeographyCriteria | null): DetailedValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const placeholders: string[] = [];
  const missingRequired: string[] = [];

  if (!criteria) {
    return {
      valid: true, // Geography is optional
      errors: [],
      warnings: ['No geography criteria defined - all regions will be considered'],
      placeholders: [],
      missingRequired: [],
      completenessScore: 0
    };
  }

  const hasAnyRegion = !!(
    (criteria.required_regions?.length ?? 0) > 0 ||
    (criteria.preferred_regions?.length ?? 0) > 0
  );

  if (!hasAnyRegion) {
    warnings.push('No target regions defined - all regions will be considered');
  }

  // Check for overlap between required and excluded
  if (criteria.required_regions && criteria.excluded_regions) {
    const overlap = criteria.required_regions.filter(r =>
      criteria.excluded_regions?.some(e => e.toLowerCase() === r.toLowerCase())
    );
    if (overlap.length > 0) {
      errors.push(`Regions cannot be both required and excluded: ${overlap.join(', ')}`);
    }
  }

  // Calculate completeness
  let filledFields = 0;
  const totalFields = 4;
  if (criteria.required_regions?.length) filledFields++;
  if (criteria.preferred_regions?.length) filledFields++;
  if (criteria.excluded_regions?.length) filledFields++;
  if (criteria.coverage_type) filledFields++;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    placeholders,
    missingRequired,
    completenessScore: Math.round((filledFields / totalFields) * 100)
  };
}

export function validateBuyerTypesCriteriaDetailed(criteria: BuyerTypesCriteria | null): DetailedValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const placeholders: string[] = [];
  const missingRequired: string[] = [];

  if (!criteria || !criteria.buyer_types || criteria.buyer_types.length === 0) {
    return {
      valid: true, // Buyer types are optional but recommended
      errors: [],
      warnings: ['No buyer types defined - generic scoring will be used'],
      placeholders: [],
      missingRequired: [],
      completenessScore: 0
    };
  }

  // Validate each buyer type
  for (const buyerType of criteria.buyer_types) {
    if (!buyerType.type_name) {
      errors.push('Buyer type is missing type_name');
    }

    // Check for placeholders in descriptions
    if (buyerType.description) {
      const detected = detectPlaceholders(buyerType.description);
      if (detected.length > 0) {
        placeholders.push(...detected);
        warnings.push(`Buyer type "${buyerType.type_name}" description contains placeholders`);
      }
    }

    // Logical validation for size constraints
    if (buyerType.min_revenue && buyerType.max_revenue && buyerType.min_revenue > buyerType.max_revenue) {
      errors.push(`Buyer type "${buyerType.type_name}": min_revenue > max_revenue`);
    }

    if (buyerType.min_locations && buyerType.max_locations && buyerType.min_locations > buyerType.max_locations) {
      errors.push(`Buyer type "${buyerType.type_name}": min_locations > max_locations`);
    }
  }

  // Check for duplicate priority orders
  const priorities = criteria.buyer_types.map(bt => bt.priority_order).filter(p => p !== undefined);
  const uniquePriorities = new Set(priorities);
  if (priorities.length !== uniquePriorities.size) {
    warnings.push('Multiple buyer types have the same priority order');
  }

  // Calculate completeness (average of buyer type field completeness)
  let totalScore = 0;
  for (const bt of criteria.buyer_types) {
    let fields = 0;
    if (bt.type_name) fields++;
    if (bt.min_locations || bt.max_locations) fields++;
    if (bt.min_revenue || bt.max_revenue) fields++;
    if (bt.geographic_scope) fields++;
    if (bt.acquisition_style) fields++;
    totalScore += (fields / 5) * 100;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    placeholders,
    missingRequired,
    completenessScore: Math.round(totalScore / criteria.buyer_types.length)
  };
}

// =============================================================================
// COMPLETE VALIDATION
// =============================================================================

export interface ComprehensiveValidationResult {
  valid: boolean;
  canScore: boolean;
  status: 'complete' | 'partial' | 'insufficient';
  overallScore: number;
  size: DetailedValidationResult;
  service: DetailedValidationResult;
  geography: DetailedValidationResult;
  buyerTypes: DetailedValidationResult;
  allErrors: string[];
  allWarnings: string[];
  allPlaceholders: string[];
  criticalMissing: string[];
}

export function validateCriteriaComprehensive(criteria: TrackerCriteria | null): ComprehensiveValidationResult {
  if (!criteria) {
    return {
      valid: false,
      canScore: false,
      status: 'insufficient',
      overallScore: 0,
      size: { valid: false, errors: ['Missing'], warnings: [], placeholders: [], missingRequired: ['all'], completenessScore: 0 },
      service: { valid: false, errors: ['Missing'], warnings: [], placeholders: [], missingRequired: ['all'], completenessScore: 0 },
      geography: { valid: true, errors: [], warnings: ['Not defined'], placeholders: [], missingRequired: [], completenessScore: 0 },
      buyerTypes: { valid: true, errors: [], warnings: ['Not defined'], placeholders: [], missingRequired: [], completenessScore: 0 },
      allErrors: ['No criteria defined'],
      allWarnings: [],
      allPlaceholders: [],
      criticalMissing: ['size_criteria', 'service_criteria', 'primary_focus']
    };
  }

  const size = validateSizeCriteriaDetailed(criteria.size_criteria);
  const service = validateServiceCriteriaDetailed(criteria.service_criteria);
  const geography = validateGeographyCriteriaDetailed(criteria.geography_criteria);
  const buyerTypes = validateBuyerTypesCriteriaDetailed(criteria.buyer_types_criteria);

  const allErrors = [...size.errors, ...service.errors, ...geography.errors, ...buyerTypes.errors];
  const allWarnings = [...size.warnings, ...service.warnings, ...geography.warnings, ...buyerTypes.warnings];
  const allPlaceholders = [...size.placeholders, ...service.placeholders, ...geography.placeholders, ...buyerTypes.placeholders];
  const criticalMissing = [...size.missingRequired, ...service.missingRequired];

  // Calculate overall score with weights
  const overallScore = Math.round(
    (size.completenessScore * 0.3) +
    (service.completenessScore * 0.35) +
    (geography.completenessScore * 0.15) +
    (buyerTypes.completenessScore * 0.2)
  );

  // Determine status
  let status: 'complete' | 'partial' | 'insufficient';
  const hasPrimaryFocus = (criteria.service_criteria?.primary_focus?.length ?? 0) > 0;
  const hasSizeThresholds = size.completenessScore > 0;

  if (overallScore >= 70 && hasPrimaryFocus && allErrors.length === 0) {
    status = 'complete';
  } else if (overallScore >= 30 || hasSizeThresholds || hasPrimaryFocus) {
    status = 'partial';
  } else {
    status = 'insufficient';
  }

  const canScore = status !== 'insufficient' && allErrors.length === 0;

  return {
    valid: allErrors.length === 0,
    canScore,
    status,
    overallScore,
    size,
    service,
    geography,
    buyerTypes,
    allErrors,
    allWarnings,
    allPlaceholders,
    criticalMissing
  };
}

// =============================================================================
// PRE-SAVE VALIDATION
// =============================================================================

export interface PreSaveValidationResult {
  canSave: boolean;
  blockers: string[];
  warnings: string[];
  suggestions: string[];
}

export function validateBeforeSave(criteria: TrackerCriteria): PreSaveValidationResult {
  const validation = validateCriteriaComprehensive(criteria);
  const blockers: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Critical blockers
  if (validation.allPlaceholders.length > 0) {
    blockers.push(`Contains ${validation.allPlaceholders.length} placeholder(s) that need to be replaced: ${validation.allPlaceholders.slice(0, 3).join(', ')}${validation.allPlaceholders.length > 3 ? '...' : ''}`);
  }

  // Errors become blockers
  for (const error of validation.allErrors) {
    blockers.push(error);
  }

  // Warnings
  for (const warning of validation.allWarnings) {
    warnings.push(warning);
  }

  // Suggestions
  if (!validation.service.valid) {
    suggestions.push('Add primary focus services for accurate deal-buyer matching');
  }

  if (validation.size.completenessScore < 50) {
    suggestions.push('Add more size criteria (revenue, EBITDA, location ranges) for better filtering');
  }

  if (validation.buyerTypes.completenessScore === 0) {
    suggestions.push('Define buyer types with specific requirements for each buyer segment');
  }

  if (validation.geography.completenessScore === 0) {
    suggestions.push('Add geographic preferences to improve regional matching');
  }

  return {
    canSave: blockers.length === 0,
    blockers,
    warnings,
    suggestions
  };
}
