import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeStates, mergeStates } from "../_shared/geography.ts";
import { buildPriorityUpdates, updateExtractionSources, createFieldSource } from "../_shared/source-priority.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractionResult {
  // Financial
  revenue?: number;
  ebitda?: number;
  ebitda_margin?: number;
  asking_price?: number;
  
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
  key_risks?: string;
  technology_systems?: string;
  real_estate_info?: string;
  
  // Contact info
  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
  
  // Metadata
  key_quotes?: string[];
  confidence: Record<string, 'high' | 'medium' | 'low'>;
  revenue_source_quote?: string;
  ebitda_source_quote?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is admin
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { transcriptId, transcriptText, dealInfo } = await req.json();

    if (!transcriptId || !transcriptText) {
      return new Response(
        JSON.stringify({ error: 'Missing transcriptId or transcriptText' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Extracting intelligence from transcript ${transcriptId}, text length: ${transcriptText.length}`);

    // Use AI to extract intelligence
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
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
   - "15%" margin = 0.15 (as decimal)
4. For key quotes, extract the EXACT words - these are extremely valuable for understanding the seller's mindset

Use the extract_transcript_intelligence tool to return structured data.

CRITICAL GUIDELINES:
- Key quotes are EXTREMELY valuable - prioritize extracting 5-8 meaningful verbatim quotes
- Look for statements about: why selling, ideal buyer profile, deal structure preferences, concerns about sale
- For services, list EVERY distinct service mentioned, not just categories
- GEOGRAPHIC STATES MUST BE 2-LETTER ABBREVIATIONS ONLY (MN, TX, FL, CA, etc.) - NEVER full state names
- If a city is mentioned, map to state code: Minneapolis=MN, Dallas=TX, Phoenix=AZ, etc.
- If revenue is mentioned as a range, use the midpoint
- Owner goals should be detailed and specific, not generic`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert M&A analyst. Extract structured data from transcripts using the provided tool.' 
          },
          { role: 'user', content: extractionPrompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_transcript_intelligence',
            description: 'Extract comprehensive deal intelligence from transcript',
            parameters: {
              type: 'object',
              properties: {
                revenue: { type: 'number', description: 'Annual revenue in dollars (e.g., 7500000 for $7.5M)' },
                ebitda: { type: 'number', description: 'Annual EBITDA in dollars' },
                ebitda_margin: { type: 'number', description: 'EBITDA margin as decimal (e.g., 0.18 for 18%)' },
                asking_price: { type: 'number', description: 'Asking price in dollars if mentioned' },
                revenue_confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Confidence in revenue figure' },
                ebitda_confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Confidence in EBITDA figure' },
                revenue_source_quote: { type: 'string', description: 'Exact quote where revenue was mentioned' },
                ebitda_source_quote: { type: 'string', description: 'Exact quote where EBITDA was mentioned' },
                
                location: { type: 'string', description: 'City, State format' },
                headquarters_address: { type: 'string', description: 'Full address if mentioned' },
                industry: { type: 'string', description: 'Primary industry (e.g., HVAC, Plumbing, Electrical)' },
                founded_year: { type: 'number', description: 'Year founded' },
                full_time_employees: { type: 'number', description: 'Number of full-time employees' },
                website: { type: 'string', description: 'Website URL if mentioned' },
                
                services: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'List of all services mentioned'
                },
                service_mix: { type: 'string', description: 'Revenue breakdown (e.g., 60% residential, 40% commercial)' },
                business_model: { type: 'string', description: 'Recurring/service contracts, project-based, etc.' },
                
                geographic_states: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '2-letter US state codes ONLY (MN, TX, FL, etc.)'
                },
                number_of_locations: { type: 'number', description: 'Number of physical locations' },
                
                owner_goals: { type: 'string', description: 'What the owner wants - be specific' },
                transition_preferences: { type: 'string', description: 'How long owner will stay, handoff details' },
                special_requirements: { type: 'string', description: 'Deal breakers or must-haves' },
                timeline_notes: { type: 'string', description: 'Desired timing' },
                
                customer_types: { type: 'string', description: 'B2B, SMB, residential, government, etc.' },
                end_market_description: { type: 'string', description: 'Who are the ultimate customers' },
                customer_concentration: { type: 'string', description: 'Customer concentration info' },
                customer_geography: { type: 'string', description: 'Customer geographic distribution' },
                
                executive_summary: { type: 'string', description: '2-3 sentence summary of business opportunity' },
                competitive_position: { type: 'string', description: 'Market position, moat, competitive advantages' },
                growth_trajectory: { type: 'string', description: 'Historical and projected growth' },
                key_risks: { type: 'string', description: 'Risk factors or concerns mentioned' },
                technology_systems: { type: 'string', description: 'Software, CRM, tech mentioned' },
                real_estate_info: { type: 'string', description: 'Owned vs leased, property details' },
                
                primary_contact_name: { type: 'string', description: 'Main contact full name' },
                primary_contact_email: { type: 'string', description: 'Email if mentioned' },
                primary_contact_phone: { type: 'string', description: 'Phone if mentioned' },
                
                key_quotes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '5-8 VERBATIM quotes revealing important information'
                }
              }
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_transcript_intelligence' } },
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
    let extracted: ExtractionResult = { confidence: {} };
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        extracted = {
          ...parsed,
          confidence: {
            revenue: parsed.revenue_confidence || 'medium',
            ebitda: parsed.ebitda_confidence || 'medium',
          }
        };
      } catch (parseError) {
        console.error('Failed to parse tool arguments:', parseError);
      }
    } else {
      // Fallback: try to parse from content
      const content = aiData.choices?.[0]?.message?.content || '{}';
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      try {
        extracted = JSON.parse(cleanedContent);
        if (!extracted.confidence) extracted.confidence = {};
      } catch (parseError) {
        console.error('Failed to parse AI content:', parseError);
        extracted = { 
          confidence: {},
          key_quotes: [`Parse error - raw response: ${cleanedContent.substring(0, 200)}`]
        };
      }
    }

    // Normalize geographic_states using shared module
    if (extracted.geographic_states) {
      extracted.geographic_states = normalizeStates(extracted.geographic_states);
    }

    console.log('Extracted fields:', Object.keys(extracted).filter(k => k !== 'confidence' && extracted[k as keyof ExtractionResult] != null));

    // Update the transcript with extracted data
    const { error: updateError } = await supabase
      .from('deal_transcripts')
      .update({
        extracted_data: extracted,
        processed_at: new Date().toISOString(),
      })
      .eq('id', transcriptId);

    if (updateError) {
      console.error('Error updating transcript:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        extracted,
        fieldsExtracted: Object.keys(extracted).filter(k => k !== 'confidence' && extracted[k as keyof ExtractionResult] != null).length,
        message: 'Intelligence extracted successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-deal-transcript:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
