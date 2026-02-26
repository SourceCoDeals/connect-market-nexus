/**
 * Process Standup Tasks Edge Function
 *
 * Receives a Fireflies transcript (via webhook or manual trigger),
 * uses Claude to extract action items, and writes them to daily_tasks.
 *
 * Trigger modes:
 *   1. Webhook from Fireflies (POST with transcript data)
 *   2. Manual trigger from dashboard (POST with fireflies_transcript_id)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import {
  ANTHROPIC_API_URL,
  DEFAULT_CLAUDE_MODEL,
  getAnthropicHeaders,
  fetchWithAutoRetry,
} from '../_shared/ai-providers.ts';

const FIREFLIES_API_URL = 'https://api.fireflies.ai/graphql';

interface ExtractedTask {
  title: string;
  description?: string;
  assignee_name: string;
  task_type: string;
  due_date?: string;
  source_timestamp?: string;
  deal_reference?: string;
  confidence: 'high' | 'medium' | 'low';
}

interface FirefliesTranscript {
  id: string;
  title: string;
  date: string;
  duration: number;
  transcript_text: string;
  speakers: { name: string }[];
}

// ─── Fireflies GraphQL query ───

async function fetchFirefliesTranscript(
  transcriptId: string,
  apiKey: string,
): Promise<FirefliesTranscript | null> {
  const query = `
    query Transcript($transcriptId: String!) {
      transcript(id: $transcriptId) {
        id
        title
        date
        duration
        sentences {
          text
          speaker_name
          start_time
          end_time
        }
        participants
      }
    }
  `;

  const resp = await fetch(FIREFLIES_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: { transcriptId },
    }),
  });

  if (!resp.ok) {
    console.error(`Fireflies API error: ${resp.status}`);
    return null;
  }

  const result = await resp.json();
  const t = result?.data?.transcript;
  if (!t) return null;

  // Build full transcript text from sentences
  const sentences = t.sentences || [];
  const transcriptText = sentences
    .map(
      (s: { speaker_name: string; text: string; start_time: number }) =>
        `[${formatTimestamp(s.start_time)}] ${s.speaker_name}: ${s.text}`,
    )
    .join('\n');

  const speakers = [...new Set(sentences.map((s: { speaker_name: string }) => s.speaker_name))].map(
    (name) => ({ name: name as string }),
  );

  return {
    id: t.id,
    title: t.title || 'Daily Standup',
    date: t.date,
    duration: t.duration || 0,
    transcript_text: transcriptText,
    speakers,
  };
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ─── AI Task Extraction ───

async function extractTasksFromTranscript(
  transcript: string,
  teamMembers: { id: string; name: string; aliases: string[] }[],
  anthropicKey: string,
): Promise<ExtractedTask[]> {
  const teamMemberList = teamMembers
    .map(
      (m) =>
        `- ${m.name}${m.aliases.length > 0 ? ` (also known as: ${m.aliases.join(', ')})` : ''}`,
    )
    .join('\n');

  const systemPrompt = `You are a task extraction assistant for SourceCo, a business development firm. Your job is to parse daily standup meeting transcripts and extract discrete, actionable tasks.

## BD Team Members
${teamMemberList}

## Task Types (choose exactly one per task)
- contact_owner: Reach out to a business owner about a deal
- build_buyer_universe: Research and compile potential buyers for a deal
- follow_up_with_buyer: Follow up on an existing buyer conversation
- send_materials: Send teasers, CIMs, or other deal documents
- update_pipeline: Update CRM records, deal status, or notes
- schedule_call: Arrange a call with an owner, buyer, or internal team
- other: Tasks that don't fit the above categories

## Rules
1. Only extract concrete, actionable tasks — NOT opinions, status updates, or general discussion
2. Match each assignee to the team member list using fuzzy name matching
3. If no specific person is named for a task, set assignee_name to "Unassigned"
4. Default due_date to today (${new Date().toISOString().split('T')[0]}) unless multi-day language is used (e.g., "this week" = end of week, "by Friday" = that date)
5. Include the approximate timestamp from the transcript for each task (e.g., "2:15")
6. If a deal or company is mentioned, include it as deal_reference
7. Each distinct action = its own task, even if for the same person
8. Set confidence to "high" if the task and assignee are clearly stated, "medium" if somewhat ambiguous, "low" if you're guessing

## Output Format
Return a JSON array of task objects. Nothing else — no markdown, no explanation.
[
  {
    "title": "Short task description",
    "description": "Optional longer context from the transcript",
    "assignee_name": "Team Member Name or Unassigned",
    "task_type": "one_of_the_types_above",
    "due_date": "YYYY-MM-DD",
    "source_timestamp": "M:SS",
    "deal_reference": "Company or deal name if mentioned",
    "confidence": "high|medium|low"
  }
]`;

  const response = await fetchWithAutoRetry(
    ANTHROPIC_API_URL,
    {
      method: 'POST',
      headers: getAnthropicHeaders(anthropicKey),
      body: JSON.stringify({
        model: DEFAULT_CLAUDE_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Here is the daily standup transcript. Extract all actionable tasks:\n\n${transcript}`,
          },
        ],
      }),
    },
    { callerName: 'process-standup-tasks', maxRetries: 2 },
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errText}`);
  }

  const result = await response.json();
  const content = result?.content?.[0]?.text || '';

  // Parse JSON from response (handle potential markdown wrapping)
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.warn('No JSON array found in AI response:', content.substring(0, 200));
    return [];
  }

  try {
    return JSON.parse(jsonMatch[0]) as ExtractedTask[];
  } catch (e) {
    console.error('Failed to parse AI response JSON:', e);
    return [];
  }
}

// ─── Main Handler ───

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json();
    const {
      fireflies_transcript_id,
      transcript_text: providedTranscript,
      meeting_title: providedTitle,
    } = body;

    if (!fireflies_transcript_id && !providedTranscript) {
      return new Response(
        JSON.stringify({ error: 'fireflies_transcript_id or transcript_text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 1. Check for duplicate processing
    if (fireflies_transcript_id) {
      const { data: existing } = await supabase
        .from('standup_meetings')
        .select('id, processing_status')
        .eq('fireflies_transcript_id', fireflies_transcript_id)
        .maybeSingle();

      if (existing?.processing_status === 'completed') {
        return new Response(
          JSON.stringify({
            message: 'Transcript already processed',
            meeting_id: existing.id,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // 2. Fetch transcript from Fireflies if needed
    let transcriptText = providedTranscript || '';
    let meetingTitle = providedTitle || 'Daily Standup';
    let meetingDuration: number | null = null;
    let meetingDate = new Date().toISOString().split('T')[0];

    if (fireflies_transcript_id && !providedTranscript) {
      const ffKey = Deno.env.get('FIREFLIES_API_KEY');
      if (!ffKey) {
        return new Response(JSON.stringify({ error: 'FIREFLIES_API_KEY not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const transcript = await fetchFirefliesTranscript(fireflies_transcript_id, ffKey);
      if (!transcript) {
        return new Response(
          JSON.stringify({ error: 'Could not fetch transcript from Fireflies' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      transcriptText = transcript.transcript_text;
      meetingTitle = transcript.title;
      meetingDuration = Math.round(transcript.duration / 60);
      if (transcript.date) {
        meetingDate = new Date(transcript.date).toISOString().split('T')[0];
      }
    }

    // 3. Create or update standup meeting record
    const { data: meeting, error: meetingError } = await supabase
      .from('standup_meetings')
      .upsert(
        {
          fireflies_transcript_id: fireflies_transcript_id || `manual-${Date.now()}`,
          meeting_title: meetingTitle,
          meeting_date: meetingDate,
          meeting_duration_minutes: meetingDuration,
          transcript_text: transcriptText,
          processing_status: 'processing',
        },
        { onConflict: 'fireflies_transcript_id' },
      )
      .select('id')
      .single();

    if (meetingError) {
      throw new Error(`Failed to create meeting record: ${meetingError.message}`);
    }

    // 4. Fetch BD team members with aliases
    const { data: roles } = await supabase.rpc('get_all_user_roles');
    const teamRoles = (roles || []).filter((r: { role: string }) =>
      ['owner', 'admin', 'moderator'].includes(r.role),
    );

    const { data: aliases } = await supabase.from('bd_team_aliases').select('*');
    const aliasMap = new Map<string, string[]>();
    for (const a of aliases || []) {
      const existing = aliasMap.get(a.team_member_id) || [];
      existing.push(a.alias);
      aliasMap.set(a.team_member_id, existing);
    }

    const teamMembers = teamRoles.map(
      (r: { user_id: string; user_first_name: string; user_last_name: string }) => ({
        id: r.user_id,
        name: `${r.user_first_name || ''} ${r.user_last_name || ''}`.trim(),
        aliases: aliasMap.get(r.user_id) || [],
      }),
    );

    // 5. Extract tasks using AI
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      await supabase
        .from('standup_meetings')
        .update({
          processing_status: 'failed',
          processing_error: 'ANTHROPIC_API_KEY not configured',
        })
        .eq('id', meeting.id);
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const extractedTasks = await extractTasksFromTranscript(
      transcriptText,
      teamMembers,
      anthropicKey,
    );

    // 6. Match assignee names to team member IDs
    const tasks = extractedTasks.map((task) => {
      let assigneeId: string | null = null;
      let needsReview = false;

      if (task.assignee_name === 'Unassigned' || !task.assignee_name) {
        needsReview = true;
      } else {
        // Fuzzy match: check name and aliases
        const normalizedName = task.assignee_name.toLowerCase().trim();
        const match = teamMembers.find(
          (m: { id: string; name: string; aliases: string[] }) =>
            m.name.toLowerCase() === normalizedName ||
            m.name.toLowerCase().includes(normalizedName) ||
            normalizedName.includes(m.name.toLowerCase()) ||
            m.name
              .toLowerCase()
              .split(' ')
              .some((part: string) => part === normalizedName) ||
            m.aliases.some((a: string) => a.toLowerCase() === normalizedName),
        );

        if (match) {
          assigneeId = match.id;
        } else {
          needsReview = true;
        }
      }

      return {
        title: task.title,
        description: task.description || null,
        assignee_id: assigneeId || teamMembers[0]?.id, // fallback to first member
        task_type: task.task_type || 'other',
        status: 'pending' as const,
        due_date: task.due_date || meetingDate,
        source_meeting_id: meeting.id,
        source_timestamp: task.source_timestamp || null,
        deal_reference: task.deal_reference || null,
        extraction_confidence: task.confidence || 'medium',
        needs_review: needsReview,
        is_manual: false,
      };
    });

    // 7. Insert tasks
    if (tasks.length > 0) {
      const { error: insertError } = await supabase.from('daily_tasks').insert(tasks);

      if (insertError) {
        throw new Error(`Failed to insert tasks: ${insertError.message}`);
      }
    }

    // 8. Update meeting record with results
    const confidenceValues = extractedTasks.map((t) =>
      t.confidence === 'high' ? 100 : t.confidence === 'medium' ? 60 : 30,
    );
    const avgConfidence =
      confidenceValues.length > 0
        ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
        : 0;

    await supabase
      .from('standup_meetings')
      .update({
        tasks_extracted: tasks.length,
        tasks_unassigned: tasks.filter((t) => t.needs_review).length,
        extraction_confidence_avg: Math.round(avgConfidence * 10) / 10,
        processed_at: new Date().toISOString(),
        processing_status: 'completed',
      })
      .eq('id', meeting.id);

    // 9. Mark overdue tasks from previous days
    await supabase.rpc('mark_overdue_daily_tasks');

    return new Response(
      JSON.stringify({
        success: true,
        meeting_id: meeting.id,
        tasks_extracted: tasks.length,
        tasks_needing_review: tasks.filter((t) => t.needs_review).length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('process-standup-tasks error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
