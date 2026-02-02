import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function authenticateUser(req: Request): Promise<{ user: any; error: Response | null }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return {
      user: null,
      error: new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) {
    return {
      user: null,
      error: new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  console.log('Authenticated user:', user.id);
  return { user, error: null };
}

// State adjacency map for US states
const stateAdjacency: Record<string, string[]> = {
  AL: ["FL", "GA", "MS", "TN"],
  AK: [],
  AZ: ["CA", "CO", "NM", "NV", "UT"],
  AR: ["LA", "MO", "MS", "OK", "TN", "TX"],
  CA: ["AZ", "NV", "OR"],
  CO: ["AZ", "KS", "NE", "NM", "OK", "UT", "WY"],
  CT: ["MA", "NY", "RI"],
  DE: ["MD", "NJ", "PA"],
  FL: ["AL", "GA"],
  GA: ["AL", "FL", "NC", "SC", "TN"],
  HI: [],
  ID: ["MT", "NV", "OR", "UT", "WA", "WY"],
  IL: ["IA", "IN", "KY", "MO", "WI"],
  IN: ["IL", "KY", "MI", "OH"],
  IA: ["IL", "MN", "MO", "NE", "SD", "WI"],
  KS: ["CO", "MO", "NE", "OK"],
  KY: ["IL", "IN", "MO", "OH", "TN", "VA", "WV"],
  LA: ["AR", "MS", "TX"],
  ME: ["NH"],
  MD: ["DE", "PA", "VA", "WV"],
  MA: ["CT", "NH", "NY", "RI", "VT"],
  MI: ["IN", "OH", "WI"],
  MN: ["IA", "ND", "SD", "WI"],
  MS: ["AL", "AR", "LA", "TN"],
  MO: ["AR", "IA", "IL", "KS", "KY", "NE", "OK", "TN"],
  MT: ["ID", "ND", "SD", "WY"],
  NE: ["CO", "IA", "KS", "MO", "SD", "WY"],
  NV: ["AZ", "CA", "ID", "OR", "UT"],
  NH: ["MA", "ME", "VT"],
  NJ: ["DE", "NY", "PA"],
  NM: ["AZ", "CO", "OK", "TX", "UT"],
  NY: ["CT", "MA", "NJ", "PA", "VT"],
  NC: ["GA", "SC", "TN", "VA"],
  ND: ["MN", "MT", "SD"],
  OH: ["IN", "KY", "MI", "PA", "WV"],
  OK: ["AR", "CO", "KS", "MO", "NM", "TX"],
  OR: ["CA", "ID", "NV", "WA"],
  PA: ["DE", "MD", "NJ", "NY", "OH", "WV"],
  RI: ["CT", "MA"],
  SC: ["GA", "NC"],
  SD: ["IA", "MN", "MT", "ND", "NE", "WY"],
  TN: ["AL", "AR", "GA", "KY", "MO", "MS", "NC", "VA"],
  TX: ["AR", "LA", "NM", "OK"],
  UT: ["AZ", "CO", "ID", "NM", "NV", "WY"],
  VT: ["MA", "NH", "NY"],
  VA: ["KY", "MD", "NC", "TN", "WV"],
  WA: ["ID", "OR"],
  WV: ["KY", "MD", "OH", "PA", "VA"],
  WI: ["IA", "IL", "MI", "MN"],
  WY: ["CO", "ID", "MT", "NE", "SD", "UT"],
};

// Canadian provinces - never adjacent to US states for our purposes
const canadianProvinces = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];

// State name to abbreviation mapping
const stateNameToAbbrev: Record<string, string> = {
  "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA",
  "colorado": "CO", "connecticut": "CT", "delaware": "DE", "florida": "FL", "georgia": "GA",
  "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
  "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
  "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS", "missouri": "MO",
  "montana": "MT", "nebraska": "NE", "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH",
  "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT",
  "virginia": "VA", "washington": "WA", "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
  // Canadian
  "british columbia": "BC", "alberta": "AB", "saskatchewan": "SK", "manitoba": "MB",
  "ontario": "ON", "quebec": "QC", "nova scotia": "NS", "new brunswick": "NB",
  "prince edward island": "PE", "newfoundland": "NL", "yukon": "YT",
  "northwest territories": "NT", "nunavut": "NU"
};

function normalizeState(state: string): string {
  if (!state) return "";
  const cleaned = state.trim().toUpperCase();
  if (cleaned.length === 2) return cleaned;
  const abbrev = stateNameToAbbrev[state.toLowerCase().trim()];
  return abbrev || cleaned;
}

// All US state abbreviations for "national" expansion
const allUSStates = Object.keys(stateAdjacency);

// Check if a geographic term indicates national coverage (exact match only)
function isNationalKeyword(geo: string): boolean {
  const lower = geo.toLowerCase().trim();
  const nationalKeywords = ['national', 'nationwide', 'all states', 'contiguous us', 'continental us'];
  return nationalKeywords.includes(lower);
}

// Extract all state names/abbreviations from a complex text string
// e.g., "Jackson, Mississippi Illinois (for tax context)" → ["MS", "IL"]
function extractStatesFromText(text: string): string[] {
  if (!text) return [];
  
  const found: string[] = [];
  const lower = text.toLowerCase();
  
  // Check for each full state name in the text
  for (const [stateName, abbrev] of Object.entries(stateNameToAbbrev)) {
    if (lower.includes(stateName)) {
      if (!found.includes(abbrev)) {
        found.push(abbrev);
      }
    }
  }
  
  // Also check for 2-letter abbreviations with word boundaries
  // This catches "MS" or "IL" when written as abbreviations
  for (const abbrev of allUSStates) {
    const regex = new RegExp(`\\b${abbrev}\\b`, 'i');
    if (regex.test(text) && !found.includes(abbrev)) {
      found.push(abbrev);
    }
  }
  
  // Also check Canadian provinces
  for (const prov of canadianProvinces) {
    const regex = new RegExp(`\\b${prov}\\b`, 'i');
    if (regex.test(text) && !found.includes(prov)) {
      found.push(prov);
    }
  }
  
  return found;
}

function extractStatesFromGeography(geography: string[] | null): string[] {
  if (!geography) return [];
  
  const states: string[] = [];
  for (const geo of geography) {
    // Skip national keywords - we require explicit state lists
    if (isNationalKeyword(geo)) {
      console.log(`Skipping national keyword "${geo}" - explicit state list required`);
      continue;
    }
    
    // Try to extract states from the text (handles complex strings)
    const extracted = extractStatesFromText(geo);
    if (extracted.length > 0) {
      states.push(...extracted);
    } else {
      // Fallback to simple normalization for plain abbreviations
      const normalized = normalizeState(geo);
      if (normalized && allUSStates.includes(normalized)) {
        states.push(normalized);
      }
    }
  }
  return [...new Set(states)]; // Remove duplicates
}

function isCanadian(state: string): boolean {
  return canadianProvinces.includes(normalizeState(state));
}

function getAdjacentStates(state: string): string[] {
  const normalized = normalizeState(state);
  return stateAdjacency[normalized] || [];
}

interface BuyerGeographicProfile {
  buyerId: string;
  hqState: string | null;
  hqCity: string | null; // Fallback for extracting state from city field
  targetGeographies: string[];
  serviceRegions: string[];
  geographicFootprint: string[];
  operatingLocations: any[]; // For future 100-mile rule
}

interface GeographicScore {
  buyerId: string;
  geographyScore: number;
  isDisqualified: boolean;
  disqualificationReason: string | null;
  fitReasoning: string;
}

function scoreBuyerGeography(
  buyer: BuyerGeographicProfile,
  dealStates: string[],
  dealLocationCount: number
): GeographicScore {
  const buyerStates = new Set<string>();
  
  // Collect all buyer geographic data with national keyword expansion
  if (buyer.hqState) {
    buyerStates.add(normalizeState(buyer.hqState));
  } else if (buyer.hqCity) {
    // Fallback: try to extract state from hq_city field (handles misformatted data like "Pacific Northwest WA")
    const statesFromCity = extractStatesFromText(buyer.hqCity);
    statesFromCity.forEach(s => buyerStates.add(s));
    if (statesFromCity.length > 0) {
      console.log(`Extracted state(s) ${statesFromCity.join(",")} from hq_city "${buyer.hqCity}" for buyer ${buyer.buyerId}`);
    }
  }
  extractStatesFromGeography(buyer.targetGeographies).forEach(s => buyerStates.add(s));
  extractStatesFromGeography(buyer.serviceRegions).forEach(s => buyerStates.add(s));
  extractStatesFromGeography(buyer.geographicFootprint).forEach(s => buyerStates.add(s));
  const buyerStateArray = Array.from(buyerStates).filter(Boolean);
  
  // Check if buyer is Canada-only
  const buyerIsCanadaOnly = buyerStateArray.length > 0 && buyerStateArray.every(s => isCanadian(s));
  const dealIsUS = dealStates.some(s => !isCanadian(s));
  
  // Canada-only buyer for US deal = disqualified for single-location
  if (buyerIsCanadaOnly && dealIsUS) {
    if (dealLocationCount < 3) {
      return {
        buyerId: buyer.buyerId,
        geographyScore: 0,
        isDisqualified: true,
        disqualificationReason: "Buyer operates exclusively in Canada. Single-location US deals require buyer presence within 100 miles.",
        fitReasoning: "❌ DISQUALIFIED: Operates in Canada only. Cannot acquire single-location US business without nearby presence."
      };
    } else {
      // Multi-location can still be considered but with low score
      return {
        buyerId: buyer.buyerId,
        geographyScore: 25,
        isDisqualified: false,
        disqualificationReason: null,
        fitReasoning: "⚠️ Geographic mismatch: Buyer operates in Canada. May still consider multi-location deal for market entry."
      };
    }
  }
  
  // Check for exact state matches
  const exactMatches = dealStates.filter(ds => buyerStateArray.includes(ds));
  
  // Check for adjacent state matches
  const adjacentMatches: string[] = [];
  dealStates.forEach(ds => {
    const adjacent = getAdjacentStates(ds);
    adjacent.forEach(adj => {
      if (buyerStateArray.includes(adj) && !adjacentMatches.includes(adj)) {
        adjacentMatches.push(adj);
      }
    });
  });
  
  // Single-location deal logic (strict 100-mile proxy via state adjacency)
  if (dealLocationCount < 3) {
    if (exactMatches.length > 0) {
      // Buyer has presence in the exact deal state
      return {
        buyerId: buyer.buyerId,
        geographyScore: 95,
        isDisqualified: false,
        disqualificationReason: null,
        fitReasoning: `✅ Strong fit: Buyer has presence in ${exactMatches.join(", ")} - same state as deal.`
      };
    } else if (adjacentMatches.length > 0) {
      // Buyer has presence in adjacent state (proxy for ~100 miles)
      return {
        buyerId: buyer.buyerId,
        geographyScore: 75,
        isDisqualified: false,
        disqualificationReason: null,
        fitReasoning: `✓ Acceptable: Buyer operates in ${adjacentMatches.join(", ")} (adjacent to deal location). May be within 100-mile range.`
      };
    } else {
      // No nearby presence - disqualified for single-location
      return {
        buyerId: buyer.buyerId,
        geographyScore: 0,
        isDisqualified: true,
        disqualificationReason: `No presence within 100 miles. Buyer's locations: ${buyerStateArray.join(", ") || "Unknown"}. Deal: ${dealStates.join(", ")}.`,
        fitReasoning: `❌ DISQUALIFIED: No presence near ${dealStates.join(", ")}. Single-location deals require buyer within 100 miles.`
      };
    }
  }
  
  // Multi-location deal (3+) - more lenient scoring
  if (exactMatches.length > 0) {
    return {
      buyerId: buyer.buyerId,
      geographyScore: 90,
      isDisqualified: false,
      disqualificationReason: null,
      fitReasoning: `✅ Strong fit: Buyer targets ${exactMatches.join(", ")} - direct overlap with deal geography.`
    };
  } else if (adjacentMatches.length > 0) {
    return {
      buyerId: buyer.buyerId,
      geographyScore: 70,
      isDisqualified: false,
      disqualificationReason: null,
      fitReasoning: `✓ Good fit: Buyer operates in ${adjacentMatches.join(", ")} (adjacent). Multi-location deal provides infrastructure for expansion.`
    };
  } else if (buyerStateArray.length > 0) {
    // Has some US presence but not nearby
    return {
      buyerId: buyer.buyerId,
      geographyScore: 40,
      isDisqualified: false,
      disqualificationReason: null,
      fitReasoning: `⚠️ Weak fit: Buyer operates in ${buyerStateArray.slice(0, 3).join(", ")}. No overlap with ${dealStates.join(", ")}, but multi-location deal may enable market entry.`
    };
  }
  
  // No geographic data available
  return {
    buyerId: buyer.buyerId,
    geographyScore: 50,
    isDisqualified: false,
    disqualificationReason: null,
    fitReasoning: "⚠️ Unknown: Buyer's geographic preferences not specified. Manual review recommended."
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const { user, error: authResponse } = await authenticateUser(req);
    if (authResponse) return authResponse;

    const { dealId, buyerIds } = await req.json();
    
    if (!dealId) {
      return new Response(JSON.stringify({ error: "dealId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization")!;
    
    // Create user client to verify ownership via RLS
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user has access to this deal via RLS
    const { data: userDeal, error: accessError } = await userClient
      .from("deals")
      .select("id, tracker_id")
      .eq("id", dealId)
      .single();

    if (accessError || !userDeal) {
      console.error("Access denied for deal:", dealId, accessError?.message);
      return new Response(JSON.stringify({ error: "Deal not found or access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Now safe to use SERVICE_ROLE_KEY
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch deal
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("id, deal_name, geography, headquarters, location_count")
      .eq("id", dealId)
      .single();

    if (dealError || !deal) {
      console.error("Deal fetch error:", dealError);
      return new Response(JSON.stringify({ error: "Deal not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract deal states from geography and headquarters
    const dealStates = extractStatesFromGeography(deal.geography);
    if (deal.headquarters) {
      // Try to extract state from headquarters (e.g., "Jackson, Mississippi" or "Jackson, MS")
      const parts = deal.headquarters.split(",").map((p: string) => p.trim());
      if (parts.length >= 2) {
        const stateFromHQ = normalizeState(parts[parts.length - 1]);
        if (stateFromHQ && !dealStates.includes(stateFromHQ)) {
          dealStates.push(stateFromHQ);
        }
      }
    }
    
    const dealLocationCount = deal.location_count || 1;

    console.log(`Scoring deal ${deal.deal_name}: states=${dealStates.join(",")}, locations=${dealLocationCount}`);

    // Fetch buyers
    let buyerQuery = supabase
      .from("buyers")
      .select("id, pe_firm_name, platform_company_name, hq_state, hq_city, target_geographies, service_regions, geographic_footprint, operating_locations");
    
    if (buyerIds?.length > 0) {
      buyerQuery = buyerQuery.in("id", buyerIds);
    } else {
      // Get buyers from same tracker as deal
      const { data: dealWithTracker } = await supabase
        .from("deals")
        .select("tracker_id")
        .eq("id", dealId)
        .single();
      
      if (dealWithTracker?.tracker_id) {
        buyerQuery = buyerQuery.eq("tracker_id", dealWithTracker.tracker_id);
      }
    }

    const { data: buyers, error: buyersError } = await buyerQuery;

    if (buyersError) {
      console.error("Buyers fetch error:", buyersError);
      return new Response(JSON.stringify({ error: "Failed to fetch buyers" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Score each buyer
    const scores: GeographicScore[] = (buyers || []).map(buyer => {
      const profile: BuyerGeographicProfile = {
        buyerId: buyer.id,
        hqState: buyer.hq_state,
        hqCity: buyer.hq_city,
        targetGeographies: buyer.target_geographies || [],
        serviceRegions: buyer.service_regions || [],
        geographicFootprint: buyer.geographic_footprint || [],
        operatingLocations: buyer.operating_locations || [],
      };
      
      return scoreBuyerGeography(profile, dealStates, dealLocationCount);
    });

    console.log(`Scored ${scores.length} buyers. Disqualified: ${scores.filter(s => s.isDisqualified).length}`);

    return new Response(JSON.stringify({ 
      success: true,
      dealStates,
      dealLocationCount,
      scores 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Score buyer geography error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
