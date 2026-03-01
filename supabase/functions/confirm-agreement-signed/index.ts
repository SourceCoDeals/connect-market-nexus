import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';

/**
 * confirm-agreement-signed
 *
 * Called by the frontend right after the DocuSeal onCompleted callback fires.
 * Checks DocuSeal API for actual completion status and immediately:
 *   - Updates firm_agreements (signed = true, document URL)
 *   - Syncs to profiles for all firm members
 *   - Creates user_notifications (agreement_signed)
 *   - Posts system messages in connection_messages threads
 *   - Creates admin_notifications
 *
 * This ensures the DB is updated before the frontend refetches cached data,
 * eliminating the dependency on the async webhook for immediate UX updates.
 */

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.userId) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const userId = auth.userId;

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const documentType: string = body.documentType; // 'nda' or 'fee_agreement'
    if (documentType !== 'nda' && documentType !== 'fee_agreement') {
      return new Response(
        JSON.stringify({ error: 'Invalid documentType. Must be "nda" or "fee_agreement".' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    const isNda = documentType === 'nda';
    const docLabel = isNda ? 'NDA' : 'Fee Agreement';

    // Get buyer's firm membership
    const { data: membership } = await supabaseAdmin
      .from('firm_members')
      .select('firm_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: 'No firm found', confirmed: false }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    const firmId = membership.firm_id;

    // Get firm agreement
    const signedCol = isNda ? 'nda_signed' : 'fee_agreement_signed';
    const submissionCol = isNda ? 'nda_docuseal_submission_id' : 'fee_docuseal_submission_id';
    const { data: firm } = await supabaseAdmin
      .from('firm_agreements')
      .select(`id, firm_name, ${signedCol}, ${submissionCol}`)
      .eq('id', firmId)
      .single();

    if (!firm) {
      return new Response(
        JSON.stringify({ error: 'Firm agreement not found', confirmed: false }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    // If already marked signed in DB, return immediately
    if (firm[signedCol]) {
      // Fetch document URL to return
      const docUrlCol = isNda ? 'nda_signed_document_url' : 'fee_signed_document_url';
      const { data: docData } = await supabaseAdmin
        .from('firm_agreements')
        .select(docUrlCol)
        .eq('id', firmId)
        .single();
      return new Response(
        JSON.stringify({ confirmed: true, alreadySigned: true, signedDocumentUrl: docData?.[docUrlCol] || null }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    const submissionId = firm[submissionCol];
    if (!submissionId) {
      return new Response(
        JSON.stringify({ confirmed: false, error: 'No submission found' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    // Check DocuSeal API for actual submission status
    const docusealApiKey = Deno.env.get('DOCUSEAL_API_KEY');
    if (!docusealApiKey) {
      return new Response(
        JSON.stringify({ error: 'DocuSeal not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    const fetchController = new AbortController();
    const fetchTimeout = setTimeout(() => fetchController.abort(), 15000);
    let submitterRes: Response;
    try {
      submitterRes = await fetch(
        `https://api.docuseal.com/submitters?submission_id=${submissionId}`,
        {
          headers: { 'X-Auth-Token': docusealApiKey },
          signal: fetchController.signal,
        },
      );
    } finally {
      clearTimeout(fetchTimeout);
    }

    if (!submitterRes.ok) {
      const errText = await submitterRes.text();
      console.error('DocuSeal API error:', submitterRes.status, errText);
      return new Response(
        JSON.stringify({ confirmed: false, error: 'Failed to verify signing status' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    const submitters = await submitterRes.json();
    const data = Array.isArray(submitters?.data) ? submitters.data : Array.isArray(submitters) ? submitters : [];

    // Get buyer's email for matching
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();
    const submitter = data.find((s: any) => s.email === profile?.email) || data[0];

    if (!submitter || submitter.status !== 'completed') {
      return new Response(
        JSON.stringify({ confirmed: false, status: submitter?.status || 'unknown' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    // ─── DocuSeal confirmed completed — update everything ───

    const now = new Date().toISOString();
    const rawSignedDocUrl = submitter.documents?.[0]?.url || null;
    const signedDocUrl = rawSignedDocUrl && rawSignedDocUrl.startsWith('https://') ? rawSignedDocUrl : null;
    const firmName = firm.firm_name || 'Unknown Firm';

    // 1. Update firm_agreements
    const updates: Record<string, unknown> = { updated_at: now };
    if (isNda) {
      updates.nda_signed = true;
      updates.nda_signed_at = now;
      updates.nda_docuseal_status = 'completed';
      updates.nda_status = 'signed';
      if (signedDocUrl) {
        updates.nda_signed_document_url = signedDocUrl;
        updates.nda_document_url = signedDocUrl;
      }
    } else {
      updates.fee_agreement_signed = true;
      updates.fee_agreement_signed_at = now;
      updates.fee_docuseal_status = 'completed';
      updates.fee_agreement_status = 'signed';
      if (signedDocUrl) {
        updates.fee_signed_document_url = signedDocUrl;
        updates.fee_agreement_document_url = signedDocUrl;
      }
    }

    await supabaseAdmin
      .from('firm_agreements')
      .update(updates)
      .eq('id', firmId);

    // Write to webhook log for deduplication with the webhook handler.
    // If the webhook already processed this event, the unique constraint will
    // cause a conflict — we ignore it since the DB is already up to date.
    await supabaseAdmin.from('docuseal_webhook_log').insert({
      event_type: 'form.completed',
      submission_id: String(submissionId),
      external_id: firmId,
      raw_payload: { confirmed_by_frontend: userId, document_type: documentType },
      processed_at: now,
    }).then(({ error: logErr }: { error: any }) => {
      if (logErr && logErr.code !== '23505') {
        console.warn('Failed to write dedup log entry:', logErr);
      }
    });

    // 2. Sync to profiles for all firm members
    const { data: members } = await supabaseAdmin
      .from('firm_members')
      .select('user_id')
      .eq('firm_id', firmId);

    if (members?.length) {
      const profileUpdates = isNda
        ? { nda_signed: true, nda_signed_at: now, updated_at: now }
        : { fee_agreement_signed: true, fee_agreement_signed_at: now, updated_at: now };

      for (const member of members) {
        await supabaseAdmin
          .from('profiles')
          .update(profileUpdates)
          .eq('id', member.user_id);
      }

      // 3. Create user_notifications + system messages
      await sendBuyerSignedDocNotification(supabaseAdmin, members, firmId, docLabel, signedDocUrl);
    }

    // 4. Create admin notifications
    await createAdminNotification(supabaseAdmin, firmId, firmName, docLabel);

    console.log(`✅ Confirmed ${docLabel} signed for firm ${firmId} (buyer ${userId})`);

    return new Response(
      JSON.stringify({ confirmed: true, signedDocumentUrl: signedDocUrl }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  } catch (error: unknown) {
    console.error('Error in confirm-agreement-signed:', error instanceof Error ? error.message : String(error));
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  }
});

/**
 * Send buyer notification + system messages (same pattern as webhook handler).
 */
async function sendBuyerSignedDocNotification(
  supabase: any,
  members: { user_id: string }[],
  firmId: string,
  docLabel: string,
  signedDocUrl: string | null,
) {
  try {
    const downloadNote = signedDocUrl
      ? `You can download your signed copy from your Profile → Documents tab, or use this link: ${signedDocUrl}`
      : `You can view your signed documents in your Profile → Documents tab.`;

    const docType = docLabel.toLowerCase().replace(/ /g, '_');

    for (const member of members) {
      // Dedup: skip if notification already exists within 5 min window
      const { data: existingNotif } = await supabase
        .from('user_notifications')
        .select('id')
        .eq('user_id', member.user_id)
        .eq('notification_type', 'agreement_signed')
        .eq('title', `${docLabel} Signed Successfully`)
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .limit(1)
        .maybeSingle();

      if (!existingNotif) {
        await supabase.from('user_notifications').insert({
          user_id: member.user_id,
          notification_type: 'agreement_signed',
          title: `${docLabel} Signed Successfully`,
          message: `Your ${docLabel} has been signed and recorded. ${downloadNote}`,
          metadata: {
            firm_id: firmId,
            document_type: docType,
            signed_document_url: signedDocUrl || null,
          },
        });
      }

      // System messages — only to General Inquiry (first active request), dedup by checking for recent system message
      const { data: generalRequest } = await supabase
        .from('connection_requests')
        .select('id')
        .eq('user_id', member.user_id)
        .in('status', ['approved', 'pending', 'on_hold'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (generalRequest) {
        const messageBody = signedDocUrl
          ? `✅ Your ${docLabel} has been signed successfully. For your compliance records, you can download the signed copy here: ${signedDocUrl}\n\nA copy is also permanently available in your Profile → Documents tab.`
          : `✅ Your ${docLabel} has been signed successfully. A copy is available in your Profile → Documents tab.`;

        const { data: existingMsg } = await supabase
          .from('connection_messages')
          .select('id')
          .eq('connection_request_id', generalRequest.id)
          .eq('message_type', 'system')
          .ilike('body', `%Your ${docLabel} has been signed%`)
          .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .limit(1)
          .maybeSingle();

        if (!existingMsg) {
          await supabase.from('connection_messages').insert({
            connection_request_id: generalRequest.id,
            sender_role: 'admin',
            sender_id: null,
            body: messageBody,
            message_type: 'system',
            is_read_by_admin: true,
            is_read_by_buyer: false,
          });
        }
      }
    }
    console.log(`📨 Sent signed doc notifications to ${members.length} buyer(s) for ${docLabel}`);
  } catch (err) {
    console.error('Buyer notification error:', err);
  }
}

/**
 * Create admin_notifications for all admins.
 */
async function createAdminNotification(
  supabase: any,
  firmId: string,
  firmName: string,
  docLabel: string,
) {
  try {
    // Query user_roles table (not profiles.role) for admin/owner users
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'owner']);

    const admins = adminRoles?.map((r: any) => ({ id: r.user_id })) || [];

    if (!admins?.length) return;

    const notifications = admins.map((admin: any) => ({
      admin_id: admin.id,
      title: `${docLabel} Signed`,
      message: `${firmName} has signed the ${docLabel}.`,
      notification_type: 'document_completed',
      metadata: { firm_id: firmId, document_type: docLabel.toLowerCase().replace(/ /g, '_'), docuseal_status: 'completed' },
      is_read: false,
    }));

    await supabase.from('admin_notifications').insert(notifications);
  } catch (err) {
    console.error('Admin notification error:', err);
  }
}
