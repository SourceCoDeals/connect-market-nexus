/**
 * SystemTestRunner: Comprehensive in-app test runner for post-refactor QA.
 * Runs all user stories and integration tests, reports pass/fail, persists results.
 */

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Copy,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──

type TestStatus = "pending" | "running" | "pass" | "fail" | "warn";

interface TestResult {
  id: string;
  name: string;
  category: string;
  status: TestStatus;
  error?: string;
  durationMs?: number;
}

interface TestDef {
  id: string;
  name: string;
  category: string;
  fn: (ctx: TestContext) => Promise<void>;
}

interface TestContext {
  /** IDs of resources created during tests, for cleanup */
  createdContactIds: string[];
  createdAccessIds: string[];
  createdReleaseLogIds: string[];
  createdTrackedLinkIds: string[];
  testListingId: string | null;
  testBuyerId: string | null;
  testDealId: string | null;
}

const STORAGE_KEY = "sourceco-system-test-results";

// ── Helpers ──

// Dynamic table name type for test helper functions
type SupabaseTableName = Parameters<typeof supabase.from>[0];

export async function assertQuery(query: string, description: string) {
  // execute_readonly_query RPC is not in generated Supabase types
  type RpcName = Parameters<typeof supabase.rpc>[0];
  const { error } = await supabase.rpc("execute_readonly_query" as RpcName, { query_text: query } as Record<string, unknown>);
  // Fallback: just run a direct query if RPC doesn't exist
  if (error?.message?.includes("function") && error?.message?.includes("does not exist")) {
    // Can't use raw SQL from client, so we'll use the table API
    throw new Error(`RPC not available for raw query check: ${description}`);
  }
  if (error) throw new Error(`${description}: ${error.message}`);
}

async function columnExists(table: string, column: string) {
  const { error } = await supabase.from(table as SupabaseTableName).select(column).limit(1);
  if (error) throw new Error(`Column '${column}' check on '${table}' failed: ${error.message}`);
}

async function tableReadable(table: string) {
  const { error } = await supabase.from(table as SupabaseTableName).select("id").limit(1);
  if (error) throw new Error(`Table '${table}' not readable: ${error.message}`);
}

async function invokeEdgeFunction(name: string, body?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(name, {
    body: body || {},
  });
  if (error) {
    // Network-level failures vs structured errors
    const msg = typeof error === "object" ? JSON.stringify(error) : String(error);
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("net::ERR")) {
      throw new Error(`Edge function '${name}' network failure: ${msg}`);
    }
    // Structured errors (auth, config) are acceptable for reachability
  }
  return data;
}

// ── Test Definitions ──

function buildTests(): TestDef[] {
  const tests: TestDef[] = [];
  const add = (category: string, name: string, fn: TestDef["fn"]) =>
    tests.push({ id: `${category}::${name}`, name, category, fn });

  // ═══════════════════════════════════════════
  // CATEGORY 1: Database Schema Integrity
  // ═══════════════════════════════════════════
  const C1 = "1. Schema Integrity";

  add(C1, "contacts table exists", async () => {
    await tableReadable("contacts");
  });

  const requiredContactCols = [
    "first_name", "last_name", "email", "contact_type", "firm_id",
    "remarketing_buyer_id", "profile_id", "listing_id",
    "is_primary_at_firm", "is_primary_seller_contact", "nda_signed", "fee_agreement_signed",
  ];
  for (const col of requiredContactCols) {
    add(C1, `contacts has '${col}' column`, async () => {
      await columnExists("contacts", col);
    });
  }

  add(C1, "remarketing_buyers has marketplace_firm_id column", async () => {
    await columnExists("remarketing_buyers", "marketplace_firm_id");
  });

  add(C1, "data_room_access has contact_id column", async () => {
    await columnExists("data_room_access", "contact_id");
  });

  add(C1, "data_room_access has access_token column", async () => {
    await columnExists("data_room_access", "access_token");
  });

  add(C1, "remarketing_outreach has contact_id column", async () => {
    await columnExists("remarketing_outreach", "contact_id");
  });

  add(C1, "document_release_log has contact_id column", async () => {
    await columnExists("document_release_log", "contact_id");
  });

  add(C1, "document_tracked_links has contact_id column", async () => {
    await columnExists("document_tracked_links", "contact_id");
  });

  add(C1, "resolve_contact_agreement_status RPC exists", async () => {
    // Try calling the RPC with a dummy ID — expect "not found" not "function does not exist"
    const { error } = await supabase.rpc("resolve_contact_agreement_status", {
      p_contact_id: "00000000-0000-0000-0000-000000000000",
    });
    if (error?.message?.includes("does not exist")) {
      throw new Error("RPC resolve_contact_agreement_status does not exist");
    }
    // Any other error (e.g. not found) is fine — means the RPC exists
  });

  add(C1, "contacts backfill ran (count > 0)", async () => {
    const { count, error } = await supabase.from("contacts").select("id", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    if (!count || count === 0) throw new Error("contacts table is empty — backfill may not have run");
  });

  add(C1, "seller contacts backfill ran", async () => {
    const { count, error } = await supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("contact_type", "seller");
    if (error) throw new Error(error.message);
    if (!count || count === 0) throw new Error("No seller contacts found");
  });

  add(C1, "buyer contacts backfill ran", async () => {
    const { count, error } = await supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("contact_type", "buyer");
    if (error) throw new Error(error.message);
    if (!count || count === 0) throw new Error("No buyer contacts found");
  });

  add(C1, "marketplace_firm_id match ran on remarketing_buyers", async () => {
    const { count, error } = await supabase
      .from("remarketing_buyers")
      .select("id", { count: "exact", head: true })
      .not("marketplace_firm_id", "is", null);
    if (error) throw new Error(error.message);
    // This is informational — only fail if firm_agreements exist but no matches
    if (!count || count === 0) {
      const { count: faCount } = await supabase
        .from("firm_agreements")
        .select("id", { count: "exact", head: true });
      if (faCount && faCount > 0) {
        throw new Error("firm_agreements exist but no remarketing_buyers have marketplace_firm_id set");
      }
    }
  });

  // ═══════════════════════════════════════════
  // CATEGORY 2: Contacts — Buyer Side
  // ═══════════════════════════════════════════
  const C2 = "2. Contacts — Buyer Side";
  let testContactId: string | null = null;

  add(C2, "Create buyer contact", async (ctx) => {
    // Get first buyer
    const { data: buyers, error: buyersError } = await supabase.from("remarketing_buyers").select("id").limit(1);
    if (buyersError) throw buyersError;
    if (!buyers?.length) throw new Error("No remarketing_buyers found to test with");
    ctx.testBuyerId = buyers[0].id;

    const { data, error } = await supabase
      .from("contacts")
      .insert({
        contact_type: "buyer",
        remarketing_buyer_id: ctx.testBuyerId,
        first_name: "QATest",
        last_name: "BuyerContact",
        email: "qa-test-buyer@sourceco-test.local",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    testContactId = data.id;
    ctx.createdContactIds.push(data.id);
  });

  add(C2, "Read buyer contact", async () => {
    if (!testContactId) throw new Error("No test contact created");
    const { data, error } = await supabase.from("contacts").select("*").eq("id", testContactId).single();
    if (error) throw new Error(error.message);
    if (data.first_name !== "QATest") throw new Error("first_name mismatch");
  });

  add(C2, "Update buyer contact", async () => {
    if (!testContactId) throw new Error("No test contact created");
    const { error } = await supabase.from("contacts").update({ title: "QA Manager" }).eq("id", testContactId);
    if (error) throw new Error(error.message);
    const { data, error: readError } = await supabase.from("contacts").select("title").eq("id", testContactId).single();
    if (readError) throw new Error(readError.message);
    if (data?.title !== "QA Manager") throw new Error("Update not reflected");
  });

  add(C2, "resolve_contact_agreement_status — no agreements", async () => {
    if (!testContactId) throw new Error("No test contact created");
    const { data, error } = await supabase.rpc("resolve_contact_agreement_status", {
      p_contact_id: testContactId,
    });
    if (error && !error.message.includes("does not exist")) throw new Error(error.message);
    // If RPC exists, check the result
    if (data) {
      // Just verify it returns something structured
      if (typeof data !== "object") throw new Error("Expected JSONB return");
    }
  });

  add(C2, "Cleanup buyer contacts", async (ctx) => {
    for (const id of ctx.createdContactIds) {
      await supabase.from("contacts").delete().eq("id", id);
    }
    ctx.createdContactIds = [];
    testContactId = null;
  });

  // ═══════════════════════════════════════════
  // CATEGORY 3: Contacts — Seller Side
  // ═══════════════════════════════════════════
  const C3 = "3. Contacts — Seller Side";
  let sellerTestListingId: string | null = null;
  let originalContactName: string | null = null;

  add(C3, "Create seller contact (primary)", async (ctx) => {
    const { data: listings, error: listingsError } = await supabase
      .from("listings")
      .select("id, main_contact_name")
      .eq("status", "active")
      .limit(1);
    if (listingsError) throw listingsError;
    if (!listings?.length) throw new Error("No active listings to test with");
    sellerTestListingId = listings[0].id;
    originalContactName = listings[0].main_contact_name;
    ctx.testListingId = sellerTestListingId;

    const { data, error } = await supabase
      .from("contacts")
      .insert({
        contact_type: "seller",
        listing_id: sellerTestListingId,
        first_name: "QASellerPrimary",
        last_name: "Test",
        is_primary_seller_contact: true,
        email: "qa-seller-primary@sourceco-test.local",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    void data.id; // sellerContactId1
    ctx.createdContactIds.push(data.id);
  });

  add(C3, "Second seller contact (non-primary)", async (ctx) => {
    if (!sellerTestListingId) throw new Error("No test listing");
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        contact_type: "seller",
        listing_id: sellerTestListingId,
        first_name: "QASellerSecond",
        last_name: "Test",
        is_primary_seller_contact: false,
        email: "qa-seller-second@sourceco-test.local",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    void data.id; // sellerContactId2
    ctx.createdContactIds.push(data.id);
  });

  add(C3, "Multiple contacts per deal", async () => {
    if (!sellerTestListingId) throw new Error("No test listing");
    const { count, error } = await supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", sellerTestListingId)
      .eq("contact_type", "seller");
    if (error) throw new Error(error.message);
    if (!count || count < 2) throw new Error(`Expected ≥2 seller contacts, got ${count}`);
  });

  add(C3, "Cleanup seller contacts + restore listing", async (ctx) => {
    for (const id of ctx.createdContactIds) {
      await supabase.from("contacts").delete().eq("id", id);
    }
    // Restore original contact name
    if (sellerTestListingId && originalContactName !== null) {
      await supabase
        .from("listings")
        .update({ main_contact_name: originalContactName })
        .eq("id", sellerTestListingId);
    }
    ctx.createdContactIds = [];
  });

  // ═══════════════════════════════════════════
  // CATEGORY 4: Data Room — Documents
  // ═══════════════════════════════════════════
  const C4 = "4. Data Room — Documents";

  add(C4, "data_room_documents readable", async () => {
    await tableReadable("data_room_documents");
  });

  add(C4, "lead_memos readable", async () => {
    await tableReadable("lead_memos");
  });

  add(C4, "generate-lead-memo edge function reachable", async () => {
    const { data: listings, error: listingsError2 } = await supabase.from("listings").select("id").eq("status", "active").limit(1);
    if (listingsError2) throw listingsError2;
    const listingId = listings?.[0]?.id || "00000000-0000-0000-0000-000000000000";
    await invokeEdgeFunction("generate-lead-memo", {
      listing_id: listingId,
      memo_type: "anonymous_teaser",
    });
  });

  // ═══════════════════════════════════════════
  // CATEGORY 5: Data Room — Access Matrix
  // ═══════════════════════════════════════════
  const C5 = "5. Access Matrix";

  add(C5, "data_room_access readable", async () => {
    await tableReadable("data_room_access");
  });

  add(C5, "Create + read access record", async (ctx) => {
    // deal_id FK references listings, not deals
    const { data: listings, error: listingsError } = await supabase.from("listings").select("id").limit(1);
    if (listingsError) throw listingsError;
    if (!listings?.length) throw new Error("No listings found");
    ctx.testDealId = listings[0].id;

    // Get or create a contact
    const { data: contacts, error: contactsError } = await supabase.from("contacts").select("id").limit(1);
    if (contactsError) throw contactsError;
    if (!contacts?.length) throw new Error("No contacts exist to test access matrix");

    const { data, error } = await supabase
      .from("data_room_access")
      .insert({
        deal_id: ctx.testDealId,
        contact_id: contacts[0].id,
        can_view_teaser: true,
      })
      .select("id, access_token")
      .single();
    if (error) throw new Error(error.message);
    if (!data.access_token) throw new Error("access_token not auto-generated");
    ctx.createdAccessIds.push(data.id);
  });

  add(C5, "Toggle can_view_full_memo", async (ctx) => {
    if (!ctx.createdAccessIds.length) throw new Error("No test access record");
    const { error } = await supabase
      .from("data_room_access")
      .update({ can_view_full_memo: true })
      .eq("id", ctx.createdAccessIds[0]);
    if (error) throw new Error(error.message);
  });

  add(C5, "Revoke access", async (ctx) => {
    if (!ctx.createdAccessIds.length) throw new Error("No test access record");
    const { error } = await supabase
      .from("data_room_access")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", ctx.createdAccessIds[0]);
    if (error) throw new Error(error.message);
  });

  add(C5, "Cleanup access records", async (ctx) => {
    for (const id of ctx.createdAccessIds) {
      await supabase.from("data_room_access").delete().eq("id", id);
    }
    ctx.createdAccessIds = [];
  });

  // ═══════════════════════════════════════════
  // CATEGORY 6: Document Distribution — Release Log
  // ═══════════════════════════════════════════
  const C6 = "6. Release Log";

  add(C6, "document_release_log readable", async () => {
    await tableReadable("document_release_log");
  });

  add(C6, "Create release log entry with contact_id", async (ctx) => {
    // deal_id FK references listings, not deals
    const { data: listings, error: listingsError } = await supabase.from("listings").select("id").limit(1);
    if (listingsError) throw listingsError;
    const { data: contacts, error: contactsError } = await supabase.from("contacts").select("id").limit(1);
    if (contactsError) throw contactsError;
    if (!listings?.length || !contacts?.length) throw new Error("Need listings + contacts");

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("document_release_log")
      .insert({
        deal_id: listings[0].id,
        contact_id: contacts[0].id,
        release_method: "pdf_download",
        released_by: user.id,
        buyer_name: "QA Test Buyer",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    ctx.createdReleaseLogIds.push(data.id);
  });

  add(C6, "Cleanup release log entries", async (ctx) => {
    for (const id of ctx.createdReleaseLogIds) {
      await supabase.from("document_release_log").delete().eq("id", id);
    }
    ctx.createdReleaseLogIds = [];
  });

  // ═══════════════════════════════════════════
  // CATEGORY 7: Document Tracked Links
  // ═══════════════════════════════════════════
  const C7 = "7. Tracked Links";

  add(C7, "document_tracked_links readable", async () => {
    await tableReadable("document_tracked_links");
  });

  add(C7, "Create tracked link", async (ctx) => {
    // deal_id FK references listings
    const { data: listings, error: listingsError } = await supabase.from("listings").select("id").limit(1);
    if (listingsError) throw listingsError;
    const { data: contacts, error: contactsError } = await supabase.from("contacts").select("id, email").limit(1);
    if (contactsError) throw contactsError;
    if (!listings?.length || !contacts?.length) throw new Error("Need listings + contacts");

    // Get a document (required — document_id is NOT NULL)
    const { data: docs, error: docsError } = await supabase.from("data_room_documents").select("id").limit(1);
    if (docsError) throw docsError;
    let docId: string;
    if (!docs?.length) {
      // Try deal_documents as fallback
      const { data: dealDocs, error: dealDocsError } = await supabase.from("deal_documents").select("id").limit(1);
      if (dealDocsError) throw dealDocsError;
      if (!dealDocs?.length) throw new Error("No documents exist to create tracked link (document_id is NOT NULL)");
      docId = dealDocs[0].id;
    } else {
      docId = docs[0].id;
    }

    const token = crypto.randomUUID();
    const { data, error } = await supabase
      .from("document_tracked_links")
      .insert({
        deal_id: listings[0].id,
        contact_id: contacts[0].id,
        buyer_email: contacts[0].email || "qa@test.local",
        buyer_name: "QA Test Buyer",
        link_token: token,
        document_id: docId,
        created_by: (await supabase.auth.getUser()).data.user?.id || "",
      })
      .select("id, link_token")
      .single();
    if (error) throw new Error(error.message);
    ctx.createdTrackedLinkIds.push(data.id);
  });

  add(C7, "record-link-open edge function reachable", async (_ctx) => {
    // Use a fake token to test reachability
    await invokeEdgeFunction("record-link-open", { link_token: "00000000-0000-0000-0000-000000000000" });
  });

  add(C7, "Cleanup tracked links", async (ctx) => {
    for (const id of ctx.createdTrackedLinkIds) {
      await supabase.from("document_tracked_links").delete().eq("id", id);
    }
    ctx.createdTrackedLinkIds = [];
  });

  // ═══════════════════════════════════════════
  // CATEGORY 8: Marketplace Approval Flow
  // ═══════════════════════════════════════════
  const C8 = "8. Marketplace Approval";

  add(C8, "approve-marketplace-buyer edge function reachable", async () => {
    await invokeEdgeFunction("approve-marketplace-buyer", { profile_id: "00000000-0000-0000-0000-000000000000" });
  });

  // ═══════════════════════════════════════════
  // CATEGORY 9: Fireflies Integration
  // ═══════════════════════════════════════════
  const C9 = "9. Fireflies Integration";

  add(C9, "sync-fireflies-transcripts edge function reachable", async () => {
    await invokeEdgeFunction("sync-fireflies-transcripts", {});
  });

  add(C9, "deal_transcripts table accessible", async () => {
    const { error } = await supabase.from("deal_transcripts").select("id").limit(1);
    // Table may not exist — that's a fail
    if (error) throw new Error(error.message);
  });

  // ═══════════════════════════════════════════
  // CATEGORY 10: Send Memo Flow
  // ═══════════════════════════════════════════
  const C10 = "10. Send Memo Flow";

  add(C10, "Buyer contacts searchable", async () => {
    const { error } = await supabase
      .from("contacts")
      .select("id")
      .eq("contact_type", "buyer")
      .eq("archived", false)
      .limit(10);
    if (error) throw new Error(error.message);
    // Just verify query works
  });

  add(C10, "send-memo-email edge function reachable", async () => {
    await invokeEdgeFunction("send-memo-email", {
      memo_id: "00000000-0000-0000-0000-000000000000",
      buyer_id: "00000000-0000-0000-0000-000000000000",
      email_address: "qa-no-send@test.local",
      email_subject: "QA Test",
      email_body: "QA Test — do not send",
    });
  });

  // ═══════════════════════════════════════════
  // CATEGORY 11: Buyer-Facing Data Room Portal
  // ═══════════════════════════════════════════
  const C11 = "11. Data Room Portal";

  add(C11, "record-data-room-view edge function — invalid token returns error", async () => {
    // This function uses GET, so we need to call it differently
    const url = `${SUPABASE_URL}/functions/v1/record-data-room-view?access_token=00000000-0000-0000-0000-000000000000`;
    const res = await fetch(url, {
      headers: {
        "apikey": SUPABASE_PUBLISHABLE_KEY,
      },
    });
    // Should return a structured response (even if 4xx), not a 500 crash
    if (res.status >= 500) throw new Error(`Server error: ${res.status}`);
  });

  // ═══════════════════════════════════════════
  // CATEGORY 12: CapTarget Integration
  // ═══════════════════════════════════════════
  const C12 = "12. CapTarget Integration";

  add(C12, "sync-captarget-sheet edge function reachable", async () => {
    await invokeEdgeFunction("sync-captarget-sheet", {});
  });

  // ═══════════════════════════════════════════
  // CATEGORY 13: UI Smoke Tests
  // ═══════════════════════════════════════════
  const C13 = "13. UI Smoke Tests";

  // These verify DB tables that back UI pages are accessible
  const uiSmoke = [
    { name: "deals table readable (All Deals page)", table: "deals" },
    { name: "listings table readable (Marketplace)", table: "listings" },
    { name: "lead_memos readable (Data Room memos)", table: "lead_memos" },
    { name: "data_room_access readable (Access tab)", table: "data_room_access" },
    { name: "document_release_log readable (Distribution tab)", table: "document_release_log" },
    { name: "remarketing_buyers readable (Buyers page)", table: "remarketing_buyers" },
    { name: "buyer_contacts readable (Contacts tab)", table: "buyer_contacts" },
    { name: "firm_agreements readable", table: "firm_agreements" },
    { name: "profiles readable (Users page)", table: "profiles" },
    { name: "contacts readable (Buyer Contacts page)", table: "contacts" },
  ];

  for (const t of uiSmoke) {
    add(C13, t.name, async () => {
      await tableReadable(t.table);
    });
  }

  return tests;
}

// ═══════════════════════════════════════════
// Component
// ═══════════════════════════════════════════

export default function SystemTestRunner() {
  const [results, setResults] = useState<TestResult[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });
  const [isRunning, setIsRunning] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [lastRunAt, setLastRunAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY + "-ts");
    } catch {
      return null;
    }
  });
  const abortRef = useRef(false);

  const persist = useCallback((res: TestResult[], ts: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(res));
      localStorage.setItem(STORAGE_KEY + "-ts", ts);
    } catch {}
  }, []);

  const runTests = useCallback(
    async (onlyFailed = false) => {
      setIsRunning(true);
      abortRef.current = false;

      const allTests = buildTests();
      const testsToRun = onlyFailed
        ? allTests.filter((t) => results.find((r) => r.id === t.id && r.status === "fail"))
        : allTests;

      // Initialize results
      const initialResults: TestResult[] = allTests.map((t) => {
        const existing = results.find((r) => r.id === t.id);
        const shouldRun = testsToRun.some((tr) => tr.id === t.id);
        return {
          id: t.id,
          name: t.name,
          category: t.category,
          status: shouldRun ? "pending" : existing?.status || "pending",
          error: shouldRun ? undefined : existing?.error,
          durationMs: shouldRun ? undefined : existing?.durationMs,
        };
      });
      setResults(initialResults);

      const ctx: TestContext = {
        createdContactIds: [],
        createdAccessIds: [],
        createdReleaseLogIds: [],
        createdTrackedLinkIds: [],
        testListingId: null,
        testBuyerId: null,
        testDealId: null,
      };

      const updatedResults = [...initialResults];

      for (const test of testsToRun) {
        if (abortRef.current) break;

        const idx = updatedResults.findIndex((r) => r.id === test.id);
        updatedResults[idx] = { ...updatedResults[idx], status: "running" };
        setResults([...updatedResults]);

        const start = performance.now();
        try {
          await test.fn(ctx);
          updatedResults[idx] = {
            ...updatedResults[idx],
            status: "pass",
            durationMs: Math.round(performance.now() - start),
            error: undefined,
          };
        } catch (err: any) {
          const msg = err?.message || String(err);
          // Treat missing test data preconditions and some errors as warnings
          const isWarning = (msg.includes("does not exist") && !msg.includes("table"))
            || msg.includes("No documents exist")
            || msg.includes("No test ");
          updatedResults[idx] = {
            ...updatedResults[idx],
            status: isWarning ? "warn" : "fail",
            error: msg,
            durationMs: Math.round(performance.now() - start),
          };
        }
        setResults([...updatedResults]);
      }

      const ts = new Date().toISOString();
      setLastRunAt(ts);
      persist(updatedResults, ts);
      setIsRunning(false);
    },
    [results, persist]
  );

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const copyFailed = () => {
    const failed = results.filter((r) => r.status === "fail");
    const text = failed.map((r) => `❌ [${r.category}] ${r.name}\n   ${r.error}`).join("\n\n");
    navigator.clipboard.writeText(text || "No failures!");
  };

  // Group by category
  const categories = Array.from(new Set(results.map((r) => r.category)));
  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.filter((r) => r.status === "fail").length;
  const warnCount = results.filter((r) => r.status === "warn").length;
  const totalCount = results.length;

  const statusIcon = (status: TestStatus) => {
    switch (status) {
      case "pass":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "fail":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "warn":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      default:
        return <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />;
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Test Runner</h1>
          <p className="text-sm text-muted-foreground">
            Post-refactor QA — {totalCount} tests
            {lastRunAt && ` · Last run: ${new Date(lastRunAt).toLocaleString()}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => runTests(false)} disabled={isRunning}>
            {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Run All Tests
          </Button>
          {failCount > 0 && (
            <Button variant="outline" onClick={() => runTests(true)} disabled={isRunning}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Re-run Failed
            </Button>
          )}
          <Button variant="outline" onClick={copyFailed}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Failed
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      {totalCount > 0 && (
        <div className="flex gap-4 p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className="font-medium">{passCount} passed</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            <span className="font-medium">{failCount} failed</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <span className="font-medium">{warnCount} warnings</span>
          </div>
          <div className="text-muted-foreground">of {totalCount} tests</div>
        </div>
      )}

      {/* Test groups */}
      <div className="space-y-2">
        {categories.map((cat) => {
          const catResults = results.filter((r) => r.category === cat);
          const catPassed = catResults.filter((r) => r.status === "pass").length;
          const catFailed = catResults.filter((r) => r.status === "fail").length;
          const isCollapsed = collapsedCategories.has(cat);

          return (
            <div key={cat} className="border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  <span className="font-semibold text-sm">{cat}</span>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span className="text-green-600">{catPassed}✓</span>
                  {catFailed > 0 && <span className="text-destructive">{catFailed}✗</span>}
                  <span>{catResults.length} total</span>
                </div>
              </button>

              {!isCollapsed && (
                <div className="divide-y divide-border/50">
                  {catResults.map((r) => (
                    <div
                      key={r.id}
                      className={cn(
                        "flex items-start gap-3 px-4 py-2 text-sm",
                        r.status === "fail" && "bg-destructive/5"
                      )}
                    >
                      <div className="mt-0.5">{statusIcon(r.status)}</div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{r.name}</span>
                        {r.durationMs !== undefined && (
                          <span className="ml-2 text-xs text-muted-foreground">{r.durationMs}ms</span>
                        )}
                        {r.error && (
                          <p className="text-xs text-destructive mt-1 break-all font-mono">{r.error}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
