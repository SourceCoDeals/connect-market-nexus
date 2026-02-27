/**
 * Downtime & failure mode tests for Serper Google Search Client
 *
 * Covers: API errors (401, 403, 404, 429, 500, 502, 503),
 * network failures, timeouts, and missing API keys.
 *
 * Serper is synchronous (no polling), so these tests are simpler than the
 * previous Apify-based tests which had to mock run status polling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers: mock Deno.env and global fetch
// ---------------------------------------------------------------------------

const mockEnv: Record<string, string> = {};

const denoStub = {
  env: {
    get: (key: string) => mockEnv[key] ?? undefined,
  },
};
(globalThis as any).Deno = denoStub;

const SERPER_BASE = 'https://google.serper.dev';

interface GoogleSearchItem {
  title: string;
  url: string;
  description: string;
  position: number;
}

async function googleSearch(query: string, maxResults: number = 10): Promise<GoogleSearchItem[]> {
  const apiKey = Deno.env.get('SERPER_API_KEY');
  if (!apiKey) throw new Error('SERPER_API_KEY not configured');

  const response = await fetch(`${SERPER_BASE}/search`, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, num: maxResults, gl: 'us', hl: 'en' }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Serper search failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const organic = data.organic || [];

  return organic.slice(0, maxResults).map((r: any) => ({
    title: r.title || '',
    url: r.link || '',
    description: r.snippet || '',
    position: r.position || 0,
  }));
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

function diagnoseSerperError(errMsg: string): {
  is404: boolean;
  isAuth: boolean;
  isRateLimit: boolean;
  diagnosis: string;
} {
  const is404 = errMsg.includes('404');
  const isAuth = errMsg.includes('401') || errMsg.includes('403') || /unauthorized/i.test(errMsg);
  const isRateLimit = errMsg.includes('429');

  let diagnosis = 'Unknown Serper error';
  if (is404) diagnosis = 'Serper endpoint not found — check base URL';
  else if (isAuth) diagnosis = 'Invalid SERPER_API_KEY — check key in Supabase secrets';
  else if (isRateLimit) diagnosis = 'Rate limited by Serper — wait and retry';

  return { is404, isAuth, isRateLimit, diagnosis };
}

// ---------------------------------------------------------------------------
// Mocked fetch helpers
// ---------------------------------------------------------------------------

function mockResponse(status: number, body: string | object): Response {
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(bodyStr, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockEnv.SERPER_API_KEY = 'test-serper-key';
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as any;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete mockEnv.SERPER_API_KEY;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Serper client downtime handling', () => {
  // Missing API key
  it('throws when SERPER_API_KEY is missing', async () => {
    delete mockEnv.SERPER_API_KEY;
    await expect(googleSearch('test query')).rejects.toThrow('SERPER_API_KEY not configured');
  });

  // HTTP error codes
  it('throws on 404', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(404, 'Not Found'));
    await expect(googleSearch('test query')).rejects.toThrow('Serper search failed (404)');
  });

  it('throws on 401 (invalid key)', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(401, 'Unauthorized'));
    await expect(googleSearch('test query')).rejects.toThrow('Serper search failed (401)');
  });

  it('throws on 403 (forbidden)', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(403, 'Forbidden'));
    await expect(googleSearch('test query')).rejects.toThrow('Serper search failed (403)');
  });

  it('throws on 429 (rate limit)', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(429, 'Too Many Requests'));
    await expect(googleSearch('test query')).rejects.toThrow('Serper search failed (429)');
  });

  it('throws on 500 (server error)', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(500, 'Internal Server Error'));
    await expect(googleSearch('test query')).rejects.toThrow('Serper search failed (500)');
  });

  it('throws on 502 (bad gateway)', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(502, 'Bad Gateway'));
    await expect(googleSearch('test query')).rejects.toThrow('Serper search failed (502)');
  });

  it('throws on 503 (service unavailable)', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(503, 'Service Unavailable'));
    await expect(googleSearch('test query')).rejects.toThrow('Serper search failed (503)');
  });

  // Network failures
  it('throws on network failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Failed to fetch'));
    await expect(googleSearch('test query')).rejects.toThrow('Failed to fetch');
  });

  it('throws on DNS failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ENOTFOUND google.serper.dev'));
    await expect(googleSearch('test query')).rejects.toThrow('ENOTFOUND');
  });

  it('throws on connection refused', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(googleSearch('test query')).rejects.toThrow('ECONNREFUSED');
  });

  // Successful response
  it('returns parsed results on success', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(200, {
        organic: [
          { title: 'Test Result', link: 'https://test.com', snippet: 'A test', position: 1 },
        ],
      }),
    );

    const results = await googleSearch('test query');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Test Result');
    expect(results[0].url).toBe('https://test.com');
    expect(results[0].description).toBe('A test');
  });

  it('returns empty array for empty organic results', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, { organic: [] }));
    const results = await googleSearch('test query');
    expect(results).toHaveLength(0);
  });
});

// findCompanyLinkedIn failure propagation
describe('findCompanyLinkedIn downtime handling', () => {
  it('propagates API errors from googleSearch', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(401, 'Unauthorized'));
    await expect(findCompanyLinkedIn('Trivest Partners')).rejects.toThrow(
      'Serper search failed (401)',
    );
  });

  it('returns null when no LinkedIn URL in results', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(200, {
        organic: [{ title: 'Some Page', link: 'https://example.com', snippet: '', position: 1 }],
      }),
    );

    const result = await findCompanyLinkedIn('Trivest Partners');
    expect(result).toBeNull();
  });
});

// Error diagnosis helper
describe('diagnoseSerperError', () => {
  it('detects 404 errors', () => {
    const result = diagnoseSerperError('Serper search failed (404): Not Found');
    expect(result.is404).toBe(true);
    expect(result.diagnosis).toContain('endpoint not found');
  });

  it('detects auth errors', () => {
    const r401 = diagnoseSerperError('Serper search failed (401): Unauthorized');
    expect(r401.isAuth).toBe(true);

    const r403 = diagnoseSerperError('Serper search failed (403): Forbidden');
    expect(r403.isAuth).toBe(true);
  });

  it('detects rate limit errors', () => {
    const result = diagnoseSerperError('Serper search failed (429): Too Many Requests');
    expect(result.isRateLimit).toBe(true);
    expect(result.diagnosis).toContain('Rate limited');
  });
});
