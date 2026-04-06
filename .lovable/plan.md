

# Fix Listing Detail UX: Profile Banner, Data Room CTA, Geography

## 3 Issues

### 1. Profile Completion Banner (sidebar) - ugly amber box
Currently in `ConnectionButton.tsx` (lines 131-172): a chunky amber box with bullet-point list of missing fields, progress bar, and separate "Complete My Profile" link button. Needs to match the premium minimal design language.

**Fix**: Replace with a clean, minimal card using the dark (#0E101A) progress bar style consistent with the platform. Remove the amber background. Use subtle border, clean typography, and integrate the CTA button inline. Show missing fields as dot-separated text (not bullet list).

### 2. "Unlock the Data Room" (BlurredFinancialTeaser.tsx) - text cut off, poor design
The component has `min-h-[360px]` and the text paragraph is long. The ConnectionButton inside it renders the profile completion banner, which pushes content and causes overflow/cutoff.

**Fix**: 
- Remove `min-h-[360px]` constraint, let it size naturally
- Reduce padding, make the CTA more compact
- Shorten the description text
- Ensure the inner ConnectionButton (which shows profile completion) doesn't create a nested banner - instead, show a simple inline message with a link

### 3. Geography "FL" shown separately from "SOUTHEAST" in header
The header shows `SOUTHEAST` (from `stateToRegion(listing.location)`), then separately `BusinessDetailsGrid` renders a full "GEOGRAPHY" section with just "FL". Redundant and poorly placed.

**Fix**: 
- In `ListingHeader.tsx`, append the raw state code next to the region: "SOUTHEAST | FL"
- In `BusinessDetailsGrid`, remove the Geography section entirely (it's redundant with the header) OR only show it when there are multiple states

## Files Changed

| File | Change |
|------|--------|
| `src/components/listing-detail/ConnectionButton.tsx` | Redesign profile completion block (lines 131-172) to premium minimal style |
| `src/components/listing-detail/BlurredFinancialTeaser.tsx` | Remove min-height, tighten layout, shorten copy |
| `src/components/listing-detail/ListingHeader.tsx` | Show state code next to region (e.g., "SOUTHEAST | FL") |
| `src/components/listing-detail/BusinessDetailsGrid.tsx` | Skip Geography section when only 1 state (already shown in header) |

