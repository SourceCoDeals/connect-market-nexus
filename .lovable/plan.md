
# Dramatically Speed Up Enrichment Pipeline

## Current Bottlenecks Identified

| Bottleneck | Current | Impact |
|------------|---------|--------|
| **Sequential processing** | 1 item at a time within batch | Wastes 70% of edge function time waiting on I/O |
| **Cron frequency** | Every 5 minutes | Only 12 batches/hour even with items pending |
| **3-second delay between items** | 3000ms wait | Adds 12 seconds overhead per batch of 5 |
| **Multi-page scraping** | 5 pages per deal (30s+ per scrape) | Firecrawl is the biggest time sink |
| **Serial external API calls** | LinkedIn → then → Google | Could run in parallel |
| **Rate limit retries** | 2s delay in retry loop | Compounds when quota is near limit |

### Timing Analysis (from logs)
- Website scrape: ~6-8 seconds for 5 pages
- AI extraction: ~4-6 seconds (plus 2s retry on 429)
- LinkedIn API: ~1-3 seconds
- Google API: ~10-15 seconds
- **Total per item: 25-35 seconds**

At 5 items per batch, processing 1 item every ~30s (sequential) = **~2.5 minutes per batch**
With 5-minute cron = **~5-10 items/hour effective throughput**

**Target: 20 companies in 5-10 minutes (200-400 items/hour)**

---

## Solution: Parallel Processing Architecture

### Strategy 1: Process Items in Parallel Within Batch

Instead of processing items sequentially, process all 5 batch items concurrently:

```text
BEFORE (Sequential):
┌──────────────────────────────────────────────────────────────────┐
│ Item 1 (30s) → Item 2 (30s) → Item 3 (30s) → Item 4 (30s) → ... │
│ Total: 150s for 5 items                                          │
└──────────────────────────────────────────────────────────────────┘

AFTER (Parallel):
┌────────────────────────────────────┐
│ Item 1 (30s) ───────────────────→  │
│ Item 2 (30s) ───────────────────→  │
│ Item 3 (30s) ───────────────────→  │  All complete in ~35s
│ Item 4 (30s) ───────────────────→  │
│ Item 5 (30s) ───────────────────→  │
└────────────────────────────────────┘
```

**Result: 5x faster batch processing**

### Strategy 2: Increase Batch Size & Parallelize Pipeline Steps

Current pipeline per item:
1. Firecrawl scrape (sequential pages)
2. AI extraction
3. LinkedIn API call
4. Google Reviews API call

**Optimization**: Run LinkedIn and Google in parallel (they're independent):

```text
BEFORE:
Scrape → AI → LinkedIn → Google
         ↓        ↓         ↓
        10s      3s        15s = 28s sequential

AFTER:
Scrape → AI → ┬→ LinkedIn (3s)  ┬→ Done
              └→ Google (15s)   ┘
                                = 15s parallel
```

### Strategy 3: Reduce Cron Interval

Change from every 5 minutes to every 2 minutes:
- 30 batches/hour vs 12 batches/hour
- Combined with parallel processing: **150 items/hour** (vs current ~10)

### Strategy 4: Smarter Scraping

Reduce pages scraped from 5 to 3 (homepage + contact + about is sufficient for most data):
- Saves ~4 seconds per item

---

## Implementation Plan

### File 1: `supabase/functions/process-enrichment-queue/index.ts`

**Changes:**
1. Increase `BATCH_SIZE` from 5 to 10
2. Replace sequential `for` loop with `Promise.allSettled()` for parallel processing
3. Remove the 3-second delay between items (no longer needed with parallel)
4. Add concurrency limit to prevent overwhelming APIs (max 5 concurrent)

```typescript
// BEFORE: Sequential processing
for (const item of queueItems) {
  await processItem(item);
  await delay(3000);
}

// AFTER: Parallel with concurrency limit
const CONCURRENCY_LIMIT = 5;
const chunks = chunkArray(queueItems, CONCURRENCY_LIMIT);
for (const chunk of chunks) {
  await Promise.allSettled(chunk.map(item => processItem(item)));
}
```

### File 2: `supabase/functions/process-enrichment-queue/enrichmentPipeline.ts`

**Changes:**
1. Run LinkedIn and Google scraping in parallel using `Promise.allSettled()`
2. Both are independent - neither depends on the other's result

```typescript
// BEFORE: Sequential
const liRes = await callFn(input, 'apify-linkedin-scrape', {...});
const googleRes = await callFn(input, 'apify-google-reviews', {...});

// AFTER: Parallel
const [liRes, googleRes] = await Promise.allSettled([
  callFn(input, 'apify-linkedin-scrape', {...}),
  callFn(input, 'apify-google-reviews', {...}),
]);
```

### File 3: `supabase/functions/enrich-deal/index.ts`

**Changes:**
1. Reduce `importantPaths` from 8 paths to 4 most valuable
2. Reduce max additional pages from 4 to 2
3. Process page scrapes in parallel (already doing this)

```typescript
// Reduce pages scraped
const importantPaths = [
  '/contact', '/contact-us',
  '/about', '/about-us',
];

// Only scrape 2 additional pages max
const additionalPages = prioritizedPaths.slice(0, 2);
```

### Database: Update Cron Schedule

```sql
-- Change from every 5 minutes to every 2 minutes
SELECT cron.unschedule('process-enrichment-queue');

SELECT cron.schedule(
  'process-enrichment-queue',
  '*/2 * * * *',  -- Every 2 minutes
  $$
  SELECT net.http_post(
    url := 'https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/process-enrichment-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
      'apikey', current_setting('app.settings.supabase_service_role_key')
    ),
    body := jsonb_build_object('source', 'cron')
  );
  $$
);
```

---

## Expected Performance

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Items per batch | 5 (sequential) | 10 (parallel) | 2x |
| Time per batch | ~150s | ~40s | 3.5x |
| Batches per hour | 12 | 30 | 2.5x |
| **Items per hour** | **~10** | **~300** | **30x** |

**20 companies: ~4 minutes (vs ~2 hours before)**

---

## Risk Mitigation

1. **API Rate Limits**: Concurrency capped at 5 parallel items to stay under Gemini's 2K RPM limit
2. **Edge Function Timeout**: Keep 110s safety cutoff, but process more in parallel within that window
3. **Apify Costs**: No change in API calls, just faster execution
4. **Error Handling**: `Promise.allSettled()` ensures one failure doesn't block others

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/process-enrichment-queue/index.ts` | Parallel batch processing, increase batch size |
| `supabase/functions/process-enrichment-queue/enrichmentPipeline.ts` | Parallel LinkedIn + Google calls |
| `supabase/functions/enrich-deal/index.ts` | Reduce pages scraped (optional optimization) |
| New migration | Update cron schedule to every 2 minutes |

---

## Alternative: Direct Frontend Parallel Enrichment

For immediate use cases (like after CSV import), the frontend could also trigger enrichment in parallel batches directly, bypassing the queue entirely for small imports. This would give instant feedback. Would you like me to include this as part of the plan?
