/**
 * Apify Google Search Client
 *
 * Uses Apify's Google Search Results Scraper for:
 * - Company URL resolution (find LinkedIn page)
 * - Company discovery (find companies matching criteria)
 */

const APIFY_API_BASE = 'https://api.apify.com/v2';
const GOOGLE_SCRAPER_ACTOR = 'apify/google-search-scraper';

export interface GoogleSearchItem {
  title: string;
  url: string;
  description: string;
  position: number;
}

/**
 * Execute a Google search via Apify and return organic results.
 * @param query  Search query string
 * @param maxResults  Maximum results to return (default 10)
 */
export async function googleSearch(
  query: string,
  maxResults: number = 10,
): Promise<GoogleSearchItem[]> {
  const apiKey = Deno.env.get('APIFY_API_KEY');
  if (!apiKey) throw new Error('APIFY_API_KEY not configured');

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
  const datasetId = runData.data?.defaultDatasetId;

  if (!datasetId) throw new Error('No dataset ID returned from Apify');

  // Wait briefly for results
  await new Promise((r) => setTimeout(r, 5000));

  // Fetch dataset
  const datasetRes = await fetch(
    `${APIFY_API_BASE}/datasets/${datasetId}/items?token=${apiKey}&limit=${maxResults}`,
  );

  if (!datasetRes.ok) {
    throw new Error(`Failed to fetch Apify dataset: ${datasetRes.status}`);
  }

  const items = await datasetRes.json();

  // Extract organic results
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

/**
 * Find a company's LinkedIn URL via Google search.
 */
export async function findCompanyLinkedIn(companyName: string): Promise<string | null> {
  const results = await googleSearch(`${companyName} site:linkedin.com/company`, 3);

  for (const result of results) {
    if (result.url.includes('linkedin.com/company/')) {
      return result.url;
    }
  }

  return null;
}
