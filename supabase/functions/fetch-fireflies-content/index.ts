import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FetchRequest {
  transcriptId: string; // deal_transcripts.id (our DB record ID)
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

const GET_TRANSCRIPT_QUERY = `
  query GetTranscript($transcriptId: String!) {
    transcript(id: $transcriptId) {
      id
      title
      transcript_url
      sentences {
        text
        speaker_name
        start_time
        end_time
      }
      summary {
        short_summary
      }
    }
  }
`;

/**
 * Search recent Fireflies transcripts to find one matching a URL.
 * Used when a user pastes a Fireflies URL but we don't have the API transcript ID.
 */
const LIST_TRANSCRIPTS_QUERY = `
  query ListTranscripts($limit: Int, $skip: Int) {
    transcripts(limit: $limit, skip: $skip) {
      id
      title
      transcript_url
    }
  }
`;

async function findFirefliesIdByUrl(url: string): Promise<string | null> {
  // Extract the slug from the URL (e.g., "Orlando-Auto-Body-ext-SourceCo::4IadmUAh0YLzoEv4")
  const slugMatch = url.match(/app\.fireflies\.ai\/view\/([^?#]+)/);
  if (!slugMatch) return null;
  const slug = decodeURIComponent(slugMatch[1]);

  // Search through recent transcripts to find one with matching URL or slug
  let skip = 0;
  const batchSize = 50;
  const maxPages = 6; // Scan up to 300 transcripts

  for (let page = 0; page < maxPages; page++) {
    const data = await firefliesGraphQL(LIST_TRANSCRIPTS_QUERY, {
      limit: batchSize,
      skip,
    });
    const batch = data.transcripts || [];

    for (const t of batch) {
      // Match by transcript_url containing the same slug
      if (t.transcript_url && t.transcript_url.includes(slug)) {
        console.log(`Found Fireflies transcript ID ${t.id} matching URL slug "${slug}"`);
        return t.id;
      }
    }

    if (batch.length < batchSize) break;
    skip += batchSize;
  }

  console.log(`No Fireflies transcript found matching URL slug "${slug}"`);
  return null;
}

/**
 * Fetch full transcript content from Fireflies on-demand.
 *
 * 1. Checks if content is already cached in database
 * 2. If fireflies_transcript_id is missing but URL is a Fireflies URL, searches for it
 * 3. Fetches sentences from Fireflies GraphQL API
 * 4. Builds speaker-labeled transcript text
 * 5. Caches the content for future use
 * 6. Returns the transcript text
 *
 * Called by the enrichment system when transcript content is needed.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json() as FetchRequest;
    const { transcriptId } = body;

    if (!transcriptId) {
      return new Response(
        JSON.stringify({ error: "transcriptId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the deal_transcript record (include transcript_url for URL-based lookup)
    const { data: dealTranscript, error: fetchError } = await supabase
      .from('deal_transcripts')
      .select('id, fireflies_transcript_id, transcript_text, transcript_url, source')
      .eq('id', transcriptId)
      .single();

    if (fetchError || !dealTranscript) {
      return new Response(
        JSON.stringify({ error: "Transcript not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this is a Fireflies transcript (either by source or by URL)
    const hasFirefliesUrl = dealTranscript.transcript_url &&
      /app\.fireflies\.ai\/view\//i.test(dealTranscript.transcript_url);
    const isFireflies = dealTranscript.source === 'fireflies' || hasFirefliesUrl;

    if (!isFireflies) {
      return new Response(
        JSON.stringify({ error: "Not a Fireflies transcript" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already cached (content length > 100 chars indicates real content)
    if (dealTranscript.transcript_text && dealTranscript.transcript_text.length > 100) {
      console.log(`Returning cached content for transcript ${transcriptId}`);
      return new Response(
        JSON.stringify({
          success: true,
          content: dealTranscript.transcript_text,
          cached: true,
          transcript_id: transcriptId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve the Fireflies transcript ID
    let firefliesId = dealTranscript.fireflies_transcript_id;

    // If no Fireflies ID stored but we have a Fireflies URL, search for it
    if (!firefliesId && hasFirefliesUrl) {
      console.log(`No fireflies_transcript_id stored, searching by URL: ${dealTranscript.transcript_url}`);
      firefliesId = await findFirefliesIdByUrl(dealTranscript.transcript_url!);

      if (firefliesId) {
        // Save the resolved ID so we don't have to search again
        await supabase
          .from('deal_transcripts')
          .update({
            fireflies_transcript_id: firefliesId,
            source: 'fireflies', // Ensure source is correct
          })
          .eq('id', transcriptId);
        console.log(`Saved resolved fireflies_transcript_id: ${firefliesId}`);
      }
    }

    if (!firefliesId) {
      throw new Error(
        "Could not resolve Fireflies transcript ID. The transcript may not exist in your Fireflies account."
      );
    }

    // Fetch full transcript from Fireflies API
    console.log(`Fetching content from Fireflies for transcript ${firefliesId}`);

    const data = await firefliesGraphQL(GET_TRANSCRIPT_QUERY, {
      transcriptId: firefliesId,
    });

    const transcript = data.transcript;
    if (!transcript) {
      throw new Error("Transcript not found in Fireflies");
    }

    // Build transcript text from sentences with speaker labels
    let transcriptText = '';

    if (transcript.sentences && Array.isArray(transcript.sentences) && transcript.sentences.length > 0) {
      transcriptText = transcript.sentences
        .map((s: any) => {
          const speaker = s.speaker_name || 'Unknown';
          return `${speaker}: ${s.text}`;
        })
        .join('\n');
    }

    // Fallback: use summary if no sentences available
    if (!transcriptText && transcript.summary?.short_summary) {
      transcriptText = `[Summary only]\n${transcript.summary.short_summary}`;
    }

    if (!transcriptText || transcriptText.length < 50) {
      console.warn("Fetched content is too short or empty:", transcriptText?.substring(0, 100));
      throw new Error("No valid transcript content found in Fireflies response");
    }

    console.log(`Fetched ${transcriptText.length} characters from Fireflies`);

    // Cache the content in database
    const { error: updateError } = await supabase
      .from('deal_transcripts')
      .update({
        transcript_text: transcriptText,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', transcriptId);

    if (updateError) {
      console.error("Failed to cache transcript content:", updateError);
      // Don't fail the request - still return the content
    } else {
      console.log(`Cached transcript content for ${transcriptId}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        content: transcriptText,
        cached: false,
        transcript_id: transcriptId,
        length: transcriptText.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Fetch content error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
