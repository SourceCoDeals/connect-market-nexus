

# Fix: Auto Shop Tab Showing 4 of 15 Leads + Sort by Date

## Root Causes

1. **Default "Website is not empty" filter** (line 188-199 in `useValuationLeadsQueries.ts`) — auto-applied on mount, hiding leads without websites. The tab count (15) is pre-filter, but the table shows post-filter (4). This is why you only see 4.

2. **Domain deduplication** (lines 213-230) — leads with the same domain are collapsed to one row, further reducing count.

3. **"Clear all" doesn't remove the default filter** — When you click "Clear all", the `useEffect` on line 189 immediately re-adds the "Website is not empty" rule because it checks `filterState.rules.length === 0`.

## Changes

### 1. Remove the auto-applied "Website is not empty" default filter
In `useValuationLeadsQueries.ts`, delete the `useEffect` (lines 188-199) that forces the website filter. Users can add it manually if needed, but it should not be the default — it hides most leads.

### 2. Sort by `created_at desc` by default (already working)
The default sort is already `created_at` desc (line 44-45). No change needed.

### 3. Fix "Clear all" to actually clear
With the `useEffect` removed, clicking "Clear all" in the FilterBar will properly reset `filterState.rules` to `[]` and show all leads.

### 4. Make tab counts reflect post-filter totals (minor)
Currently the tab counts come from `leads` (all data) pre-filter. This is fine — it shows total leads per type. But the table pagination footer should clearly reflect the filtered count.

### Files
| File | Change |
|------|--------|
| `useValuationLeadsQueries.ts` | Remove the default website filter `useEffect` (lines 188-199) |

One small, targeted change that fixes all three issues.

