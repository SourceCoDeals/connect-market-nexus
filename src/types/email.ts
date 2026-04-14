/**
 * Types for the Microsoft Outlook email integration.
 */

export type EmailDirection = 'inbound' | 'outbound';
export type EmailConnectionStatus = 'active' | 'expired' | 'revoked' | 'error';
export type EmailAccessAction = 'viewed' | 'sent' | 'replied';

export interface EmailMessage {
  id: string;
  microsoft_message_id: string;
  microsoft_conversation_id: string | null;
  contact_id: string;
  deal_id: string | null;
  sourceco_user_id: string;
  direction: EmailDirection;
  from_address: string;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  sent_at: string;
  synced_at: string;
  has_attachments: boolean;
  attachment_metadata: AttachmentMetadata[];
  created_at: string;
}

export interface AttachmentMetadata {
  name: string;
  size: number;
  contentType: string;
}

export type OutlookBackfillStatus = 'idle' | 'running' | 'completed' | 'failed';

/**
 * Persisted per-connection backfill progress. Populated by the
 * `outlook-backfill-history` edge function on start and updated by the
 * `outlook-sync-emails` engine after every Microsoft Graph page. The Outlook
 * settings page polls this every few seconds while `backfill_status` is
 * `'running'` so it can render a live progress bar + ETA without round-
 * tripping the edge runtime.
 *
 * See migration `20260716000002_outlook_backfill_progress.sql` for the
 * column-level semantics.
 */
export interface OutlookBackfillProgress {
  backfill_status: OutlookBackfillStatus;
  backfill_started_at: string | null;
  backfill_completed_at: string | null;
  backfill_days_back: number | null;
  backfill_since: string | null;
  backfill_next_link: string | null;
  backfill_pages_processed: number;
  backfill_messages_synced: number;
  backfill_messages_skipped: number;
  backfill_messages_queued: number;
  backfill_earliest_seen_at: string | null;
  backfill_heartbeat_at: string | null;
  backfill_error_message: string | null;
}

export interface EmailConnection extends Partial<OutlookBackfillProgress> {
  id: string;
  sourceco_user_id: string;
  microsoft_user_id: string;
  email_address: string;
  token_expires_at: string | null;
  webhook_subscription_id: string | null;
  webhook_expires_at: string | null;
  status: EmailConnectionStatus;
  last_sync_at: string | null;
  last_sync_error_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailAccessLog {
  id: string;
  sourceco_user_id: string;
  email_message_id: string | null;
  action: EmailAccessAction;
  accessed_at: string;
  ip_address: string | null;
  metadata: Record<string, unknown>;
}

export interface EmailThread {
  conversationId: string;
  subject: string;
  lastMessageAt: string;
  messageCount: number;
  lastPreview: string;
  participants: string[];
  messages: EmailMessage[];
}

export interface SendEmailRequest {
  contactId: string;
  dealId?: string;
  to: string[];
  cc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  replyToMessageId?: string;
  attachments?: { name: string; contentBytes: string; contentType: string }[];
}

export interface ContactAssignment {
  id: string;
  sourceco_user_id: string;
  contact_id: string | null;
  deal_id: string | null;
  assigned_by: string | null;
  assigned_at: string;
  is_active: boolean;
}
