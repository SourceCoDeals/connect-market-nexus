

# Plan: Fix All Edge Function Build Errors

## Overview

Fix 23+ TypeScript errors across 8 edge function files to restore the build. All errors fall into 4 categories.

---

## Error Categories & Fix Patterns

### Category 1: `'error' is of type 'unknown'` (14 occurrences)

**Pattern**: Cast error in catch blocks

```typescript
// BEFORE
} catch (error) {
  return JSON.stringify({ error: error.message });
}

// AFTER  
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return JSON.stringify({ error: message });
}
```

### Category 2: `'geographic_states' does not exist on type` (7 occurrences)

**Pattern**: Add to type definition

```typescript
// Add to ExtractedData interface
interface ExtractedData {
  revenue?: number;
  ebitda?: number;
  ebitda_margin?: number;
  full_time_employees?: number;
  geographic_states?: string[];  // ADD THIS
}
```

### Category 3: Content variable type mismatch (4 occurrences)

**Pattern**: Use nullish coalescing

```typescript
// BEFORE
platformContent = platformResult.content;  // string | undefined

// AFTER
platformContent = platformResult.content ?? null;  // string | null
```

### Category 4: `billingError` property access on 'never' (4 occurrences)

**Pattern**: Add explicit type

```typescript
// BEFORE
} catch (billingError) {
  const statusCode = billingError.code === 'payment_required' ? 402 : 429;

// AFTER
} catch (billingError: unknown) {
  const err = billingError as { code?: string; message?: string };
  const statusCode = err.code === 'payment_required' ? 402 : 429;
```

---

## Files to Modify

| File | Errors | Fix |
|------|--------|-----|
| `analyze-tracker-notes/index.ts` | 1 | Cast error at line 252 |
| `backfill-daily-metrics/index.ts` | 1 | Cast error at line 99 |
| `aggregate-daily-metrics/index.ts` | 1 | Cast error at line 240 |
| `analyze-deal-notes/index.ts` | 7 | Add `geographic_states` to type + cast error |
| `bulk-import-remarketing/index.ts` | 8 | Cast errors at lines 265, 328, 433, 480, 481, 541, 599, 616 |
| `dedupe-buyers/index.ts` | 1 | Cast error at line 221 |
| `enrich-buyer/index.ts` | 8 | Fix content types + cast billingError |
| `enrich-deal/index.ts` | 2 | Add `geographic_states` + cast error |

---

## Technical Changes

### 1. analyze-tracker-notes/index.ts (Line 252)

```typescript
// Line 252: Cast error
} catch (error) {
  const message = error instanceof Error ? error.message : 'Failed to analyze notes';
  return new Response(
    JSON.stringify({ error: message }),
```

### 2. backfill-daily-metrics/index.ts (Line 99)

```typescript
// Line 99: Cast error
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return new Response(JSON.stringify({ error: message }), {
```

### 3. aggregate-daily-metrics/index.ts (Line 240)

```typescript
// Line 240: Cast error
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return new Response(JSON.stringify({ error: message }), {
```

### 4. analyze-deal-notes/index.ts (Lines 265-352)

Add `geographic_states` to the extracted type definition around line 265:

```typescript
const extracted: {
  revenue?: number;
  ebitda?: number;
  ebitda_margin?: number;
  full_time_employees?: number;
  geographic_states?: string[];  // ADD THIS
} = {};
```

Add `geographic_states` to finalUpdates around line 306:

```typescript
const finalUpdates: {
  notes_analyzed_at: string;
  extraction_sources: ExtractionSources;
  geographic_states?: string[];  // ADD THIS
} = {
```

Cast error at line 352:

```typescript
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return new Response(JSON.stringify({ error: message }), {
```

### 5. bulk-import-remarketing/index.ts (8 locations)

Cast all errors using helper function at top of file:

```typescript
// Add at top of file after imports
function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Unknown error';
}

// Line 265
results.universes.errors.push(`Universe ${row.industry_name}: ${getErrorMessage(e)}`);

// Line 328
results.buyers.errors.push(`Buyer ${row.platform_company_name}: ${getErrorMessage(e)}`);

// Line 433
results.contacts.errors.push(`Contact ${row.name}: ${getErrorMessage(e)}`);

// Line 480
console.log(`Transcript exception: ${getErrorMessage(e)}`);

// Line 481
results.transcripts.errors.push(`Transcript ${row.title}: ${getErrorMessage(e)}`);

// Line 541
results.scores.errors.push(`Score: ${getErrorMessage(e)}`);

// Line 599
results.learningHistory.errors.push(`Learning: ${getErrorMessage(e)}`);

// Line 616
} catch (error) {
  return new Response(JSON.stringify({ error: getErrorMessage(error) }), {
```

### 6. dedupe-buyers/index.ts (Line 221)

```typescript
// Line 221: Cast error
} catch (error) {
  const message = error instanceof Error ? error.message : 'Failed to check for duplicates';
  return new Response(JSON.stringify({
    error: message,
```

### 7. enrich-buyer/index.ts (Lines 194-436)

Fix content type assignments (lines 194-207):

```typescript
// Line 194
platformContent = platformResult.content ?? null;

// Line 195 - add null check
if (platformContent) {
  console.log(`Scraped platform website: ${platformContent.length} chars`);
}

// Line 206
peFirmContent = peFirmResult.content ?? null;

// Line 207 - add null check
if (peFirmContent) {
  console.log(`Scraped PE firm website: ${peFirmContent.length} chars`);
}
```

Fix billingError typing (lines 425-436):

```typescript
// Line 425-436
} catch (billingError: unknown) {
  const err = billingError as { code?: string; message?: string };
  const statusCode = err.code === 'payment_required' ? 402 : 429;
  return new Response(
    JSON.stringify({
      success: false,
      error: err.message || 'Billing error',
      error_code: err.code || 'unknown',
      recoverable: err.code === 'rate_limited'
    }),
```

### 8. enrich-deal/index.ts (Lines 381+)

Add `geographic_states` to finalUpdates type around line 370:

```typescript
const finalUpdates: {
  enriched_at: string;
  extraction_sources: ExtractionSources;
  geographic_states?: string[];  // ADD THIS
} = {
```

Cast error in catch block:

```typescript
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return new Response(JSON.stringify({ error: message }), {
```

---

## Deployment

After fixing all errors, deploy the updated edge functions:

1. `analyze-tracker-notes`
2. `backfill-daily-metrics`
3. `aggregate-daily-metrics`
4. `analyze-deal-notes`
5. `bulk-import-remarketing`
6. `dedupe-buyers`
7. `enrich-buyer`
8. `enrich-deal`

---

## Expected Outcome

- All 23+ TypeScript errors resolved
- Build passes successfully
- Edge functions deploy correctly
- System ready for stability hardening phase (timeouts, validation)

