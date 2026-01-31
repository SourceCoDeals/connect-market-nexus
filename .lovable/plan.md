

# Migration Plan: Lovable AI Gateway → Direct API Keys

## Overview

Migrate all 16 AI-powered edge functions from using the Lovable AI Gateway (`ai.gateway.lovable.dev`) to direct API calls using the project's own API keys:
- `GEMINI_API_KEY` - For Google Gemini models
- `OPENAI_API_KEY` - Already configured
- `ANTHROPIC_API_KEY` - For Claude models

---

## Current State Analysis

### Functions Using Lovable AI Gateway (15 functions)

| Function | Current Model | New Provider | Priority |
|----------|--------------|--------------|----------|
| `score-buyer-deal` | `gemini-3-flash-preview` | GEMINI_API_KEY | High |
| `extract-transcript` | `gemini-3-flash-preview` | GEMINI_API_KEY | High |
| `enrich-buyer` | `gemini-2.5-flash` | GEMINI_API_KEY | High |
| `enrich-deal` | `gemini-3-flash-preview` | GEMINI_API_KEY | High |
| `generate-ma-guide` | `gemini-2.5-flash/pro` | GEMINI_API_KEY | High |
| `parse-fit-criteria` | `gemini-2.5-flash` | GEMINI_API_KEY | Medium |
| `map-csv-columns` | `gemini-3-flash-preview` | GEMINI_API_KEY | Medium |
| `parse-tracker-documents` | `gemini-2.5-flash` | GEMINI_API_KEY | Medium |
| `analyze-tracker-notes` | `gemini-2.5-flash` | GEMINI_API_KEY | Medium |
| `analyze-deal-notes` | `gemini-3-flash-preview` | GEMINI_API_KEY | Medium |
| `update-fit-criteria-chat` | `gemini-2.5-flash` | GEMINI_API_KEY | Medium |
| `clarify-industry` | `gemini-2.5-flash` | GEMINI_API_KEY | Low |
| `score-industry-alignment` | `gemini-3-flash-preview` | GEMINI_API_KEY | Low |
| `parse-transcript-file` | `gemini-2.5-flash` | GEMINI_API_KEY | Medium |
| `extract-deal-transcript` | `gemini-2.5-flash` | GEMINI_API_KEY | Medium |

### Functions Using Anthropic API (1 function)

| Function | Current Model | Issue | Solution |
|----------|--------------|-------|----------|
| `suggest-universe` | `claude-3-haiku-20240307` | Uses `LOVABLE_API_KEY` as x-api-key | Switch to `ANTHROPIC_API_KEY` |

---

## Technical Implementation

### 1. Create Shared AI Helper Module

**New file: `supabase/functions/_shared/ai-providers.ts`**

Create a centralized module for AI provider configuration:

```typescript
// API Endpoints
export const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
export const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
export const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// Model mappings (Lovable Gateway → Native)
export const MODEL_MAP = {
  // Gemini models - use native names
  "google/gemini-3-flash-preview": "gemini-2.0-flash",
  "google/gemini-2.5-flash": "gemini-2.0-flash", 
  "google/gemini-2.5-flash-lite": "gemini-2.0-flash-lite",
  "google/gemini-2.5-pro": "gemini-2.0-pro-exp",
  // Claude models
  "claude-3-haiku-20240307": "claude-3-haiku-20240307",
};
```

### 2. Migration Pattern for Each Function

**Before (Lovable Gateway):**
```typescript
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  headers: {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
  },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash",
    messages: [...],
  }),
});
```

**After (Direct Gemini API):**
```typescript
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const response = await fetch(
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  {
    headers: {
      Authorization: `Bearer ${GEMINI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gemini-2.0-flash",  // Native model name
      messages: [...],
    }),
  }
);
```

**After (Direct Anthropic API):**
```typescript
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const response = await fetch("https://api.anthropic.com/v1/messages", {
  headers: {
    "x-api-key": ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "claude-3-haiku-20240307",
    max_tokens: 1024,
    messages: [...],
  }),
});
```

---

## Files to Modify

### High Priority (Core Remarketing AI)

1. **`supabase/functions/score-buyer-deal/index.ts`**
   - Replace `LOVABLE_API_KEY` → `GEMINI_API_KEY`
   - Update API URL to Gemini direct endpoint
   - Map model `google/gemini-3-flash-preview` → `gemini-2.0-flash`

2. **`supabase/functions/extract-transcript/index.ts`**
   - Same pattern as above

3. **`supabase/functions/enrich-buyer/index.ts`**
   - Same pattern as above

4. **`supabase/functions/enrich-deal/index.ts`**
   - Same pattern as above

5. **`supabase/functions/generate-ma-guide/index.ts`**
   - Multiple AI calls to update
   - Map both `gemini-2.5-flash` and `gemini-2.5-pro` models

### Medium Priority

6. **`supabase/functions/parse-fit-criteria/index.ts`**
7. **`supabase/functions/map-csv-columns/index.ts`**
8. **`supabase/functions/parse-tracker-documents/index.ts`**
9. **`supabase/functions/analyze-tracker-notes/index.ts`**
10. **`supabase/functions/analyze-deal-notes/index.ts`**
11. **`supabase/functions/update-fit-criteria-chat/index.ts`**
12. **`supabase/functions/parse-transcript-file/index.ts`**
13. **`supabase/functions/extract-deal-transcript/index.ts`**

### Low Priority

14. **`supabase/functions/clarify-industry/index.ts`**
15. **`supabase/functions/score-industry-alignment/index.ts`**

### Anthropic Migration

16. **`supabase/functions/suggest-universe/index.ts`**
   - Replace `LOVABLE_API_KEY` → `ANTHROPIC_API_KEY`
   - Update header from `x-api-key: LOVABLE_API_KEY` to `x-api-key: ANTHROPIC_API_KEY`

---

## Model Mapping Reference

| Lovable Gateway Model | Native Gemini Model |
|----------------------|---------------------|
| `google/gemini-3-flash-preview` | `gemini-2.0-flash` |
| `google/gemini-2.5-flash` | `gemini-2.0-flash` |
| `google/gemini-2.5-flash-lite` | `gemini-2.0-flash-lite` |
| `google/gemini-2.5-pro` | `gemini-2.0-pro-exp` |

---

## Error Handling Updates

Update error code detection for direct APIs:

**Gemini API errors:**
- 401: Invalid API key
- 429: Rate limit exceeded
- 500/503: Service unavailable

**Anthropic API errors:**
- 401: Invalid API key
- 429: Rate limit exceeded  
- 529: API overloaded

---

## Implementation Order

1. Create `_shared/ai-providers.ts` helper module
2. Migrate high-priority functions (5 files)
3. Test scoring and extraction workflows
4. Migrate medium-priority functions (8 files)
5. Migrate low-priority functions (2 files)
6. Migrate Anthropic function (1 file)

---

## Expected Outcome

After migration:
- All AI calls use your own API keys directly
- No dependency on Lovable AI Gateway
- Full control over rate limits and billing
- Same functionality with native API endpoints

