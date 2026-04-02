

# Redesign Listing Detail — Premium Agreement Status UX

## Issues Identified

1. **Top banners are loud and clunky** — Two full-width colored banners (amber/blue backgrounds) at the top look like error alerts, not premium UI. They use heavy background tints which violate the "Quiet Luxury" design system (white-dominant, hairline dividers, spacing over tints).

2. **Duplicate information** — The top `AgreementStatusBanner` shows "NDA waiting to be signed" AND the sidebar shows "Your NDA has been sent to..." — same info repeated in two places with different styles.

3. **Sidebar document status card is visually harsh** — Blue background tint with bold text doesn't match the premium minimal aesthetic of the rest of the sidebar.

4. **"Agreement Required" block in sidebar is alarming** — Amber background with ShieldAlert icon feels like a warning/error. Should feel like a gentle next-step prompt.

5. **Top banners show for BOTH NDA and Fee Agreement separately** — Creates visual clutter with two banners stacked.

## Solution

### 1. Remove top `AgreementStatusBanner` from listing detail entirely
The sidebar already shows the relevant status. No need for redundant top banners on the listing page. The banners are useful on other pages but on listing detail the sidebar is the right place.

### 2. Redesign sidebar agreement section — premium style
Replace the amber "Agreement Required" block and the blue "NDA sent" block with a single, clean card that follows the quiet luxury aesthetic:

- **When unsigned & not sent**: Clean white card with subtle border, gentle copy: "Sign an agreement to request introductions." with a refined button.
- **When sent/pending**: Clean white card showing status with a subtle left-border accent (blue), email info, and next steps. No background tints.
- **When signed**: Either hide entirely (the connection button is active) or show a subtle green checkmark.

### 3. Consolidate into one sidebar status section
Instead of separate "Agreement Required" and "Document Status" blocks, merge into one contextual section inside the existing CTA card, between the heading and the ConnectionButton.

## Files Changed

- `src/pages/ListingDetail.tsx` — Remove `AgreementStatusBanner` import and usage from listing detail page (lines 176-180)
- `src/components/listing-detail/ConnectionButton.tsx` — Redesign the agreement gate UI (lines 176-210) and the document status card (lines 372-382 in ListingDetail.tsx, move logic into ConnectionButton) to use premium minimal styling: white background, hairline borders, muted text, no color tints

### Design Tokens (from existing design system)
- Background: `bg-white` (not `bg-amber-50` or `bg-blue-50`)
- Border: `border border-slate-200/60` (hairline)
- Accent: Left border `border-l-2 border-blue-400` for pending status
- Text: `text-foreground` for headings, `text-muted-foreground` for body
- Icon: Muted, not colored (`text-slate-400`)

