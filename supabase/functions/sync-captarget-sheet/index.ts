import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BATCH_SIZE = 100;

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
    throw new Error(`Sheets API error: ${resp.status} – ${errText}`);
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

  try {
    // Load Google service account credentials
    const saKeyRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!saKeyRaw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not configured");
    const saKey = JSON.parse(saKeyRaw);

    const sheetId = Deno.env.get("CAPTARGET_SHEET_ID");
    if (!sheetId) throw new Error("CAPTARGET_SHEET_ID not configured");

    const tabName = Deno.env.get("CAPTARGET_TAB_NAME") || "Sheet1";

    // Authenticate and fetch sheet data
    const accessToken = await getAccessToken(saKey);
    const allRows = await fetchSheetRows(accessToken, sheetId, tabName);

    if (allRows.length < 2) {
      throw new Error("Sheet has no data rows (only header or empty)");
    }

    // Skip header row (row 0) and skip 'Last Updated' metadata row if present
    const dataRows = allRows.slice(1).filter((row) => {
      const firstCell = (row[0] || "").trim().toLowerCase();
      return firstCell !== "last updated" && firstCell !== "";
    });

    rowsRead = dataRows.length;
    console.log(`Read ${rowsRead} data rows from sheet`);

    // Process in batches
    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE);
      const batchRecords: any[] = [];
      const batchHashes: string[] = [];

      for (const row of batch) {
        try {
          const clientName = (row[COL.client_folder_name] || "").trim();
          const companyName = (row[COL.company_name] || "").trim();
          const dateRaw = (row[COL.date] || "").trim();
          const firstName = (row[COL.first_name] || "").trim();
          const lastName = (row[COL.last_name] || "").trim();

          // Generate composite hash for dedup
          const hashInput = `${clientName}|${companyName}|${dateRaw}`;
          const rowHash = await computeHash(hashInput);

          const contactDate = parseDate(dateRaw);
          const contactName = [firstName, lastName].filter(Boolean).join(" ");

          const record: Record<string, any> = {
            captarget_row_hash: rowHash,
            captarget_client_name: clientName || null,
            title: companyName || null,
            internal_company_name: companyName || null,
            captarget_contact_date: contactDate,
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
            deal_source: "captarget",
            status: "captarget_review",
            pushed_to_all_deals: false,
          };

          batchRecords.push(record);
          batchHashes.push(rowHash);
        } catch (rowErr: any) {
          rowsSkipped++;
          syncErrors.push({
            row: i + batch.indexOf(row) + 2, // 1-indexed + header
            error: rowErr.message,
            data: row.slice(0, 5), // first 5 cols for debugging
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
        syncErrors.push({ batch: i, error: lookupErr.message });
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
          syncErrors.push({ batch: i, op: "insert", error: insertErr.message });
        } else {
          rowsInserted += toInsert.length;
        }
      }

      // Update existing records one by one (to preserve individual row integrity)
      for (const { id, record } of toUpdate) {
        const { error: updateErr } = await supabase
          .from("listings")
          .update(record)
          .eq("id", id);

        if (updateErr) {
          rowsSkipped++;
          syncErrors.push({ id, op: "update", error: updateErr.message });
        } else {
          rowsUpdated++;
        }
      }

      // Check if we're approaching Edge Function timeout (50s)
      if (Date.now() - startTime > 45000) {
        console.warn("Approaching timeout, committing partial sync");
        syncStatus = "partial";
        break;
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
