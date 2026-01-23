import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // Check if user is admin
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

    const { buyerId, transcriptText, source = 'call' } = await req.json();

    if (!buyerId || !transcriptText) {
      return new Response(JSON.stringify({ error: 'buyerId and transcriptText are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Extracting intelligence from transcript for buyer ${buyerId}`);

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

    // Use AI to extract intelligence from the transcript
    const extractionPrompt = `You are an expert M&A analyst. Extract structured buyer intelligence from this call/meeting transcript.

CURRENT BUYER PROFILE:
- Company: ${buyer.company_name}
- Type: ${buyer.buyer_type || 'Unknown'}
- Current Thesis: ${buyer.thesis_summary || 'Not documented'}
- Target Geographies: ${buyer.target_geographies?.join(', ') || 'Not specified'}
- Target Services: ${buyer.target_services?.join(', ') || 'Not specified'}
- Target Revenue: $${buyer.target_revenue_min || '?'}M - $${buyer.target_revenue_max || '?'}M
- Target EBITDA: $${buyer.target_ebitda_min || '?'}M - $${buyer.target_ebitda_max || '?'}M

TRANSCRIPT:
${transcriptText}

Extract the following information. Only include fields where you found NEW or UPDATED information in the transcript. Return JSON:

{
  "thesis_updates": "Any new investment thesis or strategy mentioned",
  "target_geographies": ["Array of states/regions they mentioned targeting"],
  "target_services": ["Array of services/industries they mentioned"],
  "target_revenue_min": number or null (in dollars, e.g., 5000000 for $5M),
  "target_revenue_max": number or null,
  "revenue_sweet_spot": number or null (ideal target revenue),
  "target_ebitda_min": number or null,
  "target_ebitda_max": number or null,
  "ebitda_sweet_spot": number or null (ideal target EBITDA),
  "geographic_footprint": ["Array of locations where they currently operate"],
  "recent_interests": "Any specific deal types or characteristics they expressed interest in",
  "concerns": "Any concerns or deal-breakers they mentioned",
  "timeline": "Any timeline or urgency mentioned for acquisitions",
  "key_contacts_mentioned": ["Names and roles of people mentioned"],
  "summary": "2-3 sentence summary of the key takeaways from this conversation",
  "strategic_priorities": ["Key priorities or initiatives mentioned"],
  "deal_breakers": ["Things they explicitly said they avoid or won't consider"],
  "acquisition_appetite": "Their current appetite for acquisitions",
  "acquisition_timeline": "When they want to close deals",
  "primary_customer_size": "Customer segment mentioned (SMB, Enterprise, etc.)",
  "customer_industries": ["Industries their customers are in"],
  "target_customer_profile": "Description of ideal end customer",
  "key_quotes": ["Direct quotes that reveal important buyer preferences - extract 3-5 most insightful quotes verbatim"]
}

Only include fields with actual extracted data. Use null for fields with no relevant information found.
IMPORTANT: Extract key_quotes as direct verbatim quotes from the transcript that reveal buyer preferences, concerns, or strategy.`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert M&A analyst. Extract structured data from transcripts. Always respond with valid JSON.' },
          { role: 'user', content: extractionPrompt }
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
    const extractedData = JSON.parse(aiData.choices[0].message.content);

    console.log('Extracted data:', JSON.stringify(extractedData, null, 2));

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

    // Build update payload for buyer - only update fields with new data
    const buyerUpdate: Record<string, any> = {
      data_last_updated: new Date().toISOString(),
    };

    // Update thesis if new info found
    if (extractedData.thesis_updates && extractedData.thesis_updates !== 'null') {
      const existingThesis = buyer.thesis_summary || '';
      const newThesis = existingThesis 
        ? `${existingThesis}\n\n[Updated ${new Date().toLocaleDateString()}]: ${extractedData.thesis_updates}`
        : extractedData.thesis_updates;
      buyerUpdate.thesis_summary = newThesis;
    }

    // Merge geographies
    if (extractedData.target_geographies?.length > 0) {
      const existing = buyer.target_geographies || [];
      const merged = [...new Set([...existing, ...extractedData.target_geographies])];
      buyerUpdate.target_geographies = merged;
    }

    // Merge services
    if (extractedData.target_services?.length > 0) {
      const existing = buyer.target_services || [];
      const merged = [...new Set([...existing, ...extractedData.target_services])];
      buyerUpdate.target_services = merged;
    }

    // Merge footprint
    if (extractedData.geographic_footprint?.length > 0) {
      const existing = buyer.geographic_footprint || [];
      const merged = [...new Set([...existing, ...extractedData.geographic_footprint])];
      buyerUpdate.geographic_footprint = merged;
    }

    // Update revenue/EBITDA if provided
    if (extractedData.target_revenue_min) {
      buyerUpdate.target_revenue_min = extractedData.target_revenue_min;
    }
    if (extractedData.target_revenue_max) {
      buyerUpdate.target_revenue_max = extractedData.target_revenue_max;
    }
    if (extractedData.revenue_sweet_spot) {
      buyerUpdate.revenue_sweet_spot = extractedData.revenue_sweet_spot;
    }
    if (extractedData.target_ebitda_min) {
      buyerUpdate.target_ebitda_min = extractedData.target_ebitda_min;
    }
    if (extractedData.target_ebitda_max) {
      buyerUpdate.target_ebitda_max = extractedData.target_ebitda_max;
    }
    if (extractedData.ebitda_sweet_spot) {
      buyerUpdate.ebitda_sweet_spot = extractedData.ebitda_sweet_spot;
    }

    // Update strategic priorities
    if (extractedData.strategic_priorities?.length > 0) {
      const existing = buyer.strategic_priorities || [];
      const merged = [...new Set([...existing, ...extractedData.strategic_priorities])];
      buyerUpdate.strategic_priorities = merged;
    }

    // Update deal breakers
    if (extractedData.deal_breakers?.length > 0) {
      const existing = buyer.deal_breakers || [];
      const merged = [...new Set([...existing, ...extractedData.deal_breakers])];
      buyerUpdate.deal_breakers = merged;
    }

    // Update acquisition appetite and timeline
    if (extractedData.acquisition_appetite) {
      buyerUpdate.acquisition_appetite = extractedData.acquisition_appetite;
    }
    if (extractedData.acquisition_timeline) {
      buyerUpdate.acquisition_timeline = extractedData.acquisition_timeline;
    }

    // Update customer info
    if (extractedData.primary_customer_size) {
      buyerUpdate.primary_customer_size = extractedData.primary_customer_size;
    }
    if (extractedData.customer_industries?.length > 0) {
      const existing = buyer.customer_industries || [];
      const merged = [...new Set([...existing, ...extractedData.customer_industries])];
      buyerUpdate.customer_industries = merged;
    }
    if (extractedData.target_customer_profile) {
      buyerUpdate.target_customer_profile = extractedData.target_customer_profile;
    }

    // Append key quotes
    if (extractedData.key_quotes?.length > 0) {
      const existing = buyer.key_quotes || [];
      const merged = [...new Set([...existing, ...extractedData.key_quotes])];
      buyerUpdate.key_quotes = merged;
    }

    // Update notes with concerns/interests
    if (extractedData.concerns || extractedData.recent_interests) {
      const existingNotes = buyer.notes || '';
      const additions: string[] = [];
      if (extractedData.recent_interests) {
        additions.push(`Interests: ${extractedData.recent_interests}`);
      }
      if (extractedData.concerns) {
        additions.push(`Concerns: ${extractedData.concerns}`);
      }
      if (extractedData.timeline) {
        additions.push(`Timeline: ${extractedData.timeline}`);
      }
      const newNotes = existingNotes 
        ? `${existingNotes}\n\n[From ${source} on ${new Date().toLocaleDateString()}]:\n${additions.join('\n')}`
        : additions.join('\n');
      buyerUpdate.notes = newNotes;
    }

    // Update the buyer record
    if (Object.keys(buyerUpdate).length > 1) { // More than just data_last_updated
      const { error: updateError } = await supabase
        .from('remarketing_buyers')
        .update(buyerUpdate)
        .eq('id', buyerId);

      if (updateError) {
        console.error('Error updating buyer:', updateError);
        // Don't throw - transcript was saved successfully
      }
    }

    console.log(`Successfully processed transcript for buyer ${buyerId}`);

    return new Response(JSON.stringify({
      success: true,
      transcriptId: transcript.id,
      extractedData,
      fieldsUpdated: Object.keys(buyerUpdate).filter(k => k !== 'data_last_updated'),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in extract-transcript:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to extract transcript',
      details: String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
