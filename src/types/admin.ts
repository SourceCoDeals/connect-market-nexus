
import { User, Listing } from "@/types";

export interface AdminListing {
  id: string;
  title: string;
  categories: string[]; // Array of categories
  category?: string; // Keep for backward compatibility
  acquisition_type?: 'add_on' | 'platform' | string | null;
  location: string;
  revenue: number;
  ebitda: number;
  full_time_employees?: number;
  part_time_employees?: number;
  description: string;
  description_html?: string;
  description_json?: any;
  tags: string[];
  owner_notes?: string;
  files?: string[];
  image_url?: string | null;
  status: 'active' | 'inactive';
  status_tag?: string | null;
  
  // Deal identifier for tracking
  deal_identifier?: string;
  
  // Admin-only internal company information
  internal_company_name?: string;
  internal_primary_owner?: string; // Deprecated - use primary_owner_id
  primary_owner_id?: string | null; // UUID reference to profiles
  internal_salesforce_link?: string;
  internal_deal_memo_link?: string;
  internal_contact_info?: string;
  internal_notes?: string;
  
  // New investor-focused fields
  ownership_structure?: string;
  seller_motivation?: string;
  management_depth?: string;
  revenue_model_breakdown?: Record<string, number>;
  customer_concentration?: number;
  market_position?: Record<string, any>;
  transaction_preferences?: Record<string, any>;
  growth_drivers?: string[];
  key_risks?: string[];
  investment_thesis?: string;
  seller_involvement_preference?: string;
  timeline_preference?: string;
  visible_to_buyer_types?: string[] | null;
  
  // Enhanced metrics fields
  custom_metric_label?: string | null;
  custom_metric_value?: string | null;
  custom_metric_subtitle?: string | null;
  metric_3_type?: 'employees' | 'custom';
  metric_3_custom_label?: string | null;
  metric_3_custom_value?: string | null;
  metric_3_custom_subtitle?: string | null;
  metric_4_type?: string | null;
  metric_4_custom_label?: string | null;
  metric_4_custom_value?: string | null;
  metric_4_custom_subtitle?: string | null;
  revenue_metric_subtitle?: string | null;
  ebitda_metric_subtitle?: string | null;
  
  // Deal advisor
  presented_by_admin_id?: string | null;
  
  created_at: string;
  updated_at: string;
}

export interface CreateListingData {
  title: string;
  categories: string[];
  acquisition_type?: 'add_on' | 'platform' | string | null;
  location: string;
  revenue: number;
  ebitda: number;
  full_time_employees?: number;
  part_time_employees?: number;
  description: string;
  tags?: string[];
  owner_notes?: string;
  status?: 'active' | 'inactive';
  status_tag?: string | null;
  
  // Deal identifier for tracking
  deal_identifier?: string;
  
  // Admin-only internal company information
  internal_company_name?: string;
  internal_primary_owner?: string; // Deprecated - use primary_owner_id
  primary_owner_id?: string | null; // UUID reference to profiles
  internal_salesforce_link?: string;
  internal_deal_memo_link?: string;
  internal_contact_info?: string;
  internal_notes?: string;
  
  // New investor-focused fields
  ownership_structure?: string;
  seller_motivation?: string;
  management_depth?: string;
  revenue_model_breakdown?: Record<string, number>;
  customer_concentration?: number;
  market_position?: Record<string, any>;
  transaction_preferences?: Record<string, any>;
  growth_drivers?: string[];
  key_risks?: string[];
  investment_thesis?: string;
  seller_involvement_preference?: string;
  timeline_preference?: string;
  visible_to_buyer_types?: string[] | null;
  
  // Enhanced metrics fields
  custom_metric_label?: string | null;
  custom_metric_value?: string | null;
  custom_metric_subtitle?: string | null;
  metric_3_type?: 'employees' | 'custom';
  metric_3_custom_label?: string | null;
  metric_3_custom_value?: string | null;
  metric_3_custom_subtitle?: string | null;
  revenue_metric_subtitle?: string | null;
  ebitda_metric_subtitle?: string | null;
  
  // Deal advisor
  presented_by_admin_id?: string | null;
}

export interface AdminConnectionRequest {
  id: string;
  user_id: string | null;
  listing_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'on_hold';
  admin_comment?: string;
  user_message?: string;
  decision_notes?: string;
  followed_up?: boolean;
  followed_up_at?: string;
  followed_up_by?: string;
  negative_followed_up?: boolean;
  negative_followed_up_at?: string;
  negative_followed_up_by?: string;
  approved_by?: string;
  approved_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  on_hold_by?: string;
  on_hold_at?: string;
  // Phase 4: Source tracking fields
  source: 'marketplace' | 'webflow' | 'manual' | 'import' | 'api' | 'website' | 'referral' | 'cold_outreach' | 'networking' | 'linkedin' | 'email';
  source_lead_id?: string;
  source_metadata?: Record<string, any>;
  converted_by?: string;
  converted_at?: string;
  // Lead-only request fields (when user_id is null)
  lead_email?: string;
  lead_name?: string;
  lead_company?: string;
  lead_role?: string;
  lead_phone?: string;
  // Lead-only document status tracking
  lead_nda_email_sent?: boolean;
  lead_nda_email_sent_at?: string | null;
  lead_nda_signed?: boolean;
  lead_nda_signed_at?: string | null;
  lead_fee_agreement_email_sent?: boolean;
  lead_fee_agreement_email_sent_at?: string | null;
  lead_fee_agreement_signed?: boolean;
  lead_fee_agreement_signed_at?: string | null;
  created_at: string;
  updated_at: string;
  decision_at?: string;
  user?: User | null;
  listing?: Listing | null;
  // Admin profiles who performed follow-ups
  followedUpByAdmin?: User | null;
  negativeFollowedUpByAdmin?: User | null;
  approvedByAdmin?: User | null;
  rejectedByAdmin?: User | null;
  onHoldByAdmin?: User | null;
  // Source lead data for enhanced context
  sourceLead?: {
    id: string;
    name: string;
    email: string;
    company_name?: string;
    message?: string;
    priority_score: number;
    source: string;
    source_form_name?: string;
  };
}

export interface AdminStats {
  totalUsers: number;
  pendingUsers: number;
  approvedUsers: number;
  totalListings: number;
  pendingConnections: number;
  approvedConnections: number;
}

export interface AdminActivity {
  id: string;
  type: 'signup' | 'connection_request' | 'listing_creation';
  description: string;
  timestamp: string;
  user_id?: string;
}
