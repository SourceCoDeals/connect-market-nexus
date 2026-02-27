/**
 * Find Buyer Contacts Edge Function
 *
 * Two-tier contact discovery:
 *   Tier 1 (fast): Serper multi-query Google search → Gemini LLM extraction
 *     - 5 parallel searches per domain targeting CEO, Founder, President, Partner, contact email
 *     - LLM extracts names, titles, LinkedIn URLs, emails, phones from search snippets
 *     - Completes in ~3-5s per company
 *
 *   Tier 2 (deep fallback): Firecrawl website scraping → Gemini AI extraction
 *     - Maps team/leadership pages on company websites
 *     - Scrapes and extracts contacts from page content
 *     - Used when Serper finds fewer than 2 contacts
 *
 * Results are merged, deduplicated, and saved to remarketing_buyer_contacts.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { searchDecisionMakers, formatSearchResultsForLLM } from '../_shared/serper-client.ts';
import { extractDecisionMakers } from '../_shared/decision-maker-extraction.ts';

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  try {
    const { buyerId, peFirmWebsite, platformWebsite } = await req.json();

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let websites: string[] = [];
    let buyer: any = null;

    // Get buyer info if buyerId provided
    if (buyerId) {
      const { data, error } = await supabase
        .from('remarketing_buyers')
        .select('id, company_name, pe_firm_website, company_website')
        .eq('id', buyerId)
        .single();

      if (error) throw error;
      buyer = data;

      if (buyer.pe_firm_website) websites.push(buyer.pe_firm_website);
      if (buyer.company_website) websites.push(buyer.company_website);
    }

    // Add provided websites
    if (peFirmWebsite) websites.push(peFirmWebsite);
    if (platformWebsite) websites.push(platformWebsite);

    // Dedupe
    websites = [...new Set(websites)].filter(Boolean);

    if (websites.length === 0) {
      return new Response(JSON.stringify({ error: 'No websites provided for contact discovery' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const allContacts: any[] = [];
    const companyName = buyer?.company_name || '';

    // =========================================================================
    // TIER 1: Serper multi-query search + LLM extraction (fast, ~3-5s)
    // =========================================================================
    const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');
    if (SERPER_API_KEY) {
      for (const website of websites) {
        try {
          const domain = extractDomain(website);
          const name = companyName || domain.replace(/\.\w+$/, '');

          console.log(`[find-buyer-contacts] Tier 1 (Serper): searching for ${name} (${domain})`);

          const searchResults = await searchDecisionMakers(domain, name);
          const summary = formatSearchResultsForLLM(searchResults);

          if (summary.trim()) {
            const contacts = await extractDecisionMakers(summary, domain, name);
            console.log(
              `[find-buyer-contacts] Tier 1: found ${contacts.length} contacts for ${domain}`,
            );

            // Convert to the standard contact format
            for (const c of contacts) {
              const fullName = `${c.first_name} ${c.last_name}`.trim();
              if (fullName) {
                allContacts.push({
                  name: fullName,
                  title: c.title,
                  email: c.generic_email || null,
                  linkedin_url: c.linkedin_url || null,
                  role_category: categorizeRole(c.title),
                  source_url: c.source_url,
                  company_phone: c.company_phone,
                  source: 'serper_search',
                });
              }
              // Also track generic emails as separate entries
              if (c.generic_email && !fullName) {
                allContacts.push({
                  name: c.generic_email,
                  title: 'Generic Email',
                  email: c.generic_email,
                  linkedin_url: null,
                  role_category: 'other',
                  source_url: c.source_url,
                  company_phone: c.company_phone,
                  source: 'serper_search',
                });
              }
            }
          }
        } catch (err) {
          console.error(`[find-buyer-contacts] Tier 1 error for ${website}:`, err);
        }
      }
    }

    // =========================================================================
    // TIER 2: Firecrawl website scraping fallback (deep, slower)
    // Only runs if Tier 1 found fewer than 2 named contacts
    // =========================================================================
    const namedContacts = allContacts.filter((c) => c.name && c.title !== 'Generic Email');
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

    if (namedContacts.length < 2 && FIRECRAWL_API_KEY) {
      console.log(
        `[find-buyer-contacts] Tier 2 (Firecrawl): only ${namedContacts.length} contacts from Serper, falling back to website scraping`,
      );

      for (const website of websites) {
        try {
          console.log(`[find-buyer-contacts] Tier 2: scraping ${website}`);

          // Map team pages
          const mapResponse = await fetch('https://api.firecrawl.dev/v1/map', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: website,
              search: 'team leadership about people contact',
              limit: 10,
            }),
            signal: AbortSignal.timeout(15000),
          });

          let teamPages: string[] = [];
          if (mapResponse.ok) {
            const mapResult = await mapResponse.json();
            teamPages = mapResult.links || [];
          }

          const relevantPages = teamPages
            .filter((url) =>
              /team|leadership|about|people|staff|management|executives|partners/i.test(url),
            )
            .slice(0, 3);

          if (relevantPages.length === 0) {
            relevantPages.push(website);
          }

          // Scrape relevant pages
          for (const pageUrl of relevantPages) {
            try {
              const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  url: pageUrl,
                  formats: ['markdown'],
                  onlyMainContent: true,
                }),
                signal: AbortSignal.timeout(15000),
              });

              if (!scrapeResponse.ok) continue;

              const scrapeResult = await scrapeResponse.json();
              const pageContent = scrapeResult.data?.markdown || '';

              if (pageContent.length < 100) continue;

              const contacts = await extractContactsWithAI(pageContent, pageUrl, GEMINI_API_KEY);
              allContacts.push(...contacts);
            } catch (pageError) {
              console.error(`[find-buyer-contacts] Tier 2 error scraping ${pageUrl}:`, pageError);
            }
          }
        } catch (websiteError) {
          console.error(`[find-buyer-contacts] Tier 2 error processing ${website}:`, websiteError);
        }
      }
    }

    // =========================================================================
    // Deduplicate and enrich missing LinkedIn URLs
    // =========================================================================
    const uniqueContacts = dedupeContacts(allContacts);

    // Enrich contacts missing linkedin_url via Serper
    if (SERPER_API_KEY && uniqueContacts.length > 0) {
      const contactsNeedingLinkedIn = uniqueContacts.filter(
        (c) => !c.linkedin_url && c.name && c.title !== 'Generic Email',
      );

      if (contactsNeedingLinkedIn.length > 0) {
        console.log(
          `[find-buyer-contacts] Looking up LinkedIn for ${contactsNeedingLinkedIn.length} contacts`,
        );

        const lookupBatch = contactsNeedingLinkedIn.slice(0, 8);
        await Promise.allSettled(
          lookupBatch.map(async (contact) => {
            try {
              const linkedinUrl = await searchLinkedInProfile(contact.name, companyName);
              if (linkedinUrl) {
                contact.linkedin_url = linkedinUrl;
                console.log(
                  `[find-buyer-contacts] Found LinkedIn for ${contact.name}: ${linkedinUrl}`,
                );
              }
            } catch (err) {
              console.warn(
                `[find-buyer-contacts] LinkedIn lookup failed for ${contact.name}:`,
                err,
              );
            }
          }),
        );
      }
    }

    // Save contacts if buyerId provided
    if (buyerId && uniqueContacts.length > 0) {
      for (const contact of uniqueContacts) {
        await supabase.from('remarketing_buyer_contacts').upsert(
          {
            buyer_id: buyerId,
            name: contact.name,
            title: contact.title,
            email: contact.email,
            linkedin_url: contact.linkedin_url,
            role_category: contact.role_category,
            source: contact.source || 'ai_discovery',
            source_url: contact.source_url,
            company_phone: contact.company_phone || null,
            email_confidence: contact.email ? 'Guessed' : null,
          },
          {
            onConflict: 'buyer_id,name',
            ignoreDuplicates: true,
          },
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        contacts: uniqueContacts,
        totalFound: uniqueContacts.length,
        websitesProcessed: websites.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('[find-buyer-contacts] Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// =============================================================================
// Helper functions
// =============================================================================

/**
 * Extract domain from a URL (e.g., "https://www.example.com/about" → "example.com")
 */
function extractDomain(url: string): string {
  try {
    let normalized = url.trim();
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = 'https://' + normalized;
    }
    return new URL(normalized).hostname.replace(/^www\./, '');
  } catch {
    return url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '')
      .trim();
  }
}

/**
 * Categorize a job title into role categories for the DB.
 */
function categorizeRole(title: string): 'deal_team' | 'executive' | 'operations' | 'other' {
  const t = (title || '').toLowerCase();

  // Executive
  if (/\b(ceo|cfo|coo|cto|chief|president|chairman)\b/.test(t)) return 'executive';
  if (/\b(founder|co-founder|owner|co-owner)\b/.test(t)) return 'executive';

  // Deal team
  if (/\b(partner|managing director|principal|director)\b/.test(t)) return 'deal_team';
  if (/\b(vp|vice president|svp|evp)\b/.test(t)) return 'deal_team';
  if (/\b(m&a|acquisitions|corporate development|business development)\b/.test(t))
    return 'deal_team';

  // Operations
  if (/\b(general manager|operations|finance|controller|accounting)\b/.test(t)) return 'operations';

  return 'other';
}

/**
 * Extract contacts from page content using Gemini (Tier 2 fallback).
 */
async function extractContactsWithAI(
  content: string,
  sourceUrl: string,
  apiKey: string,
): Promise<any[]> {
  const systemPrompt = `You are an expert at extracting contact information from web pages. Extract all people mentioned with their roles.

Return JSON array only:
[{
  "name": "Full Name",
  "title": "Job Title",
  "email": "email@example.com or null",
  "linkedin_url": "linkedin profile url or null",
  "role_category": "deal_team" | "executive" | "operations" | "other"
}]

Role categories:
- deal_team: Partners, Directors, VPs, Principals involved in M&A
- executive: C-suite executives (CEO, CFO, COO)
- operations: Operations, HR, Finance staff
- other: Other roles

Only include people with clear names and titles. Return empty array if no contacts found.`;

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gemini-2.0-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Extract contacts from this page:\n\n${content.substring(0, 8000)}`,
            },
          ],
          temperature: 0,
        }),
        signal: AbortSignal.timeout(20000),
      },
    );

    if (!response.ok) {
      console.error('AI extraction failed:', response.status);
      return [];
    }

    const result = await response.json();
    const responseContent = result.choices?.[0]?.message?.content || '';

    const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const contacts = JSON.parse(jsonMatch[0]);
      return contacts.map((c: any) => ({
        ...c,
        source_url: sourceUrl,
        source: 'firecrawl_scrape',
      }));
    }

    return [];
  } catch (error) {
    console.error('AI extraction error:', error);
    return [];
  }
}

/**
 * Search for a person's LinkedIn profile URL using Serper.
 */
async function searchLinkedInProfile(
  personName: string,
  companyName: string,
): Promise<string | null> {
  const searchQuery = `site:linkedin.com/in "${personName}" "${companyName}"`;
  const apiKey = Deno.env.get('SERPER_API_KEY');
  if (!apiKey) return null;

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: searchQuery, num: 3, gl: 'us', hl: 'en' }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const results = data.organic || [];

    for (const result of results) {
      const url = result.link || '';
      if (
        url.includes('linkedin.com/in/') &&
        !url.includes('/posts') &&
        !url.includes('/activity')
      ) {
        const match = url.match(/linkedin\.com\/in\/([^/?#]+)/);
        if (match) {
          return `https://www.linkedin.com/in/${match[1]}`;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Deduplicate contacts by name, merging data from multiple sources.
 */
function dedupeContacts(contacts: any[]): any[] {
  const seen = new Map<string, any>();

  for (const contact of contacts) {
    if (!contact.name) continue;
    const key = contact.name.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.set(key, contact);
    } else {
      // Merge additional data from duplicate into existing
      const existing = seen.get(key);
      if (!existing.email && contact.email) existing.email = contact.email;
      if (!existing.linkedin_url && contact.linkedin_url)
        existing.linkedin_url = contact.linkedin_url;
      if (!existing.title && contact.title) existing.title = contact.title;
      if (!existing.company_phone && contact.company_phone)
        existing.company_phone = contact.company_phone;
      if (!existing.source_url && contact.source_url) existing.source_url = contact.source_url;
      // Prefer longer/more specific title
      if (contact.title && existing.title && contact.title.length > existing.title.length) {
        existing.title = contact.title;
      }
    }
  }

  return Array.from(seen.values());
}
