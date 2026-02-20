import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { query, universeId, limit = 20 } = await req.json();

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing natural language query: "${query}"`);

    // Fetch all buyers (with optional universe filter)
    let buyerQuery = supabase
      .from('remarketing_buyers')
      .select(`
        id,
        company_name,
        company_website,
        buyer_type,
        thesis_summary,
        target_geographies,
        target_services,
        target_revenue_min,
        target_revenue_max,
        target_ebitda_min,
        target_ebitda_max,
        geographic_footprint,
        data_completeness,
        universe_id,
        archived
      `)
      .eq('archived', false);

    if (universeId) {
      buyerQuery = buyerQuery.eq('universe_id', universeId);
    }

    const { data: buyers, error: buyersError } = await buyerQuery;

    if (buyersError) {
      console.error('Error fetching buyers:', buyersError);
      throw buyersError;
    }

    if (!buyers || buyers.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        buyers: [],
        message: 'No buyers found in the database.',
        query,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create a MINIMAL summary of buyers for AI context
    // SECURITY: Only send non-sensitive data to external AI service
    // Avoid sending: thesis details, strategy, competitive info
    const buyerSummary = buyers.map(b => ({
      id: b.id,
      name: b.company_name,
      type: b.buyer_type,
      // Only send geographic focus, not detailed thesis
      geographies: b.target_geographies?.join(', ') || 'Not specified',
      services: b.target_services?.join(', ') || 'Not specified',
      footprint: b.geographic_footprint?.join(', ') || 'Not specified',
      revenue_range: b.target_revenue_min || b.target_revenue_max
        ? `$${b.target_revenue_min ? (b.target_revenue_min/1000000).toFixed(1) : '?'}M - $${b.target_revenue_max ? (b.target_revenue_max/1000000).toFixed(1) : '?'}M`
        : 'Not specified',
      ebitda_range: b.target_ebitda_min || b.target_ebitda_max
        ? `$${b.target_ebitda_min ? (b.target_ebitda_min/1000000).toFixed(1) : '?'}M - $${b.target_ebitda_max ? (b.target_ebitda_max/1000000).toFixed(1) : '?'}M`
        : 'Not specified',
      // Omit thesis_summary for privacy - use only non-sensitive metadata
    }));

    // Use AI to find matching buyers
    const searchPrompt = `You are an M&A analyst assistant. Search through the buyer database and find buyers that match the user's query.

USER QUERY: "${query}"

BUYER DATABASE (${buyerSummary.length} buyers):
${JSON.stringify(buyerSummary, null, 2)}

Analyze the query and find all buyers that match the criteria. Consider:
- Geographic targets and current footprint
- Service/industry focus
- Size preferences (revenue, EBITDA)
- Buyer type (PE firm, platform, strategic, family office)
- Investment thesis keywords

Return a JSON response with:
{
  "matchedBuyerIds": ["array of buyer IDs that match, ordered by relevance"],
  "reasoning": "Brief explanation of why these buyers match",
  "searchCriteria": {
    "geographies": ["extracted geography filters"],
    "services": ["extracted service filters"],
    "buyerTypes": ["extracted buyer type filters"],
    "revenueMin": number or null,
    "revenueMax": number or null,
    "keywords": ["other relevant keywords used"]
  },
  "suggestions": "Optional: suggest refinements to get better results"
}

If no buyers match, return an empty matchedBuyerIds array with an explanation.
Focus on relevance - only include buyers that genuinely match the query criteria.`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an M&A buyer search assistant. Find buyers matching natural language queries. Always respond with valid JSON.' },
          { role: 'user', content: searchPrompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const searchResult = JSON.parse(aiData.choices[0].message.content);

    console.log('AI search result:', JSON.stringify(searchResult, null, 2));

    // Get full buyer details for matched IDs
    const matchedIds = searchResult.matchedBuyerIds?.slice(0, limit) || [];
    const matchedBuyers = buyers
      .filter(b => matchedIds.includes(b.id))
      .sort((a, b) => matchedIds.indexOf(a.id) - matchedIds.indexOf(b.id));

    return new Response(JSON.stringify({
      success: true,
      query,
      buyers: matchedBuyers,
      totalMatches: matchedIds.length,
      reasoning: searchResult.reasoning,
      searchCriteria: searchResult.searchCriteria,
      suggestions: searchResult.suggestions,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in query-buyer-universe:', error);
    const message = error instanceof Error ? error.message : 'Failed to search buyers';
    return new Response(JSON.stringify({ 
      error: message,
      details: String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
