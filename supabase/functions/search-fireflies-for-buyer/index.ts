import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchRequest {
  query: string;
  limit?: number;
}

interface SearchResult {
  id: string;
  title: string;
  date: string;
  duration_minutes: number | null;
  participants: any[];
  summary: string;
  meeting_url: string;
  keywords: string[];
}

/**
 * Search Fireflies transcripts for buyer linking
 *
 * This function:
 * 1. Searches Fireflies by keyword/company name
 * 2. Returns formatted results for display
 * 3. Results can be manually linked to buyers
 *
 * Used in buyer profile page for finding relevant call history.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json() as SearchRequest;
    const { query, limit = 20 } = body;

    if (!query || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Search query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Searching Fireflies for: "${query}"`);

    // Search Fireflies using their search endpoint
    // The Fireflies MCP fireflies_search tool supports natural language queries
    const { data: firefliesResponse, error: mcpError } = await supabase.functions.invoke(
      'fireflies_search',
      {
        body: {
          query: query,
        }
      }
    );

    if (mcpError) {
      console.error("Fireflies search error:", mcpError);
      throw new Error(`Failed to search Fireflies: ${mcpError.message}`);
    }

    // Parse results
    const results = Array.isArray(firefliesResponse)
      ? firefliesResponse
      : firefliesResponse?.results || [];

    console.log(`Found ${results.length} results`);

    // Format results for display
    const formattedResults: SearchResult[] = results.slice(0, limit).map((r: any) => ({
      id: r.id || r.transcript_id,
      title: r.title || 'Untitled Call',
      date: r.date || r.created_at || new Date().toISOString(),
      duration_minutes: r.duration ? Math.round(r.duration / 60) : null,
      participants: r.participants || [],
      summary: r.summary || r.ai_summary || '',
      meeting_url: r.meeting_url || r.url || '',
      keywords: r.keywords || r.key_topics || [],
    }));

    return new Response(
      JSON.stringify({
        success: true,
        results: formattedResults,
        total: formattedResults.length,
        query: query,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Search error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
