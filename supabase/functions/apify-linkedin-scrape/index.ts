import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApifyLinkedInResult {
  name?: string;
  tagline?: string;
  description?: string;
  website?: string;
  industry?: string;
  companySize?: string;       // e.g., "11-50 employees"
  employeeCount?: number;     // e.g., 25
  headquarters?: string;
  foundedYear?: number;
  specialties?: string[];
  logoUrl?: string;
  linkedinUrl?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Verify admin access (or service role for internal calls)
    const authHeader = req.headers.get('Authorization');
    // Supabase sends this as `apikey` for both browser and service-role internal calls.
    const apiKeyHeader = req.headers.get('apikey');
    
    // Require at least one form of auth
    if (!authHeader && !apiKeyHeader) {
      console.error('No authorization header or apikey provided');
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Check if this is the service role key (for internal calls)
    // Be tolerant of `bearer` casing to avoid false negatives.
    // IMPORTANT: Check BOTH the Authorization header bearer token AND the apikey header
    const token = (authHeader || '').replace(/^Bearer\s+/i, '').trim();
    const isServiceRole = token === supabaseServiceKey || apiKeyHeader === supabaseServiceKey;
    
    console.log(`Auth check: isServiceRole=${isServiceRole}, hasAuthHeader=${!!authHeader}, hasApiKey=${!!apiKeyHeader}, tokenMatch=${token === supabaseServiceKey}, apiKeyMatch=${apiKeyHeader === supabaseServiceKey}`);

    if (!isServiceRole) {
      // Verify admin access for manual calls
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader || `Bearer ${apiKeyHeader}` } }
      });

      const { data: { user }, error: userError } = await authClient.auth.getUser();
      if (userError || !user) {
        console.error('User auth failed:', userError?.message);
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: profile } = await authClient
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (!profile?.is_admin) {
        console.log(`User ${user.id} is not admin`);
        return new Response(JSON.stringify({ error: 'Admin access required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log(`Admin access verified for user ${user.id}`);
    }

    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

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

    // If we don't have a direct LinkedIn URL, search using Firecrawl
    if (!targetUrl && companyName && FIRECRAWL_API_KEY) {
      console.log(`No LinkedIn URL provided, searching for: ${companyName}`);

      const locationPart = city && state ? ` ${city} ${state}` : (state ? ` ${state}` : '');
      const searchQuery = `site:linkedin.com/company "${companyName}"${locationPart}`;

      try {
        targetUrl = await searchForLinkedIn(FIRECRAWL_API_KEY, searchQuery, companyName);
        if (targetUrl) {
          foundViaSearch = true;
          console.log(`Found LinkedIn URL via Firecrawl search: ${targetUrl}`);
        }
      } catch (searchError) {
        console.warn('Firecrawl search for LinkedIn failed:', searchError);
      }

      // If search didn't work, try intelligent URL guessing
      if (!targetUrl) {
        const guessedUrls = generateLinkedInUrlVariations(companyName);
        console.log(`Search failed, trying ${guessedUrls.length} URL variations`);

        for (const guessUrl of guessedUrls) {
          const isValid = await verifyLinkedInUrl(guessUrl);
          if (isValid) {
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

    console.log(`Scraping LinkedIn using Apify actor: ${targetUrl}`);

    // Use Apify's logical_scrapers/linkedin-company-scraper actor
    const companyData = await scrapeWithApify(APIFY_API_TOKEN, targetUrl);

    if (!companyData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to scrape LinkedIn company data via Apify',
          scraped: false
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse employee data from Apify result
    const { employeeCount, employeeRange } = parseEmployeeData(companyData);

    // Normalize the LinkedIn URL to direct format
    const normalizedLinkedinUrl = normalizeLinkedInUrl(targetUrl);

    const result = {
      success: true,
      scraped: true,
      foundViaSearch,
      linkedin_url: normalizedLinkedinUrl,
      linkedin_employee_count: employeeCount,
      linkedin_employee_range: employeeRange,
      linkedin_industry: companyData.industry || null,
      linkedin_headquarters: companyData.headquarters || null,
      linkedin_website: companyData.website || null,
      linkedin_description: companyData.description?.substring(0, 1000) || null,
    };

    console.log(`Apify scrape result: employeeCount=${employeeCount}, employeeRange=${employeeRange}`);

    // If dealId is provided, update the listing directly
    if (dealId) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const updateData: Record<string, unknown> = {
        linkedin_url: normalizedLinkedinUrl,
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
        console.log(`Updated deal ${dealId} with LinkedIn data (employee count: ${result.linkedin_employee_count}, range: ${result.linkedin_employee_range})`);
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
 * Scrape LinkedIn company page using Apify's logical_scrapers/linkedin-company-scraper
 */
async function scrapeWithApify(apiToken: string, linkedinUrl: string): Promise<ApifyLinkedInResult | null> {
  const ACTOR_ID = 'logical_scrapers~linkedin-company-scraper';
  const API_BASE = 'https://api.apify.com/v2';

  try {
    // Start the actor run synchronously (wait for results)
    const runUrl = `${API_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${apiToken}`;
    
    console.log(`Starting Apify actor run for: ${linkedinUrl}`);

    const response = await fetch(runUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: [linkedinUrl]  // Apify actor expects "url" field (array)
      }),
      signal: AbortSignal.timeout(120000) // 2 minute timeout for actor run
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Apify actor error [${response.status}]:`, errorText.substring(0, 500));
      
      if (response.status === 402) {
        throw new Error('Apify credits depleted - please add credits to your Apify account');
      }
      if (response.status === 403) {
        throw new Error('Apify actor access denied - check your API token and actor subscription');
      }
      
      return null;
    }

    const results = await response.json();
    
    if (!results || results.length === 0) {
      console.log('Apify actor returned no results');
      return null;
    }

    // The actor returns an array of company profiles
    const companyProfile = results[0];
    console.log('Apify raw result keys:', Object.keys(companyProfile || {}));
    
    // The actor uses different field names than expected:
    // - numberOfEmployees (number or string like "37 on LinkedIn")
    // - "Company size" (note the space!) for the range like "11-50 employees"
    console.log('Apify numberOfEmployees:', companyProfile?.numberOfEmployees);
    console.log('Apify Company size:', companyProfile?.['Company size']);
    console.log('Apify Industry:', companyProfile?.Industry);

    // Parse numberOfEmployees - can be number or string like "37 on LinkedIn" or "2,500 on LinkedIn"
    let rawEmployeeCount: number | null = null;
    if (companyProfile?.numberOfEmployees) {
      const empValue = companyProfile.numberOfEmployees;
      if (typeof empValue === 'number') {
        rawEmployeeCount = empValue;
      } else if (typeof empValue === 'string') {
        // Extract number from strings like "37 on LinkedIn" or "2,500 on LinkedIn"
        const match = empValue.match(/^([\d,]+)/);
        if (match) {
          rawEmployeeCount = parseInt(match[1].replace(/,/g, ''), 10);
        }
      }
    }

    return {
      name: companyProfile.name,
      tagline: companyProfile.slogan,
      description: companyProfile.description,
      website: companyProfile.website,
      industry: companyProfile.Industry,
      companySize: companyProfile['Company size'],  // Note: key has space
      employeeCount: rawEmployeeCount,
      headquarters: companyProfile.Headquarters || companyProfile.mainAddress,
      foundedYear: companyProfile.Founded ? parseInt(companyProfile.Founded, 10) : undefined,
      specialties: companyProfile.Specialties?.split(',').map((s: string) => s.trim()),
      logoUrl: companyProfile.logo,
      linkedinUrl: companyProfile.url || linkedinUrl,
    };

  } catch (error) {
    console.error('Apify actor execution error:', error);
    return null;
  }
}

/**
 * Parse employee count and range from Apify result
 */
function parseEmployeeData(data: ApifyLinkedInResult): { employeeCount: number | null; employeeRange: string | null } {
  let employeeCount: number | null = null;
  let employeeRange: string | null = null;

  // Direct employee count from Apify
  if (data.employeeCount && typeof data.employeeCount === 'number') {
    employeeCount = data.employeeCount;
  }

  // Company size string (e.g., "11-50 employees" or "1,001-5,000 employees")
  if (data.companySize) {
    employeeRange = data.companySize;
    
    // Try to extract midpoint if we don't have exact count
    if (!employeeCount) {
      const rangeMatch = data.companySize.match(/(\d{1,3}(?:,\d{3})*)\s*[-–]\s*(\d{1,3}(?:,\d{3})*)/);
      if (rangeMatch) {
        const low = parseInt(rangeMatch[1].replace(/,/g, ''), 10);
        const high = parseInt(rangeMatch[2].replace(/,/g, ''), 10);
        employeeCount = Math.round((low + high) / 2);
      } else {
        // Check for "10,001+ employees" format
        const plusMatch = data.companySize.match(/(\d{1,3}(?:,\d{3})*)\+/);
        if (plusMatch) {
          employeeCount = parseInt(plusMatch[1].replace(/,/g, ''), 10);
        }
      }
    }
  }

  return { employeeCount, employeeRange };
}

/**
 * Search for LinkedIn company page using Firecrawl
 */
async function searchForLinkedIn(
  apiKey: string,
  searchQuery: string,
  companyName: string
): Promise<string | null> {
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 5,
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      console.error('Firecrawl search API error:', response.status);
      return null;
    }

    const data = await response.json();
    const results = data.data || data || [];

    for (const result of results) {
      if (result.url && isLinkedInCompanyUrl(result.url)) {
        return normalizeLinkedInUrl(result.url);
      }
    }

    // Broader search fallback
    console.log('First search found no results, trying broader search...');
    const broaderResponse = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `"${companyName}" linkedin company`,
        limit: 10,
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (broaderResponse.ok) {
      const broaderData = await broaderResponse.json();
      const broaderResults = broaderData.data || broaderData || [];
      
      for (const result of broaderResults) {
        if (result.url && isLinkedInCompanyUrl(result.url)) {
          return normalizeLinkedInUrl(result.url);
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error searching with Firecrawl:', error);
    return null;
  }
}

/**
 * Verify a LinkedIn URL exists (simple HEAD check)
 */
async function verifyLinkedInUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
      redirect: 'manual'
    });
    // LinkedIn returns 200 for valid pages, 999 for rate limiting, 302 for invalid
    return response.status === 200;
  } catch {
    return false;
  }
}

function isLinkedInCompanyUrl(url: string): boolean {
  return url.includes('linkedin.com/company/') &&
         !url.includes('/jobs') &&
         !url.includes('/posts') &&
         !url.includes('/people');
}

function normalizeLinkedInUrl(url: string): string {
  const match = url.match(/linkedin\.com\/company\/([^\/\?]+)/);
  if (match) {
    return `https://www.linkedin.com/company/${match[1]}`;
  }
  return url;
}

function generateLinkedInUrlVariations(companyName: string): string[] {
  const variations: string[] = [];
  const baseUrl = 'https://www.linkedin.com/company/';

  let cleanName = companyName.toLowerCase()
    .trim()
    .replace(/\s*(inc\.?|llc\.?|ltd\.?|corp\.?|corporation|company|co\.?|limited|plc|group)$/gi, '')
    .trim();

  // Simple hyphenation
  const simple = cleanName.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
  variations.push(baseUrl + simple);

  // No hyphens
  const noHyphens = cleanName.replace(/[^a-z0-9]/g, '');
  if (noHyphens !== simple.replace(/-/g, '')) {
    variations.push(baseUrl + noHyphens);
  }

  // Without common words
  const withoutCommonWords = cleanName
    .replace(/\b(the|and|of|for|a|an)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (withoutCommonWords !== simple) {
    variations.push(baseUrl + withoutCommonWords);
  }

  // First word only
  const firstWord = cleanName.split(/\s+/)[0].replace(/[^a-z0-9]/g, '');
  if (firstWord.length > 3 && !variations.some(v => v.endsWith('/' + firstWord))) {
    variations.push(baseUrl + firstWord);
  }

  return [...new Set(variations)].slice(0, 5);
}
