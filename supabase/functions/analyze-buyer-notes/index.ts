import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeStates, extractStatesFromText, mergeStates } from "../_shared/geography.ts";
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../_shared/ai-providers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Pre-extraction regex patterns
const REVENUE_PATTERNS = [
  /\$\s*([\d,.]+)\s*(M|MM|m|million|mil)/gi,
  /revenue[:\s]+\$?\s*([\d,.]+)\s*(M|MM|m|million|mil)?/gi,
  /([\d,.]+)\s*(M|MM|million)\s*(?:in\s+)?(?:revenue|sales)/gi,
  /target[:\s]+\$?([\d,.]+)\s*(?:-|to)\s*\$?([\d,.]+)\s*(M|MM|m|million)/gi,
];

const EBITDA_PATTERNS = [
  /EBITDA[:\s]+\$?\s*([\d,.]+)\s*(K|k|M|MM|m|thousand|million)?/gi,
  /\$\s*([\d,.]+)\s*(K|k|M|MM)?\s*EBITDA/gi,
  /cash\s*flow[:\s]+\$?\s*([\d,.]+)\s*(K|k|M|MM|m|thousand|million)?/gi,
  /SDE[:\s]+\$?\s*([\d,.]+)\s*(K|k|M|MM|m|thousand|million)?/gi,
];

const ACQUISITION_PATTERNS = [
  /(\d+)\s+(?:total\s+)?acquisitions?/gi,
  /acquired\s+(\d+)\s+(?:companies|businesses)/gi,
  /(\d+)\s+deals?\s+(?:completed|done)/gi,
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
  min_revenue?: number;
  max_revenue?: number;
  min_ebitda?: number;
  max_ebitda?: number;
  total_acquisitions?: number;
  target_geographies?: string[];
} {
  const result: any = {};

  // Extract revenue range
  const revenueMatches: number[] = [];
  for (const pattern of REVENUE_PATTERNS) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = parseNumberValue(match[1], match[2]);
      if (value && value > 100000) {
        revenueMatches.push(value);
      }
    }
  }
  if (revenueMatches.length > 0) {
    result.min_revenue = Math.min(...revenueMatches) / 1000000; // Store as millions
    result.max_revenue = Math.max(...revenueMatches) / 1000000;
  }

  // Extract EBITDA range
  const ebitdaMatches: number[] = [];
  for (const pattern of EBITDA_PATTERNS) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = parseNumberValue(match[1], match[2]);
      if (value && value > 10000) {
        ebitdaMatches.push(value);
      }
    }
  }
  if (ebitdaMatches.length > 0) {
    result.min_ebitda = Math.min(...ebitdaMatches) / 1000000; // Store as millions
    result.max_ebitda = Math.max(...ebitdaMatches) / 1000000;
  }

  // Extract acquisition count
  for (const pattern of ACQUISITION_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      const count = parseInt(match[1], 10);
      if (count > 0 && count < 1000) {
        result.total_acquisitions = count;
        break;
      }
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

    const { buyerId, notesText } = await req.json();

    if (!buyerId) {
      return new Response(
        JSON.stringify({ error: 'Missing buyerId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch buyer data
    const { data: buyer, error: buyerError } = await supabase
      .from('remarketing_buyers')
      .select('*')
      .eq('id', buyerId)
      .single();

    if (buyerError || !buyer) {
      return new Response(
        JSON.stringify({ error: 'Buyer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use provided notes or buyer's notes field
    const notes = notesText || buyer.notes || '';

    if (!notes || notes.length < 20) {
      return new Response(
        JSON.stringify({ error: 'No notes content to analyze' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing notes for buyer ${buyerId}, length: ${notes.length}`);

    // Step 1: Pre-extraction with regex
    const regexExtracted = extractWithRegex(notes);
    const geographyFromNotes = extractStatesFromText(notes);

    console.log('Regex pre-extraction:', regexExtracted);
    console.log('Geography from notes:', geographyFromNotes);

    // Step 2: AI extraction for complex fields
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    let aiExtracted: Record<string, unknown> = {};

    if (geminiApiKey) {
      const systemPrompt = `You are an M&A analyst extracting comprehensive buyer intelligence from internal notes.

Extract ALL available information including:
- Buyer identity and company information
- Investment criteria and preferences
- Geographic and service focus
- Acquisition strategy and history
- Business model and operations
- Contact information and next steps

Be thorough and extract every piece of structured data available.`;

      const userPrompt = `Analyze these buyer notes and extract ALL key information:

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
                name: 'extract_buyer_intelligence',
                description: 'Extract comprehensive buyer intelligence from internal notes',
                parameters: {
                  type: 'object',
                  properties: {
                    // Buyer Identity
                    pe_firm_name: { type: 'string', description: 'PE firm name if platform company' },
                    platform_company_name: { type: 'string', description: 'Platform company name if applicable' },
                    buyer_type: {
                      type: 'string',
                      enum: ['pe_firm', 'platform', 'strategic', 'family_office', 'other'],
                      description: 'Type of buyer'
                    },

                    // Business Information
                    business_summary: { type: 'string', description: 'Summary of buyer business and what they do' },
                    industry_vertical: { type: 'string', description: 'Primary industry vertical or sector' },
                    specialized_focus: { type: 'string', description: 'Specialized focus or niche' },
                    services_offered: { type: 'string', description: 'Services offered by the buyer company' },
                    business_model: { type: 'string', description: 'Business model description' },

                    // Investment Criteria - Size
                    min_revenue: { type: 'number', description: 'Minimum target revenue in millions' },
                    max_revenue: { type: 'number', description: 'Maximum target revenue in millions' },
                    revenue_sweet_spot: { type: 'number', description: 'Ideal revenue target in millions' },
                    min_ebitda: { type: 'number', description: 'Minimum target EBITDA in millions' },
                    max_ebitda: { type: 'number', description: 'Maximum target EBITDA in millions' },
                    ebitda_sweet_spot: { type: 'number', description: 'Ideal EBITDA target in millions' },

                    // Investment Criteria - Geography
                    target_geographies: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Target geographic regions or states (2-letter codes for US states)'
                    },
                    geographic_exclusions: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Geographic areas to avoid'
                    },

                    // Investment Criteria - Services & Industries
                    target_services: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Target service types they want to acquire'
                    },
                    target_industries: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Target industries or sectors'
                    },
                    industry_exclusions: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Industries to avoid'
                    },

                    // Thesis & Strategy
                    thesis_summary: { type: 'string', description: 'Investment thesis and strategy summary' },
                    strategic_priorities: { type: 'string', description: 'Strategic priorities and focus areas' },
                    service_mix_prefs: { type: 'string', description: 'Service mix preferences' },
                    business_model_prefs: { type: 'string', description: 'Preferred business models' },
                    deal_breakers: { type: 'string', description: 'Deal breakers or must-avoid criteria' },

                    // Acquisition Strategy
                    acquisition_appetite: {
                      type: 'string',
                      enum: ['Active', 'Selective', 'Opportunistic'],
                      description: 'Current acquisition appetite'
                    },
                    acquisition_frequency: { type: 'string', description: 'How often they acquire (e.g., "2-3 per year")' },
                    total_acquisitions: { type: 'number', description: 'Total number of acquisitions completed' },
                    addon_only: { type: 'boolean', description: 'Only interested in add-on acquisitions' },
                    platform_only: { type: 'boolean', description: 'Only interested in platform deals' },

                    // Location Information
                    hq_city: { type: 'string', description: 'Headquarters city' },
                    hq_state: { type: 'string', description: 'Headquarters state (2-letter code)' },
                    hq_country: { type: 'string', description: 'Headquarters country' },

                    // Contact Information
                    contact_name: { type: 'string', description: 'Primary contact name' },
                    contact_email: { type: 'string', description: 'Contact email address' },
                    contact_phone: { type: 'string', description: 'Contact phone number' },
                    contact_role: { type: 'string', description: 'Contact person role/title' },

                    // Additional Notes
                    key_quotes: { type: 'string', description: 'Important quotes or statements from calls/meetings' },
                    next_steps: { type: 'string', description: 'Next steps or action items' },
                  }
                }
              }
            }],
            tool_choice: { type: 'function', function: { name: 'extract_buyer_intelligence' } }
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

    // Merge regex and AI extractions (regex takes precedence for numeric values)
    const extracted: Record<string, unknown> = {
      ...aiExtracted,
      ...regexExtracted,
    };

    // Normalize geographic_states
    if (extracted.target_geographies) {
      const normalized = normalizeStates(extracted.target_geographies as string[]);
      if (normalized.length > 0) {
        extracted.target_geographies = normalized;
      }
    }

    // Merge with geography from text
    if (geographyFromNotes.length > 0) {
      extracted.target_geographies = mergeStates(
        extracted.target_geographies as string[] | undefined,
        geographyFromNotes
      );
    }

    // Build update object
    const updates: Record<string, unknown> = {};

    // Map extracted fields to buyer table columns
    const fieldMapping: Record<string, string> = {
      pe_firm_name: 'pe_firm_name',
      platform_company_name: 'platform_company_name',
      buyer_type: 'buyer_type',
      business_summary: 'business_summary',
      industry_vertical: 'industry_vertical',
      specialized_focus: 'specialized_focus',
      services_offered: 'services_offered',
      business_model: 'business_model',
      min_revenue: 'min_revenue',
      max_revenue: 'max_revenue',
      revenue_sweet_spot: 'revenue_sweet_spot',
      min_ebitda: 'min_ebitda',
      max_ebitda: 'max_ebitda',
      ebitda_sweet_spot: 'ebitda_sweet_spot',
      target_geographies: 'target_geographies',
      geographic_exclusions: 'geographic_exclusions',
      target_services: 'target_services',
      target_industries: 'target_industries',
      industry_exclusions: 'industry_exclusions',
      thesis_summary: 'thesis_summary',
      strategic_priorities: 'strategic_priorities',
      service_mix_prefs: 'service_mix_prefs',
      business_model_prefs: 'business_model_prefs',
      deal_breakers: 'deal_breakers',
      acquisition_appetite: 'acquisition_appetite',
      acquisition_frequency: 'acquisition_frequency',
      total_acquisitions: 'total_acquisitions',
      addon_only: 'addon_only',
      platform_only: 'platform_only',
      hq_city: 'hq_city',
      hq_state: 'hq_state',
      hq_country: 'hq_country',
      key_quotes: 'key_quotes',
    };

    for (const [extractedKey, dbColumn] of Object.entries(fieldMapping)) {
      if (extracted[extractedKey] !== undefined && extracted[extractedKey] !== null) {
        // Only update if current value is null/empty or new value is more complete
        const currentValue = buyer[dbColumn];
        const newValue = extracted[extractedKey];

        if (!currentValue ||
            (Array.isArray(newValue) && newValue.length > 0) ||
            (typeof newValue === 'string' && newValue.length > 0) ||
            (typeof newValue === 'number' && newValue > 0) ||
            typeof newValue === 'boolean') {
          updates[dbColumn] = newValue;
        }
      }
    }

    // Handle contact information separately (store in buyer_contacts table if provided)
    const contactInfo: any = {};
    if (extracted.contact_name) contactInfo.name = extracted.contact_name;
    if (extracted.contact_email) contactInfo.email = extracted.contact_email;
    if (extracted.contact_phone) contactInfo.phone = extracted.contact_phone;
    if (extracted.contact_role) contactInfo.role = extracted.contact_role;

    if (Object.keys(contactInfo).length > 0 && contactInfo.name) {
      // Create or update contact record
      const { data: existingContact } = await supabase
        .from('remarketing_buyer_contacts')
        .select('id')
        .eq('buyer_id', buyerId)
        .eq('is_primary', true)
        .single();

      if (existingContact) {
        await supabase
          .from('remarketing_buyer_contacts')
          .update(contactInfo)
          .eq('id', existingContact.id);
      } else {
        await supabase
          .from('remarketing_buyer_contacts')
          .insert({
            buyer_id: buyerId,
            is_primary: true,
            ...contactInfo,
          });
      }
    }

    // Add timestamp
    updates.notes_analyzed_at = new Date().toISOString();
    updates.data_last_updated = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('remarketing_buyers')
      .update(updates)
      .eq('id', buyerId);

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
        contactCreated: Object.keys(contactInfo).length > 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-buyer-notes:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
