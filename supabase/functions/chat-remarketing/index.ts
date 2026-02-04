import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "../_shared/security.ts";

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

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limit check
    const rateLimitResult = await checkRateLimit(supabase, user.id, 'ai_query', true);
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult);
    }

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

  const [dealResult, buyersResult, scoresResult] = await Promise.all([
    supabase.from('listings').select('*').eq('id', listingId).single(),
    supabase.from('remarketing_buyers').select('id, company_name, buyer_type, pe_firm_name, hq_city, hq_state, thesis_summary, geographic_footprint, target_geographies, data_completeness, total_acquisitions, acquisition_appetite').eq('archived', false).limit(150),
    supabase.from('remarketing_scores').select('*').eq('listing_id', listingId),
  ]);

  const deal = dealResult.data;
  const buyers = buyersResult.data || [];
  const scores = scoresResult.data || [];

  if (!deal) {
    return "Deal not found.";
  }

  const scoreMap = new Map(scores.map((s: any) => [s.buyer_id, s]));
  
  const buyerSummaries = buyers.map((buyer: any) => {
    const score = scoreMap.get(buyer.id);
    return {
      id: buyer.id,
      name: buyer.company_name || buyer.pe_firm_name,
      type: buyer.buyer_type,
      hq: buyer.hq_city && buyer.hq_state ? `${buyer.hq_city}, ${buyer.hq_state}` : null,
      footprint: buyer.geographic_footprint || [],
      targetGeos: buyer.target_geographies || [],
      thesis: buyer.thesis_summary?.substring(0, 150),
      acquisitions: buyer.total_acquisitions,
      appetite: buyer.acquisition_appetite,
      score: score?.composite_score,
      status: score?.status?.toUpperCase() || 'PENDING',
    };
  });

  return `You are an M&A analyst assistant helping match buyers to deals.

DEAL CONTEXT:
- Company: ${deal.title || deal.internal_company_name || 'Unknown'}
- Location: ${deal.location || 'Unknown'}
- States: ${deal.geographic_states?.join(', ') || 'Not specified'}
- Revenue: ${deal.revenue ? `$${(deal.revenue/1000000).toFixed(1)}M` : 'Unknown'}
- EBITDA: ${deal.ebitda ? `$${(deal.ebitda/1000000).toFixed(1)}M` : 'Unknown'}
- Industry: ${deal.category || 'Unknown'}
- Description: ${deal.description?.substring(0, 300) || 'Not available'}

BUYERS (${buyerSummaries.length} total):
${JSON.stringify(buyerSummaries.slice(0, 80), null, 2)}

When responding:
1. Recommend specific buyers by name in **bold**
2. Explain WHY each buyer matches (location, thesis, size, acquisition history)
3. Mention their status (APPROVED, PASSED, PENDING)
4. Prioritize PENDING buyers unless asked otherwise
5. Keep responses concise with bullet points
6. At the end, include: <!-- HIGHLIGHT: ["buyer-id-1", "buyer-id-2"] -->`;
}

// Build context for all-deals queries
async function buildDealsContext(supabase: any): Promise<string> {
  const [dealsResult, statsResult] = await Promise.all([
    supabase.from('listings').select('id, title, internal_company_name, location, revenue, ebitda, category, enriched_at, deal_total_score, is_priority_target, created_at').eq('is_active', true).order('deal_total_score', { ascending: false, nullsFirst: false }).limit(100),
    supabase.from('listings').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ]);

  const deals = dealsResult.data || [];
  const totalCount = statsResult.count || deals.length;

  const dealSummaries = deals.map((d: any) => ({
    id: d.id,
    name: d.internal_company_name || d.title,
    location: d.location,
    revenue: d.revenue ? `$${(d.revenue/1000000).toFixed(1)}M` : null,
    ebitda: d.ebitda ? `$${(d.ebitda/1000000).toFixed(1)}M` : null,
    industry: d.category,
    score: d.deal_total_score,
    enriched: !!d.enriched_at,
    priority: d.is_priority_target,
    addedAt: d.created_at,
  }));

  const priorityCount = deals.filter((d: any) => d.is_priority_target).length;
  const enrichedCount = deals.filter((d: any) => d.enriched_at).length;
  const avgScore = deals.filter((d: any) => d.deal_total_score).reduce((sum: number, d: any) => sum + (d.deal_total_score || 0), 0) / (deals.filter((d: any) => d.deal_total_score).length || 1);

  return `You are an M&A analyst assistant helping analyze a deal pipeline.

DEALS OVERVIEW:
- Total Deals: ${totalCount}
- Priority Targets: ${priorityCount}
- Enriched: ${enrichedCount}
- Average Quality Score: ${avgScore.toFixed(0)}/100

TOP DEALS (sorted by quality score):
${JSON.stringify(dealSummaries.slice(0, 50), null, 2)}

When responding:
1. Reference specific deals by name in **bold**
2. Provide data-driven insights (scores, revenue, industry trends)
3. Suggest actions (enrich, prioritize, etc.) when relevant
4. Keep responses concise with bullet points
5. At the end for deals mentioned, include: <!-- HIGHLIGHT: ["deal-id-1", "deal-id-2"] -->`;
}

// Build context for all-buyers queries
async function buildBuyersContext(supabase: any): Promise<string> {
  const [buyersResult, statsResult] = await Promise.all([
    supabase.from('remarketing_buyers').select('id, company_name, buyer_type, pe_firm_name, hq_city, hq_state, thesis_summary, geographic_footprint, target_geographies, data_completeness, total_acquisitions, acquisition_appetite, has_fee_agreement, alignment_score').eq('archived', false).order('alignment_score', { ascending: false, nullsFirst: false }).limit(150),
    supabase.from('remarketing_buyers').select('id, buyer_type', { count: 'exact' }).eq('archived', false),
  ]);

  const buyers = buyersResult.data || [];
  const stats = statsResult.data || [];
  
  const typeCounts = stats.reduce((acc: any, b: any) => {
    acc[b.buyer_type || 'other'] = (acc[b.buyer_type || 'other'] || 0) + 1;
    return acc;
  }, {});

  const buyerSummaries = buyers.map((b: any) => ({
    id: b.id,
    name: b.company_name || b.pe_firm_name,
    type: b.buyer_type,
    peFirm: b.pe_firm_name,
    hq: b.hq_city && b.hq_state ? `${b.hq_city}, ${b.hq_state}` : null,
    footprint: b.geographic_footprint || [],
    thesis: b.thesis_summary?.substring(0, 100),
    acquisitions: b.total_acquisitions,
    appetite: b.acquisition_appetite,
    feeAgreement: b.has_fee_agreement,
    dataQuality: b.data_completeness,
    alignmentScore: b.alignment_score,
  }));

  return `You are an M&A analyst assistant helping analyze buyer relationships.

BUYERS OVERVIEW:
- Total Buyers: ${stats.length}
- PE Firms: ${typeCounts['pe_firm'] || 0}
- Platforms: ${typeCounts['platform'] || 0}
- Strategic: ${typeCounts['strategic'] || 0}
- Family Offices: ${typeCounts['family_office'] || 0}

BUYERS (sorted by alignment score):
${JSON.stringify(buyerSummaries.slice(0, 80), null, 2)}

When responding:
1. Reference specific buyers by name in **bold**
2. Highlight key attributes (location, thesis, acquisition history, fee agreements)
3. Group by type when comparing buyers
4. Keep responses concise with bullet points
5. At the end for buyers mentioned, include: <!-- HIGHLIGHT: ["buyer-id-1", "buyer-id-2"] -->`;
}

// Build context for universe-level queries  
async function buildUniverseContext(supabase: any, universeId: string): Promise<string> {
  if (!universeId) {
    return "No universe selected.";
  }

  const [universeResult, buyersResult, dealsResult, scoresResult] = await Promise.all([
    supabase.from('remarketing_buyer_universes').select('*').eq('id', universeId).single(),
    supabase.from('remarketing_buyers').select('id, company_name, buyer_type, pe_firm_name, thesis_summary, alignment_score, data_completeness').eq('universe_id', universeId).eq('archived', false).limit(100),
    supabase.from('remarketing_universe_deals').select('listing:listings(id, title, internal_company_name, revenue, ebitda)').eq('universe_id', universeId).eq('status', 'active'),
    supabase.from('remarketing_scores').select('buyer_id, listing_id, composite_score, status').eq('universe_id', universeId),
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
    thesis: b.thesis_summary?.substring(0, 100),
    alignmentScore: b.alignment_score,
    dataQuality: b.data_completeness,
  }));

  const dealSummaries = deals.map((d: any) => ({
    id: d.listing?.id,
    name: d.listing?.internal_company_name || d.listing?.title,
    revenue: d.listing?.revenue ? `$${(d.listing.revenue/1000000).toFixed(1)}M` : null,
    ebitda: d.listing?.ebitda ? `$${(d.listing.ebitda/1000000).toFixed(1)}M` : null,
  }));

  return `You are an M&A analyst assistant helping manage a buyer universe.

UNIVERSE: ${universe.name}
Description: ${universe.description || 'Not specified'}
Fit Criteria: ${universe.fit_criteria?.substring(0, 300) || 'Not specified'}

BUYERS (${buyers.length} total):
${JSON.stringify(buyerSummaries.slice(0, 50), null, 2)}

DEALS (${deals.length} linked):
${JSON.stringify(dealSummaries.slice(0, 30), null, 2)}

SCORES SUMMARY:
- Total Scores: ${scores.length}
- Approved: ${scores.filter((s: any) => s.status === 'approved').length}
- Passed: ${scores.filter((s: any) => s.status === 'passed').length}
- Pending: ${scores.filter((s: any) => s.status === 'pending' || !s.status).length}

When responding:
1. Reference specific buyers/deals by name in **bold**
2. Compare alignment scores and match quality
3. Suggest improvements to the universe
4. Keep responses concise with bullet points
5. At the end, include: <!-- HIGHLIGHT: ["id-1", "id-2"] -->`;
}
