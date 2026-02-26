/* eslint-disable no-console */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';

/**
 * Fireflies webhook handler for daily standup meetings.
 *
 * When Fireflies finishes processing a meeting, it sends a webhook.
 * This function checks if the meeting matches our standup criteria
 * and triggers the extract-standup-tasks function.
 *
 * Standup identification:
 * 1. Meeting tagged with "daily-standup" in Fireflies
 * 2. Or meeting title matches common standup patterns
 */

const STANDUP_TITLE_PATTERNS = [
  /daily\s*standup/i,
  /morning\s*meeting/i,
  /daily\s*sync/i,
  /standup\s*meeting/i,
  /daily\s*huddle/i,
  /team\s*standup/i,
  /bd\s*standup/i,
  /bd\s*daily/i,
];

const STANDUP_TAG = 'daily-standup';

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log('Received Fireflies webhook:', JSON.stringify(body).slice(0, 500));

    // Fireflies webhook payload
    const transcriptId = body.data?.transcript_id || body.transcript_id || body.id;
    const meetingTitle = body.data?.title || body.title || '';
    const tags = body.data?.tags || body.tags || [];

    if (!transcriptId) {
      return new Response(JSON.stringify({ error: 'No transcript_id in webhook payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if this is a standup meeting
    const hasStandupTag =
      Array.isArray(tags) &&
      tags.some((t: string) => t.toLowerCase().replace(/\s+/g, '-') === STANDUP_TAG);
    const matchesTitle = STANDUP_TITLE_PATTERNS.some((p) => p.test(meetingTitle));

    if (!hasStandupTag && !matchesTitle) {
      console.log(`Skipping non-standup meeting: "${meetingTitle}" (tags: ${tags.join(', ')})`);
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: 'Not identified as a standup meeting',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check if we've already processed this transcript
    const { data: existing } = await supabase
      .from('standup_meetings')
      .select('id')
      .eq('fireflies_transcript_id', transcriptId)
      .maybeSingle();

    if (existing) {
      console.log(`Transcript ${transcriptId} already processed as meeting ${existing.id}`);
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: 'Already processed',
          meeting_id: existing.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Trigger extraction
    console.log(`Processing standup meeting: "${meetingTitle}" (${transcriptId})`);

    const extractResponse = await fetch(`${supabaseUrl}/functions/v1/extract-standup-tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        fireflies_transcript_id: transcriptId,
        meeting_title: meetingTitle,
      }),
    });

    const extractResult = await extractResponse.json();

    if (!extractResponse.ok) {
      console.error('Extraction failed:', extractResult);
      return new Response(
        JSON.stringify({
          success: false,
          error: extractResult.error || 'Extraction failed',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('Extraction complete:', extractResult);

    return new Response(
      JSON.stringify({
        success: true,
        meeting_id: extractResult.meeting_id,
        tasks_extracted: extractResult.tasks_extracted,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
