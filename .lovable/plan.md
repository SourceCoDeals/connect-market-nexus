
# Plan: Migrate AI Research Guide to Claude (Anthropic)

## Overview

Switch the AI Research Guide generation from Google Gemini to Anthropic Claude. This addresses the rate limiting issues you've been experiencing since Claude has separate quota from the Gemini-based enrichment/scoring functions.

## Technical Changes

### 1. Update Shared AI Providers Module

**File:** `supabase/functions/_shared/ai-providers.ts`

Add Claude model constants and a helper to convert OpenAI-style tool schemas to Anthropic format:

```typescript
// New constants
export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-20250514";
export const DEFAULT_CLAUDE_FAST_MODEL = "claude-3-5-haiku-20241022";

// Helper: Convert OpenAI tool format to Anthropic format
export function toAnthropicTool(openAITool: any) {
  return {
    name: openAITool.function.name,
    description: openAITool.function.description,
    input_schema: openAITool.function.parameters
  };
}
```

### 2. Update generate-ma-guide Edge Function

**File:** `supabase/functions/generate-ma-guide/index.ts`

**Key Changes:**

| Change | Details |
|--------|---------|
| Import Anthropic helpers | Replace Gemini imports with Anthropic ones |
| API key | Use `ANTHROPIC_API_KEY` instead of `GEMINI_API_KEY` |
| Request format | Change to Anthropic's format (separate `system` param, different tool schema) |
| Response parsing | Parse `content[].type === 'tool_use'` + `.input` instead of `tool_calls[].function.arguments` |
| Model selection | Use `claude-sonnet-4-20250514` for critical phases, `claude-3-5-haiku-20241022` for standard |

**Request Format Transformation:**

```text
Gemini (OpenAI-compatible):
{
  model: "gemini-2.0-flash",
  messages: [
    { role: "system", content: "..." },
    { role: "user", content: "..." }
  ],
  tools: [{ type: "function", function: { name, parameters } }]
}

Anthropic:
{
  model: "claude-sonnet-4-20250514",
  system: "...",
  messages: [
    { role: "user", content: "..." }
  ],
  tools: [{ name, description, input_schema }],
  max_tokens: 4096
}
```

**Response Parsing Transformation:**

```text
Gemini: result.choices[0].message.tool_calls[0].function.arguments
Anthropic: result.content.find(c => c.type === 'tool_use').input
```

### 3. Update clarify-industry Edge Function

**File:** `supabase/functions/clarify-industry/index.ts`

Same pattern as above - switch from Gemini to Anthropic API format.

### 4. Functions to Update

Both functions will be updated with this pattern:

```text
┌─────────────────────────────────────────────────────────────┐
│                  generate-ma-guide/index.ts                 │
├─────────────────────────────────────────────────────────────┤
│  • generatePhaseContentWithModel() - Main content generation│
│  • extractCriteria() - Tool-based criteria extraction       │
│  • extractBuyerProfilesWithAI() - Tool-based profile extract│
│  • generateGapFill() - Gap filling content                  │
│  • API key check: GEMINI_API_KEY → ANTHROPIC_API_KEY        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 clarify-industry/index.ts                   │
├─────────────────────────────────────────────────────────────┤
│  • Main handler - Question generation with tool calling     │
│  • API key check: GEMINI_API_KEY → ANTHROPIC_API_KEY        │
└─────────────────────────────────────────────────────────────┘
```

## Model Selection Strategy

| Phase Type | Current (Gemini) | New (Claude) |
|------------|------------------|--------------|
| Standard phases (1a-1d, 2a-2c, 3a, 3c, 4b) | gemini-2.0-flash | claude-3-5-haiku-20241022 |
| Critical phases (1e, 3b, 4a) | gemini-2.0-pro-exp | claude-sonnet-4-20250514 |
| Criteria extraction | gemini-2.0-flash | claude-3-5-haiku-20241022 |
| Clarifying questions | gemini-2.0-flash | claude-3-5-haiku-20241022 |

## Error Handling Updates

Anthropic has specific error codes that differ from Gemini:

| HTTP Status | Meaning | Handling |
|-------------|---------|----------|
| 400 | Invalid request | Log and fail |
| 401 | Invalid API key | Fail with clear message |
| 429 | Rate limited | Retry with backoff |
| 529 | Overloaded | Retry with backoff (Anthropic-specific) |

## Benefits

1. **Separate quota** - Claude has independent rate limits from Gemini, eliminating conflicts with enrichment/scoring
2. **Better long-form content** - Claude excels at comprehensive, structured document generation
3. **Reliability** - Claude's API has proven stable for M&A research content

## Files Modified

| File | Action |
|------|--------|
| `supabase/functions/_shared/ai-providers.ts` | Add Claude model constants and conversion helper |
| `supabase/functions/generate-ma-guide/index.ts` | Migrate from Gemini to Anthropic API |
| `supabase/functions/clarify-industry/index.ts` | Migrate from Gemini to Anthropic API |

## No Frontend Changes Required

The frontend (`AIResearchSection.tsx`) doesn't need changes - it communicates via SSE events that remain unchanged.
