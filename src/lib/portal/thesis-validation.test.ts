import { describe, it, expect } from 'vitest';
import { validateThesisCandidate, type ThesisCandidateLike } from './thesis-validation';

/**
 * These tests lock in the DB CHECK constraints from
 * 20260703000011_portal_intelligence_audit_fixes.sql. If the constraints
 * change in Postgres, this suite will fail fast — we want to catch drift
 * between client-side validation and the server-side source of truth.
 */

function baseCandidate(overrides: Partial<ThesisCandidateLike> = {}): ThesisCandidateLike {
  return {
    industry_label: 'Residential HVAC',
    industry_keywords: ['hvac', 'plumbing'],
    ebitda_min: 500_000,
    ebitda_max: 5_000_000,
    revenue_min: 2_000_000,
    revenue_max: 25_000_000,
    employee_min: 10,
    employee_max: 500,
    ...overrides,
  };
}

describe('validateThesisCandidate', () => {
  it('returns null for a fully-specified valid candidate', () => {
    expect(validateThesisCandidate(baseCandidate())).toBeNull();
  });

  it('accepts a candidate with all range fields null (nothing specified)', () => {
    expect(
      validateThesisCandidate(
        baseCandidate({
          ebitda_min: null,
          ebitda_max: null,
          revenue_min: null,
          revenue_max: null,
          employee_min: null,
          employee_max: null,
        }),
      ),
    ).toBeNull();
  });

  it('accepts a candidate with only min set (open-ended range)', () => {
    expect(
      validateThesisCandidate(baseCandidate({ ebitda_min: 1_000_000, ebitda_max: null })),
    ).toBeNull();
  });

  it('accepts a candidate with only max set (open-ended range)', () => {
    expect(
      validateThesisCandidate(baseCandidate({ ebitda_min: null, ebitda_max: 1_000_000 })),
    ).toBeNull();
  });

  it('accepts min === max (single-point range)', () => {
    expect(
      validateThesisCandidate(
        baseCandidate({ revenue_min: 5_000_000, revenue_max: 5_000_000 }),
      ),
    ).toBeNull();
  });

  describe('industry_label', () => {
    it('rejects an empty label', () => {
      expect(validateThesisCandidate(baseCandidate({ industry_label: '' }))).toBe(
        'Industry label is required.',
      );
    });

    it('rejects a whitespace-only label', () => {
      expect(validateThesisCandidate(baseCandidate({ industry_label: '   ' }))).toBe(
        'Industry label is required.',
      );
    });

    it('accepts a label with trimmable whitespace', () => {
      expect(
        validateThesisCandidate(baseCandidate({ industry_label: '  HVAC  ' })),
      ).toBeNull();
    });
  });

  describe('industry_keywords', () => {
    it('rejects an empty keywords array (DB CHECK: cardinality > 0)', () => {
      expect(validateThesisCandidate(baseCandidate({ industry_keywords: [] }))).toBe(
        'At least one industry keyword is required.',
      );
    });

    it('accepts a single-keyword array', () => {
      expect(
        validateThesisCandidate(baseCandidate({ industry_keywords: ['hvac'] })),
      ).toBeNull();
    });
  });

  describe('ebitda range', () => {
    it('rejects inverted EBITDA range', () => {
      expect(
        validateThesisCandidate(
          baseCandidate({ ebitda_min: 5_000_000, ebitda_max: 1_000_000 }),
        ),
      ).toBe('EBITDA min cannot be greater than max.');
    });
  });

  describe('revenue range', () => {
    it('rejects inverted revenue range', () => {
      expect(
        validateThesisCandidate(
          baseCandidate({ revenue_min: 50_000_000, revenue_max: 1_000_000 }),
        ),
      ).toBe('Revenue min cannot be greater than max.');
    });
  });

  describe('employee range', () => {
    it('rejects inverted employee range', () => {
      expect(
        validateThesisCandidate(baseCandidate({ employee_min: 500, employee_max: 10 })),
      ).toBe('Employee min cannot be greater than max.');
    });
  });

  describe('multiple errors', () => {
    it('returns the first error (label before keywords)', () => {
      expect(
        validateThesisCandidate(
          baseCandidate({ industry_label: '', industry_keywords: [] }),
        ),
      ).toBe('Industry label is required.');
    });

    it('returns the first error (keywords before EBITDA)', () => {
      expect(
        validateThesisCandidate(
          baseCandidate({
            industry_keywords: [],
            ebitda_min: 5_000_000,
            ebitda_max: 1_000_000,
          }),
        ),
      ).toBe('At least one industry keyword is required.');
    });

    it('returns the first range error (EBITDA before Revenue)', () => {
      expect(
        validateThesisCandidate(
          baseCandidate({
            ebitda_min: 5_000_000,
            ebitda_max: 1_000_000,
            revenue_min: 50_000_000,
            revenue_max: 1_000_000,
          }),
        ),
      ).toBe('EBITDA min cannot be greater than max.');
    });
  });

  describe('edge cases', () => {
    it('accepts zero as a valid min value', () => {
      expect(
        validateThesisCandidate(baseCandidate({ ebitda_min: 0, ebitda_max: 1_000_000 })),
      ).toBeNull();
    });

    it('accepts zero-range (0, 0)', () => {
      expect(
        validateThesisCandidate(baseCandidate({ ebitda_min: 0, ebitda_max: 0 })),
      ).toBeNull();
    });
  });
});
