import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchRequest {
  query: string;
  participantEmails?: string[];
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
 * Call the Fireflies GraphQL API directly.
 * Requires FIREFLIES_API_KEY set as a Supabase secret.
 */
async function firefliesGraphQL(query: string, variables?: Record<string, unknown>) {
  const apiKey = Deno.env.get("FIREFLIES_API_KEY");
  if (!apiKey) {
    throw new Error(
      "FIREFLIES_API_KEY is not configured. Add it as a Supabase secret: " +
      "supabase secrets set FIREFLIES_API_KEY=your_key"
    );
  }

  const response = await fetch("https://api.fireflies.ai/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Fireflies API error (${response.status}): ${text}`);
  }

  const result = await response.json();
  if (result.errors) {
    throw new Error(
      `Fireflies GraphQL error: ${result.errors[0]?.message || JSON.stringify(result.errors)}`
    );
  }

  return result.data;
}

const LIST_TRANSCRIPTS_QUERY = `
  query ListTranscripts($limit: Int, $skip: Int) {
    transcripts(limit: $limit, skip: $skip) {
      id
      title
      date
      duration
      organizer_email
      participants
      meeting_attendees {
        displayName
        email
        name
      }
      transcript_url
      summary {
        short_summary
        keywords
        action_items
      }
    }
  }
`;

/**
 * Search Fireflies transcripts for buyer/deal linking.
 *
 * Supports two search modes (both run, results merged + deduplicated):
 * 1. Keyword search — matches title, summary, keywords
 * 2. Participant email search — finds transcripts with matching attendees
 *
 * Calls the Fireflies GraphQL API directly (requires FIREFLIES_API_KEY).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the caller has a valid auth token (admin or service role)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    if (token !== supabaseKey) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Invalid auth token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_admin) {
        return new Response(
          JSON.stringify({ error: "Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const body = await req.json() as SearchRequest;
    const { query, participantEmails, limit = 20 } = body;

    if ((!query || query.trim().length === 0) && (!participantEmails || participantEmails.length === 0)) {
      return new Response(
        JSON.stringify({ error: "Search query or participant emails required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch transcripts from Fireflies API (paginate for coverage)
    const allFireflies: any[] = [];
    let skip = 0;
    const batchSize = 50;
    const maxPages = 6; // Scan up to 300 transcripts

    for (let page = 0; page < maxPages; page++) {
      const data = await firefliesGraphQL(LIST_TRANSCRIPTS_QUERY, {
        limit: batchSize,
        skip,
      });
      const batch = data.transcripts || [];
      allFireflies.push(...batch);
      if (batch.length < batchSize) break;
      skip += batchSize;
    }

    console.log(`Fetched ${allFireflies.length} transcripts from Fireflies`);

    // Build filter sets
    const emailSet = new Set(
      (participantEmails || []).map((e: string) => e.toLowerCase())
    );
    const queryLower = (query || '').toLowerCase().trim();

    // Filter: match by participant email OR keyword
    const matchingResults = allFireflies.filter((t: any) => {
      // Check participant emails
      if (emailSet.size > 0) {
        const attendees = t.meeting_attendees || [];
        if (attendees.some((a: any) => a.email && emailSet.has(a.email.toLowerCase()))) {
          return true;
        }
      }

      // Check keyword in title, summary, and keywords
      if (queryLower) {
        const title = (t.title || '').toLowerCase();
        const summary = (t.summary?.short_summary || '').toLowerCase();
        const keywords = (t.summary?.keywords || []).join(' ').toLowerCase();
        const participants = (t.participants || []).join(' ').toLowerCase();
        if (
          title.includes(queryLower) ||
          summary.includes(queryLower) ||
          keywords.includes(queryLower) ||
          participants.includes(queryLower)
        ) {
          return true;
        }
      }

      return false;
    });

    console.log(`${matchingResults.length} transcripts matched search criteria`);

    // Format results
    const formattedResults: SearchResult[] = matchingResults
      .slice(0, limit)
      .map((t: any) => {
        // Convert date
        let dateStr = new Date().toISOString();
        if (t.date) {
          const dateNum = typeof t.date === 'number'
            ? t.date
            : parseInt(t.date, 10);
          if (!isNaN(dateNum)) {
            dateStr = new Date(dateNum).toISOString();
          }
        }

        return {
          id: t.id,
          title: t.title || 'Untitled Call',
          date: dateStr,
          duration_minutes: t.duration ? Math.round(t.duration) : null,
          participants: t.meeting_attendees || [],
          summary: t.summary?.short_summary || '',
          meeting_url: t.transcript_url || '',
          keywords: t.summary?.keywords || [],
        };
      });

    return new Response(
      JSON.stringify({
        success: true,
        results: formattedResults,
        total: formattedResults.length,
        query: query,
        participantEmailsUsed: participantEmails?.length || 0,
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
