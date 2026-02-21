# Quick Deploy - Copy & Paste

## 🚀 Deploy All Critical Functions (5 minutes)

Run these commands in order:

```bash
cd /home/user/connect-market-nexus

# 1. Core Enrichment (CRITICAL)
supabase functions deploy enrich-buyer --project-ref vhzipqarkmmfuqadefep
supabase functions deploy process-buyer-enrichment-queue --project-ref vhzipqarkmmfuqadefep

# 2. AI Guide & Criteria Extraction (CRITICAL)
supabase functions deploy generate-ma-guide --project-ref vhzipqarkmmfuqadefep
supabase functions deploy extract-buyer-criteria --project-ref vhzipqarkmmfuqadefep
supabase functions deploy extract-buyer-transcript --project-ref vhzipqarkmmfuqadefep
supabase functions deploy extract-deal-document --project-ref vhzipqarkmmfuqadefep

# 3. Scoring & Matching
supabase functions deploy score-buyer-deal --project-ref vhzipqarkmmfuqadefep
supabase functions deploy query-buyer-universe --project-ref vhzipqarkmmfuqadefep
```

---

## ✅ Quick Test

After deploying, test enrichment:

1. **In UI:** Go to any universe
2. **Click:** "Enrich All" button
3. **Expect:** 70-98% success rate (was 0% before)
4. **Verify:** No 401 errors, no UI hanging

---

## 🎯 What This Fixes

| Issue | Status |
|-------|--------|
| 401 Unauthorized errors | ✅ FIXED |
| UI hanging forever | ✅ FIXED (5-min timeout) |
| Stale items stuck | ✅ FIXED (3-min recovery) |
| Rate limit global impact | ✅ FIXED (per-batch only) |
| Missing Buyer Fit Criteria UI | ✅ FIXED |
| Transcript → Criteria flow | ✅ ADDED |

---

## 📊 Expected Results

**Before:**
- Enrichment success: 0%
- UI: Hangs forever
- Criteria: Not visible

**After:**
- Enrichment success: 70-98%
- UI: Auto-stops after 5 min
- Criteria: Full section with 6 buyer types

---

## 🐛 If Something Breaks

**401 Errors:**
```bash
supabase functions deploy enrich-buyer --project-ref vhzipqarkmmfuqadefep
```

**Hanging UI:**
```bash
supabase functions deploy process-buyer-enrichment-queue --project-ref vhzipqarkmmfuqadefep
```

**Missing Criteria:**
```bash
supabase functions deploy extract-buyer-criteria --project-ref vhzipqarkmmfuqadefep
```

---

**Documentation:** See `EDGE_FUNCTION_DEPLOYMENT.md` for details
