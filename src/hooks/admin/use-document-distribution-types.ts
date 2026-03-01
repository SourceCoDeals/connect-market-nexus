/**
 * Types for Document Distribution
 */

export interface DealDocument {
  id: string;
  deal_id: string;
  document_type: 'full_detail_memo' | 'anonymous_teaser' | 'data_room_file';
  title: string;
  description: string | null;
  file_path: string | null;
  file_size_bytes: number | null;
  mime_type: string;
  version: number;
  is_current: boolean;
  status: 'active' | 'archived' | 'deleted';
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrackedLink {
  id: string;
  deal_id: string;
  document_id: string;
  buyer_id: string | null;
  buyer_email: string;
  buyer_name: string;
  buyer_firm: string | null;
  contact_id: string | null;
  link_token: string;
  is_active: boolean;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  expires_at: string | null;
  first_opened_at: string | null;
  last_opened_at: string | null;
  open_count: number;
  created_by: string;
  created_at: string;
}

export interface ReleaseLogEntry {
  id: string;
  deal_id: string;
  document_id: string | null;
  buyer_id: string | null;
  buyer_name: string;
  buyer_firm: string | null;
  buyer_email: string | null;
  release_method: 'tracked_link' | 'pdf_download' | 'auto_campaign' | 'data_room_grant';
  nda_status_at_release: string | null;
  fee_agreement_status_at_release: string | null;
  released_by: string | null;
  released_at: string;
  tracked_link_id: string | null;
  first_opened_at: string | null;
  open_count: number;
  last_opened_at: string | null;
  release_notes: string | null;
  contact_id: string | null;
  // Joined fields
  document?: DealDocument;
  tracked_link?: TrackedLink;
  released_by_profile?: { first_name: string | null; last_name: string | null };
}

export interface ApprovalQueueEntry {
  id: string;
  connection_request_id: string;
  deal_id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_firm: string | null;
  buyer_role: string | null;
  buyer_message: string | null;
  matched_buyer_id: string | null;
  match_confidence: 'email_exact' | 'firm_name' | 'none' | null;
  status: 'pending' | 'approved' | 'declined';
  reviewed_by: string | null;
  reviewed_at: string | null;
  decline_reason: string | null;
  decline_category: string | null;
  decline_email_sent: boolean;
  release_log_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealDataRoomAccess {
  id: string;
  deal_id: string;
  buyer_id: string | null;
  buyer_email: string;
  buyer_name: string;
  buyer_firm: string | null;
  access_token: string;
  granted_document_ids: string[] | null;
  is_active: boolean;
  revoked_at: string | null;
  nda_signed_at: string | null;
  fee_agreement_signed_at: string | null;
  granted_by: string;
  granted_at: string;
  last_accessed_at: string | null;
}
