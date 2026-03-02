

## Fix: Enable In-App Signing for Pending/Not-Sent Agreements

### Root Cause

In `src/pages/BuyerMessages/AgreementSection.tsx`, the `buildDocItem` function categorizes documents with `not_sent` or `pending` DocuSeal status as `awaiting: true`. When `awaiting` is true, the UI renders only a "Questions?" button -- no "Sign Now" button appears (lines 237-248).

However, both edge functions (`get-buyer-nda-embed` and `get-buyer-fee-embed`) are designed to **auto-create** DocuSeal submissions on demand if none exist. So the buyer CAN sign even when the admin hasn't explicitly "sent" the document yet -- the backend handles it.

The current UI blocks this by hiding the signing action behind a passive "will be sent to you shortly" message.

### Solution

**File: `src/pages/BuyerMessages/AgreementSection.tsx`**

1. **Remove the `awaiting` branch as a separate state** -- treat `not_sent` and `pending` the same as `sent`/`viewed` by showing the "Sign Now" button alongside download/questions actions.

2. **Update descriptions** for `pending` and `not_sent` statuses from the passive "will be sent to you shortly" to an actionable message like "Ready to review and sign" since the system can generate the form on demand.

3. **Update labels** from "NDA -- Pending" to "NDA -- Ready to Sign" for these states to match the actionable nature.

4. **Simplify the render logic** -- collapse the `awaiting` conditional branch into the default (non-signed, non-declined) branch so these items always show: Draft Download (if available) + Questions + **Sign Now** button.

### Specific Changes

In `buildDocItem` (lines 80-114):
- Change `pending` and `not_sent` labels from "--- Pending" to "Ready to Sign"
- Change descriptions from "will be sent to you shortly" to "Ready for your review and signature"
- Remove `awaiting` field from DocItem (or keep but don't use it to hide Sign Now)

In the render section (lines 237-248):
- Remove the `item.awaiting` conditional branch entirely
- The `else` branch (lines 249-286) already has Sign Now + Draft Download + Questions -- this becomes the default for all non-signed, non-declined items

In `src/pages/BuyerMessages/types.ts`:
- Remove `awaiting` from `DocItem` type (cleanup)

### Files to Change

| File | Change |
|------|--------|
| `src/pages/BuyerMessages/AgreementSection.tsx` | Remove `awaiting` branch; show Sign Now for all unsigned documents; update labels/descriptions |
| `src/pages/BuyerMessages/types.ts` | Remove `awaiting` field from DocItem type |
