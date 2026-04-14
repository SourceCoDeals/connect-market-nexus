/**
 * Client-side validation for thesis criteria that is shared between the
 * Extract-to-Thesis review dialog and its unit test suite.
 *
 * These rules mirror the DB CHECK constraints on `portal_thesis_criteria`
 * (added in supabase/migrations/20260703000011_portal_intelligence_audit_fixes.sql):
 *
 *   - cardinality(industry_keywords) > 0
 *   - ebitda_min  <= ebitda_max  when both set
 *   - revenue_min <= revenue_max when both set
 *   - employee_min <= employee_max when both set
 *
 * Plus one extra rule we enforce client-side:
 *
 *   - industry_label must be non-empty after trimming (the column is
 *     NOT NULL, but the DB would accept an empty string; rejecting
 *     early is cleaner UX)
 *
 * Returns `null` if the candidate is valid, otherwise a single
 * human-readable error string describing the first failed rule.
 */

export interface ThesisCandidateLike {
  industry_label: string;
  industry_keywords: string[];
  ebitda_min: number | null;
  ebitda_max: number | null;
  revenue_min: number | null;
  revenue_max: number | null;
  employee_min: number | null;
  employee_max: number | null;
}

export function validateThesisCandidate(c: ThesisCandidateLike): string | null {
  if (!c.industry_label.trim()) return 'Industry label is required.';
  if (c.industry_keywords.length === 0) {
    return 'At least one industry keyword is required.';
  }
  const pairs: Array<[number | null, number | null, string]> = [
    [c.ebitda_min, c.ebitda_max, 'EBITDA'],
    [c.revenue_min, c.revenue_max, 'Revenue'],
    [c.employee_min, c.employee_max, 'Employee'],
  ];
  for (const [min, max, label] of pairs) {
    if (min != null && max != null && min > max) {
      return `${label} min cannot be greater than max.`;
    }
  }
  return null;
}
