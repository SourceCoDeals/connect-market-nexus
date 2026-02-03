import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LinkedInCompanyData {
  employeeCount?: number;
  employeeCountRange?: string;
  name?: string;
  industry?: string;
  headquarters?: string;
  website?: string;
  description?: string;
  linkedinUrl?: string;
}

interface FirecrawlSearchResult {
  url?: string;
  title?: string;
  description?: string;
  markdown?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Verify admin access (or service role for internal calls)
    const authHeader = req.headers.get('Authorization');
    const apiKeyHeader = req.headers.get('apikey');
    
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

    // Check if this is the service role key (for internal calls from enrich-deal)
    // Accept it in either Authorization header or apikey header
    const token = authHeader?.replace('Bearer ', '') || '';
    const isServiceRole = token === supabaseServiceKey || apiKeyHeader === supabaseServiceKey;
    
    console.log(`Auth check: isServiceRole=${isServiceRole}, hasAuthHeader=${!!authHeader}, hasApiKey=${!!apiKeyHeader}`);

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

    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

    if (!FIRECRAWL_API_KEY) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
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
    if (!targetUrl && companyName) {
      console.log(`No LinkedIn URL provided, searching for: ${companyName}`);

      // Build search query - company name + location + "linkedin"
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

      // If search didn't work, try intelligent URL guessing as fallback
      if (!targetUrl) {
        const guessedUrls = generateLinkedInUrlVariations(companyName);
        console.log(`Search failed, trying ${guessedUrls.length} URL variations`);

        for (const guessUrl of guessedUrls) {
          const isValid = await verifyLinkedInUrl(FIRECRAWL_API_KEY, guessUrl);
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

    console.log(`Scraping LinkedIn: ${targetUrl}`);

    // Scrape the LinkedIn company page using Firecrawl
    const companyData = await scrapeLinkedInCompany(FIRECRAWL_API_KEY, targetUrl);

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
    };

    // If dealId is provided, update the listing directly
    if (dealId) {
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

    // Find the first result that's a LinkedIn company page
    for (const result of results as FirecrawlSearchResult[]) {
      if (result.url && isLinkedInCompanyUrl(result.url)) {
        return normalizeLinkedInUrl(result.url);
      }
    }

    // Secondary search without site: restriction if first search fails
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
      
      for (const result of broaderResults as FirecrawlSearchResult[]) {
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
 * Verify a LinkedIn URL exists by scraping it
 */
async function verifyLinkedInUrl(apiKey: string, url: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000,
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || '';
    
    // Check if it looks like a real company page (not 404 or redirect)
    return markdown.length > 500 && 
           !markdown.includes('Page not found') &&
           !markdown.includes('This page doesn\'t exist');
  } catch {
    return false;
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
 * Scrape a LinkedIn company page using Firecrawl and extract employee data
 */
async function scrapeLinkedInCompany(
  apiKey: string,
  url: string
): Promise<LinkedInCompanyData | null> {
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'html'],
        onlyMainContent: false, // Get full page to find employee info
        waitFor: 5000, // Wait for dynamic content
      }),
      signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LinkedIn scrape API error:', response.status, errorText.substring(0, 200));
      return null;
    }

    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || '';
    const html = data.data?.html || data.html || '';

    if (!markdown && !html) {
      console.log(`No content found for LinkedIn URL: ${url}`);
      return null;
    }

    console.log(`Scraped LinkedIn page, content length: ${markdown.length} chars`);

    // Extract employee information from the content
    const companyData = extractLinkedInData(markdown, html, url);
    
    console.log('Extracted LinkedIn company data:', JSON.stringify({
      name: companyData.name,
      employeeCount: companyData.employeeCount,
      employeeCountRange: companyData.employeeCountRange,
      industry: companyData.industry
    }));

    return companyData;
  } catch (error) {
    console.error('Error scraping LinkedIn:', error);
    return null;
  }
}

/**
 * Extract LinkedIn company data from scraped content
 */
function extractLinkedInData(markdown: string, html: string, url: string): LinkedInCompanyData {
  const data: LinkedInCompanyData = {
    linkedinUrl: url
  };

  const content = markdown + ' ' + html;

  // Extract employee count - LinkedIn shows formats like:
  // "11-50 employees" or "1,001-5,000 employees" or "10,001+ employees"
  // Also: "11-50 employees · Marketing Services"
  const employeePatterns = [
    // Standard LinkedIn format: "X-Y employees"
    /(\d{1,3}(?:,\d{3})*)\s*[-–]\s*(\d{1,3}(?:,\d{3})*)\s*employees/i,
    // Plus format: "10,001+ employees"
    /(\d{1,3}(?:,\d{3})*)\+\s*employees/i,
    // Exact count: "500 employees"
    /(\d{1,3}(?:,\d{3})*)\s*employees\b/i,
    // Range with "to": "11 to 50 employees"
    /(\d{1,3}(?:,\d{3})*)\s*to\s*(\d{1,3}(?:,\d{3})*)\s*employees/i,
  ];

  for (const pattern of employeePatterns) {
    const match = content.match(pattern);
    if (match) {
      // Parse the numbers (remove commas)
      const num1 = parseInt(match[1].replace(/,/g, ''), 10);
      const num2 = match[2] ? parseInt(match[2].replace(/,/g, ''), 10) : null;

      if (num2) {
        // Range format
        data.employeeCountRange = `${num1.toLocaleString()}-${num2.toLocaleString()}`;
        data.employeeCount = Math.round((num1 + num2) / 2); // Midpoint
      } else if (match[0].includes('+')) {
        // Plus format (e.g., "10,001+")
        data.employeeCountRange = `${num1.toLocaleString()}+`;
        data.employeeCount = num1;
      } else {
        // Exact count
        data.employeeCount = num1;
        data.employeeCountRange = num1.toLocaleString();
      }
      break;
    }
  }

  // Extract industry - usually near "Company size" or at start of description
  const industryPatterns = [
    /·\s*([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*)\s*$/m, // "· Marketing Services"
    /Industry[:\s]+([A-Z][a-z]+(?:\s+[A-Za-z]+)*)/i,
    /Specialties[:\s]+([^·\n]+)/i,
  ];

  for (const pattern of industryPatterns) {
    const match = content.match(pattern);
    if (match && match[1] && match[1].length < 100) {
      data.industry = match[1].trim();
      break;
    }
  }

  // Extract headquarters location
  const hqPatterns = [
    /Headquarters[:\s]+([^\n·]+)/i,
    /(?:Based in|Located in|HQ:?)\s+([^\n·]+)/i,
  ];

  for (const pattern of hqPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      data.headquarters = match[1].trim().substring(0, 200);
      break;
    }
  }

  // Extract company name from URL or content
  const urlMatch = url.match(/linkedin\.com\/company\/([^\/\?]+)/);
  if (urlMatch) {
    // Convert URL slug to title case
    data.name = urlMatch[1]
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  // Try to find actual company name in content
  const namePatterns = [
    /^#\s*(.+?)(?:\s*\||\s*-|\s*·|\n)/m,
    /<h1[^>]*>([^<]+)</i,
  ];

  for (const pattern of namePatterns) {
    const match = content.match(pattern);
    if (match && match[1] && match[1].length < 100) {
      data.name = match[1].trim();
      break;
    }
  }

  // Extract website if present
  const websiteMatch = content.match(/(?:Website|Site)[:\s]+(https?:\/\/[^\s\n]+)/i);
  if (websiteMatch) {
    data.website = websiteMatch[1];
  }

  // Extract description (first paragraph-like content)
  const descMatch = markdown.match(/\n\n(.{50,500}?)\n\n/);
  if (descMatch) {
    data.description = descMatch[1].trim();
  }

  return data;
}
