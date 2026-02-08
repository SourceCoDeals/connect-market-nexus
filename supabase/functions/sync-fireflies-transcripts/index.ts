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

interface FirefliesParticipant {
  name?: string;
  email: string;
}

interface FirefliesTranscript {
  id: string;
  title?: string;
  date?: string;
  duration?: number; // seconds
  meeting_url?: string;
  participants?: FirefliesParticipant[];
  summary?: string;
  sentences?: any[];
}

/**
 * Sync Fireflies transcripts for a deal by contact email
 *
 * This function:
 * 1. Queries Fireflies API for all transcripts with the contact as participant
 * 2. Links transcripts to the deal (stores ID only, not content)
 * 3. Marks as auto_linked for tracking
 * 4. Skips duplicates
 *
 * The actual transcript content is fetched on-demand by the enrichment system.
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

    // Query Fireflies API for transcripts with this participant
    // Using Fireflies MCP tools (already connected in your system)
    const { data: firefliesResponse, error: mcpError } = await supabase.functions.invoke(
      'fireflies_get_transcripts',
      {
        body: {
          participants: [contactEmail],
          limit: limit,
        }
      }
    );

    if (mcpError) {
      console.error("Fireflies MCP error:", mcpError);
      throw new Error(`Failed to query Fireflies: ${mcpError.message}`);
    }

    // Parse response - Fireflies MCP returns array of transcripts
    const transcripts: FirefliesTranscript[] = Array.isArray(firefliesResponse)
      ? firefliesResponse
      : firefliesResponse?.transcripts || [];

    if (transcripts.length === 0) {
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

    console.log(`Found ${transcripts.length} Fireflies transcripts`);

    let linked = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Link each transcript to the deal
    for (const transcript of transcripts) {
      if (!transcript.id) {
        console.warn("Skipping transcript without ID:", transcript);
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

        // Extract participant emails for easy filtering
        const attendeeEmails = transcript.participants?.map(p => p.email).filter(Boolean) || [];

        // Create deal_transcript record
        // NOTE: transcript_text is empty - will be fetched on-demand by enrichment
        const { error: insertError } = await supabase
          .from('deal_transcripts')
          .insert({
            listing_id: listingId,
            fireflies_transcript_id: transcript.id,
            fireflies_meeting_id: transcript.id, // Often same as transcript ID
            transcript_url: transcript.meeting_url || null,
            title: transcript.title || `Call with ${contactEmail}`,
            call_date: transcript.date || null,
            participants: transcript.participants || [],
            meeting_attendees: attendeeEmails,
            duration_minutes: transcript.duration ? Math.round(transcript.duration / 60) : null,
            source: 'fireflies',
            auto_linked: true,
            transcript_text: '', // Empty - fetched on-demand
            created_by: null, // Auto-linked, not by specific user
          });

        if (insertError) {
          console.error(`Failed to link transcript ${transcript.id}:`, insertError);
          errors.push(`${transcript.id}: ${insertError.message}`);
          skipped++;
        } else {
          console.log(`Successfully linked transcript ${transcript.id}`);
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
      total: transcripts.length,
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
