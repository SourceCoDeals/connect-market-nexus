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
 * Search Fireflies transcripts for buyer/deal linking
 *
 * This function supports two search modes:
 * 1. Keyword search — searches Fireflies by keyword/company name
 * 2. Participant email search — finds transcripts where ANY of the provided emails
 *    appear as an attendee (used for domain-based multi-email search)
 *
 * Both modes run and results are merged + deduplicated for best coverage.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // SECURITY: Verify the caller has a valid auth token (admin or service role)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If it's not the service role key, verify the user is an admin
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

    const allResults: any[] = [];

    // PATH 1: If participant emails provided, search by email participants
    if (participantEmails && participantEmails.length > 0) {
      console.log(`Searching Fireflies for ${participantEmails.length} participant emails`);

      try {
        const { data: firefliesResponse, error: mcpError } = await supabase.functions.invoke(
          'fireflies_get_transcripts',
          {
            body: {
              participants: participantEmails,
              limit: limit,
            }
          }
        );

        if (!mcpError && firefliesResponse) {
          const transcripts = Array.isArray(firefliesResponse)
            ? firefliesResponse
            : firefliesResponse?.transcripts || [];

          for (const t of transcripts) {
            allResults.push({
              id: t.id,
              title: t.title || 'Untitled Call',
              date: t.dateString || t.date || new Date().toISOString(),
              duration_minutes: t.duration ? Math.round(t.duration) : null,
              participants: t.meetingAttendees || t.participants || [],
              summary: t.summary || '',
              meeting_url: t.meetingLink || '',
              keywords: t.summary?.keywords || [],
            });
          }
        }
      } catch (err) {
        console.warn('Fireflies participant search failed:', err);
      }
    }

    // PATH 2: Also do keyword search (always, as a supplement)
    if (query && query.trim().length > 0) {
      console.log(`Searching Fireflies for keyword: "${query}"`);

      try {
        const { data: firefliesResponse, error: mcpError } = await supabase.functions.invoke(
          'fireflies_search',
          {
            body: {
              query: query,
            }
          }
        );

        if (!mcpError) {
          const results = Array.isArray(firefliesResponse)
            ? firefliesResponse
            : firefliesResponse?.results || [];

          for (const r of results) {
            allResults.push({
              id: r.id || r.transcript_id,
              title: r.title || 'Untitled Call',
              date: r.date || r.dateString || r.created_at || new Date().toISOString(),
              duration_minutes: r.duration ? Math.round(typeof r.duration === 'number' && r.duration > 1000 ? r.duration / 60 : r.duration) : null,
              participants: r.meetingAttendees || r.participants || [],
              summary: r.summary || r.ai_summary || '',
              meeting_url: r.meetingLink || r.meeting_url || r.url || '',
              keywords: r.summary?.keywords || r.keywords || r.key_topics || [],
            });
          }
        }
      } catch (err) {
        console.warn('Fireflies keyword search failed:', err);
      }
    }

    // Deduplicate by ID
    const seen = new Set<string>();
    const uniqueResults = allResults.filter(r => {
      if (!r.id || seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    const formattedResults: SearchResult[] = uniqueResults.slice(0, limit);

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
