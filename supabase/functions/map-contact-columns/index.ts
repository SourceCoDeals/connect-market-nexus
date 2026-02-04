import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AVAILABLE_FIELDS = [
  { name: 'name', description: 'Full name of the contact' },
  { name: 'title', description: 'Job title or role' },
  { name: 'company_type', description: 'PE Firm or Platform Company' },
  { name: 'email', description: 'Email address' },
  { name: 'phone', description: 'Phone number' },
  { name: 'linkedin_url', description: 'LinkedIn profile URL' },
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

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      // Fall back to heuristic matching
      const mappings = heuristicMapping(headers);
      return new Response(
        JSON.stringify({ success: true, method: 'heuristic', mappings }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are a CSV column mapping expert for contact data imports.

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
- Consider common variations (e.g., "Full Name" -> "name", "LinkedIn" -> "linkedin_url")`;

    let sampleContext = '';
    if (sampleRows && sampleRows.length > 0) {
      sampleContext = `\n\nSample data (first 3 rows):\n${sampleRows.slice(0, 3).map((row: string[], i: number) => 
        `Row ${i + 1}: ${row.join(' | ')}`
      ).join('\n')}`;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: `Map these CSV headers to contact fields:\n\nHeaders: ${headers.join(', ')}${sampleContext}`
          }
        ],
        system: systemPrompt,
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
    const content = result.content?.[0]?.text || '';

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
    console.error('Error in map-contact-columns:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function heuristicMapping(headers: string[]): Record<string, string> {
  const mappings: Record<string, string> = {};
  
  const patterns: Record<string, RegExp> = {
    name: /^(full\s*)?name$|^contact(\s*name)?$/i,
    title: /title|role|position|job/i,
    company_type: /company\s*type|type|entity/i,
    email: /e-?mail|email\s*address/i,
    phone: /phone|tel|mobile|cell/i,
    linkedin_url: /linkedin|li\s*url|profile/i,
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
