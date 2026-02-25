import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

/**
 * Bulk Sync ALL Fireflies Transcripts
 *
 * Pulls every transcript from the Fireflies account, pairs them to
 * deals and buyers, and fetches full transcript content — all in one go.
 *
 * Differences from auto-pair-all-fireflies:
 * - No upper limit on transcripts (pages until exhausted)
 * - Fetches full transcript content (sentences) inline
 * - Progressive backoff on rate limits
 * - Returns detailed progress stats
 */

const INTERNAL_DOMAINS = (
  Deno.env.get("INTERNAL_EMAIL_DOMAINS") || "sourcecodeals.com,captarget.com"
)
  .split(",")
  .map((d: string) => d.trim().toLowerCase())
  .filter(Boolean);

const FIREFLIES_API_TIMEOUT_MS = 30_000; // 30s for bulk ops
const BATCH_SIZE = 50;

// Progressive backoff state
let currentBackoffMs = 3_000;
const MAX_BACKOFF_MS = 60_000;

// ---------------------------------------------------------------------------
// Fireflies API helper with progressive backoff
// ---------------------------------------------------------------------------

async function firefliesGraphQL(
  query: string,
  variables?: Record<string, unknown>,
) {
  const apiKey = Deno.env.get("FIREFLIES_API_KEY");
  if (!apiKey) {
    throw new Error("FIREFLIES_API_KEY is not configured.");
  }

  const doFetch = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      FIREFLIES_API_TIMEOUT_MS,
    );
    try {
      const response = await fetch("https://api.fireflies.ai/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error(
          `Fireflies API timeout after ${FIREFLIES_API_TIMEOUT_MS}ms`,
        );
      }
      throw err;
    }
  };

  let response = await doFetch();

  // Progressive backoff on rate limits (up to 3 retries)
  let retries = 0;
  while (response.status === 429 && retries < 3) {
    console.warn(
      `Fireflies rate limit (429), backing off ${currentBackoffMs}ms (retry ${retries + 1}/3)`,
    );
    await new Promise((r) => setTimeout(r, currentBackoffMs));
    currentBackoffMs = Math.min(currentBackoffMs * 2, MAX_BACKOFF_MS);
    retries++;
    response = await doFetch();
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Fireflies API error (${response.status}): ${text}`);
  }

  const result = await response.json();
  if (result.errors) {
    throw new Error(
      `Fireflies GraphQL error: ${result.errors[0]?.message || JSON.stringify(result.errors)}`,
    );
  }

  // Reset backoff on success
  currentBackoffMs = 3_000;
  return result.data;
}

// ---------------------------------------------------------------------------
// GraphQL queries
// ---------------------------------------------------------------------------

const ALL_TRANSCRIPTS_QUERY = `
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
      meeting_info {
        silent_meeting
        summary_status
      }
    }
  }
`;

const GET_TRANSCRIPT_CONTENT_QUERY = `
  query GetTranscript($transcriptId: String!) {
    transcript(id: $transcriptId) {
      id
      sentences {
        text
        speaker_name
      }
      summary {
        short_summary
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function transcriptHasContent(t: any): boolean {
  const info = t.meeting_info || {};
  const isSilent = info.silent_meeting === true;
  const isSkipped = info.summary_status === "skipped";
  const hasSummary = !!t.summary?.short_summary;
  if ((isSilent || isSkipped) && !hasSummary) return false;
  return true;
}

function extractExternalParticipants(
  attendees: any[],
): { name: string; email: string }[] {
  if (!Array.isArray(attendees)) return [];
  return attendees
    .filter((a: any) => {
      const email = (a.email || "").toLowerCase();
      if (!email) return false;
      return !INTERNAL_DOMAINS.some((domain) => email.endsWith(`@${domain}`));
    })
    .map((a: any) => ({
      name: a.displayName || a.name || a.email?.split("@")[0] || "Unknown",
      email: a.email || "",
    }));
}

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(
      /\b(inc|llc|ltd|corp|corporation|company|co|group|holdings|partners|lp|l\.p\.|l\.l\.c\.)\b\.?/gi,
      "",
    )
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function convertFirefliesDate(date: any): string | null {
  if (!date) return null;
  const dateNum = typeof date === "number" ? date : parseInt(date, 10);
  if (isNaN(dateNum)) return null;
  return new Date(dateNum).toISOString();
}

/**
 * Fetch full transcript text from Fireflies for a single transcript.
 * Returns speaker-labeled text or null if unavailable.
 */
async function fetchTranscriptContent(
  firefliesId: string,
): Promise<string | null> {
  try {
    const data = await firefliesGraphQL(GET_TRANSCRIPT_CONTENT_QUERY, {
      transcriptId: firefliesId,
    });

    const transcript = data.transcript;
    if (!transcript) return null;

    // Build speaker-labeled text from sentences
    if (
      transcript.sentences &&
      Array.isArray(transcript.sentences) &&
      transcript.sentences.length > 0
    ) {
      return transcript.sentences
        .map((s: any) => `${s.speaker_name || "Unknown"}: ${s.text}`)
        .join("\n");
    }

    // Fallback to summary
    if (transcript.summary?.short_summary) {
      return `[Summary only]\n${transcript.summary.short_summary}`;
    }

    return null;
  } catch (err) {
    console.error(
      `Failed to fetch content for ${firefliesId}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const fetchContent = body.fetchContent !== false; // default: true
    const contentBatchSize = Math.min(body.contentBatchSize || 10, 25);

    console.log(
      `Starting bulk Fireflies sync (fetchContent=${fetchContent}, contentBatchSize=${contentBatchSize})`,
    );

    // ------------------------------------------------------------------
    // 1. Load database records for matching
    // ------------------------------------------------------------------

    // a) Buyer contacts: email → buyer_id[]
    const emailToBuyerIds = new Map<string, Set<string>>();
    {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("email, remarketing_buyer_id")
        .eq("contact_type", "buyer")
        .eq("archived", false)
        .not("email", "is", null)
        .not("remarketing_buyer_id", "is", null);

      for (const c of contacts || []) {
        if (!c.email || !c.remarketing_buyer_id) continue;
        const email = c.email.toLowerCase().trim();
        if (!emailToBuyerIds.has(email))
          emailToBuyerIds.set(email, new Set());
        emailToBuyerIds.get(email)!.add(c.remarketing_buyer_id);
      }
    }
    console.log(`Loaded ${emailToBuyerIds.size} buyer contact emails`);

    // b) Buyers: company_name → buyer_id
    const nameToBuyerIds = new Map<string, Set<string>>();
    {
      const { data: buyers } = await supabase
        .from("remarketing_buyers")
        .select("id, company_name, pe_firm_name")
        .eq("archived", false);

      for (const b of buyers || []) {
        for (const name of [b.company_name, b.pe_firm_name]) {
          if (!name || name.length < 3) continue;
          const norm = normalizeCompanyName(name);
          if (!norm) continue;
          if (!nameToBuyerIds.has(norm))
            nameToBuyerIds.set(norm, new Set());
          nameToBuyerIds.get(norm)!.add(b.id);
        }
      }
    }
    console.log(`Loaded ${nameToBuyerIds.size} buyer company names`);

    // c) Deal contacts: email → listing_id[]
    const emailToListingIds = new Map<string, Set<string>>();
    const nameToListingIds = new Map<string, Set<string>>();
    {
      const { data: listings } = await supabase
        .from("listings")
        .select("id, main_contact_email, title")
        .is("deleted_at", null);

      for (const l of listings || []) {
        if (l.main_contact_email) {
          const email = l.main_contact_email.toLowerCase().trim();
          if (!emailToListingIds.has(email))
            emailToListingIds.set(email, new Set());
          emailToListingIds.get(email)!.add(l.id);
        }
        if (l.title && l.title.length >= 3) {
          const norm = normalizeCompanyName(l.title);
          if (norm) {
            if (!nameToListingIds.has(norm))
              nameToListingIds.set(norm, new Set());
            nameToListingIds.get(norm)!.add(l.id);
          }
        }
      }
    }
    console.log(
      `Loaded ${emailToListingIds.size} deal emails, ${nameToListingIds.size} deal names`,
    );

    // d) Pre-load existing links to skip duplicates
    const existingBuyerLinks = new Set<string>();
    {
      const { data } = await supabase
        .from("buyer_transcripts")
        .select("buyer_id, fireflies_transcript_id");
      for (const row of data || []) {
        if (row.fireflies_transcript_id) {
          existingBuyerLinks.add(
            `${row.buyer_id}:${row.fireflies_transcript_id}`,
          );
        }
      }
    }

    const existingDealLinks = new Set<string>();
    {
      const { data } = await supabase
        .from("deal_transcripts")
        .select("listing_id, fireflies_transcript_id")
        .not("fireflies_transcript_id", "is", null);
      for (const row of data || []) {
        existingDealLinks.add(
          `${row.listing_id}:${row.fireflies_transcript_id}`,
        );
      }
    }

    // Also track which fireflies IDs already have content fetched
    const existingContentIds = new Set<string>();
    {
      const { data } = await supabase
        .from("deal_transcripts")
        .select("fireflies_transcript_id")
        .not("fireflies_transcript_id", "is", null)
        .neq("transcript_text", "")
        .gt("transcript_text", "");  // has content
      for (const row of data || []) {
        if (row.fireflies_transcript_id) {
          existingContentIds.add(row.fireflies_transcript_id);
        }
      }
    }

    console.log(
      `Pre-loaded ${existingBuyerLinks.size} buyer links, ${existingDealLinks.size} deal links, ${existingContentIds.size} with content`,
    );

    // ------------------------------------------------------------------
    // 2. Fetch ALL Fireflies transcripts (no upper limit)
    // ------------------------------------------------------------------
    const allTranscripts: any[] = [];
    let page = 0;

    while (true) {
      console.log(`Fetching Fireflies page ${page + 1} (skip=${page * BATCH_SIZE})...`);
      const data = await firefliesGraphQL(ALL_TRANSCRIPTS_QUERY, {
        limit: BATCH_SIZE,
        skip: page * BATCH_SIZE,
      });
      const batch = data.transcripts || [];
      allTranscripts.push(...batch);
      console.log(
        `Page ${page + 1}: ${batch.length} transcripts (total: ${allTranscripts.length})`,
      );

      if (batch.length < BATCH_SIZE) break; // Last page
      page++;

      // Small delay between pages to be gentle on the API
      await new Promise((r) => setTimeout(r, 500));
    }

    console.log(`Total Fireflies transcripts fetched: ${allTranscripts.length}`);

    // ------------------------------------------------------------------
    // 3. Match each transcript to buyers and deals, fetch content
    // ------------------------------------------------------------------
    let buyersPaired = 0;
    let dealsPaired = 0;
    let buyersSkipped = 0;
    let dealsSkipped = 0;
    let contentFetched = 0;
    let contentSkipped = 0;
    let contentFailed = 0;
    let unmatched = 0;
    const errors: string[] = [];

    // Track new deal_transcript IDs that need content fetching
    const needsContent: { dbId: string; firefliesId: string }[] = [];

    for (const transcript of allTranscripts) {
      if (!transcript.id) continue;

      const externalParticipants = extractExternalParticipants(
        transcript.meeting_attendees || [],
      );
      const participantEmails = externalParticipants
        .map((p) => p.email.toLowerCase())
        .filter(Boolean);

      const hasContent = transcriptHasContent(transcript);
      const title = transcript.title || "";
      const normalizedTitle = normalizeCompanyName(title);
      const callDate = convertFirefliesDate(transcript.date);
      const attendeeEmails = (transcript.meeting_attendees || [])
        .map((a: any) => a.email)
        .filter(Boolean);

      let matchedAnything = false;

      // --- Match to buyers ---
      const matchedBuyerIds = new Set<string>();
      const buyerMatchTypes = new Map<string, "email" | "keyword">();

      for (const email of participantEmails) {
        const buyerIds = emailToBuyerIds.get(email);
        if (buyerIds) {
          for (const bid of buyerIds) {
            matchedBuyerIds.add(bid);
            buyerMatchTypes.set(bid, "email");
          }
        }
      }

      if (normalizedTitle.length >= 3) {
        for (const [companyNorm, buyerIds] of nameToBuyerIds) {
          if (
            normalizedTitle.includes(companyNorm) ||
            companyNorm.includes(normalizedTitle)
          ) {
            for (const bid of buyerIds) {
              if (!matchedBuyerIds.has(bid)) {
                matchedBuyerIds.add(bid);
                buyerMatchTypes.set(bid, "keyword");
              }
            }
          }
        }
      }

      // Insert buyer links
      for (const buyerId of matchedBuyerIds) {
        const linkKey = `${buyerId}:${transcript.id}`;
        if (existingBuyerLinks.has(linkKey)) {
          buyersSkipped++;
          matchedAnything = true;
          continue;
        }

        try {
          const { error: insertErr } = await supabase
            .from("buyer_transcripts")
            .insert({
              buyer_id: buyerId,
              fireflies_transcript_id: transcript.id,
              transcript_url: transcript.transcript_url || null,
              title: title || "Call",
              call_date: callDate,
              participants: transcript.meeting_attendees || [],
              duration_minutes: transcript.duration
                ? Math.round(transcript.duration)
                : null,
              summary: transcript.summary?.short_summary || null,
              key_points: transcript.summary?.keywords || [],
            });

          if (insertErr) {
            if (insertErr.code === "23505") {
              buyersSkipped++;
            } else {
              errors.push(`buyer ${buyerId}: ${insertErr.message}`);
            }
          } else {
            buyersPaired++;
            existingBuyerLinks.add(linkKey);
          }
          matchedAnything = true;
        } catch (e) {
          errors.push(
            `buyer ${buyerId}: ${e instanceof Error ? e.message : "Unknown"}`,
          );
        }
      }

      // --- Match to deals ---
      const matchedListingIds = new Set<string>();
      const dealMatchTypes = new Map<string, "email" | "keyword">();

      for (const email of participantEmails) {
        const listingIds = emailToListingIds.get(email);
        if (listingIds) {
          for (const lid of listingIds) {
            matchedListingIds.add(lid);
            dealMatchTypes.set(lid, "email");
          }
        }
      }

      if (normalizedTitle.length >= 3) {
        for (const [companyNorm, listingIds] of nameToListingIds) {
          if (
            normalizedTitle.includes(companyNorm) ||
            companyNorm.includes(normalizedTitle)
          ) {
            for (const lid of listingIds) {
              if (!matchedListingIds.has(lid)) {
                matchedListingIds.add(lid);
                dealMatchTypes.set(lid, "keyword");
              }
            }
          }
        }
      }

      // Insert deal links
      for (const listingId of matchedListingIds) {
        const linkKey = `${listingId}:${transcript.id}`;
        if (existingDealLinks.has(linkKey)) {
          dealsSkipped++;
          matchedAnything = true;
          continue;
        }

        try {
          const { data: inserted, error: insertErr } = await supabase
            .from("deal_transcripts")
            .insert({
              listing_id: listingId,
              fireflies_transcript_id: transcript.id,
              fireflies_meeting_id: transcript.id,
              transcript_url: transcript.transcript_url || null,
              title: title || "Call",
              call_date: callDate,
              participants: transcript.meeting_attendees || [],
              meeting_attendees: attendeeEmails,
              duration_minutes: transcript.duration
                ? Math.round(transcript.duration)
                : null,
              source: "fireflies",
              auto_linked: true,
              transcript_text: "",
              has_content: hasContent,
              match_type: dealMatchTypes.get(listingId) || "email",
              external_participants: externalParticipants,
            })
            .select("id")
            .single();

          if (insertErr) {
            if (insertErr.code === "23505") {
              dealsSkipped++;
            } else {
              errors.push(`deal ${listingId}: ${insertErr.message}`);
            }
          } else {
            dealsPaired++;
            existingDealLinks.add(linkKey);
            // Queue for content fetching if it has content
            if (hasContent && inserted?.id && !existingContentIds.has(transcript.id)) {
              needsContent.push({
                dbId: inserted.id,
                firefliesId: transcript.id,
              });
            }
          }
          matchedAnything = true;
        } catch (e) {
          errors.push(
            `deal ${listingId}: ${e instanceof Error ? e.message : "Unknown"}`,
          );
        }
      }

      if (!matchedAnything) {
        unmatched++;
      }
    }

    console.log(
      `Pairing complete: ${buyersPaired} buyers, ${dealsPaired} deals, ${unmatched} unmatched`,
    );

    // ------------------------------------------------------------------
    // 4. Fetch full transcript content for newly linked deals
    // ------------------------------------------------------------------
    if (fetchContent && needsContent.length > 0) {
      console.log(
        `Fetching content for ${needsContent.length} transcripts in batches of ${contentBatchSize}...`,
      );

      // Also find existing deal_transcripts that are missing content
      const { data: missingContent } = await supabase
        .from("deal_transcripts")
        .select("id, fireflies_transcript_id")
        .not("fireflies_transcript_id", "is", null)
        .eq("transcript_text", "")
        .eq("has_content", true);

      const existingNeedsContent = (missingContent || [])
        .filter(
          (row) =>
            row.fireflies_transcript_id &&
            !needsContent.some((n) => n.firefliesId === row.fireflies_transcript_id),
        )
        .map((row) => ({
          dbId: row.id,
          firefliesId: row.fireflies_transcript_id!,
        }));

      const allNeedsContent = [...needsContent, ...existingNeedsContent];
      console.log(
        `Total transcripts needing content: ${allNeedsContent.length} (${needsContent.length} new + ${existingNeedsContent.length} existing)`,
      );

      // Process in batches
      for (let i = 0; i < allNeedsContent.length; i += contentBatchSize) {
        const batch = allNeedsContent.slice(i, i + contentBatchSize);
        console.log(
          `Content batch ${Math.floor(i / contentBatchSize) + 1}: fetching ${batch.length} transcripts...`,
        );

        // Fetch content sequentially within batch to avoid rate limits
        for (const item of batch) {
          const text = await fetchTranscriptContent(item.firefliesId);

          if (text && text.length >= 50) {
            const { error: updateErr } = await supabase
              .from("deal_transcripts")
              .update({
                transcript_text: text,
                processed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", item.dbId);

            if (updateErr) {
              console.error(
                `Failed to save content for ${item.dbId}:`,
                updateErr.message,
              );
              contentFailed++;
            } else {
              contentFetched++;
            }
          } else if (text !== null && text.length < 50) {
            // Mark as no content
            await supabase
              .from("deal_transcripts")
              .update({
                has_content: false,
                updated_at: new Date().toISOString(),
              })
              .eq("id", item.dbId);
            contentSkipped++;
          } else {
            contentFailed++;
          }

          // Small delay between individual fetches
          await new Promise((r) => setTimeout(r, 300));
        }

        // Longer delay between batches
        if (i + contentBatchSize < allNeedsContent.length) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      console.log(
        `Content fetching complete: ${contentFetched} fetched, ${contentSkipped} empty, ${contentFailed} failed`,
      );
    }

    // ------------------------------------------------------------------
    // 5. Return results
    // ------------------------------------------------------------------
    const result = {
      success: true,
      fireflies_total: allTranscripts.length,
      pairing: {
        buyers_paired: buyersPaired,
        buyers_skipped: buyersSkipped,
        deals_paired: dealsPaired,
        deals_skipped: dealsSkipped,
        unmatched,
      },
      content: fetchContent
        ? {
            fetched: contentFetched,
            skipped_empty: contentSkipped,
            failed: contentFailed,
            total_queued: needsContent.length,
          }
        : "skipped (fetchContent=false)",
      errors: errors.length > 0 ? errors.slice(0, 50) : undefined,
    };

    console.log("Bulk sync complete:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Bulk sync error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
