// ── Client Portal Types ──────────────────────────────────────────────
// All types for the portal feature. These are NEW types that do not
// modify any existing type definitions.

export type PortalOrgStatus = 'active' | 'paused' | 'archived';
export type PortalUserRole = 'primary_contact' | 'admin' | 'viewer';
export type PortalNotificationFrequency = 'instant' | 'daily_digest' | 'weekly_digest';

export type PortalDealPushStatus =
  | 'pending_review'
  | 'viewed'
  | 'interested'
  | 'passed'
  | 'needs_info'
  | 'under_nda'
  | 'archived';

export type PortalDealPriority = 'standard' | 'high' | 'urgent';

export type PortalResponseType = 'interested' | 'pass' | 'need_more_info';

export type PortalNotificationType =
  | 'new_deal'
  | 'reminder'
  | 'status_update'
  | 'document_ready'
  | 'welcome'
  | 'digest';

export type PortalNotificationChannel = 'email' | 'in_app' | 'both';

export type PortalActorType = 'portal_user' | 'admin';

export type PortalActivityAction =
  | 'deal_pushed'
  | 'deal_viewed'
  | 'response_submitted'
  | 'document_downloaded'
  | 'message_sent'
  | 'login'
  | 'settings_changed'
  | 'reminder_sent'
  | 'user_invited'
  | 'user_deactivated'
  | 'portal_created'
  | 'portal_archived'
  | 'converted_to_pipeline';

// ── Database row types ───────────────────────────────────────────────

export interface PortalOrganization {
  id: string;
  name: string;
  buyer_id: string | null;
  profile_id: string | null;
  relationship_owner_id: string | null;
  status: PortalOrgStatus;
  portal_slug: string;
  welcome_message: string | null;
  logo_url: string | null;
  preferred_industries: string[];
  preferred_deal_size_min: number | null;
  preferred_deal_size_max: number | null;
  preferred_geographies: string[];
  notification_frequency: PortalNotificationFrequency;
  auto_reminder_enabled: boolean;
  auto_reminder_days: number | null;
  auto_reminder_max: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PortalUser {
  id: string;
  portal_org_id: string;
  contact_id: string | null;
  profile_id: string | null;
  role: PortalUserRole;
  email: string;
  name: string;
  is_active: boolean;
  last_login_at: string | null;
  invite_sent_at: string | null;
  invite_accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeaserSection {
  key: string;
  title: string;
  content: string;
}

export interface DealSnapshot {
  headline: string;
  industry: string;
  sub_industry?: string;
  geography: string;
  ebitda: number | null;
  revenue: number | null;
  website?: string;
  business_description?: string;
  category?: string;
  /** Anonymous teaser sections (BUSINESS OVERVIEW, DEAL SNAPSHOT, KEY FACTS, etc.) */
  teaser_sections?: TeaserSection[];
  /** Full memo HTML (rich text from TipTap editor) */
  memo_html?: string;
  /** Project codename used in the teaser */
  project_name?: string;
  /** Branding for the memo (sourceco, new_heritage, etc.) */
  branding?: string;
  /** Short executive summary of the deal */
  executive_summary?: string;
  /** LinkedIn employee count (enrichment data) */
  linkedin_employee_count?: number | null;
  /** Google review average rating (1-5) */
  google_rating?: number | null;
  /** Google review count */
  google_review_count?: number | null;
}

export interface PortalDealPush {
  id: string;
  portal_org_id: string;
  listing_id: string;
  pushed_by: string;
  push_note: string | null;
  status: PortalDealPushStatus;
  priority: PortalDealPriority;
  deal_snapshot: DealSnapshot;
  first_viewed_at: string | null;
  response_due_by: string | null;
  reminder_count: number;
  last_reminder_at: string | null;
  data_room_access_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortalDealResponse {
  id: string;
  push_id: string;
  responded_by: string;
  response_type: PortalResponseType;
  notes: string | null;
  internal_notes: string | null; // admin-only field
  pass_reason_category: PassReasonCategory | null;
  created_at: string;
}

export interface PortalNotification {
  id: string;
  portal_user_id: string;
  portal_org_id: string;
  push_id: string | null;
  type: PortalNotificationType;
  channel: PortalNotificationChannel;
  subject: string | null;
  body: string | null;
  sent_at: string | null;
  read_at: string | null;
  clicked_at: string | null;
  created_at: string;
}

export interface PortalActivityLog {
  id: string;
  portal_org_id: string;
  actor_id: string;
  actor_type: PortalActorType;
  action: PortalActivityAction;
  push_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Joined / enriched types for the UI ───────────────────────────────

export interface PortalOrganizationWithDetails extends PortalOrganization {
  relationship_owner?: { id: string; first_name: string; last_name: string; email: string } | null;
  buyer?: {
    id: string;
    company_name: string;
    company_website: string | null;
    buyer_type: string | null;
  } | null;
  user_count?: number;
  active_push_count?: number;
  last_activity_at?: string | null;
}

export interface PortalDealPushWithDetails extends PortalDealPush {
  pushed_by_profile?: { id: string; first_name: string; last_name: string } | null;
  latest_response?: PortalDealResponse | null;
  response_count?: number;
  portal_org?: { id: string; name: string; portal_slug: string } | null;
}

export interface PortalActivityLogWithDetails extends PortalActivityLog {
  actor_name?: string;
  push_headline?: string;
}

// ── Form input types ─────────────────────────────────────────────────

export interface CreatePortalOrgInput {
  name: string;
  buyer_id?: string | null;
  profile_id?: string | null;
  relationship_owner_id?: string | null;
  portal_slug: string;
  welcome_message?: string;
  logo_url?: string;
  preferred_industries?: string[];
  preferred_deal_size_min?: number | null;
  preferred_deal_size_max?: number | null;
  preferred_geographies?: string[];
  notification_frequency?: PortalNotificationFrequency;
  notes?: string;
}

export interface InvitePortalUserInput {
  portal_org_id: string;
  contact_id?: string | null;
  profile_id?: string | null;
  role: PortalUserRole;
  email: string;
  name: string;
}

export interface PushDealToPortalInput {
  portal_org_id: string;
  listing_id: string;
  push_note?: string;
  priority?: PortalDealPriority;
  response_due_by?: string | null;
  data_room_access_token?: string;
}

export interface SubmitDealResponseInput {
  push_id: string;
  response_type: PortalResponseType;
  notes?: string;
  pass_reason_category?: PassReasonCategory;
}

// ── Portal Intelligence Types ─────────────────────────────────────────

export type PassReasonCategory =
  | 'too_small'
  | 'too_large'
  | 'wrong_geography'
  | 'wrong_industry'
  | 'owner_dependency'
  | 'already_in_discussions'
  | 'not_cultural_fit'
  | 'timing_not_right'
  | 'other';

export const PASS_REASON_LABELS: Record<PassReasonCategory, string> = {
  too_small: 'Too Small',
  too_large: 'Too Large',
  wrong_geography: 'Wrong Geography',
  wrong_industry: 'Wrong Industry',
  owner_dependency: 'Owner Dependency',
  already_in_discussions: 'Already In Discussions',
  not_cultural_fit: 'Not Cultural Fit',
  timing_not_right: 'Timing Not Right',
  other: 'Other',
};

export type RecommendationStatus = 'pending' | 'approved' | 'pushed' | 'dismissed' | 'stale';

export type IntelligenceDocType =
  | 'call_transcript'
  | 'meeting_notes'
  | 'thesis_document'
  | 'pass_notes'
  | 'general_notes';

export interface PortalThesisCriteria {
  id: string;
  portal_org_id: string;
  industry_label: string;
  industry_keywords: string[];
  ebitda_min: number | null;
  ebitda_max: number | null;
  revenue_min: number | null;
  revenue_max: number | null;
  employee_min: number | null;
  employee_max: number | null;
  target_states: string[];
  portfolio_buyer_id: string | null;
  universe_id: string | null;
  priority: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateThesisCriteriaInput {
  portal_org_id: string;
  industry_label: string;
  industry_keywords: string[];
  ebitda_min?: number | null;
  ebitda_max?: number | null;
  revenue_min?: number | null;
  revenue_max?: number | null;
  employee_min?: number | null;
  employee_max?: number | null;
  target_states?: string[];
  portfolio_buyer_id?: string | null;
  universe_id?: string | null;
  priority?: number;
  notes?: string | null;
}

export interface PortalIntelligenceDoc {
  id: string;
  portal_org_id: string;
  doc_type: IntelligenceDocType;
  title: string;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  fireflies_transcript_id: string | null;
  listing_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateIntelligenceDocInput {
  portal_org_id: string;
  doc_type: IntelligenceDocType;
  title: string;
  content?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  fireflies_transcript_id?: string | null;
  listing_id?: string | null;
}

export interface PortalDealRecommendation {
  id: string;
  portal_org_id: string;
  listing_id: string;
  thesis_criteria_id: string | null;
  portfolio_buyer_id: string | null;
  portfolio_company_name: string | null;
  match_score: number;
  match_reasons: string[];
  match_category: 'strong' | 'moderate' | 'weak';
  status: RecommendationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  dismiss_reason: string | null;
  push_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortalDealRecommendationWithListing extends PortalDealRecommendation {
  listing_title?: string;
  listing_industry?: string;
  listing_state?: string;
  listing_ebitda?: number | null;
  listing_employees?: number | null;
  thesis_label?: string;
}
