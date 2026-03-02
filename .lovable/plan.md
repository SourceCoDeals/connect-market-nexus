

## Problem Analysis

**Why you see this screen:** Users with `buyer_tier = 4` (Unverified) are blocked from the Marketplace and shown a "Complete Your Profile" prompt. This tier is assigned when a user's profile lacks sufficient data.

**Why "Complete My Profile" doesn't work:** The button links to `/welcome`, which is the public landing/signup page. That page has a redirect: if a user is already logged in, it immediately sends them back to `/` (the Marketplace). This creates a loop:
- Marketplace shows "Complete Profile" gate (tier 4)
- Button goes to `/welcome`
- `/welcome` detects logged-in user, redirects to `/`
- Back to the gate screen

## Solution

### 1. Fix the button destination
Change the "Complete My Profile" link in `src/pages/Marketplace.tsx` from `/welcome` to `/profile`, which is the existing profile editing page that already has all the form fields for updating buyer information.

### 2. Ensure all profile fields save correctly
The profile page (`src/pages/Profile/`) already has comprehensive field handling via `useProfileData.ts`. The `handleProfileUpdate` function saves through `updateUserProfile` in `use-nuclear-auth.ts`, which:
- Strips privileged fields (is_admin, approval_status, etc.)
- Normalizes URLs and investment_size arrays
- Updates Supabase, then refreshes the local user object

This already works correctly for all fields. No changes needed to the save logic.

## Files to Change

| File | Change |
|------|--------|
| `src/pages/Marketplace.tsx` | Change `Link to="/welcome"` to `Link to="/profile"` on line 182 |

This is a one-line fix. The profile page already handles every field properly, and saving triggers a `buyer_tier` recalculation (if that's done server-side via trigger or edge function), which would remove the user from the tier 4 gate once their profile is sufficiently complete.

