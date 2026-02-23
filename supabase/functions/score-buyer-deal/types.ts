/**
 * Shared type definitions for the scoring engine.
 * Replaces all `: any` annotations with proper interfaces.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type { SupabaseClient };

// ============================================================================
// REQUEST TYPES
// ============================================================================

export interface ScoreRequest {
  listingId: string;
  buyerId: string;
  universeId: string;
  customInstructions?: string;
  geographyMode?: 'critical' | 'preferred' | 'minimal';
}

export interface BulkScoreRequest {
  listingId: string;
  universeId: string;
  buyerIds?: string[];
  customInstructions?: string;
  geographyMode?: 'critical' | 'preferred' | 'minimal';
  options?: {
    rescoreExisting?: boolean;
    minDataCompleteness?: 'high' | 'medium' | 'low';
  };
}

// ============================================================================
// DOMAIN ENTITY TYPES
// ============================================================================

/** Listing/deal record from the listings table */
export interface Listing {
  id: string;
  title?: string;
  revenue?: number | null;
  ebitda?: number | null;
  location?: string | null;
  category?: string | null;
  categories?: string[] | null;
  services?: string[] | null;
  description?: string | null;
  hero_description?: string | null;
  executive_summary?: string | null;
  location_count?: number | null;
  owner_goals?: string | null;
  seller_motivation?: string | null;
  transition_preferences?: string | null;
  timeline_preference?: string | null;
  special_requirements?: string | null;
  ownership_structure?: string | null;
  asking_price?: number | null;
  internal_company_name?: string | null;
  image_url?: string | null;
  [key: string]: unknown;
}

/** Buyer record from the remarketing_buyers table */
export interface Buyer {
  id: string;
  company_name?: string | null;
  pe_firm_name?: string | null;
  company_website?: string | null;
  pe_firm_website?: string | null;
  platform_website?: string | null;
  buyer_type?: string | null;
  thesis_summary?: string | null;
  thesis_confidence?: string | null;
  industry_vertical?: string | null;
  industry_tracker_id?: string | null;
  target_services?: string[] | null;
  services_offered?: string | null;
  target_industries?: string[] | null;
  target_geographies?: string[] | null;
  geographic_footprint?: string[] | null;
  geographic_exclusions?: string[] | null;
  operating_locations?: string[] | null;
  service_regions?: string[] | null;
  customer_geographic_reach?: string | null;
  hq_state?: string | null;
  hq_city?: string | null;
  hq_country?: string | null;
  target_revenue_min?: number | null;
  target_revenue_max?: number | null;
  target_ebitda_min?: number | null;
  target_ebitda_max?: number | null;
  industry_exclusions?: string[] | null;
  recent_acquisitions?: unknown[] | null;
  portfolio_companies?: unknown[] | null;
  total_acquisitions?: number | null;
  acquisition_appetite?: string | null;
  acquisition_timeline?: string | null;
  acquisition_frequency?: string | null;
  extraction_sources?: unknown[] | null;
  data_completeness?: string | null;
  data_last_updated?: string | null;
  archived?: boolean;
  [key: string]: unknown;
}

/** Industry tracker record */
export interface IndustryTracker {
  id: string;
  name?: string | null;
  industry?: string | null;
  geography_mode?: string | null;
  service_adjacency_map?: Record<string, string[]> | null;
  service_criteria?: ServiceCriteria | null;
  scoring_behavior?: ScoringBehavior | null;
  [key: string]: unknown;
}

/** Buyer universe record */
export interface Universe {
  id: string;
  scoring_behavior?: ScoringBehavior | null;
  service_criteria?: ServiceCriteria | null;
  size_weight?: number | null;
  geography_weight?: number | null;
  service_weight?: number | null;
  owner_goals_weight?: number | null;
  [key: string]: unknown;
}

// ============================================================================
// SCORING BEHAVIOR & CRITERIA TYPES
// ============================================================================

export interface ScoringBehavior {
  industry_preset?: string;
  geography_strictness?: 'strict' | 'moderate' | 'flexible';
  single_location_matching?: string;
  multi_location_matching?: string;
  allow_national_buyers?: boolean;
  size_strictness?: 'strict' | 'moderate' | 'flexible';
  below_minimum_handling?: 'disqualify' | 'penalize' | 'allow';
  penalize_single_location?: boolean;
  service_matching_mode?: 'keyword' | 'semantic' | 'hybrid';
  require_primary_focus?: boolean;
  excluded_services_dealbreaker?: boolean;
  can_override_geography?: boolean;
  can_override_size?: boolean;
  engagement_weight_multiplier?: number;
  boost_adjacency?: boolean;
  penalize_distance?: boolean;
  require_thesis_match?: boolean;
  minimum_data_completeness?: string;
}

export interface SizeCriteria {
  revenue_min?: number;
  revenue_max?: number;
  ebitda_min?: number;
  ebitda_max?: number;
  locations_min?: number;
  locations_max?: number;
}

export interface GeographyCriteria {
  target_states?: string[];
  target_regions?: string[];
  exclude_states?: string[];
  coverage?: string;
}

export interface ServiceCriteria {
  required_services?: string[];
  preferred_services?: string[];
  excluded_services?: string[];
  primary_focus?: string[];
  business_model?: string;
}

// ============================================================================
// SCORING RESULT TYPES
// ============================================================================

export interface LearningPattern {
  buyer_id: string;
  approvalRate: number;
  avgScoreOnApproved: number;
  avgScoreOnPassed: number;
  totalActions: number;
  passCategories: Record<string, number>;
}

export interface ScoredResult {
  listing_id: string;
  buyer_id: string;
  universe_id: string;
  composite_score: number;
  geography_score: number;
  size_score: number;
  service_score: number;
  owner_goals_score: number;
  acquisition_score: number;
  portfolio_score: number;
  business_model_score: number;
  size_multiplier: number;
  service_multiplier: number;
  geography_mode_factor: number;
  thesis_alignment_bonus: number;
  data_quality_bonus: number;
  custom_bonus: number;
  learning_penalty: number;
  tier: string;
  is_disqualified: boolean;
  disqualification_reason: string | null;
  needs_review: boolean;
  missing_fields: string[];
  confidence_level: string;
  fit_reasoning: string;
  data_completeness: string;
  status: string;
  scored_at: string;
  deal_snapshot: object;
}

/** Per-phase result types */
export interface SizeResult {
  score: number;
  multiplier: number;
  reasoning: string;
}

export interface GeographyResult {
  score: number;
  modeFactor: number;
  reasoning: string;
  tier: string;
}

export interface ServiceResult {
  score: number;
  multiplier: number;
  reasoning: string;
}

export interface OwnerGoalsResult {
  score: number;
  confidence: string;
  reasoning: string;
}

export interface ThesisResult {
  bonus: number;
  reasoning: string;
}

export interface DataQualityResult {
  bonus: number;
  details: string[];
}

export interface LearningResult {
  penalty: number;
  note: string;
}

export interface CustomInstructionResult {
  bonus: number;
  reasoning: string;
  disqualify?: boolean;
}

export interface DataCompletenessResult {
  level: string;
  missingFields: string[];
  provenanceWarnings: string[];
}

/** Scoring adjustment record from deal_scoring_adjustments table */
export interface ScoringAdjustment {
  id: string;
  listing_id: string;
  adjustment_type: 'boost' | 'penalize' | 'disqualify';
  adjustment_value: number;
  reason?: string | null;
  [key: string]: unknown;
}

/** Learning history record from buyer_learning_history table */
export interface LearningHistoryRecord {
  buyer_id: string;
  action: string;
  composite_score?: number | null;
  pass_category?: string | null;
}
