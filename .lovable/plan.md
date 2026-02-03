

# Enrichment Pipeline Fix: Complete Implementation Plan

## Executive Summary

The enrichment system has several critical issues that prevent deals from being automatically enriched with website and LinkedIn data:

| Requirement | Status | Issue |
|-------------|--------|-------|
| Website Required | PARTIAL FAIL | UI enforces, but DB allows NULL; websites stored in wrong column |
| Website Scraping | PARTIAL PASS | Works but not triggered automatically on deal creation |
| Apify LinkedIn | FAIL | Function exists but is never called from enrichment pipeline |
| Auto-Enrichment Trigger | FAIL | Database trigger migration was never applied |
| Scoring Uses Enriched Data | PASS | Score-buyer-deal uses enriched fields in AI prompt |

### Root Causes
1. **31 deals have websites in `internal_deal_memo_link` but not in `website` column** - The enrichment function reads from either field, but data is inconsistent
2. **Migration file `20260203_auto_enrich_trigger.sql` was not applied** - It lacks the UUID format, so database trigger doesn't exist
3. **Auto-enrichment only runs when admin visits the Deals page** - No background worker processes the queue
4. **Apify function is orphaned** - Never integrated into the `enrich-deal` flow

---

## Implementation Steps

### Phase 1: Database Migration

**New Migration: Create enrichment queue and triggers**

1. Add columns to `listings`:
   - `enrichment_scheduled_at` (TIMESTAMPTZ)
   - `enrichment_refresh_due_at` (TIMESTAMPTZ)

2. Create `enrichment_queue` table with:
   - `listing_id` (FK to listings)
   - `status` (pending, processing, completed, failed)
   - `attempts` (counter for retries)
   - `last_error` (text for debugging)

3. Create DB triggers:
   - `auto_enrich_new_listing`: fires on INSERT
   - `auto_enrich_updated_listing`: fires when website/internal_deal_memo_link changes

4. Create view `listings_needing_enrichment` for monitoring

### Phase 2: Backfill Websites from internal_deal_memo_link

**One-time migration to normalize data:**

```sql
UPDATE listings
SET website = internal_deal_memo_link
WHERE website IS NULL
  AND internal_deal_memo_link IS NOT NULL
  AND internal_deal_memo_link NOT LIKE '%sharepoint%'
  AND internal_deal_memo_link NOT LIKE '%onedrive%'
  AND (internal_deal_memo_link LIKE 'http%' 
       OR internal_deal_memo_link ~ '^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}');
```

### Phase 3: Integrate Apify into enrich-deal Pipeline

**Update `supabase/functions/enrich-deal/index.ts`:**

1. Add `linkedin_url` to AI extraction schema
2. After successful Firecrawl+Gemini extraction, check for LinkedIn URL
3. If LinkedIn URL found (or derivable from company name), call `apify-linkedin-scrape`
4. Persist `linkedin_employee_count` and `linkedin_employee_range` to listings
5. Add `linkedin_employee_count` and `linkedin_employee_range` to `VALID_LISTING_UPDATE_KEYS`

### Phase 4: Create Queue Processor Edge Function

**New edge function: `supabase/functions/process-enrichment-queue/index.ts`**

This function:
1. Queries `enrichment_queue` for pending items (oldest first, max 5 per batch)
2. Marks items as `processing`
3. Calls `enrich-deal` for each listing
4. Updates queue status to `completed` or `failed`
5. Implements retry logic (max 3 attempts)
6. Rate limits to avoid API overload

### Phase 5: Create Cron Job for Queue Processing

Use pg_cron to call the queue processor every 5 minutes.

### Phase 6: Trigger Enrichment After Deal Creation

1. `AddDealToUniverseDialog.tsx`: After creating deal, immediately call `enrich-deal`
2. `DealCSVImport.tsx`: After importing batch, trigger enrichment for all new deals
3. Add toast notification showing enrichment progress

### Phase 7: Display Enrichment Status in UI

Add enrichment status badge to `ReMarketingDeals.tsx` showing:
- Never enriched (no icon)
- Enriching... (spinner)
- Enriched (sparkles icon with date tooltip)
- Failed (warning icon)

---

## Files to Create/Modify

| Action | File | Description |
|--------|------|-------------|
| **CREATE** | `supabase/migrations/[timestamp]_enrichment_infrastructure.sql` | Queue table, triggers, columns |
| **CREATE** | `supabase/functions/process-enrichment-queue/index.ts` | Background queue processor |
| **MODIFY** | `supabase/functions/enrich-deal/index.ts` | Add linkedin_url extraction, call Apify |
| **MODIFY** | `src/components/remarketing/AddDealToUniverseDialog.tsx` | Trigger enrichment after creation |
| **MODIFY** | `src/components/remarketing/DealCSVImport.tsx` | Trigger enrichment after import |
| **MODIFY** | `src/pages/admin/remarketing/ReMarketingDeals.tsx` | Better enrichment status display |
| **DELETE** | `supabase/migrations/20260203_auto_enrich_trigger.sql` | Remove malformed migration file |

---

## Success Criteria

After implementation:

1. **100% of new deals** are automatically enriched within 5 minutes of creation
2. **Website column** is populated for all deals (required field)
3. **LinkedIn employee data** is fetched for deals with findable company pages
4. **Real company names** are extracted (no more "Performance Marketing Agency")
5. **Structured address** extracted (using new address_city, address_state fields)
6. **Enrichment queue table exists** for audit trail and debugging

