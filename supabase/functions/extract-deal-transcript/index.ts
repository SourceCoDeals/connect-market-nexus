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
  confidence: Record<string, 'high' | 'medium' | 'low'>;
}

// Simple extraction patterns - in production, this would use an LLM
function extractIntelligence(text: string): ExtractionResult {
  const result: ExtractionResult = {
    confidence: {}
  };

  // Revenue patterns
  const revenuePatterns = [
    /revenue\s*(?:of|is|:)?\s*\$?([\d,.]+)\s*(million|m|k|thousand)?/i,
    /\$?([\d,.]+)\s*(million|m|k|thousand)?\s*(?:in\s+)?revenue/i,
    /top\s*line\s*(?:of|is|:)?\s*\$?([\d,.]+)\s*(million|m|k|thousand)?/i,
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
  ];

  for (const pattern of ebitdaPatterns) {
    const match = text.match(pattern);
    if (match) {
      // Check if this is a percentage (margin) or absolute value
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
  ];

  for (const pattern of foundedPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.founded = match[0].match(/(19|20)\d{2}/)?.[0];
      result.confidence.founded = 'high';
      break;
    }
  }

  // Industry/services patterns (simplified)
  const industryKeywords = [
    'HVAC', 'plumbing', 'roofing', 'electrical', 'landscaping',
    'construction', 'manufacturing', 'healthcare', 'technology',
    'retail', 'distribution', 'logistics', 'restaurant', 'hospitality'
  ];

  const foundIndustries = industryKeywords.filter(keyword => 
    text.toLowerCase().includes(keyword.toLowerCase())
  );

  if (foundIndustries.length > 0) {
    result.industry = foundIndustries[0];
    result.services = foundIndustries;
    result.confidence.industry = 'medium';
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
