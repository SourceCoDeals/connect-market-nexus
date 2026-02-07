// DEPRECATED: This standalone function duplicates logic now in score-buyer-deal/index.ts.
// The main scoring engine uses DB-backed adjacency (geography-utils.ts) instead of this hardcoded map.
// Kept for backwards compatibility with any external callers.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// US State adjacency map
const STATE_ADJACENCY: Record<string, string[]> = {
  'AL': ['FL', 'GA', 'MS', 'TN'],
  'AK': [],
  'AZ': ['CA', 'CO', 'NV', 'NM', 'UT'],
  'AR': ['LA', 'MO', 'MS', 'OK', 'TN', 'TX'],
  'CA': ['AZ', 'NV', 'OR'],
  'CO': ['AZ', 'KS', 'NE', 'NM', 'OK', 'UT', 'WY'],
  'CT': ['MA', 'NY', 'RI'],
  'DE': ['MD', 'NJ', 'PA'],
  'FL': ['AL', 'GA'],
  'GA': ['AL', 'FL', 'NC', 'SC', 'TN'],
  'HI': [],
  'ID': ['MT', 'NV', 'OR', 'UT', 'WA', 'WY'],
  'IL': ['IN', 'IA', 'KY', 'MO', 'WI'],
  'IN': ['IL', 'KY', 'MI', 'OH'],
  'IA': ['IL', 'MN', 'MO', 'NE', 'SD', 'WI'],
  'KS': ['CO', 'MO', 'NE', 'OK'],
  'KY': ['IL', 'IN', 'MO', 'OH', 'TN', 'VA', 'WV'],
  'LA': ['AR', 'MS', 'TX'],
  'ME': ['NH'],
  'MD': ['DE', 'PA', 'VA', 'WV', 'DC'],
  'MA': ['CT', 'NH', 'NY', 'RI', 'VT'],
  'MI': ['IN', 'OH', 'WI'],
  'MN': ['IA', 'ND', 'SD', 'WI'],
  'MS': ['AL', 'AR', 'LA', 'TN'],
  'MO': ['AR', 'IL', 'IA', 'KS', 'KY', 'NE', 'OK', 'TN'],
  'MT': ['ID', 'ND', 'SD', 'WY'],
  'NE': ['CO', 'IA', 'KS', 'MO', 'SD', 'WY'],
  'NV': ['AZ', 'CA', 'ID', 'OR', 'UT'],
  'NH': ['MA', 'ME', 'VT'],
  'NJ': ['DE', 'NY', 'PA'],
  'NM': ['AZ', 'CO', 'OK', 'TX', 'UT'],
  'NY': ['CT', 'MA', 'NJ', 'PA', 'VT'],
  'NC': ['GA', 'SC', 'TN', 'VA'],
  'ND': ['MN', 'MT', 'SD'],
  'OH': ['IN', 'KY', 'MI', 'PA', 'WV'],
  'OK': ['AR', 'CO', 'KS', 'MO', 'NM', 'TX'],
  'OR': ['CA', 'ID', 'NV', 'WA'],
  'PA': ['DE', 'MD', 'NJ', 'NY', 'OH', 'WV'],
  'RI': ['CT', 'MA'],
  'SC': ['GA', 'NC'],
  'SD': ['IA', 'MN', 'MT', 'ND', 'NE', 'WY'],
  'TN': ['AL', 'AR', 'GA', 'KY', 'MO', 'MS', 'NC', 'VA'],
  'TX': ['AR', 'LA', 'NM', 'OK'],
  'UT': ['AZ', 'CO', 'ID', 'NV', 'NM', 'WY'],
  'VT': ['MA', 'NH', 'NY'],
  'VA': ['KY', 'MD', 'NC', 'TN', 'WV', 'DC'],
  'WA': ['ID', 'OR'],
  'WV': ['KY', 'MD', 'OH', 'PA', 'VA'],
  'WI': ['IL', 'IA', 'MI', 'MN'],
  'WY': ['CO', 'ID', 'MT', 'NE', 'SD', 'UT'],
  'DC': ['MD', 'VA']
};

// Canadian provinces
const CANADIAN_PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dealId, buyerIds } = await req.json();

    if (!dealId) {
      return new Response(
        JSON.stringify({ error: 'dealId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch deal location from listings table (active schema)
    const { data: deal, error: dealError } = await supabase
      .from('listings')
      .select('id, location')
      .eq('id', dealId)
      .single();

    if (dealError || !deal) {
      return new Response(
        JSON.stringify({ error: 'Deal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse deal state from location
    const dealState = extractState(deal.location);

    // Fetch buyers from remarketing_buyers table (active schema)
    let buyerQuery = supabase
      .from('remarketing_buyers')
      .select('id, company_name, geographic_footprint, target_geographies, hq_state');

    if (buyerIds && buyerIds.length > 0) {
      buyerQuery = buyerQuery.in('id', buyerIds);
    }

    const { data: buyers, error: buyersError } = await buyerQuery;

    if (buyersError) {
      throw buyersError;
    }

    const scores: Array<{
      buyerId: string;
      buyerName: string;
      score: number;
      matchType: 'exact' | 'adjacent' | 'regional' | 'national' | 'no_match';
      details: string;
    }> = [];

    for (const buyer of buyers || []) {
      const result = calculateGeographyScore(dealState, buyer);
      scores.push({
        buyerId: buyer.id,
        buyerName: buyer.company_name,
        ...result
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        dealState,
        scores,
        totalBuyers: scores.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in score-buyer-geography:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractState(address: string | null): string | null {
  if (!address) return null;
  
  // Common US state patterns
  const statePattern = /\b([A-Z]{2})\b(?:\s+\d{5})?/;
  const match = address.toUpperCase().match(statePattern);
  
  if (match && (STATE_ADJACENCY[match[1]] || CANADIAN_PROVINCES.includes(match[1]))) {
    return match[1];
  }
  
  return null;
}

function calculateGeographyScore(
  dealState: string | null,
  buyer: any
): { score: number; matchType: 'exact' | 'adjacent' | 'regional' | 'national' | 'no_match'; details: string } {
  
  // If no deal state, assume national reach is acceptable
  if (!dealState) {
    return { score: 50, matchType: 'national', details: 'Deal location unknown - assuming national reach' };
  }

  const buyerStates = new Set<string>();
  
  // Collect all buyer geographic preferences
  const geoSources = [
    buyer.geographic_footprint,
    buyer.acquisition_geography,
    buyer.target_geographies
  ];

  for (const source of geoSources) {
    if (Array.isArray(source)) {
      source.forEach(s => {
        if (typeof s === 'string') {
          const state = s.toUpperCase().trim();
          if (STATE_ADJACENCY[state] || CANADIAN_PROVINCES.includes(state)) {
            buyerStates.add(state);
          }
          // Check for "National" or "Nationwide"
          if (s.toLowerCase().includes('national') || s.toLowerCase().includes('nationwide')) {
            buyerStates.add('NATIONAL');
          }
        }
      });
    }
  }

  // Add HQ state
  if (buyer.hq_state) {
    const hqState = buyer.hq_state.toUpperCase().trim();
    if (STATE_ADJACENCY[hqState]) {
      buyerStates.add(hqState);
    }
  }

  // Check for national buyers
  if (buyerStates.has('NATIONAL') || buyerStates.size === 0) {
    return { score: 60, matchType: 'national', details: 'Buyer has national acquisition scope' };
  }

  // Exact state match (aligned with geography-utils.ts: exact=95)
  if (buyerStates.has(dealState)) {
    return { score: 95, matchType: 'exact', details: `Exact match: ${dealState}` };
  }

  // Adjacent state match (aligned with geography-utils.ts: adjacent=70-85)
  const adjacentStates = STATE_ADJACENCY[dealState] || [];
  const adjacentMatches = adjacentStates.filter(s => buyerStates.has(s));
  if (adjacentMatches.length > 0) {
    const score = Math.min(85, 70 + adjacentMatches.length * 5);
    return { score, matchType: 'adjacent', details: `Adjacent state match via ${adjacentMatches[0]}` };
  }

  // Regional match (aligned with geography-utils.ts: regional=45-60)
  for (const adjState of adjacentStates) {
    const secondDegree = STATE_ADJACENCY[adjState] || [];
    const regionalMatch = secondDegree.find(s => buyerStates.has(s));
    if (regionalMatch) {
      return { score: 50, matchType: 'regional', details: `Regional match via ${adjState} → ${regionalMatch}` };
    }
  }

  return { score: 20, matchType: 'no_match', details: `No geographic overlap with deal in ${dealState}` };
}
