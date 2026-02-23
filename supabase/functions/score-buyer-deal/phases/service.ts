/**
 * PHASE 4: SERVICE SCORING + SERVICE GATE
 */

import { SCORING_CONFIG, DEFAULT_SERVICE_ADJACENCY, trackAiFallback } from "../config.ts";
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../../_shared/ai-providers.ts";
import { fetchWithRetry } from "./utils.ts";
import type { Listing, Buyer, IndustryTracker, ScoringBehavior, ServiceCriteria, ServiceResult } from "../types.ts";

export async function calculateServiceScore(
  listing: Listing,
  buyer: Buyer,
  tracker: IndustryTracker | null,
  behavior: ScoringBehavior,
  serviceCriteria: ServiceCriteria | null,
  apiKey: string,
  customInstructions?: string
): Promise<ServiceResult> {
  const dealServices = (listing.services || listing.categories || [listing.category])
    .filter(Boolean).map((s) => String(s).toLowerCase().trim());

  const buyerTargetServices = (buyer.target_services || [])
    .filter(Boolean).map((s) => String(s).toLowerCase().trim());

  const buyerServicesOffered = (buyer.services_offered || '')
    .toLowerCase().split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);

  const buyerTargetIndustries = (buyer.target_industries || [])
    .filter(Boolean).map((s: string) => s?.toLowerCase().trim());

  const buyerIndustryVertical = (buyer.industry_vertical || '')
    .toLowerCase().split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);

  // Combine buyer services for matching (include industries and vertical as signals)
  const allBuyerServices = [...new Set([...buyerTargetServices, ...buyerServicesOffered, ...buyerTargetIndustries, ...buyerIndustryVertical])];

  // STEP 1: Check hard disqualifiers
  const excludedServices = [
    ...(serviceCriteria?.excluded_services || []),
    ...(buyer.industry_exclusions || [])
  ].map(s => s?.toLowerCase().trim()).filter(Boolean);

  const dealPrimaryService = dealServices[0] || '';
  for (const excluded of excludedServices) {
    if (dealPrimaryService && (dealPrimaryService.includes(excluded) || excluded.includes(dealPrimaryService))) {
      return {
        score: 0,
        multiplier: 0.0,
        reasoning: `DISQUALIFIED: Deal primary service "${dealPrimaryService}" matches excluded service "${excluded}"`
      };
    }
  }

  // STEP 2: Try AI-powered semantic matching (primary path)
  let aiScore: { score: number; reasoning: string } | null = null;
  if (behavior.service_matching_mode !== 'keyword') {
    try {
      aiScore = await callServiceFitAI(listing, buyer, tracker, apiKey, customInstructions);
    } catch (e) {
      trackAiFallback('service_fit', e);
    }
  }

  let score: number;
  let reasoning: string;

  if (aiScore) {
    score = aiScore.score;
    reasoning = aiScore.reasoning;
  } else {
    // STEP 3: Keyword + adjacency fallback
    const { percentage, matchingServices } = calculateServiceOverlap(listing, buyer);

    if (percentage >= 80) {
      score = 90;
      reasoning = `Strong service alignment (${percentage}% overlap): ${matchingServices.join(', ')}`;
    } else if (percentage >= 50) {
      score = 75;
      reasoning = `Good service alignment (${percentage}% overlap): ${matchingServices.join(', ')}`;
    } else if (percentage >= 25) {
      score = 55;
      reasoning = `Partial service alignment (${percentage}% overlap): ${matchingServices.join(', ')}`;
    } else if (percentage > 0) {
      score = 40;
      reasoning = `Weak service alignment (${percentage}% overlap)`;
    } else {
      // 0% keyword overlap — check adjacency map
      const adjacencyMap = tracker?.service_adjacency_map || DEFAULT_SERVICE_ADJACENCY;
      const adjacencyResult = checkServiceAdjacency(dealServices, allBuyerServices, adjacencyMap);

      if (adjacencyResult.hasAdjacency) {
        score = 45;
        reasoning = `Adjacent service match: ${adjacencyResult.matches.join(', ')}`;
      } else {
        // Differentiate "no data to compare" from "compared and no match"
        const buyerHasAnyServiceInfo = buyerTargetServices.length > 0 ||
          buyerServicesOffered.length > 0 ||
          buyerTargetIndustries.length > 0 ||
          buyerIndustryVertical.length > 0;

        if (!buyerHasAnyServiceInfo) {
          score = 55;
          reasoning = "Buyer has no service data — neutral, cannot evaluate fit";
        } else if (dealServices.length === 0 || !dealServices[0]) {
          score = 55;
          reasoning = "Deal has no service data — neutral, cannot evaluate fit";
        } else {
          score = 30;
          reasoning = "No service overlap or adjacency detected between known services";
        }
      }
    }
  }

  // STEP 4: Primary focus bonus — check service_criteria.primary_focus array first, fall back to required_services[0]
  const primaryFocusList: string[] = (tracker?.service_criteria?.primary_focus || [])
    .map((s: string) => s?.toLowerCase())
    .filter(Boolean);
  const fallbackPrimaryFocus = tracker?.service_criteria?.required_services?.[0]?.toLowerCase();
  const allPrimaryFocus = primaryFocusList.length > 0 ? primaryFocusList : (fallbackPrimaryFocus ? [fallbackPrimaryFocus] : []);

  const hasPrimaryFocusMatch = allPrimaryFocus.some((pf: string) =>
    dealPrimaryService.includes(pf) || pf.includes(dealPrimaryService)
  );

  if (hasPrimaryFocusMatch) {
    score = Math.min(100, score + 10);
    reasoning += ". +10pt primary focus match";
  } else {
    // Check preferred_services for a smaller bonus
    const preferredServices: string[] = (tracker?.service_criteria?.preferred_services || [])
      .map((s: string) => s?.toLowerCase())
      .filter(Boolean);
    const hasPreferredMatch = preferredServices.some((ps: string) =>
      dealPrimaryService.includes(ps) || ps.includes(dealPrimaryService)
    );
    if (hasPreferredMatch) {
      score = Math.min(100, score + 3);
      reasoning += ". +3pt preferred service match";
    } else if (buyerTargetServices.length > 0 && dealPrimaryService) {
      const matchesBuyerTarget = buyerTargetServices.some((bs: string) =>
        dealPrimaryService.includes(bs) || bs.includes(dealPrimaryService)
      );
      if (matchesBuyerTarget) {
        score = Math.min(100, score + 5);
        reasoning += ". +5pt buyer target match";
      }
    }
  }

  // Calculate service multiplier from score
  const multiplier = getServiceMultiplier(score);

  return { score, multiplier, reasoning };
}

export function getServiceMultiplier(serviceScore: number): number {
  if (serviceScore === 0) return SCORING_CONFIG.SERVICE_MULT_ZERO;
  if (serviceScore <= 20) return SCORING_CONFIG.SERVICE_MULT_BELOW_20;
  if (serviceScore <= 40) return SCORING_CONFIG.SERVICE_MULT_BELOW_40;
  if (serviceScore <= 60) return SCORING_CONFIG.SERVICE_MULT_BELOW_60;
  if (serviceScore <= 80) return SCORING_CONFIG.SERVICE_MULT_BELOW_80;
  return SCORING_CONFIG.SERVICE_MULT_ABOVE_80;
}

export function checkServiceAdjacency(
  dealServices: string[],
  buyerServices: string[],
  adjacencyMap: Record<string, string[]>
): { hasAdjacency: boolean; matches: string[] } {
  const matches: string[] = [];

  for (const ds of dealServices) {
    if (!ds) continue;
    // Check if deal service appears as adjacency for any buyer service
    for (const bs of buyerServices) {
      if (!bs) continue;
      const adjacent = adjacencyMap[bs] || [];
      if (adjacent.some(adj => ds.includes(adj) || adj.includes(ds))) {
        matches.push(`${ds} ↔ ${bs}`);
      }
    }
    // Also check if buyer service appears as adjacency for deal service
    const dealAdjacent = adjacencyMap[ds] || [];
    for (const bs of buyerServices) {
      if (!bs) continue;
      if (dealAdjacent.some(adj => bs.includes(adj) || adj.includes(bs))) {
        if (!matches.some(m => m.includes(ds) && m.includes(bs))) {
          matches.push(`${ds} ↔ ${bs}`);
        }
      }
    }
  }

  return { hasAdjacency: matches.length > 0, matches: matches.slice(0, 3) };
}

async function callServiceFitAI(
  listing: Listing,
  buyer: Buyer,
  tracker: IndustryTracker | null,
  apiKey: string,
  customInstructions?: string
): Promise<{ score: number; reasoning: string }> {
  const dealServices = (listing.services || listing.categories || [listing.category]).filter(Boolean).join(', ');
  const buyerServices = (buyer.target_services || []).filter(Boolean).join(', ');
  const buyerOffered = buyer.services_offered || '';
  const buyerIndustries = (buyer.target_industries || []).filter(Boolean).join(', ');
  const buyerFocus = buyer.industry_vertical || '';
  const buyerCompanyName = buyer.company_name || buyer.pe_firm_name || '';
  const buyerWebsite = buyer.company_website || '';
  const universeIndustry = tracker?.industry || tracker?.name || '';

  const customContext = customInstructions ? `\nADDITIONAL SCORING INSTRUCTIONS: ${customInstructions}` : '';
  const prompt = `Score 0-100 how well these services align:
DEAL SERVICES: ${dealServices}
DEAL INDUSTRY: ${listing.category || 'Unknown'}
BUYER COMPANY: ${buyerCompanyName}
BUYER WEBSITE: ${buyerWebsite}
BUYER TARGET SERVICES: ${buyerServices || 'Not specified'}
BUYER CURRENT SERVICES: ${buyerOffered || 'Not specified'}
BUYER TARGET INDUSTRIES: ${buyerIndustries || 'Not specified'}
BUYER INDUSTRY VERTICAL: ${buyerFocus || 'Not specified'}
BUYER THESIS: ${(buyer.thesis_summary || '').substring(0, 200)}
UNIVERSE INDUSTRY CONTEXT: ${universeIndustry || 'Not specified'}${customContext}

IMPORTANT: If buyer services are "Not specified" but the buyer company name or website suggests they operate in the same industry as the deal, score 55-70 (inferred match). Only score 20-40 if company name/website clearly suggest a different industry. Do NOT default to 50 for all unknown cases — use company name and context to differentiate.
Score guide: 85-100 = exact match, 60-84 = strong overlap, 40-59 = partial/adjacent, 20-39 = weak adjacency, 0-19 = unrelated.
Return JSON: {"score": number, "reasoning": "one sentence"}`;

  const response = await fetchWithRetry(GEMINI_API_URL, {
    method: "POST",
    headers: getGeminiHeaders(apiKey),
    body: JSON.stringify({
      model: DEFAULT_GEMINI_MODEL,
      messages: [
        { role: "system", content: "You are an M&A service alignment scorer. Return ONLY valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) throw new Error(`Service AI failed: ${response.status}`);
  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content in service AI response");
  const parsed = JSON.parse(content);
  return { score: Math.max(0, Math.min(100, parsed.score || 50)), reasoning: parsed.reasoning || '' };
}

// Service overlap (keyword matching)
export function calculateServiceOverlap(
  listing: Listing,
  buyer: Buyer
): { percentage: number; matchingServices: string[]; allDealServices: string[] } {
  const dealServices = (listing.services || listing.categories || [listing.category])
    .filter(Boolean).map((s) => String(s).toLowerCase().trim());

  // Include target_industries and industry_vertical as additional buyer service signals
  const buyerServices = [
    ...(buyer.target_services || []),
    ...(buyer.target_industries || []),
    ...(buyer.services_offered || '').split(/[,;]/).filter(Boolean),
    ...(buyer.industry_vertical || '').split(/[,;]/).filter(Boolean),
  ].map((s) => String(s).toLowerCase().trim()).filter(Boolean);

  if (buyerServices.length === 0 || dealServices.length === 0) {
    return { percentage: 0, matchingServices: [], allDealServices: dealServices };
  }

  // Tokenize for word-level matching (e.g., "fire restoration" matches "restoration")
  const tokenize = (s: string) => s.split(/[\s\-/&]+/).filter(w => w.length > 2);

  const matching = dealServices.filter((ds: string) =>
    buyerServices.some((bs: string) => {
      // Direct substring match
      if (ds?.includes(bs) || bs?.includes(ds)) return true;
      // Word-level match: any significant word overlap
      const dealTokens = tokenize(ds || '');
      const buyerTokens = tokenize(bs || '');
      return dealTokens.some(dt => buyerTokens.some(bt => dt === bt || dt.includes(bt) || bt.includes(dt)));
    })
  );

  // Use deal services as denominator so data-rich buyers aren't penalized
  const denominator = Math.max(dealServices.length, 1);
  const percentage = Math.round((matching.length / denominator) * 100);
  return { percentage, matchingServices: matching, allDealServices: dealServices };
}
