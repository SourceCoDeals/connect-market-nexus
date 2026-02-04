
# Fix Edge Function Build Errors

## Summary
Fix 7 build errors across 6 edge functions that are preventing deployment. These are TypeScript type mismatches, syntax errors, and outdated API usage.

---

## Errors to Fix

### 1. `apify-linkedin-scrape/index.ts` (Line 341)
**Error:** `Type 'number | null' is not assignable to type 'number | undefined'`

**Root Cause:** The interface `ApifyLinkedInResult` defines `employeeCount?: number` (optional, undefined), but `rawEmployeeCount` is typed as `number | null`.

**Fix:** Change `null` to `undefined`:
```typescript
// Line 320: Change
let rawEmployeeCount: number | null = null;
// To:
let rawEmployeeCount: number | undefined = undefined;
```

---

### 2. `enrich-deal/index.ts` (Lines 779, 832)
**Error:** `Type 'string | null' is not assignable to type 'string'` for `authHeader`

**Root Cause:** `req.headers.get('Authorization')` returns `string | null`, but fetch headers require `string`.

**Fix:** Add null check or assertion since auth is validated earlier:
```typescript
// Lines 779 and 832: Change
'Authorization': authHeader,
// To:
'Authorization': authHeader!,
```

---

### 3. `extract-transcript/index.ts` (Line 62)
**Error:** `Unterminated template` - syntax error with backticks

**Root Cause:** The file has corrupted backticks (showing as `\`` instead of proper backticks).

**Fix:** Replace escaped backticks with proper template literals:
```typescript
// Line 62: Change
console.log(\`[TranscriptExtraction] CEO detected...
// To:
console.log(`[TranscriptExtraction] CEO detected in transcript ${transcript_id}`);
```

---

### 4. `map-csv-columns/index.ts` (Line 169)
**Error:** `Expression expected` - syntax error in ternary chain

**Root Cause:** The ternary operator chain appears to have malformed syntax - there's a triple-nested ternary that's broken.

**Fix:** The file has a broken ternary chain. Looking at lines 120-169, there are three conditions:
- `targetType === 'deal'` 
- Then another condition for 'buyer'
- Then a fallback

The fix is to properly structure the ternary or use if/else.

---

### 5. `process-enrichment-queue/index.ts` (Lines 166, 182)
**Error:** `Type 'unknown' is not assignable to type '{ id: string; ... }'`

**Root Cause:** The `chunk` array from `.map()` has type `unknown[]` because the parent array type isn't properly typed.

**Fix:** Add proper type annotation to `queueItems`:
```typescript
// Define the type and cast queueItems
type QueueItem = { id: string; listing_id: string; attempts: number };
const queueItems = data as QueueItem[];
```

---

### 6. `parse-tracker-documents/index.ts` (Line 118)
**Error:** `Type '"document"' is not assignable to type '"text" | "image" | ..."'`

**Root Cause:** The Anthropic SDK version (0.30.1) doesn't support the `document` content type - this is a newer API feature.

**Fix:** Use base64 image approach or upgrade SDK. Since PDFs can't be sent as images directly, we need to use a different approach - convert to text or upgrade the SDK:
```typescript
// Change document type to use the PDF as base64 with proper typing
// OR upgrade Anthropic SDK to latest version that supports documents
```

---

### 7. `send-owner-intro-notification/index.ts` (Lines 117+)
**Error:** `Property 'primary_owner_id' does not exist on type '...'`

**Root Cause:** The Supabase query returns an array for nested relations (even with `.single()`), so `listing` is actually `listing[]`.

**Fix:** Access the first element of the array:
```typescript
// Line 103: Change
const listing = deal.listing;
// To:
const listing = Array.isArray(deal.listing) ? deal.listing[0] : deal.listing;
```

---

## Technical Changes Summary

| File | Line(s) | Issue | Fix |
|------|---------|-------|-----|
| `apify-linkedin-scrape` | 320 | `null` vs `undefined` | Change to `undefined` |
| `enrich-deal` | 779, 832 | Nullable `authHeader` | Add `!` assertion |
| `extract-transcript` | 62 | Corrupted backticks | Fix template literal |
| `map-csv-columns` | 169 | Broken ternary | Restructure conditionals |
| `process-enrichment-queue` | 166, 182 | Untyped array | Add `QueueItem` type |
| `parse-tracker-documents` | 118 | SDK doesn't support `document` | Use alternative approach |
| `send-owner-intro-notification` | 103+ | Array vs object | Handle array response |

---

## Implementation Order
1. Fix simple type issues first (apify-linkedin-scrape, enrich-deal)
2. Fix syntax errors (extract-transcript, map-csv-columns)
3. Fix array typing (process-enrichment-queue, send-owner-intro-notification)
4. Fix Anthropic SDK issue (parse-tracker-documents)
