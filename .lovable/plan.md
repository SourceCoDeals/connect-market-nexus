
# Plan: Persist Cross-Domain Attribution Permanently to User Profiles

## Overview
Currently, cross-domain attribution data (like `original_external_referrer` and `blog_landing_page`) is captured in the `user_sessions` table during a visitor's session. However, this data doesn't survive across sessions (e.g., when a user returns days later via an email confirmation link). This plan ensures the original attribution data is permanently stored in the user's profile so it's always accessible in the admin panel.

## Current Architecture Gap

```text
User Journey:
  1. User arrives from Google → Blog → Marketplace
  2. sco_ params captured in user_sessions ✓
  3. User signs up (account created)
  4. Days later → User clicks email confirmation link (NEW session)
  5. New session has NO cross-domain params ✗
  6. Attribution data is "orphaned" in the original session
```

## Solution Summary

1. **Add new columns to `profiles` table** to permanently store first-touch cross-domain attribution
2. **Update the `track-session` edge function** to write attribution data to `user_journeys`
3. **Update the `handle_new_user` database trigger** to copy first-touch attribution from `user_journeys` to `profiles` at registration
4. **Add fallback logic** to copy from `user_sessions` if `user_journeys` is empty
5. **Update the User type** and **admin UsersTable** to display the new attribution fields

---

## Technical Implementation

### Phase 1: Database Schema Changes

**Add 4 new columns to `profiles` table:**

| Column | Type | Description |
|--------|------|-------------|
| `first_external_referrer` | `text` | The original external referrer (e.g., "www.google.com") |
| `first_blog_landing` | `text` | The blog page they first landed on (e.g., "/blog/best-m-a-news") |
| `first_seen_at` | `timestamptz` | Timestamp of first discovery (from journey) |
| `first_utm_source` | `text` | First-touch UTM source for campaign attribution |

**Add 2 new columns to `user_journeys` table:**

| Column | Type | Description |
|--------|------|-------------|
| `first_external_referrer` | `text` | Cross-domain referrer from blog script |
| `first_blog_landing` | `text` | Blog landing page from cross-domain tracking |

---

### Phase 2: Track-Session Edge Function Update

Modify `supabase/functions/track-session/index.ts` to:
- Store `original_external_referrer` and `blog_landing` in the `user_journeys` upsert
- Only set these on first visit (don't overwrite on subsequent sessions)

```text
// In the user_journeys upsert:
first_external_referrer: body.original_referrer || body.original_referrer_host || null,
first_blog_landing: body.blog_landing || null,
```

---

### Phase 3: Handle_New_User Trigger Update

Modify the `handle_new_user()` trigger function to:
1. Look up the visitor's `user_journeys` record using the `visitor_id` from `user_sessions`
2. Copy `first_external_referrer`, `first_blog_landing`, `first_seen_at`, and `first_utm_source` to the new profile
3. Fallback to querying `user_sessions` directly if journey is not found

```text
-- Pseudo-logic in trigger:
1. Find visitor_id from most recent user_session where user_id = NEW.id
2. Look up user_journeys by visitor_id
3. Copy first_external_referrer, first_blog_landing, first_seen_at, first_utm_source to profiles
```

---

### Phase 4: Frontend Updates

**Update `src/types/index.ts`:**
Add 4 new optional fields to the `User` interface:
- `first_external_referrer?: string`
- `first_blog_landing?: string`
- `first_seen_at?: string`
- `first_utm_source?: string`

**Update `src/lib/buyer-type-fields.ts`:**
Add new fields to the "Sourcing & Discovery" category so they display in user profiles.

**Update `src/components/admin/UsersTable.tsx`:**
Display the new attribution fields in the user detail panel:
- Show "Original Discovery Source" (first_external_referrer)
- Show "Blog Entry Page" (first_blog_landing)
- Show "First Seen" timestamp
- Show "First UTM Source" if present

---

### Phase 5: Backfill Existing Users (Optional)

Create a one-time migration or edge function to backfill attribution data for existing registered users by:
1. Finding their `visitor_id` from `user_sessions` 
2. Looking up cross-domain data from their first session
3. Updating their profile record

---

## Data Flow After Implementation

```text
User Journey:
  1. User arrives from Google → Blog → Marketplace
  2. sco_ params captured in user_sessions ✓
  3. sco_ params copied to user_journeys (first_external_referrer) ✓
  4. User signs up → handle_new_user trigger fires
  5. Trigger copies from user_journeys → profiles ✓
  6. Days later → User clicks email confirmation link
  7. Attribution is ALREADY in profiles - permanently accessible ✓
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/[new]_add_attribution_to_profiles.sql` | Create: Add columns to profiles and user_journeys |
| `supabase/functions/track-session/index.ts` | Modify: Store cross-domain data in user_journeys |
| `supabase/migrations/[new]_update_handle_new_user.sql` | Create: Update trigger to copy attribution |
| `src/types/index.ts` | Modify: Add new User fields |
| `src/lib/buyer-type-fields.ts` | Modify: Add fields to Sourcing & Discovery |
| `src/components/admin/UsersTable.tsx` | Modify: Display attribution in user details |

---

## Verification Steps

1. Test full flow: Google → Blog → Join Marketplace → /welcome → /signup
2. Complete registration and verify email
3. Check profiles table for `first_external_referrer` and `first_blog_landing`
4. View user in Admin Users table - confirm attribution is displayed
5. Test return via email link days later - attribution should persist
