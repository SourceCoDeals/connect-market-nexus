import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { buyerId, peFirmWebsite, platformWebsite } = await req.json();

    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'FIRECRAWL_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let websites: string[] = [];
    let buyer: any = null;

    // Get buyer info if buyerId provided (use remarketing_buyers — the active schema)
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
      return new Response(
        JSON.stringify({ error: 'No websites provided for contact discovery' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allContacts: any[] = [];

    for (const website of websites) {
      try {
        console.log(`[find-buyer-contacts] Processing: ${website}`);

        // Step 1: Use Firecrawl Map API to find team pages
        const mapResponse = await fetch('https://api.firecrawl.dev/v1/map', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: website,
            search: 'team leadership about people contact',
            limit: 10
          }),
        });

        let teamPages: string[] = [];
        if (mapResponse.ok) {
          const mapResult = await mapResponse.json();
          teamPages = mapResult.links || [];
          console.log(`[find-buyer-contacts] Found ${teamPages.length} potential team pages`);
        }

        // Filter to likely team/about pages
        const relevantPages = teamPages.filter(url => 
          /team|leadership|about|people|staff|management|executives|partners/i.test(url)
        ).slice(0, 3);

        // Add homepage if no team pages found
        if (relevantPages.length === 0) {
          relevantPages.push(website);
        }

        // Step 2: Scrape relevant pages
        for (const pageUrl of relevantPages) {
          try {
            const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                url: pageUrl,
                formats: ['markdown'],
                onlyMainContent: true,
              }),
            });

            if (!scrapeResponse.ok) continue;

            const scrapeResult = await scrapeResponse.json();
            const pageContent = scrapeResult.data?.markdown || '';

            if (pageContent.length < 100) continue;

            // Step 3: Extract contacts using AI
            const contacts = await extractContactsWithAI(pageContent, pageUrl, GEMINI_API_KEY);
            allContacts.push(...contacts);

          } catch (pageError) {
            console.error(`[find-buyer-contacts] Error scraping ${pageUrl}:`, pageError);
          }
        }

      } catch (websiteError) {
        console.error(`[find-buyer-contacts] Error processing ${website}:`, websiteError);
      }
    }

    // Dedupe contacts by name
    const uniqueContacts = dedupeContacts(allContacts);

    // Save contacts if buyerId provided
    if (buyerId && uniqueContacts.length > 0) {
      for (const contact of uniqueContacts) {
        await supabase.from('remarketing_buyer_contacts').upsert({
          buyer_id: buyerId,
          name: contact.name,
          title: contact.title,
          email: contact.email,
          linkedin_url: contact.linkedin_url,
          role_category: contact.role_category,
          source: 'ai_discovery',
          source_url: contact.source_url,
          email_confidence: contact.email ? 'Guessed' : null,
        }, {
          onConflict: 'buyer_id,name',
          ignoreDuplicates: true
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        contacts: uniqueContacts,
        totalFound: uniqueContacts.length,
        websitesProcessed: websites.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[find-buyer-contacts] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function extractContactsWithAI(content: string, sourceUrl: string, apiKey: string): Promise<any[]> {
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
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.0-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract contacts from this page:\n\n${content.substring(0, 8000)}` }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error('AI extraction failed:', response.status);
      return [];
    }

    const result = await response.json();
    const responseContent = result.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const contacts = JSON.parse(jsonMatch[0]);
      return contacts.map((c: any) => ({ ...c, source_url: sourceUrl }));
    }

    return [];
  } catch (error) {
    console.error('AI extraction error:', error);
    return [];
  }
}

function dedupeContacts(contacts: any[]): any[] {
  const seen = new Map<string, any>();
  
  for (const contact of contacts) {
    const key = contact.name.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.set(key, contact);
    } else {
      // Merge additional data
      const existing = seen.get(key);
      if (!existing.email && contact.email) existing.email = contact.email;
      if (!existing.linkedin_url && contact.linkedin_url) existing.linkedin_url = contact.linkedin_url;
      if (!existing.title && contact.title) existing.title = contact.title;
    }
  }

  return Array.from(seen.values());
}
