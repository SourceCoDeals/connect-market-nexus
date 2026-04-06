

# Strategic Deep Dive: Data Room Access End-to-End

## Current State Summary

The live marketplace listing (Restoration Business, `d543b05b`) was created from source deal `d136656a`. Documents (Anonymous Teaser PDF + Lead Memo PDF) exist **only on the source deal** (`d136656a`). The listing itself has **zero documents**.

---

## Issues Found (Ranked by Severity)

### CRITICAL 1: `data-room-download` Breaks on Source Deal Documents

The `BuyerDataRoom` component correctly falls back to source deal documents when the listing has none. But when the buyer clicks "View" on a document from the source deal, the `data-room-download` edge function checks access using the **document's `deal_id`** (which is the source deal ID, `d136656a`), while the `data_room_access` record was created against the **listing ID** (`d543b05b`).

```text
BuyerDataRoom query:  deal_id = listing_id  → no docs → falls back to source_deal_id → finds docs
data_room_access row: deal_id = listing_id   ✓
check_data_room_access RPC: p_deal_id = doc.deal_id (source_deal_id) → NO MATCH → Access Denied
```

The buyer sees documents listed but **cannot open any of them**. Every click returns 403.

**Fix required**: Either (a) the `check_data_room_access` RPC needs to also check the listing that references the source deal, or (b) documents need to be copied/linked to the listing ID at publish time, or (c) `data_room_access` should be created for the source deal ID too.

### CRITICAL 2: RLS on `data_room_documents` Has the Same Mismatch

The RLS policy `Buyers can view granted documents` joins `data_room_access.deal_id = data_room_documents.deal_id`. When documents are on the source deal but access is on the listing, **RLS blocks the SELECT query entirely**. The fallback query in BuyerDataRoom will return empty results even though documents exist.

The buyer sees "No documents available yet" despite documents existing.

**Fix required**: The RLS policy needs awareness of `source_deal_id` linkage, OR documents must be associated with the listing ID.

### CRITICAL 3: No `data_room_access` Records Exist Yet

Checking the database: zero `data_room_access` records exist for either the listing or the source deal. The auto-provisioning code was just added to `handleAccept`, but no connections have been approved since that code went live. Any previously approved connections have no access records.

**Fix required**: Need a backfill mechanism or at minimum, awareness that existing approved connections won't have access until re-approved or manually granted.

---

### HIGH 1: Listing Editor Has No Document Management

The admin creates a listing from the queue, goes to the editor to polish content, but has **no visibility into what documents are attached**. They cannot:
- See which PDFs are attached (teaser, memo, data room files)
- Upload additional documents
- Verify document readiness before publishing
- See if documents are on the source deal vs. the listing itself

The `publish-listing` edge function checks for memo PDFs and uses `source_deal_id` fallback, so publishing works. But the admin has no visibility.

**Recommendation**: Add a "Documents" section to the listing editor showing attached documents (checking both listing ID and source_deal_id), with upload capability.

### HIGH 2: The "Explore Data Room" Button Flow

The sidebar shows "Explore data room" when `feeCovered && connectionApproved`. This scrolls to the `BuyerDataRoom` component. But:
- If the buyer's connection was approved before the auto-provisioning code existed, they have no `data_room_access` record, so BuyerDataRoom returns `null` (renders nothing)
- The buyer scrolls to an empty section — no error message, no guidance

**Recommendation**: BuyerDataRoom should show a meaningful state when `connectionApproved` is true but `data_room_access` is null (e.g., "Your access is being provisioned, check back shortly" or trigger a self-heal).

### HIGH 3: Fee Agreement Timing Creates Partial Access

The auto-provisioning code sets `can_view_full_memo` and `can_view_data_room` based on whether the fee agreement was signed **at the time of approval**. If a buyer:
1. Gets connection approved (no fee agreement yet) → gets `can_view_teaser: true` only
2. Later signs fee agreement
3. Their access toggles are **never upgraded** — they're stuck with teaser-only

**Recommendation**: Either (a) add a trigger/listener that upgrades access when fee agreement status changes, or (b) the BuyerDataRoom component should check fee agreement status directly and show full docs if signed, regardless of the toggle.

---

### MEDIUM 1: Queue → Listing Document Lifecycle Strategy

Currently, documents uploaded to a deal in the remarketing queue stay on that deal's ID. When the listing is created with `source_deal_id` pointing to the deal, no documents are copied or re-linked. This creates the two-ID problem above.

Two viable strategies:
1. **Copy on publish**: When `publish-listing` runs, copy all `data_room_documents` from source_deal to listing ID. Clean separation, but doubles storage.
2. **Dual-ID awareness**: Make all access checks, RLS policies, and download functions aware of the `source_deal_id` linkage. More complex but no data duplication.

Strategy 2 is more maintainable since documents may be updated on the source deal after publishing.

### MEDIUM 2: What Documents Should Buyers Actually See?

Currently the data room can show three categories:
- `anonymous_teaser` — the anonymized pitch PDF
- `full_memo` — the detailed CIM with real company info
- `data_room` — additional files (financials, tax returns, etc.)

For the restoration deal, only teaser and memo exist. There are no `data_room` category documents. This means even with full access, the buyer only sees 2 PDFs. Is this the intended experience, or should more documents be uploaded before publishing?

**Recommendation**: The publish gate should optionally warn (not block) if no `data_room` category documents exist.

### MEDIUM 3: Listing Editor Should Surface Document Upload

When an admin edits a listing in "Ready to Publish" state, they should be able to:
1. See documents attached to the source deal
2. Upload additional documents directly to the listing
3. See which categories are covered (teaser ✓, memo ✓, data room ✗)
4. Get a clear publish-readiness indicator

This doesn't exist anywhere in the current editor flow.

---

### LOW 1: Audit Trail Gap

The `data-room-download` function logs access with `doc.deal_id` (source deal ID). If an admin looks at analytics for the listing, they won't see these access events. The audit trail should reference both the document's deal_id and the listing the buyer accessed it through.

### LOW 2: Data Room Access Expiry

`data_room_access` has an `expires_at` column. The auto-provisioning code doesn't set it. Should there be a default expiry? This is a business decision.

---

## Recommended Implementation Order

1. **Fix the deal_id mismatch** (Critical 1 + 2): Make `check_data_room_access` RPC and the RLS policy aware of `source_deal_id`. When checking access for a document on `deal_id = X`, also check if there's a listing with `source_deal_id = X` that has access for the user.

2. **Fix the download function** (Critical 1): Update `data-room-download` to resolve the listing ID from the document's deal_id via `source_deal_id` and check access against both.

3. **Add document section to listing editor** (High 1): Show attached documents from both listing ID and source_deal_id, with upload/manage capability.

4. **Add fee agreement upgrade listener** (High 3): When a buyer's fee agreement becomes signed, auto-upgrade their `data_room_access` toggles.

5. **BuyerDataRoom empty state improvement** (High 2): Show actionable guidance instead of silent nothing.

6. **Backfill script** (Critical 3): For any existing approved connections without `data_room_access` records, create them.

## Key Decision Point

The fundamental architectural question: **should documents be linked to the listing ID at publish time, or should the system be made aware of the source_deal_id chain everywhere?**

- **Option A: Copy/re-link at publish** — Simpler ongoing logic, but requires a publish-time migration step and documents on the source deal won't auto-sync to the listing.
- **Option B: Dual-ID awareness** — More complex (RLS, RPC, download function all need updating) but documents stay in one place and updates propagate automatically.

I recommend **Option B** because admins will continue to manage documents on the source deal, and expecting them to also manage a separate copy on the listing is error-prone.

