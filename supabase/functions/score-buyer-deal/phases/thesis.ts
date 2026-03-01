/**
 * PHASE 6: THESIS ALIGNMENT BONUS (AI-scored) + DATA QUALITY BONUS
 */

import { trackAiFallback } from "../config.ts";
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../../_shared/ai-providers.ts";
import { fetchWithRetry } from "./utils.ts";
import type { Listing, Buyer, ThesisResult, DataQualityResult } from "../types.ts";

export async function calculateThesisAlignmentBonus(
  listing: Listing,
  buyer: Buyer,
  apiKey: string
): Promise<ThesisResult> {
  const thesis = buyer.thesis_summary || '';
  if (thesis.length <= 30) {
    return { bonus: 0, reasoning: '' };
  }

  try {
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_KEY) {
      return calculateThesisBonusFallback(listing, buyer);
    }

    const tool = {
      type: "function",
      function: {
        name: "score_thesis_alignment",
        description: "Score thesis-deal alignment 0-20",
        parameters: {
          type: "object",
          properties: {
            score: { type: "number", description: "0-20 alignment score" },
            reasoning: { type: "string", description: "Brief explanation" }
          },
          required: ["score", "reasoning"]
        }
      }
    };

    const systemPrompt = "Score 0-20 how well this deal matches the buyer's thesis. ONLY score based on explicit thesis statements. 16-20=exact match, 11-15=strong, 6-10=partial, 1-5=minimal, 0=none.";
    const userPrompt = `THESIS: ${thesis.substring(0, 500)}
BUYER TARGETS: ${(buyer.target_services || []).join(', ')}
DEAL: ${listing.title}, Services: ${(listing.services || []).join(', ')}, Location: ${listing.location}, Revenue: ${listing.revenue ? `$${listing.revenue.toLocaleString()}` : 'Unknown'}`;

    const geminiResp = await fetchWithRetry(GEMINI_API_URL, {
      method: 'POST',
      headers: getGeminiHeaders(GEMINI_KEY),
      body: JSON.stringify({
        model: DEFAULT_GEMINI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [tool],
        tool_choice: { type: 'function', function: { name: 'score_thesis_alignment' } },
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (geminiResp.ok) {
      const geminiData = await geminiResp.json();
      const tc = geminiData.choices?.[0]?.message?.tool_calls?.[0];
      if (tc?.function?.arguments) {
        const parsed = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments;
        return {
          bonus: Math.max(0, Math.min(20, parsed.score || 0)),
          reasoning: parsed.reasoning || ''
        };
      }
    }
  } catch (e) {
    trackAiFallback('thesis_alignment', e);
  }

  // Fallback to pattern matching
  return calculateThesisBonusFallback(listing, buyer);
}

export function calculateThesisBonusFallback(listing: Listing, buyer: Buyer): ThesisResult {
  const thesis = (buyer.thesis_summary || '').toLowerCase();
  if (!thesis || thesis.length < 10) return { bonus: 0, reasoning: '' };

  const dealText = [
    listing.description || '',
    listing.executive_summary || '',
    (listing.services || []).join(' ')
  ].join(' ').toLowerCase();

  let points = 0;
  const matches: string[] = [];

  const patterns = [
    { pattern: /roll[\s-]?up/i, value: 3, label: 'roll-up' },
    { pattern: /platform/i, value: 3, label: 'platform' },
    { pattern: /add[\s-]?on|bolt[\s-]?on/i, value: 3, label: 'add-on' },
    { pattern: /recurring\s+revenue|subscription/i, value: 2, label: 'recurring revenue' },
    { pattern: /multi[\s-]?location/i, value: 2, label: 'multi-location' },
    { pattern: /restoration|collision|hvac|plumbing/i, value: 2, label: 'industry match' },
  ];

  for (const { pattern, value, label } of patterns) {
    if (pattern.test(thesis) && pattern.test(dealText)) {
      points += value;
      matches.push(label);
    }
  }

  return {
    bonus: Math.min(20, points),
    reasoning: matches.length > 0 ? `Thesis patterns: ${matches.join(', ')}` : ''
  };
}

export function calculateDataQualityBonus(_buyer: Buyer): DataQualityResult {
  // REMOVED: Data quality bonus was rewarding information richness over match quality.
  return { bonus: 0, details: [] };
}
