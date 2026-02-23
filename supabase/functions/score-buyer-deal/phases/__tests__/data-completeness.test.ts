/**
 * Unit tests for data-completeness phase.
 * Tests assessDataCompleteness and applyCustomInstructionBonus.
 */
import { describe, it, expect } from 'vitest';

// ============================================================================
// Re-implement data completeness logic for testing
// ============================================================================

interface Buyer {
  thesis_summary?: string | null;
  target_services?: string[] | null;
  target_geographies?: string[] | null;
  target_revenue_min?: number | null;
  target_revenue_max?: number | null;
  target_ebitda_min?: number | null;
  target_ebitda_max?: number | null;
  hq_state?: string | null;
  hq_city?: string | null;
  buyer_type?: string | null;
  extraction_sources?: Record<string, unknown>[] | null;
  pe_firm_website?: string | null;
  platform_website?: string | null;
  company_website?: string | null;
  recent_acquisitions?: unknown[] | null;
  portfolio_companies?: unknown[] | null;
}

interface DataCompletenessResult {
  level: string;
  missingFields: string[];
  provenanceWarnings: string[];
}

function assessDataCompleteness(buyer: Buyer): DataCompletenessResult {
  const missing: string[] = [];
  const provenanceWarnings: string[] = [];

  if (!buyer.thesis_summary || buyer.thesis_summary.length < 20) missing.push('Investment thesis');
  if (!buyer.target_services || buyer.target_services.length === 0) missing.push('Target services');
  if (!buyer.target_geographies || buyer.target_geographies.length === 0) missing.push('Target geographies');
  if (!buyer.target_revenue_min && !buyer.target_revenue_max) missing.push('Target revenue range');
  if (!buyer.target_ebitda_min && !buyer.target_ebitda_max) missing.push('Target EBITDA range');
  if (!buyer.hq_state && !buyer.hq_city) missing.push('HQ location');
  if (!buyer.buyer_type) missing.push('Buyer type');

  const sources = Array.isArray(buyer.extraction_sources) ? buyer.extraction_sources : [];
  const hasTranscript = sources.some(
    (s) => (s as { type?: string; source?: string }).type === 'transcript' || (s as { type?: string; source?: string }).source === 'transcript'
  );

  if (!hasTranscript) {
    if (buyer.thesis_summary) provenanceWarnings.push('thesis_summary has no transcript backing');
    if (buyer.target_revenue_min || buyer.target_revenue_max) provenanceWarnings.push('deal structure has no transcript backing — may be PE firm new-platform criteria');
    if (buyer.target_ebitda_min || buyer.target_ebitda_max) provenanceWarnings.push('EBITDA range has no transcript backing');
  }

  let level: string;
  const hasThesis = buyer.thesis_summary ? buyer.thesis_summary.length > 50 : false;
  const hasTargets = (buyer.target_geographies?.length ?? 0) > 0 || (buyer.target_services?.length ?? 0) > 0;
  const hasFinancials = buyer.target_revenue_min || buyer.target_ebitda_min;
  const hasAcquisitions = (buyer.recent_acquisitions as unknown[] | null)?.length ? true : false;
  const hasPortfolio = (buyer.portfolio_companies as unknown[] | null)?.length ? true : false;

  if (hasThesis && hasTargets && hasFinancials && (hasAcquisitions || hasPortfolio)) {
    level = 'high';
  } else if (hasThesis || (hasTargets && hasFinancials)) {
    level = 'medium';
  } else {
    level = 'low';
  }

  return { level, missingFields: missing, provenanceWarnings };
}

interface ScoringAdjustment {
  adjustment_type: 'boost' | 'penalize' | 'disqualify';
  adjustment_value: number;
  reason?: string | null;
}

interface CustomInstructionResult {
  bonus: number;
  reasoning: string;
  disqualify: boolean;
}

function applyCustomInstructionBonus(adjustments: ScoringAdjustment[]): CustomInstructionResult {
  let bonus = 0;
  const reasons: string[] = [];
  let disqualify = false;

  for (const adj of adjustments) {
    if (adj.adjustment_type === 'boost') {
      bonus += adj.adjustment_value;
      reasons.push(`+${adj.adjustment_value} (${adj.reason || 'boost'})`);
    } else if (adj.adjustment_type === 'penalize') {
      bonus -= adj.adjustment_value;
      reasons.push(`-${adj.adjustment_value} (${adj.reason || 'penalty'})`);
    } else if (adj.adjustment_type === 'disqualify') {
      disqualify = true;
      reasons.push(`DISQUALIFIED (${adj.reason || 'custom rule'})`);
    }
  }

  return { bonus, reasoning: reasons.join('; '), disqualify };
}

// ============================================================================
// TESTS: assessDataCompleteness
// ============================================================================

describe('assessDataCompleteness', () => {
  it('returns "high" level with all data fields populated', () => {
    const result = assessDataCompleteness({
      thesis_summary: 'A detailed investment thesis about acquiring HVAC companies in the southeast region with strong recurring revenue models.',
      target_services: ['HVAC', 'Plumbing'],
      target_geographies: ['FL', 'GA', 'AL'],
      target_revenue_min: 5_000_000,
      target_revenue_max: 20_000_000,
      target_ebitda_min: 1_000_000,
      target_ebitda_max: 5_000_000,
      hq_state: 'FL',
      hq_city: 'Miami',
      buyer_type: 'PE Platform',
      recent_acquisitions: [{ name: 'Acme HVAC', date: '2024-01' }],
      portfolio_companies: [{ name: 'CoolAir Inc' }],
    });
    expect(result.level).toBe('high');
    expect(result.missingFields).toHaveLength(0);
  });

  it('returns "medium" level with thesis but missing acquisitions/portfolio', () => {
    const result = assessDataCompleteness({
      thesis_summary: 'A detailed investment thesis about acquiring HVAC companies in the southeast region with strong recurring revenue.',
      target_services: ['HVAC'],
      target_geographies: ['FL'],
      target_revenue_min: 5_000_000,
      hq_state: 'FL',
      buyer_type: 'PE Platform',
    });
    expect(result.level).toBe('medium');
  });

  it('returns "low" level when minimal data provided', () => {
    const result = assessDataCompleteness({
      thesis_summary: 'Short',
      buyer_type: 'PE',
    });
    expect(result.level).toBe('low');
  });

  it('identifies all missing fields', () => {
    const result = assessDataCompleteness({});
    expect(result.missingFields).toContain('Investment thesis');
    expect(result.missingFields).toContain('Target services');
    expect(result.missingFields).toContain('Target geographies');
    expect(result.missingFields).toContain('Target revenue range');
    expect(result.missingFields).toContain('Target EBITDA range');
    expect(result.missingFields).toContain('HQ location');
    expect(result.missingFields).toContain('Buyer type');
    expect(result.missingFields).toHaveLength(7);
  });

  it('does not flag field as missing when partially provided (e.g. only max)', () => {
    const result = assessDataCompleteness({
      target_revenue_max: 10_000_000,
      target_ebitda_max: 3_000_000,
    });
    expect(result.missingFields).not.toContain('Target revenue range');
    expect(result.missingFields).not.toContain('Target EBITDA range');
  });

  describe('provenance warnings', () => {
    it('warns about thesis without transcript backing', () => {
      const result = assessDataCompleteness({
        thesis_summary: 'Some thesis content',
        extraction_sources: [],
      });
      expect(result.provenanceWarnings).toContain('thesis_summary has no transcript backing');
    });

    it('no provenance warning when transcript source exists', () => {
      const result = assessDataCompleteness({
        thesis_summary: 'Some thesis content',
        extraction_sources: [{ type: 'transcript', fields: ['thesis_summary'] }],
      });
      expect(result.provenanceWarnings).toHaveLength(0);
    });

    it('warns about financial data without transcript backing', () => {
      const result = assessDataCompleteness({
        target_revenue_min: 5_000_000,
        target_ebitda_min: 1_000_000,
      });
      expect(result.provenanceWarnings.some(w => w.includes('deal structure'))).toBe(true);
      expect(result.provenanceWarnings.some(w => w.includes('EBITDA range'))).toBe(true);
    });
  });
});

// ============================================================================
// TESTS: applyCustomInstructionBonus
// ============================================================================

describe('applyCustomInstructionBonus', () => {
  it('returns zero bonus for empty adjustments', () => {
    const result = applyCustomInstructionBonus([]);
    expect(result.bonus).toBe(0);
    expect(result.disqualify).toBe(false);
    expect(result.reasoning).toBe('');
  });

  it('applies boost correctly', () => {
    const result = applyCustomInstructionBonus([
      { adjustment_type: 'boost', adjustment_value: 10, reason: 'preferred buyer' },
    ]);
    expect(result.bonus).toBe(10);
    expect(result.reasoning).toContain('+10');
    expect(result.reasoning).toContain('preferred buyer');
  });

  it('applies penalty correctly (subtracts)', () => {
    const result = applyCustomInstructionBonus([
      { adjustment_type: 'penalize', adjustment_value: 5, reason: 'slow response' },
    ]);
    expect(result.bonus).toBe(-5);
    expect(result.reasoning).toContain('-5');
  });

  it('handles disqualification', () => {
    const result = applyCustomInstructionBonus([
      { adjustment_type: 'disqualify', adjustment_value: 0, reason: 'blacklisted firm' },
    ]);
    expect(result.disqualify).toBe(true);
    expect(result.reasoning).toContain('DISQUALIFIED');
    expect(result.reasoning).toContain('blacklisted firm');
  });

  it('stacks multiple adjustments', () => {
    const result = applyCustomInstructionBonus([
      { adjustment_type: 'boost', adjustment_value: 10, reason: 'priority' },
      { adjustment_type: 'penalize', adjustment_value: 3, reason: 'late docs' },
      { adjustment_type: 'boost', adjustment_value: 5, reason: 'referred' },
    ]);
    expect(result.bonus).toBe(12); // 10 - 3 + 5
    expect(result.disqualify).toBe(false);
  });

  it('uses default reason when none provided', () => {
    const result = applyCustomInstructionBonus([
      { adjustment_type: 'boost', adjustment_value: 5, reason: null },
    ]);
    expect(result.reasoning).toContain('boost');
  });
});
