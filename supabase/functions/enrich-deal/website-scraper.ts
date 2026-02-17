/**
 * Website Scraping Module for enrich-deal
 *
 * Handles Step 1: Website URL resolution and content scraping via Firecrawl.
 * - URL resolution from deal fields
 * - SSRF validation
 * - Homepage scraping via Firecrawl API
 * - Content validation
 *
 * Extracted from enrich-deal/index.ts to reduce monolith size.
 * All functionality is preserved — this is a pure extraction.
 */

import { validateUrl } from "../_shared/security.ts";
import {
  DEAL_SCRAPE_TIMEOUT_MS,
  WEBSITE_PLACEHOLDERS,
} from "../_shared/deal-extraction.ts";

export interface ScrapeResult {
  url: string;
  content: string;
  success: boolean;
}

export interface WebsiteScrapingResult {
  websiteUrl: string | null;
  websiteContent: string;
  scrapedPages: ScrapeResult[];
  successfulScrapes: ScrapeResult[];
  error?: string;
  errorStatus?: number;
}

/**
 * Resolve the best website URL from deal fields.
 * Returns null if no valid URL is found.
 */
export function resolveWebsiteUrl(deal: any): string | null {
  let websiteUrl = deal.website;

  // Reject placeholder values
  if (websiteUrl && WEBSITE_PLACEHOLDERS.includes(websiteUrl.trim().toLowerCase())) {
    console.log(`[Website] Rejecting placeholder website value: "${websiteUrl}"`);
    websiteUrl = null;
  }

  // Try to extract from internal_deal_memo_link
  if (!websiteUrl && deal.internal_deal_memo_link) {
    const memoLink = deal.internal_deal_memo_link;
    if (!memoLink.includes('sharepoint.com') && !memoLink.includes('onedrive')) {
      const websiteMatch = memoLink.match(/Website:\s*(https?:\/\/[^\s]+)/i);
      if (websiteMatch) {
        websiteUrl = websiteMatch[1];
      } else if (memoLink.match(/^https?:\/\/[a-zA-Z0-9]/)) {
        websiteUrl = memoLink;
      } else if (memoLink.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/)) {
        websiteUrl = `https://${memoLink}`;
      }
    }
  }

  if (!websiteUrl) return null;

  // Handle multiple comma-separated URLs
  if (websiteUrl.includes(',')) {
    const urls = websiteUrl.split(',').map((u: string) => u.trim()).filter(Boolean);
    websiteUrl = urls[0];
    console.log(`Multiple URLs detected, using first: "${websiteUrl}" (from ${urls.length} URLs)`);
  }

  // Ensure https prefix
  if (!websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
    websiteUrl = `https://${websiteUrl}`;
  }

  return websiteUrl;
}

/**
 * Validate URL against SSRF attacks.
 * Returns the normalized URL or an error.
 */
export function validateWebsiteUrl(websiteUrl: string): { valid: boolean; normalizedUrl?: string; reason?: string } {
  const urlValidation = validateUrl(websiteUrl);
  if (!urlValidation.valid) {
    console.error(`SSRF blocked for deal website: ${websiteUrl} - ${urlValidation.reason}`);
    return { valid: false, reason: urlValidation.reason || 'blocked by security policy' };
  }
  return { valid: true, normalizedUrl: urlValidation.normalizedUrl || websiteUrl };
}

/**
 * Scrape a single page via Firecrawl API.
 */
async function scrapePage(url: string, firecrawlApiKey: string): Promise<ScrapeResult> {
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 1000,
      }),
      signal: AbortSignal.timeout(DEAL_SCRAPE_TIMEOUT_MS),
    });

    if (!response.ok) {
      let errorBody = '';
      try { errorBody = await response.text(); } catch { /* ignored */ }
      console.error(`Firecrawl scrape failed for ${url}: HTTP ${response.status} — ${errorBody.slice(0, 300)}`);
      return { url, content: '', success: false };
    }

    const data = await response.json();
    const content = data.data?.markdown || data.markdown || '';
    return { url, content, success: content.length > 50 };
  } catch (err) {
    console.error(`Firecrawl scrape exception for ${url}:`, err instanceof Error ? err.message : err);
    return { url, content: '', success: false };
  }
}

/**
 * Scrape the homepage and assemble website content.
 */
export async function scrapeWebsite(websiteUrl: string, firecrawlApiKey: string): Promise<{
  scrapedPages: ScrapeResult[];
  successfulScrapes: ScrapeResult[];
  websiteContent: string;
}> {
  const scrapedPages: ScrapeResult[] = [];

  console.log(`Will scrape homepage only: ${websiteUrl}`);
  const homepageResult = await scrapePage(websiteUrl, firecrawlApiKey);
  scrapedPages.push(homepageResult);

  const successfulScrapes = scrapedPages.filter(p => p.success);
  console.log(`Successfully scraped ${successfulScrapes.length} of ${scrapedPages.length} pages`);

  let websiteContent = '';
  for (const page of scrapedPages) {
    if (page.success && page.content.length > 50) {
      const pageName = new URL(page.url).pathname || 'homepage';
      websiteContent += `\n\n=== PAGE: ${pageName} ===\n\n${page.content}`;
    }
  }

  const scrapedPagesSummary = scrapedPages.map(p => ({
    url: p.url,
    success: p.success,
    chars: p.content.length
  }));
  console.log('Scrape summary:', JSON.stringify(scrapedPagesSummary));

  return { scrapedPages, successfulScrapes, websiteContent };
}
