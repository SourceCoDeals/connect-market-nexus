

# Redesigned Pipeline Kanban Card

## Problem
The current card's bottom status strip uses unlabeled dots and tiny icons that are hard to interpret at a glance. The card needs a full redesign that keeps all required data but uses a cleaner, more scannable layout with labels.

## New Card Layout

```text
+---------------------------------------+
| [Company Name]              [Score]   |
| Rev: $X.XM   EBITDA: $XXK            |
+---------------------------------------+
| John Smith              [PE Firm]     |
| Acme Capital                          |
| acmecapital.com                       |
+---------------------------------------+
| NDA: [dot] Signed   Fee: [dot] Sent  |
| Memo: [dot] Sent    DR: [dot] Yes    |
| Mtg: [toggle icon]                   |
+---------------------------------------+
| Owner: Jane D.          3h ago        |
+---------------------------------------+
```

## Design Decisions

1. **Header**: Company name + deal score badge on same line, with financials directly below. No separate bordered header -- just bold text at top to reduce visual weight.

2. **Buyer block**: Contact name + type badge, company, and website on their own lines. Kept compact with small text.

3. **Status grid (2x2 + 1)**: Instead of cramming everything on one row, use a small 2-column grid:
   - Row 1: `NDA: [dot] Signed` | `Fee: [dot] Sent`  
   - Row 2: `Memo: [dot] Sent` | `DR: [dot] Yes`
   - Row 3: `Mtg: [icon toggle]`
   
   Each item gets a short label + colored dot/icon so it's instantly readable. The dots use the same color scheme (emerald=signed, amber=sent, red=declined, grey=none).

4. **Footer**: Owner name left-aligned, last activity right-aligned. Single line.

5. **Special states preserved**: Priority target (amber border), needs owner contact (red header tint), drag state.

## Technical Changes

**File: `src/components/admin/pipeline/views/PipelineKanbanCard.tsx`**
- Full rewrite of the JSX return block
- Replace the single-row icon strip with a labeled 2-column grid using `grid grid-cols-2 gap-x-4 gap-y-0.5`
- Each status item: `<span class="text-[10px]">NDA <dot class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" /> Signed</span>`
- Meeting toggle remains a clickable button with label "Mtg"
- Keep all existing logic (formatting, click handlers, drag-and-drop) unchanged
- Slightly tighten padding throughout for a compact but readable result

