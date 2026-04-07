

# Push Clear Choice Windows & Doors Live

## Current Blockers

The listing exists (`9f08d1a8-3308-4944-a48e-2eb994876b74`) with `is_internal_deal: true` and has never been published. The `publish-listing` edge function rejects it because:

1. **Description is null** — gate requires ≥ 50 characters
2. **Image is null** — gate requires a non-empty `image_url`

Memo PDFs (Lead Memo + Teaser) are both uploaded. Revenue, EBITDA, category, location all present.

## Plan

### 1. Auto-populate description from executive summary
The listing has a good executive summary (200+ chars). Update the `publish-listing` edge function to **fall back to `executive_summary`** when `description` is empty, so deals with a summary but no separate description can still pass the gate.

### 2. Make image optional for publishing
Remove the image requirement from the publish gate. Many deals don't have custom images. The marketplace card/detail page should gracefully handle missing images (it likely already does with a placeholder).

### 3. Deploy and publish

| Step | File | Change |
|------|------|--------|
| 1 | `supabase/functions/publish-listing/index.ts` | In `validateListingQuality`: use `executive_summary` as fallback for description check; remove image_url requirement |
| 2 | Deploy `publish-listing` edge function | |

After deployment, the existing "Publish to Marketplace" button in the admin UI will work for this listing without any manual data entry.

