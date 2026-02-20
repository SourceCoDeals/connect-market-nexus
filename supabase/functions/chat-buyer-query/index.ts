import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

// State adjacency map for geographic proximity
const STATE_ADJACENCY: Record<string, string[]> = {
  AL: ['FL', 'GA', 'MS', 'TN'],
  AK: [],
  AZ: ['CA', 'CO', 'NM', 'NV', 'UT'],
  AR: ['LA', 'MO', 'MS', 'OK', 'TN', 'TX'],
  CA: ['AZ', 'NV', 'OR'],
  CO: ['AZ', 'KS', 'NE', 'NM', 'OK', 'UT', 'WY'],
  CT: ['MA', 'NY', 'RI'],
  DE: ['MD', 'NJ', 'PA'],
  FL: ['AL', 'GA'],
  GA: ['AL', 'FL', 'NC', 'SC', 'TN'],
  HI: [],
  ID: ['MT', 'NV', 'OR', 'UT', 'WA', 'WY'],
  IL: ['IA', 'IN', 'KY', 'MO', 'WI'],
  IN: ['IL', 'KY', 'MI', 'OH'],
  IA: ['IL', 'MN', 'MO', 'NE', 'SD', 'WI'],
  KS: ['CO', 'MO', 'NE', 'OK'],
  KY: ['IL', 'IN', 'MO', 'OH', 'TN', 'VA', 'WV'],
  LA: ['AR', 'MS', 'TX'],
  ME: ['NH'],
  MD: ['DE', 'PA', 'VA', 'WV'],
  MA: ['CT', 'NH', 'NY', 'RI', 'VT'],
  MI: ['IN', 'OH', 'WI'],
  MN: ['IA', 'ND', 'SD', 'WI'],
  MS: ['AL', 'AR', 'LA', 'TN'],
  MO: ['AR', 'IA', 'IL', 'KS', 'KY', 'NE', 'OK', 'TN'],
  MT: ['ID', 'ND', 'SD', 'WY'],
  NE: ['CO', 'IA', 'KS', 'MO', 'SD', 'WY'],
  NV: ['AZ', 'CA', 'ID', 'OR', 'UT'],
  NH: ['MA', 'ME', 'VT'],
  NJ: ['DE', 'NY', 'PA'],
  NM: ['AZ', 'CO', 'OK', 'TX', 'UT'],
  NY: ['CT', 'MA', 'NJ', 'PA', 'VT'],
  NC: ['GA', 'SC', 'TN', 'VA'],
  ND: ['MN', 'MT', 'SD'],
  OH: ['IN', 'KY', 'MI', 'PA', 'WV'],
  OK: ['AR', 'CO', 'KS', 'MO', 'NM', 'TX'],
  OR: ['CA', 'ID', 'NV', 'WA'],
  PA: ['DE', 'MD', 'NJ', 'NY', 'OH', 'WV'],
  RI: ['CT', 'MA'],
  SC: ['GA', 'NC'],
  SD: ['IA', 'MN', 'MT', 'ND', 'NE', 'WY'],
  TN: ['AL', 'AR', 'GA', 'KY', 'MO', 'MS', 'NC', 'VA'],
  TX: ['AR', 'LA', 'NM', 'OK'],
  UT: ['AZ', 'CO', 'ID', 'NM', 'NV', 'WY'],
  VT: ['MA', 'NH', 'NY'],
  VA: ['KY', 'MD', 'NC', 'TN', 'WV'],
  WA: ['ID', 'OR'],
  WV: ['KY', 'MD', 'OH', 'PA', 'VA'],
  WI: ['IA', 'IL', 'MI', 'MN'],
  WY: ['CO', 'ID', 'MT', 'NE', 'SD', 'UT'],
};

const REGIONS: Record<string, string[]> = {
  Northeast: ['CT', 'DE', 'MA', 'MD', 'ME', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'],
  Southeast: ['AL', 'FL', 'GA', 'KY', 'MS', 'NC', 'SC', 'TN', 'VA', 'WV'],
  Midwest: ['IA', 'IL', 'IN', 'KS', 'MI', 'MN', 'MO', 'ND', 'NE', 'OH', 'SD', 'WI'],
  Southwest: ['AZ', 'NM', 'OK', 'TX'],
  West: ['AK', 'CA', 'CO', 'HI', 'ID', 'MT', 'NV', 'OR', 'UT', 'WA', 'WY'],
  'Mid-Atlantic': ['DE', 'MD', 'NJ', 'NY', 'PA'],
  'New England': ['CT', 'MA', 'ME', 'NH', 'RI', 'VT'],
};

// Get 1-hop adjacent states
function getAdjacentStates(states: string[]): string[] {
  const adjacent = new Set<string>();
  for (const state of states) {
    const neighbors = STATE_ADJACENCY[state] || [];
    neighbors.forEach(n => adjacent.add(n));
  }
  return Array.from(adjacent).filter(s => !states.includes(s));
}

// Get 2-hop nearby states
function getNearbyStates(states: string[]): string[] {
  const adjacent = getAdjacentStates(states);
  const nearby = new Set<string>();
  for (const state of adjacent) {
    const neighbors = STATE_ADJACENCY[state] || [];
    neighbors.forEach(n => nearby.add(n));
  }
  return Array.from(nearby).filter(s => !states.includes(s) && !adjacent.includes(s));
}

// Get region for states
function getRegion(states: string[]): string[] {
  const regions = new Set<string>();
  for (const state of states) {
    for (const [region, regionStates] of Object.entries(REGIONS)) {
      if (regionStates.includes(state)) {
        regions.add(region);
      }
    }
  }
  return Array.from(regions);
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
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

    const { listingId, query, messages = [] } = await req.json();

    if (!listingId) {
      return new Response(JSON.stringify({ error: 'Listing ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[chat-buyer-query] Processing query for listing ${listingId}: "${query.substring(0, 100)}..."`);

    // Parallel data fetching
    const [dealResult, buyersResult, scoresResult, contactsResult, callTranscriptsResult, dealTranscriptsResult, buyerTranscriptsResult] = await Promise.all([
      // 1. Fetch deal/listing data
      supabase
        .from('listings')
        .select('*')
        .eq('id', listingId)
        .single(),

      // 2. Fetch buyers scored for this deal (universe-scoped via scores)
      supabase
        .from('remarketing_buyers')
        .select(`
          id, company_name, company_website, buyer_type, thesis_summary,
          target_geographies, target_services, target_revenue_min, target_revenue_max,
          target_ebitda_min, target_ebitda_max, geographic_footprint,
          data_completeness, pe_firm_name, hq_city, hq_state,
          total_acquisitions, last_acquisition_date, acquisition_appetite,
          universe_id, deal_breakers, strategic_priorities, target_industries,
          recent_acquisitions, services_offered, business_summary, operating_locations,
          extraction_sources
        `)
        .eq('archived', false)
        .in('id', (await supabase.from('remarketing_scores').select('buyer_id').eq('listing_id', listingId)).data?.map((s: any) => s.buyer_id) || []),

      // 3. Fetch scores for this deal
      supabase
        .from('remarketing_scores')
        .select('*')
        .eq('listing_id', listingId),

      // 4. Fetch contacts for top buyers
      supabase
        .from('buyer_contacts')
        .select('buyer_id, name, title, email, is_primary_contact')
        .limit(200),

      // 5. Fetch call transcripts for this deal
      supabase
        .from('call_transcripts')
        .select('id, transcript_text, extracted_insights, key_quotes, ceo_detected, created_at, call_type, participant_count')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false })
        .limit(5),

      // 6. Fetch general deal transcripts
      supabase
        .from('deal_transcripts')
        .select('id, transcript_text, extracted_data, created_at, source')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false })
        .limit(3),

      // 7. Fetch buyer transcripts for scored buyers (NEW — enables transcript-based intelligence)
      supabase
        .from('buyer_transcripts')
        .select('id, buyer_id, transcript_text, extracted_insights, extraction_status, file_name, created_at')
        .eq('extraction_status', 'completed')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (dealResult.error || !dealResult.data) {
      console.error('Deal fetch error:', dealResult.error);
      return new Response(JSON.stringify({ error: 'Deal not found or access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const deal = dealResult.data;
    const buyers = buyersResult.data || [];
    const scores = scoresResult.data || [];
    const contacts = contactsResult.data || [];
    const callTranscripts = callTranscriptsResult.data || [];
    const dealTranscripts = dealTranscriptsResult.data || [];
    const buyerTranscripts = buyerTranscriptsResult.data || [];

    // Build buyer transcript lookup (buyer_id → transcripts)
    const buyerTranscriptMap = new Map<string, typeof buyerTranscripts>();
    for (const bt of buyerTranscripts) {
      if (!buyerTranscriptMap.has(bt.buyer_id)) buyerTranscriptMap.set(bt.buyer_id, []);
      buyerTranscriptMap.get(bt.buyer_id)!.push(bt);
    }

    // Debug/Trace: Log data fetch results
    const debugInfo = {
      timestamp: new Date().toISOString(),
      deal_id: listingId,
      deal_name: deal?.company_name || deal?.codename || 'Unknown',
      query_preview: query.substring(0, 100),
      data_loaded: {
        deal: !!deal,
        buyers_total: buyers.length,
        scores_total: scores.length,
        contacts_total: contacts.length,
        call_transcripts: callTranscripts.length,
        deal_transcripts: dealTranscripts.length,
      },
      data_quality: {
        buyers_with_low_completeness: buyers.filter((b: any) => (b.data_completeness || 0) < 50).length,
        buyers_missing_footprint: buyers.filter((b: any) => !b.geographic_footprint || b.geographic_footprint.length === 0).length,
        buyers_with_deal_breakers: buyers.filter((b: any) => b.deal_breakers && b.deal_breakers.length > 0).length,
      },
    };

    console.log(`[chat-buyer-query] Data fetch complete:`, JSON.stringify(debugInfo, null, 2));

    // Build score lookup
    const scoreMap = new Map(scores.map(s => [s.buyer_id, s]));
    const contactMap = new Map<string, typeof contacts>();
    contacts.forEach(c => {
      if (!contactMap.has(c.buyer_id)) contactMap.set(c.buyer_id, []);
      contactMap.get(c.buyer_id)!.push(c);
    });

    // Parse deal geography
    const dealStates = Array.isArray(deal.geography) 
      ? deal.geography 
      : typeof deal.geography === 'string' 
        ? deal.geography.split(',').map((s: string) => s.trim().toUpperCase())
        : [];

    const adjacentStates = getAdjacentStates(dealStates);
    const nearbyStates = getNearbyStates(dealStates);
    const dealRegions = getRegion(dealStates);

    // Build buyer summaries with scores and proximity
    const buyerSummaries = buyers.map(buyer => {
      const score = scoreMap.get(buyer.id);
      const buyerContacts = contactMap.get(buyer.id) || [];
      const buyerFootprint = buyer.geographic_footprint || [];
      
      // Calculate proximity flags
      const inDealState = dealStates.some((s: string) => buyerFootprint.includes(s));
      const hasAdjacentPresence = adjacentStates.some(s => buyerFootprint.includes(s));
      const hasNearbyPresence = nearbyStates.some(s => buyerFootprint.includes(s));

      // Get buyer transcripts
      const bTranscripts = buyerTranscriptMap.get(buyer.id) || [];
      
      // Determine data provenance
      const sources = buyer.extraction_sources || [];
      const hasTranscriptData = sources.some((s: any) => s.type === 'transcript' || s.source === 'transcript');
      const hasWebsiteData = sources.some((s: any) => s.type === 'website' || s.source_type?.includes('website'));

      return {
        id: buyer.id,
        name: buyer.company_name || buyer.pe_firm_name || 'Unknown',
        peFirm: buyer.pe_firm_name,
        type: buyer.buyer_type,
        hq: buyer.hq_city && buyer.hq_state ? `${buyer.hq_city}, ${buyer.hq_state}` : null,
        geographicFootprint: buyerFootprint,
        targetServices: buyer.target_services || [],
        targetGeographies: buyer.target_geographies || [],
        revenueRange: buyer.target_revenue_min || buyer.target_revenue_max
          ? `$${buyer.target_revenue_min ? (buyer.target_revenue_min/1000000).toFixed(1) : '?'}M - $${buyer.target_revenue_max ? (buyer.target_revenue_max/1000000).toFixed(1) : '?'}M`
          : null,
        ebitdaRange: buyer.target_ebitda_min || buyer.target_ebitda_max
          ? `$${buyer.target_ebitda_min ? (buyer.target_ebitda_min/1000000).toFixed(1) : '?'}M - $${buyer.target_ebitda_max ? (buyer.target_ebitda_max/1000000).toFixed(1) : '?'}M`
          : null,
        acquisitionAppetite: buyer.acquisition_appetite,
        totalAcquisitions: buyer.total_acquisitions,
        lastAcquisitionDate: buyer.last_acquisition_date,
        thesisSummary: buyer.thesis_summary?.substring(0, 200),
        recentAcquisitions: buyer.recent_acquisitions,
        servicesOffered: buyer.services_offered,
        businessSummary: buyer.business_summary?.substring(0, 200),
        operatingLocations: buyer.operating_locations,

        // Data provenance flags
        dataSource: hasTranscriptData ? 'transcript' : hasWebsiteData ? 'website' : 'unknown',
        hasTranscriptData,
        transcriptCount: bTranscripts.length,

        // Strategic context
        dealBreakers: buyer.deal_breakers,
        strategicPriorities: buyer.strategic_priorities,
        targetIndustries: buyer.target_industries,

        // Proximity flags
        inDealState,
        hasAdjacentPresence,
        hasNearbyPresence,
        
        // Scores
        scores: score ? {
          composite: score.composite_score,
          geography: score.geography_score,
          service: score.service_score,
          size: score.size_score,
          ownerGoals: score.owner_goals_score,
        } : null,
        
        // Status
        actionStatus: score?.status?.toUpperCase() || 'PENDING',
        passReason: score?.pass_reason,
        passCategory: score?.pass_category,
        
        // Contacts (top 2)
        contacts: buyerContacts.slice(0, 2).map(c => ({
          name: c.name,
          title: c.title,
          email: c.email,
        })),
      };
    });

    // Count statuses
    const statusCounts = {
      approved: buyerSummaries.filter(b => b.actionStatus === 'APPROVED').length,
      passed: buyerSummaries.filter(b => b.actionStatus === 'PASSED').length,
      pending: buyerSummaries.filter(b => b.actionStatus === 'PENDING').length,
      removed: buyerSummaries.filter(b => b.actionStatus === 'REMOVED').length,
    };

    // Build system prompt
    const systemPrompt = `You are an expert M&A analyst helping evaluate potential buyers for an acquisition target. 
You have access to detailed data about the deal, all buyers, their scores, contacts, and action history. 
Your job is to help identify the best-fit buyers and explain WHY each buyer is a good match.

DEAL CONTEXT:
- Company: ${deal.company_name || deal.codename || 'Unknown'}
- Location: ${deal.headquarters || 'Unknown'}
- Geography/States: ${dealStates.join(', ') || 'Not specified'}
- Region: ${dealRegions.join(', ') || 'Unknown'}
- Revenue: ${deal.revenue ? `$${(deal.revenue/1000000).toFixed(1)}M` : 'Unknown'}
- EBITDA: ${deal.ebitda ? `$${(deal.ebitda/1000000).toFixed(1)}M` : 'Unknown'}
- Industry: ${deal.industry || 'Unknown'}
- Services: ${deal.services || deal.service_offerings || 'Unknown'}
- Business Model: ${deal.business_model || 'Unknown'}

GEOGRAPHIC CONTEXT:
- Deal is in: ${dealStates.join(', ') || 'Unknown'}
- Region: ${dealRegions.join(', ') || 'Unknown'}
- Adjacent states (~100 miles): ${adjacentStates.join(', ') || 'None'}
- Nearby states (~250 miles): ${nearbyStates.join(', ') || 'None'}

## Buyer Action Status Summary
- APPROVED: ${statusCounts.approved} buyers (already selected for outreach)
- PASSED: ${statusCounts.passed} buyers (rejected with reasons)
- REMOVED: ${statusCounts.removed} buyers (hidden from deal)
- PENDING: ${statusCounts.pending} buyers (no action yet - prioritize these)

## Score Interpretation
Each buyer has been scored 0-100 on:
- **Composite Score**: Overall fit
- **Geography Score**: Location proximity and market overlap
- **Size Score**: Revenue/EBITDA alignment
- **Service Score**: Service offering overlap
- **Owner Goals Score**: Owner goals alignment

## BUYER UNIVERSE (${buyerSummaries.length} buyers):
${JSON.stringify(buyerSummaries.slice(0, 100), null, 2)}

${buyerSummaries.length > 100 ? `\n(Showing top 100 of ${buyerSummaries.length} buyers. More available if needed.)` : ''}

## TRANSCRIPT DATA

${callTranscripts && callTranscripts.length > 0 ? `
### Call Transcripts (${callTranscripts.length} recent calls):
${callTranscripts.map((t, idx) => `
**Call ${idx + 1}** (${new Date(t.created_at).toLocaleDateString()}):
- Type: ${t.call_type || 'Unknown'}
- CEO Detected: ${t.ceo_detected ? 'Yes' : 'No'}
- Participants: ${t.participant_count || 'Unknown'}
${t.key_quotes && t.key_quotes.length > 0 ? `- Key Quotes: ${JSON.stringify(t.key_quotes, null, 2)}` : '- Key Quotes: None'}
${t.extracted_insights ? `- Extracted Insights: ${JSON.stringify(t.extracted_insights, null, 2)}` : ''}
${t.transcript_text ? `- Transcript Preview: ${t.transcript_text.substring(0, 500)}...` : ''}
`).join('\n')}
` : 'No call transcripts available for this deal.'}

${dealTranscripts && dealTranscripts.length > 0 ? `
### Deal Transcripts (${dealTranscripts.length} transcripts):
${dealTranscripts.map((t, idx) => `
**Transcript ${idx + 1}** (${new Date(t.created_at).toLocaleDateString()}):
- Source: ${t.source || 'Unknown'}
${t.extracted_data ? `- Extracted Data: ${JSON.stringify(t.extracted_data, null, 2)}` : ''}
${t.transcript_text ? `- Transcript Preview: ${t.transcript_text.substring(0, 500)}...` : ''}
`).join('\n')}
` : ''}

When answering questions:
1. Be specific - name actual buyers that match the criteria
2. Explain WHY each buyer matches (cite their scores, location, acquisition history)
3. For score-based questions, reference the actual composite and category scores
4. Prioritize PENDING buyers unless specifically asked about approved/passed
5. Always mention if a buyer has been APPROVED, PASSED, or REMOVED
6. For passed buyers, mention why they were passed (passReason/passCategory)
7. For geographic questions, use pre-computed proximity flags (inDealState, hasAdjacentPresence, hasNearbyPresence)
8. Interpret "within X miles" as adjacent states (~100mi) or nearby states (~250mi)
9. When discussing contacts, list available contacts with titles and emails
10. If no buyers match criteria, say so clearly
11. Keep responses concise but informative
12. Format lists clearly with bullet points
13. Use buyer names in bold (e.g., **Acme Corp**)
14. When referencing transcript content, cite the call date and type
15. If asked about transcripts but none available, explicitly state "I don't have transcript data for this question"
16. Never hallucinate or invent transcript quotes - only use actual key_quotes data from above
17. When transcript data is available, reference specific quotes and insights to support recommendations
18. At the END of your response, include a hidden marker with buyer IDs you mentioned:
    <!-- BUYER_HIGHLIGHT: ["buyer-uuid-1", "buyer-uuid-2"] -->
19. For CITY-SPECIFIC queries, search hq field for that city name

## CRITICAL: PE FIRM vs PLATFORM COMPANY DATA PROVENANCE

**You MUST distinguish between PE firm data and platform company data. They are DIFFERENT ENTITIES.**

- **Platform company** = the operating business (e.g., "Rewind Restoration Partners") — has crews, offices, customers, services
- **PE firm** = the investor/sponsor (e.g., "LP First Capital") — manages funds, invests in companies

**RULES:**
1. When describing a buyer's operations, services, geography, or business model, ONLY reference the **platform company** data (businessSummary, servicesOffered, operatingLocations)
2. NEVER attribute PE firm characteristics (fund size, investment criteria, PE firm HQ) to the platform company
3. If a buyer's dataSource is "website" and NOT "transcript", note: "Based on website data (no call transcripts available for this buyer)"
4. If a buyer has hasTranscriptData=true, their thesis and criteria are derived from direct call conversations
5. If asked about a buyer's specific acquisition preferences and they have no transcripts, say: "This buyer's acquisition criteria are based on website analysis. Call transcripts would provide more reliable criteria."
6. NEVER say "PE firm X is looking for Y services" — instead say "Platform company X (backed by PE firm Y) is looking for..."

## DATA AVAILABILITY & QUALITY GUARDRAILS (CRITICAL):

**You MUST follow these rules to maintain response accuracy:**

1. **Transcript Availability:**
   - ${callTranscripts.length === 0 ? '⚠️ NO TRANSCRIPTS available for this deal' : `✅ ${callTranscripts.length} transcript(s) available`}
   - If asked about call content, owner statements, or CEO engagement:
     ${callTranscripts.length === 0 ? '→ Say: "I don\'t have transcript data for this deal yet. Transcript information will be available once calls are uploaded or processed."' : '→ Reference specific quotes and insights from the transcript data above'}
   - NEVER guess or hallucinate what was said in calls

2. **Data Completeness Warnings:**
   - If discussing a buyer with data_completeness < 50%, mention: "Note: This buyer's profile is partially complete (XX% complete)"
   - If a buyer's geographic_footprint is empty, say: "This buyer's geographic footprint has not been fully mapped yet"
   - If target criteria fields are null/empty, acknowledge the limitation

3. **Buyer Count Limitation:**
   - ${buyerSummaries.length > 100 ? `⚠️ Only showing top 100 of ${buyerSummaries.length} buyers in context` : `✅ All ${buyerSummaries.length} buyers included`}
   - If asked to compare or analyze more than 100 buyers, note: "I'm currently analyzing the top 100 scored buyers. Additional buyers may exist but are not in my current context."

4. **Missing Data Handling:**
   - If asked about information NOT in the context (e.g., portfolio companies, full acquisition history), say:
     "That specific information is not available in my current context. I can see [list what you DO have]."
   - NEVER make up or infer data that isn't explicitly provided

5. **Confidence Language:**
   - Use "Based on available data..." when data quality is uncertain
   - Use "According to the scoring..." when referencing scores
   - Use "The transcript shows..." when citing transcript data
   - Avoid absolute statements when data is incomplete

6. **Deal Breaker Context:**
   ${buyerSummaries.some(b => b.dealBreakers && b.dealBreakers.length > 0) ? '✅ Some buyers have deal_breakers defined - reference these when explaining poor fits' : '⚠️ Most buyers do not have deal_breakers defined - rely on scores and pass_reason fields'}

7. **Strategic Context:**
   ${buyerSummaries.some(b => b.strategicPriorities) ? '✅ Some buyers have strategic_priorities - use these to explain current focus' : '⚠️ Strategic priorities not available for most buyers'}

**FAIL-SAFE RULE:** When in doubt about data availability, explicitly state what you DO and DON'T have access to rather than making assumptions.`;

    // Build conversation messages
    const conversationMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: query },
    ];

    // Debug/Trace: Log context assembly
    const contextStats = {
      system_prompt_chars: systemPrompt.length,
      system_prompt_tokens_estimate: Math.ceil(systemPrompt.length / 4),
      message_history_count: messages.slice(-10).length,
      total_messages: conversationMessages.length,
      buyers_in_context: Math.min(100, buyerSummaries.length),
      buyers_excluded: Math.max(0, buyerSummaries.length - 100),
      context_size_estimate_kb: Math.ceil(JSON.stringify(conversationMessages).length / 1024),
    };

    console.log(`[chat-buyer-query] Context assembled:`, JSON.stringify(contextStats, null, 2));

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
      signal: AbortSignal.timeout(30000),
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
    console.error('[chat-buyer-query] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process query';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
