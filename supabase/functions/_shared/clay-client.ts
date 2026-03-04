/**
 * Clay Webhook Enrichment Client
 *
 * Sends contact data to Clay's inbound webhooks for async waterfall enrichment.
 * Clay processes data through its enrichment waterfall and sends results back
 * to our inbound webhook endpoints.
 *
 * Three outbound flows:
 *   1. Name + Domain → Clay (sends first_name, last_name, domain)
 *   2. LinkedIn URL → Clay email (sends linkedin_url)
 *   3. LinkedIn URL → Clay phone (sends linkedin_url)
 *
 * Results arrive asynchronously via clay-webhook-name-domain / clay-webhook-linkedin / clay-webhook-phone edge functions.
 */

const CLAY_TIMEOUT_MS = 10_000;

export interface ClayOutboundResult {
  success: boolean;
  requestId: string;
  error?: string;
}

const CLAY_WEBHOOK_URLS = {
  name_domain: 'https://api.clay.com/v3/sources/webhook/pull-in-data-from-a-webhook-5710a9f8-be6f-4004-b378-a259c9bb7a1c',
  linkedin: 'https://api.clay.com/v3/sources/webhook/pull-in-data-from-a-webhook-82d6e696-5c1c-4db3-8b66-9e13a984088d',
  phone: 'https://api.clay.com/v3/sources/webhook/pull-in-data-from-a-webhook-fd39ed9a-ae2f-4ecd-8f8d-dd8d3740a6c9',
} as const;

function getWebhookUrl(type: 'name_domain' | 'linkedin' | 'phone'): string {
  return CLAY_WEBHOOK_URLS[type];
}

async function clayFetch(url: string, body: Record<string, unknown>): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLAY_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = Deno.env.get('CLAY_API_KEY');
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    return await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Send name + domain data to Clay for async email enrichment.
 */
export async function sendToClayNameDomain(params: {
  requestId: string;
  firstName: string;
  lastName: string;
  domain: string;
}): Promise<ClayOutboundResult> {
  try {
    const url = getWebhookUrl('name_domain');
    const res = await clayFetch(url, {
      request_id: params.requestId,
      first_name: params.firstName,
      last_name: params.lastName,
      domain: params.domain,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { success: false, requestId: params.requestId, error: `HTTP ${res.status}: ${text}` };
    }
    return { success: true, requestId: params.requestId };
  } catch (err) {
    return {
      success: false,
      requestId: params.requestId,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Send LinkedIn URL to Clay for async email enrichment.
 */
export async function sendToClayLinkedIn(params: {
  requestId: string;
  linkedinUrl: string;
}): Promise<ClayOutboundResult> {
  try {
    const url = getWebhookUrl('linkedin');
    const res = await clayFetch(url, {
      request_id: params.requestId,
      linkedin_url: params.linkedinUrl,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { success: false, requestId: params.requestId, error: `HTTP ${res.status}: ${text}` };
    }
    return { success: true, requestId: params.requestId };
  } catch (err) {
    return {
      success: false,
      requestId: params.requestId,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Send LinkedIn URL to Clay for async phone enrichment.
 */
export async function sendToClayPhone(params: {
  requestId: string;
  linkedinUrl: string;
}): Promise<ClayOutboundResult> {
  try {
    const url = getWebhookUrl('phone');
    const res = await clayFetch(url, {
      request_id: params.requestId,
      linkedin_url: params.linkedinUrl,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { success: false, requestId: params.requestId, error: `HTTP ${res.status}: ${text}` };
    }
    return { success: true, requestId: params.requestId };
  } catch (err) {
    return {
      success: false,
      requestId: params.requestId,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
