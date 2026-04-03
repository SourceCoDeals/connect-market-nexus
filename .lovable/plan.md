

# Remove Sticky Sidebar on Listing Detail

## Change

In `src/pages/ListingDetail.tsx` line 335, remove `sticky top-32` from the sidebar wrapper so it scrolls naturally with the page content.

Same fix in `src/pages/ListingPreview.tsx` line 224.

### Files changed
- `src/pages/ListingDetail.tsx` — remove `sticky top-32` from sidebar div
- `src/pages/ListingPreview.tsx` — same fix for consistency

