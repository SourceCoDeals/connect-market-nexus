import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Apify LinkedIn Company Scraper actor - requires direct URL
const LINKEDIN_SCRAPER_ACTOR = 'logical_scrapers~linkedin-company-scraper';

// Google Search actor to find LinkedIn URLs
const GOOGLE_SEARCH_ACTOR = 'apify/google-search-scraper';

interface LinkedInCompanyData {
  employeeCount?: number;
  employeeCountRange?: string;
  name?: string;
  industry?: string;
  headquarters?: string;
  website?: string;
  description?: string;
  specialties?: string[];
  url?: string; // The actual LinkedIn URL
}

interface GoogleSearchResult {
  url?: string;
  title?: string;
  description?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');

    if (!APIFY_API_TOKEN) {
      console.error('APIFY_API_TOKEN not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Apify API token not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { linkedinUrl, companyName, city, state, dealId } = await req.json();

    if (!linkedinUrl && !companyName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Either linkedinUrl or companyName is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let targetUrl = linkedinUrl;
    let foundViaSearch = false;

    // If we don't have a direct LinkedIn URL, search Google to find it
    if (!targetUrl && companyName) {
      console.log(`No LinkedIn URL provided, searching Google for: ${companyName}`);

      // Build search query - company name + location + "linkedin"
      const locationPart = city && state ? ` ${city} ${state}` : (state ? ` ${state}` : '');
      const searchQuery = `"${companyName}"${locationPart} linkedin company`;

      try {
        const searchResult = await searchGoogleForLinkedIn(APIFY_API_TOKEN, searchQuery);
        if (searchResult) {
          targetUrl = searchResult;
          foundViaSearch = true;
          console.log(`Found LinkedIn URL via Google search: ${targetUrl}`);
        }
      } catch (searchError) {
        console.warn('Google search for LinkedIn failed:', searchError);
      }

      // If Google search didn't work, try intelligent URL guessing as fallback
      if (!targetUrl) {
        const guessedUrls = generateLinkedInUrlVariations(companyName);
        console.log(`Google search failed, trying ${guessedUrls.length} URL variations`);

        for (const guessUrl of guessedUrls) {
          const result = await tryLinkedInUrl(APIFY_API_TOKEN, guessUrl);
          if (result) {
            targetUrl = guessUrl;
            console.log(`Found valid LinkedIn URL via guessing: ${targetUrl}`);
            break;
          }
        }
      }
    }

    if (!targetUrl) {
      console.log('Could not find LinkedIn URL for company');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Could not find LinkedIn company page. Try adding the LinkedIn URL manually.',
          scraped: false,
          needsManualUrl: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Scraping LinkedIn: ${targetUrl}`);

    // Scrape the LinkedIn company page
    const companyData = await scrapeLinkedInCompany(APIFY_API_TOKEN, targetUrl);

    if (!companyData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to scrape LinkedIn company data',
          scraped: false
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = {
      success: true,
      scraped: true,
      foundViaSearch,
      linkedin_url: targetUrl,
      linkedin_employee_count: companyData.employeeCount || null,
      linkedin_employee_range: companyData.employeeCountRange || null,
      linkedin_industry: companyData.industry || null,
      linkedin_headquarters: companyData.headquarters || null,
      linkedin_website: companyData.website || null,
      linkedin_description: companyData.description?.substring(0, 1000) || null,
      linkedin_specialties: companyData.specialties || null,
    };

    // If dealId is provided, update the listing directly
    if (dealId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const updateData: Record<string, unknown> = {
        linkedin_url: targetUrl, // Always save the URL we found
      };

      if (result.linkedin_employee_count) {
        updateData.linkedin_employee_count = result.linkedin_employee_count;
      }
      if (result.linkedin_employee_range) {
        updateData.linkedin_employee_range = result.linkedin_employee_range;
      }

      const { error: updateError } = await supabase
        .from('listings')
        .update(updateData)
        .eq('id', dealId);

      if (updateError) {
        console.error('Error updating listing with LinkedIn data:', updateError);
      } else {
        console.log(`Updated deal ${dealId} with LinkedIn data (employee count: ${result.linkedin_employee_count})`);
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in apify-linkedin-scrape:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Search Google for the LinkedIn company page
 */
async function searchGoogleForLinkedIn(
  apiToken: string,
  searchQuery: string
): Promise<string | null> {
  const apifyUrl = `https://api.apify.com/v2/acts/${GOOGLE_SEARCH_ACTOR}/run-sync-get-dataset-items?token=${apiToken}`;

  try {
    const response = await fetch(apifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: searchQuery,
        maxPagesPerQuery: 1,
        resultsPerPage: 5,
        mobileResults: false,
      }),
      signal: AbortSignal.timeout(30000) // 30 second timeout for search
    });

    if (!response.ok) {
      console.error('Google search API error:', response.status);
      return null;
    }

    const results = await response.json() as GoogleSearchResult[];

    // Find the first result that's a LinkedIn company page
    for (const result of results) {
      if (result.url && isLinkedInCompanyUrl(result.url)) {
        return normalizeLinkedInUrl(result.url);
      }
    }

    return null;
  } catch (error) {
    console.error('Error searching Google:', error);
    return null;
  }
}

/**
 * Check if a URL is a LinkedIn company page
 */
function isLinkedInCompanyUrl(url: string): boolean {
  return url.includes('linkedin.com/company/') &&
         !url.includes('/jobs') &&
         !url.includes('/posts') &&
         !url.includes('/people');
}

/**
 * Normalize LinkedIn URL to standard format
 */
function normalizeLinkedInUrl(url: string): string {
  // Extract just the company slug part
  const match = url.match(/linkedin\.com\/company\/([^\/\?]+)/);
  if (match) {
    return `https://www.linkedin.com/company/${match[1]}`;
  }
  return url;
}

/**
 * Generate multiple URL variations to try
 */
function generateLinkedInUrlVariations(companyName: string): string[] {
  const variations: string[] = [];
  const baseUrl = 'https://www.linkedin.com/company/';

  // Clean the company name
  let cleanName = companyName.toLowerCase()
    .trim()
    // Remove common suffixes
    .replace(/\s*(inc\.?|llc\.?|ltd\.?|corp\.?|corporation|company|co\.?|limited|plc|group)$/gi, '')
    .trim();

  // Variation 1: Simple hyphenation
  const simple = cleanName
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-');
  variations.push(baseUrl + simple);

  // Variation 2: No hyphens, just concatenated
  const noHyphens = cleanName
    .replace(/[^a-z0-9]/g, '');
  if (noHyphens !== simple.replace(/-/g, '')) {
    variations.push(baseUrl + noHyphens);
  }

  // Variation 3: With common words removed
  const withoutCommonWords = cleanName
    .replace(/\b(the|and|of|for|a|an)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (withoutCommonWords !== simple) {
    variations.push(baseUrl + withoutCommonWords);
  }

  // Variation 4: First word only (for "Acme Services" -> "acme")
  const firstWord = cleanName.split(/\s+/)[0].replace(/[^a-z0-9]/g, '');
  if (firstWord.length > 3 && !variations.some(v => v.endsWith('/' + firstWord))) {
    variations.push(baseUrl + firstWord);
  }

  // Variation 5: First two words
  const words = cleanName.split(/\s+/);
  if (words.length >= 2) {
    const firstTwo = words.slice(0, 2)
      .join('-')
      .replace(/[^a-z0-9-]/g, '');
    if (!variations.includes(baseUrl + firstTwo)) {
      variations.push(baseUrl + firstTwo);
    }
  }

  // Remove duplicates and limit to 5 attempts
  return [...new Set(variations)].slice(0, 5);
}

/**
 * Try a LinkedIn URL and return true if it's valid
 */
async function tryLinkedInUrl(apiToken: string, url: string): Promise<boolean> {
  try {
    const result = await scrapeLinkedInCompany(apiToken, url);
    return result !== null && (result.employeeCount !== undefined || result.name !== undefined);
  } catch {
    return false;
  }
}

/**
 * Scrape a LinkedIn company page
 */
async function scrapeLinkedInCompany(
  apiToken: string,
  url: string
): Promise<LinkedInCompanyData | null> {
  const apifyUrl = `https://api.apify.com/v2/acts/${LINKEDIN_SCRAPER_ACTOR}/run-sync-get-dataset-items?token=${apiToken}`;

  try {
    const response = await fetch(apifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: [url]
      }),
      signal: AbortSignal.timeout(60000) // 60 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LinkedIn scrape API error:', response.status, errorText.substring(0, 200));
      return null;
    }

    const items = await response.json();

    if (!items || items.length === 0) {
      console.log(`No data found for LinkedIn URL: ${url}`);
      return null;
    }

    const companyData = items[0] as LinkedInCompanyData;
    console.log('LinkedIn company data:', JSON.stringify({
      name: companyData.name,
      employeeCount: companyData.employeeCount,
      industry: companyData.industry
    }));

    return companyData;
  } catch (error) {
    console.error('Error scraping LinkedIn:', error);
    return null;
  }
}
