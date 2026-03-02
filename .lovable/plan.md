

## Update AI Models in Edge Functions

### Changes

#### 1. `supabase/functions/seed-buyers/index.ts` -- Switch from Sonnet to Opus

Three references to `CLAUDE_MODELS.sonnet` need to change to `CLAUDE_MODELS.opus`:

- **Line 433**: `model: CLAUDE_MODELS.sonnet` -> `model: CLAUDE_MODELS.opus` (the actual API call)
- **Line 557**: `seed_model: CLAUDE_MODELS.sonnet` -> `seed_model: CLAUDE_MODELS.opus` (seed log entry)
- **Line 615**: `model: CLAUDE_MODELS.sonnet` -> `model: CLAUDE_MODELS.opus` (response metadata)

Also increase `maxTokens` from 4096 to 8192 since Opus may produce richer output, and increase `timeoutMs` from 60000 to 90000 since Opus is slower.

#### 2. `supabase/functions/score-deal-buyers/index.ts` -- No AI model changes needed

This function is purely algorithmic (keyword matching, geographic scoring, EBITDA range checks). It does not call any AI model. No changes required here.

Note: If the user has made local changes to `score-deal-buyers` that add Gemini Flash integration, those changes are not reflected in the current codebase. The function will be deployed as-is after confirming.

### Deployment

Both functions will be auto-deployed after code changes are saved. No manual deployment commands needed in Lovable.

### Files Modified

| File | Change |
|------|--------|
| `supabase/functions/seed-buyers/index.ts` | Replace `CLAUDE_MODELS.sonnet` with `CLAUDE_MODELS.opus` (3 locations), increase timeout |

