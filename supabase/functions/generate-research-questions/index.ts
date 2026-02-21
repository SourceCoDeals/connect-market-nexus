import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../_shared/ai-providers.ts";

import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  try {
    const { industryName, context } = await req.json();

    if (!industryName) {
      return new Response(
        JSON.stringify({ error: 'industryName is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are an expert M&A research analyst specializing in developing due diligence questions for industry analysis.

Generate insightful research questions that would help understand:
1. Market dynamics and competitive landscape
2. Key success factors and value drivers
3. Regulatory environment and compliance requirements
4. Technology trends and disruption risks
5. Customer concentration and retention metrics
6. Operational benchmarks and KPIs
7. M&A activity and valuation multiples

Return JSON only:
{
  "categories": [
    {
      "name": "Category Name",
      "questions": [
        {
          "question": "The research question",
          "priority": "high" | "medium" | "low",
          "rationale": "Why this matters for M&A"
        }
      ]
    }
  ],
  "industryContext": "Brief industry overview",
  "keyRisks": ["Risk 1", "Risk 2"],
  "valuationDrivers": ["Driver 1", "Driver 2"]
}`;

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: getGeminiHeaders(GEMINI_API_KEY),
      body: JSON.stringify({
        model: DEFAULT_GEMINI_MODEL,
        max_tokens: 4000,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Generate comprehensive M&A research questions for the ${industryName} industry.${context ? `\n\nAdditional context: ${context}` : ''}`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `AI API error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return new Response(
        JSON.stringify({ success: true, ...parsed }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, raw: content }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in generate-research-questions:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
