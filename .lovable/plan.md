

# Redesign Listing Sidebar — Premium, Crystal-Clear Layout

## Problem

The current sidebar mixes action rows, document statuses, connection buttons, and informational copy in a way that's cluttered. The blue left-border color on document rows feels random. It's not immediately clear which documents are signed vs pending. Tooltips use disabled-state opacity rather than discoverable (i) info icons.

## Design Principles

- **No colored borders** (no blue, no emerald left-borders on document rows)
- **Spacing over decoration** — whitespace separates sections, not borders or tints
- **Neutral palette** — slate/gray tones only; status communicated via subtle text + icons
- **Info icons** — small `(i)` circle icons on locked rows that users hover for tooltip guidance
- **Logical sequence**: Documents status → Actions → Connection CTA → Save/Share

## New Sidebar Layout

```text
┌──────────────────────────────────────┐
│                                      │
│  Request Access to This Deal         │
│  Request a connection to unlock      │
│  the data room...                    │
│                                      │
│  ── DOCUMENTS ──────────────────     │
│                                      │
│  Fee Agreement          ● Signed     │  (green dot + "Signed")
│  NDA                    ○ Pending    │  (hollow dot + "Pending")
│                                      │
│  ── ACTIONS ────────────────────     │
│                                      │
│  ◇ Explore data room       (i)  >   │  (info icon shows tooltip)
│     Viewed Nov 19, 2025              │
│                                      │
│  ? Ask a question          (i)  >   │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  Request Connection          │    │  (primary CTA)
│  └──────────────────────────────┘    │
│                                      │
│  [Save]                    [Share]   │
│                                      │
└──────────────────────────────────────┘
```

## Changes

### 1. `ListingSidebarActions.tsx` — Complete redesign

**Document status section (new):**
- Receives `ndaCovered`, `ndaStatus`, `feeStatus` as additional props
- Renders a "DOCUMENTS" label (uppercase tracking-wider, 10px, muted) 
- Each document row: name on left, status indicator on right
- Status indicators: `● Signed` (small green text, no background), `○ Sent` (small muted text), `—` (not started, show "Not requested")
- No colored left-borders, no card wrappers — just clean rows with bottom border-dashed separators
- Remove blue accents entirely

**Action rows (redesigned):**
- "ACTIONS" section label
- Each row: icon + label + flex spacer + info `Info` icon (small circle-i from lucide) + chevron
- Disabled rows: 60% opacity, info icon is always visible and hoverable regardless of disabled state
- Info icon triggers tooltip on hover explaining what's needed
- No colored accents — icons use `text-muted-foreground`, labels use `text-foreground`

**Tooltip via (i) icon:**
- Replace the current "entire row is tooltip trigger when disabled" pattern
- Instead, always show a small `Info` (lucide `Info` icon, 14px) next to the chevron on locked rows
- The `Info` icon is the tooltip trigger — works even when row is disabled
- Tooltip content stays the same (explains what to sign/request)

### 2. `ConnectionButton.tsx` — Document rows cleanup

**Remove the `DocumentRow` component** inside the unsigned block (lines 203-239). Document status display now lives in `ListingSidebarActions`.

The unsigned block (lines 181-294) simplifies to:
- If `bothNotRequested`: show the "Sign Your Fee Agreement" card with the request button
- If documents are sent/pending: show a simple "Once processed, you'll be able to request introductions" note + "Request Another Agreement" button
- No more blue left-borders, no "Sent" badges, no "Resend" buttons here — that all moves to `ListingSidebarActions`

Wait — actually, `ConnectionButton` is used independently and must be self-contained. The document rows should stay in `ConnectionButton` but be restyled to match the new aesthetic. Let me reconsider.

**Better approach**: Keep `ConnectionButton` self-contained but pass document status display responsibility to the parent. In the sidebar layout (`ListingDetail.tsx`), the `ListingSidebarActions` component renders the document status section ABOVE the `ConnectionButton`. The `ConnectionButton` still handles its own gating logic but the duplicate document display is removed from it — the `ConnectionButton` in unsigned state just shows the CTA card (sign agreement prompt) without the document status rows.

### 3. `ListingDetail.tsx` — Pass additional props

Pass `ndaCovered`, `ndaStatus`, `feeStatus` from `agreementCoverage` to `ListingSidebarActions` so it can render document status.

### 4. Color cleanup

- Remove all `border-blue-400`, `border-emerald-400` left-border treatments from document rows
- Status text: "Signed" in `text-emerald-600` (small, subtle), "Sent" in `text-foreground/50`, "Not requested" in `text-muted-foreground`
- Status dots: small 6px circles — filled green for signed, hollow for pending, empty for not started

## Files Changed

- `src/components/listing-detail/ListingSidebarActions.tsx` — redesign with document status section + info icon tooltips
- `src/components/listing-detail/ConnectionButton.tsx` — remove duplicate document status display from unsigned block, keep only the sign/request CTA
- `src/pages/ListingDetail.tsx` — pass additional agreement props to ListingSidebarActions

