/**
 * Shared Smartlead API client for edge functions.
 *
 * Centralizes authentication (API key via query param), base URL, and
 * common request patterns so individual edge functions stay thin.
 *
 * Requires SMARTLEAD_API_KEY environment variable.
 *
 * API Reference: https://api.smartlead.ai/reference
 */

const SMARTLEAD_BASE_URL = 'https://server.smartlead.ai/api/v1';
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1000;

export interface SmartleadRequestOptions {
  method?: 'GET' | 'POST' | 'DELETE' | 'PATCH';
  path: string;
  body?: Record<string, unknown>;
  queryParams?: Record<string, string | number>;
  timeoutMs?: number;
}

export interface SmartleadResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}

function getApiKey(): string {
  const key = Deno.env.get('SMARTLEAD_API_KEY');
  if (!key) throw new Error('SMARTLEAD_API_KEY is not set');
  return key;
}

/**
 * Make an authenticated request to the Smartlead API.
 *
 * Retries transient errors (5xx / network) with exponential backoff.
 * Does NOT retry client errors (4xx).
 */
export async function smartleadRequest<T = unknown>(
  options: SmartleadRequestOptions,
): Promise<SmartleadResponse<T>> {
  const apiKey = getApiKey();
  const { method = 'GET', path, body, queryParams, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  // Build URL with api_key and any extra query params
  const url = new URL(`${SMARTLEAD_BASE_URL}${path}`);
  url.searchParams.set('api_key', apiKey);
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  let lastError = '';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      };

      if (body && method !== 'GET') {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url.toString(), fetchOptions);

      // Try to parse JSON regardless of status
      let data: T | null = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = (await response.json()) as T;
      } else {
        // Some endpoints may return text (e.g. CSV export)
        const text = await response.text();
        data = text as unknown as T;
      }

      if (response.ok) {
        if (attempt > 0) {
        }
        return { ok: true, status: response.status, data };
      }

      // Don't retry client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        console.error(`[smartlead] Client error ${response.status} for ${method} ${path}:`, data);
        return {
          ok: false,
          status: response.status,
          data: null,
          error: typeof data === 'string' ? data : JSON.stringify(data),
        };
      }

      // Server error (5xx) — retry
      lastError = `HTTP ${response.status}: ${JSON.stringify(data)}`;
      console.warn(
        `[smartlead] Server error (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`,
        lastError,
      );
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(
        `[smartlead] Fetch error (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`,
        lastError,
      );
    }

    // Exponential backoff before retry
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  console.error(`[smartlead] All ${MAX_RETRIES + 1} attempts failed for ${method} ${path}`);
  return {
    ok: false,
    status: 0,
    data: null,
    error: `All retries exhausted: ${lastError}`,
  };
}

// ─── Convenience wrappers ───────────────────────────────────────────────────

/** List all campaigns */
export function listCampaigns() {
  return smartleadRequest<unknown[]>({ path: '/campaigns/' });
}

/** Get campaign by ID */
export function getCampaign(campaignId: number) {
  return smartleadRequest({ path: `/campaigns/${campaignId}` });
}

/** Create a new campaign */
export function createCampaign(name: string, clientId?: number | null) {
  return smartleadRequest({
    method: 'POST',
    path: '/campaigns/create',
    body: { name, client_id: clientId ?? null },
  });
}

/** Update campaign general settings */
export function updateCampaignSettings(campaignId: number, settings: Record<string, unknown>) {
  return smartleadRequest({
    method: 'POST',
    path: `/campaigns/${campaignId}/settings`,
    body: settings,
  });
}

/** Update campaign schedule */
export function updateCampaignSchedule(campaignId: number, schedule: Record<string, unknown>) {
  return smartleadRequest({
    method: 'POST',
    path: `/campaigns/${campaignId}/schedule`,
    body: schedule,
  });
}

/** Save campaign sequence (email steps) */
export function saveCampaignSequence(campaignId: number, sequences: Record<string, unknown>[]) {
  return smartleadRequest({
    method: 'POST',
    path: `/campaigns/${campaignId}/sequences`,
    body: { sequences },
  });
}

/** Get campaign sequences */
export function getCampaignSequences(campaignId: number) {
  return smartleadRequest({ path: `/campaigns/${campaignId}/sequences` });
}

/** Add leads to a campaign */
export function addLeadsToCampaign(
  campaignId: number,
  leadList: Record<string, unknown>[],
  settings?: Record<string, unknown>,
) {
  return smartleadRequest({
    method: 'POST',
    path: `/campaigns/${campaignId}/leads`,
    body: { lead_list: leadList, settings: settings ?? {} },
  });
}

/** List leads in a campaign */
export function listCampaignLeads(campaignId: number, offset = 0, limit = 100) {
  return smartleadRequest({
    path: `/campaigns/${campaignId}/leads`,
    queryParams: { offset, limit },
  });
}

/** Get campaign lead statistics */
export function getCampaignLeadStatistics(campaignId: number) {
  return smartleadRequest({ path: `/campaigns/${campaignId}/lead-statistics` });
}

/** Fetch lead message history within a campaign */
export function getLeadMessageHistory(campaignId: number, leadId: number) {
  return smartleadRequest({
    path: `/campaigns/${campaignId}/leads/${leadId}/message-history`,
  });
}

/** Update a lead's category in a campaign */
export function updateLeadCategory(campaignId: number, leadId: number, category: string) {
  return smartleadRequest({
    method: 'POST',
    path: `/campaigns/${campaignId}/leads/${leadId}/category`,
    body: { category },
  });
}

/** Fetch all leads from entire account (global) */
export function getGlobalLeads(offset = 0, limit = 100) {
  return smartleadRequest({
    path: '/leads/global-leads',
    queryParams: { offset, limit },
  });
}

/** Export campaign data as CSV */
export function exportCampaignData(campaignId: number) {
  return smartleadRequest<string>({ path: `/campaigns/${campaignId}/leads-export` });
}

/** Create or update an email account */
export function saveEmailAccount(account: Record<string, unknown>) {
  return smartleadRequest({
    method: 'POST',
    path: '/email-accounts/save',
    body: account,
  });
}

/** Add/update a webhook on a campaign */
export function saveCampaignWebhook(campaignId: number, webhook: Record<string, unknown>) {
  return smartleadRequest({
    method: 'POST',
    path: `/campaigns/${campaignId}/webhooks`,
    body: webhook,
  });
}

/** Fetch webhooks for a campaign */
export function getCampaignWebhooks(campaignId: number) {
  return smartleadRequest({ path: `/campaigns/${campaignId}/webhooks` });
}

/** Create a client */
export function createClient(client: { name: string; email: string; permission?: string[] }) {
  return smartleadRequest({
    method: 'POST',
    path: '/client/save',
    body: client,
  });
}

/** List all clients */
export function listClients() {
  return smartleadRequest({ path: '/client/' });
}
