
# Deployment Plan: Fix and Deploy Criteria Extraction Components

## Summary

The branch `claude/analyze-industry-fit-TBMvC` has components with **incorrect table references** that need to be fixed before deployment. The migration and edge function both reference `remarketing_universes` but the actual table is `remarketing_buyer_universes`.

---

## Current Deployment Status

| Component | Status | Action Needed |
|-----------|--------|---------------|
| `buyer_criteria_extractions` table | ❌ Missing | Run fixed migration |
| `extract-buyer-criteria-background` function | ⚠️ Deployed with wrong table name | Redeploy with fix |
| `extract-buyer-criteria` function | ✅ Working | Already deployed with latest changes |
| `criteria_extraction_sources` table | ✅ Exists | None |
| `ma_guide_generations` table | ✅ Exists | None |

---

## Step 1: Create buyer_criteria_extractions Table (Migration)

The migration file references the wrong table name. This will be fixed:

```text
BEFORE (broken):
  REFERENCES remarketing_universes(id)

AFTER (fixed):
  REFERENCES remarketing_buyer_universes(id)
```

**Migration creates:**
- `buyer_criteria_extractions` table with columns:
  - `id`, `universe_id`, `source_id`, `status`
  - `current_phase`, `phases_completed`, `total_phases`
  - `extracted_criteria` (JSONB), `confidence_scores` (JSONB)
  - `error`, `started_at`, `updated_at`, `completed_at`
- Indexes for fast lookups
- RLS policies for user-based access control
- Zombie cleanup function (marks stuck extractions as failed after 10 min)

---

## Step 2: Fix and Redeploy extract-buyer-criteria-background

The edge function also has the wrong table reference that needs fixing:

```text
BEFORE (line 269):
  .from('remarketing_universes')

AFTER:
  .from('remarketing_buyer_universes')
```

This function:
- Accepts universe_id, guide_content, source_name, industry_name
- Returns 202 immediately with extraction_id
- Processes extraction in background (no timeout)
- Updates progress in buyer_criteria_extractions table
- Saves final criteria to remarketing_buyer_universes

---

## Step 3: Verify extract-buyer-criteria (Already Deployed)

This function is already deployed with the latest changes:
- ✅ Removed 100,000 character truncation (uses full guide)
- ✅ Added retry logic with exponential backoff (3 attempts)
- ✅ Added 120s timeout per attempt
- ✅ Handles transient errors (429, 500+)

---

## Files to Modify

### Migration File
**File:** `supabase/migrations/20260204190000_create_criteria_extractions_tracking.sql`

Fix table references:
- Line 6: Change `remarketing_universes` → `remarketing_buyer_universes`
- Lines 43, 55, 66: Change `remarketing_universes` → `remarketing_buyer_universes`

### Edge Function
**File:** `supabase/functions/extract-buyer-criteria-background/index.ts`

Fix table reference:
- Line 261-269: Change `remarketing_universes` → `remarketing_buyer_universes`

---

## Expected Result After Deployment

| Feature | Before | After |
|---------|--------|-------|
| Extraction starts | ❌ 500 error (missing table) | ✅ Returns 202 with extraction_id |
| Progress tracking | ❌ Not possible | ✅ Poll buyer_criteria_extractions table |
| Resume on refresh | ❌ Lost | ✅ Auto-resumes |
| Navigate away | ❌ Cancels extraction | ✅ Continues in background |
| Full guide content | ⚠️ Truncated to 100k | ✅ Uses complete guide |
| Error recovery | ❌ No retries | ✅ 3 retries with backoff |

---

## Testing Steps After Deployment

1. Go to a universe with an M&A guide saved
2. Click "Extract from Guide" in Buyer Fit Criteria section
3. Verify:
   - Progress bar appears with percentage
   - Toast shows "Extraction started in background"
   - Can navigate to another page
   - Return to page → progress continues
   - Refresh page → auto-resumes
   - Completes with success dialog showing confidence score

