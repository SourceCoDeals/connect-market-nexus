import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../_shared/ai-providers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AVAILABLE_FIELDS = [
  { name: 'deal_name', description: 'Name of the deal or company' },
  { name: 'company_website', description: 'Company website URL' },
  { name: 'company_address', description: 'Company physical address' },
  { name: 'transcript_link', description: 'Link to call transcript or notes' },
  { name: 'contact_email', description: 'Primary contact email' },
  { name: 'skip', description: 'Column should be ignored' }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { headers, sampleRows } = await req.json();

    if (!headers || !Array.isArray(headers)) {
      return new Response(
        JSON.stringify({ error: 'headers array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      const mappings = heuristicMapping(headers);
      return new Response(
        JSON.stringify({ success: true, method: 'heuristic', mappings }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are a CSV column mapping expert for deal/company data imports in M&A context.

Available fields to map to:
${AVAILABLE_FIELDS.map(f => `- ${f.name}: ${f.description}`).join('\n')}

Return JSON only - an object mapping each input header to the best matching field:
{
  "Header Name": "field_name",
  "Another Header": "skip"
}

Rules:
- Each input header must be mapped to exactly one field
- Use "skip" for columns that don't match any field
- Be case-insensitive when matching
- Consider common variations (e.g., "Company" -> "deal_name", "Website" -> "company_website")`;

    let sampleContext = '';
    if (sampleRows && sampleRows.length > 0) {
      sampleContext = `\n\nSample data (first 3 rows):\n${sampleRows.slice(0, 3).map((row: string[], i: number) => 
        `Row ${i + 1}: ${row.join(' | ')}`
      ).join('\n')}`;
    }

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: getGeminiHeaders(GEMINI_API_KEY),
      body: JSON.stringify({
        model: DEFAULT_GEMINI_MODEL,
        max_tokens: 1000,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Map these CSV headers to deal fields:\n\nHeaders: ${headers.join(', ')}${sampleContext}`
          }
        ],
      }),
    });

    if (!response.ok) {
      const mappings = heuristicMapping(headers);
      return new Response(
        JSON.stringify({ success: true, method: 'heuristic', mappings }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const mappings = JSON.parse(jsonMatch[0]);
      return new Response(
        JSON.stringify({ success: true, method: 'ai', mappings }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mappings = heuristicMapping(headers);
    return new Response(
      JSON.stringify({ success: true, method: 'heuristic', mappings }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in map-deal-csv-columns:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function heuristicMapping(headers: string[]): Record<string, string> {
  const mappings: Record<string, string> = {};
  
  const patterns: Record<string, RegExp> = {
    deal_name: /^(deal|company|business|target)(\s*name)?$|^name$/i,
    company_website: /website|url|site|web/i,
    company_address: /address|location|city|state/i,
    transcript_link: /transcript|notes|call|recording/i,
    contact_email: /contact|email|e-?mail/i,
  };

  for (const header of headers) {
    let matched = false;
    for (const [field, pattern] of Object.entries(patterns)) {
      if (pattern.test(header)) {
        mappings[header] = field;
        matched = true;
        break;
      }
    }
    if (!matched) {
      mappings[header] = 'skip';
    }
  }

  return mappings;
}
