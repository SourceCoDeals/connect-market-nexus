import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEAL_FIELDS = [
  { key: 'deal_name', label: 'Company Name', description: 'The company or deal name' },
  { key: 'company_website', label: 'Website', description: 'Company website URL' },
  { key: 'company_address', label: 'Address', description: 'Company street address or location' },
  { key: 'transcript_link', label: 'Fireflies Link', description: 'Link to Fireflies transcript or call recording' },
  { key: 'additional_info', label: 'Deal Notes', description: 'Internal notes about the deal - map multiple columns here and they will be combined', multiColumn: true },
  { key: 'company_overview', label: 'Company Description', description: 'AI or public description of the company business' },
  { key: 'contact_first_name', label: 'Owner First Name', description: 'Owner/contact first name' },
  { key: 'contact_last_name', label: 'Owner Last Name', description: 'Owner/contact last name' },
  { key: 'contact_title', label: 'Owner Title', description: 'Owner/contact job title or position' },
  { key: 'contact_email', label: 'Owner Email', description: 'Owner/contact email address' },
  { key: 'contact_phone', label: 'Owner Cell Phone', description: 'Owner/contact phone or cell number' },
  { key: 'skip', label: 'Skip (Do Not Import)', description: 'Do not import this column' },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { headers, sampleRows } = await req.json();

    const fieldsDescription = DEAL_FIELDS.map(f => `- "${f.key}": ${f.label} - ${f.description}`).join('\n');

    const prompt = `You are a data mapping assistant. Map CSV column headers to the available deal fields.

AVAILABLE FIELDS (you can ONLY use these):
${fieldsDescription}

CSV HEADERS TO MAP:
${headers.join(', ')}

SAMPLE DATA (first 3 rows):
${sampleRows.slice(0, 3).map((row: string[]) => row.join(' | ')).join('\n')}

MAPPING RULES (ORDER MATTERS - CHECK SPECIFIC PATTERNS FIRST):
- "AI Description", "Company Description", "Business Description", "Overview" → company_overview
- "Description" alone (without "AI" or "Company") → company_overview
- "Company", "Name", "Deal", "Target", "Business" (when column is about the company name, not description) → deal_name
- "Website", "URL", "Site", "Web" → company_website
- "Address", "Location", "Street", "City", "HQ", "Headquarters" → company_address
- "Fireflies", "Transcript", "Recording", "Call Link", "Meeting Link" → transcript_link
- "First Name", "First", "Given Name", "Owner First" → contact_first_name
- "Last Name", "Last", "Surname", "Family Name", "Owner Last" → contact_last_name
- "Title", "Position", "Role", "Job Title" → contact_title
- "Email", "E-mail", "Contact Email", "Owner Email" → contact_email
- "Phone", "Cell", "Mobile", "Telephone", "Cell Phone" → contact_phone
- ANY column with "Notes", "Comments", "Remarks", "Details", "Info" → additional_info (MULTIPLE COLUMNS CAN MAP HERE - they will be combined)
- EVERYTHING ELSE → skip

IMPORTANT: Multiple columns CAN be mapped to "additional_info" - map ALL notes/comments columns to it.

Return a JSON object where keys are the CSV column headers and values are the matching field keys.
Example: {"Company Name": "deal_name", "Internal Notes": "additional_info", "Comments": "additional_info", "Random Column": "skip"}

IMPORTANT: Only return the JSON object, nothing else.`;

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

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
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '{}';

    let mapping: Record<string, string>;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      mapping = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      // Fallback: try basic matching with priority order
      mapping = {};
      for (const header of headers) {
        const lower = header.toLowerCase();
        
        // Check specific patterns first (higher priority)
        if (lower.includes('ai') && lower.includes('description')) {
          mapping[header] = 'company_overview';
        } else if (lower.includes('company') && lower.includes('description')) {
          mapping[header] = 'company_overview';
        } else if (lower.includes('business') && lower.includes('description')) {
          mapping[header] = 'company_overview';
        } else if (lower === 'description' || lower === 'overview') {
          mapping[header] = 'company_overview';
        } else if ((lower.includes('first') && lower.includes('name')) || lower === 'first') {
          mapping[header] = 'contact_first_name';
        } else if ((lower.includes('last') && lower.includes('name')) || lower === 'last' || lower.includes('surname')) {
          mapping[header] = 'contact_last_name';
        } else if (lower.includes('title') || lower.includes('position') || lower.includes('role')) {
          mapping[header] = 'contact_title';
        } else if (lower.includes('email') || lower.includes('e-mail')) {
          mapping[header] = 'contact_email';
        } else if (lower.includes('phone') || lower.includes('cell') || lower.includes('mobile') || lower.includes('telephone')) {
          mapping[header] = 'contact_phone';
        } else if ((lower.includes('company') || lower.includes('deal') || lower.includes('target') || lower.includes('business')) && !lower.includes('description')) {
          mapping[header] = 'deal_name';
        } else if (lower.includes('website') || lower.includes('url') || lower.includes('site')) {
          mapping[header] = 'company_website';
        } else if (lower.includes('address') || lower.includes('location') || lower.includes('street') || lower.includes('hq') || lower.includes('headquarters')) {
          mapping[header] = 'company_address';
        } else if (lower.includes('fireflies') || lower.includes('transcript') || lower.includes('recording') || (lower.includes('call') && !lower.includes('cell'))) {
          mapping[header] = 'transcript_link';
        } else if (lower.includes('note') || lower.includes('comment') || lower.includes('remark') || lower.includes('detail') || lower.includes('info')) {
          // Map ALL notes-like columns to additional_info (they will be combined)
          mapping[header] = 'additional_info';
        } else {
          mapping[header] = 'skip';
        }
      }
    }

    return new Response(JSON.stringify({ 
      mapping, 
      availableFields: DEAL_FIELDS 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in map-deal-csv-columns:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
