/**
 * PHASE 5: OWNER GOALS SCORING (AI-powered with fallback)
 */

import { trackAiFallback } from "../config.ts";
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../../_shared/ai-providers.ts";
import { fetchWithRetry } from "./utils.ts";
import type { Listing, Buyer, OwnerGoalsResult } from "../types.ts";

export async function calculateOwnerGoalsScore(
  listing: Listing,
  buyer: Buyer,
  apiKey: string,
  customInstructions?: string
): Promise<OwnerGoalsResult> {
  // Try AI scoring first
  try {
    return await callOwnerGoalsFitAI(listing, buyer, apiKey, customInstructions);
  } catch (e) {
    trackAiFallback('owner_goals', e);
  }

  // Fallback: buyer-type norms lookup
  return ownerGoalsFallback(listing, buyer);
}

async function callOwnerGoalsFitAI(
  listing: Listing,
  buyer: Buyer,
  apiKey: string,
  customInstructions?: string
): Promise<OwnerGoalsResult> {
  const customContext = customInstructions ? `\nADDITIONAL SCORING INSTRUCTIONS: ${customInstructions}` : '';
  const prompt = `Score 0-100 how well this buyer aligns with what the seller wants:

DEAL:
- Owner Goals: ${listing.owner_goals || listing.seller_motivation || 'Not specified'}
- Transition Preferences: ${listing.transition_preferences || listing.timeline_preference || 'Not specified'}
- Special Requirements: ${listing.special_requirements || 'None'}
- Ownership Structure: ${listing.ownership_structure || 'Unknown'}

BUYER:
- Type: ${buyer.buyer_type || 'Unknown'}
- Thesis: ${(buyer.thesis_summary || '').substring(0, 300)}
- Buyer Type Norms: PE=majority recap+rollover+1-2yr transition, Platform=operators stay, Strategic=full buyout, Family Office=flexible${customContext}

If buyer data is sparse, score based on buyer TYPE norms vs seller goals.
Conflicts (exit timing, structure mismatch) pull score down 25-35.
Alignment (growth partner+PE platform, stay on+platform wants operators) push score up 75-90.
If cannot evaluate, score 50.

Return JSON: {"score": number, "reasoning": "one sentence"}`;

  const response = await fetchWithRetry(GEMINI_API_URL, {
    method: "POST",
    headers: getGeminiHeaders(apiKey),
    body: JSON.stringify({
      model: DEFAULT_GEMINI_MODEL,
      messages: [
        { role: "system", content: "You are an M&A owner-goals alignment scorer. Return ONLY valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) throw new Error(`Owner goals AI failed: ${response.status}`);
  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content");
  const parsed = JSON.parse(content);
  return {
    score: Math.max(0, Math.min(100, parsed.score || 50)),
    reasoning: parsed.reasoning || ''
  };
}

export function ownerGoalsFallback(listing: Listing, buyer: Buyer): OwnerGoalsResult {
  const ownerGoals = (listing.owner_goals || listing.seller_motivation || '').toLowerCase();
  const buyerType = (buyer.buyer_type || '').toLowerCase();
  const thesis = (buyer.thesis_summary || '').toLowerCase();

  // Buyer-type norms lookup table
  const norms: Record<string, Record<string, number>> = {
    'pe_firm': { base: 55, cash_exit: 40, growth_partner: 75, quick_exit: 50, stay_long: 60, retain_employees: 65, keep_autonomy: 50 },
    'platform': { base: 65, cash_exit: 50, growth_partner: 80, quick_exit: 40, stay_long: 85, retain_employees: 75, keep_autonomy: 60 },
    'strategic': { base: 50, cash_exit: 70, growth_partner: 50, quick_exit: 65, stay_long: 45, retain_employees: 45, keep_autonomy: 30 },
    'family_office': { base: 60, cash_exit: 60, growth_partner: 65, quick_exit: 55, stay_long: 70, retain_employees: 70, keep_autonomy: 80 },
    'independent_sponsor': { base: 58, cash_exit: 55, growth_partner: 70, quick_exit: 60, stay_long: 55, retain_employees: 60, keep_autonomy: 55 },
  };

  const typeNorms = norms[buyerType] || norms['platform'];

  if (!ownerGoals) {
    // No owner goals — differentiate by buyer type and data richness
    let score = typeNorms.base;
    // Buyers with explicit thesis get a slight edge (more data = more signal)
    if (thesis.length > 50) score += 5;
    return { score: Math.max(30, Math.min(85, score)), reasoning: `No owner goals — ${buyerType || 'unknown'} type base score` };
  }

  // Match owner goals to categories using word-boundary-safe checks
  let score = typeNorms.base;
  let matchedCategory = '';
  if (ownerGoals.includes('cash') && ownerGoals.includes('exit')) { score = typeNorms.cash_exit; matchedCategory = 'cash exit'; }
  else if (ownerGoals.includes('growth') || ownerGoals.includes('partner') || ownerGoals.includes('rollover')) { score = typeNorms.growth_partner; matchedCategory = 'growth/partner'; }
  else if (ownerGoals.includes('quick') || ownerGoals.includes('fast') || ownerGoals.includes('30 day') || ownerGoals.includes('60 day')) { score = typeNorms.quick_exit; matchedCategory = 'quick exit'; }
  else if (/\bstay\b/.test(ownerGoals) || /\bcontinue\b/.test(ownerGoals) || /\blong[\s-]?term\b/.test(ownerGoals)) { score = typeNorms.stay_long; matchedCategory = 'stay/continue'; }
  else if (/\bemployee/.test(ownerGoals) || /\bretain\b/.test(ownerGoals) || /\bteam\b/.test(ownerGoals)) { score = typeNorms.retain_employees; matchedCategory = 'retain employees'; }
  else if (/\bautonom/.test(ownerGoals) || /\bindependen/.test(ownerGoals)) { score = typeNorms.keep_autonomy; matchedCategory = 'autonomy'; }

  // Check special_requirements for deal-breaker conflicts
  const specialReqs = (listing.special_requirements || '').toLowerCase();
  if (specialReqs) {
    if (specialReqs.includes('no pe') && buyerType === 'pe_firm') score = Math.max(0, score - 25);
    else if (specialReqs.includes('no strategic') && buyerType === 'strategic') score = Math.max(0, score - 25);
    else if (specialReqs.includes('no family office') && buyerType === 'family_office') score = Math.max(0, score - 25);
  }

  // Bonus/penalty from buyer-specific data
  if (thesis) {
    const goalKeywords = ownerGoals.split(/\s+/).filter((w: string) => w.length > 3);
    const thesisAligns = goalKeywords.some((gw: string) => thesis.includes(gw));
    if (thesisAligns) score = Math.min(100, score + 8);
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reasoning: matchedCategory
      ? `Fallback: ${buyerType || 'unknown'} norms for "${matchedCategory}" goals`
      : `Fallback: ${buyerType || 'unknown'} buyer type base score`
  };
}
