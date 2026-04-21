import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import {
  GEMINI_API_URL,
  getGeminiHeaders,
  getGeminiApiKey,
  DEFAULT_GEMINI_MODEL,
} from '../_shared/ai-providers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const body = await req.json();
    const {
      // Legacy: call_scores row
      call_score_id,
      // New: contact_activities row (PhoneBurner call attributed to a valuation lead)
      contact_activity_id,
      composite_score,
      opener_tone,
      call_structure,
      discovery_quality,
      objection_handling,
      closing_next_step,
      value_proposition,
      disposition,
    } = body ?? {};

    if (!call_score_id && !contact_activity_id) {
      return new Response(
        JSON.stringify({ error: 'call_score_id or contact_activity_id required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ─── Branch: contact_activities (preferred for valuation-lead call summaries) ───
    if (contact_activity_id) {
      const { data: activity, error: fetchErr } = await supabase
        .from('contact_activities')
        .select(
          'id, ai_summary, call_transcript, call_outcome, disposition_label, call_duration_seconds, talk_time_seconds, user_name, contact_email',
        )
        .eq('id', contact_activity_id)
        .maybeSingle();

      if (fetchErr) {
        console.error('contact_activities fetch error:', fetchErr);
        return new Response(JSON.stringify({ error: 'Activity fetch failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (activity?.ai_summary) {
        return new Response(JSON.stringify({ summary: activity.ai_summary, cached: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const transcript = (activity?.call_transcript || '').trim();
      const dispoLabel =
        activity?.disposition_label || activity?.call_outcome || disposition || 'Unknown';
      const rep = activity?.user_name || 'the rep';
      const dur = activity?.call_duration_seconds || 0;
      const talk = activity?.talk_time_seconds || 0;

      if (!transcript) {
        return new Response(
          JSON.stringify({ summary: null, error: 'No transcript available for this call.' }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const geminiKey = getGeminiApiKey();
      if (!geminiKey) {
        return new Response(
          JSON.stringify({ error: 'OPENROUTER_API_KEY/GEMINI_API_KEY not configured' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const truncated = transcript.length > 8000 ? transcript.slice(0, 8000) + '…' : transcript;
      const prompt = `Summarize this sales cold-call transcript in 2–3 short sentences (under 60 words total). Focus on: what was discussed, the prospect's reaction/interest, and any committed next step. Be specific and direct — no fluff.

Rep: ${rep}
Disposition: ${dispoLabel}
Duration: ${dur}s (talk ${talk}s)

Transcript:
${truncated}`;

      const geminiRes = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: getGeminiHeaders(geminiKey),
        body: JSON.stringify({
          model: DEFAULT_GEMINI_MODEL,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 180,
          temperature: 0.3,
        }),
      });

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        console.error('Gemini API error:', errText);
        return new Response(JSON.stringify({ error: 'Gemini API error', details: errText }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const geminiData = await geminiRes.json();
      const summary = geminiData?.choices?.[0]?.message?.content?.trim() || null;

      if (summary) {
        await supabase
          .from('contact_activities')
          .update({ ai_summary: summary })
          .eq('id', contact_activity_id);
      }

      return new Response(JSON.stringify({ summary }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── Legacy branch: call_scores row ───
    const { data: existing } = await supabase
      .from('call_scores')
      .select('ai_summary')
      .eq('id', call_score_id)
      .single();

    if (existing?.ai_summary) {
      return new Response(JSON.stringify({ summary: existing.ai_summary, cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiKey = getGeminiApiKey();
    if (!geminiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENROUTER_API_KEY/GEMINI_API_KEY not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const prompt = `In one sentence of 20 words or fewer, explain why this cold call scored ${composite_score}/10. Scores by dimension — Opener & Tone: ${opener_tone ?? 'N/A'}, Call Structure: ${call_structure ?? 'N/A'}, Discovery Quality: ${discovery_quality ?? 'N/A'}, Objection Handling: ${objection_handling ?? 'N/A'}, Closing / Next Step: ${closing_next_step ?? 'N/A'}, Value Proposition: ${value_proposition ?? 'N/A'}. Call outcome: ${disposition ?? 'Unknown'}. Be specific and direct.`;

    const geminiRes = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: getGeminiHeaders(geminiKey),
      body: JSON.stringify({
        model: DEFAULT_GEMINI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 60,
        temperature: 0.3,
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', errText);
      return new Response(JSON.stringify({ error: 'Gemini API error', details: errText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiData = await geminiRes.json();
    const summary = geminiData?.choices?.[0]?.message?.content?.trim() || null;

    if (summary) {
      await supabase.from('call_scores').update({ ai_summary: summary }).eq('id', call_score_id);
    }

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('generate-call-summary error:', err);
    return new Response(JSON.stringify({ error: 'Internal error', message: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
