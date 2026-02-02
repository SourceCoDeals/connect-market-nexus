
# Plan: Complete Attribution Pipeline and Enhance Intelligence Center

## Problem Summary

The cross-domain attribution system has a critical gap: the `visitor_id` is not being passed to Supabase Auth during signup. This prevents the `handle_new_user` trigger from finding the visitor's journey and copying their attribution data (original referrer, blog landing, etc.) to their permanent profile.

Additionally, while the Intelligence Center already uses real session data for channels and referrers, it could better highlight the cross-domain attribution data for signups.

---

## Current Data Visibility

Your system already tracks referrers from ALL sources:

| Source | Detection Method | Current Status |
|--------|-----------------|----------------|
| LinkedIn | `referrer ILIKE '%linkedin%'` | Working (1 session in last 30 days) |
| Google | `referrer ILIKE '%google%'` | Working (11 sessions) |
| Email/Brevo | `referrer ILIKE '%brevo%'` | Working (58 sessions) |
| ChatGPT | `referrer ILIKE '%chatgpt%'` | Ready (categorized as AI channel) |
| Perplexity | `referrer ILIKE '%perplexity%'` | Ready (categorized as AI channel) |
| Direct | No referrer | Working (870 sessions) |

The `categorizeChannel()` function in `useUnifiedAnalytics.ts` already handles all these sources correctly.

---

## Technical Changes Required

### Phase 1: Fix the Visitor ID Gap (Critical)

**File: `src/hooks/use-nuclear-auth.ts`**

Add `visitor_id` to the signup metadata so the trigger can link the user to their pre-registration journey:

```text
// In the signup options.data object, add:
visitor_id: localStorage.getItem('sourceco_visitor_id') || null,
```

This single change will enable:
- Trigger to find the visitor's `user_journeys` record
- Attribution data to flow to the profile permanently
- Full journey visibility in the admin Users table

---

### Phase 2: Backfill Existing Users

Create a one-time migration to retroactively link existing users to their first session's attribution:

```text
UPDATE profiles p
SET 
  first_external_referrer = us.original_external_referrer,
  first_blog_landing = us.blog_landing_page,
  first_seen_at = us.started_at
FROM user_sessions us
WHERE us.user_id = p.id
  AND p.first_external_referrer IS NULL
  AND us.original_external_referrer IS NOT NULL
  AND us.started_at = (
    SELECT MIN(started_at) 
    FROM user_sessions 
    WHERE user_id = p.id
  );
```

---

### Phase 3: Enhance Intelligence Center (Optional Improvements)

The Intelligence Center already displays channel and referrer data correctly. Potential enhancements:

1. **Add "Discovery Source" column to Signups breakdown**
   - Show whether signup came from cross-domain (blog) vs direct marketplace
   - Highlight `first_external_referrer` when present

2. **Add AI Traffic Highlight**
   - The AI channel (ChatGPT, Claude, Perplexity) is already categorized
   - Could add a dedicated "AI Sources" sub-breakdown

3. **Cross-Domain Attribution Card**
   - New card showing "Blog → Marketplace" conversions
   - Visualize the full journey: Google → Blog Article → Marketplace → Signup

---

## Files to Modify

| File | Change | Priority |
|------|--------|----------|
| `src/hooks/use-nuclear-auth.ts` | Add `visitor_id` to signup metadata | Critical |
| `src/hooks/auth/use-enhanced-auth-actions.ts` | Same change if using this auth flow | Critical |
| Migration script | Backfill existing user attribution | High |
| `src/components/admin/analytics/datafast/SourcesCard.tsx` | Optional: Add discovery source display | Low |

---

## Verification Steps

After implementation:

1. Complete a test signup flow from the blog (Google → Blog → Marketplace)
2. Check the `profiles` table for the new user - verify `first_external_referrer` is populated
3. View the user in Admin Users table - confirm attribution fields display correctly
4. Test direct marketplace signup - verify immediate referrer is captured
5. Test LinkedIn/Email link signup - verify those referrers appear correctly

---

## How Referrer Tracking Works for All Sources

When a user arrives at the marketplace from ANY source, the tracking flow is:

```text
1. User clicks link (LinkedIn post, email, ChatGPT, Google, etc.)
2. Browser includes HTTP Referer header
3. SessionContext captures document.referrer
4. track-session edge function stores in user_sessions.referrer
5. useUnifiedAnalytics categorizes into channels
6. Intelligence Center displays in Channels/Referrers tabs
```

This works for ALL sources - no special handling needed for LinkedIn, Email, ChatGPT, etc. They're all captured via the standard HTTP referrer mechanism.

The only special case is cross-domain tracking (blog → marketplace) where the referrer is "sourcecodeals.com" but we want to know what brought them to the blog originally - that's what the `sco_` parameters handle.
