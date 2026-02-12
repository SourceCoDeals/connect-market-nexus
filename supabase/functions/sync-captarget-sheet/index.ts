import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BATCH_SIZE = 100;
const HASH_LOOKUP_CHUNK = 50;
// Edge functions CPU time limit is ~50s; paginate well before that
const TIMEOUT_MS = 25_000;

// ── Google Sheets auth via service account JWT ──────────────────────

async function getAccessToken(serviceAccountKey: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccountKey.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encoder = new TextEncoder();
  const toBase64Url = (data: Uint8Array) =>
    btoa(String.fromCharCode(...data))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const headerB64 = toBase64Url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const pemContents = serviceAccountKey.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(unsignedToken)
  );
  const signatureB64 = toBase64Url(new Uint8Array(signature));
  const jwt = `${unsignedToken}.${signatureB64}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Google OAuth error: ${resp.status} – ${errText}`);
  }

  const tokenData = await resp.json();
  return tokenData.access_token;
}

async function fetchSheetRows(
  accessToken: string,
  sheetId: string,
  tabName: string
): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName)}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Sheets API error for tab "${tabName}": ${resp.status} – ${errText}`);
  }

  const data = await resp.json();
  return data.values || [];
}

// ── Normalisation helpers ───────────────────────────────────────────

function normalizeInterestType(raw: string | undefined): string {
  if (!raw) return "unknown";
  const lower = raw.trim().toLowerCase();
  if (["interest", "interested", "interset", "interst", "intrested"].includes(lower)) return "interest";
  if (["no interest", "no_interest", "not interested", "nointerest"].includes(lower)) return "no_interest";
  if (["keep in mind", "keep_in_mind", "keepinmind", "kim"].includes(lower)) return "keep_in_mind";
  return "unknown";
}

function normalizeOutreachChannel(raw: string | undefined): string {
  if (!raw) return "Unknown";
  const trimmed = raw.trim().toUpperCase();
  if (trimmed === "C" || trimmed === "COLD CALL") return "Cold Call";
  if (trimmed === "Y" || trimmed === "YES" || trimmed === "COLD EMAIL") return "Cold Email";
  if (trimmed === "N" || trimmed === "NOT INTERESTED") return "Not Interested";
  return "Unknown";
}

async function computeHash(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

const COL = {
  client_folder_name: 0,
  original_sheet_name: 1,
  source_location: 2,
  source_url: 3,
  company_name: 4,
  date: 5,
  details: 6,
  email: 7,
  first_name: 8,
  last_name: 9,
  response: 10,
  title: 11,
  type: 12,
  url: 13,
  phone: 14,
};

/**
 * Check if a row has meaningful data (not just empty cells)
 */
function rowHasData(row: string[]): boolean {
  for (let c = 1; c < row.length; c++) {
    if ((row[c] || "").trim()) return true;
  }
  return false;
}

// ── Parse service account key with resilient JSON handling ──────────

function parseServiceAccountKey(raw: string): any {
  const cleaned = raw
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    .replace(/\u00A0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  try {
    const key = JSON.parse(cleaned);
    if (!key.client_email || !key.private_key) {
      throw new Error(`Service account key missing required fields. Keys found: ${Object.keys(key).join(', ')}`);
    }
    return key;
  } catch (e) {
    const pos = parseInt(String((e as Error).message).match(/position (\d+)/)?.[1] || '0');
    if (pos > 0) {
      const around = cleaned.substring(Math.max(0, pos - 5), pos + 10);
      const codes = [...around].map(c => `${c}(${c.charCodeAt(0)})`).join(' ');
      console.error(`Chars around position ${pos}: ${codes}`);
    }
    throw new Error(`GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON: ${(e as Error).message}`);
  }
}

// ── Build a record from a sheet row ─────────────────────────────────

async function rowToRecord(row: string[], captargetStatus: string, tabName: string): Promise<Record<string, any>> {
  const clientName = (row[COL.client_folder_name] || "").trim();
  const companyName = (row[COL.company_name] || "").trim();
  const dateRaw = (row[COL.date] || "").trim();
  const firstName = (row[COL.first_name] || "").trim();
  const lastName = (row[COL.last_name] || "").trim();
  const email = (row[COL.email] || "").trim();

  const hashInput = `${clientName}|${companyName}|${dateRaw}|${email}|${firstName}|${lastName}`;
  const rowHash = await computeHash(hashInput);
  const contactName = [firstName, lastName].filter(Boolean).join(" ");

  return {
    captarget_row_hash: rowHash,
    captarget_client_name: clientName || null,
    title: companyName || clientName || contactName || "Unnamed Deal",
    internal_company_name: companyName || null,
    captarget_contact_date: parseDate(dateRaw),
    captarget_call_notes: (row[COL.details] || "").trim() || null,
    description: (row[COL.details] || "").trim() || null,
    main_contact_email: (row[COL.email] || "").trim() || null,
    main_contact_name: contactName || null,
    main_contact_title: (row[COL.title] || "").trim() || null,
    captarget_outreach_channel: normalizeOutreachChannel(row[COL.response]),
    captarget_interest_type: normalizeInterestType(row[COL.type]),
    website: (row[COL.url] || "").trim() || null,
    main_contact_phone: (row[COL.phone] || "").trim() || null,
    captarget_source_url: (row[COL.source_url] || "").trim() || null,
    captarget_status: captargetStatus,
    captarget_sheet_tab: tabName,
    deal_source: "captarget",
    status: "pending",
    pushed_to_all_deals: false,
    is_internal_deal: true,
  };
}

// ── Main handler ────────────────────────────────────────────────────
// Supports pagination via request body:
//   { startTab?: number, startRow?: number }
// Returns { hasMore, nextTab, nextRow } so the caller can continue.

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  const startTime = Date.now();
  const syncErrors: any[] = [];
  let rowsRead = 0;
  let rowsInserted = 0;
  let rowsUpdated = 0;
  let rowsSkipped = 0;
  let filteredByMeta = 0;
  let filteredByData = 0;
  let syncStatus = "success";
  const tabsProcessed: string[] = [];

  // Pagination state from caller
  let startTab = 0;
  let startRow = 0;
  let hasMore = false;
  let nextTab = 0;
  let nextRow = 0;

  try {
    // Parse optional pagination params from body
    try {
      if (req.body) {
        const body = await req.json();
        startTab = body.startTab ?? 0;
        startRow = body.startRow ?? 0;
      }
    } catch {
      // No body or invalid JSON — start from the beginning
    }

    const saKeyRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!saKeyRaw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not configured");
    const saKey = parseServiceAccountKey(saKeyRaw);

    const sheetId = Deno.env.get("CAPTARGET_SHEET_ID");
    if (!sheetId) throw new Error("CAPTARGET_SHEET_ID not configured");

    const activeTab = Deno.env.get("CAPTARGET_ACTIVE_TAB_NAME") || "Active Summary";
    const inactiveTab = Deno.env.get("CAPTARGET_INACTIVE_TAB_NAME") || "Inactive Summary";
    const tabs = [
      { name: activeTab, captarget_status: "active" },
      { name: inactiveTab, captarget_status: "inactive" },
    ];

    const accessToken = await getAccessToken(saKey);

    for (let tabIdx = startTab; tabIdx < tabs.length; tabIdx++) {
      const tab = tabs[tabIdx];
      let tabRows: string[][];
      try {
        tabRows = await fetchSheetRows(accessToken, sheetId, tab.name);
      } catch (tabErr: any) {
        console.error(`Failed to fetch tab "${tab.name}":`, tabErr.message);
        syncErrors.push({ tab: tab.name, error: tabErr.message });
        continue;
      }

      if (tabRows.length < 2) {
        console.log(`Tab "${tab.name}" has no data rows, skipping`);
        continue;
      }

      // Find the actual header row by scanning for a row with multiple populated columns
      // The sheet may have metadata rows (e.g., "Last Updated: ...") before the real header
      let headerRowIndex = 0;
      const knownHeaders = ["company name", "email", "first name", "last name", "date", "details", "response", "type", "url", "phone", "title"];
      for (let r = 0; r < Math.min(tabRows.length, 10); r++) {
        const row = tabRows[r];
        if (row.length < 5) continue; // metadata rows usually have 1-2 cells
        const normalizedCells = row.map(c => (c || "").trim().toLowerCase());
        const matchCount = knownHeaders.filter(h => normalizedCells.some(cell => cell.includes(h))).length;
        if (matchCount >= 3) {
          headerRowIndex = r;
          console.log(`Tab "${tab.name}": found header at row ${r} (matched ${matchCount} known headers)`);
          break;
        }
        // Fallback: if a row has 5+ non-empty cells and isn't just a "Last Updated" row, treat it as header
        const nonEmpty = normalizedCells.filter(c => c.length > 0).length;
        if (nonEmpty >= 5 && !normalizedCells[0].startsWith("last updated")) {
          headerRowIndex = r;
          console.log(`Tab "${tab.name}": using row ${r} as header (${nonEmpty} non-empty cells)`);
          break;
        }
      }

      const headerRow = tabRows[headerRowIndex];
      console.log(`Tab "${tab.name}" headers (row ${headerRowIndex}, ${headerRow.length} cols): ${headerRow.slice(0, 15).join(' | ')}`);

      const allRows = tabRows.slice(headerRowIndex + 1);
      let filteredByMeta = 0;
      let filteredByData = 0;
      const dataRows = allRows.filter((row) => {
        const firstCell = (row[0] || "").trim().toLowerCase();
        if (firstCell === "last updated" || firstCell === "") { filteredByMeta++; return false; }
        if (!rowHasData(row)) { filteredByData++; return false; }
        return true;
      });
      console.log(`Tab "${tab.name}": ${allRows.length} total, ${filteredByMeta} meta-filtered, ${filteredByData} empty-filtered, ${dataRows.length} usable`);

      const rowOffset = tabIdx === startTab ? startRow : 0;
      const rowsThisTab = dataRows.length - rowOffset;
      if (rowsThisTab <= 0) continue;

      rowsRead += rowsThisTab;
      console.log(`Tab "${tab.name}": ${tabRows.length} total → ${dataRows.length} data rows (filtered: ${filteredByMeta} meta/empty-col0, ${filteredByData} no-data). Processing ${rowsThisTab} from offset ${rowOffset}.`);

      for (let i = rowOffset; i < dataRows.length; i += BATCH_SIZE) {
        // Timeout check BEFORE processing the next batch
        if (Date.now() - startTime > TIMEOUT_MS) {
          console.warn(`Timeout approaching at tab ${tabIdx} row ${i}, will resume`);
          hasMore = true;
          nextTab = tabIdx;
          nextRow = i;
          syncStatus = "partial";
          break;
        }

        const batch = dataRows.slice(i, i + BATCH_SIZE);

        // Build records in parallel
        const recordResults = await Promise.allSettled(
          batch.map((row) => rowToRecord(row, tab.captarget_status, tab.name))
        );

        const batchRecords: any[] = [];
        const batchHashes: string[] = [];

        for (let j = 0; j < recordResults.length; j++) {
          const result = recordResults[j];
          if (result.status === "fulfilled") {
            batchRecords.push(result.value);
            batchHashes.push(result.value.captarget_row_hash);
          } else {
            rowsSkipped++;
            syncErrors.push({
              tab: tab.name,
              row: i + j + 2,
              error: result.reason?.message || "Unknown error",
            });
          }
        }

        if (batchRecords.length === 0) continue;

        // Look up existing hashes in small chunks to avoid PostgREST URL limit
        const existingMap = new Map<string, string>();
        let lookupFailed = false;
        for (let h = 0; h < batchHashes.length; h += HASH_LOOKUP_CHUNK) {
          const hashChunk = batchHashes.slice(h, h + HASH_LOOKUP_CHUNK);
          const { data: existing, error: lookupErr } = await supabase
            .from("listings")
            .select("id, captarget_row_hash")
            .in("captarget_row_hash", hashChunk);

          if (lookupErr) {
            console.error("Hash lookup error:", lookupErr);
            rowsSkipped += batchRecords.length;
            syncErrors.push({ batch: i, error: lookupErr.message });
            lookupFailed = true;
            break;
          }
          for (const r of existing || []) {
            existingMap.set(r.captarget_row_hash, r.id);
          }
        }
        if (lookupFailed) continue;

        const toInsert: any[] = [];
        const toUpdate: any[] = [];

        for (const record of batchRecords) {
          const existingId = existingMap.get(record.captarget_row_hash);
          if (existingId) {
            // For updates, strip fields that shouldn't be overwritten
            const { status, pushed_to_all_deals, deal_source, is_internal_deal, captarget_row_hash, ...updateFields } = record;
            toUpdate.push({ id: existingId, ...updateFields });
          } else {
            toInsert.push(record);
          }
        }

        // Insert new rows individually; on duplicate-key conflicts, fall back to update
        if (toInsert.length > 0) {
          const INSERT_CHUNK = 50;
          for (let ic = 0; ic < toInsert.length; ic += INSERT_CHUNK) {
            const chunk = toInsert.slice(ic, ic + INSERT_CHUNK);
            const insertResults = await Promise.allSettled(
              chunk.map((record: any) =>
                supabase.from("listings").insert(record)
              )
            );
            for (let idx = 0; idx < insertResults.length; idx++) {
              const ir = insertResults[idx];
              if (ir.status === "fulfilled" && !ir.value.error) {
                rowsInserted++;
              } else {
                const errMsg = ir.status === "rejected"
                  ? ir.reason?.message
                  : ir.value?.error?.message;
                // On duplicate key (website or hash), find existing row and update instead
                if (errMsg && errMsg.includes("duplicate key")) {
                  const record = chunk[idx];
                  const { status: _s, pushed_to_all_deals: _p, deal_source: _d, is_internal_deal: _i, captarget_row_hash, ...fallbackFields } = record;
                  let existingId: string | null = null;
                  if (captarget_row_hash) {
                    const { data: byHash } = await supabase
                      .from("listings")
                      .select("id")
                      .eq("captarget_row_hash", captarget_row_hash)
                      .limit(1)
                      .maybeSingle();
                    if (byHash) existingId = byHash.id;
                  }
                  if (!existingId && record.website) {
                    const { data: byWeb } = await supabase
                      .from("listings")
                      .select("id")
                      .eq("website", record.website)
                      .limit(1)
                      .maybeSingle();
                    if (byWeb) existingId = byWeb.id;
                  }
                  if (existingId) {
                    const { error: upErr } = await supabase
                      .from("listings")
                      .update({ ...fallbackFields, captarget_row_hash })
                      .eq("id", existingId);
                    if (!upErr) {
                      rowsUpdated++;
                    } else {
                      rowsSkipped++;
                      syncErrors.push({ op: "insert-fallback-update", error: upErr.message });
                    }
                  } else {
                    rowsSkipped++;
                  }
                } else {
                  rowsSkipped++;
                  if (errMsg) {
                    syncErrors.push({ op: "insert", error: errMsg });
                  }
                }
              }
            }
          }
        }

        // Batch updates
        if (toUpdate.length > 0) {
          const UPDATE_CHUNK = 100;
          for (let u = 0; u < toUpdate.length; u += UPDATE_CHUNK) {
            const chunk = toUpdate.slice(u, u + UPDATE_CHUNK);
            const updateResults = await Promise.allSettled(
              chunk.map(({ id, ...fields }: any) =>
                supabase.from("listings").update(fields).eq("id", id)
              )
            );
            for (const ur of updateResults) {
              if (ur.status === "fulfilled" && !ur.value.error) {
                rowsUpdated++;
              } else {
                rowsSkipped++;
                const errMsg = ur.status === "rejected" ? ur.reason?.message : ur.value?.error?.message;
                syncErrors.push({ op: "update", error: errMsg });
              }
            }
          }
        }

        console.log(`Batch at row ${i}: +${toInsert.length} inserted, ~${toUpdate.length} updated`);
      }

      if (hasMore) break;
      tabsProcessed.push(tab.name);
    }
  } catch (err: any) {
    console.error("Sync failed:", err.message);
    syncStatus = "failed";
    syncErrors.push({ fatal: true, error: err.message });
  }

  const durationMs = Date.now() - startTime;

  // Log sync result
  try {
    await supabase.from("captarget_sync_log").insert({
      rows_read: rowsRead,
      rows_inserted: rowsInserted,
      rows_updated: rowsUpdated,
      rows_skipped: rowsSkipped,
      errors: syncErrors.length > 0 ? syncErrors : null,
      duration_ms: durationMs,
      status: syncStatus,
    });
  } catch (logErr) {
    console.error("Failed to log sync result:", logErr);
  }

  const result = {
    success: syncStatus !== "failed",
    status: syncStatus,
    tabs_synced: tabsProcessed,
    rows_read: rowsRead,
    rows_inserted: rowsInserted,
    rows_updated: rowsUpdated,
    rows_skipped: rowsSkipped,
    duration_ms: durationMs,
    error_count: syncErrors.length,
    hasMore,
    nextTab,
    nextRow,
  };

  console.log("Sync complete:", JSON.stringify(result));

  return new Response(JSON.stringify(result), {
    status: syncStatus === "failed" ? 500 : 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
