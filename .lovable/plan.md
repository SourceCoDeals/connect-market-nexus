

## Make "Matched for You" Collapsible (Collapsed by Default)

**Problem:** The "Matched for You" section takes up the entire visible area when users land on the marketplace, pushing the actual listings below the fold.

**Solution:** Wrap the matched deals grid in a collapsible section using the existing Radix `Collapsible` component. It will be collapsed by default, showing only a compact header bar that users can click to expand.

### Changes

**File: `src/components/marketplace/MatchedDealsSection.tsx`**

- Import `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` from `@radix-ui/react-collapsible` and `ChevronRight` icon
- Add `useState(false)` for the open/closed state (collapsed by default)
- Keep the "not enough criteria" prompt as-is (no collapsible needed for that)
- For the matched listings view:
  - Wrap in `<Collapsible>` with `open={isOpen}` and `onOpenChange={setIsOpen}`
  - Make the header row (`Matched for You` + criteria summary) a `<CollapsibleTrigger>` with a chevron icon that rotates when expanded
  - Show the match count in the header (e.g., "Matched for You (3)") so users know there are results without expanding
  - Put the listings grid inside `<CollapsibleContent>`
  - Keep the "Update criteria" link visible in the header at all times
- Reduce bottom margin from `mb-8` to `mb-4` when collapsed for a tighter layout

This is a single-file change with no new dependencies (Radix Collapsible is already installed).
