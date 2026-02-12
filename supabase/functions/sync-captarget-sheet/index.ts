import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BATCH_SIZE = 250;

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

  // Import the RSA private key
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

// ── Fetch all tab names from spreadsheet metadata ───────────────────

async function fetchTabNames(
  accessToken: string,
  sheetId: string
): Promise<string[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Sheets metadata error: ${resp.status} – ${errText}`);
  }

  const data = await resp.json();
  return (data.sheets || []).map((s: any) => s.properties.title as string);
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
  // Handle common misspellings
  if (
    lower === "interest" ||
    lower === "interested" ||
    lower === "interset" ||
    lower === "interst" ||
    lower === "intrested"
  )
    return "interest";
  if (
    lower === "no interest" ||
    lower === "no_interest" ||
    lower === "not interested" ||
    lower === "nointerest"
  )
    return "no_interest";
  if (
    lower === "keep in mind" ||
    lower === "keep_in_mind" ||
    lower === "keepinmind" ||
    lower === "kim"
  )
    return "keep_in_mind";
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

// ── Column index mapping (0-based from sheet header) ────────────────
// Sheet columns: client_folder_name, original_sheet_name, source_location,
//   source_url, Company Name, Date, Details, Email, First Name, Last Name,
//   Response, Title, Type, URL, Phone

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

// Check if a row has any meaningful data beyond just the first cell
function rowHasData(row: string[]): boolean {
  // A row is valid if it has data in at least one of: company_name, email, first_name, last_name
  const companyName = (row[COL.company_name] || "").trim();
  const email = (row[COL.email] || "").trim();
  const firstName = (row[COL.first_name] || "").trim();
  const lastName = (row[COL.last_name] || "").trim();
  return !!(companyName || email || firstName || lastName);
}

// ── Main handler ────────────────────────────────────────────────────

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
  let syncStatus = "success";
  const tabsProcessed: string[] = [];

  try {
    // Load Google service account credentials
    const saKeyRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!saKeyRaw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not configured");
    const saKey = JSON.parse(saKeyRaw);

    const sheetId = Deno.env.get("CAPTARGET_SHEET_ID");
    if (!sheetId) throw new Error("CAPTARGET_SHEET_ID not configured");

    // Authenticate
    const accessToken = await getAccessToken(saKey);

    // Determine which tabs to sync:
    //   - CAPTARGET_TAB_NAMES (comma-separated) syncs specific tabs
    //   - If not set, auto-discover ALL tabs in the spreadsheet
    const tabNamesEnv = Deno.env.get("CAPTARGET_TAB_NAMES") || Deno.env.get("CAPTARGET_TAB_NAME");
    let tabNames: string[];

    if (tabNamesEnv) {
      tabNames = tabNamesEnv.split(",").map((t) => t.trim()).filter(Boolean);
    } else {
      // Auto-discover all tabs
      tabNames = await fetchTabNames(accessToken, sheetId);
    }

    if (tabNames.length === 0) {
      throw new Error("No tabs found in spreadsheet");
    }

    console.log(`Will sync ${tabNames.length} tab(s): ${tabNames.join(", ")}`);

    let timedOut = false;

    // Process each tab
    for (const tabName of tabNames) {
      if (timedOut) break;

      console.log(`Fetching tab: "${tabName}"`);
      let allRows: string[][];
      try {
        allRows = await fetchSheetRows(accessToken, sheetId, tabName);
      } catch (tabErr: any) {
        console.error(`Failed to fetch tab "${tabName}":`, tabErr.message);
        syncErrors.push({ tab: tabName, fatal: false, error: tabErr.message });
        continue;
      }

      if (allRows.length < 2) {
        console.log(`Tab "${tabName}" has no data rows, skipping`);
        continue;
      }

      tabsProcessed.push(tabName);

      // Skip header row (row 0) and skip metadata rows like 'Last Updated'
      // IMPORTANT: Do NOT skip rows just because column 0 is empty —
      // many valid deals have data in other columns but no client_folder_name
      const dataRows = allRows.slice(1).filter((row) => {
        const firstCell = (row[0] || "").trim().toLowerCase();
        // Skip known metadata rows
        if (firstCell === "last updated") return false;
        // Keep any row that has meaningful deal data
        return rowHasData(row);
      });

      const tabRowsRead = dataRows.length;
      rowsRead += tabRowsRead;
      console.log(`Tab "${tabName}": ${tabRowsRead} data rows (of ${allRows.length - 1} total)`);

      // Process in batches
      for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
        const batch = dataRows.slice(i, i + BATCH_SIZE);
        const batchRecords: any[] = [];
        const batchHashes: string[] = [];

        // Pre-parse all rows and compute hashes in parallel
        const parsed = batch.map((row, idx) => {
          const clientName = (row[COL.client_folder_name] || "").trim();
          const companyName = (row[COL.company_name] || "").trim();
          const dateRaw = (row[COL.date] || "").trim();
          const email = (row[COL.email] || "").trim();
          const firstName = (row[COL.first_name] || "").trim();
          const lastName = (row[COL.last_name] || "").trim();
          const hashInput = `${tabName}|${clientName}|${companyName}|${dateRaw}|${email}|${firstName}|${lastName}`;
          return { row, idx, clientName, companyName, dateRaw, email, firstName, lastName, hashInput };
        });

        const hashes = await Promise.all(parsed.map((p) => computeHash(p.hashInput)));

        for (let j = 0; j < parsed.length; j++) {
          try {
            const { row, idx, clientName, companyName, dateRaw, email, firstName, lastName } = parsed[j];
            const rowHash = hashes[j];
            const contactDate = parseDate(dateRaw);
            const contactName = [firstName, lastName].filter(Boolean).join(" ");

            const record: Record<string, any> = {
              captarget_row_hash: rowHash,
              captarget_client_name: clientName || null,
              captarget_sheet_tab: tabName,
              title: companyName || null,
              internal_company_name: companyName || null,
              captarget_contact_date: contactDate,
              captarget_call_notes: (row[COL.details] || "").trim() || null,
              description: (row[COL.details] || "").trim() || null,
              main_contact_email: email || null,
              main_contact_name: contactName || null,
              main_contact_title: (row[COL.title] || "").trim() || null,
              captarget_outreach_channel: normalizeOutreachChannel(row[COL.response]),
              captarget_interest_type: normalizeInterestType(row[COL.type]),
              website: (row[COL.url] || "").trim() || null,
              main_contact_phone: (row[COL.phone] || "").trim() || null,
              captarget_source_url: (row[COL.source_url] || "").trim() || null,
              deal_source: "captarget",
              status: "captarget_review",
              pushed_to_all_deals: false,
            };

            batchRecords.push(record);
            batchHashes.push(rowHash);
          } catch (rowErr: any) {
            rowsSkipped++;
            syncErrors.push({
              tab: tabName,
              row: i + parsed[j].idx + 2, // 1-indexed + header
              error: rowErr.message,
              data: parsed[j].row.slice(0, 5),
            });
          }
        }

        if (batchRecords.length === 0) continue;

        // Check which hashes already exist
        const { data: existing, error: lookupErr } = await supabase
          .from("listings")
          .select("id, captarget_row_hash")
          .in("captarget_row_hash", batchHashes);

        if (lookupErr) {
          console.error("Hash lookup error:", lookupErr);
          rowsSkipped += batchRecords.length;
          syncErrors.push({ tab: tabName, batch: i, error: lookupErr.message });
          continue;
        }

        const existingMap = new Map(
          (existing || []).map((r: any) => [r.captarget_row_hash, r.id])
        );

        const toInsert: any[] = [];
        const toUpdate: { id: string; record: any }[] = [];

        for (const record of batchRecords) {
          const existingId = existingMap.get(record.captarget_row_hash);
          if (existingId) {
            // Update existing — don't overwrite status or pushed flags
            const { status, pushed_to_all_deals, deal_source, ...updateFields } =
              record;
            toUpdate.push({ id: existingId, record: updateFields });
          } else {
            toInsert.push(record);
          }
        }

        // Batch insert new records
        if (toInsert.length > 0) {
          const { error: insertErr } = await supabase
            .from("listings")
            .insert(toInsert);

          if (insertErr) {
            console.error("Insert error:", insertErr);
            rowsSkipped += toInsert.length;
            syncErrors.push({ tab: tabName, batch: i, op: "insert", error: insertErr.message });
          } else {
            rowsInserted += toInsert.length;
          }
        }

        // Batch update existing records via upsert on primary key
        if (toUpdate.length > 0) {
          const updateRecords = toUpdate.map(({ id, record }) => ({
            id,
            ...record,
          }));
          const { error: updateErr } = await supabase
            .from("listings")
            .upsert(updateRecords, { onConflict: "id" });

          if (updateErr) {
            console.error("Batch update error:", updateErr);
            rowsSkipped += toUpdate.length;
            syncErrors.push({ tab: tabName, batch: i, op: "update", error: updateErr.message });
          } else {
            rowsUpdated += toUpdate.length;
          }
        }

        // Check if we're approaching Edge Function timeout (50s)
        if (Date.now() - startTime > 45000) {
          console.warn(`Approaching timeout during tab "${tabName}", committing partial sync`);
          syncStatus = "partial";
          timedOut = true;
          break;
        }
      }
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
      errors: syncErrors,
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
  };

  console.log("Sync complete:", JSON.stringify(result));

  return new Response(JSON.stringify(result), {
    status: syncStatus === "failed" ? 500 : 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
