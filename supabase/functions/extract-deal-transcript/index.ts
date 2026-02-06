import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeStates, mergeStates } from "../_shared/geography.ts";
import { buildPriorityUpdates, updateExtractionSources, createFieldSource } from "../_shared/source-priority.ts";
import { callClaudeWithTool, DEFAULT_CLAUDE_MODEL } from "../_shared/ai-providers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FinancialExtraction {
  value?: number;
  confidence: 'high' | 'medium' | 'low';
  is_inferred?: boolean;
  source_quote?: string;
  inference_method?: string;
}

interface ExtractionResult {
  // Financial (structured per spec)
  revenue?: FinancialExtraction;
  ebitda?: {
    amount?: number;
    margin_percentage?: number;
    confidence: 'high' | 'medium' | 'low';
    is_inferred?: boolean;
    source_quote?: string;
  };
  financial_followup_questions?: string[];
  financial_notes?: string;
  
  // Business basics
  full_time_employees?: number;
  location?: string;
  headquarters_address?: string;
  founded_year?: number;
  industry?: string;
  website?: string;
  
  // Services & Business model
  services?: string[];
  service_mix?: string;
  business_model?: string;
  
  // Geography
  geographic_states?: string[];
  number_of_locations?: number;
  
  // Owner & Transaction
  owner_goals?: string;
  transition_preferences?: string;
  special_requirements?: string;
  timeline_notes?: string;
  
  // Customers
  customer_types?: string;
  end_market_description?: string;
  customer_concentration?: string;
  customer_geography?: string;
  
  // Strategic info
  executive_summary?: string;
  competitive_position?: string;
  growth_trajectory?: string;
  key_risks?: string[];
  technology_systems?: string;
  real_estate_info?: string;
  
  // Contact info
  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
  
  // Metadata
  key_quotes?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth (verify_jwt is disabled in config.toml for internal worker calls).
    // Allow either:
    // - Internal service role calls (Bearer token equals service role key)
    // - End-user calls with a valid Supabase JWT
    const authHeader = req.headers.get('authorization') || '';
    const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : '';

    if (!bearer) {
      return new Response(JSON.stringify({ error: 'Missing Authorization bearer token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (bearer !== supabaseKey) {
      const { data: userData, error: userErr } = await supabase.auth.getUser(bearer);
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { transcriptId, transcriptText: providedText, dealInfo, applyToDeal = true } = await req.json();

    if (!transcriptId) {
      return new Response(
        JSON.stringify({ error: 'Missing transcriptId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch transcript text from database if not provided
    let transcriptText = providedText;
    if (!transcriptText) {
      const { data: transcript, error: fetchError } = await supabase
        .from('deal_transcripts')
        .select('transcript_text, listing_id')
        .eq('id', transcriptId)
        .single();

      if (fetchError || !transcript) {
        return new Response(
          JSON.stringify({ error: 'Transcript not found or has no text content' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      transcriptText = transcript.transcript_text;

      if (!transcriptText || transcriptText.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: 'Transcript has no text content to extract from' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`Extracting intelligence from transcript ${transcriptId}, text length: ${transcriptText.length}`);

    // Use AI to extract intelligence
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const extractionPrompt = `You are a senior M&A analyst conducting due diligence. You are reviewing a call transcript or meeting notes with a business owner or broker. Your job is to extract EVERY piece of deal intelligence - be EXHAUSTIVE, not conservative. If something is mentioned even briefly, capture it.

${dealInfo ? `CURRENT DEAL PROFILE (for context - update if transcript has newer/better info):
Company: ${dealInfo.company_name || 'Unknown'}
Industry: ${dealInfo.industry || 'Unknown'}
Location: ${dealInfo.location || 'Not specified'}
Revenue: ${dealInfo.revenue ? '$' + dealInfo.revenue.toLocaleString() : 'Unknown'}
EBITDA: ${dealInfo.ebitda ? '$' + dealInfo.ebitda.toLocaleString() : 'Unknown'}
` : ''}

TRANSCRIPT/NOTES TO ANALYZE:
"""
${transcriptText}
"""

---

EXTRACTION INSTRUCTIONS - BE THOROUGH:
1. Read the ENTIRE transcript word by word. Do not skip ANY section.
2. Extract information that is stated, implied, or can be reasonably inferred from context.
3. For numbers, ALWAYS convert to raw numeric values:
   - "2 million" or "2M" or "$2M" = 2000000
   - "$500K" or "500 thousand" = 500000
   - "15%" margin = 15 (as percentage number)
4. For key quotes, extract 8-10 EXACT VERBATIM quotes that reveal important business details, financial info, owner motivations, risks, or growth opportunities. These are extremely valuable for deal evaluation.
5. For text fields like executive_summary, owner_goals, business_model - write DETAILED multi-sentence responses, not short phrases. Include specific details, numbers, and context from the transcript.
6. For service_mix - list EVERY service mentioned anywhere in the transcript, with revenue split if discussed.
7. For geographic_states - capture every state where they operate, have customers, or mentioned expansion plans.

CRITICAL - FINANCIAL EXTRACTION:
- For revenue/EBITDA, use the structured format with confidence levels
- If someone says "we do about 6, 7, 8 million" set revenue to the midpoint (7000000) with confidence "medium"
- If inferred from employee count, margins, or other data, set is_inferred=true and explain method
- Include the EXACT quote supporting the figure in source_quote
- Add follow-up questions if data is unclear or contradictory
- Include financial_notes with any relevant context (seasonality, trends, one-time items)

CRITICAL - EXECUTIVE SUMMARY:
- Write 3-5 sentences summarizing the COMPLETE business opportunity
- Include: what the company does, approximate size, key strengths, why it's attractive as an acquisition, and what the owner wants
- Reference specific facts from the transcript

CRITICAL - OWNER GOALS & TRANSITION:
- Be very specific about what the owner wants. Don't just say "exit strategy" - say exactly what they described
- Include ownership_structure: sole proprietor, partnership, family-owned, LLC, etc.
- Include transition_preferences: how long they'll stay, what role, training period
- Include special_requirements: any deal breakers, must-haves, non-negotiables

CRITICAL - SERVICES & BUSINESS MODEL:
- For service_mix: list ALL services with detail. e.g., "Fire restoration, water restoration, roofing, in-house textile cleaning, content inventory - primarily project-based with some recurring service contracts"
- For business_model: describe how they make money. Recurring vs project, contract structure, pricing model, customer type split

CRITICAL - CUSTOMERS:
- customer_types: Be specific - "residential homeowners (60%), commercial property managers (30%), insurance companies (10%)"
- customer_concentration: Any mention of key accounts, largest customer %, concentration risk
- customer_geography: Where their customers are located

CRITICAL - LOCATION & GEOGRAPHY:
- Count ALL physical locations, shops, branches, offices, warehouses
- Use 2-letter state codes ONLY (MN, TX, FL, CA)
- Map cities to states: Minneapolis=MN, Dallas=TX, Phoenix=AZ, Indianapolis=IN

CRITICAL - ADDITIONAL DETAILS:
- competitive_position: What makes them different? Market position, reputation, moat
- growth_trajectory: Historical growth AND future plans. "Grew from $2M to $8M over 5 years, targeting $15M"
- key_risks: List EVERY risk factor mentioned - key person dependency, customer concentration, regulatory, seasonal, etc.
- technology_systems: Any software, CRM, fleet management, scheduling tools mentioned
- real_estate_info: Owned vs leased, property details, warehouse/office space

You MUST populate as many fields as possible. Do not leave fields empty if there is ANY relevant information in the transcript. Use the extract_deal_info tool to return structured data.`;

    // Tool schema for Claude
    const tool = {
      type: 'function',
      function: {
        name: 'extract_deal_info',
        description: 'Extract comprehensive deal intelligence from transcript',
        parameters: {
          type: 'object',
          properties: {
            // Financial with structured metadata (per spec)
            revenue: {
              type: 'object',
              properties: {
                value: { type: 'number', description: 'Annual revenue in dollars (e.g., 7500000 for $7.5M)' },
                confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                is_inferred: { type: 'boolean', description: 'True if calculated from other data' },
                source_quote: { type: 'string', description: 'Exact quote where revenue was mentioned' },
                inference_method: { type: 'string', description: 'How value was inferred if applicable' }
              },
              required: ['confidence']
            },
            ebitda: {
              type: 'object',
              properties: {
                amount: { type: 'number', description: 'EBITDA in dollars' },
                margin_percentage: { type: 'number', description: 'EBITDA margin as percentage (e.g., 18 for 18%)' },
                confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                is_inferred: { type: 'boolean' },
                source_quote: { type: 'string' }
              },
              required: ['confidence']
            },
            financial_followup_questions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Questions to clarify financials in follow-up call'
            },
            financial_notes: { type: 'string', description: 'Notes and flags for deal team' },
            
            // Business basics
            location: { type: 'string', description: 'City, State format (e.g., "Sellersburg, IN")' },
            headquarters_address: { type: 'string', description: 'Full address if mentioned' },
            industry: { type: 'string', description: 'Primary industry (e.g., Fire & Water Restoration, HVAC, Plumbing)' },
            founded_year: { type: 'number', description: 'Year the business was founded or started' },
            full_time_employees: { type: 'number', description: 'Number of full-time employees. Count all staff mentioned: crews, office, technicians' },
            part_time_employees: { type: 'number', description: 'Number of part-time or seasonal employees if mentioned' },
            website: { type: 'string', description: 'Website URL if mentioned' },

            // Services - BE DETAILED
            services: {
              type: 'array',
              items: { type: 'string' },
              description: 'List EVERY service mentioned anywhere in the transcript. Include sub-services. e.g., ["fire restoration", "water restoration", "roofing", "textile cleaning", "content inventory", "mold remediation"]'
            },
            service_mix: { type: 'string', description: 'Detailed description of all services with revenue breakdown if discussed. e.g., "Fire restoration (40%), water restoration (35%), roofing (15%), in-house textile cleaning and content inventory (10%). Primarily residential with growing commercial segment."' },
            business_model: { type: 'string', description: 'Detailed description of how the business makes money. Include: project-based vs recurring, contract types, pricing model, insurance work vs direct, residential vs commercial split. e.g., "Project-based restoration work with recurring service contracts; revenue recognized over time using work-in-progress methodology"' },

            // Geography
            geographic_states: {
              type: 'array',
              items: { type: 'string' },
              description: '2-letter US state codes where company operates, has customers, or has mentioned. Include ALL states. e.g., ["IN", "KY", "OH"]'
            },
            number_of_locations: { type: 'number', description: 'Total number of physical locations, shops, branches, offices, warehouses' },

            // Owner & Transaction - BE VERY SPECIFIC
            owner_goals: { type: 'string', description: 'Detailed description of what the owner wants from a deal. Be specific with their exact words and motivations. e.g., "Create an exit strategy and partner with someone who can take the business to the next level. Looking for growth capital and operational support, not just a buyout. Wants to stay involved during transition period."' },
            ownership_structure: { type: 'string', description: 'How the business is owned: sole proprietor, partnership, family-owned, LLC, S-corp, multiple partners, etc. Include ownership percentages if mentioned.' },
            transition_preferences: { type: 'string', description: 'How long the owner will stay post-acquisition, what role they want, training period, handoff plan. Be specific.' },
            special_requirements: { type: 'string', description: 'Any deal breakers, must-haves, or non-negotiable requirements the owner mentioned. e.g., "Wants to retain all current employees, requires earnout structure, won\'t sell to competitors"' },
            timeline_notes: { type: 'string', description: 'Desired timing for the deal - when they want to close, any urgency factors' },

            // Customers - BE DETAILED
            customer_types: { type: 'string', description: 'Detailed breakdown of customer segments with percentages if available. e.g., "Residential homeowners (60%), commercial property managers (25%), insurance companies (15%). Mix of direct customers and insurance referrals."' },
            end_market_description: { type: 'string', description: 'Who the ultimate end customers are, what they look like, how they find the company' },
            customer_concentration: { type: 'string', description: 'Customer concentration details. Largest customer %, top 10 concentration, any key account dependencies' },
            customer_geography: { type: 'string', description: 'Where customers are located geographically. Service radius, coverage area' },

            // Strategic - WRITE DETAILED MULTI-SENTENCE RESPONSES
            executive_summary: { type: 'string', description: '3-5 sentence summary of the complete business opportunity. Include: what the company does, approximate revenue/size, number of employees, key strengths, geographic presence, growth trajectory, and why it is attractive as an acquisition target. Reference specific facts from the transcript.' },
            competitive_position: { type: 'string', description: 'What makes this company different from competitors? Market position, reputation, years in business, certifications, unique capabilities, customer relationships, brand recognition. Be specific with details from the transcript.' },
            growth_trajectory: { type: 'string', description: 'Historical growth story AND future growth potential. Include specific numbers. e.g., "Grew from $2M to $8M over 5 years. Recently expanded into roofing. Owner believes company can reach $15M with proper investment in sales and equipment."' },
            key_risks: {
              type: 'array',
              items: { type: 'string' },
              description: 'List EVERY risk factor mentioned or implied: key person dependency, customer concentration, regulatory, seasonal patterns, workforce challenges, equipment age, lease expiration, insurance dependency, etc.'
            },
            technology_systems: { type: 'string', description: 'All software, CRM, fleet management, scheduling, accounting, estimating tools mentioned. e.g., "Uses Xactimate for estimating, QuickBooks for accounting, no formal CRM"' },
            real_estate_info: { type: 'string', description: 'Property details: owned vs leased, square footage, warehouse space, office space, lease terms, property value if mentioned' },

            // Contact
            primary_contact_name: { type: 'string', description: 'Full name of the main contact person (owner, broker, or representative)' },
            primary_contact_email: { type: 'string', description: 'Email address if mentioned' },
            primary_contact_phone: { type: 'string', description: 'Phone number if mentioned' },

            // Quotes - GET MORE
            key_quotes: {
              type: 'array',
              items: { type: 'string' },
              description: '8-10 EXACT VERBATIM quotes from the transcript that reveal important information about finances, growth, risks, owner motivations, business operations, or competitive position. These are the most valuable data points for deal evaluation. Include the most insightful and revealing statements.'
            }
          }
        }
      }
    };

    const systemPrompt = 'You are a senior M&A analyst conducting due diligence. Extract EVERY piece of structured data from the transcript. Be exhaustive - populate as many fields as possible. If information is mentioned even briefly or can be reasonably inferred, include it. Never leave a field empty if there is any relevant information.';

    // Call Claude API with 60s timeout for long transcripts
    const { data: extracted, error: aiError } = await callClaudeWithTool(
      systemPrompt,
      extractionPrompt,
      tool,
      anthropicApiKey,
      DEFAULT_CLAUDE_MODEL,
      60000
    ) as { data: ExtractionResult | null; error?: { code: string; message: string } };

    if (aiError) {
      console.error('Claude API error:', aiError);
      throw new Error(`AI extraction failed: ${aiError.message}`);
    }

    if (!extracted) {
      throw new Error('No extraction result from AI');
    }

    // Normalize geographic_states using shared module
    if (extracted.geographic_states) {
      extracted.geographic_states = normalizeStates(extracted.geographic_states);
    }

    // Update the transcript with extracted data
    const { data: transcriptRecord, error: fetchError } = await supabase
      .from('deal_transcripts')
      .select('listing_id')
      .eq('id', transcriptId)
      .single();

    if (fetchError || !transcriptRecord) {
      console.error('Failed to fetch transcript record:', fetchError);
      throw new Error(`Failed to fetch transcript record: ${fetchError?.message || 'Not found'}`);
    }

    const { error: updateTranscriptError } = await supabase
      .from('deal_transcripts')
      .update({
        extracted_data: extracted,
        processed_at: new Date().toISOString(),
      })
      .eq('id', transcriptId);

    if (updateTranscriptError) {
      console.error('Error updating transcript:', updateTranscriptError);
      throw updateTranscriptError;
    }

    // ========== KEY SPEC REQUIREMENT: Apply to listings table ==========
    let dealUpdated = false;
    let fieldsUpdated: string[] = [];
    
    if (applyToDeal && transcriptRecord?.listing_id) {
      const listingId = transcriptRecord.listing_id;
      
      // Fetch current listing with extraction_sources
      const { data: listing, error: listingError } = await supabase
        .from('listings')
        .select('*, extraction_sources')
        .eq('id', listingId)
        .single();

      if (listingError || !listing) {
        console.error('Failed to fetch listing for enrichment:', listingError);
        throw new Error(`Failed to fetch listing ${listingId}: ${listingError?.message || 'Not found'}`);
      }

      if (listing) {
        // Flatten extracted data for priority updates
        const flatExtracted: Record<string, unknown> = {};

        const toFiniteNumber = (v: unknown): number | undefined => {
          if (typeof v === 'number' && Number.isFinite(v)) return v;
          if (typeof v === 'string') {
            const n = Number(v.replace(/[$,]/g, '').trim());
            if (Number.isFinite(n)) return n;
          }
          return undefined;
        };

        // Handle structured revenue
        {
          const revenueValue = toFiniteNumber(extracted.revenue?.value);
          if (revenueValue != null) {
            flatExtracted.revenue = revenueValue;
            flatExtracted.revenue_confidence = extracted.revenue?.confidence;
            flatExtracted.revenue_is_inferred = extracted.revenue?.is_inferred || false;
            flatExtracted.revenue_source_quote = extracted.revenue?.source_quote;
          }
        }

        // Handle structured EBITDA
        {
          const ebitdaAmount = toFiniteNumber(extracted.ebitda?.amount);
          if (ebitdaAmount != null) flatExtracted.ebitda = ebitdaAmount;

          const marginPct = toFiniteNumber(extracted.ebitda?.margin_percentage);
          if (marginPct != null) flatExtracted.ebitda_margin = marginPct / 100; // Store as decimal

          if (extracted.ebitda) {
            flatExtracted.ebitda_confidence = extracted.ebitda.confidence;
            flatExtracted.ebitda_is_inferred = extracted.ebitda.is_inferred || false;
            flatExtracted.ebitda_source_quote = extracted.ebitda.source_quote;
          }
        }

        // Map other fields
        if (extracted.geographic_states?.length) flatExtracted.geographic_states = extracted.geographic_states;
        {
          const n = toFiniteNumber(extracted.number_of_locations);
          if (n != null) flatExtracted.number_of_locations = n;
        }
        {
          const n = toFiniteNumber(extracted.full_time_employees);
          if (n != null) flatExtracted.full_time_employees = n;
        }
        {
          const n = toFiniteNumber(extracted.founded_year);
          if (n != null) flatExtracted.founded_year = n;
        }
        if (extracted.service_mix) flatExtracted.service_mix = extracted.service_mix;
        if (extracted.business_model) flatExtracted.business_model = extracted.business_model;
        if (extracted.owner_goals) flatExtracted.owner_goals = extracted.owner_goals;
        if (extracted.transition_preferences) flatExtracted.transition_preferences = extracted.transition_preferences;
        if (extracted.special_requirements) flatExtracted.special_requirements = extracted.special_requirements;
        if (extracted.customer_types) flatExtracted.customer_types = extracted.customer_types;
        if (extracted.customer_concentration) flatExtracted.customer_concentration = extracted.customer_concentration;
        if (extracted.customer_geography) flatExtracted.customer_geography = extracted.customer_geography;
        if (extracted.end_market_description) flatExtracted.end_market_description = extracted.end_market_description;
        if (extracted.executive_summary) flatExtracted.executive_summary = extracted.executive_summary;
        if (extracted.competitive_position) flatExtracted.competitive_position = extracted.competitive_position;
        if (extracted.growth_trajectory) flatExtracted.growth_trajectory = extracted.growth_trajectory;
        if (extracted.key_risks?.length) flatExtracted.key_risks = extracted.key_risks.join('\n');
        if (extracted.technology_systems) flatExtracted.technology_systems = extracted.technology_systems;
        if (extracted.real_estate_info) flatExtracted.real_estate_info = extracted.real_estate_info;
        if (extracted.key_quotes?.length) flatExtracted.key_quotes = extracted.key_quotes;
        if (extracted.financial_notes) flatExtracted.financial_notes = extracted.financial_notes;
        if (extracted.financial_followup_questions?.length) {
          flatExtracted.financial_followup_questions = extracted.financial_followup_questions;
        }
        if (extracted.primary_contact_name) flatExtracted.primary_contact_name = extracted.primary_contact_name;
        if (extracted.primary_contact_email) flatExtracted.primary_contact_email = extracted.primary_contact_email;
        if (extracted.primary_contact_phone) flatExtracted.primary_contact_phone = extracted.primary_contact_phone;
        if (extracted.industry) flatExtracted.industry = extracted.industry;
        if (extracted.website) flatExtracted.website = extracted.website;
        if (extracted.location) flatExtracted.location = extracted.location;
        if (extracted.headquarters_address) flatExtracted.headquarters_address = extracted.headquarters_address;
        if (extracted.ownership_structure) flatExtracted.ownership_structure = extracted.ownership_structure;
        if (extracted.timeline_notes) flatExtracted.timeline_notes = extracted.timeline_notes;
        if (extracted.services?.length) flatExtracted.services = extracted.services;
        {
          const n = toFiniteNumber(extracted.part_time_employees);
          if (n != null) flatExtracted.part_time_employees = n;
        }

        // SAFETY: Only update columns that actually exist on the listings row.
        // PostgREST rejects the entire update when any unknown column is present.
        const listingKeys = new Set(Object.keys(listing as Record<string, unknown>));
        const filteredExtracted: Record<string, unknown> = {};
        const droppedKeys: string[] = [];
        for (const [k, v] of Object.entries(flatExtracted)) {
          if (listingKeys.has(k)) filteredExtracted[k] = v;
          else droppedKeys.push(k);
        }
        if (droppedKeys.length > 0) {
          console.log(`Dropping ${droppedKeys.length} non-listing fields:`, droppedKeys);
        }

        // Build priority-aware updates using shared module (transcript has highest priority)
        const { updates, sourceUpdates } = buildPriorityUpdates(
          listing,
          listing.extraction_sources,
          filteredExtracted,
          'transcript',
          transcriptId
        );

        // Merge geographic_states instead of replacing
        if (updates.geographic_states && listing.geographic_states?.length > 0) {
          updates.geographic_states = mergeStates(
            listing.geographic_states,
            updates.geographic_states as string[]
          );
        }

        if (Object.keys(updates).length > 0) {
          const finalUpdates = {
            ...updates,
            enriched_at: new Date().toISOString(),
            extraction_sources: updateExtractionSources(listing.extraction_sources, sourceUpdates),
          };

          const { error: listingUpdateError } = await supabase
            .from('listings')
            .update(finalUpdates)
            .eq('id', listingId);

          if (listingUpdateError) {
            console.error('Error updating listing:', listingUpdateError);
            throw new Error(`Failed to update listing: ${listingUpdateError.message}`);
          } else {
            dealUpdated = true;
            fieldsUpdated = Object.keys(updates);
            console.log(`Updated ${fieldsUpdated.length} fields on listing:`, fieldsUpdated);
          }
        }

        // Mark transcript as applied ONLY if we actually updated the deal
        // (older runs could mark applied even when listing updates were skipped)
        if (dealUpdated) {
          await supabase
            .from('deal_transcripts')
            .update({
              applied_to_deal: true,
              applied_at: new Date().toISOString(),
            })
            .eq('id', transcriptId);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        extracted,
        fieldsExtracted: Object.keys(extracted).filter(k => extracted[k as keyof ExtractionResult] != null).length,
        dealUpdated,
        fieldsUpdated,
        message: dealUpdated 
          ? `Intelligence extracted and ${fieldsUpdated.length} fields applied to deal`
          : 'Intelligence extracted successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-deal-transcript:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
