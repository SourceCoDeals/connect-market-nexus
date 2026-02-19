
# Deal Table Layout Improvements

## Summary of Changes

Six focused improvements to the All Deals tracker table layout, improving scannability and surfacing key workflow flags visually.

---

## 1. Deal Name Cell Redesign

**Current state:** The deal name cell contains the company name, source badge (Marketplace/Manual), all three flag icons inline with the name text, and the website link below.

**Changes:**
- Move the `DealSourceBadge` (Marketplace/Manual) OUT of the name cell. Per the user's request, this becomes its own column **later** — for now it is simply removed from the name cell. The "Referral Source" column remains unchanged.
- Move the three flag icons **below** the name as a compact icon row, not inline with the name text.
- Flags shown as small icon pills below the name:
  - `Sparkles` (purple/primary) — Enriched (with tooltip showing enriched date)
  - `PhoneCall` (red, pulsing) — Owner Needs Contacted
  - `Network` (blue, pulsing) — Buyer Universe Needs Created
- The website link moves OUT of the name cell into its own column (see #3).

**Result:** Clean name-only display on the first line; status icons on a second line beneath.

---

## 2. Deal Name Cell: Red Background for "Needs Owner Contact"

**Current state:** The entire `TableRow` gets `bg-red-50` when `needs_owner_contact` is true. The user wants the **Deal Name cell specifically** to be red, while keeping the rest of the row the normal color (yellow for priority, transparent otherwise).

**Change:**
- Remove `needs_owner_contact`-based red background from the `TableRow` className.
- Keep the amber background on the row for priority targets as-is.
- Add a targeted `bg-red-100 dark:bg-red-950/40` class to only the **Deal Name `TableCell`** when `needs_owner_contact` is true, with a subtle left red border (`border-l-2 border-red-500`) for emphasis.
- The `PhoneCall` icon in the icon row below the name already provides the signal; the red cell background makes it immediately visible.

---

## 3. Website Column (New)

**Current state:** Website domain is shown as a small link beneath the deal name.

**Change:**
- Add a new `website` key to `ColumnWidths` and `DEFAULT_COLUMN_WIDTHS` (default width: `120px`).
- Add a new `ResizableHeader` column header labeled "Website" in `ReMarketingDeals.tsx`, positioned immediately after the Deal Name column.
- In `DealTableRow.tsx`, add a new `TableCell` that renders the domain as a clickable `<a>` link (with `Globe` icon), stopping click propagation so it doesn't navigate to the deal detail page.
- Remove the website domain line from inside the Deal Name cell.

---

## 4. Buyer Universe Column (New)

**Current state:** No column exists for buyer universe membership. The `universe_build_flagged` flag is shown as a `Network` icon in the name cell only.

**Change:**
- Add a new `buyerUniverse` key to `ColumnWidths` and `DEFAULT_COLUMN_WIDTHS` (default width: `140px`).
- Position the column **immediately after the Industry column** in both the header and row.
- In `ReMarketingDeals.tsx`, fetch `remarketing_universe_deals` with universe names joined, keyed by `listing_id` — stored in a `universesByListing` lookup map. This can be added as a separate `useQuery` alongside the existing `scoreStats` query.
- Column display logic:
  - **In a universe:** Show the universe name(s) as green pill badges (e.g., `bg-green-50 text-green-700 border-green-200`). If multiple universes, show the first and a `+N` count.
  - **Flagged but not yet in a universe (`universe_build_flagged = true`, no universe records):** Show a styled pill: `bg-blue-50 text-blue-700 border-blue-200` with `Network` icon + "Needs Creation" text.
  - **Neither:** Show `—`.

---

## 5. Source Badge Column Stub (Deferred)

The user said "that should be its own column we can address that later." We will simply **remove** the `DealSourceBadge` from the Deal Name cell for now. No new column is added in this pass.

---

## Technical Details

### Files to Modify

**`src/pages/admin/remarketing/types.ts`**
- Add `website` and `buyerUniverse` keys to `ColumnWidths` interface
- Add defaults to `DEFAULT_COLUMN_WIDTHS`

**`src/pages/admin/remarketing/ReMarketingDeals.tsx`**
- Add `useQuery` for `remarketing_universe_deals` joined with universe names — returns a `Record<string, { id: string; name: string }[]>` map keyed by `listing_id`
- Pass `universesByListing` down to `DealTableRow` as a prop
- Add `ResizableHeader` for "Website" after Deal Name column header
- Add `ResizableHeader` for "Universe" after Industry column header
- Handle column resize for both new columns
- Update loading skeleton row to include two extra cells

**`src/pages/admin/remarketing/components/DealTableRow.tsx`**
- Accept `universesByListing` prop (type: `Record<string, { id: string; name: string }[]>`)
- **Deal Name cell:**
  - Remove `DealSourceBadge` from the name line
  - Remove website domain sub-line
  - Move all three flag icons to a second `div` below the name (icon row)
  - Apply `bg-red-100 border-l-2 border-red-500` to the `TableCell` (not `TableRow`) when `needs_owner_contact` is true
- **TableRow:** Remove red background class for `needs_owner_contact` (keep amber for priority)
- **New Website `TableCell`:** Renders the domain link with `Globe` icon, `onClick` stops propagation
- **New Buyer Universe `TableCell`:** Renders universe pill(s), "Needs Creation" pill, or `—`

### Column Order After Changes

```text
[ ✓ ] [ # ] [ Deal Name + flags ] [ Website ] [ Referral ] [ Industry ] [ Universe ] [ Description ] [ Location ] ...
```

### Buyer Universe Data Fetch

```typescript
const { data: universeDealMap } = useQuery({
  queryKey: ['remarketing', 'universe-deal-map'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('remarketing_universe_deals')
      .select('listing_id, universe_id, remarketing_buyer_universes(id, name)')
      .eq('remarketing_buyer_universes.archived', false);
    if (error) throw error;
    // Build map: listing_id -> array of universe objects
    const map: Record<string, { id: string; name: string }[]> = {};
    data?.forEach(row => {
      const u = row.remarketing_buyer_universes as any;
      if (!u || !u.name) return;
      if (!map[row.listing_id]) map[row.listing_id] = [];
      map[row.listing_id].push({ id: u.id, name: u.name });
    });
    return map;
  }
});
```

### No Schema Changes Required

All data is already in the database. No new migrations needed.
