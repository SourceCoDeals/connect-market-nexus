const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerificationResult {
  url: string;
  type: 'platform' | 'pe_firm' | 'unknown';
  confidence: number;
  signals: string[];
  companyName?: string;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls } = await req.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'urls array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'LOVABLE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[verify-platform-website] Verifying ${urls.length} URLs`);

    const results: VerificationResult[] = [];

    for (const url of urls) {
      try {
        // Format URL
        let formattedUrl = url.trim();
        if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
          formattedUrl = `https://${formattedUrl}`;
        }

        console.log(`[verify-platform-website] Scraping: ${formattedUrl}`);

        // Scrape the website with Firecrawl
        const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: formattedUrl,
            formats: ['markdown'],
            onlyMainContent: true,
          }),
        });

        if (!scrapeResponse.ok) {
          const errorText = await scrapeResponse.text();
          console.error(`[verify-platform-website] Scrape failed for ${url}:`, errorText);
          results.push({
            url,
            type: 'unknown',
            confidence: 0,
            signals: [],
            error: `Failed to scrape: ${scrapeResponse.status}`,
          });
          continue;
        }

        const scrapeData = await scrapeResponse.json();
        const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
        const title = scrapeData.data?.metadata?.title || '';

        if (!markdown || markdown.length < 50) {
          results.push({
            url,
            type: 'unknown',
            confidence: 0,
            signals: ['Insufficient content scraped'],
            error: 'Could not extract enough content from website',
          });
          continue;
        }

        // Truncate content for AI analysis (keep first 3000 chars)
        const contentForAnalysis = markdown.substring(0, 3000);

        // Use AI to classify the website
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `You are an expert at classifying business websites. Analyze the provided website content and determine if it belongs to:

1. A "platform" company (operating company) - A business that provides actual products or services to customers. Signs include:
   - Lists specific services they provide (HVAC, plumbing, roofing, etc.)
   - Shows service areas or locations they operate in
   - Has "Schedule Service", "Get a Quote", "Contact Us for Service" CTAs
   - Mentions their team, technicians, or employees
   - Shows customer reviews or testimonials about their services
   - Has pricing or service descriptions

2. A "pe_firm" (private equity firm or investment company) - An investment firm that acquires and manages portfolio companies. Signs include:
   - Mentions "portfolio companies", "investments", "acquisitions"
   - Has "Investment Team" or "Partners" pages
   - Discusses "thesis", "strategy", or "value creation"
   - Lists multiple companies they've invested in
   - Has content about fundraising, LPs, or fund performance
   - Uses terms like "platform", "add-on", "bolt-on" in investment context

Respond with a JSON object containing:
- type: "platform" or "pe_firm" or "unknown"
- confidence: number from 0 to 100
- signals: array of specific evidence found (max 5)
- companyName: the company name if identifiable`
              },
              {
                role: 'user',
                content: `Website URL: ${formattedUrl}
Page Title: ${title}

Website Content:
${contentForAnalysis}`
              }
            ],
            response_format: { type: 'json_object' },
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`[verify-platform-website] AI analysis failed:`, errorText);
          
          // Check for rate limiting
          if (aiResponse.status === 429) {
            results.push({
              url,
              type: 'unknown',
              confidence: 0,
              signals: [],
              error: 'Rate limited - please try again later',
            });
            continue;
          }
          
          results.push({
            url,
            type: 'unknown',
            confidence: 0,
            signals: [],
            error: `AI analysis failed: ${aiResponse.status}`,
          });
          continue;
        }

        const aiData = await aiResponse.json();
        const analysis = JSON.parse(aiData.choices?.[0]?.message?.content || '{}');

        results.push({
          url,
          type: analysis.type || 'unknown',
          confidence: analysis.confidence || 0,
          signals: analysis.signals || [],
          companyName: analysis.companyName,
        });

        console.log(`[verify-platform-website] ${url} classified as ${analysis.type} (${analysis.confidence}%)`);

      } catch (urlError) {
        console.error(`[verify-platform-website] Error processing ${url}:`, urlError);
        results.push({
          url,
          type: 'unknown',
          confidence: 0,
          signals: [],
          error: urlError instanceof Error ? urlError.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[verify-platform-website] Unexpected error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
