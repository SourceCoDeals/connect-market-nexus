# LinkedIn Match Quality Monitoring Guide

## 🎯 What Was Added

### New Database Columns
1. **`linkedin_match_confidence`** - Quality level: 'high', 'medium', 'low', 'manual', 'failed'
2. **`linkedin_match_signals`** - JSON object with verification details
3. **`linkedin_verified_at`** - Timestamp when profile was verified

### New Database View
**`linkedin_manual_review_queue`** - Auto-generated queue of profiles needing review

### Helper Function
**`update_linkedin_match_confidence()`** - Update confidence manually

---

## 📊 Match Confidence Levels

### **HIGH** ✅
- **Criteria:** Website AND location both verified
- **Example:** Profile found via search, website matches, HQ matches city/state
- **Action:** Auto-accept, no review needed

### **MEDIUM** ⚠️
- **Criteria:** Either website OR location verified
- **Example:** Website matches but HQ in different city (multi-location company)
- **Action:** Auto-accept, spot check occasionally

### **LOW** 🔍
- **Criteria:** No strong verification signals
- **Example:** No website to verify, location unclear
- **Action:** Review manually before trusting employee count

### **MANUAL** 👤
- **Criteria:** User provided LinkedIn URL directly
- **Example:** Admin added URL in deal editor
- **Action:** Trust it (user knows the company)

### **FAILED** ❌
- **Criteria:** Verification explicitly failed
- **Example:** Website mismatch, location in different state
- **Action:** Fix the LinkedIn URL or remove it

---

## 🔍 Monitoring Queries

### 1. View Manual Review Queue
```sql
SELECT * FROM linkedin_manual_review_queue
ORDER BY
  CASE linkedin_match_confidence
    WHEN 'failed' THEN 1
    WHEN 'low' THEN 2
    ELSE 3
  END,
  suspicious_employee_mismatch DESC,
  updated_at DESC
LIMIT 50;
```

**Returns:**
- Deals with low/failed confidence
- Deals with suspicious employee count mismatches (>5x difference)
- Sorted by priority

### 2. Check Match Quality Distribution
```sql
SELECT
  linkedin_match_confidence,
  COUNT(*) as deal_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
FROM listings
WHERE linkedin_url IS NOT NULL
GROUP BY linkedin_match_confidence
ORDER BY
  CASE linkedin_match_confidence
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
    WHEN 'manual' THEN 4
    WHEN 'failed' THEN 5
  END;
```

**Expected Results (after Phase 1):**
```
Confidence  | Count | %
------------|-------|-----
high        | 450   | 45%
medium      | 300   | 30%
low         | 100   | 10%
manual      | 120   | 12%
failed      | 30    | 3%
```

### 3. Find Employee Count Mismatches
```sql
SELECT
  id,
  title,
  address_city,
  address_state,
  full_time_employees,
  linkedin_employee_count,
  linkedin_match_confidence,
  linkedin_url,
  ROUND(linkedin_employee_count::numeric / NULLIF(full_time_employees, 0), 2) as ratio
FROM listings
WHERE linkedin_employee_count IS NOT NULL
  AND full_time_employees > 0
  AND (
    linkedin_employee_count > full_time_employees * 5
    OR linkedin_employee_count < full_time_employees / 5
  )
ORDER BY ratio DESC
LIMIT 50;
```

**Red flags:**
- Ratio > 5.0: LinkedIn shows 5x+ more employees (wrong company?)
- Ratio < 0.2: LinkedIn shows 5x+ fewer employees (outdated or wrong?)

### 4. Check Recent Verifications
```sql
SELECT
  id,
  title,
  linkedin_match_confidence,
  linkedin_match_signals->>'websiteMatch' as website_match,
  linkedin_match_signals->'locationMatch'->>'confidence' as location_confidence,
  linkedin_verified_at
FROM listings
WHERE linkedin_verified_at > NOW() - INTERVAL '24 hours'
ORDER BY linkedin_verified_at DESC
LIMIT 100;
```

### 5. Find Deals Missing LinkedIn Data
```sql
SELECT
  id,
  title,
  website,
  address_city,
  address_state,
  enriched_at
FROM listings
WHERE enriched_at IS NOT NULL  -- Was enriched
  AND linkedin_url IS NULL       -- But no LinkedIn found
  AND website IS NOT NULL        -- And we have a website
ORDER BY enriched_at DESC
LIMIT 50;
```

**These deals might benefit from manual LinkedIn URL entry.**

---

## 🛠️ Manual Review Workflow

### Step 1: Check the Queue
```sql
SELECT * FROM linkedin_manual_review_queue LIMIT 20;
```

### Step 2: Investigate a Flagged Deal
```sql
SELECT
  id,
  title,
  internal_company_name,
  website,
  linkedin_url,
  linkedin_match_confidence,
  linkedin_match_signals,
  full_time_employees,
  linkedin_employee_count,
  linkedin_headquarters,
  address_city,
  address_state
FROM listings
WHERE id = 'YOUR_DEAL_ID';
```

### Step 3: Check Match Signals
```sql
SELECT
  id,
  title,
  linkedin_match_signals->>'foundViaSearch' as found_via_search,
  linkedin_match_signals->>'websiteMatch' as website_match,
  linkedin_match_signals->'locationMatch'->>'match' as location_match,
  linkedin_match_signals->'locationMatch'->>'confidence' as location_confidence,
  linkedin_match_signals->'locationMatch'->>'reason' as location_reason,
  linkedin_match_signals->>'companyName' as linkedin_company_name,
  linkedin_match_signals->>'linkedinHeadquarters' as linkedin_hq,
  linkedin_match_signals->>'expectedLocation' as expected_location
FROM listings
WHERE id = 'YOUR_DEAL_ID';
```

### Step 4: Fix If Needed

**Option A: Update with correct LinkedIn URL**
```sql
UPDATE listings
SET
  linkedin_url = 'https://www.linkedin.com/company/correct-company',
  linkedin_match_confidence = 'manual'
WHERE id = 'YOUR_DEAL_ID';
```
Then re-run enrichment to fetch correct employee count.

**Option B: Mark as verified if actually correct**
```sql
SELECT update_linkedin_match_confidence(
  'YOUR_DEAL_ID'::uuid,
  'high',
  jsonb_build_object('manuallyVerified', true, 'verifiedBy', 'admin@example.com')
);
```

**Option C: Remove incorrect LinkedIn data**
```sql
UPDATE listings
SET
  linkedin_url = NULL,
  linkedin_employee_count = NULL,
  linkedin_employee_range = NULL,
  linkedin_match_confidence = NULL,
  linkedin_match_signals = NULL
WHERE id = 'YOUR_DEAL_ID';
```

---

## 📈 Weekly Monitoring Routine

### Monday: Check Queue Size
```sql
SELECT COUNT(*) as needs_review
FROM linkedin_manual_review_queue;
```
**Goal:** Keep < 50 items in queue

### Wednesday: Review Suspicious Mismatches
```sql
SELECT * FROM linkedin_manual_review_queue
WHERE suspicious_employee_mismatch = true
LIMIT 20;
```
Fix obvious wrong matches.

### Friday: Quality Check
```sql
-- Distribution should be mostly high/medium
SELECT linkedin_match_confidence, COUNT(*)
FROM listings
WHERE linkedin_url IS NOT NULL
GROUP BY linkedin_match_confidence;
```

---

## 🎯 Success Metrics

### Week 1 Targets
- [ ] < 50 deals in manual review queue
- [ ] > 70% high or medium confidence
- [ ] < 5% failed matches
- [ ] Zero employee count mismatches >10x

### Month 1 Targets
- [ ] > 85% high or medium confidence
- [ ] < 20 deals in review queue
- [ ] < 2% failed matches
- [ ] Employee count mismatches resolved

---

## 🚨 Alert Thresholds

Set up alerts for:

### Critical (immediate action)
```sql
-- More than 100 deals need review
SELECT COUNT(*) FROM linkedin_manual_review_queue
HAVING COUNT(*) > 100;
```

### Warning (weekly review)
```sql
-- More than 10% low confidence matches
SELECT
  COUNT(*) FILTER (WHERE linkedin_match_confidence = 'low')::numeric /
  NULLIF(COUNT(*), 0) as low_confidence_pct
FROM listings
WHERE linkedin_url IS NOT NULL
HAVING low_confidence_pct > 0.10;
```

---

## 📊 Dashboard Queries

### Match Quality Overview
```sql
WITH stats AS (
  SELECT
    COUNT(*) FILTER (WHERE linkedin_match_confidence = 'high') as high_count,
    COUNT(*) FILTER (WHERE linkedin_match_confidence = 'medium') as medium_count,
    COUNT(*) FILTER (WHERE linkedin_match_confidence = 'low') as low_count,
    COUNT(*) FILTER (WHERE linkedin_match_confidence = 'manual') as manual_count,
    COUNT(*) FILTER (WHERE linkedin_match_confidence = 'failed') as failed_count,
    COUNT(*) as total
  FROM listings
  WHERE linkedin_url IS NOT NULL
)
SELECT
  'High Confidence' as category, high_count as count,
  ROUND(high_count * 100.0 / total, 1) as percentage
FROM stats
UNION ALL
SELECT 'Medium Confidence', medium_count, ROUND(medium_count * 100.0 / total, 1) FROM stats
UNION ALL
SELECT 'Low Confidence', low_count, ROUND(low_count * 100.0 / total, 1) FROM stats
UNION ALL
SELECT 'Manual Entry', manual_count, ROUND(manual_count * 100.0 / total, 1) FROM stats
UNION ALL
SELECT 'Failed', failed_count, ROUND(failed_count * 100.0 / total, 1) FROM stats;
```

---

## ✅ Migration Checklist

- [ ] Run migration: `supabase/migrations/20260207_linkedin_match_confidence.sql`
- [ ] Deploy updated function: `supabase functions deploy apify-linkedin-scrape`
- [ ] Run test enrichment on 5-10 deals
- [ ] Check `linkedin_manual_review_queue` view works
- [ ] Verify confidence levels are being set correctly
- [ ] Set up weekly monitoring routine
- [ ] Train team on manual review workflow

---

## 🎓 Training Notes

**For Data Team:**
- Low confidence doesn't mean wrong, just uncertain
- Check match signals before changing anything
- Multi-location companies often show medium confidence (this is normal)
- Manual URLs always get 'manual' confidence (user knows best)

**For Admins:**
- Always provide LinkedIn URL when you know it
- Re-run enrichment after fixing LinkedIn URL
- Employee count from LinkedIn is supplemental, not primary source
