

## Problem

**58 out of 83 "neutral" inbox items are actually AI classification failures, not real neutrals.** The `classifyReply()` function is broken because:

1. It calls the **native Gemini API** (`generativelanguage.googleapis.com`) directly
2. But sends model name `google/gemini-2.0-flash-001` (OpenRouter format) — the native API expects `gemini-2.0-flash-001`
3. It also uses `getGeminiApiKey()` which now resolves to `OPENROUTER_API_KEY` — an OpenRouter key sent to the native Gemini endpoint returns 400

Every failed classification defaults to `neutral`, which means:
- **46 GP campaign replies** were misclassified as neutral and **never triggered the GP automation** (no auto-creation of GP Partner Deals, no calling list addition, no phone enrichment)
- Interested leads appear as neutral in the inbox

## Fix

### 1. Route classification through OpenRouter (like all other AI calls)

**File: `supabase/functions/smartlead-inbox-webhook/index.ts`**

In `classifyReply()` (line 88), change the fetch URL from the native Gemini endpoint to `GEMINI_API_URL` (OpenRouter). Import and use the shared constant that already points to `https://openrouter.ai/api/v1/chat/completions`. This aligns with every other AI call in the codebase.

```
// Before (line 88-89):
const response = await fetch(
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',

// After:
const response = await fetch(
  GEMINI_API_URL,
```

`GEMINI_API_URL` is already imported on line 16. No other changes needed — the request body format (OpenAI-compatible with tools) works with OpenRouter.

### 2. Create a backfill edge function to re-classify the 58 failed records

**New file: `supabase/functions/smartlead-reclassify-failed/index.ts`**

Admin-only endpoint that:
1. Selects all `smartlead_reply_inbox` records where `ai_category = 'neutral'` AND `ai_reasoning LIKE '%failed%'`
2. Re-runs `classifyReply()` on each (using the reply body text)
3. Updates `ai_category`, `ai_sentiment`, `ai_is_positive`, `ai_confidence`, `ai_reasoning`, `categorized_at`
4. For GP campaign records that are now classified as positive (`meeting_request`, `interested`, `question`, `referral`): re-trigger the GP automation — create/update GP Partner Deals, add to calling list, enrich phone

This function processes records in batches of 5 with 500ms delays to avoid rate limits.

### 3. Improve the system prompt for better classification accuracy

The current prompt on line 85 says `is_positive should be true ONLY for meeting_request and interested categories` — but the GP automation also activates on `question` and `referral`. The prompt should be updated so that `is_positive = true` for all four activated categories. Additionally, add guidance to bias toward `interested` when the reply shows any engagement or curiosity (to reduce false neutrals from ambiguous replies).

**Updated system prompt addition:**
```
is_positive should be true for: meeting_request, interested, question, and referral categories.
When in doubt between "neutral" and "interested", prefer "interested" if the reply shows any engagement, curiosity, or willingness to learn more.
```

## What Happens After the Fix

**For new webhooks:**
- AI classification routes through OpenRouter (working endpoint) instead of broken native Gemini
- Positive GP replies auto-create GP Partner Deals, populate calling lists, trigger phone enrichment, create follow-up tasks, and send notifications — all already coded but blocked by the classification failure

**For the 58 failed records:**
- Admin calls the backfill endpoint once
- Each record gets properly classified
- GP automation runs retroactively for newly-positive GP records

## Summary of Changes

| File | Change |
|------|--------|
| `supabase/functions/smartlead-inbox-webhook/index.ts` | Fix API URL to `GEMINI_API_URL` (OpenRouter); update system prompt for `is_positive` accuracy |
| `supabase/functions/smartlead-reclassify-failed/index.ts` | New backfill function to re-classify 58 failed neutrals and re-trigger GP automation |

