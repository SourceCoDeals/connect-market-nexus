// M&A Intelligence Domain Types
//
// IMPORTANT: Canonical type definitions are in src/types/remarketing.ts
// This file re-exports them for backward compatibility and adds
// M&A Intelligence-specific types that extend the base types.

// Import and re-export canonical types from the main types file
import type {
  SizeCriteria as BaseSizeCriteria,
  ServiceCriteria as BaseServiceCriteria,
  GeographyCriteria as BaseGeographyCriteria,
  BuyerTypesCriteria as BaseBuyerTypesCriteria,
  ScoringBehavior as BaseScoringBehavior,
  AcquisitionRecord as BaseAcquisitionRecord,
  ExtractionSource as BaseExtractionSource,
  DataCompleteness,
  ThesisConfidence,
  ScoreTier,
  ScoreStatus,
} from '@/types/remarketing';

// Re-export with aliases for use in this file
export type SizeCriteria = BaseSizeCriteria;
export type ServiceCriteria = BaseServiceCriteria;
export type GeographyCriteria = BaseGeographyCriteria;
export type BuyerTypesCriteria = BaseBuyerTypesCriteria;
export type ScoringBehavior = BaseScoringBehavior;
export type ExtractionSource = BaseExtractionSource;
export type { DataCompleteness, ThesisConfidence, ScoreTier, ScoreStatus };

// Tracker document type (specific to M&A Intelligence)
export interface TrackerDocument {
  name: string;
  url: string;
  type: string;
  uploadedAt: string;
}

// Buyer type config for M&A Intelligence preferences
export interface BuyerTypeConfig {
  type: string;
  min_locations?: number;
  min_revenue?: number;
  min_ebitda?: number;
  description?: string;
}

// ============================================================
// BUYER TYPES
// ============================================================

export interface MABuyer {
  id: string;
  tracker_id: string;
  pe_firm_name: string;
  pe_firm_website: string | null;
  pe_firm_linkedin: string | null;
  platform_company_name: string | null;
  platform_website: string | null;
  buyer_linkedin: string | null;
  hq_city: string | null;
  hq_state: string | null;
  hq_country: string | null;
  hq_region: string | null;
  other_office_locations: string[] | null;
  business_summary: string | null;
  industry_vertical: string | null;
  business_type: string | null;
  services_offered: string | null;
  business_model: string | null;
  revenue_model: string | null;
  go_to_market_strategy: string | null;
  num_platforms: number | null;
  total_acquisitions: number | null;
  last_acquisition_date: string | null;
  acquisition_frequency: string | null;
  acquisition_appetite: string | null;
  acquisition_timeline: string | null;
  recent_acquisitions: AcquisitionRecord[] | null;
  portfolio_companies: string[] | null;
  min_revenue: number | null;
  max_revenue: number | null;
  min_ebitda: number | null;
  max_ebitda: number | null;
  preferred_ebitda: number | null;
  target_geographies: string[] | null;
  geographic_footprint: string[] | null;
  geographic_exclusions: string[] | null;
  acquisition_geography: string[] | null;
  service_regions: string[] | null;
  target_services: string[] | null;
  target_industries: string[] | null;
  industry_exclusions: string[] | null;
  required_capabilities: string[] | null;
  target_business_model: string | null;
  business_model_exclusions: string[] | null;
  primary_customer_size: string | null;
  customer_industries: string[] | null;
  customer_geographic_reach: string | null;
  target_customer_profile: string | null;
  target_customer_size: string | null;
  target_customer_industries: string[] | null;
  target_customer_geography: string | null;
  thesis_summary: string | null;
  thesis_confidence: 'High' | 'Medium' | 'Low' | null;
  service_mix_prefs: string | null;
  business_model_prefs: string | null;
  geo_preferences: GeoPreferences | null;
  operating_locations: OperatingLocation[] | null;
  extraction_evidence: Record<string, unknown> | null;
  extraction_sources: Record<string, FieldSource> | null;
  owner_roll_requirement: string | null;
  owner_transition_goals: string | null;
  employee_owner: string | null;
  addon_only: boolean | null;
  platform_only: boolean | null;
  has_fee_agreement: boolean | null;
  fee_agreement_status: 'Active' | 'Expired' | 'None' | null;
  last_call_date: string | null;
  call_history: CallRecord[] | null;
  created_at: string;
  data_last_updated: string;
  notes: string | null;
  notes_analyzed_at: string | null;
}

export interface AcquisitionRecord {
  company: string;
  date?: string;
  location?: string;
  description?: string;
}

export interface GeoPreferences {
  preferred?: string[];
  avoided?: string[];
  notes?: string;
}

export interface OperatingLocation {
  state?: string;
  city?: string;
  region?: string;
}

export interface FieldSource {
  source: 'transcript' | 'notes' | 'website' | 'csv' | 'manual';
  updated_at: string;
  confidence?: 'high' | 'medium' | 'low';
}

export interface CallRecord {
  url?: string;
  date?: string;
  notes?: string;
}

// ============================================================
// DEAL TYPES
// ============================================================

export interface MADeal {
  id: string;
  tracker_id: string;
  company_id: string | null;
  deal_name: string;
  status: string | null;
  deal_score: number | null;
  company_website: string | null;
  company_overview: string | null;
  company_address: string | null;
  headquarters: string | null;
  industry_type: string | null;
  founded_year: number | null;
  employee_count: number | null;
  location_count: number | null;
  ownership_structure: string | null;
  revenue: number | null;
  revenue_confidence: string | null;
  revenue_is_inferred: boolean | null;
  revenue_source_quote: string | null;
  ebitda_amount: number | null;
  ebitda_percentage: number | null;
  ebitda_confidence: string | null;
  ebitda_is_inferred: boolean | null;
  ebitda_source_quote: string | null;
  financial_notes: string | null;
  financial_followup_questions: string[] | null;
  geography: string[] | null;
  service_mix: string | null;
  business_model: string | null;
  end_market_customers: string | null;
  customer_concentration: string | null;
  customer_geography: string | null;
  owner_goals: string | null;
  special_requirements: string | null;
  contact_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_linkedin: string | null;
  additional_info: string | null;
  transcript_link: string | null;
  key_risks: string[] | null;
  competitive_position: string | null;
  technology_systems: string | null;
  real_estate: string | null;
  growth_trajectory: string | null;
  industry_kpis: Record<string, unknown> | null;
  extraction_sources: Record<string, FieldSource> | null;
  last_enriched_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// SCORING TYPES
// ============================================================

export interface BuyerDealScore {
  id: string;
  buyer_id: string;
  deal_id: string;
  scored_at: string;
  geography_score: number | null;
  service_score: number | null;
  acquisition_score: number | null;
  portfolio_score: number | null;
  business_model_score: number | null;
  thesis_bonus: number | null;
  composite_score: number | null;
  fit_reasoning: string | null;
  data_completeness: 'High' | 'Medium' | 'Low' | null;
  selected_for_outreach: boolean | null;
  human_override_score: number | null;
  passed_on_deal: boolean | null;
  passed_at: string | null;
  pass_category: string | null;
  pass_reason: string | null;
  pass_notes: string | null;
  interested: boolean | null;
  interested_at: string | null;
  hidden_from_deal: boolean | null;
  rejected_at: string | null;
  rejection_category: string | null;
  rejection_reason: string | null;
  rejection_notes: string | null;
}

// ============================================================
// TRACKER TYPES
// ============================================================

export interface IndustryTracker {
  id: string;
  name: string;
  industry_name?: string;
  size_criteria?: SizeCriteria;
  service_criteria?: ServiceCriteria;
  geography_criteria?: GeographyCriteria;
  buyer_types_criteria?: BuyerTypesCriteria;
  kpi_scoring_config?: KPIScoringConfig;
  geography_weight?: number;
  service_mix_weight?: number;
  size_weight?: number;
  owner_goals_weight?: number;
  archived?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface KPIScoringConfig {
  kpis: Array<{
    name: string;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
    threshold: number;
    points: number;
    unit?: string;
  }>;
}

// ============================================================
// PE FIRM HIERARCHY TYPES
// ============================================================

export interface PEFirm {
  id: string;
  name: string;
  website?: string;
  linkedin?: string;
  platforms: Platform[];
}

export interface Platform {
  id: string;
  pe_firm_id: string;
  name: string;
  website?: string;
}

// ============================================================
// OUTREACH TRACKING
// ============================================================

export interface OutreachRecord {
  id: string;
  buyer_id: string;
  deal_id: string;
  sent_at: string;
  email_subject?: string;
  email_body?: string;
  response_received?: boolean;
}

// ============================================================
// DOCUMENT MANAGEMENT
// ============================================================

export interface DealTranscript {
  id: string;
  deal_id: string;
  title: string;
  transcript_type: 'link' | 'upload' | 'call';
  url?: string;
  notes?: string;
  call_date?: string;
  created_at: string;
  extracted_data?: Record<string, any>;
  extraction_evidence?: Record<string, any>;
  processed_at?: string;
}

export interface BuyerTranscript {
  id: string;
  buyer_id: string;
  title: string;
  transcript_type: 'link' | 'upload' | 'call';
  url?: string;
  notes?: string;
  call_date?: string;
  created_at: string;
  extracted_data?: Record<string, any>;
  extraction_evidence?: Record<string, any>;
  processed_at?: string;
}

// ============================================================
// ENRICHMENT PROGRESS TRACKING
// ============================================================

export interface EnrichmentProgress {
  current: number;
  total: number;
  isPaused: boolean;
  completedIds: string[];
}

export interface BulkOperationProgress {
  operation: 'enrich' | 'score';
  current: number;
  total: number;
  isPaused: boolean;
  completedIds: string[];
  failedIds: string[];
  startedAt: string;
}

// ============================================================
// DEDUPLICATION
// ============================================================

export interface DedupeGroup {
  strategy: 'pe_firm' | 'website' | 'platform';
  buyers: MABuyer[];
  recommendedBuyerId: string;
}

export interface DedupePreview {
  buyerToKeep: MABuyer;
  buyersToMerge: MABuyer[];
  completenessScores: Record<string, number>;
}

// ============================================================
// UI HELPER TYPES & FUNCTIONS
// ============================================================

export type MatchQuality = 'high' | 'medium' | 'low';
export type IntelligenceCoverage = 'high' | 'medium' | 'low';
export type ViewMode = 'all' | 'pe_firms' | 'platforms';

export function getMatchQuality(score: number): MatchQuality {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}

export function getIntelligenceCoverage(buyer: Partial<MABuyer>): IntelligenceCoverage {
  const fields = [
    buyer.thesis_summary,
    buyer.geo_preferences,
    buyer.min_revenue,
    buyer.max_revenue,
    buyer.preferred_ebitda,
    buyer.service_mix_prefs,
    buyer.business_model_prefs,
  ];

  const filledFields = fields.filter(f => f !== null && f !== undefined && (Array.isArray(f) ? f.length > 0 : true)).length;
  const coverage = filledFields / fields.length;

  if (coverage >= 0.7) return 'high';
  if (coverage >= 0.4) return 'medium';
  return 'low';
}

/**
 * Calculate the intelligence percentage for a single buyer.
 * 
 * Two-tier system:
 * - Website data (data fields filled) can contribute up to 50%
 * - Transcript data is required to go above 50%
 * 
 * @param buyer - The buyer to evaluate
 * @param hasTranscript - Whether the buyer has a call transcript
 * @returns Intelligence percentage (0-100)
 */
export function calculateIntelligencePercentage(buyer: Partial<MABuyer>, hasTranscript: boolean = false): number {
  // Fields that can be populated from website enrichment
  const websiteFields = [
    buyer.business_summary,
    buyer.pe_firm_website || buyer.platform_website,
    buyer.hq_state || buyer.hq_city,
    buyer.services_offered,
    buyer.industry_vertical,
    buyer.min_revenue || buyer.max_revenue,
    buyer.target_geographies,
    buyer.geographic_footprint,
  ];

  const filledWebsiteFields = websiteFields.filter(f => 
    f !== null && f !== undefined && (Array.isArray(f) ? f.length > 0 : true)
  ).length;
  
  // Website intel: 0-50% based on filled website fields
  const websiteIntel = Math.round((filledWebsiteFields / websiteFields.length) * 50);
  
  // Transcript intel: 50% if transcript exists
  const transcriptIntel = hasTranscript ? 50 : 0;
  
  return websiteIntel + transcriptIntel;
}
