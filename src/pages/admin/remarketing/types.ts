// Shared types for ReMarketing pages

export interface DealListing {
  id: string;
  title: string | null;
  description: string | null;
  location: string | null;
  revenue: number | null;
  ebitda: number | null;
  status: string | null;
  created_at: string;
  category: string | null;
  industry: string | null;
  website: string | null;
  executive_summary: string | null;
  service_mix: any | null;
  internal_company_name: string | null;
  internal_deal_memo_link: string | null;
  geographic_states: string[] | null;
  enriched_at: string | null;
  full_time_employees: number | null;
  linkedin_employee_count: number | null;
  linkedin_employee_range: string | null;
  google_review_count: number | null;
  google_rating: number | null;
  is_priority_target: boolean | null;
  deal_total_score: number | null;
  seller_interest_score: number | null;
  manual_rank_override: number | null;
  // Structured address fields
  address_city: string | null;
  address_state: string | null;
  // Referral partner
  referral_partner_id: string | null;
  referral_partners: { id: string; name: string } | null;
  // Deal source
  deal_source: string | null;
  // Deal owner
  deal_owner_id: string | null;
  deal_owner: { id: string; first_name: string | null; last_name: string | null; email: string } | null;
}

// Column width configuration
export interface ColumnWidths {
  select: number;
  rank: number;
  dealName: number;
  referralSource: number;
  industry: number;
  description: number;
  location: number;
  revenue: number;
  ebitda: number;
  linkedinCount: number;
  linkedinRange: number;
  googleReviews: number;
  googleRating: number;
  quality: number;
  sellerInterest: number;
  engagement: number;
  dealOwner: number;
  added: number;
  actions: number;
}

export const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
  select: 40,
  rank: 60,
  dealName: 200,
  referralSource: 120,
  industry: 120,
  description: 180,
  location: 100,
  revenue: 90,
  ebitda: 90,
  linkedinCount: 70,
  linkedinRange: 80,
  googleReviews: 70,
  googleRating: 60,
  quality: 80,
  sellerInterest: 90,
  engagement: 130,
  dealOwner: 130,
  added: 90,
  actions: 50,
};

export interface CapTargetDeal {
  id: string;
  title: string | null;
  internal_company_name: string | null;
  captarget_client_name: string | null;
  captarget_contact_date: string | null;
  captarget_outreach_channel: string | null;
  captarget_interest_type: string | null;
  main_contact_name: string | null;
  main_contact_email: string | null;
  main_contact_title: string | null;
  main_contact_phone: string | null;
  captarget_sheet_tab: string | null;
  website: string | null;
  description: string | null;
  owner_response: string | null;
  pushed_to_all_deals: boolean | null;
  pushed_to_all_deals_at: string | null;
  deal_source: string | null;
  status: string | null;
  created_at: string;
  enriched_at: string | null;
  deal_total_score: number | null;
  linkedin_employee_count: number | null;
  linkedin_employee_range: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  captarget_status: string | null;
  is_priority_target: boolean | null;
  category: string | null;
  executive_summary: string | null;
  industry: string | null;
}

export type CapTargetSortColumn =
  | "company_name"
  | "client_name"
  | "contact_name"
  | "interest_type"
  | "outreach_channel"
  | "contact_date"
  | "pushed"
  | "score"
  | "linkedin_employee_count"
  | "linkedin_employee_range"
  | "google_review_count"
  | "google_rating";

export type SortDirection = "asc" | "desc";

export interface DealTranscript {
  id: string;
  listing_id: string;
  transcript_text: string;
  source: string | null;
  extracted_data: unknown;
  applied_to_deal: boolean | null;
  applied_at: string | null;
  processed_at: string | null;
  created_at: string;
  created_by?: string | null;
  updated_at?: string;
  title?: string | null;
  transcript_url?: string | null;
  call_date?: string | null;
}
