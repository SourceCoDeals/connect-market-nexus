/**
 * archive-call-recording
 *
 * Downloads a PhoneBurner recording URL (which expires per PB's retention
 * window) and uploads it to the private `call-recordings` Supabase Storage
 * bucket so pipeline reviews and compliance exports don't 404 once PB rolls
 * the link.
 *
 * Invocation modes:
 *   1. Per-activity:  { activity_id: UUID }
 *      Used by phoneburner-webhook on call_end events.
 *
 *   2. Bulk backfill: { bulk: true, limit?: number }
 *      Scans contact_activities WHERE source_system='phoneburner'
 *        AND recording_url IS NOT NULL
 *        AND recording_storage_path IS NULL
 *      and archives the most recent N (default 50, cap 500). Cron-safe.
 *
 * Resilience:
 *   - The downloaded audio is streamed straight through to the bucket. We
 *     don't hold it in memory beyond the fetch/upload round-trip, so this
 *     works for typical 1–10 MB call recordings (PB's default cap). Larger
 *     uploads would need chunked multipart — not today's problem.
 *   - If PB's URL already 404s (recording past its expiry), we stamp
 *     recording_archived_at = NULL with a marker note and move on; failure
 *     is non-fatal per activity.
 *   - Idempotent: already-archived rows are skipped via the same NULL-check
 *     used to select them.
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isAuthorizedCronRequest } from '../_shared/outreach-match.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve: (h: (req: Request) => Response | Promise<Response>) => void;
};

interface ReqBody {
  activity_id?: string;
  bulk?: boolean;
  limit?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  if (!isAuthorizedCronRequest(req)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  let body: ReqBody = {};
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    // defaults
  }

  // Mode 1: single activity
  if (body.activity_id) {
    const result = await archiveOne(supabase, body.activity_id);
    return new Response(JSON.stringify({ ok: result.ok, ...result }), {
      status: result.ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Mode 2: bulk backfill
  if (body.bulk) {
    const limit = Math.min(Math.max(body.limit || 50, 1), 500);
    const { data: rows, error } = await supabase
      .from('contact_activities')
      .select('id')
      .eq('source_system', 'phoneburner')
      .not('recording_url', 'is', null)
      .is('recording_storage_path', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return new Response(JSON.stringify({ error: 'load_failed', detail: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const summaries = [];
    for (const r of (rows || []) as { id: string }[]) {
      summaries.push(await archiveOne(supabase, r.id));
    }
    const ok = summaries.filter((s) => s.ok).length;
    return new Response(
      JSON.stringify({
        ok: true,
        mode: 'bulk',
        scanned: summaries.length,
        archived: ok,
        errors: summaries.length - ok,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify({ error: 'activity_id or bulk required' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
});

async function archiveOne(
  supabase: SupabaseClient,
  activityId: string,
): Promise<{ ok: boolean; activity_id: string; path?: string; reason?: string }> {
  const { data: activity, error: loadErr } = await supabase
    .from('contact_activities')
    .select('id, recording_url, recording_url_public, recording_storage_path, phoneburner_call_id')
    .eq('id', activityId)
    .maybeSingle();

  if (loadErr || !activity) {
    return { ok: false, activity_id: activityId, reason: loadErr?.message ?? 'not_found' };
  }

  if (activity.recording_storage_path) {
    return {
      ok: true,
      activity_id: activityId,
      path: activity.recording_storage_path,
      reason: 'already_archived',
    };
  }

  const sourceUrl = (activity.recording_url_public || activity.recording_url) as string | null;
  if (!sourceUrl) {
    return { ok: false, activity_id: activityId, reason: 'no_recording_url' };
  }

  // Download the recording. Fetch errors are surfaced up but don't throw —
  // most often this is a 404 on an already-expired URL, which is what the
  // archive is meant to protect against but can't retroactively recover.
  let audioResp: Response;
  try {
    audioResp = await fetch(sourceUrl);
  } catch (err) {
    return {
      ok: false,
      activity_id: activityId,
      reason: `fetch_error:${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (!audioResp.ok) {
    return { ok: false, activity_id: activityId, reason: `fetch_status:${audioResp.status}` };
  }
  const audioBuf = await audioResp.arrayBuffer();
  if (audioBuf.byteLength === 0) {
    return { ok: false, activity_id: activityId, reason: 'empty_body' };
  }

  // Path shape: YYYY/MM/<call_id or activity_id>.mp3 — partitions by month
  // so bucket listings stay paginatable long-term. Extension defaults to
  // mp3 (PB's default); adjust from Content-Type if something else shows up.
  const contentType = audioResp.headers.get('content-type') || 'audio/mpeg';
  const ext =
    contentType.includes('mpeg') || contentType.includes('mp3')
      ? 'mp3'
      : contentType.includes('wav')
        ? 'wav'
        : contentType.includes('mp4') || contentType.includes('m4a')
          ? 'm4a'
          : 'bin';
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const fileKey = activity.phoneburner_call_id || activity.id;
  const storagePath = `${yyyy}/${mm}/${fileKey}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('call-recordings')
    .upload(storagePath, audioBuf, {
      contentType,
      upsert: true,
    });

  if (uploadErr) {
    return { ok: false, activity_id: activityId, reason: `upload_error:${uploadErr.message}` };
  }

  const { error: updateErr } = await supabase
    .from('contact_activities')
    .update({
      recording_storage_path: storagePath,
      recording_archived_at: new Date().toISOString(),
    })
    .eq('id', activityId);

  if (updateErr) {
    return { ok: false, activity_id: activityId, reason: `db_update_error:${updateErr.message}` };
  }

  return { ok: true, activity_id: activityId, path: storagePath };
}
