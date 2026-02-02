import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =============================================================================
// CRITERIA INTERFACES (mirrors src/lib/criteriaSchema.ts)
// =============================================================================
interface SizeCriteria {
  min_revenue?: number;
  max_revenue?: number;
  min_ebitda?: number;
  max_ebitda?: number;
  min_locations?: number;
  max_locations?: number;
}

interface ServiceCriteria {
  primary_focus: string[];
  required_services: string[];
  preferred_services: string[];
  excluded_services: string[];
  business_model?: string;
}

interface GeographyCriteria {
  required_regions: string[];
  preferred_regions: string[];
  excluded_regions: string[];
  priority_metros: string[];
}

interface BuyerType {
  type_name: string;
  priority_order: number;
  min_ebitda?: number;
  max_ebitda?: number;
  min_locations?: number;
  geographic_scope?: string;
}

interface BuyerTypesCriteria {
  buyer_types: BuyerType[];
}

interface TrackerCriteria {
  size_criteria: SizeCriteria | null;
  service_criteria: ServiceCriteria | null;
  geography_criteria: GeographyCriteria | null;
  buyer_types_criteria: BuyerTypesCriteria | null;
}

interface ValidationResult {
  isValid: boolean;
  status: 'complete' | 'partial' | 'insufficient';
  completenessScore: number;
  missingFields: string[];
  warnings: string[];
  details: {
    hasSize: boolean;
    hasService: boolean;
    hasGeography: boolean;
    hasBuyerTypes: boolean;
    hasPrimaryFocus: boolean;
    sizeFieldsPresent: string[];
    serviceFieldsPresent: string[];
    buyerTypesCount: number;
  };
  recommendations: string[];
}

// =============================================================================
// VALIDATION LOGIC
// =============================================================================
function validateCriteria(criteria: TrackerCriteria): ValidationResult {
  const missingFields: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  // Check size criteria
  const sizeFieldsPresent: string[] = [];
  const hasSize = !!(criteria.size_criteria && (
    criteria.size_criteria.min_revenue || 
    criteria.size_criteria.min_ebitda
  ));
  
  if (criteria.size_criteria) {
    if (criteria.size_criteria.min_revenue) sizeFieldsPresent.push('min_revenue');
    if (criteria.size_criteria.max_revenue) sizeFieldsPresent.push('max_revenue');
    if (criteria.size_criteria.min_ebitda) sizeFieldsPresent.push('min_ebitda');
    if (criteria.size_criteria.max_ebitda) sizeFieldsPresent.push('max_ebitda');
    if (criteria.size_criteria.min_locations) sizeFieldsPresent.push('min_locations');
  }
  
  if (!hasSize) {
    missingFields.push('size_criteria');
    recommendations.push('Add minimum revenue and EBITDA thresholds to filter deals by size');
  }
  
  // Check service criteria - CRITICAL: primary_focus
  const serviceFieldsPresent: string[] = [];
  const hasPrimaryFocus = !!(
    criteria.service_criteria?.primary_focus && 
    criteria.service_criteria.primary_focus.length > 0
  );
  
  const hasService = !!(criteria.service_criteria && (
    hasPrimaryFocus || 
    (criteria.service_criteria.required_services?.length || 0) > 0
  ));
  
  if (criteria.service_criteria) {
    if (hasPrimaryFocus) serviceFieldsPresent.push('primary_focus');
    if (criteria.service_criteria.required_services?.length) serviceFieldsPresent.push('required_services');
    if (criteria.service_criteria.preferred_services?.length) serviceFieldsPresent.push('preferred_services');
    if (criteria.service_criteria.excluded_services?.length) serviceFieldsPresent.push('excluded_services');
  }
  
  if (!hasPrimaryFocus) {
    missingFields.push('primary_focus');
    warnings.push('CRITICAL: No primary_focus defined - cannot identify on-thesis vs off-thesis deals');
    recommendations.push('Define primary_focus services (e.g., [\\"collision repair\\", \\"auto body\\"]) to enable accurate service matching');
  }
  
  if (!criteria.service_criteria?.excluded_services?.length) {
    warnings.push('No excluded_services defined - cannot filter out off-thesis deals');
    recommendations.push('Add excluded_services to prevent matching with off-thesis businesses');
  }
  
  if (!hasService) {
    missingFields.push('service_criteria');
  }
  
  // Check geography criteria
  const hasGeography = !!(
    criteria.geography_criteria && (
      (criteria.geography_criteria.required_regions?.length || 0) > 0 ||
      (criteria.geography_criteria.preferred_regions?.length || 0) > 0
    )
  );
  
  if (!hasGeography) {
    missingFields.push('geography_criteria');
    recommendations.push('Add preferred geographic regions to focus on target markets');
  }
  
  // Check buyer types
  const hasBuyerTypes = !!(
    criteria.buyer_types_criteria?.buyer_types && 
    criteria.buyer_types_criteria.buyer_types.length > 0
  );
  
  const buyerTypesCount = criteria.buyer_types_criteria?.buyer_types?.length || 0;
  
  if (!hasBuyerTypes) {
    missingFields.push('buyer_types');
    recommendations.push('Define buyer types (e.g., \\"Large National Platforms\\", \\"Regional MSOs\\") for better deal-buyer matching');
  } else if (buyerTypesCount < 3) {
    warnings.push(`Only ${buyerTypesCount} buyer types defined - consider adding more for better coverage`);
  }
  
  // Calculate completeness score
  let score = 0;
  if (hasSize) score += 25;
  if (hasService) score += 15;
  if (hasPrimaryFocus) score += 20; // Critical - extra weight
  if (hasGeography) score += 20;
  if (hasBuyerTypes) score += 20;
  
  // Determine status
  let status: 'complete' | 'partial' | 'insufficient';
  if (score >= 80 && hasPrimaryFocus) {
    status = 'complete';
  } else if (score >= 40 || hasPrimaryFocus) {
    status = 'partial';
  } else {
    status = 'insufficient';
  }
  
  // Log for debugging
  console.log(`[validate-criteria] Score: ${score}, Status: ${status}, Missing: ${missingFields.join(', ')}`);
  
  return {
    isValid: status !== 'insufficient',
    status,
    completenessScore: score,
    missingFields,
    warnings,
    details: {
      hasSize,
      hasService,
      hasGeography,
      hasBuyerTypes,
      hasPrimaryFocus,
      sizeFieldsPresent,
      serviceFieldsPresent,
      buyerTypesCount,
    },
    recommendations,
  };
}

// =============================================================================
// PARSING UTILITIES
// =============================================================================
function parseCriteria(raw: any): TrackerCriteria {
  return {
    size_criteria: parseJSON(raw.size_criteria),
    service_criteria: parseServiceCriteria(raw.service_criteria),
    geography_criteria: parseJSON(raw.geography_criteria),
    buyer_types_criteria: parseJSON(raw.buyer_types_criteria),
  };
}

function parseJSON(val: any): any {
  if (!val) return null;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return null;
    }
  }
  return val;
}

function parseServiceCriteria(raw: any): ServiceCriteria | null {
  if (!raw) return null;
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  
  // Handle multiple field name variations
  return {
    primary_focus: ensureArray(data.primary_focus || data.primaryFocusServices || data.primaryFocus),
    required_services: ensureArray(data.required_services),
    preferred_services: ensureArray(data.preferred_services),
    excluded_services: ensureArray(data.excluded_services || data.excludedServices),
    business_model: data.business_model,
  };
}

function ensureArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [val];
    } catch {
      return [val];
    }
  }
  return [];
}

// =============================================================================
// HTTP HANDLER
// =============================================================================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      size_criteria, 
      service_criteria, 
      geography_criteria, 
      buyer_types_criteria,
      tracker_id 
    } = await req.json();

    // If tracker_id provided, fetch criteria from DB
    if (tracker_id) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Missing authorization header' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: tracker, error } = await supabase
        .from('industry_trackers')
        .select('size_criteria, service_criteria, geography_criteria, buyer_types_criteria')
        .eq('id', tracker_id)
        .single();

      if (error || !tracker) {
        return new Response(
          JSON.stringify({ error: 'Tracker not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const criteria = parseCriteria(tracker);
      const result = validateCriteria(criteria);

      return new Response(
        JSON.stringify({ success: true, validation: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Otherwise validate provided criteria
    const criteria = parseCriteria({
      size_criteria,
      service_criteria,
      geography_criteria,
      buyer_types_criteria,
    });

    const result = validateCriteria(criteria);

    console.log(`[validate-criteria] Result: ${JSON.stringify(result)}`);

    return new Response(
      JSON.stringify({ success: true, validation: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[validate-criteria] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
