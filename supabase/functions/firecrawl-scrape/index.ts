import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { withRetry } from "../_shared/retry.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  try {
    const { url, options = {} } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'url is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'FIRECRAWL_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default scrape options
    const scrapeOptions = {
      url,
      formats: options.formats || ['markdown'],
      onlyMainContent: options.onlyMainContent !== false,
      waitFor: options.waitFor || 2000,
      timeout: options.timeout || 30000,
      ...options
    };

    console.log(`[firecrawl-scrape] Scraping: ${url}`);

    const result = await withRetry(async () => {
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scrapeOptions),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        // Retry on 429 (rate limit) and 5xx (server errors), not on 4xx client errors
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`Firecrawl API error: ${response.status} - ${errorText}`);
        }
        // Non-retryable error: return error response directly
        throw Object.assign(
          new Error(`Firecrawl API error: ${response.status}`),
          { nonRetryable: true, status: response.status, details: errorText }
        );
      }

      return response.json();
    }, {
      maxRetries: 3,
      baseDelayMs: 2000,
      maxDelayMs: 15000,
      retryableErrors: ['Firecrawl API error: 429', 'Firecrawl API error: 5'],
    }).catch((err: any) => {
      if (err.nonRetryable) {
        return { _error: true, status: err.status, details: err.details, message: err.message };
      }
      throw err;
    });

    // Handle non-retryable errors that were caught above
    if (result && (result as any)._error) {
      const errResult = result as any;
      return new Response(
        JSON.stringify({
          error: errResult.message,
          details: errResult.details
        }),
        { status: errResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: result.data,
        metadata: result.data?.metadata || {}
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[firecrawl-scrape] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
