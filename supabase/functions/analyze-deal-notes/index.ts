import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeStates, extractStatesFromText, mergeStates } from "../_shared/geography.ts";
import { buildPriorityUpdates, updateExtractionSources } from "../_shared/source-priority.ts";
import { callGeminiWithRetry, GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../_shared/ai-providers.ts";

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
    const notes = notesText || deal.general_notes || deal.internal_notes || deal.owner_notes || '';
    
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
    // Try direct Gemini first, fall back to Lovable AI Gateway
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    let aiExtracted: Record<string, unknown> = {};
    
    if (geminiApiKey || lovableApiKey) {
      const systemPrompt = `You are an elite M&A analyst extracting EVERY piece of deal intelligence from internal notes, call summaries, and broker memos.

RULES:
1. Extract EXHAUSTIVELY — capture every detail mentioned, no matter how minor.
2. Accuracy over completeness — never fabricate or infer data not explicitly stated.
3. Numbers as raw integers (e.g., 5000000 not "5M").
4. US states as 2-letter codes (e.g., "TX", "AZ").
5. Key quotes must be VERBATIM from the notes — include speaker attribution if available.
6. For services, describe the business model and service mix in 2-4 sentences, not just a list.
7. Growth trajectory should describe the trend (e.g., "Increasing revenue growth at all locations").
8. Financial notes should capture EBITDA status, revenue breakdowns, margin info — even if incomplete.
9. Capture management/team details, expansion potential, valuation context, and technology/systems.`;

      const userPrompt = `Extract ALL deal intelligence from these notes. Be exhaustive — every detail matters for buyer matching:

${notes.substring(0, 15000)}

Use the tool to return structured data.`;

      const toolDef = {
        type: 'function',
        function: {
          name: 'extract_notes_intelligence',
          description: 'Extract comprehensive deal intelligence from internal notes',
          parameters: {
            type: 'object',
            properties: {
              owner_goals: { type: 'string', description: 'Owner goals and motivations for selling. Empty string if not mentioned.' },
              ownership_structure: { type: 'string', description: 'Ownership structure (sole owner, partnership, family-owned). Empty string if not mentioned.' },
              transition_preferences: { type: 'string', description: 'Transition timeline, preferences, management continuity plans. Empty string if not mentioned.' },
              seller_motivation: { type: 'string', description: 'Why the seller wants to sell, urgency level. Empty string if not mentioned.' },
              special_requirements: { type: 'string', description: 'Deal breakers, must-haves, valuation expectations. Empty string if not mentioned.' },
              timeline_notes: { type: 'string', description: 'Timeline and urgency notes. Empty string if not mentioned.' },
              description: { type: 'string', description: 'Business description — what the company does, model, market position (2-4 sentences). Empty string if not mentioned.' },
              services: { type: 'array', items: { type: 'string' }, description: 'List of specific services offered. Empty array if not mentioned.' },
              service_mix: { type: 'string', description: 'Service mix and revenue model in detail (2-4 sentences). Empty string if not mentioned.' },
              industry: { type: 'string', description: 'Industry vertical (e.g., "Automotive Repair"). Empty string if not mentioned.' },
              customer_types: { type: 'string', description: 'Customer types and segments served. Empty string if not mentioned.' },
              competitive_position: { type: 'string', description: 'Competitive advantages, differentiators. Empty string if not mentioned.' },
              geographic_states: { type: 'array', items: { type: 'string' }, description: 'US states where business operates (2-letter codes). Empty array if not mentioned.' },
              location: { type: 'string', description: 'Primary location/HQ (city, state format). Empty string if not mentioned.' },
              number_of_locations: { type: 'number', description: 'Total physical locations. 0 if not mentioned.' },
              financial_notes: { type: 'string', description: 'Detailed financial notes — revenue breakdown by segment/location, EBITDA status, margins, growth rates, addbacks, caveats. Empty string if not mentioned.' },
              growth_trajectory: { type: 'string', description: 'Revenue/business growth trend. Empty string if not mentioned.' },
              revenue_trend: { type: 'string', description: 'Revenue trend: "growing", "stable", or "declining". Empty string if not mentioned.' },
              management_depth: { type: 'string', description: 'Management team details, key personnel. Empty string if not mentioned.' },
              has_management_team: { type: 'boolean', description: 'Whether management team exists beyond owner.' },
              key_risks: { type: 'array', items: { type: 'string' }, description: 'Risk factors, concerns, red flags. Empty array if not mentioned.' },
              key_quotes: { type: 'array', items: { type: 'string' }, description: 'VERBATIM notable quotes from the notes. Empty array if none.' },
              growth_drivers: { type: 'array', items: { type: 'string' }, description: 'Growth opportunities and expansion potential. Empty array if not mentioned.' },
              real_estate_info: { type: 'string', description: 'Real estate details — owned vs leased. Empty string if not mentioned.' },
              technology_systems: { type: 'string', description: 'Technology/software/systems used. Empty string if not mentioned.' },
            },
            required: [
              'owner_goals', 'ownership_structure', 'transition_preferences', 'special_requirements',
              'description', 'services', 'industry', 'customer_types', 'competitive_position',
              'geographic_states', 'location', 'number_of_locations',
              'financial_notes', 'growth_trajectory', 'management_depth', 'has_management_team',
              'key_risks', 'key_quotes', 'growth_drivers'
            ]
          }
        }
      };

      const requestBody = {
        model: DEFAULT_GEMINI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [toolDef],
        tool_choice: { type: 'function', function: { name: 'extract_notes_intelligence' } }
      };

      const parseToolResponse = (aiData: any): Record<string, unknown> | null => {
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          return JSON.parse(typeof toolCall.function.arguments === 'string' ? toolCall.function.arguments : JSON.stringify(toolCall.function.arguments));
        }
        return null;
      };

      let aiSuccess = false;

      // Attempt 1: Direct Gemini API
      if (geminiApiKey && !aiSuccess) {
        try {
          const aiResponse = await callGeminiWithRetry(
            GEMINI_API_URL,
            getGeminiHeaders(geminiApiKey),
            requestBody,
            90000,
            'Gemini/notes-extract'
          );

          if (aiResponse.ok) {
            const parsed = parseToolResponse(await aiResponse.json());
            if (parsed) {
              aiExtracted = parsed;
              aiSuccess = true;
              console.log('[AI] Direct Gemini succeeded');
            }
          } else {
            const errText = await aiResponse.text();
            console.warn('[AI] Direct Gemini failed:', aiResponse.status, errText.slice(0, 200));
          }
        } catch (e) {
          console.warn('[AI] Direct Gemini error:', e instanceof Error ? e.message : e);
        }
      }

      // Attempt 2: Lovable AI Gateway fallback
      if (!aiSuccess && lovableApiKey) {
        try {
          console.log('[AI] Falling back to Lovable AI Gateway...');
          const gatewayBody = { ...requestBody, model: 'google/gemini-2.5-flash' };
          const aiResponse = await callGeminiWithRetry(
            'https://ai.gateway.lovable.dev/v1/chat/completions',
            { Authorization: `Bearer ${lovableApiKey}`, 'Content-Type': 'application/json' },
            gatewayBody,
            90000,
            'LovableAI/notes-extract'
          );

          if (aiResponse.ok) {
            const parsed = parseToolResponse(await aiResponse.json());
            if (parsed) {
              aiExtracted = parsed;
              aiSuccess = true;
              console.log('[AI] Lovable AI Gateway succeeded');
            }
          } else {
            const errText = await aiResponse.text();
            console.error('[AI] Lovable AI Gateway failed:', aiResponse.status, errText.slice(0, 200));
          }
        } catch (e) {
          console.error('[AI] Lovable AI Gateway error:', e instanceof Error ? e.message : e);
        }
      }

      if (!aiSuccess) {
        console.warn('[AI] All AI providers failed — using regex-only extraction');
      } else {
        console.log('AI extracted fields:', Object.keys(aiExtracted).filter(k => {
          const v = aiExtracted[k];
          return v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
        }));
      }
    }

    // Post-process: key_risks and growth_drivers are JSONB in DB
    // Wrap arrays so they serialize correctly
    if (aiExtracted.key_risks && Array.isArray(aiExtracted.key_risks)) {
      // DB stores as Json, keep as array — Supabase handles serialization
    }
    if (aiExtracted.growth_drivers && Array.isArray(aiExtracted.growth_drivers)) {
      // Same — keep as array
    }

    // Strip empty/null values from AI extraction
    for (const [k, v] of Object.entries(aiExtracted)) {
      if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) {
        delete aiExtracted[k];
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
