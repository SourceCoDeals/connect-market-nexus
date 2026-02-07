import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { contextType, listingId, universeId, query, messages = [] } = await req.json();

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[chat-remarketing] Context: ${contextType}, Query: "${query.substring(0, 100)}..."`);

    let systemPrompt = "";
    
    // Build context-specific system prompt
    switch (contextType) {
      case "deal":
        systemPrompt = await buildDealContext(supabase, listingId);
        break;
      case "deals":
        systemPrompt = await buildDealsContext(supabase);
        break;
      case "buyers":
        systemPrompt = await buildBuyersContext(supabase);
        break;
      case "universe":
        systemPrompt = await buildUniverseContext(supabase, universeId);
        break;
      default:
        systemPrompt = await buildDealsContext(supabase);
    }

    // Build conversation messages
    const conversationMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: query },
    ];

    // Stream response from AI
    const response = await fetch(LOVABLE_AI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: conversationMessages,
        stream: true,
        max_tokens: 2000,
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (response.status === 402) {
      return new Response(JSON.stringify({ error: 'Payment required, please add credits to your workspace.' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'Failed to generate response. Please try again.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Return streaming response
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: unknown) {
    console.error('[chat-remarketing] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process query';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Build context for deal-level queries
async function buildDealContext(supabase: any, listingId: string): Promise<string> {
  if (!listingId) {
    return "No deal selected. Please select a deal to get buyer recommendations.";
  }

  const [dealResult, buyersResult, scoresResult, universesResult, transcriptsResult] = await Promise.all([
    supabase.from('listings').select('*').eq('id', listingId).single(),
    supabase.from('remarketing_buyers').select('*').eq('archived', false).limit(150),
    supabase.from('remarketing_scores').select('*').eq('listing_id', listingId),
    supabase.from('remarketing_buyer_universes').select('id, name, ma_guide_content, fit_criteria, size_criteria, geography_criteria, service_criteria, scoring_behavior').eq('archived', false),
    supabase.from('call_transcripts').select('key_quotes, ceo_detected, extracted_insights, created_at, call_type').eq('listing_id', listingId).order('created_at', { ascending: false }).limit(3),
  ]);

  const deal = dealResult.data;
  const buyers = buyersResult.data || [];
  const scores = scoresResult.data || [];
  const universes = universesResult.data || [];
  const transcripts = transcriptsResult.data || [];

  if (!deal) {
    return "Deal not found.";
  }

  const scoreMap = new Map(scores.map((s: any) => [s.buyer_id, s]));
  
  const buyerSummaries = buyers.map((buyer: any) => {
    const score = scoreMap.get(buyer.id) as any;
    return {
      id: buyer.id,
      name: buyer.company_name || buyer.pe_firm_name,
      peFirm: buyer.pe_firm_name,
      type: buyer.buyer_type,
      hq: buyer.hq_city && buyer.hq_state ? `${buyer.hq_city}, ${buyer.hq_state}` : null,
      footprint: buyer.geographic_footprint || [],
      targetGeos: buyer.target_geographies || [],
      thesis: buyer.thesis_summary,
      businessSummary: buyer.business_summary?.substring(0, 200),
      acquisitions: buyer.total_acquisitions,
      recentAcquisitions: buyer.recent_acquisitions,
      appetite: buyer.acquisition_appetite,
      acquisitionTimeline: buyer.acquisition_timeline,
      targetRevenueMin: buyer.target_revenue_min,
      targetRevenueMax: buyer.target_revenue_max,
      targetEbitdaMin: buyer.target_ebitda_min,
      targetEbitdaMax: buyer.target_ebitda_max,
      targetServices: buyer.target_services || [],
      targetIndustries: buyer.target_industries || [],
      dealBreakers: buyer.deal_breakers || [],
      strategicPriorities: buyer.strategic_priorities,
      feeAgreement: buyer.has_fee_agreement,
      dataQuality: buyer.data_completeness,
      score: score?.composite_score,
      geoScore: score?.geography_score,
      sizeScore: score?.size_score,
      serviceScore: score?.service_score,
      status: score?.status?.toUpperCase() || 'PENDING',
      fitReasoning: score?.fit_reasoning,
    };
  });

  // Build industry guide context
  const guideContext = universes
    .filter((u: any) => u.ma_guide_content)
    .map((u: any) => `## ${u.name} Industry Guide:\n${u.ma_guide_content?.substring(0, 3000)}`)
    .join('\n\n');

  const criteriaContext = universes.map((u: any) => `
### ${u.name} Fit Criteria:
- Size: ${JSON.stringify(u.size_criteria || {})}
- Geography: ${JSON.stringify(u.geography_criteria || {})}
- Services: ${JSON.stringify(u.service_criteria || {})}
- Scoring: ${JSON.stringify(u.scoring_behavior || {})}
`).join('\n');

  const transcriptContext = transcripts && transcripts.length > 0
    ? `\n\nRECENT CALL TRANSCRIPTS (${transcripts.length} calls):\n${transcripts.map((t: any, idx: number) => `
**Call ${idx + 1}** (${new Date(t.created_at).toLocaleDateString()}):
- Type: ${t.call_type || 'Unknown'}
- CEO Detected: ${t.ceo_detected ? 'Yes' : 'No'}
- Key Quotes: ${JSON.stringify(t.key_quotes) || 'None'}
- Extracted Insights: ${JSON.stringify(t.extracted_insights) || 'None'}
`).join('\n')}`
    : '\n\n(No call transcripts available for this deal)';

  return `You are an M&A analyst assistant with deep knowledge of buyers, deals, and industry dynamics.

CURRENT DEAL:
- Company: ${deal.title || deal.internal_company_name || 'Unknown'}
- Location: ${deal.location || 'Unknown'}
- States: ${deal.geographic_states?.join(', ') || 'Not specified'}
- Revenue: ${deal.revenue ? `$${(deal.revenue/1000000).toFixed(1)}M` : 'Unknown'}
- EBITDA: ${deal.ebitda ? `$${(deal.ebitda/1000000).toFixed(1)}M` : 'Unknown'}
- Industry: ${deal.category || 'Unknown'}
- Services: ${deal.services || 'Not specified'}
- Business Model: ${deal.business_model || 'Not specified'}
- Description: ${deal.description || 'Not available'}
- Owner Goals: ${deal.owner_goals || 'Not specified'}
- Key Risks: ${Array.isArray(deal.key_risks) ? deal.key_risks.join(', ') : (deal.key_risks || 'None identified')}
- Location Count: ${deal.location_count || 'Unknown'}
- Employee Count: ${deal.employees || 'Unknown'}
${transcriptContext}

${guideContext ? `INDUSTRY RESEARCH GUIDES:\n${guideContext}\n` : ''}

${criteriaContext ? `BUYER FIT CRITERIA:\n${criteriaContext}\n` : ''}

BUYERS WITH FULL DETAILS (${buyerSummaries.length} total):
${JSON.stringify(buyerSummaries.slice(0, 60), null, 2)}

INSTRUCTIONS:
1. Recommend specific buyers by name in **bold**
2. Explain WHY each buyer matches based on their thesis, geography, size preferences, services
3. Reference the industry guide when explaining fit
4. Use score breakdowns (geo, size, service) to justify recommendations
5. Mention deal breakers if any apply
6. Prioritize PENDING buyers unless asked otherwise
7. When referencing transcript content, cite the call date and insights
8. If asked about transcripts but none available, explicitly state this
9. Never hallucinate transcript quotes - only use actual extracted_insights data
10. Keep responses concise with bullet points
11. At the end, include: <!-- HIGHLIGHT: ["buyer-id-1", "buyer-id-2"] -->`;
}

// Build context for all-deals queries
async function buildDealsContext(supabase: any): Promise<string> {
  const [dealsResult, universesResult] = await Promise.all([
    supabase.from('listings').select('*').eq('is_active', true).order('deal_total_score', { ascending: false, nullsFirst: false }).limit(100),
    supabase.from('remarketing_buyer_universes').select('id, name, ma_guide_content, fit_criteria, size_criteria, geography_criteria, service_criteria').eq('archived', false),
  ]);

  const deals = dealsResult.data || [];
  const universes = universesResult.data || [];

  const dealSummaries = deals.map((d: any) => ({
    id: d.id,
    name: d.internal_company_name || d.title,
    location: d.location,
    states: d.geographic_states || [],
    revenue: d.revenue ? `$${(d.revenue/1000000).toFixed(1)}M` : null,
    ebitda: d.ebitda ? `$${(d.ebitda/1000000).toFixed(1)}M` : null,
    industry: d.category,
    services: d.services,
    businessModel: d.business_model,
    ownerGoals: d.owner_goals,
    keyRisks: d.key_risks || [],
    locationCount: d.location_count,
    employees: d.employees,
    score: d.deal_total_score,
    enriched: !!d.enriched_at,
    priority: d.is_priority_target,
    addedAt: d.created_at,
    description: d.description?.substring(0, 150),
  }));

  const guideContext = universes
    .filter((u: any) => u.ma_guide_content)
    .map((u: any) => `## ${u.name} Industry Guide:\n${u.ma_guide_content?.substring(0, 2000)}`)
    .join('\n\n');

  const criteriaContext = universes.map((u: any) => `
### ${u.name} Criteria:
- Size: ${JSON.stringify(u.size_criteria || {})}
- Geography: ${JSON.stringify(u.geography_criteria || {})}
- Services: ${JSON.stringify(u.service_criteria || {})}
`).join('\n');

  const priorityCount = deals.filter((d: any) => d.is_priority_target).length;
  const enrichedCount = deals.filter((d: any) => d.enriched_at).length;
  const avgScore = deals.filter((d: any) => d.deal_total_score).reduce((sum: number, d: any) => sum + (d.deal_total_score || 0), 0) / (deals.filter((d: any) => d.deal_total_score).length || 1);

  return `You are an M&A analyst assistant with deep knowledge of the deal pipeline and industry dynamics.

DEALS OVERVIEW:
- Total Deals: ${deals.length}
- Priority Targets: ${priorityCount}
- Enriched: ${enrichedCount}
- Average Quality Score: ${avgScore.toFixed(0)}/100

${guideContext ? `INDUSTRY RESEARCH GUIDES:\n${guideContext}\n` : ''}

${criteriaContext ? `BUYER FIT CRITERIA:\n${criteriaContext}\n` : ''}

DEALS WITH FULL DETAILS:
${JSON.stringify(dealSummaries.slice(0, 50), null, 2)}

INSTRUCTIONS:
1. Reference specific deals by name in **bold**
2. Use industry guides to assess deal quality and fit
3. Compare deals against fit criteria when relevant
4. Provide data-driven insights (scores, revenue, industry trends)
5. Suggest actions (enrich, prioritize, etc.) when relevant
6. Keep responses concise with bullet points
7. At the end for deals mentioned, include: <!-- HIGHLIGHT: ["deal-id-1", "deal-id-2"] -->`;
}

// Build context for all-buyers queries
async function buildBuyersContext(supabase: any): Promise<string> {
  const [buyersResult, universesResult] = await Promise.all([
    supabase.from('remarketing_buyers').select('*').eq('archived', false).order('alignment_score', { ascending: false, nullsFirst: false }).limit(150),
    supabase.from('remarketing_buyer_universes').select('id, name, ma_guide_content, fit_criteria, size_criteria, geography_criteria, service_criteria').eq('archived', false),
  ]);

  const buyers = buyersResult.data || [];
  const universes = universesResult.data || [];
  
  const typeCounts = buyers.reduce((acc: any, b: any) => {
    acc[b.buyer_type || 'other'] = (acc[b.buyer_type || 'other'] || 0) + 1;
    return acc;
  }, {});

  const buyerSummaries = buyers.map((b: any) => ({
    id: b.id,
    name: b.company_name || b.pe_firm_name,
    type: b.buyer_type,
    peFirm: b.pe_firm_name,
    peFirmWebsite: b.pe_firm_website,
    hq: b.hq_city && b.hq_state ? `${b.hq_city}, ${b.hq_state}` : null,
    footprint: b.geographic_footprint || [],
    targetGeos: b.target_geographies || [],
    thesis: b.thesis_summary,
    businessSummary: b.business_summary?.substring(0, 200),
    targetServices: b.target_services || [],
    targetIndustries: b.target_industries || [],
    targetRevenueMin: b.target_revenue_min,
    targetRevenueMax: b.target_revenue_max,
    targetEbitdaMin: b.target_ebitda_min,
    targetEbitdaMax: b.target_ebitda_max,
    acquisitions: b.total_acquisitions,
    recentAcquisitions: b.recent_acquisitions,
    appetite: b.acquisition_appetite,
    acquisitionTimeline: b.acquisition_timeline,
    dealBreakers: b.deal_breakers || [],
    strategicPriorities: b.strategic_priorities,
    feeAgreement: b.has_fee_agreement,
    dataQuality: b.data_completeness,
    alignmentScore: b.alignment_score,
  }));

  const guideContext = universes
    .filter((u: any) => u.ma_guide_content)
    .map((u: any) => `## ${u.name} Industry Guide:\n${u.ma_guide_content?.substring(0, 2000)}`)
    .join('\n\n');

  const criteriaContext = universes.map((u: any) => `
### ${u.name} Criteria:
- Size: ${JSON.stringify(u.size_criteria || {})}
- Geography: ${JSON.stringify(u.geography_criteria || {})}
- Services: ${JSON.stringify(u.service_criteria || {})}
`).join('\n');

  return `You are an M&A analyst assistant with deep knowledge of buyers and industry dynamics.

BUYERS OVERVIEW:
- Total Buyers: ${buyers.length}
- PE Firms: ${typeCounts['pe_firm'] || 0}
- Platforms: ${typeCounts['platform'] || 0}
- Strategic: ${typeCounts['strategic'] || 0}
- Family Offices: ${typeCounts['family_office'] || 0}

${guideContext ? `INDUSTRY RESEARCH GUIDES:\n${guideContext}\n` : ''}

${criteriaContext ? `BUYER FIT CRITERIA:\n${criteriaContext}\n` : ''}

BUYERS WITH FULL DETAILS:
${JSON.stringify(buyerSummaries.slice(0, 60), null, 2)}

INSTRUCTIONS:
1. Reference specific buyers by name in **bold**
2. Use industry guides to assess buyer fit and positioning
3. Compare buyers against fit criteria
4. Highlight key attributes (thesis, geography, size preferences, acquisition history)
5. Mention deal breakers and strategic priorities
6. Group by type when comparing buyers
7. Keep responses concise with bullet points
8. At the end for buyers mentioned, include: <!-- HIGHLIGHT: ["buyer-id-1", "buyer-id-2"] -->`;
}

// Build context for universe-level queries  
async function buildUniverseContext(supabase: any, universeId: string): Promise<string> {
  if (!universeId) {
    return "No universe selected.";
  }

  const [universeResult, buyersResult, dealsResult, scoresResult] = await Promise.all([
    supabase.from('remarketing_buyer_universes').select('*').eq('id', universeId).single(),
    supabase.from('remarketing_buyers').select('*').eq('universe_id', universeId).eq('archived', false).limit(100),
    supabase.from('remarketing_universe_deals').select('listing:listings(*)').eq('universe_id', universeId).eq('status', 'active'),
    supabase.from('remarketing_scores').select('*').eq('universe_id', universeId),
  ]);

  const universe = universeResult.data;
  const buyers = buyersResult.data || [];
  const deals = dealsResult.data || [];
  const scores = scoresResult.data || [];

  if (!universe) {
    return "Universe not found.";
  }

  const buyerSummaries = buyers.map((b: any) => ({
    id: b.id,
    name: b.company_name || b.pe_firm_name,
    type: b.buyer_type,
    peFirm: b.pe_firm_name,
    hq: b.hq_city && b.hq_state ? `${b.hq_city}, ${b.hq_state}` : null,
    footprint: b.geographic_footprint || [],
    targetGeos: b.target_geographies || [],
    thesis: b.thesis_summary,
    businessSummary: b.business_summary?.substring(0, 150),
    targetServices: b.target_services || [],
    targetRevenueMin: b.target_revenue_min,
    targetRevenueMax: b.target_revenue_max,
    acquisitions: b.total_acquisitions,
    appetite: b.acquisition_appetite,
    dealBreakers: b.deal_breakers || [],
    alignmentScore: b.alignment_score,
    dataQuality: b.data_completeness,
  }));

  const dealSummaries = deals.map((d: any) => ({
    id: d.listing?.id,
    name: d.listing?.internal_company_name || d.listing?.title,
    location: d.listing?.location,
    states: d.listing?.geographic_states || [],
    revenue: d.listing?.revenue ? `$${(d.listing.revenue/1000000).toFixed(1)}M` : null,
    ebitda: d.listing?.ebitda ? `$${(d.listing.ebitda/1000000).toFixed(1)}M` : null,
    services: d.listing?.services,
    businessModel: d.listing?.business_model,
    ownerGoals: d.listing?.owner_goals,
  }));

  return `You are an M&A analyst assistant with deep knowledge of this buyer universe.

UNIVERSE: ${universe.name}
Description: ${universe.description || 'Not specified'}

FIT CRITERIA:
${universe.fit_criteria || 'Not specified'}

SIZE CRITERIA:
${JSON.stringify(universe.size_criteria || {}, null, 2)}

GEOGRAPHY CRITERIA:
${JSON.stringify(universe.geography_criteria || {}, null, 2)}

SERVICE CRITERIA:
${JSON.stringify(universe.service_criteria || {}, null, 2)}

SCORING BEHAVIOR:
${JSON.stringify(universe.scoring_behavior || {}, null, 2)}

${universe.ma_guide_content ? `INDUSTRY RESEARCH GUIDE:\n${universe.ma_guide_content}\n` : ''}

BUYERS IN UNIVERSE (${buyers.length} total):
${JSON.stringify(buyerSummaries.slice(0, 50), null, 2)}

DEALS IN UNIVERSE (${deals.length} linked):
${JSON.stringify(dealSummaries.slice(0, 30), null, 2)}

SCORES SUMMARY:
- Total Scores: ${scores.length}
- Approved: ${scores.filter((s: any) => s.status === 'approved').length}
- Passed: ${scores.filter((s: any) => s.status === 'passed').length}
- Pending: ${scores.filter((s: any) => s.status === 'pending' || !s.status).length}

INSTRUCTIONS:
1. Reference specific buyers/deals by name in **bold**
2. Use the industry guide to explain fit and market dynamics
3. Compare buyers/deals against the fit criteria
4. Highlight alignment scores and score breakdowns
5. Suggest improvements to the universe
6. Keep responses concise with bullet points
7. At the end, include: <!-- HIGHLIGHT: ["id-1", "id-2"] -->`;
}
