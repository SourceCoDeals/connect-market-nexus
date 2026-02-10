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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

    if (!APIFY_API_TOKEN) {
      console.error('APIFY_API_TOKEN not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Apify API token not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { linkedinUrl, companyName, city, state, dealId, companyWebsite } = await req.json();

    if (!linkedinUrl && !companyName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Either linkedinUrl or companyName is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`LinkedIn scrape request: companyName="${companyName}", website="${companyWebsite}", linkedinUrl="${linkedinUrl}"`)

    let targetUrl = linkedinUrl;
    let foundViaSearch = false;
    let companyData: ApifyLinkedInResult | null = null;

    // If we have a direct LinkedIn URL, use it directly
    if (targetUrl) {
      console.log(`Scraping provided LinkedIn URL: ${targetUrl}`);
      companyData = await scrapeWithApify(APIFY_API_TOKEN, targetUrl);
    }

    // If we don't have a direct LinkedIn URL (or it failed), search using Firecrawl
    if (!companyData && !targetUrl && companyName && FIRECRAWL_API_KEY) {
      console.log(`No LinkedIn URL provided, searching for: ${companyName}`);

      const locationPart = city && state ? ` ${city} ${state}` : (state ? ` ${state}` : '');
      const searchQuery = `site:linkedin.com/company "${companyName}"${locationPart}`;

      let candidateUrls: string[] = [];
      try {
        candidateUrls = await searchForLinkedInCandidates(FIRECRAWL_API_KEY, searchQuery, companyName, 5);
        console.log(`Found ${candidateUrls.length} LinkedIn candidate URLs`);
      } catch (searchError) {
        console.warn('Firecrawl search for LinkedIn failed:', searchError);
      }

      // Add URL guesses as fallback candidates
      if (candidateUrls.length === 0) {
        const guessedUrls = generateLinkedInUrlVariations(companyName);
        console.log(`Search found 0 results, adding ${guessedUrls.length} URL guesses as candidates`);
        candidateUrls = guessedUrls;
      }

      if (candidateUrls.length === 0) {
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

      // MULTI-CANDIDATE RANKING:
      // Scrape up to 3 candidates and pick the best match by score.
      // This prevents picking the wrong "NES" or "Johnson" company.
      const MAX_CANDIDATES_TO_SCRAPE = Math.min(candidateUrls.length, 3);
      console.log(`Scraping ${MAX_CANDIDATES_TO_SCRAPE} of ${candidateUrls.length} candidates for ranking`);

      type ScoredCandidate = {
        url: string;
        data: ApifyLinkedInResult;
        score: number;
        signals: Record<string, unknown>;
      };
      const scoredCandidates: ScoredCandidate[] = [];

      for (let i = 0; i < MAX_CANDIDATES_TO_SCRAPE; i++) {
        const url = candidateUrls[i];
        console.log(`Scraping candidate ${i + 1}/${MAX_CANDIDATES_TO_SCRAPE}: ${url}`);

        const candidateData = await scrapeWithApify(APIFY_API_TOKEN, url);
        if (!candidateData) {
          console.log(`Candidate ${url} returned no data, skipping`);
          continue;
        }

        const { score, signals } = scoreLinkedInCandidate(
          candidateData, companyName, companyWebsite, city, state
        );
        console.log(`Candidate "${candidateData.name}" (${url}): score=${score}, signals=${JSON.stringify(signals)}`);

        scoredCandidates.push({ url, data: candidateData, score, signals });

        // Early exit: if we find a high-confidence match (score >= 65), stop searching
        if (score >= 65) {
          console.log(`High-confidence match found (score ${score}), stopping candidate search`);
          break;
        }
      }

      if (scoredCandidates.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Found LinkedIn candidate URLs but none returned valid data via Apify.',
            scraped: false,
            needsManualUrl: true,
            candidatesAttempted: MAX_CANDIDATES_TO_SCRAPE
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Sort by score descending and pick the best
      scoredCandidates.sort((a, b) => b.score - a.score);
      const best = scoredCandidates[0];

      console.log(`Best candidate: "${best.data.name}" (score ${best.score}), runner-up: ${scoredCandidates[1] ? `"${scoredCandidates[1].data.name}" (score ${scoredCandidates[1].score})` : 'none'}`);

      // Reject if best score is too low — ask for manual URL
      if (best.score < 25) {
        console.warn(`Best candidate score (${best.score}) is too low — rejecting all candidates`);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Found LinkedIn profiles but none are a confident match for "${companyName}". Best match was "${best.data.name}" (score ${best.score}/100). Please provide the LinkedIn URL manually.`,
            scraped: false,
            needsManualUrl: true,
            bestCandidate: {
              name: best.data.name,
              url: best.url,
              score: best.score,
              headquarters: best.data.headquarters,
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      targetUrl = best.url;
      companyData = best.data;
      foundViaSearch = true;
    }

    if (!companyData) {
      if (targetUrl) {
        // Direct URL was provided but scrape returned nothing
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to scrape LinkedIn company data via Apify',
            scraped: false
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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

    // POST-SCRAPE VERIFICATION for directly provided URLs or single-candidate results
    // (Multi-candidate ranking already handles this via scoring, but we still verify
    // website and location for URLs provided directly or when only 1 candidate was found)
    if (!foundViaSearch) {
      // Direct URL — still verify website if available
      if (companyWebsite && companyData.website) {
        const websiteMatch = doWebsitesMatch(companyWebsite, companyData.website);
        if (!websiteMatch) {
          console.warn(`WEBSITE MISMATCH on direct URL: "${companyWebsite}" vs LinkedIn "${companyData.website}"`);
          // Log but don't reject for direct URLs — user explicitly provided it
        } else {
          console.log(`Website verification PASSED: "${companyWebsite}" matches LinkedIn "${companyData.website}"`);
        }
      }
    } else {
      // Found via search — apply stricter verification
      if (companyWebsite && companyData.website) {
        const websiteMatch = doWebsitesMatch(companyWebsite, companyData.website);
        if (!websiteMatch) {
          console.warn(`WEBSITE MISMATCH: Company website "${companyWebsite}" does not match LinkedIn website "${companyData.website}". Rejecting.`);
          return new Response(
            JSON.stringify({
              success: false,
              error: `LinkedIn profile website (${companyData.website}) does not match company website (${companyWebsite}). This may be the wrong company.`,
              scraped: false,
              websiteMismatch: true,
              linkedinWebsite: companyData.website,
              expectedWebsite: companyWebsite,
              needsManualUrl: true
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.log(`Website verification PASSED: "${companyWebsite}" matches LinkedIn "${companyData.website}"`);
      } else if (!companyData.website && companyWebsite) {
        console.warn(`VERIFICATION FAILED: LinkedIn profile has no website, but we have "${companyWebsite}" to verify. REJECTING.`);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Found a LinkedIn profile for "${companyName}" but cannot verify it's the correct company (no website listed). Please provide the LinkedIn URL manually.`,
            scraped: false,
            noWebsiteToVerify: true,
            needsManualUrl: true,
            linkedinProfileName: companyData.name,
            linkedinHeadquarters: companyData.headquarters
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else if (!companyData.website && !companyWebsite) {
        console.warn('Neither LinkedIn profile nor company has website — cannot verify match quality');
      }

      // Location verification for search results
      if ((city || state) && companyData.headquarters) {
        const locationMatch = verifyLocation(companyData.headquarters, city, state);
        if (!locationMatch.match && locationMatch.confidence === 'high') {
          console.warn(`LOCATION MISMATCH: HQ "${companyData.headquarters}" vs expected "${city}, ${state}". Rejecting.`);
          return new Response(
            JSON.stringify({
              success: false,
              error: `LinkedIn profile headquarters (${companyData.headquarters}) does not match deal location (${city}, ${state}). ${locationMatch.reason}`,
              scraped: false,
              locationMismatch: true,
              linkedinHeadquarters: companyData.headquarters,
              expectedLocation: `${city}, ${state}`,
              needsManualUrl: true
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else if (locationMatch.match) {
          console.log(`Location verification PASSED: "${companyData.headquarters}" (${locationMatch.confidence} confidence)`);
        } else {
          console.warn(`Location mismatch with ${locationMatch.confidence} confidence: ${locationMatch.reason}. Allowing.`);
        }
      }
    }

    // Parse employee data from Apify result
    const { employeeCount, employeeRange } = parseEmployeeData(companyData);

    // Normalize the LinkedIn URL to direct format
    const normalizedLinkedinUrl = normalizeLinkedInUrl(targetUrl || companyData.linkedinUrl || '');

    // Calculate match confidence and signals
    const websiteMatch = !!(companyWebsite && companyData.website && doWebsitesMatch(companyWebsite, companyData.website));
    let locationMatchResult = null;
    if ((city || state) && companyData.headquarters) {
      locationMatchResult = verifyLocation(companyData.headquarters, city, state);
    }

    // Determine overall match confidence
    let matchConfidence: 'high' | 'medium' | 'low' | 'manual' = 'manual'; // Default if manually provided URL
    if (foundViaSearch) {
      if (websiteMatch && locationMatchResult?.match && locationMatchResult.confidence === 'high') {
        matchConfidence = 'high'; // Both website and location verified
      } else if (websiteMatch || (locationMatchResult?.match && locationMatchResult.confidence === 'high')) {
        matchConfidence = 'medium'; // Either website OR location verified
      } else if (locationMatchResult?.match && locationMatchResult.confidence === 'medium') {
        matchConfidence = 'medium'; // Location matches with medium confidence
      } else {
        matchConfidence = 'low'; // No strong verification signals
      }
    }

    // Build match signals object
    const matchSignals = {
      foundViaSearch,
      websiteMatch,
      locationMatch: locationMatchResult ? {
        match: locationMatchResult.match,
        confidence: locationMatchResult.confidence,
        reason: locationMatchResult.reason
      } : null,
      companyName: companyData.name,
      linkedinHeadquarters: companyData.headquarters,
      expectedLocation: city && state ? `${city}, ${state}` : (state || city || null),
      verifiedAt: new Date().toISOString()
    };

    const result = {
      success: true,
      scraped: true,
      foundViaSearch,
      websiteVerified: websiteMatch,
      matchConfidence,
      linkedin_url: normalizedLinkedinUrl,
      linkedin_employee_count: employeeCount,
      linkedin_employee_range: employeeRange,
      linkedin_industry: companyData.industry || null,
      linkedin_headquarters: companyData.headquarters || null,
      linkedin_website: companyData.website || null,
      linkedin_description: companyData.description?.substring(0, 1000) || null,
    };

    console.log(`Apify scrape result: employeeCount=${employeeCount}, employeeRange=${employeeRange}, matchConfidence=${matchConfidence}`);

    // If dealId is provided, update the listing directly
    if (dealId) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const updateData: Record<string, unknown> = {
        linkedin_url: normalizedLinkedinUrl,
        linkedin_match_confidence: matchConfidence,
        linkedin_match_signals: matchSignals,
        linkedin_verified_at: new Date().toISOString(),
      };

      if (result.linkedin_employee_count) {
        updateData.linkedin_employee_count = result.linkedin_employee_count;
      }
      if (result.linkedin_employee_range) {
        updateData.linkedin_employee_range = result.linkedin_employee_range;
      }
      if (result.linkedin_industry) {
        updateData.linkedin_industry = result.linkedin_industry;
      }
      if (result.linkedin_headquarters) {
        updateData.linkedin_headquarters = result.linkedin_headquarters;
      }
      if (result.linkedin_website) {
        updateData.linkedin_website = result.linkedin_website;
      }

      const { error: updateError } = await supabase
        .from('listings')
        .update(updateData)
        .eq('id', dealId);

      if (updateError) {
        console.error('Error updating listing with LinkedIn data:', updateError);
      } else {
        console.log(`Updated deal ${dealId} with LinkedIn data (employee count: ${result.linkedin_employee_count}, range: ${result.linkedin_employee_range}, confidence: ${matchConfidence})`);
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
    let rawEmployeeCount: number | undefined = undefined;
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
 * Search for LinkedIn company pages using Firecrawl.
 * Returns multiple candidate URLs (deduplicated, up to maxResults) for ranking.
 */
async function searchForLinkedInCandidates(
  apiKey: string,
  searchQuery: string,
  companyName: string,
  maxResults = 5
): Promise<string[]> {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const addCandidate = (url: string) => {
    const normalized = normalizeLinkedInUrl(url);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      candidates.push(normalized);
    }
  };

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 10,
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (response.ok) {
      const data = await response.json();
      const results = data.data || data || [];
      for (const result of results) {
        if (result.url && isLinkedInCompanyUrl(result.url)) {
          addCandidate(result.url);
        }
      }
    } else {
      console.error('Firecrawl search API error:', response.status);
    }

    // Broader search fallback if we didn't find enough
    if (candidates.length < 2) {
      console.log('Few results from first search, trying broader search...');
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
            addCandidate(result.url);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error searching with Firecrawl:', error);
  }

  return candidates.slice(0, maxResults);
}

/**
 * Score a LinkedIn candidate by how well it matches the expected company.
 * Higher score = better match. Returns 0-100.
 */
function scoreLinkedInCandidate(
  companyData: ApifyLinkedInResult,
  companyName: string,
  companyWebsite?: string,
  city?: string,
  state?: string,
): { score: number; signals: Record<string, unknown> } {
  let score = 0;
  const signals: Record<string, unknown> = {};

  // Website match: +50 points (strongest signal)
  if (companyWebsite && companyData.website) {
    if (doWebsitesMatch(companyWebsite, companyData.website)) {
      score += 50;
      signals.websiteMatch = true;
    } else {
      // Mismatched website is a strong negative signal
      score -= 30;
      signals.websiteMatch = false;
      signals.websiteMismatch = `${companyData.website} vs ${companyWebsite}`;
    }
  }

  // Location match: +25 points
  if ((city || state) && companyData.headquarters) {
    const locationResult = verifyLocation(companyData.headquarters, city, state);
    if (locationResult.match) {
      score += locationResult.confidence === 'high' ? 25 : (locationResult.confidence === 'medium' ? 15 : 5);
      signals.locationMatch = locationResult;
    } else {
      score -= (locationResult.confidence === 'high' ? 15 : 5);
      signals.locationMatch = locationResult;
    }
  }

  // Name similarity: +15 points
  if (companyData.name && companyName) {
    const nameSimilarity = computeNameSimilarity(companyName, companyData.name);
    score += Math.round(nameSimilarity * 15);
    signals.nameSimilarity = nameSimilarity;
    signals.linkedinName = companyData.name;
  }

  // Has website listed: +5 bonus (more trustworthy profile)
  if (companyData.website) {
    score += 5;
    signals.hasWebsite = true;
  }

  // Has employee data: +5 bonus
  if (companyData.employeeCount || companyData.companySize) {
    score += 5;
    signals.hasEmployeeData = true;
  }

  return { score: Math.max(0, Math.min(100, score)), signals };
}

/**
 * Simple name similarity: returns 0-1 based on overlap of significant words.
 */
function computeNameSimilarity(name1: string, name2: string): number {
  const STOP_WORDS = new Set(['the', 'and', 'of', 'for', 'a', 'an', 'inc', 'llc', 'ltd', 'corp', 'co', 'company', 'group', 'services', 'solutions']);

  const tokenize = (s: string) => {
    return s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 1 && !STOP_WORDS.has(w));
  };

  const tokens1 = tokenize(name1);
  const tokens2 = tokenize(name2);

  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const set2 = new Set(tokens2);
  const matches = tokens1.filter(t => set2.has(t)).length;

  // Jaccard-like: matches / union
  const union = new Set([...tokens1, ...tokens2]).size;
  return union > 0 ? matches / union : 0;
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

/**
 * Check if two website URLs refer to the same domain
 * Handles variations like www., trailing slashes, http vs https
 */
function doWebsitesMatch(website1: string, website2: string): boolean {
  const extractDomain = (url: string): string => {
    try {
      let normalized = url.toLowerCase().trim();
      // Add protocol if missing
      if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        normalized = 'https://' + normalized;
      }
      const parsed = new URL(normalized);
      // Remove www. prefix and get just the hostname
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      // Fallback: just clean up the string
      return url.toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/.*$/, '')
        .trim();
    }
  };

  const domain1 = extractDomain(website1);
  const domain2 = extractDomain(website2);
  
  console.log(`Comparing domains: "${domain1}" vs "${domain2}"`);
  
  // Exact match
  if (domain1 === domain2) {
    return true;
  }
  
  // Check if one is a subdomain of the other (e.g., "jobs.company.com" vs "company.com")
  // Allow the LinkedIn website to be a parent domain of the company website
  if (domain1.endsWith('.' + domain2) || domain2.endsWith('.' + domain1)) {
    return true;
  }
  
  return false;
}

/**
 * Verify if LinkedIn headquarters location matches expected deal location
 * Returns match status and confidence level
 */
function verifyLocation(
  linkedinHeadquarters: string,
  expectedCity?: string,
  expectedState?: string
): { match: boolean; confidence: 'high' | 'medium' | 'low'; reason: string } {
  if (!expectedCity && !expectedState) {
    return { match: true, confidence: 'low', reason: 'No expected location provided' };
  }

  const hqLower = linkedinHeadquarters.toLowerCase().trim();
  const cityLower = expectedCity?.toLowerCase().trim() || '';
  const stateLower = expectedState?.toLowerCase().trim() || '';

  // Build state name map for matching (e.g., "TX" <-> "Texas")
  const stateMap: Record<string, string> = {
    'al': 'alabama', 'ak': 'alaska', 'az': 'arizona', 'ar': 'arkansas',
    'ca': 'california', 'co': 'colorado', 'ct': 'connecticut', 'de': 'delaware',
    'fl': 'florida', 'ga': 'georgia', 'hi': 'hawaii', 'id': 'idaho',
    'il': 'illinois', 'in': 'indiana', 'ia': 'iowa', 'ks': 'kansas',
    'ky': 'kentucky', 'la': 'louisiana', 'me': 'maine', 'md': 'maryland',
    'ma': 'massachusetts', 'mi': 'michigan', 'mn': 'minnesota', 'ms': 'mississippi',
    'mo': 'missouri', 'mt': 'montana', 'ne': 'nebraska', 'nv': 'nevada',
    'nh': 'new hampshire', 'nj': 'new jersey', 'nm': 'new mexico', 'ny': 'new york',
    'nc': 'north carolina', 'nd': 'north dakota', 'oh': 'ohio', 'ok': 'oklahoma',
    'or': 'oregon', 'pa': 'pennsylvania', 'ri': 'rhode island', 'sc': 'south carolina',
    'sd': 'south dakota', 'tn': 'tennessee', 'tx': 'texas', 'ut': 'utah',
    'vt': 'vermont', 'va': 'virginia', 'wa': 'washington', 'wv': 'west virginia',
    'wi': 'wisconsin', 'wy': 'wyoming', 'dc': 'district of columbia'
  };

  const stateFullName = stateMap[stateLower] || stateLower;

  // HIGH CONFIDENCE MATCH: City and state both present in headquarters
  if (cityLower && stateLower) {
    const hasBothCityAndState = hqLower.includes(cityLower) && (hqLower.includes(stateLower) || hqLower.includes(stateFullName));
    if (hasBothCityAndState) {
      return { match: true, confidence: 'high', reason: `HQ "${linkedinHeadquarters}" matches ${cityLower}, ${stateLower}` };
    }
  }

  // MEDIUM CONFIDENCE MATCH: State matches (company might have multiple offices)
  if (stateLower && (hqLower.includes(stateLower) || hqLower.includes(stateFullName))) {
    if (cityLower && !hqLower.includes(cityLower)) {
      // State matches but city doesn't - might be multi-location company
      return { match: true, confidence: 'medium', reason: `State matches but city differs - may have multiple offices in ${stateLower}` };
    }
    return { match: true, confidence: 'high', reason: `HQ in ${stateLower}` };
  }

  // LOW CONFIDENCE MATCH: City matches but state unknown/missing
  if (cityLower && hqLower.includes(cityLower)) {
    return { match: true, confidence: 'low', reason: `City "${cityLower}" mentioned but state unclear` };
  }

  // Check for nationwide/multi-location indicators
  const multiLocationIndicators = ['nationwide', 'multiple locations', 'various locations', 'across the us', 'national'];
  const isMultiLocation = multiLocationIndicators.some(indicator => hqLower.includes(indicator));
  if (isMultiLocation) {
    return { match: true, confidence: 'low', reason: 'Company operates nationwide/multiple locations' };
  }

  // HIGH CONFIDENCE MISMATCH: HQ clearly in different state
  const hqHasDifferentState = Object.entries(stateMap).some(([code, name]) => {
    // Skip if it's the expected state
    if (code === stateLower || name === stateFullName) return false;
    // Check if HQ mentions a different state
    return hqLower.includes(`, ${code}`) || hqLower.includes(`, ${name}`) || hqLower.includes(` ${name}`);
  });

  if (hqHasDifferentState && stateLower) {
    return { match: false, confidence: 'high', reason: `Headquarters "${linkedinHeadquarters}" is in a different state than expected (${expectedState})` };
  }

  // MEDIUM CONFIDENCE MISMATCH: Expected location not mentioned at all
  return { match: false, confidence: 'medium', reason: `Expected location "${expectedCity}, ${expectedState}" not found in HQ "${linkedinHeadquarters}"` };
}
