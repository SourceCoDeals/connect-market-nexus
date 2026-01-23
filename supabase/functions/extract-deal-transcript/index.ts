import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractionResult {
  revenue?: number;
  ebitda?: number;
  employees?: number;
  location?: string;
  founded?: string;
  industry?: string;
  services?: string[];
  owner_goals?: string;
  special_requirements?: string;
  customer_types?: string;
  service_mix?: string;
  geographic_states?: string[];
  key_quotes?: string[];
  confidence: Record<string, 'high' | 'medium' | 'low'>;
}

// Enhanced extraction patterns
function extractIntelligence(text: string): ExtractionResult {
  const result: ExtractionResult = {
    confidence: {}
  };

  // Revenue patterns
  const revenuePatterns = [
    /revenue\s*(?:of|is|:)?\s*\$?([\d,.]+)\s*(million|m|k|thousand)?/i,
    /\$?([\d,.]+)\s*(million|m|k|thousand)?\s*(?:in\s+)?revenue/i,
    /top\s*line\s*(?:of|is|:)?\s*\$?([\d,.]+)\s*(million|m|k|thousand)?/i,
    /doing\s*(?:about|around)?\s*\$?([\d,.]+)\s*(million|m|k|thousand)?/i,
  ];

  for (const pattern of revenuePatterns) {
    const match = text.match(pattern);
    if (match) {
      let value = parseFloat(match[1].replace(/,/g, ''));
      const unit = match[2]?.toLowerCase();
      if (unit === 'million' || unit === 'm') value *= 1000000;
      if (unit === 'k' || unit === 'thousand') value *= 1000;
      result.revenue = value;
      result.confidence.revenue = 'medium';
      break;
    }
  }

  // EBITDA patterns
  const ebitdaPatterns = [
    /ebitda\s*(?:of|is|:)?\s*\$?([\d,.]+)\s*(million|m|k|thousand)?/i,
    /\$?([\d,.]+)\s*(million|m|k|thousand)?\s*(?:in\s+)?ebitda/i,
    /margin\s*(?:of|is|:)?\s*([\d.]+)%/i,
    /cash\s*flow\s*(?:of|is|:)?\s*\$?([\d,.]+)\s*(million|m|k|thousand)?/i,
  ];

  for (const pattern of ebitdaPatterns) {
    const match = text.match(pattern);
    if (match) {
      if (pattern.source.includes('margin') && result.revenue) {
        const margin = parseFloat(match[1]) / 100;
        result.ebitda = Math.round(result.revenue * margin);
        result.confidence.ebitda = 'low';
      } else {
        let value = parseFloat(match[1].replace(/,/g, ''));
        const unit = match[2]?.toLowerCase();
        if (unit === 'million' || unit === 'm') value *= 1000000;
        if (unit === 'k' || unit === 'thousand') value *= 1000;
        result.ebitda = value;
        result.confidence.ebitda = 'medium';
      }
      break;
    }
  }

  // Employee patterns
  const employeePatterns = [
    /(\d+)\s*(?:full[- ]time\s+)?employees?/i,
    /team\s*(?:of|is|:)?\s*(\d+)/i,
    /(\d+)\s*(?:team\s+)?members?/i,
    /headcount\s*(?:of|is|:)?\s*(\d+)/i,
    /staff\s*(?:of|is|:)?\s*(\d+)/i,
  ];

  for (const pattern of employeePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.employees = parseInt(match[1]);
      result.confidence.employees = 'medium';
      break;
    }
  }

  // Location patterns
  const locationPatterns = [
    /(?:headquartered|based|located)\s+in\s+([A-Za-z\s,]+(?:,\s*[A-Z]{2})?)/i,
    /(?:headquarters?|hq)\s*(?:is|:)?\s*(?:in\s+)?([A-Za-z\s,]+(?:,\s*[A-Z]{2})?)/i,
    /(?:out\s+of|from)\s+([A-Za-z\s,]+(?:,\s*[A-Z]{2})?)/i,
  ];

  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.location = match[1].trim();
      result.confidence.location = 'medium';
      break;
    }
  }

  // Founded year patterns
  const foundedPatterns = [
    /founded\s*(?:in)?\s*(19|20)\d{2}/i,
    /established\s*(?:in)?\s*(19|20)\d{2}/i,
    /since\s*(19|20)\d{2}/i,
    /started\s*(?:in)?\s*(19|20)\d{2}/i,
    /been\s+(?:in\s+)?business\s+(?:for\s+)?(\d+)\s+years?/i,
  ];

  for (const pattern of foundedPatterns) {
    const match = text.match(pattern);
    if (match) {
      if (pattern.source.includes('years')) {
        const years = parseInt(match[1]);
        result.founded = String(new Date().getFullYear() - years);
        result.confidence.founded = 'low';
      } else {
        result.founded = match[0].match(/(19|20)\d{2}/)?.[0];
        result.confidence.founded = 'high';
      }
      break;
    }
  }

  // Industry/services patterns
  const industryKeywords = [
    'HVAC', 'plumbing', 'roofing', 'electrical', 'landscaping',
    'construction', 'manufacturing', 'healthcare', 'technology',
    'retail', 'distribution', 'logistics', 'restaurant', 'hospitality',
    'auto body', 'collision repair', 'automotive', 'insurance',
    'home services', 'property management', 'cleaning', 'pest control'
  ];

  const foundIndustries = industryKeywords.filter(keyword => 
    text.toLowerCase().includes(keyword.toLowerCase())
  );

  if (foundIndustries.length > 0) {
    result.industry = foundIndustries[0];
    result.services = foundIndustries;
    result.service_mix = foundIndustries.join(', ');
    result.confidence.industry = 'medium';
  }

  // Owner goals patterns
  const ownerGoalPatterns = [
    /(?:owner|seller)\s+(?:wants?|looking|hoping)\s+(?:to\s+)?([^.]+)/i,
    /(?:goal|objective)\s+(?:is\s+)?(?:to\s+)?([^.]+)/i,
    /looking\s+(?:for|to)\s+(?:a\s+)?(?:buyer|partner|exit|retire)/i,
    /want(?:s)?\s+to\s+(?:retire|exit|step\s+back|transition)/i,
  ];

  for (const pattern of ownerGoalPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.owner_goals = match[0].trim();
      result.confidence.owner_goals = 'medium';
      break;
    }
  }

  // Special requirements patterns
  const requirementPatterns = [
    /(?:require|need|must\s+have|important\s+that)\s+([^.]+)/i,
    /(?:deal\s+breaker|non[- ]negotiable)\s*(?:is|:)?\s*([^.]+)/i,
    /(?:employees?|team)\s+(?:must|need\s+to)\s+([^.]+)/i,
  ];

  for (const pattern of requirementPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.special_requirements = match[0].trim();
      result.confidence.special_requirements = 'medium';
      break;
    }
  }

  // Customer types patterns
  const customerPatterns = [
    /(?:serve|service|work\s+with)\s+(?:primarily\s+)?([^.]+(?:commercial|residential|government|industrial|business))/i,
    /(?:customers?|clients?)\s+(?:are\s+)?(?:primarily\s+)?([^.]+)/i,
    /(?:b2b|b2c|business[- ]to[- ]business|business[- ]to[- ]consumer)/i,
  ];

  for (const pattern of customerPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.customer_types = match[0].trim();
      result.confidence.customer_types = 'medium';
      break;
    }
  }

  // Geographic states patterns
  const stateAbbreviations = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ];

  const foundStates: string[] = [];
  for (const state of stateAbbreviations) {
    const pattern = new RegExp(`\\b${state}\\b`, 'g');
    if (pattern.test(text)) {
      foundStates.push(state);
    }
  }

  if (foundStates.length > 0) {
    result.geographic_states = [...new Set(foundStates)];
    result.confidence.geographic_states = 'medium';
  }

  // Extract key quotes (statements in quotes or significant statements)
  const quotePatterns = [
    /"([^"]{20,200})"/g,
    /'([^']{20,200})'/g,
  ];

  const quotes: string[] = [];
  for (const pattern of quotePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1] && match[1].length > 20) {
        quotes.push(match[1].trim());
      }
    }
  }

  if (quotes.length > 0) {
    result.key_quotes = quotes.slice(0, 5);
    result.confidence.key_quotes = 'high';
  }

  return result;
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

    const { transcriptId, transcriptText } = await req.json();

    if (!transcriptId || !transcriptText) {
      return new Response(
        JSON.stringify({ error: 'Missing transcriptId or transcriptText' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Extracting intelligence from transcript ${transcriptId}`);

    // Extract intelligence
    const extracted = extractIntelligence(transcriptText);

    console.log('Extracted data:', extracted);

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
