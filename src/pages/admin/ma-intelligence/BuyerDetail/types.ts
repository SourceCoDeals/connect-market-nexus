import type { MABuyer } from "@/lib/ma-intelligence/types";

export interface BuyerDetailState {
  buyer: MABuyer | null;
  isLoading: boolean;
  activeTab: string;
  editingSection: string | null;
  isPassDialogOpen: boolean;
  isAnalyzingNotes: boolean;
  formData: Partial<MABuyer>;
}

export const SCHEMA_FIELDS = [
  'pe_firm_name', 'pe_firm_website', 'pe_firm_linkedin', 'platform_company_name',
  'platform_website', 'buyer_linkedin', 'hq_city', 'hq_state', 'hq_country',
  'hq_region', 'other_office_locations', 'business_summary', 'industry_vertical',
  'business_type', 'services_offered', 'business_model', 'revenue_model',
  'go_to_market_strategy', 'num_platforms', 'total_acquisitions',
  'last_acquisition_date', 'acquisition_frequency', 'acquisition_appetite',
  'acquisition_timeline', 'min_revenue', 'max_revenue',
  'min_ebitda', 'max_ebitda', 'preferred_ebitda',
  'target_geographies', 'geographic_footprint', 'geographic_exclusions',
  'acquisition_geography', 'service_regions', 'target_services', 'target_industries',
  'industry_exclusions', 'thesis_summary', 'thesis_confidence',
  'service_mix_prefs', 'business_model_prefs',
  'addon_only', 'platform_only', 'has_fee_agreement', 'fee_agreement_status'
] as const;
