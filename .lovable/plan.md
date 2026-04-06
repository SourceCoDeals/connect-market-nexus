

# Fix Inaccurate Email Copy Across All Emails

## Core Issue

Several emails say "the pipeline is locked" or "sign your NDA to unlock access" as if marketplace browsing requires documents. In reality:
- Marketplace browsing is available WITHOUT any documents
- NDA + Fee Agreement are required for: deal details, data rooms, and introductions
- Multiple emails only mention the NDA and omit the Fee Agreement

## Emails That Need Fixes

### 1. EmailTestCentre Preview e04 (Approval, NDA not signed) — STALE
The preview says "sign your NDA" only and "Before you can browse deal details and request introductions, you'll need to sign your NDA." The actual edge function (`send-templated-approval-email`) already has correct copy mentioning both documents. The preview is out of sync.

**Fix:** Update EmailTestCentre e04 preview to match the actual edge function output.

### 2. EmailTestCentre Preview e05 (Approval, NDA pre-signed) — STALE
Preview says "Your NDA is already on file — you have full access." The edge function already mentions fee agreement for first introduction. Preview is out of sync.

**Fix:** Update EmailTestCentre e05 preview to match the actual edge function.

### 3. NDA Reminder Day 3 (e10) — WRONG COPY IN EDGE FUNCTION
Says "the pipeline is locked until you sign." The pipeline (marketplace) is NOT locked. Browsing works without NDA.

**Fix in edge function + preview:** Change to accurate copy: "deal details and introductions are locked until you sign your documents." Mention Fee Agreement alongside NDA.

### 4. NDA Reminder Day 7 (e11) — WRONG COPY IN EDGE FUNCTION
Says "the pipeline is still locked for you." Same problem.

**Fix in edge function + preview:** Same correction.

### 5. `send-templated-approval-email` — NDA-signed path (line 87)
Says "Your first introduction request will prompt you to sign a fee agreement." This is accurate but could be clearer that the fee agreement can be signed proactively via email.

**Fix:** Change to: "Before your first introduction, you will need a fee agreement in place. You can request it anytime from any listing page, or reply to this email."

### 6. `send-templated-approval-email` — NDA-unsigned path (line 103)
Already correct. Says "sign two standard documents: an NDA and a Fee Agreement." No change needed.

## Sender Address Clarification

All buyer-facing emails send from `support@sourcecodeals.com` (the verified Brevo sender). The agreement request emails (from `request-agreement-email`) tell buyers to reply to `adam.haile@sourcecodeals.com` with signed copies. This is intentional and correct — no change needed.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/send-nda-reminder/index.ts` | Fix "pipeline is locked" to accurate "deal details and introductions require your documents." Mention Fee Agreement. |
| `supabase/functions/send-templated-approval-email/index.ts` | NDA-signed path: clarify fee agreement can be requested proactively |
| `src/pages/admin/EmailTestCentre.tsx` | Update e04, e05, e10, e11 previews to match actual edge function copy |

## Post-Change

Edge functions `send-nda-reminder` and `send-templated-approval-email` must be redeployed.

