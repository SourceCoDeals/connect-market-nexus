# Audit: Deal Page Notes System

**Date:** 2026-03-05
**Scope:** All notes-related functionality on the ReMarketing Deal Detail page

---

## 1. Overview: How Notes Work on Deal Pages

The deal detail page (`/admin/remarketing/deals/:dealId`) has **three distinct notes systems** serving different purposes:

### 1A. General Notes (Overview Tab)

**Component:** `src/components/remarketing/deal-detail/GeneralNotesSection.tsx`
**DB Column:** `listings.general_notes` (text field on the `listings` table)
**Location in UI:** Bottom of the Overview tab, collapsed by default

**How it works:**
- A single large textarea where admins paste raw notes (call transcripts, owner conversations, business details)
- "Save Notes" persists the text to the `listings.general_notes` column via `updateDealMutation` (a direct Supabase `.update()` on `listings`)
- "Enrich Notes" triggers the `analyze-deal-notes` Supabase Edge Function, which:
  1. Runs regex pre-extraction for revenue, EBITDA, margin, employees, locations, geography
  2. Sends the text (up to 15,000 chars) to Gemini AI for structured extraction (owner goals, services, industry, financials, key quotes, etc.)
  3. Merges regex + AI results using source-priority logic (regex wins for numeric fields)
  4. Updates 20+ fields on the `listings` row with extracted intelligence
  5. Sets `notes_analyzed_at` timestamp and updates `extraction_sources` provenance

**Data flow:**
`UI textarea -> listings.general_notes -> analyze-deal-notes edge function -> listings.* (many fields)`

### 1B. Listing Notes Log (Contact History Tab)

**Component:** `src/components/remarketing/deal-detail/ListingNotesLog.tsx`
**DB Table:** `listing_notes` (separate table with individual note entries)
**Location in UI:** Bottom of the Contact History tab

**How it works:**
- A chronological feed of individual timestamped notes + Fireflies meeting summaries
- Each note has: author (admin), timestamp, and text content
- Notes are stored in a separate `listing_notes` table (one row per note)
- Supports add, delete, and Cmd+Enter keyboard shortcut for submission
- Merges with `deal_transcripts` (source='fireflies') into a unified timeline sorted newest-first
- Fireflies entries show call title, duration, and a 2-sentence summary truncation

**Data flow:**
`UI textarea -> listing_notes table (INSERT) -> merged timeline with deal_transcripts`

### 1C. Additional Info / Internal Notes (Overview Tab)

**Component:** `src/components/remarketing/deal-detail/AdditionalInfoCard.tsx`
**DB Columns:** `listings.owner_notes`, `listings.internal_notes`, `listings.key_risks`, `listings.technology_systems`, `listings.real_estate_info`, `listings.growth_trajectory`
**Location in UI:** Near bottom of Overview tab, in the "Additional Information" card

**How it works:**
- A structured card with 6 editable fields (key risks, technology, real estate, growth, other notes, internal notes)
- Edit opens a dialog with separate textareas for each field
- Saves all 6 fields in a single `updateDealMutation` call to the `listings` table
- "Internal Notes (Private)" is visually separated with a border-top

**Data flow:**
`UI dialog -> listings.owner_notes, listings.internal_notes, etc. -> listings table UPDATE`

---

## 2. Audit Findings

### CRITICAL: ListingNotesLog references a DROPPED table

**Severity:** Critical
**File:** `src/components/remarketing/deal-detail/ListingNotesLog.tsx`
**Issue:** The `listing_notes` table was **dropped** in migration `20260503000000_drop_unused_tables.sql` (line 42):

```sql
DROP TABLE IF EXISTS listing_notes CASCADE;
```

Yet the `ListingNotesLog` component (rendered on the Contact History tab) still queries this table:
- Line 81: `supabase.from('listing_notes' as UntypedTable).select(...)`
- Line 146: `supabase.from('listing_notes' as UntypedTable).insert(...)`
- Line 165: `supabase.from('listing_notes' as UntypedTable).delete(...)`

The `as UntypedTable` cast (`any`) hides this from TypeScript — the type was already removed from `src/integrations/supabase/types.ts`, so the code bypasses type checking entirely.

**Impact:** If the migration has been applied in production, all note operations on the Contact History tab will silently fail (the queries will return errors, and the timeline will show "No notes yet" even if data existed). The Fireflies meeting summaries will still work since they read from `deal_transcripts`, which is alive.

**Recommendation:** Either:
1. Remove `ListingNotesLog` component and its usage in the deal detail page (line 178 of `index.tsx`), OR
2. Restore the `listing_notes` table if the feature is still needed

### MEDIUM: Stale state after General Notes enrichment

**Severity:** Medium
**File:** `src/components/remarketing/deal-detail/GeneralNotesSection.tsx`
**Issue:** The `editedNotes` state is initialized from `notes` prop on mount (line 28) but is never updated when the prop changes. After saving notes or enriching, the parent component refetches the deal via `queryClient.invalidateQueries`, which updates the `notes` prop — but `GeneralNotesSection` keeps showing the old `editedNotes` value in the textarea.

This means:
- If the user saves notes, the `hasChanges` check (line 32) still shows `true` because `editedNotes` is compared against the *old* `notes` prop value
- The component will not reflect externally-updated notes (e.g., from another tab or AI enrichment that modifies `general_notes`)

**Recommendation:** Add a `useEffect` that syncs `editedNotes` when the `notes` prop changes and there are no local unsaved edits, or use a key prop to force remount.

### MEDIUM: Fake progress bar in GeneralNotesSection

**Severity:** Medium (UX concern)
**File:** `src/components/remarketing/deal-detail/GeneralNotesSection.tsx` (lines 48-74)
**Issue:** The enrichment progress bar is entirely cosmetic — it advances on a `setInterval(400ms)` timer with hardcoded stages regardless of actual backend progress. The analyze-deal-notes edge function can take up to 120 seconds (`timeoutMs: 120_000` in `useDealDetail.ts:273`), but the progress bar reaches 85% within ~12 seconds.

Additionally, this duplicates the same pattern in `useDealDetail.ts` (lines 222-245) for the website enrichment progress. Both components have independent fake progress implementations.

**Recommendation:** Either remove the progress bar (just show a spinner), or consolidate the fake-progress logic into a shared hook.

### LOW: No delete confirmation in ListingNotesLog

**Severity:** Low
**File:** `src/components/remarketing/deal-detail/ListingNotesLog.tsx` (line 267)
**Issue:** Clicking the trash icon immediately triggers deletion with no confirmation dialog. This is a destructive action on a shared resource (other admins can see the notes).

### LOW: Notes text is not sanitized before display

**Severity:** Low (mitigated by React)
**Files:** `GeneralNotesSection.tsx`, `ListingNotesLog.tsx`, `AdditionalInfoCard.tsx`
**Issue:** Notes are rendered using `{note.note}` inside `<p>` elements with `whitespace-pre-wrap`. React auto-escapes JSX expressions, so there is **no XSS vulnerability**. However, there is no input length validation — a user could paste extremely long notes (the textarea has no `maxLength`), and the `analyze-deal-notes` function truncates at 15,000 chars anyway.

### LOW: `UntypedTable` cast bypasses all type safety

**Severity:** Low
**File:** `src/components/remarketing/deal-detail/ListingNotesLog.tsx` (lines 6, 81, 99, 146, 165)
**Issue:** The component uses `as UntypedTable` (which is `any`) for every Supabase table reference. This disables TypeScript's ability to catch issues like querying a non-existent table or invalid column names. The `listing_notes` table being dropped and this code still compiling is a direct consequence.

### INFO: Three overlapping notes concepts cause confusion

**Severity:** Informational
**Issue:** The deal page has three different "notes" concepts across two tabs:
1. `general_notes` (Overview tab) — a single large text blob for raw notes
2. `listing_notes` (Contact History tab) — individual timestamped note entries
3. `owner_notes` + `internal_notes` (Overview tab) — structured additional info

These serve different purposes but the naming is confusing. The `analyze-deal-notes` edge function falls back through `general_notes -> internal_notes -> owner_notes` (line 199), which means enrichment could unexpectedly process the wrong notes if `general_notes` is empty.

---

## 3. Architecture Diagram

```
Deal Detail Page
|
|-- Overview Tab
|   |-- GeneralNotesSection
|   |   |-- Reads/writes: listings.general_notes (single text field)
|   |   |-- "Enrich Notes" -> analyze-deal-notes edge fn -> updates 20+ listing fields
|   |
|   |-- AdditionalInfoCard
|       |-- Reads/writes: listings.owner_notes, internal_notes, key_risks,
|       |   technology_systems, real_estate_info, growth_trajectory
|
|-- Contact History Tab
    |-- ListingNotesLog (BROKEN - table dropped)
        |-- Reads: listing_notes table (DROPPED) + deal_transcripts (Fireflies)
        |-- Writes: listing_notes table (DROPPED)
```

---

## 4. Summary of Recommendations

| # | Priority | Issue | Action |
|---|----------|-------|--------|
| 1 | Critical | `listing_notes` table dropped but component still references it | Remove `ListingNotesLog` or recreate table |
| 2 | Medium | `GeneralNotesSection` state goes stale after save/refetch | Sync state on prop change |
| 3 | Medium | Fake progress bar misrepresents enrichment duration | Remove or replace with spinner |
| 4 | Low | No delete confirmation for notes | Add confirmation dialog |
| 5 | Low | `UntypedTable` casts bypass type safety | Use proper Supabase types or at minimum validate table existence |
| 6 | Info | Three overlapping notes systems cause confusion | Consider consolidating or renaming for clarity |
