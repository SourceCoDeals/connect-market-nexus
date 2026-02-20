import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

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

/**
 * GraphQL queries that use the Fireflies native filtering:
 * - keyword: searches title + spoken words server-side
 * - participants: filters by attendee email server-side
 */
const TRANSCRIPT_FIELDS = `
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
`;

const KEYWORD_SEARCH_QUERY = `
  query SearchByKeyword($keyword: String!, $limit: Int, $skip: Int) {
    transcripts(keyword: $keyword, limit: $limit, skip: $skip) {
      ${TRANSCRIPT_FIELDS}
    }
  }
`;

const PARTICIPANT_SEARCH_QUERY = `
  query SearchByParticipant($participants: [String!], $limit: Int, $skip: Int) {
    transcripts(participants: $participants, limit: $limit, skip: $skip) {
      ${TRANSCRIPT_FIELDS}
    }
  }
`;

const ALL_TRANSCRIPTS_QUERY = `
  query ListTranscripts($limit: Int, $skip: Int) {
    transcripts(limit: $limit, skip: $skip) {
      ${TRANSCRIPT_FIELDS}
    }
  }
`;

/**
 * Search Fireflies transcripts for buyer/deal linking.
 *
 * Uses the Fireflies API native filtering:
 * 1. keyword param — server-side search of title + spoken words
 * 2. participants param — server-side filter by attendee email
 *
 * Both searches run in parallel, results are merged and deduplicated.
 */
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
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

    const trimmedQuery = (query || '').trim();
    const validEmails = (participantEmails || []).filter(Boolean);

    // Run keyword search and participant search in parallel using native Fireflies API filtering
    const searches: Promise<any[]>[] = [];

    if (trimmedQuery) {
      searches.push(
        (async () => {
          const results: any[] = [];
          let skip = 0;
          const batchSize = 50;
          const maxPages = 4;
          for (let page = 0; page < maxPages; page++) {
            const data = await firefliesGraphQL(KEYWORD_SEARCH_QUERY, {
              keyword: trimmedQuery,
              limit: batchSize,
              skip,
            });
            const batch = data.transcripts || [];
            results.push(...batch);
            if (batch.length < batchSize) break;
            skip += batchSize;
          }
          console.log(`Keyword search "${trimmedQuery}" returned ${results.length} results`);
          return results;
        })()
      );
    }

    if (validEmails.length > 0) {
      searches.push(
        (async () => {
          const results: any[] = [];
          let skip = 0;
          const batchSize = 50;
          const maxPages = 4;
          for (let page = 0; page < maxPages; page++) {
            const data = await firefliesGraphQL(PARTICIPANT_SEARCH_QUERY, {
              participants: validEmails,
              limit: batchSize,
              skip,
            });
            const batch = data.transcripts || [];
            results.push(...batch);
            if (batch.length < batchSize) break;
            skip += batchSize;
          }
          console.log(`Participant search [${validEmails.join(', ')}] returned ${results.length} results`);
          return results;
        })()
      );
    }

    // If no keyword and no emails (shouldn't happen due to validation above), fetch recent
    if (searches.length === 0) {
      searches.push(
        (async () => {
          const data = await firefliesGraphQL(ALL_TRANSCRIPTS_QUERY, { limit: 50, skip: 0 });
          return data.transcripts || [];
        })()
      );
    }

    const searchResults = await Promise.all(searches);

    // Merge and deduplicate by transcript ID
    const seen = new Set<string>();
    const matchingResults: any[] = [];
    for (const resultSet of searchResults) {
      for (const t of resultSet) {
        if (t.id && !seen.has(t.id)) {
          seen.add(t.id);
          matchingResults.push(t);
        }
      }
    }

    console.log(`${matchingResults.length} unique transcripts after merging`);

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
