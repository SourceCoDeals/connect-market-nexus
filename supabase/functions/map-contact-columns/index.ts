import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Contact fields that can be mapped from CSV
const CONTACT_FIELDS = [
  { key: 'name', label: 'Contact Name', description: 'Full name of the contact person' },
  { key: 'title', label: 'Title/Role', description: 'Job title or position' },
  { key: 'company_type', label: 'Company (Platform/PE)', description: 'Whether they work at Platform company or PE Firm' },
  { key: 'email', label: 'Email', description: 'Email address' },
  { key: 'phone', label: 'Phone', description: 'Phone number' },
  { key: 'linkedin_url', label: 'LinkedIn', description: 'Personal LinkedIn profile URL' },
  { key: 'skip', label: 'Skip (Do Not Import)', description: 'Ignore this column' },
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client for auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { headers, sampleRows } = await req.json();

    if (!headers || !Array.isArray(headers)) {
      return new Response(JSON.stringify({ error: 'Headers required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      console.error('ANTHROPIC_API_KEY not configured');
      return new Response(JSON.stringify({ 
        error: 'Anthropic API key not configured',
        mapping: createFallbackMapping(headers),
        availableFields: CONTACT_FIELDS
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build prompt for AI
    const prompt = `You are analyzing CSV column headers to map them to contact database fields.

Available database fields:
${CONTACT_FIELDS.map(f => `- ${f.key}: ${f.label} - ${f.description}`).join('\n')}

CSV Headers to analyze:
${headers.map((h, i) => `${i + 1}. "${h}"`).join('\n')}

${sampleRows?.length ? `Sample data from first row:\n${headers.map((h, i) => `"${h}": "${sampleRows[0]?.[i] || ''}"`).join('\n')}` : ''}

For each CSV header, determine the best matching database field. Consider:
- "Name", "Full Name", "Contact Name", "Person" → name
- "Title", "Role", "Position", "Job Title" → title
- "Company Type", "Works At", "Organization Type", "Platform/PE" → company_type
- "Email", "E-mail", "Email Address" → email
- "Phone", "Mobile", "Cell", "Telephone", "Phone Number" → phone
- "LinkedIn", "LinkedIn URL", "LinkedIn Profile", "LI" → linkedin_url
- Irrelevant columns → skip

Return ONLY a JSON object mapping each CSV header to a field key, like:
{"Header 1": "name", "Header 2": "email", ...}`;

    console.log('Calling Claude for contact column mapping');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      return new Response(JSON.stringify({ 
        error: 'Claude API error',
        mapping: createFallbackMapping(headers),
        availableFields: CONTACT_FIELDS
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';
    
    console.log('Claude response:', content);

    // Parse the JSON response
    let mapping: Record<string, string> = {};
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        mapping = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      mapping = createFallbackMapping(headers);
    }

    // Validate mapping - ensure all headers have a value
    headers.forEach(header => {
      if (!mapping[header] || !CONTACT_FIELDS.some(f => f.key === mapping[header])) {
        mapping[header] = 'skip';
      }
    });

    return new Response(JSON.stringify({ 
      mapping, 
      availableFields: CONTACT_FIELDS 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in map-contact-columns:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Fallback mapping using basic string matching
function createFallbackMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  
  headers.forEach(header => {
    const lowerHeader = header.toLowerCase();
    
    if (lowerHeader.includes('name') && !lowerHeader.includes('company')) {
      mapping[header] = 'name';
    } else if (lowerHeader.includes('title') || lowerHeader.includes('role') || lowerHeader.includes('position')) {
      mapping[header] = 'title';
    } else if (lowerHeader.includes('email') || lowerHeader.includes('e-mail')) {
      mapping[header] = 'email';
    } else if (lowerHeader.includes('phone') || lowerHeader.includes('mobile') || lowerHeader.includes('cell')) {
      mapping[header] = 'phone';
    } else if (lowerHeader.includes('linkedin') || lowerHeader === 'li') {
      mapping[header] = 'linkedin_url';
    } else if (lowerHeader.includes('company') || lowerHeader.includes('platform') || lowerHeader.includes('pe')) {
      mapping[header] = 'company_type';
    } else {
      mapping[header] = 'skip';
    }
  });
  
  return mapping;
}
