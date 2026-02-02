import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Score Service Fit - AI Semantic Comparison
 * 
 * Uses AI to semantically compare deal services with buyer/tracker preferences.
 * Falls back to keyword matching if AI call fails.
 */

interface ServiceFitRequest {
  dealServiceMix: string;
  trackerServiceCriteria: any;
  buyerServicesOffered?: string;
  buyerTargetServices?: string[];
  industryName: string;
}

interface ServiceFitResponse {
  score: number;
  reasoning: string;
  alignment: 'strong' | 'good' | 'partial' | 'weak' | 'conflict';
  matchedServices: string[];
  conflictingServices: string[];
  confidence: 'high' | 'medium' | 'low';
  usedAI: boolean;
}

// Keyword-based fallback scoring
function keywordFallbackScore(request: ServiceFitRequest): ServiceFitResponse {
  const dealText = (request.dealServiceMix || '').toLowerCase();
  const requiredServices = (request.trackerServiceCriteria?.required_services || []).map((s: string) => s.toLowerCase());
  const preferredServices = (request.trackerServiceCriteria?.preferred_services || []).map((s: string) => s.toLowerCase());
  const excludedServices = (request.trackerServiceCriteria?.excluded_services || []).map((s: string) => s.toLowerCase());
  const buyerServices = (request.buyerServicesOffered || '').toLowerCase();
  const buyerTargets = (request.buyerTargetServices || []).map((s: string) => s.toLowerCase());
  
  const allBuyerKeywords = new Set([
    ...buyerTargets,
    ...buyerServices.split(/[,;|]/).map(s => s.trim()).filter(Boolean)
  ]);
  
  const matchedServices: string[] = [];
  const conflictingServices: string[] = [];
  
  // Check for exclusion matches (conflicts)
  for (const excluded of excludedServices) {
    if (dealText.includes(excluded)) {
      conflictingServices.push(excluded);
    }
  }
  
  // Check for required/preferred matches
  for (const required of requiredServices) {
    if (dealText.includes(required)) {
      matchedServices.push(required);
    }
  }
  for (const preferred of preferredServices) {
    if (dealText.includes(preferred) && !matchedServices.includes(preferred)) {
      matchedServices.push(preferred);
    }
  }
  
  // Calculate score
  let score = 50;
  
  if (conflictingServices.length > 0) {
    score -= 30;
  }
  
  if (requiredServices.length > 0) {
    const matchRatio = matchedServices.filter(s => requiredServices.includes(s)).length / requiredServices.length;
    score += Math.round(matchRatio * 30);
  } else if (matchedServices.length > 0) {
    score += 20;
  }
  
  if (preferredServices.length > 0) {
    const prefMatchRatio = matchedServices.filter(s => preferredServices.includes(s)).length / preferredServices.length;
    score += Math.round(prefMatchRatio * 15);
  }
  
  // Buyer services alignment bonus
  let buyerMatches = 0;
  for (const bk of allBuyerKeywords) {
    if (dealText.includes(bk)) buyerMatches++;
  }
  if (allBuyerKeywords.size > 0) {
    score += Math.min(10, Math.round((buyerMatches / allBuyerKeywords.size) * 10));
  }
  
  score = Math.max(0, Math.min(100, score));
  
  let alignment: ServiceFitResponse['alignment'] = 'partial';
  if (conflictingServices.length > matchedServices.length) alignment = 'conflict';
  else if (score >= 80) alignment = 'strong';
  else if (score >= 60) alignment = 'good';
  else if (score < 40) alignment = 'weak';
  
  return {
    score,
    reasoning: matchedServices.length > 0 
      ? `Keyword match: ${matchedServices.join(', ')}${conflictingServices.length > 0 ? `. Conflicts: ${conflictingServices.join(', ')}` : ''}`
      : conflictingServices.length > 0 
        ? `Conflicts detected: ${conflictingServices.join(', ')}`
        : 'Limited service overlap detected',
    alignment,
    matchedServices,
    conflictingServices,
    confidence: matchedServices.length > 2 ? 'high' : matchedServices.length > 0 ? 'medium' : 'low',
    usedAI: false
  };
}

// AI-powered semantic scoring
async function aiSemanticScore(request: ServiceFitRequest): Promise<ServiceFitResponse> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    console.log('[score-service-fit] No LOVABLE_API_KEY, falling back to keyword matching');
    return keywordFallbackScore(request);
  }
  
  const prompt = `You are an expert M&A analyst evaluating service fit between a deal and buyer criteria.

INDUSTRY: ${request.industryName}

DEAL'S SERVICE MIX:
${request.dealServiceMix || 'Not specified'}

TRACKER SERVICE CRITERIA:
- Required Services: ${(request.trackerServiceCriteria?.required_services || []).join(', ') || 'None specified'}
- Preferred Services: ${(request.trackerServiceCriteria?.preferred_services || []).join(', ') || 'None specified'}
- Excluded/Off-focus Services: ${(request.trackerServiceCriteria?.excluded_services || []).join(', ') || 'None specified'}
- Primary Focus: ${(request.trackerServiceCriteria?.primary_focus || []).join(', ') || 'Not specified'}

BUYER'S CURRENT SERVICES:
${request.buyerServicesOffered || 'Not specified'}

BUYER'S TARGET SERVICES:
${(request.buyerTargetServices || []).join(', ') || 'Not specified'}

Analyze the semantic fit between the deal's services and the buyer/tracker criteria. Consider:
1. Does the deal's PRIMARY business align with the tracker's primary focus?
2. Are there semantic matches even if exact keywords differ? (e.g., "auto body" = "collision repair")
3. Are there any services that would be deal-breakers for this industry?
4. How complementary are the deal's services to what the buyer is looking for?

Respond in this exact JSON format:
{
  "score": <number 0-100>,
  "alignment": "<strong|good|partial|weak|conflict>",
  "reasoning": "<2-3 sentence explanation>",
  "matched_services": ["<list of matching services>"],
  "conflicting_services": ["<list of conflicting/excluded services>"],
  "confidence": "<high|medium|low>"
}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error('[score-service-fit] AI call failed:', response.status);
      return keywordFallbackScore(request);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[score-service-fit] Could not parse AI response');
      return keywordFallbackScore(request);
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      score: Math.max(0, Math.min(100, parsed.score || 50)),
      reasoning: parsed.reasoning || 'AI analysis complete',
      alignment: parsed.alignment || 'partial',
      matchedServices: parsed.matched_services || [],
      conflictingServices: parsed.conflicting_services || [],
      confidence: parsed.confidence || 'medium',
      usedAI: true
    };
  } catch (error) {
    console.error('[score-service-fit] AI error:', error);
    return keywordFallbackScore(request);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: ServiceFitRequest = await req.json();
    
    if (!request.dealServiceMix && !request.trackerServiceCriteria) {
      return new Response(
        JSON.stringify({ 
          score: 50, 
          reasoning: 'Insufficient data for service comparison',
          alignment: 'partial',
          matchedServices: [],
          conflictingServices: [],
          confidence: 'low',
          usedAI: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use AI for semantic comparison, with keyword fallback
    const result = await aiSemanticScore(request);
    
    console.log(`[score-service-fit] Result: score=${result.score}, alignment=${result.alignment}, usedAI=${result.usedAI}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[score-service-fit] Error:', error);
    return new Response(
      JSON.stringify({ 
        score: 50, 
        reasoning: 'Error during service comparison',
        alignment: 'partial',
        matchedServices: [],
        conflictingServices: [],
        confidence: 'low',
        usedAI: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
