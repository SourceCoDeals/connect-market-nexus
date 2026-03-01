/**
 * PROVENANCE WARNINGS + SCORING ADJUSTMENTS
 */

import type { SupabaseClient, Buyer, ScoringAdjustment, DataCompletenessResult, CustomInstructionResult } from "../types.ts";

export function assessProvenanceWarnings(buyer: Buyer): DataCompletenessResult {
  const provenanceWarnings: string[] = [];

  // PROVENANCE CHECK: Warn if critical fields have no transcript source
  const sources = Array.isArray(buyer.extraction_sources) ? buyer.extraction_sources : [];
  const hasTranscript = sources.some((s: unknown) => {
    const rec = s as Record<string, unknown>;
    return rec?.type === 'transcript' || rec?.source === 'transcript';
  });

  if (!hasTranscript) {
    if (buyer.thesis_summary) provenanceWarnings.push('thesis_summary has no transcript backing');
    if (buyer.target_revenue_min || buyer.target_revenue_max) provenanceWarnings.push('deal structure has no transcript backing — may be PE firm new-platform criteria');
    if (buyer.target_ebitda_min || buyer.target_ebitda_max) provenanceWarnings.push('EBITDA range has no transcript backing');
  }

  // Check for suspicious HQ data (PE firm HQ leakage indicator)
  if (buyer.hq_city && buyer.pe_firm_website && !hasTranscript) {
    const peWebsiteClean = (buyer.pe_firm_website || '').toLowerCase().replace(/https?:\/\//, '').replace(/\/$/, '');
    const platformWebsiteClean = (buyer.platform_website || buyer.company_website || '').toLowerCase().replace(/https?:\/\//, '').replace(/\/$/, '');
    if (!platformWebsiteClean || platformWebsiteClean === peWebsiteClean) {
      provenanceWarnings.push(`HQ (${buyer.hq_city}, ${buyer.hq_state}) may be PE firm HQ — no platform website to verify`);
    }
  }

  return { provenanceWarnings };
}

export async function fetchScoringAdjustments(supabase: SupabaseClient, listingId: string): Promise<ScoringAdjustment[]> {
  const { data, error } = await supabase
    .from("deal_scoring_adjustments")
    .select("*")
    .eq("listing_id", listingId);

  if (error) {
    console.warn("Failed to fetch scoring adjustments:", error);
    return [];
  }
  return (data || []) as ScoringAdjustment[];
}

export function applyCustomInstructionBonus(adjustments: ScoringAdjustment[]): CustomInstructionResult {
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
