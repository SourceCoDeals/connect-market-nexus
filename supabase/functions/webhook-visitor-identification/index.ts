import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VisitorData {
  session_id?: string;
  captured_url?: string;
  seen_at?: string;
  referrer?: string;
  linkedin_url?: string;
  first_name?: string;
  last_name?: string;
  job_title?: string;
  business_email?: string;
  company_name?: string;
  company_website?: string;
  company_industry?: string;
  company_size?: string;
  estimated_revenue?: string;
  company_city?: string;
  company_state?: string;
  company_country?: string;
  source: string;
  is_repeat_visit?: boolean;
  raw_payload: Record<string, unknown>;
}

/**
 * Normalize RB2B webhook payload to common schema
 */
function normalizeRB2BPayload(payload: Record<string, unknown>): Partial<VisitorData> {
  return {
    linkedin_url: payload['LinkedIn URL'] as string || payload['linkedin_url'] as string,
    first_name: payload['First Name'] as string || payload['first_name'] as string,
    last_name: payload['Last Name'] as string || payload['last_name'] as string,
    job_title: payload['Title'] as string || payload['job_title'] as string || payload['title'] as string,
    business_email: payload['Business Email'] as string || payload['email'] as string || payload['business_email'] as string,
    company_name: payload['Company Name'] as string || payload['company_name'] as string || payload['company'] as string,
    company_website: payload['Website'] as string || payload['company_website'] as string || payload['website'] as string,
    company_industry: payload['Industry'] as string || payload['company_industry'] as string || payload['industry'] as string,
    company_size: payload['Employee Count'] as string || payload['company_size'] as string || payload['employees'] as string,
    estimated_revenue: payload['Estimated Revenue'] as string || payload['estimated_revenue'] as string || payload['revenue'] as string,
    company_city: payload['City'] as string || payload['company_city'] as string || payload['city'] as string,
    company_state: payload['State'] as string || payload['company_state'] as string || payload['state'] as string,
    company_country: payload['Country'] as string || payload['company_country'] as string || payload['country'] as string,
    captured_url: payload['Captured URL'] as string || payload['page_url'] as string || payload['url'] as string,
    referrer: payload['Referrer'] as string || payload['referrer'] as string,
    seen_at: payload['Seen At'] as string || payload['timestamp'] as string || new Date().toISOString(),
    is_repeat_visit: Boolean(payload['is_repeat_visit'] || payload['repeat_visit'] || false),
  };
}

/**
 * Normalize Warmly webhook payload to common schema
 */
function normalizeWarmlyPayload(payload: Record<string, unknown>): Partial<VisitorData> {
  // Warmly has slightly different field names
  const person = (payload['person'] || payload['visitor'] || {}) as Record<string, unknown>;
  const company = (payload['company'] || payload['organization'] || {}) as Record<string, unknown>;
  
  return {
    linkedin_url: person['linkedin_url'] as string || person['linkedinUrl'] as string || payload['linkedin_url'] as string,
    first_name: person['first_name'] as string || person['firstName'] as string || payload['first_name'] as string,
    last_name: person['last_name'] as string || person['lastName'] as string || payload['last_name'] as string,
    job_title: person['title'] as string || person['job_title'] as string || payload['title'] as string,
    business_email: person['email'] as string || payload['email'] as string,
    company_name: company['name'] as string || payload['company_name'] as string || payload['company'] as string,
    company_website: company['website'] as string || company['domain'] as string || payload['website'] as string,
    company_industry: company['industry'] as string || payload['industry'] as string,
    company_size: company['employee_count'] as string || company['employeeCount'] as string || company['size'] as string,
    estimated_revenue: company['revenue'] as string || company['estimated_revenue'] as string,
    company_city: company['city'] as string || payload['city'] as string,
    company_state: company['state'] as string || payload['state'] as string,
    company_country: company['country'] as string || payload['country'] as string,
    captured_url: payload['page_url'] as string || payload['url'] as string || payload['captured_url'] as string,
    referrer: payload['referrer'] as string,
    seen_at: payload['timestamp'] as string || payload['seen_at'] as string || new Date().toISOString(),
    is_repeat_visit: Boolean(payload['is_repeat'] || payload['repeat_visit'] || false),
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const source = url.searchParams.get('source') || 'unknown';
    
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate source
    if (!['rb2b', 'warmly', 'manual'].includes(source)) {
      console.warn(`Unknown source: ${source}`);
    }

    const payload = await req.json();
    console.log(`Received ${source} webhook:`, JSON.stringify(payload).substring(0, 500));

    // Normalize payload based on source
    let normalizedData: Partial<VisitorData>;
    if (source === 'warmly') {
      normalizedData = normalizeWarmlyPayload(payload);
    } else {
      // Default to RB2B format (also works for manual)
      normalizedData = normalizeRB2BPayload(payload);
    }

    // Build final visitor data
    const visitorData: VisitorData = {
      ...normalizedData,
      source: ['rb2b', 'warmly', 'manual'].includes(source) ? source : 'manual',
      raw_payload: payload,
    };

    // Skip if no useful data
    if (!visitorData.company_name && !visitorData.linkedin_url && !visitorData.business_email) {
      console.log('No identifiable data in payload, skipping');
      return new Response(
        JSON.stringify({ success: true, message: 'No identifiable data' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role for insert
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Insert visitor data
    const { data, error } = await supabase
      .from('visitor_companies')
      .insert(visitorData)
      .select('id')
      .single();

    if (error) {
      console.error('Failed to insert visitor company:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Stored visitor company: ${visitorData.company_name || 'Unknown'} (ID: ${data.id})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        id: data.id,
        company: visitorData.company_name,
        source: visitorData.source
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
