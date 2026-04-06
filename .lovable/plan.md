

# Fix: Admin Name in Email Notifications

## Problem

When an admin replies to a buyer, two emails are sent with wrong names:

1. **Support inbox email** (screenshot): Shows `ahaile14 replied to Buyer about General` — uses `user.email.split('@')[0]` instead of the admin's real name, and hardcodes `buyerName: 'Buyer'`.

2. **Buyer-facing email**: Says "new message from the SourceCo team" generically — doesn't mention which admin replied.

## Root Cause

In `src/hooks/use-connection-messages.ts` lines 158-168, the `notify-support-inbox` call uses:
- `adminName: user?.email?.split('@')[0]` — produces "ahaile14" instead of "Adam Haile"
- `buyerName: 'Buyer'` — hardcoded instead of looking up the buyer's name
- No `dealTitle` passed — defaults to "General"

The `notify-buyer-new-message` edge function (line 17) says "from the SourceCo team" — it doesn't accept or display the admin's name.

## Fix

### File 1: `src/hooks/use-connection-messages.ts`

**Resolve admin's full name before sending notifications:**
- After getting the authenticated user, query `profiles` for the admin's `first_name` and `last_name`
- Fall back to `ADMIN_PROFILES` map from `@/lib/admin-profiles.ts` if profile query returns no name
- Final fallback: email prefix

**Fix the support inbox call (lines 159-168):**
- Pass the resolved full admin name as `adminName`
- The `buyerName` and `dealTitle` aren't available in `useSendMessage` — accept them as optional params so the calling component can pass them

**Update `useSendMessage` params interface** to accept optional `buyerName`, `dealTitle`, and `adminName` for email context.

### File 2: `supabase/functions/notify-buyer-new-message/index.ts`

**Personalize the buyer email with the admin's name:**
- Accept optional `admin_name` in the request body
- Change line 17 from "from the SourceCo team" to "from [Admin Name] at SourceCo" when available, falling back to "from the SourceCo team"

### File 3: Calling components that invoke `useSendMessage`

Search for all places that call `sendMessage` with `sender_role: 'admin'` and ensure they pass `buyerName` and `dealTitle` context.

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/use-connection-messages.ts` | Add profile lookup for admin name; accept buyerName/dealTitle params; pass to both notification calls |
| `supabase/functions/notify-buyer-new-message/index.ts` | Accept `admin_name` param; personalize "from [Name] at SourceCo" in email body |

