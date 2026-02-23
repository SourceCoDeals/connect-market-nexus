/**
 * Shared scoring utilities — retry helper and score snapshot persistence.
 */

import { fetchWithAutoRetry } from "../../_shared/ai-providers.ts";
import type { SupabaseClient, ScoredResult } from "../types.ts";

// AI CALL RETRY HELPER — uses shared fetchWithAutoRetry from ai-providers.ts
// Local wrapper preserves the original call signature for existing callers
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  baseDelayMs: number = 2000
): Promise<Response> {
  return fetchWithAutoRetry(url, options as RequestInit & { signal?: AbortSignal }, {
    maxRetries,
    baseDelayMs,
    callerName: 'score-buyer-deal',
  });
}

/**
 * Save an immutable score snapshot for auditing.
 * Non-blocking: swallows errors to avoid breaking the scoring pipeline.
 */
export function saveScoreSnapshot(
  supabase: SupabaseClient,
  score: ScoredResult,
  weights: { geography: number; size: number; service: number; owner_goals: number },
  triggerType: 'manual' | 'bulk' | 'auto' | 'recalculation' = 'manual'
): void {
  (supabase.from('score_snapshots').insert({
    listing_id: score.listing_id,
    buyer_id: score.buyer_id,
    universe_id: score.universe_id,
    composite_score: score.composite_score,
    geography_score: score.geography_score,
    size_score: score.size_score,
    service_score: score.service_score,
    owner_goals_score: score.owner_goals_score,
    deal_quality_score: null,
    engagement_score: null,
    tier: score.tier,
    weights_used: weights,
    multipliers_applied: {
      size_multiplier: score.size_multiplier,
      service_multiplier: score.service_multiplier,
      geography_mode_factor: score.geography_mode_factor,
    },
    bonuses_applied: {
      thesis_bonus: score.thesis_alignment_bonus,
      data_quality: score.data_quality_bonus,
      custom: score.custom_bonus,
      learning_penalty: -score.learning_penalty,
    },
    data_completeness: score.data_completeness,
    missing_fields: score.missing_fields,
    trigger_type: triggerType,
    scoring_version: 'v5',
  }) as unknown as Promise<{ error: { message: string } | null }>).then(({ error }) => {
    if (error) console.warn('[score-snapshots] Failed to save snapshot:', error.message);
  }).catch((err: unknown) => {
    console.warn('[score-snapshots] Snapshot error:', err);
  });
}
