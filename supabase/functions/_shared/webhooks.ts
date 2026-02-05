// Shared: Webhook Delivery System
// Author: Phase 2 Architectural Consolidation
// Date: 2026-02-05

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withRetry } from './retry.ts';

export interface WebhookPayload {
  event: string;
  transcript_id: string;
  entity_type: string;
  buyer_id?: string;
  listing_id?: string;
  universe_id?: string;
  extracted_fields?: string[];
  ceo_detected?: boolean;
  extraction_status?: string;
  processed_at?: string;
  error_message?: string;
  timestamp: string;
}

export interface WebhookConfig {
  id: string;
  webhook_url: string;
  secret?: string;
  custom_headers?: Record<string, string>;
  max_retries: number;
}

/**
 * Send webhook notification with retry logic
 */
export async function sendWebhook(
  config: WebhookConfig,
  payload: WebhookPayload,
  supabase: SupabaseClient
): Promise<void> {
  const startTime = Date.now();

  try {
    await withRetry(
      async () => {
        const response = await deliverWebhook(config, payload);

        // Record successful delivery
        await supabase.rpc('record_webhook_delivery', {
          p_webhook_config_id: config.id,
          p_transcript_id: payload.transcript_id,
          p_event_type: payload.event,
          p_payload: payload,
          p_status: 'delivered',
          p_http_status_code: response.status,
          p_response_body: await response.text(),
          p_attempt_number: 1
        });

        console.log(`[Webhook] Delivered ${payload.event} to ${config.webhook_url} (${response.status})`);
      },
      {
        maxRetries: config.max_retries,
        baseDelay: 2000,
        onRetry: async (attempt, error) => {
          // Record retry attempt
          await supabase.rpc('record_webhook_delivery', {
            p_webhook_config_id: config.id,
            p_transcript_id: payload.transcript_id,
            p_event_type: payload.event,
            p_payload: payload,
            p_status: 'retrying',
            p_error_message: error.message,
            p_attempt_number: attempt + 1
          });
        }
      }
    );
  } catch (error) {
    // Record final failure
    await supabase.rpc('record_webhook_delivery', {
      p_webhook_config_id: config.id,
      p_transcript_id: payload.transcript_id,
      p_event_type: payload.event,
      p_payload: payload,
      p_status: 'failed',
      p_error_message: error instanceof Error ? error.message : 'Unknown error',
      p_attempt_number: config.max_retries
    });

    console.error(`[Webhook] Failed to deliver after ${config.max_retries} attempts:`, error);
    // Don't throw - webhook failures shouldn't break extraction
  } finally {
    const duration = Date.now() - startTime;
    console.log(`[Webhook] Total delivery time: ${duration}ms`);
  }
}

/**
 * Deliver webhook to endpoint
 */
async function deliverWebhook(
  config: WebhookConfig,
  payload: WebhookPayload
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'ConnectMarketNexus-Webhook/1.0',
    'X-Event-Type': payload.event,
    'X-Delivery-ID': crypto.randomUUID(),
    ...config.custom_headers
  };

  // Add HMAC signature if secret is configured
  if (config.secret) {
    const signature = await generateHmacSignature(payload, config.secret);
    headers['X-Webhook-Signature'] = signature;
  }

  const response = await fetch(config.webhook_url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  // Treat 2xx as success, everything else as failure
  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}: ${await response.text()}`);
  }

  return response;
}

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
async function generateHmacSignature(payload: unknown, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const keyData = encoder.encode(secret);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, data);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Notify all active webhooks for an event
 */
export async function notifyWebhooks(
  supabase: SupabaseClient,
  eventType: string,
  payload: WebhookPayload
): Promise<void> {
  try {
    // Get active webhooks for this event type and entity type
    const { data: webhooks, error } = await supabase.rpc(
      'get_active_webhooks_for_event',
      {
        p_event_type: eventType,
        p_entity_type: payload.entity_type,
        p_universe_id: payload.universe_id || null
      }
    );

    if (error) {
      console.error('[Webhook] Error fetching active webhooks:', error);
      return;
    }

    if (!webhooks || webhooks.length === 0) {
      console.log(`[Webhook] No active webhooks configured for ${eventType}`);
      return;
    }

    console.log(`[Webhook] Sending ${eventType} to ${webhooks.length} webhooks`);

    // Send to all webhooks in parallel (don't wait)
    const promises = webhooks.map((webhook: WebhookConfig) =>
      sendWebhook(webhook, payload, supabase).catch(err => {
        console.error(`[Webhook] Failed to send to ${webhook.webhook_url}:`, err);
      })
    );

    // Fire and forget - don't block extraction on webhook delivery
    Promise.allSettled(promises);

  } catch (error) {
    console.error('[Webhook] Error in notifyWebhooks:', error);
    // Don't throw - webhook errors shouldn't break extraction
  }
}

/**
 * Build webhook payload from transcript data
 */
export function buildWebhookPayload(
  eventType: string,
  transcript: any,
  extractedData?: any
): WebhookPayload {
  const payload: WebhookPayload = {
    event: eventType,
    transcript_id: transcript.id,
    entity_type: transcript.entity_type,
    timestamp: new Date().toISOString()
  };

  // Add entity IDs
  if (transcript.buyer_id) payload.buyer_id = transcript.buyer_id;
  if (transcript.listing_id) payload.listing_id = transcript.listing_id;
  if (transcript.universe_id) payload.universe_id = transcript.universe_id;

  // Add extraction details if available
  if (extractedData) {
    payload.extracted_fields = Object.keys(extractedData);
    payload.extraction_status = 'completed';
    payload.processed_at = new Date().toISOString();
  }

  // Add special flags
  if (transcript.ceo_detected) {
    payload.ceo_detected = true;
  }

  return payload;
}
