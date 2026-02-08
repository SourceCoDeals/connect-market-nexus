import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeStates, extractStatesFromText, mergeStates } from "../_shared/geography.ts";
import { buildPriorityUpdates, updateExtractionSources } from "../_shared/source-priority.ts";
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../_shared/ai-providers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Pre-extraction regex patterns per spec
const REVENUE_PATTERNS = [
  /\$\s*([\d,.]+)\s*(M|MM|m|million|mil)/gi,
  /revenue[:\s]+\$?\s*([\d,.]+)\s*(M|MM|m|million|mil)?/gi,
  /([\d,.]+)\s*(M|MM|million)\s*(?:in\s+)?(?:revenue|sales)/gi,
  /top\s*line[:\s]+\$?\s*([\d,.]+)\s*(M|MM|m|million|mil)?/gi,
  /annual\s+revenue[:\s]+\$?\s*([\d,.]+)\s*(M|MM|m|million|K|k|thousand)?/gi,
];

const EBITDA_PATTERNS = [
  /EBITDA[:\s]+\$?\s*([\d,.]+)\s*(K|k|M|MM|m|thousand|million)?/gi,
  /\$\s*([\d,.]+)\s*(K|k|M|MM)?\s*EBITDA/gi,
  /cash\s*flow[:\s]+\$?\s*([\d,.]+)\s*(K|k|M|MM|m|thousand|million)?/gi,
  /SDE[:\s]+\$?\s*([\d,.]+)\s*(K|k|M|MM|m|thousand|million)?/gi,
  /owner.?s?\s*(?:cash|earnings)[:\s]+\$?\s*([\d,.]+)\s*(K|k|M|MM|m|thousand|million)?/gi,
];

const MARGIN_PATTERNS = [
  /([\d.]+)\s*%\s*(?:EBITDA\s*)?margin/gi,
  /margin[:\s]+([\d.]+)\s*%/gi,
  /run(?:ning|s)?\s+(?:at\s+)?(?:about\s+)?([\d.]+)\s*%\s*margin/gi,
];

const EMPLOYEE_PATTERNS = [
  /([\d,]+)\s*(?:full[- ]?time\s*)?employees/gi,
  /headcount[:\s]+([\d,]+)/gi,
  /team\s*(?:of\s*)?([\d,]+)/gi,
  /([\d,]+)\s*FTEs?/gi,
];

const LOCATION_PATTERNS = [
  /(\d+)\s+(?:staffed\s+)?locations?/gi,
  /(\d+)\s+offices?/gi,
  /(\d+)\s+branches?/gi,
  /(\d+)\s+stores?/gi,
  /(\d+)\s+shops?/gi,
  /(\d+)\s+facilities/gi,
  /operate\s+out\s+of\s+(\d+)/gi,
  /(\d+)\s+sites?\s+across/gi,
];

function parseNumberValue(match: string, multiplier?: string): number | null {
  const cleaned = match.replace(/,/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  
  if (multiplier) {
    const mult = multiplier.toLowerCase();
    if (mult === 'm' || mult === 'mm' || mult === 'million' || mult === 'mil') {
      return num * 1000000;
    }
    if (mult === 'k' || mult === 'thousand') {
      return num * 1000;
    }
  }
  
  // If number is small, assume millions for revenue/EBITDA
  if (num < 1000) {
    return num * 1000000;
  }
  
  return num;
}

function extractWithRegex(text: string): {
  revenue?: number;
  ebitda?: number;
  ebitda_margin?: number;
  full_time_employees?: number;
  geographic_states?: string[];
  number_of_locations?: number;
} {
  const result: {
    revenue?: number;
    ebitda?: number;
    ebitda_margin?: number;
    full_time_employees?: number;
    geographic_states?: string[];
    number_of_locations?: number;
  } = {};
  
  // Extract revenue
  for (const pattern of REVENUE_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      const value = parseNumberValue(match[1], match[2]);
      if (value && value > 100000) { // Minimum threshold
        result.revenue = value;
        break;
      }
    }
  }
  
  // Extract EBITDA
  for (const pattern of EBITDA_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      const value = parseNumberValue(match[1], match[2]);
      if (value && value > 10000) { // Minimum threshold
        result.ebitda = value;
        break;
      }
    }
  }
  
  // Extract margin
  for (const pattern of MARGIN_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      const margin = parseFloat(match[1]);
      if (margin > 0 && margin < 100) {
        result.ebitda_margin = margin / 100;
        break;
      }
    }
  }
  
  // Extract employees
  for (const pattern of EMPLOYEE_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      const employees = parseInt(match[1].replace(/,/g, ''), 10);
      if (employees > 0 && employees < 100000) {
        result.full_time_employees = employees;
        break;
      }
    }
  }

  // Extract location count per spec
  for (const pattern of LOCATION_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      const count = parseInt(match[1], 10);
      if (count > 0 && count < 1000) {
        result.number_of_locations = count;
        break;
      }
    }
  }

  // Handle "multiple locations" inference per spec
  if (!result.number_of_locations) {
    if (/multiple\s+locations?/i.test(text)) {
      result.number_of_locations = 3;
    } else if (/several\s+locations?/i.test(text)) {
      result.number_of_locations = 4;
    }
  }

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { dealId, notesText } = await req.json();

    if (!dealId) {
      return new Response(
        JSON.stringify({ error: 'Missing dealId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch deal data
    const { data: deal, error: dealError } = await supabase
      .from('listings')
      .select('*, extraction_sources')
      .eq('id', dealId)
      .single();

    if (dealError || !deal) {
      return new Response(
        JSON.stringify({ error: 'Deal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use provided notes or deal's internal_notes/owner_notes
    const notes = notesText || deal.internal_notes || deal.owner_notes || '';
    
    if (!notes || notes.length < 20) {
      return new Response(
        JSON.stringify({ error: 'No notes content to analyze' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing notes for deal ${dealId}, length: ${notes.length}`);

    // Step 1: Pre-extraction with regex
    const regexExtracted = extractWithRegex(notes);
    const geographyFromNotes = extractStatesFromText(notes);
    
    console.log('Regex pre-extraction:', regexExtracted);
    console.log('Geography from notes:', geographyFromNotes);

    // Step 2: AI extraction for complex fields
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    
    let aiExtracted: Record<string, unknown> = {};
    
    if (geminiApiKey) {
      const systemPrompt = `You are an M&A analyst extracting comprehensive deal intelligence from internal notes.

Extract ALL available information including:
- Business fundamentals (name, description, services, industries)
- Owner/seller information and motivations
- Financial data and deal structure
- Operational details (employees, locations, geography)
- Customer information and market position
- Timeline, requirements, and risk factors
- Contact information and next steps

Be thorough and extract every piece of structured data available.`;

      const userPrompt = `Analyze these deal notes and extract ALL key information:

${notes.substring(0, 50000)}

Extract the relevant information using the provided tool. Be comprehensive - extract every detail available.`;

      try {
        const aiResponse = await fetch(GEMINI_API_URL, {
          method: 'POST',
          headers: getGeminiHeaders(geminiApiKey),
          body: JSON.stringify({
            model: DEFAULT_GEMINI_MODEL,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            tools: [{
              type: 'function',
              function: {
                name: 'extract_notes_intelligence',
                description: 'Extract comprehensive deal intelligence from internal notes',
                parameters: {
                  type: 'object',
                  properties: {
                    // Business Fundamentals
                    internal_company_name: { type: 'string', description: 'Company/business name' },
                    description: { type: 'string', description: 'Business description and what they do' },
                    executive_summary: { type: 'string', description: 'Executive summary of the business' },
                    services_offered: { type: 'string', description: 'Services or products offered (comma-separated if multiple)' },
                    category: { type: 'string', description: 'Primary business category or industry' },

                    // Owner/Seller Information
                    owner_name: { type: 'string', description: 'Owner or contact person name' },
                    owner_goals: { type: 'string', description: 'Owner goals and motivations for selling' },
                    transition_preferences: { type: 'string', description: 'Transition timeline and preferences' },
                    special_requirements: { type: 'string', description: 'Deal breakers or must-haves' },

                    // Timeline & Urgency
                    timeline_notes: { type: 'string', description: 'Timeline and urgency notes' },
                    expected_close_date: { type: 'string', description: 'Expected close date if mentioned' },

                    // Operational Details
                    full_time_employees: { type: 'number', description: 'Number of full-time employees' },
                    number_of_locations: { type: 'number', description: 'Number of physical locations/offices/branches' },
                    geographic_states: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'US states where business operates (2-letter codes)'
                    },

                    // Customer Information
                    customer_types: { type: 'string', description: 'Customer types and segments served' },
                    customer_concentration: { type: 'string', description: 'Customer concentration and top customer info' },
                    competitive_position: { type: 'string', description: 'Competitive advantages and market position' },

                    // Risk & Concerns
                    key_risks: { type: 'string', description: 'Risk factors, concerns, or red flags' },

                    // Financial Details
                    financial_notes: { type: 'string', description: 'Notes about financial data, quality, or concerns' },
                    financial_followup_questions: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Questions to clarify financials if data is unclear'
                    },

                    // Contact & Next Steps
                    contact_name: { type: 'string', description: 'Primary contact name' },
                    contact_email: { type: 'string', description: 'Contact email address' },
                    contact_phone: { type: 'string', description: 'Contact phone number' },
                    next_steps: { type: 'string', description: 'Next steps or action items mentioned' },
                  }
                }
              }
            }],
            tool_choice: { type: 'function', function: { name: 'extract_notes_intelligence' } }
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            aiExtracted = JSON.parse(toolCall.function.arguments);
          }
        }
      } catch (e) {
        console.error('AI extraction error:', e);
      }
    }

    // Merge regex and AI extractions
    const extracted: Record<string, unknown> = {
      ...aiExtracted,
      ...regexExtracted, // Regex takes precedence for numeric values per spec
    };

    // Normalize geographic_states
    if (extracted.geographic_states) {
      extracted.geographic_states = normalizeStates(extracted.geographic_states as string[]);
    }
    
    // Merge with geography from text
    if (geographyFromNotes.length > 0) {
      extracted.geographic_states = mergeStates(
        extracted.geographic_states as string[] | undefined,
        geographyFromNotes
      );
    }

    // Build priority-aware updates
    const { updates, sourceUpdates } = buildPriorityUpdates(
      deal,
      deal.extraction_sources,
      extracted,
      'notes'
    );

    // Add notes_analyzed_at
    const finalUpdates: Record<string, unknown> = {
      ...updates,
      notes_analyzed_at: new Date().toISOString(),
      extraction_sources: updateExtractionSources(deal.extraction_sources, sourceUpdates),
    };

    // Merge geographic states if both exist
    if (updates.geographic_states && deal.geographic_states?.length > 0) {
      finalUpdates.geographic_states = mergeStates(
        deal.geographic_states,
        updates.geographic_states as string[]
      );
    }

    const { error: updateError } = await supabase
      .from('listings')
      .update(finalUpdates)
      .eq('id', dealId);

    if (updateError) {
      console.error('Update error:', updateError);
      throw updateError;
    }

    const fieldsUpdated = Object.keys(updates);
    console.log(`Updated ${fieldsUpdated.length} fields from notes:`, fieldsUpdated);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Analyzed notes and updated ${fieldsUpdated.length} fields`,
        fieldsUpdated,
        extracted,
        regexFindings: regexExtracted,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-deal-notes:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
