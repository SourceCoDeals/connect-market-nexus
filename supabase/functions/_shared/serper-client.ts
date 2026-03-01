/**
 * Serper.dev Google Search & Maps Client
 *
 * Replaces Apify Google Search Scraper and Firecrawl /v1/search for:
 * - Web search (company discovery, LinkedIn URL finding)
 * - Google Maps/Places data (ratings, reviews, addresses)
 *
 * Synchronous API — no polling required. Typical response in 1-2s.
 */

const SERPER_BASE = 'https://google.serper.dev';

export interface GoogleSearchItem {
  title: string;
  url: string;
  description: string;
  position: number;
}

export interface GoogleMapsPlace {
  title?: string;
  rating?: number;
  ratingCount?: number;
  address?: string;
  phoneNumber?: string;
  website?: string;
  category?: string;
  placeId?: string;
  cid?: string;
  latitude?: number;
  longitude?: number;
}

function getApiKey(): string {
  const apiKey = Deno.env.get('SERPER_API_KEY');
  if (!apiKey) throw new Error('SERPER_API_KEY not configured');
  return apiKey;
}

/**
 * Execute a Google search via Serper and return organic results.
 * @param query  Search query string
 * @param maxResults  Maximum results to return (default 10)
 */
export async function googleSearch(
  query: string,
  maxResults: number = 10,
): Promise<GoogleSearchItem[]> {
  const apiKey = getApiKey();

  const response = await fetch(`${SERPER_BASE}/search`, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      num: maxResults,
      gl: 'us',
      hl: 'en',
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Serper search failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const organic = data.organic || [];

  return organic
    .slice(0, maxResults)
    .map((r: { title?: string; link?: string; snippet?: string; position?: number }) => ({
      title: r.title || '',
      url: r.link || '',
      description: r.snippet || '',
      position: r.position || 0,
    }));
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

/**
 * Search Google Maps for a business and return place data.
 * Uses Serper /maps endpoint which returns placeId, rating, reviews, address, etc.
 */
export async function searchGoogleMaps(query: string): Promise<GoogleMapsPlace | null> {
  const apiKey = getApiKey();

  const response = await fetch(`${SERPER_BASE}/maps`, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, num: 1 }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Serper maps failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const places = data.places || [];
  if (places.length === 0) return null;

  const p = places[0];
  return {
    title: p.title,
    rating: p.rating,
    ratingCount: p.ratingCount,
    address: p.address,
    phoneNumber: p.phoneNumber,
    website: p.website,
    category: p.type || (p.types && p.types[0]) || undefined,
    placeId: p.placeId,
    cid: p.cid,
    latitude: p.latitude,
    longitude: p.longitude,
  };
}

/**
 * Parse a US address string into city, state, and postal code components.
 * Handles formats like "123 Main St, Dallas, TX 75201" and "Dallas, TX".
 */
export function parseAddress(fullAddress: string): {
  city?: string;
  state?: string;
  postalCode?: string;
} {
  if (!fullAddress) return {};

  const cleaned = fullAddress.replace(/,?\s*United States\s*$/i, '').trim();
  const parts = cleaned.split(',').map((s) => s.trim());

  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];

    // Match "TX 75201" or "TX 75201-1234"
    const stateZipMatch = lastPart.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    if (stateZipMatch) {
      return {
        city: parts[parts.length - 2],
        state: stateZipMatch[1],
        postalCode: stateZipMatch[2],
      };
    }

    // Match just "TX"
    const stateMatch = lastPart.match(/^([A-Z]{2})$/);
    if (stateMatch) {
      return {
        city: parts[parts.length - 2],
        state: stateMatch[1],
      };
    }
  }

  return {};
}
