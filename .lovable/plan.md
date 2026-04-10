

# Audit: Connection Request Flow -- Current State

## Everything confirmed working in code

### 1. AdminRequests.tsx -- Unified and correct
- Line 32/45: Uses `useUpdateConnectionRequestStatus` (direct `.update()`) -- no more RPC
- Line 248: `await updateStatus.mutateAsync(...)` with try/catch -- email only sends on success
- Line 258-261: Sender resolved from `DEAL_OWNER_SENDERS`
- Line 275: `listingId: selectedRequest.listing?.id || undefined` -- no empty string
- Line 265: Falls back to `lead_email` for webflow/guest leads
- Line 280: `customBody` forwarded to edge function

### 2. WebflowLeadDetail.tsx -- Unified and correct
- Line 84: `await updateStatus.mutateAsync(...)` with try/catch + early return on failure
- Line 119: `await updateStatus.mutateAsync(...)` for reject path, same pattern
- Line 75: `comment` parameter is used (not prefixed with underscore)
- Line 84: `notes: comment || undefined` -- admin comment saved
- Line 95: `if (buyerEmail)` -- no `listingId` guard
- Line 105: `listingId: listingId || undefined` -- correct

### 3. useConnectionRequestActions.ts -- Unified and correct
- Line 88: `notes: adminComment || undefined`
- Line 108-109: Uses "Your request for" (not "Your introduction to") -- fixed
- Line 123: `if (buyerEmail)` -- no `listingId` guard
- Line 137: `listingId` passed directly (can be undefined)
- Line 139-143: Sender info forwarded correctly
- Line 144: `customBodyText` forwarded

### 4. connection-request-actions/index.tsx
- Line 74-81: `comment` forwarded as third arg to `handleAccept` and `handleReject`

### 5. ConnectionRequestEmailDialog.tsx
- Wide modal (`sm:max-w-4xl`)
- Full email wrapper simulation (SourceCo logo, warm background, footer)
- First-person voice for named senders ("I will be in touch")
- Third-person for support@ ("SourceCo Support will be in touch")
- "Access" not "introductions" in both approval and rejection copy
- Edit/reset body functionality
- Admin comment saved and forwarded
- Adam Haile in sender dropdown

### 6. send-connection-notification edge function
- `listingId` optional in interface (line 16)
- First-person body for named senders (lines 143-148)
- Custom body splits into `<p>` tags via double-newline (lines 134-136)
- `listingUrl` falls back to marketplace when no listingId (line 99)
- Reply-to set to sender email (line 177)

### 7. notify-buyer-rejection edge function
- "We limit access to a small number of buyers per deal" (line 22) -- correct
- Custom body splits into paragraphs (lines 50-54)
- No "introductions" language anywhere

### 8. admin-profiles.ts
- Adam Haile in `DEAL_OWNER_SENDERS` (line 90)
- All senders have correct names and titles

## One concern: Zero edge function logs

Both `send-connection-notification` and `notify-buyer-rejection` show **zero logs**. This could mean:
- No approval/rejection has been attempted since the last deploy (likely, since the code was just unified)
- Or the edge functions need a fresh redeploy

The code in the source files is correct. The only risk is whether the deployed version matches the source. A redeploy of both functions will eliminate this risk.

## No remaining code issues found

All three entry points (side panel, main Requests page, Webflow detail) now use:
- The same `useUpdateConnectionRequestStatus` hook (direct `.update()`)
- `await mutateAsync()` with try/catch (email only sends on success)
- No `listingId` guard on email sends
- Admin comment forwarded as `notes`
- Sender info resolved from `DEAL_OWNER_SENDERS`
- Custom body forwarded to edge functions

## Recommended action

Redeploy both edge functions to guarantee the live code matches the audited source, then test end-to-end.

| Action | Detail |
|--------|--------|
| Redeploy `send-connection-notification` | Ensure live version has optional listingId, first-person copy, paragraph formatting |
| Redeploy `notify-buyer-rejection` | Ensure live version has "access" terminology, paragraph formatting |
| Test approval with Adam as sender | Verify status changes + email arrives |
| Test rejection | Verify status changes + email arrives |

