import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Contact {
  name: string;
  title: string;
  email?: string;
  linkedin_url?: string;
  bio_url?: string;
  is_deal_team: boolean;
  role_category: 'deal_team' | 'business_dev' | 'junior_investment' | 'corp_dev' | 'executive' | 'other';
}

interface ExtractionResult {
  contacts: Contact[];
  deal_team_found: boolean;
  source_url: string;
  email_pattern?: string;
}

// Keywords for scoring team page URLs
const POSITIVE_KEYWORDS = ['team', 'leadership', 'executive', 'management', 'people', 'board', 'officers', 'directors', 'staff', 'who-we-are', 'about-us'];
const NEGATIVE_KEYWORDS = ['careers', 'jobs', 'job', 'hiring', 'news', 'blog', 'press', 'contact', 'locations', 'services', 'products', 'case-study', 'testimonial', 'faq', 'privacy', 'terms', 'login', 'signin', 'cart', 'checkout'];

// Keywords that indicate an individual profile page
const PROFILE_PARENT_KEYWORDS = ['team', 'team-members', 'people', 'staff', 'leadership', 'executives', 'management', 'board', 'directors', 'members', 'professionals', 'advisors'];

function scoreUrl(url: string): number {
  const path = url.toLowerCase();
  let score = 0;
  const penalties: string[] = [];
  const bonuses: string[] = [];
  
  // Check for positive keywords
  for (const kw of POSITIVE_KEYWORDS) {
    if (path.includes(kw)) {
      score += 10;
      bonuses.push(`+10 for keyword "${kw}"`);
    }
  }
  
  // Check for negative keywords
  for (const kw of NEGATIVE_KEYWORDS) {
    if (path.includes(kw)) {
      score -= 20;
      penalties.push(`-20 for keyword "${kw}"`);
    }
  }
  
  try {
    const urlPath = new URL(url).pathname;
    const pathParts = urlPath.split('/').filter(Boolean);
    
    // CRITICAL: Very heavy penalty for individual profile pages
    // These match patterns like /team-members/john-doe, /people/jane-smith
    if (pathParts.length >= 2) {
      const lastSegment = pathParts[pathParts.length - 1];
      const parentSegment = pathParts[pathParts.length - 2];
      
      // If parent is a team-related keyword and last segment looks like a name
      if (PROFILE_PARENT_KEYWORDS.some(kw => parentSegment.includes(kw))) {
        // Check if the last segment looks like a person's name (contains hyphen, or is a slug)
        if (lastSegment.includes('-') || lastSegment.match(/^[a-z]+$/)) {
          score -= 50; // Heavy penalty for individual profiles
          penalties.push(`-50 INDIVIDUAL PROFILE (parent="${parentSegment}", slug="${lastSegment}")`);
        }
      }
      
      // Also catch direct patterns like /team-members/name
      if (parentSegment.match(/team[-_]?members?/i) || 
          parentSegment.match(/our[-_]?team/i) ||
          parentSegment.match(/people/i) ||
          parentSegment.match(/staff/i)) {
        score -= 50;
        penalties.push(`-50 INDIVIDUAL PROFILE (pattern match)`);
      }
    }
    
    // Bonus for root team pages (single path segment like /team, /leadership)
    if (pathParts.length === 1) {
      const segment = pathParts[0];
      if (['team', 'leadership', 'people', 'executives', 'management', 'about', 'staff', 'board'].includes(segment)) {
        score += 25;
        bonuses.push(`+25 ROOT TEAM PAGE (/${segment})`);
      }
    }
    
    // Bonus for 2-segment paths that are likely overview pages
    if (pathParts.length === 2) {
      const [first, second] = pathParts;
      // Patterns like /about/team, /about/leadership, /company/team
      if (['about', 'company', 'our-company', 'who-we-are'].includes(first) && 
          ['team', 'leadership', 'people', 'management', 'executives'].includes(second)) {
        score += 20;
        bonuses.push(`+20 OVERVIEW PATH (/${first}/${second})`);
      }
    }
    
    // Bonus for shorter paths (more likely to be main team pages)
    if (pathParts.length === 1) {
      score += 10;
      bonuses.push(`+10 for single segment path`);
    } else if (pathParts.length === 2) {
      score += 5;
      bonuses.push(`+5 for two segment path`);
    }
    
  } catch (e) {
    // If URL parsing fails, just continue with basic scoring
  }
  
  // Log scoring details for debugging
  if (penalties.length > 0 || bonuses.length > 0) {
    console.log(`Score ${score} for ${url}`);
    if (bonuses.length > 0) console.log(`  Bonuses: ${bonuses.join(', ')}`);
    if (penalties.length > 0) console.log(`  Penalties: ${penalties.join(', ')}`);
  }
  
  return score;
}

async function scrapeUrl(url: string, apiKey: string): Promise<string | null> {
  try {
    console.log(`Scraping: ${url}`);
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
      }),
    });

    if (!response.ok) {
      console.log(`Failed to scrape ${url}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.data?.markdown || data.markdown || null;
    if (content) {
      console.log(`Scraped ${url}: ${content.length} chars`);
    }
    return content;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return null;
  }
}

async function discoverTeamPages(baseUrl: string, apiKey: string): Promise<Array<{ url: string; score: number }>> {
  // Normalize base URL
  let normalizedBase = baseUrl.trim();
  if (!normalizedBase.startsWith('http://') && !normalizedBase.startsWith('https://')) {
    normalizedBase = `https://${normalizedBase}`;
  }
  normalizedBase = normalizedBase.replace(/\/$/, '');

  try {
    console.log(`Mapping site: ${normalizedBase}`);
    
    // Use Firecrawl Map to discover all URLs with team-related search
    const response = await fetch('https://api.firecrawl.dev/v1/map', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: normalizedBase,
        search: 'team leadership executive management board directors people staff officers cfo ceo',
        limit: 100, // Increased limit to find more pages
        includeSubdomains: false,
      }),
    });

    if (!response.ok) {
      console.log(`Map API failed for ${normalizedBase}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const links = data.links || [];
    
    console.log(`Map found ${links.length} URLs for ${normalizedBase}`);
    
    if (links.length === 0) {
      return [];
    }

    // Score and sort URLs by relevance
    const scoredUrls = links
      .map((url: string) => ({ url, score: scoreUrl(url) }))
      .filter((item: { url: string; score: number }) => item.score > -20) // Filter out clearly irrelevant pages
      .sort((a: { url: string; score: number }, b: { url: string; score: number }) => {
        // Sort by score first, then by path length (shorter = better for team overview pages)
        if (b.score !== a.score) return b.score - a.score;
        const aPathLen = new URL(a.url).pathname.split('/').filter(Boolean).length;
        const bPathLen = new URL(b.url).pathname.split('/').filter(Boolean).length;
        return aPathLen - bPathLen;
      });

    console.log(`=== TOP 10 SCORED URLs ===`);
    scoredUrls.slice(0, 10).forEach((u: { url: string; score: number }, i: number) => {
      console.log(`${i + 1}. Score ${u.score}: ${u.url}`);
    });

    // Return top 5 URLs for scraping
    return scoredUrls.slice(0, 5);
  } catch (error) {
    console.error(`Error mapping ${normalizedBase}:`, error);
    return [];
  }
}

async function scrapeMultiplePages(urls: Array<{ url: string; score: number }>, apiKey: string): Promise<Array<{ url: string; content: string; score: number }>> {
  const results: Array<{ url: string; content: string; score: number }> = [];
  
  // Scrape top 3 pages in parallel
  const pagesToScrape = urls.slice(0, 3);
  console.log(`=== SCRAPING ${pagesToScrape.length} PAGES ===`);
  pagesToScrape.forEach((u, i) => console.log(`${i + 1}. ${u.url} (score: ${u.score})`));
  
  const scrapePromises = pagesToScrape.map(async ({ url, score }) => {
    const content = await scrapeUrl(url, apiKey);
    if (content && content.length > 300) {
      return { url, content, score };
    }
    return null;
  });
  
  const scrapeResults = await Promise.all(scrapePromises);
  
  for (const result of scrapeResults) {
    if (result) {
      results.push(result);
    }
  }
  
  console.log(`Successfully scraped ${results.length} pages with content`);
  return results;
}

async function findTeamPages(baseUrl: string, apiKey: string): Promise<Array<{ url: string; content: string }>> {
  // First try the smart discovery approach
  const discoveredUrls = await discoverTeamPages(baseUrl, apiKey);
  
  if (discoveredUrls.length > 0) {
    const results = await scrapeMultiplePages(discoveredUrls, apiKey);
    if (results.length > 0) {
      return results.map(r => ({ url: r.url, content: r.content }));
    }
  }
  
  // Fallback: try common paths if map didn't find good results
  console.log(`Map returned no usable results for ${baseUrl}, trying fallback paths`);
  
  let normalizedBase = baseUrl.trim();
  if (!normalizedBase.startsWith('http://') && !normalizedBase.startsWith('https://')) {
    normalizedBase = `https://${normalizedBase}`;
  }
  normalizedBase = normalizedBase.replace(/\/$/, '');
  
  const fallbackPaths = [
    '/team', '/leadership', '/about', '/about-us', '/our-team',
    '/executive-team', '/our-executive-team', '/leadership-team',
    '/management', '/executives', '/people', '/who-we-are',
    '/about/team', '/about/leadership', '/company/team'
  ];
  
  const fallbackUrls = fallbackPaths.map(path => ({ url: `${normalizedBase}${path}`, score: 0 }));
  const results = await scrapeMultiplePages(fallbackUrls, apiKey);
  
  return results.map(r => ({ url: r.url, content: r.content }));
}

async function extractContactsWithAI(
  content: string,
  companyName: string,
  platformCompanyName: string | null,
  isPEFirm: boolean,
  sourceUrl: string
): Promise<ExtractionResult> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableApiKey) {
    console.error('LOVABLE_API_KEY not configured');
    return { contacts: [], deal_team_found: false, source_url: sourceUrl };
  }

  const roleContext = isPEFirm
    ? `Focus on finding ALL team members on this page, including:
1. Managing Partners, Partners, Managing Directors, Directors (executive level)
2. Deal team members specifically assigned to ${platformCompanyName || 'portfolio companies'}
3. Business Development team members
4. Principals, Vice Presidents (VP), Associates, Senior Associates, Analysts (TARGET ROLES - most responsive)
5. Operating Partners, Advisors, Senior Advisors

IMPORTANT: Extract EVERY person listed on the team page, not just a few. Look for the complete roster.`
    : `Focus on finding ALL executives and relevant contacts on this page, including:
1. CFO, CEO, COO, CMO, and other C-suite executives
2. Anyone with Corporate Development, M&A, or Strategy in their title (TARGET ROLES)
3. VP/Director/Head of Business Development (TARGET ROLES)
4. General Managers, Regional Directors
5. Any other executives or leadership team members

IMPORTANT: Extract EVERY person listed on the page.`;

  const prompt = `Extract ALL contact information from this ${isPEFirm ? 'PE firm' : 'company'} website content for ${companyName}.

${roleContext}

For each contact found, extract:
- Full name (required)
- Title/Role (required)
- Email address (ONLY if explicitly shown on the page)
- LinkedIn URL (ONLY if explicitly shown on the page, must be a full linkedin.com URL)
- Bio/profile URL on the company site (if available)
- Whether they appear to be specifically assigned to work with ${platformCompanyName || 'relevant deals'} (is_deal_team flag)

Also try to identify the company's email pattern if you see any emails (e.g., "firstname.lastname@company.com" or "first@company.com").

ROLE CATEGORIZATION RULES (CRITICAL - follow exactly):
- "junior_investment": VP, Vice President, Principal, Associate, Senior Associate, Analyst, Investment Professional (these are TARGET roles, most likely to respond)
- "business_dev": Business Development, BD, Partnerships, Strategic Partnerships titles
- "corp_dev": Corporate Development, M&A, Strategy, Acquisitions titles
- "deal_team": Anyone explicitly assigned to a specific portfolio company or deal
- "executive": Managing Partner, Partner, Managing Director, Director, CEO, CFO, COO, C-suite (senior executives are less responsive)
- "other": Admin, Marketing, HR, Legal, or unclear roles

Return a JSON object with this structure:
{
  "contacts": [
    {
      "name": "Full Name",
      "title": "Job Title",
      "email": "email@company.com" or null,
      "linkedin_url": "https://linkedin.com/in/..." or null,
      "bio_url": "https://company.com/team/name" or null,
      "is_deal_team": true/false,
      "role_category": "junior_investment" | "business_dev" | "corp_dev" | "deal_team" | "executive" | "other"
    }
  ],
  "deal_team_found": true/false,
  "email_pattern": "{first}.{last}@company.com" or null
}

IMPORTANT: 
- Extract ALL people listed, not just a sample
- Only include contacts that are clearly real people with both name and title
- Do NOT make up any information - only extract what is explicitly shown
- If you see 10 people on the page, return 10 contacts
- Use the role_category rules EXACTLY as specified above

Website content:
${content.slice(0, 20000)}`;

  try {
    console.log(`Calling AI to extract contacts from ${sourceUrl}...`);
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI extraction failed (${response.status}):`, errorText);
      return { contacts: [], deal_team_found: false, source_url: sourceUrl };
    }

    const data = await response.json();
    const content2 = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content2.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`AI extracted ${parsed.contacts?.length || 0} contacts from ${sourceUrl}`);
      if (parsed.email_pattern) {
        console.log(`Email pattern detected: ${parsed.email_pattern}`);
      }
      return {
        contacts: parsed.contacts || [],
        deal_team_found: parsed.deal_team_found || false,
        source_url: sourceUrl,
        email_pattern: parsed.email_pattern || undefined,
      };
    }
  } catch (error) {
    console.error('Error in AI extraction:', error);
  }

  return { contacts: [], deal_team_found: false, source_url: sourceUrl };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { buyerId, platformCompanyName, dealId, useFallbackPaths, peFirmId, peFirmWebsite, peFirmName, platformId, platformWebsite, platformName } = await req.json();

    // Determine which mode we're in: legacy buyer mode, pe_firm mode, or platform mode
    const isPeFirmMode = !!peFirmId && !!peFirmWebsite;
    const isPlatformMode = !!platformId && !!platformWebsite;
    const isLegacyMode = !!buyerId;

    if (!isPeFirmMode && !isPlatformMode && !isLegacyMode) {
      return new Response(
        JSON.stringify({ success: false, error: 'buyerId, peFirmId, or platformId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle PE Firm mode - store in pe_firm_contacts
    if (isPeFirmMode) {
      console.log(`\n=== PE FIRM MODE: ${peFirmName} ===`);
      const allContacts: Array<Contact & { source_url: string }> = [];
      const scrapedPages: string[] = [];
      
      const pePages = await findTeamPages(peFirmWebsite, firecrawlKey);
      for (const page of pePages) {
        scrapedPages.push(page.url);
        const extraction = await extractContactsWithAI(page.content, peFirmName, null, true, page.url);
        for (const contact of extraction.contacts) {
          const exists = allContacts.some(c => c.name.toLowerCase() === contact.name.toLowerCase());
          if (!exists) allContacts.push({ ...contact, source_url: page.url });
        }
      }

      // Insert into pe_firm_contacts
      let insertedCount = 0;
      // Find email pattern from any discovered emails
      let emailPattern: string | undefined;
      for (const c of allContacts) {
        if (c.email) {
          const match = c.email.match(/^([a-z]+)\.([a-z]+)@(.+)$/i);
          if (match) {
            emailPattern = `{first}.{last}@${match[3]}`;
            break;
          }
          const match2 = c.email.match(/^([a-z]+)@(.+)$/i);
          if (match2) {
            emailPattern = `{first}@${match2[2]}`;
            break;
          }
        }
      }
      
      for (const contact of allContacts) {
        const { data: existing } = await supabase.from('pe_firm_contacts').select('id').eq('pe_firm_id', peFirmId).eq('name', contact.name).single();
        if (existing) continue;
        
        // Infer email if we have a pattern
        let email = contact.email || null;
        let emailConfidence = contact.email ? 'verified' : null;
        if (!email && emailPattern && contact.name) {
          const nameParts = contact.name.trim().split(/\s+/);
          if (nameParts.length >= 2) {
            const first = nameParts[0].toLowerCase();
            const last = nameParts[nameParts.length - 1].toLowerCase();
            email = emailPattern.replace('{first}', first).replace('{last}', last);
            emailConfidence = 'inferred';
          }
        }
        
        // Priority: 1=deal_team, 2=junior_investment/business_dev/corp_dev (target), 3=other, 4=executive
        const priority = contact.is_deal_team ? 1 : 
          ['junior_investment', 'business_dev', 'corp_dev'].includes(contact.role_category) ? 2 : 
          contact.role_category === 'executive' ? 4 : 3;
        
        const { error } = await supabase.from('pe_firm_contacts').insert({
          pe_firm_id: peFirmId, name: contact.name, title: contact.title, email: email,
          email_confidence: emailConfidence,
          linkedin_url: contact.linkedin_url || null, role_category: contact.role_category || 'other',
          priority_level: priority, source: 'website', source_url: contact.source_url
        });
        if (!error) insertedCount++;
      }

      return new Response(JSON.stringify({ success: true, contacts_found: allContacts.length, contacts_inserted: insertedCount, pages_scraped: scrapedPages, email_pattern: emailPattern }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Handle Platform mode - store in platform_contacts
    if (isPlatformMode) {
      console.log(`\n=== PLATFORM MODE: ${platformName} ===`);
      const allContacts: Array<Contact & { source_url: string }> = [];
      const scrapedPages: string[] = [];
      
      const platformPages = await findTeamPages(platformWebsite, firecrawlKey);
      for (const page of platformPages) {
        scrapedPages.push(page.url);
        const extraction = await extractContactsWithAI(page.content, platformName, null, false, page.url);
        for (const contact of extraction.contacts) {
          const exists = allContacts.some(c => c.name.toLowerCase() === contact.name.toLowerCase());
          if (!exists) allContacts.push({ ...contact, source_url: page.url });
        }
      }

      // Find email pattern from any discovered emails
      let emailPattern: string | undefined;
      for (const c of allContacts) {
        if (c.email) {
          const match = c.email.match(/^([a-z]+)\.([a-z]+)@(.+)$/i);
          if (match) {
            emailPattern = `{first}.{last}@${match[3]}`;
            break;
          }
          const match2 = c.email.match(/^([a-z]+)@(.+)$/i);
          if (match2) {
            emailPattern = `{first}@${match2[2]}`;
            break;
          }
        }
      }
      
      // Insert into platform_contacts
      let insertedCount = 0;
      for (const contact of allContacts) {
        const { data: existing } = await supabase.from('platform_contacts').select('id').eq('platform_id', platformId).eq('name', contact.name).single();
        if (existing) continue;
        
        // Infer email if we have a pattern
        let email = contact.email || null;
        let emailConfidence = contact.email ? 'verified' : null;
        if (!email && emailPattern && contact.name) {
          const nameParts = contact.name.trim().split(/\s+/);
          if (nameParts.length >= 2) {
            const first = nameParts[0].toLowerCase();
            const last = nameParts[nameParts.length - 1].toLowerCase();
            email = emailPattern.replace('{first}', first).replace('{last}', last);
            emailConfidence = 'inferred';
          }
        }
        
        // Priority: 1=deal_team, 2=junior_investment/business_dev/corp_dev (target), 3=other, 4=executive
        const priority = contact.is_deal_team ? 1 : 
          ['junior_investment', 'business_dev', 'corp_dev'].includes(contact.role_category) ? 2 : 
          contact.role_category === 'executive' ? 4 : 3;
        
        const { error } = await supabase.from('platform_contacts').insert({
          platform_id: platformId, name: contact.name, title: contact.title, email: email,
          email_confidence: emailConfidence,
          linkedin_url: contact.linkedin_url || null, role_category: contact.role_category || 'other',
          priority_level: priority, source: 'website', source_url: contact.source_url
        });
        if (!error) insertedCount++;
      }

      return new Response(JSON.stringify({ success: true, contacts_found: allContacts.length, contacts_inserted: insertedCount, pages_scraped: scrapedPages, email_pattern: emailPattern }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Legacy buyer mode - keep existing behavior for backwards compatibility
    // Verify user has access to this buyer via RLS
    const { data: userBuyer, error: accessError } = await supabase
      .from('buyers')
      .select('id, tracker_id')
      .eq('id', buyerId)
      .single();

    if (accessError || !userBuyer) {
      console.error('Access denied for buyer:', buyerId, accessError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Buyer not found or access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch buyer data (already verified ownership)
    const { data: buyer, error: buyerError } = await supabase
      .from('buyers')
      .select('*')
      .eq('id', buyerId)
      .single();

    if (buyerError || !buyer) {
      return new Response(
        JSON.stringify({ success: false, error: 'Buyer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`\n========================================`);
    console.log(`FINDING CONTACTS FOR: ${buyer.pe_firm_name} / ${buyer.platform_company_name}`);
    console.log(`PE website: ${buyer.pe_firm_website}`);
    console.log(`Platform website: ${buyer.platform_website}`);
    if (useFallbackPaths) {
      console.log(`Using fallback paths mode`);
    }
    console.log(`========================================\n`);

    const allContacts: Array<Contact & { company_type: string; source_url: string }> = [];
    let dealTeamFound = false;
    const scrapedPages: string[] = [];
    let emailPattern: string | undefined;

    // PE Firm contact discovery - scrape multiple pages
    if (buyer.pe_firm_website) {
      console.log(`\n=== PE FIRM: ${buyer.pe_firm_name} ===`);
      const pePages = await findTeamPages(buyer.pe_firm_website, firecrawlKey);
      
      for (const page of pePages) {
        scrapedPages.push(page.url);
        console.log(`Extracting PE contacts from: ${page.url}`);
        const extraction = await extractContactsWithAI(
          page.content,
          buyer.pe_firm_name,
          buyer.platform_company_name || platformCompanyName,
          true,
          page.url
        );

        if (extraction.deal_team_found) {
          dealTeamFound = true;
        }
        if (extraction.email_pattern && !emailPattern) {
          emailPattern = extraction.email_pattern;
        }
        
        for (const contact of extraction.contacts) {
          // Check for duplicate by name (case-insensitive)
          const exists = allContacts.some(c => c.name.toLowerCase() === contact.name.toLowerCase());
          if (!exists) {
            allContacts.push({
              ...contact,
              company_type: 'PE Firm',
              source_url: page.url,
            });
          }
        }
      }
      console.log(`PE Firm: Found ${allContacts.length} unique contacts from ${pePages.length} pages`);
    }

    // Platform company contact discovery - scrape multiple pages
    if (buyer.platform_website) {
      console.log(`\n=== PLATFORM: ${buyer.platform_company_name} ===`);
      const platformPages = await findTeamPages(buyer.platform_website, firecrawlKey);
      
      const platformContactsCount = allContacts.length;
      for (const page of platformPages) {
        scrapedPages.push(page.url);
        console.log(`Extracting platform contacts from: ${page.url}`);
        const extraction = await extractContactsWithAI(
          page.content,
          buyer.platform_company_name || buyer.pe_firm_name,
          null,
          false,
          page.url
        );

        for (const contact of extraction.contacts) {
          // Check for duplicate by name (case-insensitive)
          const exists = allContacts.some(c => c.name.toLowerCase() === contact.name.toLowerCase());
          if (!exists) {
            allContacts.push({
              ...contact,
              company_type: 'Platform',
              source_url: page.url,
            });
          }
        }
      }
      console.log(`Platform: Found ${allContacts.length - platformContactsCount} unique contacts from ${platformPages.length} pages`);
    }

    console.log(`\n========================================`);
    console.log(`TOTAL: ${allContacts.length} contacts found`);
    console.log(`Deal team: ${dealTeamFound}`);
    console.log(`Pages scraped: ${scrapedPages.length}`);
    scrapedPages.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
    console.log(`========================================\n`);

    // Insert contacts into database
    const insertedContacts = [];
    for (const contact of allContacts) {
      // Check if contact already exists (by name and buyer_id)
      const { data: existing } = await supabase
        .from('buyer_contacts')
        .select('id')
        .eq('buyer_id', buyerId)
        .eq('name', contact.name)
        .single();

      if (existing) {
        console.log(`Contact ${contact.name} already exists, skipping`);
        continue;
      }

      // Infer email if we have a pattern
      let email = contact.email || null;
      let emailConfidence = contact.email ? 'verified' : null;
      if (!email && emailPattern && contact.name) {
        const nameParts = contact.name.trim().split(/\s+/);
        if (nameParts.length >= 2) {
          const first = nameParts[0].toLowerCase();
          const last = nameParts[nameParts.length - 1].toLowerCase();
          email = emailPattern.replace('{first}', first).replace('{last}', last);
          emailConfidence = 'inferred';
        }
      }
      
      // Priority: 1=deal_team, 2=junior_investment/business_dev/corp_dev (target), 3=other, 4=executive
      const priority = contact.is_deal_team ? 1 : 
        ['junior_investment', 'business_dev', 'corp_dev'].includes(contact.role_category) ? 2 :
        contact.role_category === 'executive' ? 4 : 3;
      
      const { data: inserted, error: insertError } = await supabase
        .from('buyer_contacts')
        .insert({
          buyer_id: buyerId,
          name: contact.name,
          title: contact.title,
          email: email,
          email_confidence: emailConfidence,
          linkedin_url: contact.linkedin_url || null,
          company_type: contact.company_type,
          is_deal_team: contact.is_deal_team || false,
          role_category: contact.role_category || 'other',
          source: 'website',
          source_url: contact.source_url,
          priority_level: priority,
        })
        .select()
        .single();

      if (insertError) {
        console.error(`Failed to insert contact ${contact.name}:`, insertError.message);
      } else {
        insertedContacts.push(inserted);
        console.log(`Inserted contact: ${contact.name} (${contact.title}) - email: ${email || 'none'} (${emailConfidence || 'n/a'})`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        contacts_found: allContacts.length,
        contacts_inserted: insertedContacts.length,
        deal_team_found: dealTeamFound,
        pages_scraped: scrapedPages,
        email_pattern: emailPattern,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in find-buyer-contacts:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
