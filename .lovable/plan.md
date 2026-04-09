

# Add "Activated" Sentiment + Reclassify All Emails + Fix Build Errors

## Overview

Two workstreams in one plan:
1. **Fix existing build errors** (8 files with TypeScript issues from prior edits)
2. **Smartlead classification overhaul** — add "activated" sentiment, update prompt, reclassify all existing emails, and expand the GP automation trigger to include "activated" responses

## What Changes

### New Classification Model

The current system uses `is_positive` (boolean) to decide what triggers GP deal automation. The categories `meeting_request`, `interested`, `question`, `referral` are considered "positive."

New model:
- **Positive** = wants a meeting (maps to `meeting_request` category only)
- **Activated** = anything that isn't a stern no — covers `interested`, `question`, `referral`, `not_now`
- **Negative** = `not_interested`, `unsubscribe`, `negative_hostile`
- **Neutral** = `out_of_office`, `neutral` (can't determine intent)

GP automation trigger: **positive OR activated** (same categories as before, but the _sentiment_ label changes to be more descriptive)

### Reclassification

A new edge function endpoint will re-run AI classification on ALL existing inbox records (not just failed ones), updating sentiment to use the new 4-value enum. It will NOT trigger the GP deal automation during reclassification — only update the classification fields.

---

## Detailed Changes

### Part 1: Fix Build Errors (6 files)

| File | Fix |
|------|-----|
| `src/components/portal/PushToPortalDialog.tsx:305` | Cast `singleDealMissingMemo` to `!!` to ensure boolean (not `boolean \| null \| undefined`) |
| `src/hooks/portal/use-portal-users.ts:134` | Cast supabase to `any` for `track_portal_login` RPC call since it's not in generated types |
| `src/pages/admin/client-portals/ClientPortalDetail.tsx:32,320` | Remove unused `PriorityBadge` import and `hasMemo` variable |
| `src/pages/admin/remarketing/CapTargetDeals/useCapTargetData.ts` | Add `as unknown as CapTargetDeal[]` double-cast on all `untypedFrom` results (6 locations); cast stats items to `Record<string, unknown>` properly |

### Part 2: Smartlead Classification Overhaul (9 files)

**Edge Functions (3 files):**

| File | Change |
|------|--------|
| `supabase/functions/smartlead-inbox-webhook/index.ts` | Update `AIClassification.sentiment` enum from `['positive', 'negative', 'neutral']` to `['positive', 'activated', 'negative', 'neutral']`. Update `DEFAULT_SYSTEM_PROMPT` with new sentiment definitions. Update `ACTIVATED_CATEGORIES` usage — GP trigger now checks `sentiment === 'positive' \|\| sentiment === 'activated'` instead of `is_positive`. Keep `is_positive` field for backward compat but derive it from sentiment. |
| `supabase/functions/smartlead-reclassify-failed/index.ts` | Same prompt/sentiment enum updates. Same `is_positive` derivation. |
| New: `supabase/functions/smartlead-reclassify-all/index.ts` | New admin-only endpoint that reclassifies ALL inbox records (not just failed). Processes in batches of 5 with 500ms delay. Updates `ai_sentiment`, `ai_category`, `ai_confidence`, `ai_reasoning`, `ai_is_positive`, `categorized_at`. Does NOT trigger GP automation (no deal creation, no calling list, no phone enrichment). Returns summary of changes. |

**Frontend UI (6 files):**

| File | Change |
|------|--------|
| `src/pages/admin/SmartleadResponseDetail.tsx:58` | Add `'activated'` to `SENTIMENTS` array |
| `src/pages/admin/SmartleadResponseDetail.tsx:73` | Add activated color to `getSentimentColor()` |
| `src/pages/admin/SmartleadResponsesList.tsx:51` | Add activated color to `getSentimentColor()` |
| `src/pages/admin/settings/SmartleadSettingsPage.tsx:28-44` | Update `DEFAULT_PROMPT` with new sentiment definitions |
| `src/components/email/DealEmailActivity.tsx` | Add activated sentiment color |
| `src/pages/admin/settings/SmartleadSettingsPage.tsx` | Add "Reclassify All" button (calls `smartlead-reclassify-all` endpoint) next to existing reclassify-failed button |

**Prompt Update (all 3 edge functions + settings page):**

```text
Sentiment values:
- positive: explicitly wants a meeting or call
- activated: shows engagement, interest, asks questions, provides referral, or says "not right now" — anything other than a firm rejection
- negative: firm decline, hostile, or unsubscribe
- neutral: out of office, cannot determine intent

is_positive should be true for positive and activated sentiments.
```

**Category-to-sentiment mapping guidance in prompt:**
- `meeting_request` → positive
- `interested`, `question`, `referral`, `not_now` → activated
- `not_interested`, `unsubscribe`, `negative_hostile` → negative
- `out_of_office`, `neutral` → neutral

### Part 3: Deploy & Reclassify

After code changes:
1. Deploy all 3 edge functions
2. Update the `app_settings` classification prompt in DB via the Settings UI
3. Admin clicks "Reclassify All Responses" button to re-run classification on all existing records (no GP automation triggered)

---

## Technical Details

- The `ai_is_positive` DB column remains boolean and is derived: `true` when sentiment is `positive` or `activated`
- GP automation trigger condition changes from `classification.is_positive` to `['positive', 'activated'].includes(classification.sentiment)` — functionally identical to current behavior but semantically clearer
- The reclassify-all endpoint uses the same `requireAdmin` auth as reclassify-failed
- Reclassify-all skips GP automation by design — it only updates classification fields
- The `smartlead-inbox-webhook` still triggers GP automation for new incoming responses as before

