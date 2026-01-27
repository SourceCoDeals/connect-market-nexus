import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeStates, extractStatesFromText, mergeStates } from "../_shared/geography.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 8-Prompt Extraction Architecture per CTO Spec (4_INTELLIGENCE_EXTRACTION.md)
 * 
 * BUYER PROMPTS (4):
 *   1. Buyer Thesis - Investment criteria and strategy
 *   2. Buyer Target Criteria - Size, geography, services
 *   3. Buyer Acquisition History - Past deals
 *   4. Buyer Geographic Preferences - Target regions
 * 
 * DEAL PROMPTS (4):
 *   5. Deal Financials - Revenue, EBITDA, growth
 *   6. Deal Services - Service offerings
 *   7. Deal Geography - Locations, footprint
 *   8. Deal Owner Goals - Transition preferences
 */

// ============= Tool Definitions =============

// Prompt 1: Buyer Thesis
const extractBuyerThesisTool = {
  type: 'function',
  function: {
    name: 'extract_buyer_thesis',
    description: 'Extract investment thesis and strategy from buyer transcript',
    parameters: {
      type: 'object',
      properties: {
        thesis_summary: { type: 'string', description: 'Summary of investment thesis and focus' },
        strategic_priorities: { type: 'array', items: { type: 'string' }, description: 'Key strategic priorities' },
        thesis_confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Confidence based on specificity' },
        acquisition_appetite: { type: 'string', description: 'Current appetite for acquisitions (aggressive, moderate, selective)' },
        acquisition_timeline: { type: 'string', description: 'Timeline for acquisitions (e.g., "next 12 months")' },
        deal_preferences: { type: 'string', description: 'Preferred deal structures or terms' },
        key_quotes: { type: 'array', items: { type: 'string' }, description: 'Direct quotes revealing buyer preferences - 3-5 most insightful' }
      }
    }
  }
};

// Prompt 2: Buyer Target Criteria
const extractBuyerCriteriaTool = {
  type: 'function',
  function: {
    name: 'extract_buyer_criteria',
    description: 'Extract target acquisition criteria from buyer transcript',
    parameters: {
      type: 'object',
      properties: {
        target_revenue_min: { type: 'number', description: 'Minimum revenue in dollars (e.g., 5000000 for $5M)' },
        target_revenue_max: { type: 'number', description: 'Maximum revenue in dollars' },
        revenue_sweet_spot: { type: 'number', description: 'Ideal target revenue in dollars' },
        target_ebitda_min: { type: 'number', description: 'Minimum EBITDA in dollars' },
        target_ebitda_max: { type: 'number', description: 'Maximum EBITDA in dollars' },
        ebitda_sweet_spot: { type: 'number', description: 'Ideal target EBITDA in dollars' },
        target_services: { type: 'array', items: { type: 'string' }, description: 'Services/industries they seek' },
        target_industries: { type: 'array', items: { type: 'string' }, description: 'Industries they invest in' },
        deal_breakers: { type: 'array', items: { type: 'string' }, description: 'Things they explicitly avoid' },
        primary_customer_size: { type: 'string', description: 'Customer segment (SMB, Mid-market, Enterprise)' },
        customer_industries: { type: 'array', items: { type: 'string' }, description: 'Industries of their target customers' },
        target_customer_profile: { type: 'string', description: 'Description of ideal end customer' }
      }
    }
  }
};

// Prompt 3: Buyer Acquisition History
const extractBuyerAcquisitionsTool = {
  type: 'function',
  function: {
    name: 'extract_buyer_acquisitions',
    description: 'Extract acquisition history from buyer transcript',
    parameters: {
      type: 'object',
      properties: {
        recent_acquisitions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              date: { type: 'string' },
              location: { type: 'string' }
            }
          },
          description: 'Recent acquisitions mentioned'
        },
        total_acquisitions: { type: 'number', description: 'Total acquisition count mentioned' },
        acquisition_frequency: { type: 'string', description: 'How often they acquire' }
      }
    }
  }
};

// Prompt 4: Buyer Geographic Preferences
const extractBuyerGeographyTool = {
  type: 'function',
  function: {
    name: 'extract_buyer_geography',
    description: 'Extract geographic preferences from buyer transcript',
    parameters: {
      type: 'object',
      properties: {
        target_geographies: { 
          type: 'array', 
          items: { type: 'string' }, 
          description: 'States/regions they want to acquire in. Use full state names or regions.'
        },
        geographic_exclusions: {
          type: 'array',
          items: { type: 'string' },
          description: 'States/regions they explicitly avoid'
        },
        geographic_footprint: {
          type: 'array',
          items: { type: 'string' },
          description: 'States where they currently operate'
        },
        expansion_strategy: { type: 'string', description: 'How they plan to expand geographically' }
      }
    }
  }
};

// Prompt 5: Deal Financials
const extractDealFinancialsTool = {
  type: 'function',
  function: {
    name: 'extract_deal_financials',
    description: 'Extract financial metrics from deal transcript',
    parameters: {
      type: 'object',
      properties: {
        revenue: { type: 'number', description: 'Annual revenue in dollars (e.g., 5200000 for $5.2M)' },
        ebitda_amount: { type: 'number', description: 'EBITDA in dollars' },
        ebitda_percentage: { type: 'number', description: 'EBITDA margin as percentage (e.g., 15.5)' },
        growth_rate: { type: 'number', description: 'YoY growth rate as percentage' },
        employee_count: { type: 'number', description: 'Number of employees' },
        revenue_quote: { type: 'string', description: 'Verbatim quote about revenue' },
        ebitda_quote: { type: 'string', description: 'Verbatim quote about EBITDA' }
      }
    }
  }
};

// Prompt 6: Deal Services
const extractDealServicesTool = {
  type: 'function',
  function: {
    name: 'extract_deal_services',
    description: 'Extract service offerings from deal transcript',
    parameters: {
      type: 'object',
      properties: {
        service_mix: { type: 'string', description: 'Description of services offered' },
        primary_services: { type: 'array', items: { type: 'string' }, description: 'Main service lines' },
        service_percentages: {
          type: 'object',
          description: 'Revenue breakdown by service (e.g., {"residential": 60, "commercial": 40})'
        },
        specializations: { type: 'array', items: { type: 'string' }, description: 'Specialized capabilities' }
      }
    }
  }
};

// Prompt 7: Deal Geography
const extractDealGeographyTool = {
  type: 'function',
  function: {
    name: 'extract_deal_geography',
    description: 'Extract geographic footprint from deal transcript',
    parameters: {
      type: 'object',
      properties: {
        geographic_states: { 
          type: 'array', 
          items: { type: 'string' }, 
          description: 'States where the deal operates. Use full state names.'
        },
        hq_city: { type: 'string', description: 'Headquarters city' },
        hq_state: { type: 'string', description: 'Headquarters state (full name)' },
        service_radius: { type: 'string', description: 'Service area description' },
        locations_count: { type: 'number', description: 'Number of locations' }
      }
    }
  }
};

// Prompt 8: Deal Owner Goals
const extractDealOwnerGoalsTool = {
  type: 'function',
  function: {
    name: 'extract_deal_owner_goals',
    description: 'Extract owner goals and transition preferences from deal transcript',
    parameters: {
      type: 'object',
      properties: {
        owner_goals: { type: 'string', description: 'What the owner wants from the transition' },
        transition_period: { type: 'string', description: 'Desired transition period (e.g., "6-12 months")' },
        post_close_involvement: { type: 'string', description: 'Desired involvement after close' },
        motivation: { type: 'string', description: 'Primary motivation for selling' },
        timeline: { type: 'string', description: 'Desired timeline for deal completion' },
        key_concerns: { type: 'array', items: { type: 'string' }, description: 'Owner concerns about the process' }
      }
    }
  }
};

// ============= AI Call Helper =============

async function callAI(
  systemPrompt: string,
  userPrompt: string,
  tool: any,
  apiKey: string
): Promise<{ data: any | null; error?: { code: string; message: string } }> {
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [tool],
        tool_choice: { type: 'function', function: { name: tool.function.name } }
      }),
    });

    // Handle billing/rate limit errors
    if (response.status === 402) {
      console.error('AI credits depleted (402)');
      return { data: null, error: { code: 'payment_required', message: 'AI credits depleted' } };
    }
    
    if (response.status === 429) {
      console.error('Rate limited (429)');
      return { data: null, error: { code: 'rate_limited', message: 'Rate limit exceeded' } };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI call failed: ${response.status}`, errorText);
      return { data: null };
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      console.error('No tool call in AI response');
      return { data: null };
    }

    return { data: JSON.parse(toolCall.function.arguments) };
  } catch (error) {
    console.error('AI extraction error:', error);
    return { data: null };
  }
}

// ============= Extraction Functions =============

async function extractBuyerData(transcriptText: string, buyer: any, apiKey: string) {
  const baseSystemPrompt = `You are an expert M&A analyst extracting structured buyer intelligence from call transcripts.
Extract ONLY information explicitly stated or strongly implied in the transcript.
If information is not present, omit that field.

CURRENT BUYER CONTEXT:
- Company: ${buyer.company_name}
- Type: ${buyer.buyer_type || 'Unknown'}`;

  const results: Record<string, any> = {};
  let billingError: { code: string; message: string } | null = null;

  // Prompt 1: Buyer Thesis
  console.log('Running Prompt 1: Buyer Thesis');
  const thesisResult = await callAI(
    baseSystemPrompt + '\n\nFocus on: investment thesis, strategic priorities, acquisition appetite, and key quotes that reveal preferences.',
    `TRANSCRIPT:\n${transcriptText.substring(0, 15000)}\n\nExtract buyer investment thesis and strategy.`,
    extractBuyerThesisTool,
    apiKey
  );
  if (thesisResult.error) { billingError = thesisResult.error; }
  else if (thesisResult.data) { Object.assign(results, thesisResult.data); }

  // Prompt 2: Buyer Target Criteria
  if (!billingError) {
    console.log('Running Prompt 2: Buyer Target Criteria');
    const criteriaResult = await callAI(
      baseSystemPrompt + '\n\nFocus on: revenue/EBITDA ranges, target services, deal breakers, customer profiles.',
      `TRANSCRIPT:\n${transcriptText.substring(0, 15000)}\n\nExtract target acquisition criteria.`,
      extractBuyerCriteriaTool,
      apiKey
    );
    if (criteriaResult.error) { billingError = criteriaResult.error; }
    else if (criteriaResult.data) { Object.assign(results, criteriaResult.data); }
  }

  // Prompt 3: Buyer Acquisition History
  if (!billingError) {
    console.log('Running Prompt 3: Buyer Acquisition History');
    const acquisitionsResult = await callAI(
      baseSystemPrompt + '\n\nFocus on: past acquisitions mentioned, deal frequency, acquisition patterns.',
      `TRANSCRIPT:\n${transcriptText.substring(0, 15000)}\n\nExtract acquisition history.`,
      extractBuyerAcquisitionsTool,
      apiKey
    );
    if (acquisitionsResult.error) { billingError = acquisitionsResult.error; }
    else if (acquisitionsResult.data) { Object.assign(results, acquisitionsResult.data); }
  }

  // Prompt 4: Buyer Geographic Preferences
  if (!billingError) {
    console.log('Running Prompt 4: Buyer Geographic Preferences');
    const geographyResult = await callAI(
      baseSystemPrompt + '\n\nFocus on: target regions/states, geographic exclusions, current footprint, expansion plans.',
      `TRANSCRIPT:\n${transcriptText.substring(0, 15000)}\n\nExtract geographic preferences.`,
      extractBuyerGeographyTool,
      apiKey
    );
    if (geographyResult.error) { billingError = geographyResult.error; }
    else if (geographyResult.data) { Object.assign(results, geographyResult.data); }
  }

  return { data: results, billingError };
}

async function extractDealData(transcriptText: string, deal: any, apiKey: string) {
  const baseSystemPrompt = `You are an expert M&A analyst extracting deal intelligence from call transcripts.
Extract ONLY information explicitly stated or strongly implied in the transcript.
If information is not present, omit that field.

CURRENT DEAL CONTEXT:
- Company: ${deal.company_name || deal.title || 'Unknown'}`;

  const results: Record<string, any> = {};
  let billingError: { code: string; message: string } | null = null;

  // Prompt 5: Deal Financials
  console.log('Running Prompt 5: Deal Financials');
  const financialsResult = await callAI(
    baseSystemPrompt + '\n\nFocus on: revenue, EBITDA (amount and margin), growth rate, employee count. Extract verbatim quotes as evidence.',
    `TRANSCRIPT:\n${transcriptText.substring(0, 15000)}\n\nExtract financial metrics.`,
    extractDealFinancialsTool,
    apiKey
  );
  if (financialsResult.error) { billingError = financialsResult.error; }
  else if (financialsResult.data) { Object.assign(results, financialsResult.data); }

  // Prompt 6: Deal Services
  if (!billingError) {
    console.log('Running Prompt 6: Deal Services');
    const servicesResult = await callAI(
      baseSystemPrompt + '\n\nFocus on: services offered, service mix percentages, specializations.',
      `TRANSCRIPT:\n${transcriptText.substring(0, 15000)}\n\nExtract service offerings.`,
      extractDealServicesTool,
      apiKey
    );
    if (servicesResult.error) { billingError = servicesResult.error; }
    else if (servicesResult.data) { Object.assign(results, servicesResult.data); }
  }

  // Prompt 7: Deal Geography
  if (!billingError) {
    console.log('Running Prompt 7: Deal Geography');
    const geographyResult = await callAI(
      baseSystemPrompt + '\n\nFocus on: states served, headquarters location, service area, number of locations.',
      `TRANSCRIPT:\n${transcriptText.substring(0, 15000)}\n\nExtract geographic footprint.`,
      extractDealGeographyTool,
      apiKey
    );
    if (geographyResult.error) { billingError = geographyResult.error; }
    else if (geographyResult.data) { Object.assign(results, geographyResult.data); }
  }

  // Prompt 8: Deal Owner Goals
  if (!billingError) {
    console.log('Running Prompt 8: Deal Owner Goals');
    const ownerGoalsResult = await callAI(
      baseSystemPrompt + '\n\nFocus on: owner goals, transition preferences, motivation for selling, timeline, concerns.',
      `TRANSCRIPT:\n${transcriptText.substring(0, 15000)}\n\nExtract owner goals and transition preferences.`,
      extractDealOwnerGoalsTool,
      apiKey
    );
    if (ownerGoalsResult.error) { billingError = ownerGoalsResult.error; }
    else if (ownerGoalsResult.data) { Object.assign(results, ownerGoalsResult.data); }
  }

  return { data: results, billingError };
}

// ============= Update Helpers =============

function buildBuyerUpdate(buyer: any, extractedData: Record<string, any>): Record<string, any> {
  const update: Record<string, any> = {
    data_last_updated: new Date().toISOString(),
  };

  // Thesis and strategy
  if (extractedData.thesis_summary) {
    const existing = buyer.thesis_summary || '';
    update.thesis_summary = existing 
      ? `${existing}\n\n[Updated ${new Date().toLocaleDateString()}]: ${extractedData.thesis_summary}`
      : extractedData.thesis_summary;
  }

  // Arrays - merge with existing
  const arrayFields = [
    'strategic_priorities', 'target_services', 'target_industries', 
    'deal_breakers', 'customer_industries', 'key_quotes'
  ];
  for (const field of arrayFields) {
    if (extractedData[field]?.length > 0) {
      const existing = buyer[field] || [];
      update[field] = [...new Set([...existing, ...extractedData[field]])];
    }
  }

  // Geographic fields - normalize and merge
  if (extractedData.target_geographies?.length > 0) {
    const normalized = normalizeStates(extractedData.target_geographies);
    const textExtracted = extractStatesFromText(extractedData.target_geographies.join(' '));
    const combined = [...new Set([...normalized, ...textExtracted])];
    update.target_geographies = mergeStates(buyer.target_geographies, combined);
  }

  if (extractedData.geographic_exclusions?.length > 0) {
    const normalized = normalizeStates(extractedData.geographic_exclusions);
    const textExtracted = extractStatesFromText(extractedData.geographic_exclusions.join(' '));
    const combined = [...new Set([...normalized, ...textExtracted])];
    update.geographic_exclusions = mergeStates(buyer.geographic_exclusions, combined);
  }

  if (extractedData.geographic_footprint?.length > 0) {
    const normalized = normalizeStates(extractedData.geographic_footprint);
    const textExtracted = extractStatesFromText(extractedData.geographic_footprint.join(' '));
    const combined = [...new Set([...normalized, ...textExtracted])];
    update.geographic_footprint = mergeStates(buyer.geographic_footprint, combined);
  }

  // Numeric fields - only update if provided
  const numericFields = [
    'target_revenue_min', 'target_revenue_max', 'revenue_sweet_spot',
    'target_ebitda_min', 'target_ebitda_max', 'ebitda_sweet_spot',
    'total_acquisitions'
  ];
  for (const field of numericFields) {
    if (extractedData[field] !== undefined && extractedData[field] !== null) {
      update[field] = extractedData[field];
    }
  }

  // String fields
  const stringFields = [
    'thesis_confidence', 'acquisition_appetite', 'acquisition_timeline',
    'deal_preferences', 'primary_customer_size', 'target_customer_profile',
    'acquisition_frequency', 'expansion_strategy'
  ];
  for (const field of stringFields) {
    if (extractedData[field]) {
      update[field] = extractedData[field];
    }
  }

  // Recent acquisitions (object array)
  if (extractedData.recent_acquisitions?.length > 0) {
    const existing = buyer.recent_acquisitions || [];
    update.recent_acquisitions = [...existing, ...extractedData.recent_acquisitions];
  }

  // Track extraction source
  const existingSources = Array.isArray(buyer.extraction_sources) ? buyer.extraction_sources : [];
  update.extraction_sources = [
    ...existingSources,
    {
      type: 'buyer_transcript',
      extracted_at: new Date().toISOString(),
      fields_extracted: Object.keys(update).filter(k => k !== 'data_last_updated' && k !== 'extraction_sources')
    }
  ];

  return update;
}

function buildDealUpdate(deal: any, extractedData: Record<string, any>): Record<string, any> {
  const update: Record<string, any> = {
    data_last_updated: new Date().toISOString(),
  };

  // Financial fields
  if (extractedData.revenue) update.revenue = extractedData.revenue;
  if (extractedData.ebitda_amount) update.ebitda = extractedData.ebitda_amount;
  if (extractedData.ebitda_percentage) update.ebitda_margin = extractedData.ebitda_percentage;
  if (extractedData.growth_rate) update.growth_rate = extractedData.growth_rate;
  if (extractedData.employee_count) update.employee_count = extractedData.employee_count;
  
  // Store source quotes
  if (extractedData.revenue_quote) update.revenue_source_quote = extractedData.revenue_quote;
  if (extractedData.ebitda_quote) update.ebitda_source_quote = extractedData.ebitda_quote;

  // Services
  if (extractedData.service_mix) update.service_mix = extractedData.service_mix;
  if (extractedData.primary_services?.length > 0) {
    const existing = deal.services || [];
    update.services = [...new Set([...existing, ...extractedData.primary_services])];
  }
  if (extractedData.specializations?.length > 0) {
    const existing = deal.specializations || [];
    update.specializations = [...new Set([...existing, ...extractedData.specializations])];
  }

  // Geography - normalize
  if (extractedData.geographic_states?.length > 0) {
    const normalized = normalizeStates(extractedData.geographic_states);
    const textExtracted = extractStatesFromText(extractedData.geographic_states.join(' '));
    const combined = [...new Set([...normalized, ...textExtracted])];
    update.geographic_states = mergeStates(deal.geographic_states, combined);
  }
  if (extractedData.hq_city) update.hq_city = extractedData.hq_city;
  if (extractedData.hq_state) {
    const normalized = normalizeStates([extractedData.hq_state]);
    if (normalized.length > 0) update.hq_state = normalized[0];
  }
  if (extractedData.service_radius) update.service_radius = extractedData.service_radius;
  if (extractedData.locations_count) update.locations_count = extractedData.locations_count;

  // Owner goals
  if (extractedData.owner_goals) update.owner_goals = extractedData.owner_goals;
  if (extractedData.transition_period) update.transition_period = extractedData.transition_period;
  if (extractedData.post_close_involvement) update.post_close_involvement = extractedData.post_close_involvement;
  if (extractedData.motivation) update.sale_motivation = extractedData.motivation;
  if (extractedData.timeline) update.desired_timeline = extractedData.timeline;
  if (extractedData.key_concerns?.length > 0) {
    const existing = deal.owner_concerns || [];
    update.owner_concerns = [...new Set([...existing, ...extractedData.key_concerns])];
  }

  return update;
}

// ============= Main Handler =============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'AI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the user is an admin
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

    const { buyerId, listingId, transcriptText, source = 'call' } = await req.json();

    // Validate: must have exactly one of buyerId or listingId
    if ((!buyerId && !listingId) || (buyerId && listingId)) {
      return new Response(JSON.stringify({ 
        error: 'Exactly one of buyerId or listingId is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!transcriptText) {
      return new Response(JSON.stringify({ error: 'transcriptText is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== BUYER TRANSCRIPT EXTRACTION ==========
    if (buyerId) {
      console.log(`Extracting intelligence from transcript for buyer ${buyerId}`);
      console.log(`Transcript length: ${transcriptText.length} chars`);

      // Fetch current buyer data
      const { data: buyer, error: buyerError } = await supabase
        .from('remarketing_buyers')
        .select('*')
        .eq('id', buyerId)
        .single();

      if (buyerError || !buyer) {
        return new Response(JSON.stringify({ error: 'Buyer not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Run 4-prompt buyer extraction
      const { data: extractedData, billingError } = await extractBuyerData(
        transcriptText, 
        buyer, 
        lovableApiKey
      );

      console.log('Extracted buyer data:', JSON.stringify(extractedData, null, 2));

      // Handle billing errors
      if (billingError) {
        const statusCode = billingError.code === 'payment_required' ? 402 : 429;
        return new Response(JSON.stringify({
          success: false,
          error: billingError.message,
          error_code: billingError.code,
          partial_data: extractedData,
          recoverable: billingError.code === 'rate_limited'
        }), {
          status: statusCode,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Store the transcript with extracted data
      const { data: transcript, error: insertError } = await supabase
        .from('buyer_transcripts')
        .insert({
          buyer_id: buyerId,
          transcript_text: transcriptText,
          source,
          extracted_data: extractedData,
          processed_at: new Date().toISOString(),
          created_by: user.id,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error storing transcript:', insertError);
        throw insertError;
      }

      // Build and apply buyer update
      const buyerUpdate = buildBuyerUpdate(buyer, extractedData);

      if (Object.keys(buyerUpdate).length > 1) {
        const { error: updateError } = await supabase
          .from('remarketing_buyers')
          .update(buyerUpdate)
          .eq('id', buyerId);

        if (updateError) {
          console.error('Error updating buyer:', updateError);
        }
      }

      const fieldsUpdated = Object.keys(buyerUpdate).filter(k => k !== 'data_last_updated' && k !== 'extraction_sources');
      console.log(`Successfully processed transcript for buyer ${buyerId}. Fields updated: ${fieldsUpdated.length}`);

      return new Response(JSON.stringify({
        success: true,
        entityType: 'buyer',
        transcriptId: transcript.id,
        extractedData,
        fieldsUpdated,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== DEAL TRANSCRIPT EXTRACTION ==========
    if (listingId) {
      console.log(`Extracting intelligence from transcript for deal ${listingId}`);
      console.log(`Transcript length: ${transcriptText.length} chars`);

      // Fetch current listing data
      const { data: listing, error: listingError } = await supabase
        .from('listings')
        .select('*')
        .eq('id', listingId)
        .single();

      if (listingError || !listing) {
        return new Response(JSON.stringify({ error: 'Listing not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Run 4-prompt deal extraction
      const { data: extractedData, billingError } = await extractDealData(
        transcriptText, 
        listing, 
        lovableApiKey
      );

      console.log('Extracted deal data:', JSON.stringify(extractedData, null, 2));

      // Handle billing errors
      if (billingError) {
        const statusCode = billingError.code === 'payment_required' ? 402 : 429;
        return new Response(JSON.stringify({
          success: false,
          error: billingError.message,
          error_code: billingError.code,
          partial_data: extractedData,
          recoverable: billingError.code === 'rate_limited'
        }), {
          status: statusCode,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Store the transcript with extracted data
      const { data: transcript, error: insertError } = await supabase
        .from('deal_transcripts')
        .insert({
          listing_id: listingId,
          transcript_text: transcriptText,
          source,
          extracted_data: extractedData,
          processed_at: new Date().toISOString(),
          created_by: user.id,
          applied_to_deal: true,
          applied_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error storing deal transcript:', insertError);
        throw insertError;
      }

      // Build and apply listing update
      const dealUpdate = buildDealUpdate(listing, extractedData);
      
      // Add extraction source tracking
      const existingSources = listing.extraction_sources || [];
      dealUpdate.extraction_sources = [
        ...(Array.isArray(existingSources) ? existingSources : []),
        {
          type: 'transcript',
          extracted_at: new Date().toISOString(),
          fields_extracted: Object.keys(dealUpdate).filter(k => 
            k !== 'data_last_updated' && k !== 'extraction_sources'
          ),
          transcript_id: transcript.id
        }
      ];

      if (Object.keys(dealUpdate).length > 1) {
        const { error: updateError } = await supabase
          .from('listings')
          .update(dealUpdate)
          .eq('id', listingId);

        if (updateError) {
          console.error('Error updating listing:', updateError);
        }
      }

      const fieldsUpdated = Object.keys(dealUpdate).filter(k => 
        k !== 'data_last_updated' && k !== 'extraction_sources'
      );
      console.log(`Successfully processed transcript for deal ${listingId}. Fields updated: ${fieldsUpdated.length}`);

      return new Response(JSON.stringify({
        success: true,
        entityType: 'deal',
        transcriptId: transcript.id,
        extractedData,
        fieldsUpdated,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback (shouldn't reach here)
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in extract-transcript:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Failed to extract transcript',
      details: String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
