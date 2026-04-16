/**
 * data-room-delete: Deletes a document from a deal's data room
 *
 * Admin-only. Routes deletion through the service role so admin-tier
 * permissions are checked once (via requireAdmin → is_admin RPC) rather
 * than enforced implicitly by storage + table RLS on the caller's JWT.
 *
 * The previous client-side flow called supabase.storage.remove + DELETE
 * directly from the browser, which required both the `storage.objects`
 * RLS policy and the `data_room_documents` RLS policy to recognize the
 * caller as admin via `is_admin(auth.uid())`. Any drift between those
 * checks and the edge-function admin check used for upload would let
 * an admin upload but silently fail to delete — the exact symptom
 * reported for the Net Conversion CIM.
 *
 * POST body (JSON):
 *   - document_id: UUID of the data_room_documents row to delete
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/auth.ts';

const BUCKET_NAME = 'deal-data-rooms';

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const auth = await requireAdmin(req, supabaseAdmin);
  if (!auth.isAdmin) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.authenticated ? 403 : 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: { document_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const documentId = body.document_id;
  if (!documentId) {
    return new Response(JSON.stringify({ error: 'document_id is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: doc, error: fetchError } = await supabaseAdmin
    .from('data_room_documents')
    .select('id, deal_id, file_name, file_type, file_size_bytes, folder_name, document_category, storage_path')
    .eq('id', documentId)
    .maybeSingle();

  if (fetchError) {
    console.error('Fetch document error:', fetchError);
    return new Response(JSON.stringify({ error: 'Failed to load document' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!doc) {
    return new Response(JSON.stringify({ error: 'Document not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (doc.storage_path) {
    const { error: storageError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove([doc.storage_path]);
    // Storage remove returns no error for missing files, but surface real failures.
    if (storageError) {
      console.error('Storage remove error:', storageError);
      return new Response(JSON.stringify({ error: 'Failed to remove file from storage' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const { error: deleteError } = await supabaseAdmin
    .from('data_room_documents')
    .delete()
    .eq('id', documentId);

  if (deleteError) {
    console.error('Delete document error:', deleteError);
    return new Response(JSON.stringify({ error: 'Failed to delete document record' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await supabaseAdmin.rpc('log_data_room_event', {
    p_deal_id: doc.deal_id,
    p_user_id: auth.userId,
    p_action: 'delete_document',
    p_document_id: doc.id,
    p_metadata: {
      file_name: doc.file_name,
      file_type: doc.file_type,
      file_size_bytes: doc.file_size_bytes,
      folder_name: doc.folder_name,
      document_category: doc.document_category,
    },
    p_ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    p_user_agent: req.headers.get('user-agent') || null,
  });

  return new Response(JSON.stringify({ success: true, deal_id: doc.deal_id }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
