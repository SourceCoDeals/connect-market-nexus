

# Fix: Profile Completion Display Inside Data Room Teaser

## Problem

When a user has an incomplete profile, the `BlurredFinancialTeaser` renders `ConnectionButton` inside its overlay. `ConnectionButton` returns a full profile completion card (border, progress bar, "Complete Profile" button) which renders poorly inside the compact overlay — text overlaps the blurred background, the card-within-card nesting looks broken.

## Fix

**File: `src/components/listing-detail/BlurredFinancialTeaser.tsx`**

Instead of passing through to `ConnectionButton` (which renders its own profile completion UI), detect the incomplete profile state directly in this component and render a clean, integrated message. The teaser already has its own lock icon, title, and description — just swap the CTA text and button when the profile is incomplete.

Changes:
1. Accept `profileComplete` and `profileCompletionPct` as props (passed from the parent that already has this data)
2. When profile is incomplete: change the subtitle to "Complete your profile to unlock deal access" and swap the `ConnectionButton` for a direct "Complete Profile" link styled as the dark primary button
3. Show a slim progress bar (matching the `#0E101A` style) inline below the subtitle
4. When profile IS complete: render `ConnectionButton` as before (for the actual request flow)

This keeps the teaser layout consistent regardless of profile state — one lock icon, one title, one CTA — no nested cards.

**File: `src/components/listing-detail/ConnectionButton.tsx`**

No changes needed — the profile completion block (lines 129-165) still works correctly when `ConnectionButton` is used in the sidebar. The fix is about preventing it from rendering inside the teaser overlay.

**Parent file that renders BlurredFinancialTeaser** — pass `profileComplete` boolean. This is likely in `ListingDetail.tsx` or a sidebar component.

## Result

The Data Room teaser always looks clean: lock icon, clear message, single action button. No nested cards or broken layouts.

