import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dealServiceMix, trackerServiceCriteria, buyerServicesOffered } = await req.json();

    if (!dealServiceMix) {
      return new Response(
        JSON.stringify({ error: 'dealServiceMix is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      // Fall back to keyword matching
      const result = keywordMatch(dealServiceMix, trackerServiceCriteria, buyerServicesOffered);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // AI-powered semantic matching
    const systemPrompt = `You are an M&A service alignment expert. Compare deal services with buyer preferences and return a structured assessment.

Analyze:
1. Primary service overlap
2. Secondary/complementary services
3. Potential conflicts or misalignments
4. Overall fit assessment

Return JSON only:
{
  "alignment": "strong" | "good" | "partial" | "weak" | "conflict",
  "score": 0-100,
  "primaryMatches": ["service1", "service2"],
  "secondaryMatches": ["service3"],
  "gaps": ["missing service"],
  "conflicts": ["conflicting area"],
  "reasoning": "Brief explanation"
}`;

    const userPrompt = `Deal Services: ${dealServiceMix}

${trackerServiceCriteria ? `Tracker Service Criteria: ${JSON.stringify(trackerServiceCriteria)}` : ''}

${buyerServicesOffered ? `Buyer Services Offered: ${buyerServicesOffered}` : ''}

Analyze the service fit between this deal and the buyer's preferences.`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GEMINI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.0-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('AI API error:', response.status);
      // Fall back to keyword matching
      const result = keywordMatch(dealServiceMix, trackerServiceCriteria, buyerServicesOffered);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return new Response(
        JSON.stringify({ success: true, method: 'ai', ...parsed }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fall back to keyword matching if AI response parsing fails
    const result = keywordMatch(dealServiceMix, trackerServiceCriteria, buyerServicesOffered);
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in score-service-fit:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function keywordMatch(
  dealServices: string,
  trackerCriteria: any,
  buyerServices?: string
): { success: boolean; method: string; alignment: string; score: number; matches: string[]; reasoning: string } {
  const dealKeywords = extractKeywords(dealServices);
  
  const targetKeywords = new Set<string>();
  
  if (trackerCriteria?.target_services) {
    trackerCriteria.target_services.forEach((s: string) => {
      extractKeywords(s).forEach(k => targetKeywords.add(k));
    });
  }
  
  if (buyerServices) {
    extractKeywords(buyerServices).forEach(k => targetKeywords.add(k));
  }

  if (targetKeywords.size === 0) {
    return {
      success: true,
      method: 'keyword',
      alignment: 'partial',
      score: 50,
      matches: [],
      reasoning: 'No buyer service preferences available for comparison'
    };
  }

  const matches: string[] = [];
  for (const keyword of dealKeywords) {
    if (targetKeywords.has(keyword)) {
      matches.push(keyword);
    }
  }

  const matchRatio = matches.length / Math.max(dealKeywords.length, 1);
  
  let alignment: string;
  let score: number;
  
  if (matchRatio >= 0.7) {
    alignment = 'strong';
    score = 90 + Math.floor(matchRatio * 10);
  } else if (matchRatio >= 0.5) {
    alignment = 'good';
    score = 70 + Math.floor(matchRatio * 20);
  } else if (matchRatio >= 0.3) {
    alignment = 'partial';
    score = 50 + Math.floor(matchRatio * 30);
  } else if (matchRatio > 0) {
    alignment = 'weak';
    score = 30 + Math.floor(matchRatio * 40);
  } else {
    alignment = 'weak';
    score = 20;
  }

  return {
    success: true,
    method: 'keyword',
    alignment,
    score,
    matches,
    reasoning: `${matches.length} of ${dealKeywords.length} deal services match buyer preferences`
  };
}

function extractKeywords(text: string): string[] {
  if (!text) return [];
  
  const stopWords = new Set(['and', 'or', 'the', 'a', 'an', 'of', 'for', 'to', 'in', 'on', 'with', 'by']);
  
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .map(word => word.trim());
}
