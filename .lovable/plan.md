

## Fix Match Badge and "Why Matched" Label Design

### Problem
Two visual elements on listing cards don't follow the established design patterns:
1. **"Partial Match" badge** (and similar match badges like "Good Match", "Strong Match") -- rendered on every card in the marketplace as a small muted pill overlaid on the image. The styling is inconsistent with other status tags on the cards.
2. **"Why matched" badge** -- a purple pill overlaid on the top-right of card images in the Matched for You section. It visually clashes with the existing card layout and competes with other overlays.

### Changes

**1. Remove the match badge from ListingCard** (`src/components/ListingCard.tsx`)

The match badge ("Partial Match", "Good Match", "Strong Match") overlapping the card image is not aligned with the design. Remove the `matchBadge` computation and the overlay element from `ListingCard`. Match context is already communicated by the "Matched for You" section header and the "Why matched" tooltip -- having a third indicator is redundant.

- Remove the `matchBadge` useMemo block (lines 46-65)
- Remove the match badge div in the render (lines 137-144)
- Remove the `getMatchBadge` import

**2. Restyle the "Why matched" label** (`src/components/marketplace/MatchedDealsSection.tsx`)

Move the "Why matched" label from an absolute-positioned overlay on the image to a small inline element below or beside the card, consistent with the card's existing badge/tag design pattern. Specifically:

- Remove the absolute positioning (`absolute top-2 right-2`)
- Place it as a small text link/button below the card (after `ListingCard`) instead of overlaying the image
- Use a subtle inline style: a small purple text link with a sparkle icon, e.g., "Why matched?" as a clickable text element beneath the card

### Files to Change

| File | Change |
|------|--------|
| `src/components/ListingCard.tsx` | Remove `matchBadge` logic and overlay render |
| `src/components/marketplace/MatchedDealsSection.tsx` | Move "Why matched" from image overlay to inline element below card |

