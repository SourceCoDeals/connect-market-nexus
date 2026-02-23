import { describe, it, expect } from 'vitest';
import {
  validateCriteria,
  validateBeforeSave,
  getCompletenessLabel,
  getCriteriaSummary
} from './criteriaValidation';

describe('validateCriteria', () => {
  it('returns invalid result for empty criteria', () => {
    const result = validateCriteria({});
    expect(result.isValid).toBe(false);
    expect(result.overallCompleteness).toBeLessThan(50);
  });

  it('returns valid result when primary focus is set', () => {
    const result = validateCriteria({
      service_criteria: {
        primary_focus: ['HVAC', 'Plumbing'],
        required_services: ['Commercial HVAC'],
      },
      size_criteria: {
        revenue_min: 1000000,
        revenue_max: 10000000,
        ebitda_min: 200000,
        ebitda_max: 3000000,
      },
      geography_criteria: {
        target_regions: ['Northeast US'],
      },
    });
    expect(result.isValid).toBe(true);
    expect(result.hasPrimaryFocus).toBe(true);
    expect(result.overallCompleteness).toBeGreaterThan(50);
  });

  it('detects missing primary focus as critical', () => {
    const result = validateCriteria({
      service_criteria: {
        required_services: ['HVAC'],
      },
    });
    expect(result.hasPrimaryFocus).toBe(false);
    expect(result.isValid).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it('detects revenue range errors', () => {
    const result = validateCriteria({
      size_criteria: {
        revenue_min: 10000000,
        revenue_max: 1000000, // max < min
      },
    });
    expect(result.size.issues.some(i => i.severity === 'error')).toBe(true);
  });

  it('detects EBITDA range errors', () => {
    const result = validateCriteria({
      size_criteria: {
        ebitda_min: 5000000,
        ebitda_max: 1000000, // max < min
      },
    });
    expect(result.size.issues.some(i => i.severity === 'error')).toBe(true);
  });

  it('handles buyer types criteria', () => {
    const result = validateCriteria({
      buyer_types_criteria: {
        buyer_types: [{ name: 'PE Firms', id: 'pe', priority: 1, enabled: true }],
      },
    });
    expect(result.buyerTypes.isComplete).toBe(true);
    expect(result.buyerTypes.completeness).toBe(100);
  });

  it('detects placeholder values', () => {
    const result = validateCriteria({
      service_criteria: {
        primary_focus: ['[TBD]', 'PLACEHOLDER'],
      },
    });
    expect(result.hasPlaceholders).toBe(true);
    expect(result.placeholderCount).toBeGreaterThan(0);
  });
});

describe('validateBeforeSave', () => {
  it('blocks save when primary focus is missing', () => {
    const result = validateBeforeSave({
      service_criteria: {
        required_services: ['HVAC'],
      },
    });
    expect(result.canSave).toBe(false);
    expect(result.criticalMessage).toBeDefined();
    expect(result.criticalMessage).toContain('Primary Focus');
  });

  it('allows save when primary focus exists', () => {
    const result = validateBeforeSave({
      service_criteria: {
        primary_focus: ['HVAC'],
      },
    });
    expect(result.canSave).toBe(true);
    expect(result.criticalMessage).toBeUndefined();
  });
});

describe('getCompletenessLabel', () => {
  it('returns Complete for high scores', () => {
    expect(getCompletenessLabel(80)).toEqual({ label: 'Complete', color: 'green' });
    expect(getCompletenessLabel(100)).toEqual({ label: 'Complete', color: 'green' });
  });

  it('returns Partial for medium scores', () => {
    expect(getCompletenessLabel(50)).toEqual({ label: 'Partial', color: 'yellow' });
    expect(getCompletenessLabel(79)).toEqual({ label: 'Partial', color: 'yellow' });
  });

  it('returns Incomplete for low scores', () => {
    expect(getCompletenessLabel(0)).toEqual({ label: 'Incomplete', color: 'red' });
    expect(getCompletenessLabel(49)).toEqual({ label: 'Incomplete', color: 'red' });
  });
});

describe('getCriteriaSummary', () => {
  it('returns summary for complete criteria', () => {
    const summary = getCriteriaSummary({
      size_criteria: {
        revenue_min: 1000000,
        revenue_max: 10000000,
        ebitda_min: 200000,
        ebitda_max: 3000000,
      },
      service_criteria: {
        primary_focus: ['HVAC', 'Plumbing', 'Electrical'],
      },
      geography_criteria: {
        target_regions: ['Northeast US', 'Southeast US'],
      },
      buyer_types_criteria: {
        include_pe_firms: true,
        include_strategic: true,
      },
    });
    expect(summary.size).toContain('Revenue');
    expect(summary.service).toContain('HVAC');
    expect(summary.geography).toContain('Northeast US');
    expect(summary.buyerTypes).toContain('PE');
  });

  it('returns defaults for empty criteria', () => {
    const summary = getCriteriaSummary({});
    expect(summary.size).toBe('Not configured');
    expect(summary.service).toBe('Primary focus not set');
    expect(summary.geography).toBe('Not configured');
    expect(summary.buyerTypes).toBe('All types');
  });

  it('handles national coverage', () => {
    const summary = getCriteriaSummary({
      geography_criteria: {
        coverage: 'national',
      },
    });
    expect(summary.geography).toBe('National coverage');
  });
});
