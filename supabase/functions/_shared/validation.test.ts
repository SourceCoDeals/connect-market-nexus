/**
 * Tests for _shared/validation.ts — Anti-hallucination guards
 *
 * These test the pure validation functions that detect AI-fabricated data.
 */
import { describe, it, expect } from 'vitest';

// Re-implement pure functions to test without Deno imports

const PLACEHOLDER_PATTERNS = [
  /\[X\]/gi,
  /\$\[?X\]?/gi,
  /\bTBD\b/gi,
  /\bTO BE DETERMINED\b/gi,
  /\bPLACEHOLDER\b/gi,
  /\[INSERT.*?\]/gi,
  /\[VALUE\]/gi,
  /XXX/gi,
  /\[.*?\]/gi,
  /\{.*?\}/gi,
  /N\/A\s*$/gi,
  /\bNONE\b/gi,
  /\bUNKNOWN\b\s*$/gi,
];

const VALID_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]);

function detectPlaceholders(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  for (const pattern of PLACEHOLDER_PATTERNS) {
    // Reset lastIndex since patterns use /g flag
    pattern.lastIndex = 0;
    if (pattern.test(text)) return true;
  }
  return false;
}

function validateNumericRange(
  value: number,
  min: number,
  max: number,
  fieldName: string = 'value'
): { valid: boolean; reason?: string } {
  if (typeof value !== 'number' || isNaN(value)) {
    return { valid: false, reason: `${fieldName} is not a valid number` };
  }
  if (value < min) return { valid: false, reason: `${fieldName} (${value}) below minimum (${min})` };
  if (value > max) return { valid: false, reason: `${fieldName} (${value}) above maximum (${max})` };
  return { valid: true };
}

function validateRevenue(revenue: number | null | undefined): { valid: boolean; reason?: string } {
  if (revenue === null || revenue === undefined) return { valid: true };
  return validateNumericRange(revenue, 0, 10_000_000_000, 'revenue');
}

function validateEBITDA(ebitda: number | null | undefined): { valid: boolean; reason?: string } {
  if (ebitda === null || ebitda === undefined) return { valid: true };
  return validateNumericRange(ebitda, -1_000_000_000, 2_000_000_000, 'ebitda');
}

// ============================================================================
// detectPlaceholders
// ============================================================================

describe('detectPlaceholders', () => {
  it('detects [X] placeholders', () => {
    expect(detectPlaceholders('Revenue is [X] million')).toBe(true);
  });

  it('detects TBD', () => {
    expect(detectPlaceholders('Location: TBD')).toBe(true);
  });

  it('detects TO BE DETERMINED', () => {
    expect(detectPlaceholders('Address: TO BE DETERMINED')).toBe(true);
  });

  it('detects PLACEHOLDER', () => {
    expect(detectPlaceholders('This is a PLACEHOLDER value')).toBe(true);
  });

  it('detects [INSERT ...]', () => {
    expect(detectPlaceholders('[INSERT COMPANY NAME]')).toBe(true);
  });

  it('detects XXX', () => {
    expect(detectPlaceholders('Contact: XXX-XXX-XXXX')).toBe(true);
  });

  it('detects bracket patterns', () => {
    expect(detectPlaceholders('The company [name here] is great')).toBe(true);
    expect(detectPlaceholders('Revenue: {pending}')).toBe(true);
  });

  it('detects N/A at end', () => {
    expect(detectPlaceholders('Address: N/A')).toBe(true);
  });

  it('detects NONE and UNKNOWN', () => {
    expect(detectPlaceholders('Contact: NONE')).toBe(true);
    expect(detectPlaceholders('State: UNKNOWN')).toBe(true);
  });

  it('returns false for normal text', () => {
    expect(detectPlaceholders('Acme Corp in Houston, TX')).toBe(false);
    expect(detectPlaceholders('Revenue of $5M annually')).toBe(false);
  });

  it('returns false for empty/null input', () => {
    expect(detectPlaceholders('')).toBe(false);
    expect(detectPlaceholders(null as any)).toBe(false);
    expect(detectPlaceholders(undefined as any)).toBe(false);
  });
});

// ============================================================================
// validateNumericRange
// ============================================================================

describe('validateNumericRange', () => {
  it('accepts values within range', () => {
    expect(validateNumericRange(50, 0, 100)).toMatchObject({ valid: true });
    expect(validateNumericRange(0, 0, 100)).toMatchObject({ valid: true });
    expect(validateNumericRange(100, 0, 100)).toMatchObject({ valid: true });
  });

  it('rejects values below minimum', () => {
    expect(validateNumericRange(-1, 0, 100)).toMatchObject({ valid: false });
  });

  it('rejects values above maximum', () => {
    expect(validateNumericRange(101, 0, 100)).toMatchObject({ valid: false });
  });

  it('rejects NaN', () => {
    expect(validateNumericRange(NaN, 0, 100)).toMatchObject({ valid: false });
  });

  it('rejects non-numbers', () => {
    expect(validateNumericRange('abc' as any, 0, 100)).toMatchObject({ valid: false });
  });

  it('includes field name in reason', () => {
    const result = validateNumericRange(-5, 0, 100, 'revenue');
    expect(result.reason).toContain('revenue');
  });
});

// ============================================================================
// validateRevenue
// ============================================================================

describe('validateRevenue', () => {
  it('allows null/undefined', () => {
    expect(validateRevenue(null)).toMatchObject({ valid: true });
    expect(validateRevenue(undefined)).toMatchObject({ valid: true });
  });

  it('allows valid revenue', () => {
    expect(validateRevenue(5000000)).toMatchObject({ valid: true });
    expect(validateRevenue(0)).toMatchObject({ valid: true });
    expect(validateRevenue(10_000_000_000)).toMatchObject({ valid: true });
  });

  it('rejects negative revenue', () => {
    expect(validateRevenue(-1)).toMatchObject({ valid: false });
  });

  it('rejects unrealistically large revenue', () => {
    expect(validateRevenue(100_000_000_000)).toMatchObject({ valid: false });
  });
});

// ============================================================================
// validateEBITDA
// ============================================================================

describe('validateEBITDA', () => {
  it('allows null/undefined', () => {
    expect(validateEBITDA(null)).toMatchObject({ valid: true });
    expect(validateEBITDA(undefined)).toMatchObject({ valid: true });
  });

  it('allows negative EBITDA (losses)', () => {
    expect(validateEBITDA(-500000)).toMatchObject({ valid: true });
  });

  it('allows valid EBITDA', () => {
    expect(validateEBITDA(1500000)).toMatchObject({ valid: true });
  });

  it('rejects unrealistically large EBITDA', () => {
    expect(validateEBITDA(5_000_000_000)).toMatchObject({ valid: false });
  });
});

// ============================================================================
// State code validation
// ============================================================================

describe('VALID_STATE_CODES', () => {
  it('contains all 50 states + DC', () => {
    expect(VALID_STATE_CODES.size).toBe(51);
  });

  it('contains common states', () => {
    expect(VALID_STATE_CODES.has('TX')).toBe(true);
    expect(VALID_STATE_CODES.has('CA')).toBe(true);
    expect(VALID_STATE_CODES.has('NY')).toBe(true);
    expect(VALID_STATE_CODES.has('FL')).toBe(true);
    expect(VALID_STATE_CODES.has('DC')).toBe(true);
  });

  it('does not contain invalid codes', () => {
    expect(VALID_STATE_CODES.has('XX')).toBe(false);
    expect(VALID_STATE_CODES.has('ZZ')).toBe(false);
  });
});
