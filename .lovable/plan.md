

# Marketplace Queue to Live: Data Population Audit + Copy Cleanup

## Findings

### 1. Financials ARE Populating Correctly
The screenshot shows revenue (4,500,000) and EBITDA (1,500,000) filled in. The data flow works:
- `CreateListingFromDeal` fetches deal data including `revenue` and `ebitda`
- `anonymizeDealToListing` passes them through
- `convertListingToFormInput` converts them to strings for the form
- `useRobustListingCreation` sanitizes them back to numbers via `parseCurrency`

The "Financials inherited from source deal" lock is intentional: when creating from a deal, financial fields are read-only to prevent drift between the deal and its listing. To edit financials, you go to the source deal.

### 2. Admin-Only Fields (Never Visible to Buyers)
These fields exist on the listing but are excluded from `MARKETPLACE_SAFE_COLUMNS`:
- `internal_company_name` (real company name)
- `internal_notes` (admin notes)
- `internal_deal_memo_link` (company website / memo link)
- `internal_salesforce_link`
- `internal_contact_info`
- `main_contact_first_name`, `main_contact_last_name`, `main_contact_email`, `main_contact_phone`, `main_contact_linkedin`
- `primary_owner_id`, `presented_by_admin_id`
- `source_deal_id`
- `investment_thesis`, `competitive_position`, `ownership_structure`, `seller_motivation`
- `pushed_to_marketplace`, `pushed_to_marketplace_at`, `pushed_to_marketplace_by`

Buyers only see the columns in `src/lib/marketplace-columns.ts`, which excludes all `internal_*` fields and contact PII.

### 3. Em Dash / En Dash Violations
Found across multiple files in user-facing copy:

**`src/lib/deal-to-listing-anonymizer.ts`** (BUYER-FACING, highest priority):
- Title templates use ` — ` as separator (e.g., `High-Margin Restoration Business — Southeast`)
- Description section headers use em dashes in comments (harmless) but the title separator appears in generated listing titles

**`src/pages/admin/CreateListingFromDeal.tsx`** (admin-facing):
- 6 toast messages and 1 banner use em dashes
- `formatCurrency` in `MarketplaceQueue.tsx` returns `'—'` for null values

**`src/components/admin/ImprovedListingEditor.tsx`** and **`EditorFinancialCard.tsx`**: comments only (harmless)

### 4. What Actually Needs Fixing

**Problem A: Title separator in anonymizer uses em dash**
The generated titles like `"High-Margin Restoration Business — Southeast"` use em dashes. These titles end up on the marketplace, visible to buyers. Should use a pipe `|` or comma instead.

**Problem B: Admin toast/banner copy uses em dashes**
All toast messages in `CreateListingFromDeal.tsx` contain em dashes. These should use periods or commas.

**Problem C: Null currency display uses em dash**
`MarketplaceQueue.tsx` line 53 returns `'—'` for null values. Should use `'N/A'` or `'-'`.

**Problem D: Banner copy is wordy**
The "Placeholder description" banner (lines 509-518) contains fluff. Should be direct and actionable.

## Changes

### File 1: `src/lib/deal-to-listing-anonymizer.ts`
- Replace ` — ` with ` | ` in all 4 title templates (lines 378, 386, 396, 435)
- These are the only em dashes that reach buyers

### File 2: `src/pages/admin/CreateListingFromDeal.tsx`
- Line 282: `'AI listing generated with validation warnings — review carefully before saving.'` → `'AI listing generated with validation warnings. Review carefully before saving.'`
- Line 285: `'AI content generated — review and edit before saving.'` → `'AI content generated. Review and edit before saving.'`
- Line 290: `'AI listing generation failed — using placeholder description.'` → `'AI listing generation failed. Using placeholder description.'`
- Line 405: `'Marketplace listing created — opening editor for review.'` → `'Marketplace listing created. Opening editor for review.'`
- Lines 509-518: Rewrite banner:
  ```
  Placeholder description. The text below was auto-generated from deal fields
  and is not suitable for publication. To generate a professional listing:
  create a Full Lead Memo in the Data Room first, then re-create this listing.
  ```

### File 3: `src/pages/admin/MarketplaceQueue.tsx`
- Line 53: Replace `'—'` with `'-'` for null currency values

### No structural/data-flow changes needed
The financial population, admin-only field isolation, and data flow from deal to listing are all working correctly. This is purely a copy/typography cleanup.

