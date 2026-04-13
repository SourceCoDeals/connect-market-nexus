/**
 * outlook-sync-emails: Syncs emails from Microsoft Graph to the platform.
 *
 * Modes:
 *   1. Initial sync (isInitialSync=true): Pull `initialLookbackDays` of
 *      email history (default 90 days). Callers can override
 *      `initialLookbackDays` up to 3650 (≈10 years) for deeper historical
 *      backfills triggered from the Outlook settings page.
 *   2. Polling sync: Fetch recent emails since last sync (fallback for webhooks).
 *
 * Emails whose participants match a known contact are written to
 * `email_messages` and linked to the appropriate deal. Emails whose
 * participants do NOT match any known contact are persisted to
 * `outlook_unmatched_emails` so they can be retro-linked when a matching
 * contact is added later.
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response-helpers.ts';
import { requireServiceRole } from '../_shared/auth.ts';

interface GraphMessage {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview: string;
  body: { contentType: string; content: string };
  from: { emailAddress: { address: string; name: string } };
  toRecipients: { emailAddress: { address: string; name: string } }[];
  ccRecipients: { emailAddress: { address: string; name: string } }[];
  sentDateTime: string;
  receivedDateTime: string;
  hasAttachments: boolean;
  attachments?: { name: string; size: number; contentType: string }[];
}

interface ContactMatch {
  id: string;
  email: string;
  /** deal_pipeline.id — the CRM deal this contact is attached to, if any. */
  deal_id?: string | null;
  /** listings.id — seller-contact convenience link (kept for downstream UI). */
  listing_id?: string | null;
}

const DEFAULT_INITIAL_LOOKBACK_DAYS = 90;
const MAX_INITIAL_LOOKBACK_DAYS = 3650; // ~10 years
const MAX_INITIAL_PAGES = 400; // 50 messages/page → up to 20k emails per backfill

import { decryptToken, encryptToken, refreshAccessToken } from '../_shared/microsoft-tokens.ts';

async function fetchMessages(
  accessToken: string,
  since?: string,
  nextLink?: string,
  retryCount = 0,
): Promise<{ messages: GraphMessage[]; nextLink?: string }> {
  const MAX_RETRIES = 3;
  let url = nextLink;

  if (!url) {
    const params = new URLSearchParams({
      $top: '50',
      $orderby: 'sentDateTime desc',
      $select:
        'id,conversationId,subject,bodyPreview,body,from,toRecipients,ccRecipients,sentDateTime,receivedDateTime,hasAttachments',
    });

    if (since) {
      params.set('$filter', `sentDateTime ge ${since}`);
    }

    url = `https://graph.microsoft.com/v1.0/me/messages?${params.toString()}`;
  }

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (resp.status === 429) {
    if (retryCount >= MAX_RETRIES) {
      throw new Error(`Graph API rate limited after ${MAX_RETRIES} retries`);
    }
    // Exponential backoff with jitter
    const retryAfter = parseInt(resp.headers.get('Retry-After') || '5', 10);
    const jitter = Math.random() * 1000;
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000 + jitter));
    return fetchMessages(accessToken, since, nextLink, retryCount + 1);
  }

  if (!resp.ok) {
    throw new Error(`Graph messages fetch failed: ${resp.status}`);
  }

  const data = await resp.json();
  return {
    messages: data.value || [],
    nextLink: data['@odata.nextLink'],
  };
}

async function fetchAttachmentMetadata(
  accessToken: string,
  messageId: string,
): Promise<{ name: string; size: number; contentType: string }[]> {
  try {
    const resp = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments?$select=name,size,contentType`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.value || []).map((a: { name: string; size: number; contentType: string }) => ({
      name: a.name,
      size: a.size,
      contentType: a.contentType,
    }));
  } catch {
    return [];
  }
}

async function loadKnownContactEmails(
  supabase: SupabaseClient,
): Promise<Map<string, ContactMatch>> {
  const emailMap = new Map<string, ContactMatch>();

  // Load from unified contacts table (include listing_id for deal resolution)
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, listing_id')
    .not('email', 'is', null)
    .eq('archived', false);

  if (contacts) {
    for (const c of contacts) {
      if (c.email) {
        emailMap.set(c.email.toLowerCase(), {
          id: c.id,
          email: c.email,
          listing_id: c.listing_id || null,
          deal_id: null,
        });
      }
    }
  }

  // Batch-resolve listing_id → deal_pipeline.id for remarketing deals
  const listingIds = [
    ...new Set([...emailMap.values()].map((c) => c.listing_id).filter(Boolean)),
  ] as string[];
  if (listingIds.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < listingIds.length; i += chunkSize) {
      const chunk = listingIds.slice(i, i + chunkSize);
      const { data: pipelineDeals } = await supabase
        .from('deal_pipeline')
        .select('id, listing_id')
        .in('listing_id', chunk)
        .is('deleted_at', null);
      const listingDealMap = new Map<string, string>();
      for (const d of pipelineDeals || []) {
        if (d.listing_id) listingDealMap.set(d.listing_id, d.id);
      }
      for (const [, match] of emailMap) {
        if (match.listing_id && !match.deal_id) {
          match.deal_id = listingDealMap.get(match.listing_id) || null;
        }
      }
    }
  }

  // Look up deal associations for contacts via buyer_contact_id / seller_contact_id
  // on `deal_pipeline` (renamed from `deals` in 20260506000000). We exclude
  // soft-deleted deals via `deleted_at IS NULL` — `deal_pipeline` has no
  // `stage` text column; stage is an FK to `deal_stages`, so the previous
  // `.not('stage', 'in', '(...)')` filter was also broken.
  const contactById = new Map<string, ContactMatch>();
  for (const c of emailMap.values()) contactById.set(c.id, c);

  const contactIds = Array.from(contactById.keys());
  if (contactIds.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < contactIds.length; i += chunkSize) {
      const chunk = contactIds.slice(i, i + chunkSize);

      const { data: buyerDeals, error: buyerErr } = await supabase
        .from('deal_pipeline')
        .select('id, buyer_contact_id, updated_at')
        .in('buyer_contact_id', chunk)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (buyerErr) {
        console.error('[outlook-sync] deal_pipeline buyer lookup failed:', buyerErr.message);
      } else {
        for (const d of buyerDeals || []) {
          if (!d.buyer_contact_id) continue;
          const contact = contactById.get(d.buyer_contact_id);
          // First match wins (we sorted by updated_at desc → most recent deal).
          if (contact && !contact.deal_id) contact.deal_id = d.id;
        }
      }

      const { data: sellerDeals, error: sellerErr } = await supabase
        .from('deal_pipeline')
        .select('id, seller_contact_id, updated_at')
        .in('seller_contact_id', chunk)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (sellerErr) {
        console.error('[outlook-sync] deal_pipeline seller lookup failed:', sellerErr.message);
      } else {
        for (const d of sellerDeals || []) {
          if (!d.seller_contact_id) continue;
          const contact = contactById.get(d.seller_contact_id);
          if (contact && !contact.deal_id) contact.deal_id = d.id;
        }
      }
    }
  }

  return emailMap;
}

function matchEmailToContacts(
  message: GraphMessage,
  contactEmails: Map<string, ContactMatch>,
  userEmail: string,
): { contacts: ContactMatch[]; direction: 'inbound' | 'outbound' } {
  const fromAddress = message.from?.emailAddress?.address?.toLowerCase() || '';
  const toAddresses = (message.toRecipients || []).map((r) =>
    r.emailAddress?.address?.toLowerCase(),
  );
  const ccAddresses = (message.ccRecipients || []).map((r) =>
    r.emailAddress?.address?.toLowerCase(),
  );

  const allAddresses = [fromAddress, ...toAddresses, ...ccAddresses];
  const isOutbound = fromAddress === userEmail.toLowerCase();

  const matchedContacts: ContactMatch[] = [];
  for (const addr of allAddresses) {
    if (addr && addr !== userEmail.toLowerCase()) {
      const match = contactEmails.get(addr);
      if (match) matchedContacts.push(match);
    }
  }

  return {
    contacts: matchedContacts,
    direction: isOutbound ? 'outbound' : 'inbound',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, corsHeaders);
  }

  let body: {
    userId?: string;
    accessToken?: string;
    isInitialSync?: boolean;
    /** How many days back to pull on an initial sync. Default 90. Max 3650. */
    initialLookbackDays?: number;
  };
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid request body', 400, corsHeaders);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // If called from polling (no accessToken provided), process all active connections
  if (!body.userId && !body.accessToken) {
    // Polling mode is only for service role (pg_cron scheduler or internal webhook trigger)
    const authCheck = requireServiceRole(req);
    if (!authCheck.authorized) {
      return errorResponse(authCheck.error || 'Unauthorized', 403, corsHeaders);
    }

    // Only poll connections that have completed initial sync
    const { data: connections } = await supabase
      .from('email_connections')
      .select('*')
      .eq('status', 'active')
      .eq('initial_sync_complete', true);

    if (!connections || connections.length === 0) {
      return successResponse({ message: 'No active connections to sync' }, corsHeaders);
    }

    const results: { userId: string; synced: number; errors: string[] }[] = [];

    for (const conn of connections) {
      try {
        const refreshToken = await decryptToken(conn.encrypted_refresh_token);
        const tokenResult = await refreshAccessToken(refreshToken);

        if (!tokenResult) {
          // Track consecutive failures
          const newErrorCount = (conn.last_sync_error_count || 0) + 1;
          const updates: Record<string, unknown> = {
            last_sync_error_count: newErrorCount,
            error_message: 'Token refresh failed during polling sync',
          };

          if (newErrorCount >= 3) {
            updates.status = 'error';
            updates.error_message = 'Token refresh failed 3 consecutive times';
          }

          await supabase.from('email_connections').update(updates).eq('id', conn.id);

          results.push({
            userId: conn.sourceco_user_id,
            synced: 0,
            errors: ['Token refresh failed'],
          });
          continue;
        }

        // Update stored refresh token if it changed
        if (tokenResult.newRefreshToken !== refreshToken) {
          await supabase
            .from('email_connections')
            .update({
              encrypted_refresh_token: await encryptToken(tokenResult.newRefreshToken),
              token_expires_at: new Date(Date.now() + tokenResult.expiresIn * 1000).toISOString(),
            })
            .eq('id', conn.id);
        }

        // Sync since last sync
        const since = conn.last_sync_at || new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const syncResult = await syncEmails(
          supabase,
          tokenResult.accessToken,
          conn.sourceco_user_id,
          conn.email_address,
          since,
          false,
        );

        await supabase
          .from('email_connections')
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_error_count: 0,
            error_message: null,
          })
          .eq('id', conn.id);

        results.push({
          userId: conn.sourceco_user_id,
          synced: syncResult.synced,
          errors: syncResult.errors,
        });
      } catch (err) {
        console.error(`Sync failed for user ${conn.sourceco_user_id}:`, err);
        results.push({
          userId: conn.sourceco_user_id,
          synced: 0,
          errors: [(err as Error).message],
        });
      }
    }

    return successResponse({ results }, corsHeaders);
  }

  // Single user sync (called from callback or webhook trigger, both use service role key)
  const authCheck = requireServiceRole(req);
  if (!authCheck.authorized) {
    return errorResponse(authCheck.error || 'Unauthorized', 403, corsHeaders);
  }

  const userId = body.userId!;
  let accessToken = body.accessToken;

  if (!accessToken) {
    // Need to get an access token from the stored refresh token
    const { data: conn } = await supabase
      .from('email_connections')
      .select('*')
      .eq('sourceco_user_id', userId)
      .eq('status', 'active')
      .single();

    if (!conn) {
      return errorResponse('No active connection found', 404, corsHeaders);
    }

    const refreshToken = await decryptToken(conn.encrypted_refresh_token);
    const tokenResult = await refreshAccessToken(refreshToken);
    if (!tokenResult) {
      return errorResponse('Failed to refresh access token', 500, corsHeaders);
    }
    accessToken = tokenResult.accessToken;
  }

  // Get connection info
  const { data: connection } = await supabase
    .from('email_connections')
    .select('email_address')
    .eq('sourceco_user_id', userId)
    .single();

  if (!connection) {
    return errorResponse('Connection not found', 404, corsHeaders);
  }

  const requestedLookback = Math.max(
    1,
    Math.min(body.initialLookbackDays || DEFAULT_INITIAL_LOOKBACK_DAYS, MAX_INITIAL_LOOKBACK_DAYS),
  );
  const since = body.isInitialSync
    ? new Date(Date.now() - requestedLookback * 24 * 60 * 60 * 1000).toISOString()
    : undefined;

  const result = await syncEmails(
    supabase,
    accessToken,
    userId,
    connection.email_address,
    since,
    body.isInitialSync || false,
  );

  // Update last sync timestamp (and mark initial sync complete if applicable)
  const syncUpdate: Record<string, unknown> = {
    last_sync_at: new Date().toISOString(),
    last_sync_error_count: 0,
    error_message: null,
  };
  if (body.isInitialSync) {
    syncUpdate.initial_sync_complete = true;
  }

  await supabase.from('email_connections').update(syncUpdate).eq('sourceco_user_id', userId);

  return successResponse(result, corsHeaders);
});

async function syncEmails(
  supabase: SupabaseClient,
  accessToken: string,
  userId: string,
  userEmail: string,
  since?: string,
  isInitial = false,
): Promise<{ synced: number; skipped: number; queuedUnmatched: number; errors: string[] }> {
  const contactEmails = await loadKnownContactEmails(supabase);
  let synced = 0;
  let skipped = 0;
  let queuedUnmatched = 0;
  const errors: string[] = [];
  let nextLink: string | undefined;
  let pageCount = 0;
  const maxPages = isInitial ? MAX_INITIAL_PAGES : 10; // Deep backfill for initial, bounded for polling

  do {
    try {
      const result = await fetchMessages(accessToken, since, nextLink);
      nextLink = result.nextLink;

      for (const msg of result.messages) {
        try {
          // Check if this was sent via the platform (has a placeholder ID).
          // Match by sender + contact + approximate timestamp to upgrade the record.
          const fromAddr = msg.from?.emailAddress?.address?.toLowerCase() || '';
          if (fromAddr === userEmail.toLowerCase()) {
            const msgSentAt = msg.sentDateTime || msg.receivedDateTime;
            const sentWindow = new Date(new Date(msgSentAt).getTime() - 60_000).toISOString();
            const sentWindowEnd = new Date(new Date(msgSentAt).getTime() + 60_000).toISOString();

            const { data: platformSent } = await supabase
              .from('email_messages')
              .select('id, microsoft_message_id')
              .like('microsoft_message_id', 'platform_sent_%')
              .eq('sourceco_user_id', userId)
              .eq('from_address', fromAddr)
              .gte('sent_at', sentWindow)
              .lte('sent_at', sentWindowEnd)
              .limit(1)
              .maybeSingle();

            if (platformSent) {
              // Upgrade the placeholder record with real Graph IDs
              await supabase
                .from('email_messages')
                .update({
                  microsoft_message_id: msg.id,
                  microsoft_conversation_id: msg.conversationId,
                })
                .eq('id', platformSent.id);
              skipped++;
              continue;
            }
          }

          // Match to known contacts
          const match = matchEmailToContacts(msg, contactEmails, userEmail);

          // Fetch attachment metadata once regardless of matched/unmatched — we
          // want the queued unmatched rows to retain the same fidelity so they
          // can be promoted faithfully later.
          let attachmentMeta: { name: string; size: number; contentType: string }[] = [];
          if (msg.hasAttachments) {
            attachmentMeta = await fetchAttachmentMetadata(accessToken, msg.id);
          }

          if (match.contacts.length === 0) {
            // Persist to the unmatched queue so a future contact insert can
            // retro-link this email via the `rematch_unmatched_outlook_emails`
            // RPC / the `trg_contacts_rematch_outlook` trigger.
            const fromAddr = msg.from?.emailAddress?.address?.toLowerCase() || '';
            const toAddrs = (msg.toRecipients || [])
              .map((r) => r.emailAddress?.address?.toLowerCase())
              .filter(Boolean) as string[];
            const ccAddrs = (msg.ccRecipients || [])
              .map((r) => r.emailAddress?.address?.toLowerCase())
              .filter(Boolean) as string[];

            const participantEmails = Array.from(
              new Set(
                [fromAddr, ...toAddrs, ...ccAddrs].filter(
                  (addr): addr is string => !!addr && addr !== userEmail.toLowerCase(),
                ),
              ),
            );

            // If nobody besides the mailbox owner was on the message, there is
            // nothing worth queueing — skip outright.
            if (participantEmails.length === 0) {
              skipped++;
              continue;
            }

            const { error: queueError } = await supabase.from('outlook_unmatched_emails').upsert(
              {
                microsoft_message_id: msg.id,
                microsoft_conversation_id: msg.conversationId,
                sourceco_user_id: userId,
                mailbox_address: userEmail,
                direction: match.direction,
                from_address: msg.from?.emailAddress?.address || '',
                to_addresses: (msg.toRecipients || []).map((r) => r.emailAddress?.address),
                cc_addresses: (msg.ccRecipients || []).map((r) => r.emailAddress?.address),
                participant_emails: participantEmails,
                subject: msg.subject || '(No subject)',
                body_html: msg.body?.contentType === 'html' ? msg.body.content : null,
                body_text: msg.body?.contentType === 'text' ? msg.body.content : null,
                body_preview: msg.bodyPreview || null,
                sent_at: msg.sentDateTime || msg.receivedDateTime,
                has_attachments: msg.hasAttachments || false,
                attachment_metadata: attachmentMeta,
              },
              {
                onConflict: 'microsoft_message_id,sourceco_user_id',
                ignoreDuplicates: true,
              },
            );

            if (queueError && !queueError.message?.includes('duplicate')) {
              errors.push(`Queue unmatched ${msg.id}: ${queueError.message}`);
            } else {
              queuedUnmatched++;
            }
            continue;
          }

          // Create a record for each matched contact (uses ON CONFLICT to avoid race conditions)
          for (const contact of match.contacts) {
            const { error: insertError } = await supabase.from('email_messages').upsert(
              {
                microsoft_message_id: msg.id,
                microsoft_conversation_id: msg.conversationId,
                contact_id: contact.id,
                deal_id: contact.deal_id || null,
                sourceco_user_id: userId,
                direction: match.direction,
                from_address: msg.from?.emailAddress?.address || '',
                to_addresses: (msg.toRecipients || []).map((r) => r.emailAddress?.address),
                cc_addresses: (msg.ccRecipients || []).map((r) => r.emailAddress?.address),
                subject: msg.subject || '(No subject)',
                body_html: msg.body?.contentType === 'html' ? msg.body.content : null,
                body_text: msg.body?.contentType === 'text' ? msg.body.content : msg.bodyPreview,
                sent_at: msg.sentDateTime || msg.receivedDateTime,
                has_attachments: msg.hasAttachments || false,
                attachment_metadata: attachmentMeta,
                bcc_addresses: [],
              },
              {
                onConflict: 'microsoft_message_id,contact_id',
                ignoreDuplicates: true,
              },
            );

            if (insertError) {
              if (
                !insertError.message?.includes('duplicate') &&
                !insertError.message?.includes('conflict')
              ) {
                errors.push(`Insert failed for ${msg.id}: ${insertError.message}`);
              } else {
                skipped++;
              }
            } else {
              synced++;

              // Log to deal_activities for deal timeline visibility. The
              // `deal_activities.deal_id` FK points at `deal_pipeline(id)` as
              // of migration 20260618000000, so we must pass
              // `contact.deal_id` (a deal_pipeline row) — NOT the legacy
              // `contact.listing_id` (a listings row).
              if (contact.deal_id) {
                try {
                  const fromName =
                    msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || 'Unknown';
                  const toNames = (msg.toRecipients || [])
                    .map((r: any) => r.emailAddress?.name || r.emailAddress?.address)
                    .join(', ');
                  await supabase.rpc('log_deal_activity', {
                    p_deal_id: contact.deal_id,
                    p_activity_type:
                      match.direction === 'outbound' ? 'email_sent' : 'email_received',
                    p_title:
                      match.direction === 'outbound'
                        ? `Email sent to ${toNames}`
                        : `Email from ${fromName}`,
                    p_description: msg.subject || '(No subject)',
                    p_admin_id: null,
                    p_metadata: {
                      email_message_id: msg.id,
                      direction: match.direction,
                      from_address: msg.from?.emailAddress?.address || null,
                      to_addresses: (msg.toRecipients || []).map(
                        (r: any) => r.emailAddress?.address,
                      ),
                      subject: msg.subject,
                      has_attachments: msg.hasAttachments || false,
                      contact_id: contact.id,
                      listing_id: contact.listing_id || null,
                      body_preview: msg.bodyPreview?.substring(0, 300) || null,
                    },
                  });
                } catch (e) {
                  console.error('[outlook-sync] Failed to log deal activity:', e);
                }
              }
            }
          }
        } catch (err) {
          errors.push(`Message ${msg.id}: ${(err as Error).message}`);
        }
      }

      pageCount++;
    } catch (err) {
      errors.push(`Page fetch error: ${(err as Error).message}`);
      break;
    }
  } while (nextLink && pageCount < maxPages);

  console.log(
    `Sync complete: ${synced} synced, ${skipped} skipped, ${queuedUnmatched} queued-unmatched, ${errors.length} errors`,
  );

  // ── Trigger auto-summarize for email threads with 3+ messages ──
  if (synced > 0) {
    try {
      // Find conversation threads with 3+ emails that haven't been summarized yet
      const { data: threadCandidates } = await (supabase as any).rpc(
        'get_unsummarized_email_threads',
        {},
      );
      // Fallback: query directly if RPC doesn't exist
      if (!threadCandidates) {
        const { data: threads } = await (supabase as any)
          .from('email_messages')
          .select('microsoft_conversation_id, deal_id')
          .not('microsoft_conversation_id', 'is', null)
          .not('deal_id', 'is', null);

        if (threads) {
          // Count by conversation_id + deal_id
          const threadCounts = new Map<
            string,
            { count: number; deal_id: string; conversation_id: string }
          >();
          for (const t of threads) {
            const key = `${t.microsoft_conversation_id}::${t.deal_id}`;
            const existing = threadCounts.get(key);
            if (existing) {
              existing.count++;
            } else {
              threadCounts.set(key, {
                count: 1,
                deal_id: t.deal_id,
                conversation_id: t.microsoft_conversation_id,
              });
            }
          }

          for (const [, thread] of threadCounts) {
            if (thread.count >= 3) {
              try {
                await supabase.functions.invoke('auto-summarize-email-thread', {
                  body: { conversation_id: thread.conversation_id, deal_id: thread.deal_id },
                });
              } catch (e) {
                console.error(`[outlook-sync] Failed to trigger email thread summary:`, e);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('[outlook-sync] Email thread summary check failed:', e);
    }
  }

  return { synced, skipped, queuedUnmatched, errors };
}
