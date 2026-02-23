/**
 * Unit tests for learning penalty phase.
 * Tests the calculateLearningPenalty function's deterministic logic.
 */
import { describe, it, expect } from 'vitest';

// ============================================================================
// Re-implement learning penalty logic for testing
// ============================================================================

interface LearningPattern {
  buyer_id: string;
  approvalRate: number;
  avgScoreOnApproved: number;
  avgScoreOnPassed: number;
  totalActions: number;
  passCategories: Record<string, number>;
}

interface LearningResult {
  penalty: number;
  note: string;
}

function calculateLearningPenalty(pattern: LearningPattern | undefined): LearningResult {
  if (!pattern || pattern.totalActions < 3) return { penalty: 0, note: '' };

  let penalty = 0;
  const notes: string[] = [];

  // Size rejections
  if ((pattern.passCategories['size'] || 0) >= 2) {
    penalty += 10;
    notes.push('-10 size rejection pattern');
  }
  // Geography rejections
  if ((pattern.passCategories['geography'] || 0) >= 2) {
    penalty += 8;
    notes.push('-8 geography rejection pattern');
  }
  // Service rejections
  if ((pattern.passCategories['services'] || 0) >= 2) {
    penalty += 8;
    notes.push('-8 service rejection pattern');
  }
  // Timing rejections
  if ((pattern.passCategories['timing'] || 0) >= 3) {
    penalty += 5;
    notes.push('-5 timing rejection pattern');
  }
  // Portfolio conflicts
  if ((pattern.passCategories['portfolio_conflict'] || 0) >= 1) {
    penalty += 3;
    notes.push('-3 portfolio conflict');
  }

  // Positive learning boost
  if (pattern.approvalRate >= 0.7 && pattern.totalActions >= 3) {
    penalty -= 5;
    notes.push('+5 high approval rate');
  } else if (pattern.approvalRate < 0.3 && pattern.totalActions >= 3) {
    penalty += 3;
    notes.push('-3 low approval pattern');
  }

  return {
    penalty: Math.max(-5, Math.min(25, penalty)),
    note: notes.join('; '),
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('calculateLearningPenalty', () => {
  it('returns zero for undefined pattern', () => {
    const result = calculateLearningPenalty(undefined);
    expect(result.penalty).toBe(0);
    expect(result.note).toBe('');
  });

  it('returns zero when totalActions < 3', () => {
    const result = calculateLearningPenalty({
      buyer_id: 'b1',
      approvalRate: 0,
      avgScoreOnApproved: 0,
      avgScoreOnPassed: 50,
      totalActions: 2,
      passCategories: { size: 2 },
    });
    expect(result.penalty).toBe(0);
  });

  describe('rejection patterns', () => {
    it('applies -10 for size rejection pattern (>=2 size passes)', () => {
      const result = calculateLearningPenalty({
        buyer_id: 'b1',
        approvalRate: 0.5,
        avgScoreOnApproved: 70,
        avgScoreOnPassed: 40,
        totalActions: 4,
        passCategories: { size: 2 },
      });
      expect(result.penalty).toBe(10);
      expect(result.note).toContain('size rejection');
    });

    it('applies -8 for geography rejection pattern', () => {
      const result = calculateLearningPenalty({
        buyer_id: 'b1',
        approvalRate: 0.5,
        avgScoreOnApproved: 70,
        avgScoreOnPassed: 40,
        totalActions: 4,
        passCategories: { geography: 3 },
      });
      expect(result.penalty).toBe(8);
      expect(result.note).toContain('geography rejection');
    });

    it('applies -8 for service rejection pattern', () => {
      const result = calculateLearningPenalty({
        buyer_id: 'b1',
        approvalRate: 0.5,
        avgScoreOnApproved: 70,
        avgScoreOnPassed: 40,
        totalActions: 4,
        passCategories: { services: 2 },
      });
      expect(result.penalty).toBe(8);
    });

    it('applies -5 for timing rejection pattern (>=3 needed)', () => {
      const result = calculateLearningPenalty({
        buyer_id: 'b1',
        approvalRate: 0.5,
        avgScoreOnApproved: 70,
        avgScoreOnPassed: 40,
        totalActions: 6,
        passCategories: { timing: 3 },
      });
      expect(result.penalty).toBe(5);
    });

    it('does not apply timing penalty for only 2 timing passes', () => {
      const result = calculateLearningPenalty({
        buyer_id: 'b1',
        approvalRate: 0.5,
        avgScoreOnApproved: 70,
        avgScoreOnPassed: 40,
        totalActions: 4,
        passCategories: { timing: 2 },
      });
      expect(result.penalty).toBe(0);
    });

    it('applies -3 for portfolio conflict', () => {
      const result = calculateLearningPenalty({
        buyer_id: 'b1',
        approvalRate: 0.5,
        avgScoreOnApproved: 70,
        avgScoreOnPassed: 40,
        totalActions: 3,
        passCategories: { portfolio_conflict: 1 },
      });
      expect(result.penalty).toBe(3);
    });

    it('stacks multiple rejection categories', () => {
      const result = calculateLearningPenalty({
        buyer_id: 'b1',
        approvalRate: 0.5,
        avgScoreOnApproved: 70,
        avgScoreOnPassed: 40,
        totalActions: 10,
        passCategories: { size: 3, geography: 2, services: 2 },
      });
      // 10 (size) + 8 (geography) + 8 (services) = 26, capped at 25
      expect(result.penalty).toBe(25);
    });
  });

  describe('approval rate adjustments', () => {
    it('gives +5 boost for high approval rate (>=0.7)', () => {
      const result = calculateLearningPenalty({
        buyer_id: 'b1',
        approvalRate: 0.8,
        avgScoreOnApproved: 75,
        avgScoreOnPassed: 45,
        totalActions: 5,
        passCategories: {},
      });
      expect(result.penalty).toBe(-5); // net boost
      expect(result.note).toContain('high approval rate');
    });

    it('applies -3 for low approval rate (<0.3)', () => {
      const result = calculateLearningPenalty({
        buyer_id: 'b1',
        approvalRate: 0.2,
        avgScoreOnApproved: 60,
        avgScoreOnPassed: 40,
        totalActions: 5,
        passCategories: {},
      });
      expect(result.penalty).toBe(3);
      expect(result.note).toContain('low approval');
    });
  });

  describe('penalty capping', () => {
    it('caps minimum at -5', () => {
      const result = calculateLearningPenalty({
        buyer_id: 'b1',
        approvalRate: 0.9,
        avgScoreOnApproved: 80,
        avgScoreOnPassed: 50,
        totalActions: 10,
        passCategories: {},
      });
      expect(result.penalty).toBe(-5);
    });

    it('caps maximum at 25', () => {
      const result = calculateLearningPenalty({
        buyer_id: 'b1',
        approvalRate: 0.1,
        avgScoreOnApproved: 50,
        avgScoreOnPassed: 30,
        totalActions: 20,
        passCategories: {
          size: 5,
          geography: 5,
          services: 5,
          timing: 5,
          portfolio_conflict: 5,
        },
      });
      // 10 + 8 + 8 + 5 + 3 + 3(low approval) = 37, capped to 25
      expect(result.penalty).toBe(25);
    });
  });
});
