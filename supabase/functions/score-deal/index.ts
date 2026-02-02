import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Deal Scoring Algorithm v6.1 - Fail-Safe Industry-Adaptive Scoring
 * 
 * Weight Distribution (100 points total):
 * - Size: 40 pts (TOP PRIORITY - gating factor)
 * - Service Alignment: 30 pts (Dynamic primary service detection from tracker criteria)
 * - Data Quality: 15 pts
 * - Geography: 10 pts
 * - Buyer Type Bonus: 5 pts
 * - Industry KPI Bonus: Up to 15 pts (optional, based on tracker config)
 * 
 * Key v6.1 Features:
 * - CRITERIA VALIDATION: Checks if tracker has sufficient criteria before scoring
 * - Returns scoring status: 'ready', 'needs_review', or 'insufficient_data'
 * - Dynamic primary service detection using tracker's service_criteria.primary_focus
 * - Industry-agnostic - no hardcoded collision/towing logic
 * - Optional KPI boost layer when tracker defines kpi_scoring_config
 */

// ============= INTERFACES =============

interface DealData {
  id: string;
  deal_name: string;
  tracker_id: string;
  revenue: number | null;
  ebitda_amount: number | null;
  ebitda_percentage: number | null;
  owner_goals: string | null;
  geography: string[] | null;
  headquarters: string | null;
  location_count: number | null;
  employee_count: number | null;
  additional_info: string | null;
  service_mix: string | null;
  growth_trajectory: string | null;
  real_estate: string | null;
  customer_concentration: string | null;
  company_overview: string | null;
  industry_kpis: Record<string, any> | null;
}

interface TrackerCriteria {
  industry_name: string;
  fit_criteria_size: string | null;
  fit_criteria_service: string | null;
  fit_criteria_geography: string | null;
  size_criteria: any;
  service_criteria: any;
  geography_criteria: any;
  buyer_types_criteria: any;
  kpi_scoring_config: any;
  geography_weight: number;
  service_mix_weight: number;
  size_weight: number;
  owner_goals_weight: number;
}

interface BuyerType {
  type_name: string;
  min_revenue?: number;
  max_revenue?: number;
  min_ebitda?: number;
  max_ebitda?: number;
  min_locations?: number;
  max_locations?: number;
  geographic_scope?: string;
  exclusions?: string[];
  priority?: number;
}

interface ScoreBreakdown {
  sizeScore: number;
  sizeDetails: string;
  serviceScore: number;
  serviceDetails: string;
  geographyScore: number;
  geographyDetails: string;
  dataScore: number;
  dataDetails: string;
  buyerTypeBonusScore: number;
  buyerTypeBonusDetails: string;
  kpiBonusScore: number;
  kpiBonusDetails: string;
  totalScore: number;
  scoringVersion: string;
  disqualified: boolean;
  disqualificationReasons: string[];
  primaryService: string;
}

// ============= DYNAMIC PRIMARY SERVICE DETECTION =============

/**
 * Detects the deal's PRIMARY business using tracker-defined focus keywords.
 * This is industry-agnostic - uses service_criteria.primary_focus from tracker.
 */
function detectPrimaryService(deal: DealData, serviceCriteria: any): {
  primaryService: string;
  isOnFocus: boolean;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
} {
  const allText = [
    deal.deal_name || '',
    deal.service_mix || '',
    deal.additional_info || '',
    deal.company_overview || ''
  ].join(' ').toLowerCase();
  
  if (allText.trim().length < 5) {
    console.log('[score-deal] detectPrimaryService: Insufficient deal data for service detection');
    return { primaryService: 'unknown', isOnFocus: true, confidence: 'low', reasoning: 'Insufficient data - giving benefit of doubt' };
  }
  
  // Get focus and exclusion keywords from tracker's service criteria
  // CRITICAL: Handle both array and parsed JSON formats
  let primaryFocusKeywords: string[] = [];
  let excludedServices: string[] = [];
  
  if (serviceCriteria) {
    // Handle primary_focus - can be array or from required_services
    if (Array.isArray(serviceCriteria.primary_focus)) {
      primaryFocusKeywords = serviceCriteria.primary_focus.map((s: string) => s.toLowerCase().trim());
    } else if (Array.isArray(serviceCriteria.required_services)) {
      primaryFocusKeywords = serviceCriteria.required_services.map((s: string) => s.toLowerCase().trim());
    }
    
    // Handle excluded_services
    if (Array.isArray(serviceCriteria.excluded_services)) {
      excludedServices = serviceCriteria.excluded_services.map((s: string) => s.toLowerCase().trim());
    }
    
    console.log('[score-deal] detectPrimaryService: primary_focus keywords:', primaryFocusKeywords);
    console.log('[score-deal] detectPrimaryService: excluded_services keywords:', excludedServices);
  }
  
  // If no primary_focus defined, return needs_review status instead of benefit of doubt
  if (primaryFocusKeywords.length === 0) {
    console.log('[score-deal] detectPrimaryService: No primary focus defined in tracker service_criteria - flagging for review');
    return { 
      primaryService: 'not-configured', 
      isOnFocus: false,  // Changed from true - no longer give benefit of doubt
      confidence: 'low', 
      reasoning: 'CRITERIA INCOMPLETE: No primary_focus defined in tracker. Update service_criteria to enable accurate scoring.' 
    };
  }
  
  // Count mentions of focus vs exclusion keywords
  let focusMentions = 0;
  let focusMatches: string[] = [];
  let exclusionMentions = 0;
  let exclusionMatches: string[] = [];
  
  // Check deal name first - strongest signal
  const dealNameLower = (deal.deal_name || '').toLowerCase();
  
  for (const keyword of primaryFocusKeywords) {
    if (!keyword || keyword.length < 2) continue; // Skip empty/tiny keywords
    
    if (dealNameLower.includes(keyword)) {
      focusMentions += 3; // Strong weight for deal name
      if (!focusMatches.includes(keyword)) focusMatches.push(keyword);
    }
    // Count in full text
    try {
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = (allText.match(regex) || []).length;
      if (matches > 0) {
        focusMentions += matches;
        if (!focusMatches.includes(keyword)) focusMatches.push(keyword);
      }
    } catch (e) {
      console.error('[score-deal] Regex error for keyword:', keyword, e);
    }
  }
  
  for (const keyword of excludedServices) {
    if (!keyword || keyword.length < 2) continue;
    
    if (dealNameLower.includes(keyword)) {
      exclusionMentions += 3; // Strong weight for deal name
      if (!exclusionMatches.includes(keyword)) exclusionMatches.push(keyword);
    }
    try {
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = (allText.match(regex) || []).length;
      if (matches > 0) {
        exclusionMentions += matches;
        if (!exclusionMatches.includes(keyword)) exclusionMatches.push(keyword);
      }
    } catch (e) {
      console.error('[score-deal] Regex error for excluded keyword:', keyword, e);
    }
  }
  
  console.log(`[score-deal] detectPrimaryService: focusMentions=${focusMentions} (${focusMatches.join(',')}), exclusionMentions=${exclusionMentions} (${exclusionMatches.join(',')})`);
  
  // Determine if on-focus or off-focus
  if (exclusionMentions > 0 && exclusionMentions > focusMentions * 1.5) {
    // Exclusion keywords dominate - off-focus primary
    return {
      primaryService: exclusionMatches[0] || 'off-focus',
      isOnFocus: false,
      confidence: 'high',
      reasoning: `Off-focus: "${exclusionMatches.join(', ')}" dominates (${exclusionMentions} vs ${focusMentions} focus mentions)`
    };
  }
  
  if (focusMentions > 0 && focusMentions >= exclusionMentions) {
    return {
      primaryService: focusMatches[0] || 'on-focus',
      isOnFocus: true,
      confidence: focusMentions > 3 ? 'high' : 'medium',
      reasoning: `On-focus: "${focusMatches.join(', ')}" (${focusMentions} mentions)`
    };
  }
  
  // Neither focus nor exclusion detected - give benefit of doubt
  return {
    primaryService: 'undetermined',
    isOnFocus: true, // Give benefit of doubt
    confidence: 'low',
    reasoning: 'Could not determine primary service from text - giving benefit of doubt'
  };
}

// ============= SIZE SCORING (40 points max) =============

function calculateSizeScore(deal: DealData, criteria: TrackerCriteria | null): {
  score: number;
  details: string;
  disqualified: boolean;
  disqualificationReason: string | null;
} {
  const parts: string[] = [];
  let score = 0;
  let disqualified = false;
  let disqualificationReason: string | null = null;
  
  const dealRevenue = deal.revenue || 0;
  const dealEbitda = deal.ebitda_amount || 0;
  const dealLocations = deal.location_count || 1;
  
  // Parse tracker size criteria
  let minRevenue = 0;
  let maxRevenue = 100;
  let minEbitda = 0;
  let maxEbitda = 20;
  let minLocations = 1;
  let maxLocations = 100;
  
  if (criteria?.size_criteria) {
    const sizeCriteria = typeof criteria.size_criteria === 'string' 
      ? JSON.parse(criteria.size_criteria) 
      : criteria.size_criteria;
    
    if (sizeCriteria.min_revenue) {
      minRevenue = typeof sizeCriteria.min_revenue === 'number' 
        ? sizeCriteria.min_revenue / 1000000 
        : parseFloat(String(sizeCriteria.min_revenue).replace(/[^0-9.]/g, '')) / 1000000 || 0;
    }
    if (sizeCriteria.max_revenue) {
      maxRevenue = typeof sizeCriteria.max_revenue === 'number'
        ? sizeCriteria.max_revenue / 1000000
        : parseFloat(String(sizeCriteria.max_revenue).replace(/[^0-9.]/g, '')) / 1000000 || 100;
    }
    if (sizeCriteria.min_ebitda) {
      minEbitda = typeof sizeCriteria.min_ebitda === 'number'
        ? sizeCriteria.min_ebitda / 1000000
        : parseFloat(String(sizeCriteria.min_ebitda).replace(/[^0-9.]/g, '')) / 1000000 || 0;
    }
    if (sizeCriteria.max_ebitda) {
      maxEbitda = typeof sizeCriteria.max_ebitda === 'number'
        ? sizeCriteria.max_ebitda / 1000000
        : parseFloat(String(sizeCriteria.max_ebitda).replace(/[^0-9.]/g, '')) / 1000000 || 20;
    }
    if (sizeCriteria.min_locations) {
      minLocations = parseInt(sizeCriteria.min_locations) || 1;
    }
    if (sizeCriteria.max_locations) {
      maxLocations = parseInt(sizeCriteria.max_locations) || 100;
    }
    
    console.log(`[score-deal v6.0] Size criteria: Revenue $${minRevenue}M-$${maxRevenue}M, EBITDA $${minEbitda}M-$${maxEbitda}M, Locations ${minLocations}-${maxLocations}`);
  }
  
  // REVENUE SCORING (16 pts max)
  if (dealRevenue > 0) {
    if (dealRevenue >= minRevenue && dealRevenue <= maxRevenue) {
      score += 16;
      parts.push(`Revenue $${dealRevenue.toFixed(2)}M in range = +16pts`);
    } else if (dealRevenue > maxRevenue) {
      if (dealRevenue > maxRevenue * 2) {
        score += 8;
        parts.push(`Revenue $${dealRevenue.toFixed(2)}M way over max = +8pts`);
      } else {
        score += 12;
        parts.push(`Revenue $${dealRevenue.toFixed(2)}M slightly over = +12pts`);
      }
    } else if (dealRevenue < minRevenue) {
      const percentBelow = ((minRevenue - dealRevenue) / minRevenue) * 100;
      if (percentBelow > 50) {
        disqualified = true;
        disqualificationReason = `Revenue $${dealRevenue.toFixed(2)}M is ${percentBelow.toFixed(0)}% below minimum $${minRevenue}M`;
        score = 0;
        parts.push(`Revenue ${percentBelow.toFixed(0)}% below min = DISQUALIFIED`);
      } else if (percentBelow > 30) {
        score += 4;
        parts.push(`Revenue ${percentBelow.toFixed(0)}% below min = +4pts`);
      } else {
        score += 8;
        parts.push(`Revenue slightly below min = +8pts`);
      }
    }
  } else {
    score += 4;
    parts.push('No revenue data = +4pts');
  }
  
  // EBITDA SCORING (16 pts max)
  if (dealEbitda > 0) {
    if (minEbitda > 0 || maxEbitda < 20) {
      if (dealEbitda >= minEbitda && dealEbitda <= maxEbitda) {
        score += 16;
        parts.push(`EBITDA $${dealEbitda.toFixed(2)}M in range = +16pts`);
      } else if (dealEbitda > maxEbitda) {
        score += 12;
        parts.push(`EBITDA $${dealEbitda.toFixed(2)}M over range = +12pts`);
      } else {
        const percentBelow = ((minEbitda - dealEbitda) / minEbitda) * 100;
        if (percentBelow > 50) {
          score += 2;
          parts.push(`EBITDA ${percentBelow.toFixed(0)}% below min = +2pts (weak)`);
        } else {
          score += 8;
          parts.push(`EBITDA below min = +8pts`);
        }
      }
    } else {
      score += 10;
      parts.push(`EBITDA $${dealEbitda.toFixed(2)}M present = +10pts`);
    }
  } else {
    score += 2;
    parts.push('No EBITDA data = +2pts');
  }
  
  // LOCATION COUNT SCORING (8 pts max)
  if (dealLocations >= minLocations && dealLocations <= maxLocations) {
    score += 8;
    parts.push(`${dealLocations} locations in range = +8pts`);
  } else if (dealLocations < minLocations) {
    if (dealLocations === 1 && minLocations > 3) {
      score += 2;
      parts.push(`Single location (need ${minLocations}+) = +2pts`);
    } else {
      score += 4;
      parts.push(`${dealLocations} locations (need ${minLocations}+) = +4pts`);
    }
  } else {
    score += 6;
    parts.push(`${dealLocations} locations (above ${maxLocations}) = +6pts`);
  }
  
  return {
    score: Math.min(score, 40),
    details: parts.join('; '),
    disqualified,
    disqualificationReason
  };
}

// ============= SERVICE SCORING (30 points max) =============

function calculateServiceScore(deal: DealData, criteria: TrackerCriteria | null, primaryServiceInfo: { primaryService: string; isOnFocus: boolean; confidence: string; reasoning: string }): {
  score: number;
  details: string;
  disqualified: boolean;
  disqualificationReason: string | null;
} {
  const parts: string[] = [];
  let score = 0;
  let disqualified = false;
  let disqualificationReason: string | null = null;
  
  const allText = [
    deal.service_mix || '',
    deal.additional_info || '',
    deal.company_overview || ''
  ].join(' ').toLowerCase();
  
  if (!allText || allText.trim().length < 5) {
    return { score: 8, details: 'No service data = +8pts (default)', disqualified: false, disqualificationReason: null };
  }
  
  // Parse tracker service criteria
  let requiredServices: string[] = [];
  let preferredServices: string[] = [];
  let excludedServices: string[] = [];
  let businessModel: string | null = null;
  
  if (criteria?.service_criteria) {
    const serviceCriteria = typeof criteria.service_criteria === 'string'
      ? JSON.parse(criteria.service_criteria)
      : criteria.service_criteria;
    
    requiredServices = (serviceCriteria.required_services || []).map((s: string) => s.toLowerCase());
    preferredServices = (serviceCriteria.preferred_services || []).map((s: string) => s.toLowerCase());
    excludedServices = (serviceCriteria.excluded_services || []).map((s: string) => s.toLowerCase());
    businessModel = serviceCriteria.business_model?.toLowerCase() || null;
    
    console.log(`[score-deal v6.0] Service criteria: Required=${requiredServices.join(',')}, Excluded=${excludedServices.join(',')}`);
  }
  
  // DYNAMIC: Check primary service alignment using tracker-defined focus
  if (primaryServiceInfo.isOnFocus) {
    // On-focus primary service - bonus
    if (primaryServiceInfo.confidence === 'high') {
      score += 15;
      parts.push(`PRIMARY SERVICE ON-FOCUS (${primaryServiceInfo.primaryService}) = +15pts`);
    } else {
      score += 10;
      parts.push(`PRIMARY SERVICE likely on-focus = +10pts`);
    }
  } else {
    // Off-focus primary service - penalty
    if (primaryServiceInfo.confidence === 'high') {
      score -= 20;
      parts.push(`PRIMARY SERVICE OFF-FOCUS (${primaryServiceInfo.primaryService}) = -20pts SEVERE PENALTY`);
    } else {
      score -= 10;
      parts.push(`PRIMARY SERVICE may be off-focus = -10pts`);
    }
  }
  
  // Check for REQUIRED services (max 8 pts additional)
  let requiredFound = 0;
  const matchedRequired: string[] = [];
  for (const required of requiredServices) {
    const keywords = required.split(' ');
    const matched = keywords.every(kw => allText.includes(kw.toLowerCase()));
    if (matched || allText.includes(required.toLowerCase())) {
      requiredFound++;
      matchedRequired.push(required);
    }
  }
  
  if (requiredServices.length > 0 && requiredFound > 0) {
    const requiredRatio = requiredFound / requiredServices.length;
    const requiredPts = Math.round(requiredRatio * 8);
    score += requiredPts;
    parts.push(`Required services (${matchedRequired.join(', ')}) = +${requiredPts}pts`);
  }
  
  // Check for PREFERRED services (max 5 pts)
  let preferredFound = 0;
  const matchedPreferred: string[] = [];
  for (const preferred of preferredServices) {
    if (allText.includes(preferred.toLowerCase())) {
      preferredFound++;
      matchedPreferred.push(preferred);
    }
  }
  
  if (preferredServices.length > 0 && preferredFound > 0) {
    const preferredPts = Math.min(preferredFound * 2, 5);
    score += preferredPts;
    parts.push(`Preferred services (${matchedPreferred.join(', ')}) = +${preferredPts}pts`);
  }
  
  // Business model match (max 2 pts)
  if (businessModel && allText.includes(businessModel)) {
    score += 2;
    parts.push(`Business model match = +2pts`);
  }
  
  return {
    score: Math.max(-10, Math.min(score, 30)),
    details: parts.join('; '),
    disqualified,
    disqualificationReason
  };
}

// ============= GEOGRAPHY SCORING (10 points max) =============

function calculateGeographyScore(deal: DealData, criteria: TrackerCriteria | null): {
  score: number;
  details: string;
} {
  const parts: string[] = [];
  let score = 0;
  
  const dealStates = (deal.geography || []).map(s => s.toUpperCase().trim());
  const headquarters = (deal.headquarters || '').toLowerCase();
  
  if (dealStates.length === 0 && !headquarters) {
    return { score: 3, details: 'No geography data = +3pts (default)' };
  }
  
  // Parse geography criteria
  let requiredRegions: string[] = [];
  let preferredRegions: string[] = [];
  let excludedRegions: string[] = [];
  
  if (criteria?.geography_criteria) {
    const geoCriteria = typeof criteria.geography_criteria === 'string'
      ? JSON.parse(criteria.geography_criteria)
      : criteria.geography_criteria;
    
    requiredRegions = (geoCriteria.required_regions || []).map((s: string) => s.toLowerCase());
    preferredRegions = (geoCriteria.preferred_regions || []).map((s: string) => s.toLowerCase());
    excludedRegions = (geoCriteria.excluded_regions || []).map((s: string) => s.toLowerCase());
  }
  
  // Region mapping
  const regionStates: Record<string, string[]> = {
    'southeast': ['FL', 'GA', 'AL', 'SC', 'NC', 'TN', 'MS', 'LA', 'AR', 'KY', 'VA', 'WV'],
    'texas': ['TX'],
    'california': ['CA'],
    'southwest': ['AZ', 'NM', 'NV', 'UT', 'CO'],
    'northeast': ['NY', 'NJ', 'PA', 'CT', 'MA', 'RI', 'VT', 'NH', 'ME', 'MD', 'DE'],
    'midwest': ['IL', 'IN', 'OH', 'MI', 'WI', 'MN', 'IA', 'MO', 'KS', 'NE', 'SD', 'ND'],
    'pacific': ['CA', 'OR', 'WA', 'AK', 'HI'],
    'mountain': ['MT', 'ID', 'WY', 'CO', 'UT', 'NV'],
    'oklahoma': ['OK'],
    'mid-atlantic': ['MD', 'DE', 'NJ', 'PA', 'VA', 'WV', 'DC'],
  };
  
  let inRequired = false;
  let inPreferred = false;
  let inExcluded = false;
  
  // Check regions
  for (const region of requiredRegions) {
    const statesInRegion = regionStates[region.toLowerCase()] || [];
    if (headquarters.includes(region)) {
      inRequired = true;
      parts.push(`HQ in required region`);
      break;
    }
    for (const state of dealStates) {
      if (statesInRegion.includes(state)) {
        inRequired = true;
        parts.push(`${state} in required region`);
        break;
      }
    }
    if (inRequired) break;
  }
  
  for (const region of preferredRegions) {
    const statesInRegion = regionStates[region.toLowerCase()] || [];
    for (const state of dealStates) {
      if (statesInRegion.includes(state)) {
        inPreferred = true;
        break;
      }
    }
    if (inPreferred) break;
  }
  
  for (const region of excludedRegions) {
    const statesInRegion = regionStates[region.toLowerCase()] || [];
    for (const state of dealStates) {
      if (statesInRegion.includes(state)) {
        inExcluded = true;
        parts.push(`${state} in excluded region`);
        break;
      }
    }
    if (inExcluded) break;
  }
  
  if (inExcluded) {
    score = 1;
    parts.push('= +1pt');
  } else if (inRequired) {
    score = 10;
    parts.push('= +10pts');
  } else if (inPreferred) {
    score = 7;
    parts.push('In preferred region = +7pts');
  } else if (requiredRegions.length === 0 && preferredRegions.length === 0) {
    score = 6;
    parts.push('No region criteria = +6pts');
  } else {
    score = 4;
    parts.push(`Location (${dealStates.join(', ')}) not in target = +4pts`);
  }
  
  return {
    score: Math.min(score, 10),
    details: parts.join('; ')
  };
}

// ============= DATA QUALITY SCORING (15 points max) =============

function calculateDataScore(deal: DealData): {
  score: number;
  details: string;
  fieldsPresent: string[];
} {
  let score = 0;
  const fieldsPresent: string[] = [];
  
  if (deal.revenue && deal.revenue > 0) {
    score += 3;
    fieldsPresent.push('revenue');
  }
  
  if ((deal.ebitda_amount && deal.ebitda_amount > 0) || (deal.ebitda_percentage && deal.ebitda_percentage > 0)) {
    score += 3;
    fieldsPresent.push('ebitda');
  }
  
  if (deal.owner_goals && deal.owner_goals.trim().length > 10) {
    score += 2;
    fieldsPresent.push('owner_goals');
  }
  
  if ((deal.geography && deal.geography.length > 0) || deal.headquarters) {
    score += 2;
    fieldsPresent.push('geography');
  }
  
  if (deal.service_mix && deal.service_mix.trim().length > 10) {
    score += 2;
    fieldsPresent.push('service_mix');
  }
  
  if (deal.location_count && deal.location_count > 0) {
    score += 1;
    fieldsPresent.push('locations');
  }
  
  if (deal.employee_count && deal.employee_count > 0) {
    score += 1;
    fieldsPresent.push('employees');
  }
  
  if (deal.growth_trajectory && deal.growth_trajectory.trim().length > 5) {
    score += 1;
    fieldsPresent.push('growth');
  }
  
  return { 
    score: Math.min(score, 15), 
    details: `${fieldsPresent.length} fields: ${fieldsPresent.join(', ')} = ${Math.min(score, 15)}pts`,
    fieldsPresent
  };
}

// ============= BUYER TYPE BONUS (5 points max) =============

function calculateBuyerTypeBonus(deal: DealData, criteria: TrackerCriteria | null): {
  score: number;
  details: string;
  fittingBuyerTypes: string[];
} {
  const fittingBuyerTypes: string[] = [];
  
  if (!criteria?.buyer_types_criteria) {
    return { score: 2, details: 'No buyer types defined = +2pts default', fittingBuyerTypes: [] };
  }
  
  let buyerTypes: BuyerType[] = [];
  try {
    const parsed = typeof criteria.buyer_types_criteria === 'string'
      ? JSON.parse(criteria.buyer_types_criteria)
      : criteria.buyer_types_criteria;
    buyerTypes = parsed.buyer_types || [];
  } catch (e) {
    return { score: 2, details: 'Could not parse buyer types = +2pts', fittingBuyerTypes: [] };
  }
  
  if (buyerTypes.length === 0) {
    return { score: 2, details: 'No buyer types configured = +2pts', fittingBuyerTypes: [] };
  }
  
  const dealRevenue = deal.revenue || 0;
  const dealEbitda = deal.ebitda_amount || 0;
  const dealLocations = deal.location_count || 1;
  
  for (const bt of buyerTypes) {
    let fits = true;
    
    if (bt.min_revenue && dealRevenue < bt.min_revenue / 1000000) fits = false;
    if (bt.max_revenue && dealRevenue > bt.max_revenue / 1000000) fits = false;
    if (bt.min_ebitda && dealEbitda < bt.min_ebitda / 1000000) fits = false;
    if (bt.max_ebitda && dealEbitda > bt.max_ebitda / 1000000) fits = false;
    if (bt.min_locations && dealLocations < bt.min_locations) fits = false;
    if (bt.max_locations && dealLocations > bt.max_locations) fits = false;
    
    if (fits) {
      fittingBuyerTypes.push(bt.type_name);
    }
  }
  
  let score = 0;
  if (fittingBuyerTypes.length >= 3) {
    score = 5;
  } else if (fittingBuyerTypes.length === 2) {
    score = 3;
  } else if (fittingBuyerTypes.length === 1) {
    score = 2;
  }
  
  return {
    score,
    details: fittingBuyerTypes.length > 0 
      ? `Fits ${fittingBuyerTypes.length} buyer types (${fittingBuyerTypes.slice(0, 3).join(', ')}) = +${score}pts`
      : 'Fits 0 buyer types = +0pts',
    fittingBuyerTypes
  };
}

// ============= INDUSTRY KPI BONUS (up to 15 points) =============

function calculateKPIBonus(deal: DealData, criteria: TrackerCriteria | null): {
  score: number;
  details: string;
  matchedKPIs: string[];
} {
  if (!criteria?.kpi_scoring_config || !deal.industry_kpis) {
    return { score: 0, details: 'No KPI config or data', matchedKPIs: [] };
  }
  
  let kpiConfig: any;
  try {
    kpiConfig = typeof criteria.kpi_scoring_config === 'string'
      ? JSON.parse(criteria.kpi_scoring_config)
      : criteria.kpi_scoring_config;
  } catch {
    return { score: 0, details: 'Could not parse KPI config', matchedKPIs: [] };
  }
  
  const kpis = kpiConfig.kpis || [];
  if (kpis.length === 0) {
    return { score: 0, details: 'No KPIs defined', matchedKPIs: [] };
  }
  
  let totalScore = 0;
  const matchedKPIs: string[] = [];
  const parts: string[] = [];
  
  for (const kpi of kpis) {
    const fieldName = kpi.field_name;
    const dealValue = deal.industry_kpis?.[fieldName];
    
    // Skip if deal doesn't have this KPI data - no penalty for missing data
    if (dealValue === undefined || dealValue === null) continue;
    
    const weight = kpi.weight || 5;
    const rules = kpi.scoring_rules || {};
    let kpiScore = 0;
    
    // Apply scoring rules
    if (rules.ideal_range && Array.isArray(rules.ideal_range) && rules.ideal_range.length === 2) {
      const [min, max] = rules.ideal_range;
      const numValue = typeof dealValue === 'number' ? dealValue : parseFloat(dealValue);
      
      if (!isNaN(numValue)) {
        if (numValue >= min && numValue <= max) {
          kpiScore = weight; // Full points for ideal range
          parts.push(`${kpi.display_name || fieldName}: ${numValue} (ideal) = +${weight}pts`);
        } else if (rules.penalty_below && numValue < min) {
          kpiScore = Math.max(0, weight - rules.penalty_below);
          parts.push(`${kpi.display_name || fieldName}: ${numValue} (below) = +${kpiScore}pts`);
        } else if (rules.penalty_above && numValue > max) {
          kpiScore = Math.max(0, weight - rules.penalty_above);
          parts.push(`${kpi.display_name || fieldName}: ${numValue} (above) = +${kpiScore}pts`);
        } else {
          kpiScore = Math.round(weight * 0.5); // Partial credit
          parts.push(`${kpi.display_name || fieldName}: ${numValue} = +${kpiScore}pts`);
        }
      }
    } else if (rules.bonus_per_item) {
      // For array/count-based KPIs
      const count = Array.isArray(dealValue) ? dealValue.length : (typeof dealValue === 'number' ? dealValue : 1);
      const maxBonus = rules.max_bonus || weight;
      kpiScore = Math.min(count * rules.bonus_per_item, maxBonus);
      parts.push(`${kpi.display_name || fieldName}: ${count} items = +${kpiScore}pts`);
    } else if (rules.boolean && dealValue === true) {
      kpiScore = weight;
      parts.push(`${kpi.display_name || fieldName}: Yes = +${weight}pts`);
    }
    
    if (kpiScore > 0) {
      totalScore += kpiScore;
      matchedKPIs.push(fieldName);
    }
  }
  
  return {
    score: Math.min(totalScore, 15), // Cap at 15 points
    details: parts.length > 0 ? parts.join('; ') : 'No KPI matches',
    matchedKPIs
  };
}

// ============= CRITERIA VALIDATION =============

interface CriteriaValidationResult {
  isValid: boolean;
  status: 'ready' | 'needs_review' | 'insufficient_data';
  hasPrimaryFocus: boolean;
  hasSize: boolean;
  hasService: boolean;
  hasBuyerTypes: boolean;
  missingCriteria: string[];
  message: string;
}

function validateTrackerCriteria(criteria: TrackerCriteria | null): CriteriaValidationResult {
  const missingCriteria: string[] = [];
  
  if (!criteria) {
    return {
      isValid: false,
      status: 'insufficient_data',
      hasPrimaryFocus: false,
      hasSize: false,
      hasService: false,
      hasBuyerTypes: false,
      missingCriteria: ['all'],
      message: 'No tracker criteria configured'
    };
  }
  
  // Check size criteria
  const hasSize = !!(criteria.size_criteria && (
    criteria.size_criteria.min_revenue || 
    criteria.size_criteria.min_ebitda
  ));
  if (!hasSize) missingCriteria.push('size_criteria');
  
  // Check service criteria - CRITICAL: primary_focus
  let hasPrimaryFocus = false;
  let hasService = false;
  
  if (criteria.service_criteria) {
    const svc = typeof criteria.service_criteria === 'string'
      ? JSON.parse(criteria.service_criteria)
      : criteria.service_criteria;
    
    hasPrimaryFocus = !!(svc.primary_focus && Array.isArray(svc.primary_focus) && svc.primary_focus.length > 0);
    hasService = hasPrimaryFocus || !!(svc.required_services && svc.required_services.length > 0);
  }
  
  if (!hasPrimaryFocus) missingCriteria.push('primary_focus');
  if (!hasService) missingCriteria.push('service_criteria');
  
  // Check buyer types
  let hasBuyerTypes = false;
  if (criteria.buyer_types_criteria) {
    const bt = typeof criteria.buyer_types_criteria === 'string'
      ? JSON.parse(criteria.buyer_types_criteria)
      : criteria.buyer_types_criteria;
    hasBuyerTypes = !!(bt.buyer_types && bt.buyer_types.length > 0);
  }
  if (!hasBuyerTypes) missingCriteria.push('buyer_types');
  
  // Determine status
  let status: 'ready' | 'needs_review' | 'insufficient_data';
  let message: string;
  
  if (hasSize && hasPrimaryFocus && hasBuyerTypes) {
    status = 'ready';
    message = 'Criteria complete - scoring will be accurate';
  } else if (hasSize || hasPrimaryFocus) {
    status = 'needs_review';
    message = `Partial criteria: missing ${missingCriteria.join(', ')}. Results may be less accurate.`;
  } else {
    status = 'insufficient_data';
    message = `Insufficient criteria for accurate scoring: missing ${missingCriteria.join(', ')}`;
  }
  
  console.log(`[score-deal v6.1] Criteria validation: ${status} - ${message}`);
  
  return {
    isValid: status !== 'insufficient_data',
    status,
    hasPrimaryFocus,
    hasSize,
    hasService,
    hasBuyerTypes,
    missingCriteria,
    message
  };
}

// ============= MAIN SCORING FUNCTION =============

async function scoreDeal(deal: DealData, supabase: any): Promise<ScoreBreakdown & { criteriaStatus?: CriteriaValidationResult }> {
  let trackerCriteria: TrackerCriteria | null = null;
  
  try {
    const { data: tracker } = await supabase
      .from('industry_trackers')
      .select(`
        industry_name,
        fit_criteria_size, fit_criteria_service, fit_criteria_geography, 
        size_criteria, service_criteria, geography_criteria, buyer_types_criteria,
        kpi_scoring_config,
        geography_weight, service_mix_weight, size_weight, owner_goals_weight
      `)
      .eq('id', deal.tracker_id)
      .single();
    
    if (tracker) {
      trackerCriteria = tracker;
      console.log(`[score-deal v6.1] Using tracker criteria for industry: ${tracker.industry_name}`);
    }
  } catch (e) {
    console.log('[score-deal v6.1] Could not fetch tracker criteria');
  }
  
  // STEP 0: Validate criteria completeness
  const criteriaValidation = validateTrackerCriteria(trackerCriteria);
  
  // Parse service criteria for dynamic detection
  let serviceCriteria: any = null;
  if (trackerCriteria?.service_criteria) {
    try {
      serviceCriteria = typeof trackerCriteria.service_criteria === 'string'
        ? JSON.parse(trackerCriteria.service_criteria)
        : trackerCriteria.service_criteria;
    } catch { /* ignore */ }
  }
  
  // STEP 1: Detect primary service using tracker-defined focus keywords
  const primaryServiceInfo = detectPrimaryService(deal, serviceCriteria);
  console.log(`[score-deal v6.1] Primary service: ${primaryServiceInfo.primaryService} (on-focus: ${primaryServiceInfo.isOnFocus}, ${primaryServiceInfo.confidence}) - ${primaryServiceInfo.reasoning}`);
  
  // STEP 2: Calculate all scores
  const size = calculateSizeScore(deal, trackerCriteria);
  const service = calculateServiceScore(deal, trackerCriteria, primaryServiceInfo);
  const geography = calculateGeographyScore(deal, trackerCriteria);
  const data = calculateDataScore(deal);
  const buyerTypeBonus = calculateBuyerTypeBonus(deal, trackerCriteria);
  const kpiBonus = calculateKPIBonus(deal, trackerCriteria);
  
  // Collect disqualifications
  const disqualificationReasons: string[] = [];
  if (size.disqualified && size.disqualificationReason) {
    disqualificationReasons.push(size.disqualificationReason);
  }
  if (service.disqualified && service.disqualificationReason) {
    disqualificationReasons.push(service.disqualificationReason);
  }
  
  // Add criteria warnings to disqualification reasons if insufficient
  if (criteriaValidation.status === 'insufficient_data') {
    disqualificationReasons.push(`SCORING LIMITED: ${criteriaValidation.message}`);
  }
  
  const isDisqualified = size.disqualified || service.disqualified;
  
  // Calculate total (100 pts max + up to 15 KPI bonus)
  let rawTotal = size.score + service.score + geography.score + data.score + buyerTypeBonus.score + kpiBonus.score;
  
  if (isDisqualified) {
    rawTotal = Math.min(rawTotal, 25);
  }
  
  const totalScore = Math.max(0, Math.min(rawTotal, 115)); // Allow up to 115 with KPI bonus
  
  console.log(`[score-deal v6.1] ${deal.deal_name}: Size=${size.score}/40, Service=${service.score}/30, Geo=${geography.score}/10, Data=${data.score}/15, Bonus=${buyerTypeBonus.score}/5, KPI=${kpiBonus.score}/15 = ${totalScore} (Criteria: ${criteriaValidation.status})`);
  
  return {
    sizeScore: size.score,
    sizeDetails: size.details,
    serviceScore: service.score,
    serviceDetails: service.details,
    geographyScore: geography.score,
    geographyDetails: geography.details,
    dataScore: data.score,
    dataDetails: data.details,
    buyerTypeBonusScore: buyerTypeBonus.score,
    buyerTypeBonusDetails: buyerTypeBonus.details,
    kpiBonusScore: kpiBonus.score,
    kpiBonusDetails: kpiBonus.details,
    totalScore,
    scoringVersion: '6.1-fail-safe',
    disqualified: isDisqualified,
    disqualificationReasons,
    primaryService: primaryServiceInfo.primaryService,
    criteriaStatus: criteriaValidation
  };
}

// ============= HTTP HANDLER =============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dealId } = await req.json();
    
    if (!dealId) {
      return new Response(
        JSON.stringify({ success: false, error: 'dealId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[score-deal v6.1] Scoring deal:', dealId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, supabaseKey);

    const { data: deal, error: fetchError } = await serviceClient
      .from('deals')
      .select(`
        id, deal_name, tracker_id, revenue, ebitda_amount, ebitda_percentage, 
        owner_goals, geography, headquarters, location_count, employee_count,
        additional_info, service_mix, growth_trajectory, real_estate, 
        customer_concentration, company_overview, industry_kpis
      `)
      .eq('id', dealId)
      .single();

    if (fetchError || !deal) {
      console.error('[score-deal v6.1] Deal not found:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Deal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const breakdown = await scoreDeal(deal as DealData, serviceClient);
    
    console.log('[score-deal v6.1] Score breakdown:', JSON.stringify({
      score: breakdown.totalScore,
      criteriaStatus: breakdown.criteriaStatus?.status,
      primaryService: breakdown.primaryService
    }));

    const { error: updateError } = await serviceClient
      .from('deals')
      .update({ 
        deal_score: breakdown.totalScore,
        updated_at: new Date().toISOString()
      })
      .eq('id', dealId);

    if (updateError) {
      console.error('[score-deal v6.1] Update failed:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save score' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[score-deal v6.1] Scored:', deal.deal_name, '=', breakdown.totalScore, `(criteria: ${breakdown.criteriaStatus?.status})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        score: breakdown.totalScore,
        criteriaStatus: breakdown.criteriaStatus,
        breakdown 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[score-deal v6.1] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
