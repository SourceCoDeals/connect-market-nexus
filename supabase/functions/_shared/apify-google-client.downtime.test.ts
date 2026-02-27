/**
 * Downtime & failure mode tests for Apify Google Search Client
 *
 * Covers: API errors (404, 401, 403, 429, 500, 502, 503),
 * network failures, timeouts, missing API keys, and run status failures.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers: mock Deno.env and global fetch
// ---------------------------------------------------------------------------

const mockEnv: Record<string, string> = {};

// Stub Deno global for tests (edge functions run in Deno)
const denoStub = {
  env: {
    get: (key: string) => mockEnv[key] ?? undefined,
  },
};
(globalThis as any).Deno = denoStub;

// We re-implement the client functions inline so we can test them with mocked
// fetch without needing Deno import resolution. The logic mirrors
// apify-google-client.ts exactly.

const APIFY_API_BASE = 'https://api.apify.com/v2';
const GOOGLE_SCRAPER_ACTOR = 'apify/google-search-scraper';

interface GoogleSearchItem {
  title: string;
  url: string;
  description: string;
  position: number;
}

async function googleSearch(query: string, maxResults: number = 10): Promise<GoogleSearchItem[]> {
  const apiKey = Deno.env.get('APIFY_API_TOKEN');
  if (!apiKey) throw new Error('APIFY_API_TOKEN not configured');

  const runUrl = `${APIFY_API_BASE}/acts/${GOOGLE_SCRAPER_ACTOR}/runs?token=${apiKey}`;

  const runResponse = await fetch(runUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      queries: query,
      maxPagesPerQuery: 1,
      resultsPerPage: maxResults,
      languageCode: 'en',
      countryCode: 'us',
    }),
  });

  if (!runResponse.ok) {
    const errText = await runResponse.text();
    throw new Error(`Apify Google search failed (${runResponse.status}): ${errText}`);
  }

  const runData = await runResponse.json();
  const runId = runData.data?.id;
  const datasetId = runData.data?.defaultDatasetId;

  if (!datasetId || !runId) throw new Error('No dataset/run ID returned from Apify');

  // Poll for completion (max 30s, 2s intervals)
  const maxWait = 30_000;
  const pollInterval = 2_000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const statusRes = await fetch(`${APIFY_API_BASE}/actor-runs/${runId}?token=${apiKey}`);
    if (!statusRes.ok) continue;
    const statusData = await statusRes.json();
    const status = statusData.data?.status;

    if (status === 'SUCCEEDED') break;
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
      throw new Error(`Apify Google search run ${status}`);
    }
  }

  // Fetch dataset
  const datasetRes = await fetch(
    `${APIFY_API_BASE}/datasets/${datasetId}/items?token=${apiKey}&limit=${maxResults}`,
  );

  if (!datasetRes.ok) {
    throw new Error(`Failed to fetch Apify dataset: ${datasetRes.status}`);
  }

  const items = await datasetRes.json();

  const results: GoogleSearchItem[] = [];
  for (const item of items) {
    const organicResults = item.organicResults || [];
    for (const result of organicResults) {
      results.push({
        title: result.title || '',
        url: result.url || '',
        description: result.description || '',
        position: result.position || results.length + 1,
      });
    }
  }

  return results.slice(0, maxResults);
}

async function findCompanyLinkedIn(companyName: string): Promise<string | null> {
  const results = await googleSearch(`${companyName} site:linkedin.com/company`, 3);
  for (const result of results) {
    if (result.url.includes('linkedin.com/company/')) {
      return result.url;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Error diagnosis helper (mirrors integration-action-tools.ts logic)
// ---------------------------------------------------------------------------

function diagnoseGoogleSearchError(errMsg: string): {
  diagnosis: string;
  is404: boolean;
  isAuth: boolean;
  isRateLimit: boolean;
} {
  const is404 = errMsg.includes('404');
  const isAuth =
    errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('Unauthorized');
  const isRateLimit = errMsg.includes('429');

  let diagnosis = '';
  if (is404) {
    diagnosis = 'The Apify Google search actor may have been renamed or removed.';
  } else if (isAuth) {
    diagnosis = 'The APIFY_API_TOKEN appears to be invalid or expired.';
  } else if (isRateLimit) {
    diagnosis = 'Apify rate limit hit. Try again in a few minutes.';
  } else {
    diagnosis = 'This may be a temporary network issue. Try again shortly.';
  }

  return { diagnosis, is404, isAuth, isRateLimit };
}

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function mockResponse(status: number, body: any, ok?: boolean): Response {
  return {
    ok: ok ?? (status >= 200 && status < 300),
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
    json: () => Promise.resolve(body),
    headers: new Headers(),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Google API Downtime Tests', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    mockEnv['APIFY_API_TOKEN'] = 'test-apify-key-123';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete mockEnv['APIFY_API_TOKEN'];
  });

  // =========================================================================
  // Missing API key
  // =========================================================================

  describe('Missing APIFY_API_TOKEN', () => {
    it('throws immediately when API key is not configured', async () => {
      delete mockEnv['APIFY_API_TOKEN'];

      await expect(googleSearch('test query')).rejects.toThrow('APIFY_API_TOKEN not configured');
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Actor not found (404) — the documented issue
  // =========================================================================

  describe('Actor not found (404)', () => {
    it('throws with 404 status when Apify actor is removed/renamed', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse(404, 'Actor apify/google-search-scraper was not found'),
      );

      await expect(googleSearch('test query')).rejects.toThrow('Apify Google search failed (404)');
    });

    it('error message includes the 404 status for downstream diagnosis', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(404, 'Actor not found'));

      try {
        await googleSearch('test query');
        expect.fail('Should have thrown');
      } catch (err: any) {
        const { is404, diagnosis } = diagnoseGoogleSearchError(err.message);
        expect(is404).toBe(true);
        expect(diagnosis).toContain('renamed or removed');
      }
    });
  });

  // =========================================================================
  // Authentication errors (401, 403)
  // =========================================================================

  describe('Authentication errors', () => {
    it('throws with 401 when API key is invalid', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(401, 'Unauthorized - invalid API token'));

      await expect(googleSearch('test query')).rejects.toThrow('Apify Google search failed (401)');
    });

    it('throws with 403 when API key lacks permissions', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(403, 'Forbidden - insufficient permissions'));

      await expect(googleSearch('test query')).rejects.toThrow('Apify Google search failed (403)');
    });

    it('diagnosis correctly identifies auth errors', () => {
      const { isAuth: isAuth401 } = diagnoseGoogleSearchError(
        'Apify Google search failed (401): Unauthorized',
      );
      expect(isAuth401).toBe(true);

      const { isAuth: isAuth403 } = diagnoseGoogleSearchError(
        'Apify Google search failed (403): Forbidden',
      );
      expect(isAuth403).toBe(true);
    });
  });

  // =========================================================================
  // Rate limiting (429)
  // =========================================================================

  describe('Rate limiting (429)', () => {
    it('throws with 429 when rate limited', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(429, 'Too Many Requests - rate limit exceeded'));

      await expect(googleSearch('test query')).rejects.toThrow('Apify Google search failed (429)');
    });

    it('diagnosis correctly identifies rate limit', () => {
      const { isRateLimit, diagnosis } = diagnoseGoogleSearchError(
        'Apify Google search failed (429): Too Many Requests',
      );
      expect(isRateLimit).toBe(true);
      expect(diagnosis).toContain('rate limit');
    });
  });

  // =========================================================================
  // Server errors (500, 502, 503)
  // =========================================================================

  describe('Server errors (5xx)', () => {
    it.each([500, 502, 503])('throws with %d server error', async (status) => {
      fetchSpy.mockResolvedValueOnce(mockResponse(status, 'Internal Server Error'));

      await expect(googleSearch('test query')).rejects.toThrow(
        `Apify Google search failed (${status})`,
      );
    });

    it('diagnosis falls back to network error for 500', () => {
      const { is404, isAuth, isRateLimit, diagnosis } = diagnoseGoogleSearchError(
        'Apify Google search failed (500): Internal Server Error',
      );
      expect(is404).toBe(false);
      expect(isAuth).toBe(false);
      expect(isRateLimit).toBe(false);
      expect(diagnosis).toContain('temporary network issue');
    });
  });

  // =========================================================================
  // Network failures (fetch throws)
  // =========================================================================

  describe('Network failures', () => {
    it('propagates network errors when fetch rejects', async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(googleSearch('test query')).rejects.toThrow('Failed to fetch');
    });

    it('propagates DNS resolution failures', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND api.apify.com'));

      await expect(googleSearch('test query')).rejects.toThrow('ENOTFOUND');
    });

    it('propagates connection refused errors', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:443'));

      await expect(googleSearch('test query')).rejects.toThrow('ECONNREFUSED');
    });
  });

  // =========================================================================
  // Run starts but returns no dataset/run ID
  // =========================================================================

  describe('Missing dataset/run ID', () => {
    it('throws when API returns success but no run data', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, { data: {} }));

      await expect(googleSearch('test query')).rejects.toThrow(
        'No dataset/run ID returned from Apify',
      );
    });

    it('throws when API returns null data', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, { data: null }));

      await expect(googleSearch('test query')).rejects.toThrow(
        'No dataset/run ID returned from Apify',
      );
    });
  });

  // =========================================================================
  // Run status failures (FAILED, ABORTED, TIMED-OUT)
  // =========================================================================

  describe('Run status failures', () => {
    const startRunResponse = mockResponse(200, {
      data: { id: 'run-123', defaultDatasetId: 'dataset-456' },
    });

    it.each(['FAILED', 'ABORTED', 'TIMED-OUT'])(
      'throws when run completes with status %s',
      async (failStatus) => {
        fetchSpy
          // POST to start run
          .mockResolvedValueOnce(startRunResponse)
          // Poll status
          .mockResolvedValueOnce(mockResponse(200, { data: { status: failStatus } }));

        await expect(googleSearch('test query')).rejects.toThrow(
          `Apify Google search run ${failStatus}`,
        );
      },
    );
  });

  // =========================================================================
  // Dataset fetch failure
  // =========================================================================

  describe('Dataset fetch failure', () => {
    it('throws when dataset fetch returns non-OK status', async () => {
      fetchSpy
        // POST to start run
        .mockResolvedValueOnce(
          mockResponse(200, { data: { id: 'run-123', defaultDatasetId: 'dataset-456' } }),
        )
        // Poll status — immediate success
        .mockResolvedValueOnce(mockResponse(200, { data: { status: 'SUCCEEDED' } }))
        // Fetch dataset — fails
        .mockResolvedValueOnce(mockResponse(500, 'Dataset service unavailable'));

      await expect(googleSearch('test query')).rejects.toThrow(
        'Failed to fetch Apify dataset: 500',
      );
    });
  });

  // =========================================================================
  // Poll status endpoint returning errors
  // =========================================================================

  describe('Poll status endpoint errors', () => {
    it('continues polling when status endpoint returns non-OK (ignores transient errors)', async () => {
      fetchSpy
        // POST to start run
        .mockResolvedValueOnce(
          mockResponse(200, { data: { id: 'run-123', defaultDatasetId: 'dataset-456' } }),
        )
        // First poll — 500 error (should be ignored, retry)
        .mockResolvedValueOnce(mockResponse(500, 'Server Error'))
        // Second poll — 503 (should be ignored, retry)
        .mockResolvedValueOnce(mockResponse(503, 'Service Unavailable'))
        // Third poll — success
        .mockResolvedValueOnce(mockResponse(200, { data: { status: 'SUCCEEDED' } }))
        // Dataset fetch — returns results
        .mockResolvedValueOnce(
          mockResponse(200, [
            {
              organicResults: [
                {
                  title: 'Test Result',
                  url: 'https://example.com',
                  description: 'desc',
                  position: 1,
                },
              ],
            },
          ]),
        );

      const results = await googleSearch('test query');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Test Result');
    }, 15000); // Increase timeout — poll loop uses 2s intervals
  });

  // =========================================================================
  // findCompanyLinkedIn failure propagation
  // =========================================================================

  describe('findCompanyLinkedIn downtime handling', () => {
    it('propagates API errors from googleSearch', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(404, 'Actor not found'));

      await expect(findCompanyLinkedIn('Trivest Partners')).rejects.toThrow(
        'Apify Google search failed (404)',
      );
    });

    it('returns null when search succeeds but no LinkedIn URL found', async () => {
      fetchSpy
        .mockResolvedValueOnce(
          mockResponse(200, { data: { id: 'run-1', defaultDatasetId: 'ds-1' } }),
        )
        .mockResolvedValueOnce(mockResponse(200, { data: { status: 'SUCCEEDED' } }))
        .mockResolvedValueOnce(
          mockResponse(200, [
            {
              organicResults: [
                { title: 'Example', url: 'https://example.com', description: '', position: 1 },
              ],
            },
          ]),
        );

      const result = await findCompanyLinkedIn('Trivest Partners');
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // Error diagnosis integration
  // =========================================================================

  describe('Error diagnosis helper', () => {
    it('diagnoses 404 as actor renamed/removed', () => {
      const result = diagnoseGoogleSearchError('Apify Google search failed (404): Actor not found');
      expect(result.is404).toBe(true);
      expect(result.diagnosis).toContain('renamed or removed');
    });

    it('diagnoses 401 as invalid API key', () => {
      const result = diagnoseGoogleSearchError('Apify Google search failed (401): Unauthorized');
      expect(result.isAuth).toBe(true);
      expect(result.diagnosis).toContain('invalid or expired');
    });

    it('diagnoses 403 as invalid API key', () => {
      const result = diagnoseGoogleSearchError('Apify Google search failed (403): Forbidden');
      expect(result.isAuth).toBe(true);
    });

    it('diagnoses 429 as rate limit', () => {
      const result = diagnoseGoogleSearchError(
        'Apify Google search failed (429): Too Many Requests',
      );
      expect(result.isRateLimit).toBe(true);
      expect(result.diagnosis).toContain('rate limit');
    });

    it('diagnoses unknown errors as temporary network issue', () => {
      const result = diagnoseGoogleSearchError('Failed to fetch');
      expect(result.is404).toBe(false);
      expect(result.isAuth).toBe(false);
      expect(result.isRateLimit).toBe(false);
      expect(result.diagnosis).toContain('temporary network issue');
    });
  });
});
