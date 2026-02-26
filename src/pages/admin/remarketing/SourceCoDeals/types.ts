export interface SourceCoDeal {
  id: string;
  title: string | null;
  internal_company_name: string | null;
  main_contact_name: string | null;
  main_contact_email: string | null;
  main_contact_title: string | null;
  main_contact_phone: string | null;
  website: string | null;
  description: string | null;
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
  is_priority_target: boolean | null;
  need_buyer_universe: boolean | null;
  need_owner_contact: boolean | null;
  category: string | null;
  executive_summary: string | null;
  industry: string | null;
  revenue: number | null;
  ebitda: number | null;
  location: string | null;
  address_city: string | null;
  address_state: string | null;
  deal_owner_id: string | null;
  deal_owner: { id: string; first_name: string | null; last_name: string | null; email: string } | null;
  remarketing_status: string | null;
  // SourceCo-specific fields
  salesforce_account_id: string | null;
  sf_remarketing_reason: string | null;
  sf_primary_client_account: string | null;
  sf_interest_in_selling: string | null;
  sf_seller_interest_score: number | null;
  sf_note_summary: string | null;
  sf_one_pager: boolean | null;
  sf_lead_memo: boolean | null;
  sf_nda: boolean | null;
}

export type SortColumn =
  | "company_name"
  | "industry"
  | "owner"
  | "revenue"
  | "ebitda"
  | "score"
  | "linkedin_employee_count"
  | "linkedin_employee_range"
  | "google_review_count"
  | "google_rating"
  | "created_at"
  | "pushed"
  | "priority"
  | "sf_interest";

export type SortDirection = "asc" | "desc";
