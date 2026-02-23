/**
 * PHASE 7: LEARNING PATTERNS
 * Historical analytics — penalty/boost based on buyer's approval patterns.
 */

import type { SupabaseClient, LearningPattern, LearningResult, LearningHistoryRecord } from "../types.ts";

export async function fetchLearningPatterns(supabase: SupabaseClient, buyerIds: string[]): Promise<Map<string, LearningPattern>> {
  const patterns = new Map<string, LearningPattern>();
  if (buyerIds.length === 0) return patterns;

  const { data: history, error } = await supabase
    .from("buyer_learning_history")
    .select("buyer_id, action, composite_score, pass_category")
    .in("buyer_id", buyerIds);

  if (error || !history) return patterns;

  const buyerHistory = new Map<string, LearningHistoryRecord[]>();
  for (const record of history as LearningHistoryRecord[]) {
    if (!buyerHistory.has(record.buyer_id)) {
      buyerHistory.set(record.buyer_id, []);
    }
    buyerHistory.get(record.buyer_id)!.push(record);
  }

  for (const [buyerId, records] of buyerHistory) {
    const approved = records.filter((r) => r.action === 'approved');
    const passed = records.filter((r) => r.action === 'passed' || r.action === 'not_a_fit');

    const passCategories: Record<string, number> = {};
    for (const p of passed) {
      if (p.pass_category) {
        passCategories[p.pass_category] = (passCategories[p.pass_category] || 0) + 1;
      }
    }

    patterns.set(buyerId, {
      buyer_id: buyerId,
      approvalRate: records.length > 0 ? approved.length / records.length : 0,
      avgScoreOnApproved: approved.length > 0
        ? approved.reduce((sum: number, r) => sum + (r.composite_score || 0), 0) / approved.length
        : 0,
      avgScoreOnPassed: passed.length > 0
        ? passed.reduce((sum: number, r) => sum + (r.composite_score || 0), 0) / passed.length
        : 0,
      totalActions: records.length,
      passCategories,
    });
  }

  return patterns;
}

export function calculateLearningPenalty(pattern: LearningPattern | undefined): LearningResult {
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
    penalty -= 5; // Reduce penalty (net boost)
    notes.push('+5 high approval rate');
  } else if (pattern.approvalRate < 0.3 && pattern.totalActions >= 3) {
    penalty += 3;
    notes.push('-3 low approval pattern');
  }

  return {
    penalty: Math.max(-5, Math.min(25, penalty)), // Cap -5 to 25
    note: notes.join('; ')
  };
}
