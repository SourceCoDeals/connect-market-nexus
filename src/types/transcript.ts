// Transcript types for unified transcript system

export interface Transcript {
  id: string;
  entity_type: 'buyer' | 'deal' | 'call' | 'both';
  buyer_id?: string;
  listing_id?: string;
  universe_id?: string;
  transcript_text: string;
  source?: string;
  call_type?: string;
  call_date?: string;
  file_name?: string;
  file_url?: string;
  transcript_url?: string;
  recording_url?: string;
  extracted_insights?: Record<string, unknown>;
  extraction_status: 'pending' | 'processing' | 'completed' | 'failed' | 'insufficient_data';
  extraction_error?: string;
  processed_at?: string;
  title?: string;
  participants?: string[];
  key_quotes?: string[];
  ceo_detected?: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookConfig {
  id: string;
  universe_id?: string;
  name: string;
  webhook_url: string;
  secret?: string;
  enabled: boolean;
  event_types: string[];
  custom_headers?: Record<string, string>;
  max_retries: number;
  created_at: string;
  updated_at: string;
  last_triggered_at?: string;
  total_deliveries: number;
  total_failures: number;
}

export interface WebhookDelivery {
  id: string;
  webhook_config_id: string;
  transcript_id?: string;
  event_type: string;
  payload: Record<string, unknown>;
  attempt_number: number;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  http_status_code?: number;
  response_body?: string;
  error_message?: string;
  created_at: string;
  delivered_at?: string;
  next_retry_at?: string;
}

export interface TranscriptHealth {
  table_name: string;
  total_transcripts: number;
  processed_count: number;
  processed_percentage: number;
}
