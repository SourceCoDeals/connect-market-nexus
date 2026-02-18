
# CTO-Level Audit: Valuation Calculator Leads Section

## Executive Summary

The Valuation Leads page has solid foundational data and core push mechanics, but is **missing several critical features** that exist in peer tracker pages (GP Partners, CapTarget). It is not yet at parity with those modules and cannot support a full operator workflow without the following gaps being addressed.

---

## 1. Critical Missing Feature: No Click-Through to Deal Detail Page

**Severity: HIGH — Blocking**

- GP Partners: Each row is clickable → navigates to `/admin/remarketing/gp-partner-deals/:dealId` (the full `ReMarketingDealDetail` page)
- CapTarget: Same pattern — clickable rows, full detail page
- **Valuation Leads: NO row click navigation.** The `TableRow` has no `onClick` handler and no `cursor-pointer` class.

**Two distinct scenarios need handling:**
1. **Pushed leads** (`pushed_listing_id` is set) → should navigate to `/admin/remarketing/deals/:pushed_listing_id` (the existing `ReMarketingDealDetail` page, reused)
2. **Unpushed leads** (no `pushed_listing_id`) → should open a **lead detail drawer/modal** or a dedicated page at `/admin/remarketing/valuation-leads/:leadId` showing:
   - Full contact info, raw calculator inputs, valuation range, scoring notes
   - Push / Push & Enrich buttons
   - Raw JSON from `raw_calculator_inputs` and `raw_valuation_results`

**Current router config (App.tsx line 206):**
```
<Route path="valuation-leads" element={<ValuationLeads />} />
```
There is no `valuation-leads/:leadId` child route.

---

## 2. Missing: "Enrich All" Global Button

**Severity: HIGH**

- GP Partners header has: **Enrich (dropdown: Enrich Unenriched / Re-enrich All)** — uses `process-enrichment-queue`
- CapTarget header has the same pattern
- **Valuation Leads: No global "Enrich All" button in the header.** The only enrichment actions are selection-based (bulk toolbar) for pushed leads only.

What's needed:
- "Enrich All Pushed" — finds all leads with `pushed_listing_id` and queues them via `enrichment_queue`
- "Enrich Unenriched Pushed" — same but filtered to those never enriched
- Should integrate with the Global Activity Queue (`useGlobalGateCheck`) like GP Partners does, for progress tracking

The `Score` dropdown IS present (Score Unscored / Recalculate All), but it only scores leads in `valuation_leads`, not the downstream listings.

---

## 3. Missing: Advanced Filter Bar

**Severity: MEDIUM**

- GP Partners uses `useFilterEngine` + `FilterBar` + `GP_PARTNER_FIELDS` — supports dynamic multi-field filtering (industry, owner, revenue range, enriched status, etc.)
- CapTarget uses `useFilterEngine` + `FilterBar` + `CAPTARGET_FIELDS`
- **Valuation Leads: No filter bar at all.** Only a timeframe selector and tab-based calculator type filter exist.

What's missing:
- Filter by industry, exit timing, quality tier, lead score range, pushed/unpushed status, open to intros
- Search box (currently no search input)
- A `VALUATION_LEAD_FIELDS` filter definition needs to be created and integrated with `useFilterEngine`

---

## 4. Missing: Export CSV Button

**Severity: MEDIUM**

- GP Partners bulk toolbar has: Export CSV
- **Valuation Leads: No CSV export at all**, neither in the header nor in the selection toolbar

Fields to export: business name, contact name, email, phone, website, industry, revenue, EBITDA, valuation range, lead score, exit timing, open to intros, status, pushed date.

---

## 5. Dual "Push & Enrich" Logic Inconsistency

**Severity: MEDIUM — Data Quality Risk**

There are **two separate `handlePushAndEnrich` implementations** in `ValuationLeads.tsx`:

1. **Lines 616–679**: The cleaner version — uses `buildListingFromLead()` (which maps all 20+ fields), queues via `enrichment_queue` upsert directly
2. **Lines (previously removed in last diff)**: An older version that used a simplified insert (only 9 fields), losing contact info, seller motivation, internal notes, etc.

The current surviving version at lines 616–679 has a bug: it **does NOT use `buildListingFromLead()`** — it uses an inline simplified object (line 629–641) with only: `title`, `internal_company_name`, `website`, `location`, `revenue`, `ebitda`, `deal_source`, `status`, `is_internal_deal`. This means ~15 fields from `buildListingFromLead()` (contact name, phone, email, seller motivation, internal notes, address breakdown, etc.) are **lost** on Push & Enrich.

Meanwhile, `handlePushToAllDeals` (lines 536–588) correctly uses `buildListingFromLead()`.

---

## 6. Missing: Row Number Column

**Severity: LOW**

- GP Partners table has a `#` column showing row index (e.g., 1, 2, 3...)
- CapTarget table has the same
- **Valuation Leads: No row number.** Makes it harder to reference specific records in conversation

---

## 7. Missing: Deal Owner Assignment

**Severity: LOW-MEDIUM**

- GP Partners has an inline `Select` dropdown in each row for assigning a deal owner (via `profiles` table)
- CapTarget has the same
- **Valuation Leads: No deal owner assignment.** The `buildListingFromLead()` function also doesn't set `deal_owner_id`.

This matters when pushed leads become internal deals — no one is assigned to follow up.

---

## 8. Missing: Priority Flag

**Severity: LOW**

- GP Partners: bulk action bar has "Mark as Priority" / "Remove Priority" — sets `is_priority_target` on the listing, rows highlight amber
- CapTarget: same
- **Valuation Leads: No priority marking.** High-score leads (e.g., score ≥ 80) cannot be flagged for priority follow-up.

---

## 9. Missing: Enrichment Status Column

**Severity: MEDIUM**

- GP Partners Status column shows two badges: **Pushed** (green) + **Enriched** (blue) when `enriched_at` is populated
- **Valuation Leads Status column: Only shows "Pushed" or the raw `status` value.** No "Enriched" badge, no way to see if a pushed lead's listing has been enriched.

The data is available: after push, you have `pushed_listing_id` — you could join back or track `enriched_at` in a secondary query.

---

## 10. Quality Score Uses Wrong Field for Sort

**Severity: LOW**

The `Quality` column shows `qualityBadge(lead.quality_label)` but the sort for `"quality"` column sorts by `readiness_score`, not `quality_label` order. This creates confusing sort behavior where clicking "Quality" sorts by readiness score (a different metric) rather than the quality tier displayed.

---

## 11. Missing: "View in All Deals" Link for Pushed Leads

**Severity: MEDIUM**

- When a lead is pushed, `pushed_listing_id` is set.
- **There is no direct link to view that listing** in All Deals / deal detail from the Valuation Leads table.
- Per-row dropdown only shows: Push to All Deals, Push & Enrich, Re-Enrich, Exclude. No "View Deal" option for pushed leads.

---

## 12. Missing: useTimeframe Hook (Non-standard Timeframe Implementation)

**Severity: LOW**

- GP Partners and CapTarget use `useTimeframe("all_time")` (the shared hook with standardized "all_time" / "7d" / "30d" etc. values)
- **Valuation Leads implements its own custom timeframe logic** with manual `getFromDate()` and a custom toggle UI, using different value strings ("all" vs "all_time")

This means the Valuation Leads page doesn't integrate with any global time context and diverges from the standardized pattern across the platform.

---

## Summary Table

| # | Gap | Severity | Equivalent in GP Partners / CapTarget |
|---|-----|----------|----------------------------------------|
| 1 | No click-through to deal detail | HIGH | ✅ Both have it |
| 2 | No "Enrich All" button | HIGH | ✅ Both have it |
| 3 | No advanced filter bar | MEDIUM | ✅ Both have it |
| 4 | No CSV export | MEDIUM | ✅ GP Partners has it |
| 5 | Push & Enrich uses incomplete insert | MEDIUM | N/A |
| 6 | No row number column | LOW | ✅ Both have it |
| 7 | No deal owner assignment | LOW-MEDIUM | ✅ GP Partners has it |
| 8 | No priority flag | LOW | ✅ GP Partners has it |
| 9 | No enrichment status badge | MEDIUM | ✅ GP Partners has it |
| 10 | Quality sort uses wrong field | LOW | N/A |
| 11 | No "View Deal" link for pushed leads | MEDIUM | ✅ Both have it |
| 12 | Non-standard timeframe hook | LOW | ✅ Both use `useTimeframe` |

---

## Implementation Plan (Priority Order)

### Phase 1 — Critical (blocking operator workflow)

**1A. Row click navigation + route**
- Add `useNavigate` to `ValuationLeads.tsx`
- Add `onClick` to `TableRow` with `cursor-pointer`: if `pushed_listing_id` exists → navigate to `/admin/remarketing/deals/:pushed_listing_id`, else → open a slide-over drawer showing the full lead detail
- Add "View Deal" to the per-row dropdown for pushed leads
- Add `<Route path="valuation-leads/:leadId" ...>` in `App.tsx` (or use a drawer approach to avoid needing a separate page)

**1B. "Enrich All" global header button**
- Add an `Enrich` dropdown (matching GP Partners) to the header action bar
- Options: "Enrich Unenriched Pushed" and "Re-enrich All Pushed"
- Use `useGlobalGateCheck` + `process-enrichment-queue` pattern from `GPPartnerDeals.tsx`
- Integrate with Global Activity Queue for progress tracking

### Phase 2 — High Impact

**2A. Fix Push & Enrich to use `buildListingFromLead()`**
- The inline insert in `handlePushAndEnrich` (lines 629–641) should be replaced with `buildListingFromLead(lead)` to preserve all 20+ fields

**2B. Add "Enriched" badge to Status column**
- Requires either joining `listings.enriched_at` in a second query, or storing `enriched_at` on the lead after push

**2C. Add "View Deal" to per-row dropdown**
- Only shown when `pushed_listing_id` is not null
- Navigates to `/admin/remarketing/deals/:pushed_listing_id`

**2D. CSV Export**
- Add Export CSV to the selection bulk toolbar (matching GP Partners)
- Can reuse `exportDealsToCSV` for pushed leads, or generate a custom CSV for unpushed leads

### Phase 3 — Polish

**3A. Filter bar**
- Create `VALUATION_LEAD_FIELDS` definitions
- Integrate `useFilterEngine` replacing the manual sort/filter logic
- Add search input

**3B. Deal owner assignment column**
- Use `useAdminProfiles` + inline `Select` component (same as GP Partners)

**3C. Priority flag support**
- Bulk action: "Mark as Priority" toggle
- Row highlight for high-score leads

**3D. Row number column**
- Simple index display

**3E. Fix quality sort**
- Sort by `quality_tier` ordering (Very Strong → Solid → Average → Needs Work) instead of `readiness_score`

**3F. Migrate to `useTimeframe` hook**
- Replace custom `getFromDate` + timeframe toggle with the standard `useTimeframe` hook
