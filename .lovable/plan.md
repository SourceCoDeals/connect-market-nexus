

# Fix Extract-Deal-Transcript: Switch from Gemini to Claude

## Problem Summary

The `extract-deal-transcript` edge function is **completely broken** with a 400 error:

```
"The specified schema produces a constraint that has too much branching for serving. 
Typical causes: objects with lots of optional properties, enums with too many values."
```

The Gemini OpenAI-compatible endpoint cannot handle the 30+ optional properties in the tool schema.

## Solution

Switch from Gemini to **Claude API**, which handles complex schemas reliably. The shared helper `callClaudeWithTool` already exists in `_shared/ai-providers.ts`.

---

## Implementation Steps

### Step 1: Update imports and API key reference

Replace Gemini imports with Claude helper:

```typescript
// REMOVE:
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../_shared/ai-providers.ts";

// ADD:
import { callClaudeWithTool, DEFAULT_CLAUDE_MODEL } from "../_shared/ai-providers.ts";
```

Update API key:
```typescript
// CHANGE from:
const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

// TO:
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
```

### Step 2: Restructure AI call to use Claude helper

Replace the raw `fetch` call to Gemini (lines 175-292) with the `callClaudeWithTool` helper:

```typescript
const tool = {
  type: 'function',
  function: {
    name: 'extract_deal_info',
    description: 'Extract comprehensive deal intelligence from transcript',
    parameters: {
      type: 'object',
      properties: {
        // ... existing 30+ properties unchanged
      }
    }
  }
};

const systemPrompt = 'You are an expert M&A analyst. Extract structured data from transcripts using the provided tool. Be thorough but conservative - only include data that is explicitly stated or clearly inferrable.';

const { data: extracted, error: aiError } = await callClaudeWithTool(
  systemPrompt,
  extractionPrompt,
  tool,
  anthropicApiKey,
  DEFAULT_CLAUDE_MODEL,
  60000  // 60 second timeout for long transcripts
);

if (aiError) {
  console.error('Claude API error:', aiError);
  throw new Error(`AI extraction failed: ${aiError.message}`);
}

if (!extracted) {
  throw new Error('No extraction result from AI');
}
```

### Step 3: Remove Gemini response parsing

The `callClaudeWithTool` helper already parses the response and returns structured data directly. Remove the manual parsing logic (lines 300-324).

### Step 4: Keep all downstream logic unchanged

The field mapping, priority updates, and database writes (lines 326-478) work correctly and don't need changes.

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/extract-deal-transcript/index.ts` | Switch from Gemini to Claude API |

---

## Verification Steps

After deployment:

1. Navigate to a deal with transcripts
2. Click "Process Transcript" button
3. Verify extraction succeeds (no 400 error)
4. Check that extracted fields appear in deal profile
5. Verify `processed_at` timestamp is set

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Claude API cost higher than Gemini | Acceptable - extraction only runs on-demand |
| Claude timeout on very long transcripts | Set 60s timeout (up from default 20s) |
| ANTHROPIC_API_KEY missing | ✅ Verified present in secrets |

---

## Technical Details

**API Used:** Anthropic Messages API (`https://api.anthropic.com/v1/messages`)

**Model:** `claude-sonnet-4-20250514` (DEFAULT_CLAUDE_MODEL)

**Why Claude Works:** Claude's tool calling has no schema complexity limits like Gemini's OpenAI-compatible endpoint. The existing `extract-buyer-transcript` function already uses Claude successfully with similar complexity.

