import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncRequest {
  listingId: string;
  contactEmail: string;
  limit?: number;
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
      }
    }
  }
`;

/**
 * Sync Fireflies transcripts for a deal by contact email.
 *
 * 1. Paginates through Fireflies transcripts via their GraphQL API
 * 2. Filters for transcripts where the contact email is an attendee
 * 3. Links matching transcripts to the deal (stores ID only, not content)
 * 4. Skips duplicates
 *
 * Transcript content is fetched on-demand by fetch-fireflies-content.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json() as SyncRequest;
    const { listingId, contactEmail, limit = 50 } = body;

    if (!listingId || !contactEmail) {
      return new Response(
        JSON.stringify({ error: "listingId and contactEmail are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Syncing Fireflies transcripts for ${contactEmail} on deal ${listingId}`);

    // Paginate through Fireflies transcripts, filtering by participant email
    const emailLower = contactEmail.toLowerCase();
    const matchingTranscripts: any[] = [];
    let skip = 0;
    const batchSize = 50;
    const maxPages = 10; // Safety limit: scan up to 500 transcripts

    for (let page = 0; page < maxPages; page++) {
      const data = await firefliesGraphQL(LIST_TRANSCRIPTS_QUERY, {
        limit: batchSize,
        skip,
      });
      const batch = data.transcripts || [];

      for (const t of batch) {
        // Check meeting_attendees for email match
        const attendees = t.meeting_attendees || [];
        const hasParticipant = attendees.some(
          (a: any) => a.email?.toLowerCase() === emailLower
        );
        if (hasParticipant) {
          matchingTranscripts.push(t);
        }
      }

      // Stop if we've found enough or no more results
      if (batch.length < batchSize || matchingTranscripts.length >= limit) break;
      skip += batchSize;
    }

    console.log(`Found ${matchingTranscripts.length} Fireflies transcripts for ${contactEmail}`);

    if (matchingTranscripts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: `No Fireflies transcripts found for ${contactEmail}`,
          linked: 0,
          skipped: 0,
          total: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let linked = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const transcript of matchingTranscripts) {
      if (!transcript.id) {
        skipped++;
        continue;
      }

      try {
        // Check if already linked
        const { data: existing } = await supabase
          .from('deal_transcripts')
          .select('id')
          .eq('listing_id', listingId)
          .eq('fireflies_transcript_id', transcript.id)
          .maybeSingle();

        if (existing) {
          console.log(`Transcript ${transcript.id} already linked, skipping`);
          skipped++;
          continue;
        }

        // Extract participant emails
        const attendeeEmails = (transcript.meeting_attendees || [])
          .map((a: any) => a.email)
          .filter(Boolean);

        // Convert Fireflies date (Unix ms) to ISO string
        let callDate: string | null = null;
        if (transcript.date) {
          const dateNum = typeof transcript.date === 'number'
            ? transcript.date
            : parseInt(transcript.date, 10);
          if (!isNaN(dateNum)) {
            callDate = new Date(dateNum).toISOString();
          }
        }

        const { error: insertError } = await supabase
          .from('deal_transcripts')
          .insert({
            listing_id: listingId,
            fireflies_transcript_id: transcript.id,
            fireflies_meeting_id: transcript.id,
            transcript_url: transcript.transcript_url || null,
            title: transcript.title || `Call with ${contactEmail}`,
            call_date: callDate,
            participants: transcript.meeting_attendees || [],
            meeting_attendees: attendeeEmails,
            duration_minutes: transcript.duration ? Math.round(transcript.duration) : null,
            source: 'fireflies',
            auto_linked: true,
            transcript_text: '', // Fetched on-demand via fetch-fireflies-content
            created_by: null,
          });

        if (insertError) {
          console.error(`Failed to link transcript ${transcript.id}:`, insertError);
          errors.push(`${transcript.id}: ${insertError.message}`);
          skipped++;
        } else {
          console.log(`Linked transcript ${transcript.id}: ${transcript.title}`);
          linked++;
        }
      } catch (err) {
        console.error(`Error processing transcript ${transcript.id}:`, err);
        errors.push(`${transcript.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        skipped++;
      }
    }

    const response = {
      success: true,
      message: `Linked ${linked} transcript${linked !== 1 ? 's' : ''}, skipped ${skipped}`,
      linked,
      skipped,
      total: matchingTranscripts.length,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log("Sync complete:", response);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
