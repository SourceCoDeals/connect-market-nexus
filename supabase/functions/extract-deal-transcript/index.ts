import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const extractionPrompt = `You are an expert M&A analyst. Extract ALL relevant deal intelligence from this call/meeting transcript or notes.

${dealInfo ? `CURRENT DEAL PROFILE:
- Company: ${dealInfo.company_name || 'Unknown'}
- Industry: ${dealInfo.industry || 'Unknown'}
- Location: ${dealInfo.location || 'Not specified'}
- Revenue: ${dealInfo.revenue ? '$' + dealInfo.revenue.toLocaleString() : 'Unknown'}
- EBITDA: ${dealInfo.ebitda ? '$' + dealInfo.ebitda.toLocaleString() : 'Unknown'}
` : ''}

TRANSCRIPT/NOTES:
${transcriptText}

Extract ALL the following fields. Only include what you actually find in the transcript. Return a valid JSON object:

{
  "revenue": number or null (in dollars, e.g., 5000000 for $5M),
  "ebitda": number or null (in dollars),
  "ebitda_margin": number or null (as decimal, e.g., 0.18 for 18%),
  "asking_price": number or null (in dollars),
  "full_time_employees": number or null,
  "location": "City, State" or null,
  "headquarters_address": "Full address if mentioned" or null,
  "founded_year": number or null,
  "industry": "Primary industry" or null,
  "website": "URL if mentioned" or null,
  
  "services": ["Array of services offered"] or null,
  "service_mix": "Description of service breakdown (e.g., '60% residential, 40% commercial')" or null,
  "business_model": "B2B, B2C, recurring revenue, project-based, etc." or null,
  
  "geographic_states": ["Array of state abbreviations like 'TX', 'FL'"] or null,
  "number_of_locations": number or null,
  
  "owner_goals": "What does the owner want from this transaction? (exit, retirement, growth partner, etc.)" or null,
  "transition_preferences": "Transition timeline and involvement preferences" or null,
  "special_requirements": "Any deal breakers or must-haves" or null,
  "timeline_notes": "When do they want to close?" or null,
  
  "customer_types": "Description of customer segments" or null,
  "end_market_description": "Who are the end customers?" or null,
  
  "executive_summary": "2-3 sentence summary of the business and opportunity" or null,
  "competitive_position": "Market position and competitive advantages" or null,
  "growth_trajectory": "Historical and projected growth" or null,
  "key_risks": "Risk factors mentioned" or null,
  "technology_systems": "Software and systems used" or null,
  "real_estate_info": "Owned vs leased, property details" or null,
  
  "key_quotes": ["3-5 important direct quotes from owner/seller"] or null,
  "primary_contact_name": "Main contact name" or null,
  "primary_contact_email": "Email if mentioned" or null,
  "primary_contact_phone": "Phone if mentioned" or null,
  
  "confidence": {
    "revenue": "high|medium|low",
    "ebitda": "high|medium|low",
    ... (include confidence for each field you extracted)
  }
}

IMPORTANT:
- Only include fields where you found actual data in the transcript
- For numbers, convert to raw numbers (not strings with formatting)
- For revenue/EBITDA, interpret "2 million" as 2000000, "$5M" as 5000000
- Extract direct quotes that are particularly meaningful
- Be conservative with confidence ratings`;

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
            content: 'You are an expert M&A analyst. Extract structured data from transcripts. Always respond with valid JSON only, no markdown formatting or code blocks.' 
          },
          { role: 'user', content: extractionPrompt }
        ],
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI extraction failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let extractedText = aiData.choices?.[0]?.message?.content || '{}';
    
    // Clean up any markdown formatting
    extractedText = extractedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    console.log('AI response:', extractedText.substring(0, 500));

    let extracted: ExtractionResult;
    try {
      extracted = JSON.parse(extractedText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Return empty extraction with error note
      extracted = { 
        confidence: {},
        key_quotes: [`Parse error - raw response: ${extractedText.substring(0, 200)}`]
      };
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
