/**
 * Apify LinkedIn Scraper Client
 *
 * Uses Apify's LinkedIn company employees scraper to discover
 * contacts at target companies. Includes company URL resolution
 * via domain inference.
 */

const APIFY_API_BASE = 'https://api.apify.com/v2';
const LINKEDIN_SCRAPER_ACTOR = 'curious_coder/linkedin-company-employees-scraper';

interface ApifyRunResult {
  id: string;
  status: string;
  defaultDatasetId: string;
}

interface ApifyEmployee {
  fullName: string;
  firstName?: string;
  lastName?: string;
  title: string;
  profileUrl: string;
  companyName?: string;
  location?: string;
}

/**
 * Scrape company employees from LinkedIn via Apify.
 * @param companyLinkedInUrl  LinkedIn company page URL
 * @param maxResults  Maximum employees to return (default 50)
 * @returns Array of employee profiles
 */
export async function scrapeCompanyEmployees(
  companyLinkedInUrl: string,
  maxResults: number = 50,
): Promise<ApifyEmployee[]> {
  const apiKey = Deno.env.get('APIFY_API_KEY');
  if (!apiKey) throw new Error('APIFY_API_KEY not configured');

  const runUrl = `${APIFY_API_BASE}/acts/${LINKEDIN_SCRAPER_ACTOR}/runs?token=${apiKey}`;

  // Start the actor run
  const runResponse = await fetch(runUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startUrls: [{ url: companyLinkedInUrl }],
      maxResults,
      proxy: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] },
    }),
  });

  if (!runResponse.ok) {
    const errText = await runResponse.text();
    throw new Error(`Apify actor start failed (${runResponse.status}): ${errText}`);
  }

  const runData: { data: ApifyRunResult } = await runResponse.json();
  const runId = runData.data.id;

  // Poll for completion (max 120s)
  const maxWait = 120_000;
  const pollInterval = 3_000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const statusRes = await fetch(`${APIFY_API_BASE}/actor-runs/${runId}?token=${apiKey}`);
    const statusData: { data: ApifyRunResult } = await statusRes.json();

    if (statusData.data.status === 'SUCCEEDED') {
      // Fetch dataset items
      const datasetRes = await fetch(
        `${APIFY_API_BASE}/datasets/${statusData.data.defaultDatasetId}/items?token=${apiKey}&limit=${maxResults}`,
      );
      const items: ApifyEmployee[] = await datasetRes.json();
      return items.map((item) => ({
        fullName: item.fullName || `${item.firstName || ''} ${item.lastName || ''}`.trim(),
        firstName: item.firstName,
        lastName: item.lastName,
        title: item.title || '',
        profileUrl: item.profileUrl || '',
        companyName: item.companyName,
        location: item.location,
      }));
    }

    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(statusData.data.status)) {
      throw new Error(`Apify actor run ${statusData.data.status}`);
    }
  }

  throw new Error('Apify actor run timed out after 120s');
}

/**
 * Resolve a company name to a LinkedIn company URL.
 * Infers the LinkedIn URL from domain or company name.
 */
export function resolveCompanyUrl(companyName: string, domain?: string): string {
  // If domain is provided, try standard LinkedIn URL pattern
  if (domain) {
    const slug = domain.replace(/\.(com|io|co|net|org)$/, '').replace(/[^a-z0-9]/gi, '');
    return `https://www.linkedin.com/company/${slug}`;
  }

  // Otherwise, generate from company name
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return `https://www.linkedin.com/company/${slug}`;
}

/**
 * Infer company domain from name (best-effort).
 */
export function inferDomain(companyName: string): string {
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '')
    .trim();

  return `${slug}.com`;
}
