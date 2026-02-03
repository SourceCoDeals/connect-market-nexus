
Problem diagnosis (what’s happening and why)
- Your data pipeline is now correct: PapaParse is detecting 28 headers (confirmed in console logs) and `columnMappings` contains 28 entries (your UI badges also show “Showing 28 of 28”).
- The reason you only visually see ~5 rows is a layout/scroll containment bug:
  - The dialog’s content area is height-constrained (`max-h-[85vh]`) and uses `overflow-hidden` in the inner wrapper.
  - The mapping list container (`ScrollArea`) is currently using `max-h-[400px]` and `flex-1`, but in this specific layout Radix ScrollArea ends up expanding to content height rather than becoming the scroll container you expect.
  - Result: the table grows beyond the available dialog height, but the dialog clips it (because the dialog body is overflow-hidden), and no scrollbar appears because the ScrollArea itself is not the element with a fixed height.

Why this is consistent with your screenshot
- Badge says “Showing 28 of 28” → React is rendering 28 rows logically.
- You can only see the first few rows → the rest are clipped out of view.
- No scrollbar → the element that should scroll doesn’t have an actual fixed height in the final computed layout.

Fix strategy (UI-first, deterministic, no AI involved)
We will make the mapping step layout enforce a real scroll container by:
1) Giving the dialog a concrete height (not only max-height), so flex children can compute remaining space.
2) Ensuring the mapping step wrapper has `min-h-0` (so children are allowed to shrink) and that the ScrollArea is the element that receives the constrained height.
3) Removing the ambiguous `max-h-[400px]` approach (which is easily defeated by the surrounding clipping) and instead using either:
   - `flex-1 min-h-0` (preferred) inside a `h-[85vh]` dialog, or
   - a simple `h-[50vh]` fixed height on the ScrollArea if we want maximum predictability.
4) (Optional but recommended) Make the table header sticky so the column titles remain visible while scrolling.

Implementation details (what I will change)
A) DealImportDialog (route you’re on: /admin/remarketing/deals)
- Update `DialogContent` sizing:
  - Change from: `max-h-[85vh]`
  - To: `h-[85vh]` (or `h-[85svh]` for better mobile behavior) plus `max-h` if desired.
  - Keep `flex flex-col` so the mapping list can occupy remaining space.
- Ensure the mapping step container uses:
  - `className="flex-1 flex flex-col min-h-0"`
- Update ScrollArea to become the scroll container:
  - Replace `max-h-[400px]` with `flex-1 min-h-0` (or a fixed `h-[50vh]` if we want absolute certainty).
  - Add `overflow-hidden` only where needed; the ScrollArea viewport will handle actual scrolling.
- Add “always visible” scrollbar styling (optional):
  - Radix scrollbars can feel subtle; we can increase contrast/width if needed.

B) DealCSVImport (the universe import component)
- Apply the exact same layout fixes for consistency:
  - Dialog/container height enforcement (if it uses a dialog)
  - `min-h-0` parent
  - ScrollArea gets real constrained height (`flex-1 min-h-0` or `h-[50vh]`)

C) Verification (end-to-end)
- After changes:
  1) Upload `Test_deals-4.csv`
  2) Confirm you can scroll through the mapping list and reach the last columns (e.g., “Fireflies Recording”, “Appointment Booked”, “Buyers Shown”, “Data Source”).
  3) Confirm “Showing 28 of 28” still matches visible scrollable content (and not clipped).
  4) Confirm the scrollbar is visible and functional with mouse wheel + trackpad + drag.
  5) Confirm the dialog itself does not scroll weirdly (only the mapping list scrolls).

Edge cases we’ll explicitly protect against
- Large number of columns (50–200): the list must remain scrollable without expanding the dialog.
- Short viewport heights (smaller laptops): the mapping list should still scroll and not clip.
- Long sample values: ensure row height doesn’t blow up (keep truncation; optionally add tooltip on hover later).

Files to change
- src/components/remarketing/DealImportDialog.tsx
- src/components/remarketing/DealCSVImport.tsx
(Optional if needed for consistent scrollbar visibility/contrast)
- src/components/ui/scroll-area.tsx (only if the scrollbar is too subtle after the layout fix)

Success criteria (non-negotiable)
- The mapping screen shows all columns via scrolling every time.
- No clipping of rows below the fold.
- Scrollbar is present and usable without needing the dialog itself to scroll.
