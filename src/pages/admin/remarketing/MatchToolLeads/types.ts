export interface MatchToolLead {
  id: string;
  website: string;
  business_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  revenue: string | null;
  profit: string | null;
  timeline: string | null;
  submission_stage: string;
  industry: string | null;
  location: string | null;
  raw_inputs: Record<string, unknown> | null;
  status: string;

  // Quarantine / lifecycle
  excluded: boolean | null;
  exclusion_reason: string | null;
  not_a_fit: boolean | null;
  is_archived: boolean | null;

  // Push to Active Deals
  pushed_to_all_deals: boolean | null;
  pushed_to_all_deals_at: string | null;
  pushed_listing_id: string | null;
  deal_owner_id: string | null;

  // Scoring
  quality_tier: string | null;
  quality_label: string | null;
  lead_score: number | null;
  scoring_notes: string | null;
  is_priority_target: boolean | null;

  // Activity / submissions
  submission_count: number | null;
  created_at: string;
  updated_at: string;
  last_enriched_at: string | null;

  // Enrichment payload (Firecrawl + AI)
  enrichment_data: Record<string, unknown> | null;

  // Owner outreach (intro email tracking)
  outreach_email_sent_at: string | null;
  outreach_email_status: 'sent' | 'failed' | 'suppressed' | null;
  outreach_sender_email: string | null;
  outreach_outbound_id: string | null;
  outreach_send_count: number | null;
  outreach_last_template: string | null;
  outreach_hook_kind: string | null;

  // Joined from listings (via pushed_listing_id)
  listing_description?: string | null;
}

export type MatchToolSortColumn =
  | 'website'
  | 'business_name'
  | 'full_name'
  | 'revenue'
  | 'profit'
  | 'submission_stage'
  | 'status'
  | 'quality'
  | 'score'
  | 'created_at'
  | 'pushed'
  | 'priority'
  | 'owner';

export type MatchToolSortDirection = 'asc' | 'desc';
