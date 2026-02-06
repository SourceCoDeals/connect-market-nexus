import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeStates, mergeStates } from "../_shared/geography.ts";
import { buildPriorityUpdates, updateExtractionSources, createFieldSource } from "../_shared/source-priority.ts";
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../_shared/ai-providers.ts";

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
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const extractionPrompt = `You are an expert M&A analyst reviewing a call transcript or meeting notes with a business owner. Your job is to extract EVERY piece of valuable deal intelligence.

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

EXTRACTION INSTRUCTIONS:
1. Read the ENTIRE transcript carefully - do not skip any sections
2. Extract ONLY information that is actually stated or clearly implied
3. For numbers, ALWAYS convert to raw numeric values:
   - "2 million" or "2M" or "$2M" = 2000000
   - "$500K" or "500 thousand" = 500000
   - "15%" margin = 15 (as percentage number)
4. For key quotes, extract the EXACT words - these are extremely valuable

CRITICAL - FINANCIAL EXTRACTION:
- For revenue/EBITDA, use the structured format with confidence levels
- If inferred (calculated from other data), set is_inferred=true and explain method
- Include the exact quote supporting the figure
- Add follow-up questions if data is unclear

CRITICAL - LOCATION COUNT:
- Count ALL physical locations, shops, branches, offices
- Look for: "X locations", "X shops", "operate out of X"
- Single location business = 1

CRITICAL - GEOGRAPHY:
- Use 2-letter state codes ONLY (MN, TX, FL, CA)
- Map cities to states: Minneapolis=MN, Dallas=TX, Phoenix=AZ

Use the extract_deal_info tool to return structured data.`;

    const aiResponse = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: getGeminiHeaders(geminiApiKey),
      body: JSON.stringify({
        model: DEFAULT_GEMINI_MODEL,
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert M&A analyst. Extract structured data from transcripts using the provided tool. Be thorough but conservative - only include data that is explicitly stated or clearly inferrable.' 
          },
          { role: 'user', content: extractionPrompt }
        ],
        tools: [{
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
                location: { type: 'string', description: 'City, State format' },
                headquarters_address: { type: 'string', description: 'Full address if mentioned' },
                industry: { type: 'string', description: 'Primary industry (e.g., HVAC, Plumbing, Electrical)' },
                founded_year: { type: 'number', description: 'Year founded' },
                full_time_employees: { type: 'number', description: 'Number of full-time employees' },
                website: { type: 'string', description: 'Website URL if mentioned' },
                
                // Services
                services: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'List of all services mentioned'
                },
                service_mix: { type: 'string', description: 'Revenue breakdown (e.g., 60% residential, 40% commercial)' },
                business_model: { type: 'string', description: 'Recurring/service contracts, project-based, etc.' },
                
                // Geography
                geographic_states: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '2-letter US state codes ONLY (MN, TX, FL, etc.)'
                },
                number_of_locations: { type: 'number', description: 'Number of physical locations/shops/branches' },
                
                // Owner & Transaction
                owner_goals: { type: 'string', description: 'What the owner wants - be specific' },
                transition_preferences: { type: 'string', description: 'How long owner will stay, handoff details' },
                special_requirements: { type: 'string', description: 'Deal breakers or must-haves' },
                timeline_notes: { type: 'string', description: 'Desired timing' },
                
                // Customers
                customer_types: { type: 'string', description: 'B2B, SMB, residential, government, etc.' },
                end_market_description: { type: 'string', description: 'Who are the ultimate customers' },
                customer_concentration: { type: 'string', description: 'Customer concentration info' },
                customer_geography: { type: 'string', description: 'Customer geographic distribution' },
                
                // Strategic
                executive_summary: { type: 'string', description: '2-3 sentence summary of business opportunity' },
                competitive_position: { type: 'string', description: 'Market position, moat, competitive advantages' },
                growth_trajectory: { type: 'string', description: 'Historical and projected growth' },
                key_risks: { 
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Risk factors mentioned'
                },
                technology_systems: { type: 'string', description: 'Software, CRM, tech mentioned' },
                real_estate_info: { type: 'string', description: 'Owned vs leased, property details' },
                
                // Contact
                primary_contact_name: { type: 'string', description: 'Main contact full name' },
                primary_contact_email: { type: 'string', description: 'Email if mentioned' },
                primary_contact_phone: { type: 'string', description: 'Phone if mentioned' },
                
                // Quotes
                key_quotes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '5-8 VERBATIM quotes revealing important information'
                }
              }
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_deal_info' } },
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI extraction failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    
    // Extract from tool call
    let extracted: ExtractionResult = {};
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      try {
        extracted = JSON.parse(toolCall.function.arguments);
      } catch (parseError) {
        console.error('Failed to parse tool arguments:', parseError);
      }
    } else {
      // Fallback: try to parse from content
      const content = aiData.choices?.[0]?.message?.content || '{}';
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      try {
        extracted = JSON.parse(cleanedContent);
      } catch (parseError) {
        console.error('Failed to parse AI content:', parseError);
        extracted = { 
          key_quotes: [`Parse error - raw response: ${cleanedContent.substring(0, 200)}`]
        };
      }
    }

    // Normalize geographic_states using shared module
    if (extracted.geographic_states) {
      extracted.geographic_states = normalizeStates(extracted.geographic_states);
    }

    console.log('Extracted fields:', Object.keys(extracted).filter(k => extracted[k as keyof ExtractionResult] != null));

    // Update the transcript with extracted data
    const { data: transcriptRecord, error: fetchError } = await supabase
      .from('deal_transcripts')
      .select('listing_id')
      .eq('id', transcriptId)
      .single();

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

      if (listing && !listingError) {
        // Flatten extracted data for priority updates
        const flatExtracted: Record<string, unknown> = {};
        
        // Handle structured revenue
        if (extracted.revenue?.value) {
          flatExtracted.revenue = extracted.revenue.value;
          flatExtracted.revenue_confidence = extracted.revenue.confidence;
          flatExtracted.revenue_is_inferred = extracted.revenue.is_inferred || false;
          flatExtracted.revenue_source_quote = extracted.revenue.source_quote;
        }
        
        // Handle structured EBITDA
        if (extracted.ebitda) {
          if (extracted.ebitda.amount) {
            flatExtracted.ebitda = extracted.ebitda.amount;
          }
          if (extracted.ebitda.margin_percentage) {
            flatExtracted.ebitda_margin = extracted.ebitda.margin_percentage / 100; // Store as decimal
          }
          flatExtracted.ebitda_confidence = extracted.ebitda.confidence;
          flatExtracted.ebitda_is_inferred = extracted.ebitda.is_inferred || false;
          flatExtracted.ebitda_source_quote = extracted.ebitda.source_quote;
        }
        
        // Map other fields
        if (extracted.geographic_states?.length) flatExtracted.geographic_states = extracted.geographic_states;
        if (extracted.number_of_locations) flatExtracted.number_of_locations = extracted.number_of_locations;
        if (extracted.full_time_employees) flatExtracted.full_time_employees = extracted.full_time_employees;
        if (extracted.founded_year) flatExtracted.founded_year = extracted.founded_year;
        if (extracted.service_mix) flatExtracted.service_mix = extracted.service_mix;
        if (extracted.business_model) flatExtracted.business_model = extracted.business_model;
        if (extracted.owner_goals) flatExtracted.owner_goals = extracted.owner_goals;
        if (extracted.transition_preferences) flatExtracted.transition_preferences = extracted.transition_preferences;
        if (extracted.special_requirements) flatExtracted.special_requirements = extracted.special_requirements;
        if (extracted.customer_types) flatExtracted.customer_types = extracted.customer_types;
        if (extracted.customer_concentration) flatExtracted.customer_concentration = extracted.customer_concentration;
        if (extracted.executive_summary) flatExtracted.executive_summary = extracted.executive_summary;
        if (extracted.competitive_position) flatExtracted.competitive_position = extracted.competitive_position;
        if (extracted.growth_trajectory) flatExtracted.growth_trajectory = extracted.growth_trajectory;
        if (extracted.key_risks?.length) flatExtracted.key_risks = extracted.key_risks.join('\n');
        if (extracted.technology_systems) flatExtracted.technology_systems = extracted.technology_systems;
        if (extracted.real_estate_info) flatExtracted.real_estate_info = extracted.real_estate_info;
        if (extracted.key_quotes?.length) flatExtracted.key_quotes = extracted.key_quotes;
        if (extracted.financial_notes) flatExtracted.financial_notes = extracted.financial_notes;
        if (extracted.primary_contact_name) flatExtracted.primary_contact_name = extracted.primary_contact_name;
        if (extracted.primary_contact_email) flatExtracted.primary_contact_email = extracted.primary_contact_email;
        if (extracted.primary_contact_phone) flatExtracted.primary_contact_phone = extracted.primary_contact_phone;
        if (extracted.industry) flatExtracted.industry = extracted.industry;
        if (extracted.website) flatExtracted.website = extracted.website;
        
        // Build priority-aware updates using shared module (transcript has highest priority)
        const { updates, sourceUpdates } = buildPriorityUpdates(
          listing,
          listing.extraction_sources,
          flatExtracted,
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
          } else {
            dealUpdated = true;
            fieldsUpdated = Object.keys(updates);
            console.log(`Updated ${fieldsUpdated.length} fields on listing:`, fieldsUpdated);
          }
        }

        // Mark transcript as applied
        await supabase
          .from('deal_transcripts')
          .update({
            applied_to_deal: true,
            applied_at: new Date().toISOString(),
          })
          .eq('id', transcriptId);
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
