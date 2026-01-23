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

Return a valid JSON object with these fields (use null for fields not found):

{
  "revenue": number (annual revenue in dollars, e.g., 7500000 for $7.5M),
  "ebitda": number (annual EBITDA in dollars),
  "ebitda_margin": number (as decimal, e.g., 0.18 for 18%),
  "asking_price": number (if mentioned, in dollars),
  
  "location": "City, State",
  "headquarters_address": "Full address if mentioned",
  "industry": "Primary industry/sector (e.g., HVAC, Plumbing, Electrical, Landscaping)",
  "founded_year": number,
  "full_time_employees": number,
  "website": "URL if mentioned",
  
  "services": ["HVAC Repair", "Duct Cleaning", "Commercial Refrigeration"] (list ALL services mentioned),
  "service_mix": "Revenue breakdown, e.g., '60% residential, 40% commercial' or '70% repair, 30% installation'",
  "business_model": "Recurring/service contracts, project-based, subscription, etc.",
  
  "geographic_states": ["MN", "TX", "FL"] (MUST be 2-letter US state codes ONLY - convert full names: Minnesota→MN, Texas→TX, California→CA, Florida→FL, Arizona→AZ, etc. If city mentioned, infer state: Minneapolis→MN, Dallas→TX, Miami→FL),
  "number_of_locations": number,
  
  "owner_goals": "What the owner wants - be specific (e.g., 'Full exit within 6 months, wants to retire', 'Looking for growth partner, willing to stay 2 years')",
  "transition_preferences": "How long owner will stay, handoff details",
  "special_requirements": "Deal breakers or must-haves (e.g., 'Must keep all employees', 'Cash only, no earnouts')",
  "timeline_notes": "Desired timing (e.g., 'Want to close by Q2', 'No rush, finding right buyer')",
  
  "customer_types": "B2B enterprise, SMB, residential consumers, government, etc.",
  "end_market_description": "Who are the ultimate customers - be specific",
  "customer_concentration": "e.g., 'No customer >10% revenue' or 'Top 3 customers = 40% revenue'",
  "customer_geography": "e.g., '80% within 50 miles of HQ' or 'Regional - Midwest only'",
  
  "executive_summary": "2-3 sentence summary capturing the essence of this business opportunity",
  "competitive_position": "Market position, moat, competitive advantages mentioned",
  "growth_trajectory": "Historical and projected growth, recent trends",
  "key_risks": "Risk factors, concerns, or challenges mentioned",
  "technology_systems": "Software, CRM, fleet management, other tech mentioned",
  "real_estate_info": "Owned vs leased, property details, warehouse/office info",
  
  "primary_contact_name": "Main contact's full name",
  "primary_contact_email": "Email if mentioned",
  "primary_contact_phone": "Phone if mentioned",
  
  "key_quotes": [
    "Extract 5-8 VERBATIM quotes that reveal important information",
    "Focus on quotes about: why selling, what they want in a buyer, business strengths/weaknesses, financial details, future concerns",
    "These should be the owner's exact words, not paraphrased"
  ],
  
  "revenue_source_quote": "The exact quote where revenue was mentioned, e.g., 'We did about 7.5 million last year'",
  "ebitda_source_quote": "The exact quote where EBITDA/profit was mentioned",
  
  "confidence": {
    "revenue": "high|medium|low",
    "ebitda": "high|medium|low"
  }
}

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
