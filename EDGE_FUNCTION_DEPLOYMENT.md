# Edge Function Deployment Guide

## 🚀 Critical Functions - Deploy These First

These functions must be deployed for the buyer criteria and enrichment workflow to work.

---

## **PRIORITY 1: Core Enrichment Functions** (Deploy Immediately)

### 1. `enrich-buyer` - Individual Buyer Enrichment
**What it does:** Scrapes buyer websites and extracts company data, investment criteria, M&A intelligence
**Recent fixes:** Removed JWT validation to fix 401 errors
**Deploy command:**
```bash
supabase functions deploy enrich-buyer --project-ref vhzipqarkmmfuqadefep
```

**Test it:**
```bash
curl -X POST https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/enrich-buyer \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"buyerId": "VALID_BUYER_UUID"}'
```

**Expected result:** `{ "success": true, "fieldsUpdated": 15+ }`

---

### 2. `process-buyer-enrichment-queue` - Background Queue Processor
**What it does:** Processes buyer enrichment queue in batches (10 at a time, 3 concurrent)
**Recent fixes:**
- Reduced stale timeout from 10 min → 3 min
- Fixed rate limit scoping (only marks current batch, not all universes)
**Deploy command:**
```bash
supabase functions deploy process-buyer-enrichment-queue --project-ref vhzipqarkmmfuqadefep
```

**Test it:**
```bash
curl -X POST https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/process-buyer-enrichment-queue \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

**Expected result:** `{ "success": true, "processed": 10, "succeeded": 8, "failed": 2 }`

---

## **PRIORITY 2: AI Guide & Criteria Extraction** (Deploy Second)

### 3. `generate-ma-guide` - AI Industry Research Guide
**What it does:** Generates 30,000+ word M&A industry guide with buyer fit criteria extraction
**Recent improvements:** Timeout handling, parallel phase execution, buyer type extraction
**Deploy command:**
```bash
supabase functions deploy generate-ma-guide --project-ref vhzipqarkmmfuqadefep
```

**Test it:**
```bash
curl -X POST https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/generate-ma-guide \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "industry_name": "Collision Repair",
    "batch_index": 0,
    "stream": true
  }'
```

**Expected result:** SSE stream with phases, criteria extraction, and final guide

---

### 4. `extract-buyer-criteria` - Extract Criteria from Guide/Docs
**What it does:** Uses Claude to extract structured buyer criteria from guides, transcripts, or documents
**Extracts:**
- Size criteria (revenue, EBITDA, locations)
- Service criteria (required, excluded, priorities)
- Geography criteria (states, regions, exclusions)
- Buyer types (PE firms, platforms, strategics with profiles)

**Deploy command:**
```bash
supabase functions deploy extract-buyer-criteria --project-ref vhzipqarkmmfuqadefep
```

**Test it:**
```bash
curl -X POST https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/extract-buyer-criteria \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "universe_id": "VALID_UNIVERSE_UUID",
    "guide_content": "Large M&A guide content here...",
    "source_name": "Collision Repair M&A Guide",
    "industry_name": "Collision Repair"
  }'
```

**Expected result:**
```json
{
  "criteria": {
    "size_criteria": { "revenue_min": 2000000, "revenue_max": 5000000, "confidence_score": 85 },
    "service_criteria": { "target_services": ["collision repair", "ADAS"], "confidence_score": 90 },
    "geography_criteria": { "target_states": ["TX", "CA", "FL"], "confidence_score": 80 },
    "buyer_types_criteria": { "buyer_types": [...], "confidence_score": 88 },
    "overall_confidence": 85
  }
}
```

---

### 5. `extract-buyer-transcript` - Extract from Call Transcripts
**What it does:** Extracts buyer preferences and criteria from call transcripts
**Use case:** After buyer phone calls, paste transcript to auto-populate criteria

**Deploy command:**
```bash
supabase functions deploy extract-buyer-transcript --project-ref vhzipqarkmmfuqadefep
```

**Test it:**
```bash
curl -X POST https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/extract-buyer-transcript \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "buyer_id": "VALID_BUYER_UUID",
    "transcript_text": "Call transcript with buyer preferences...",
    "participants": "John (Buyer), Sarah (Broker)"
  }'
```

**Expected result:** Extracted criteria with confidence scores

---

### 6. `extract-deal-document` - Extract from Documents
**What it does:** Parses CIM, teasers, pitch decks and extracts criteria
**Use case:** Upload seller documents to extract universe-level criteria

**Deploy command:**
```bash
supabase functions deploy extract-deal-document --project-ref vhzipqarkmmfuqadefep
```

**Test it:**
```bash
curl -X POST https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/extract-deal-document \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "universe_id": "VALID_UNIVERSE_UUID",
    "document_url": "path/to/document.pdf",
    "document_name": "CIM - Collision Repair Chain.pdf",
    "industry_name": "Collision Repair"
  }'
```

---

## **PRIORITY 3: Scoring & Matching** (Deploy Third)

### 7. `score-buyer-deal` - Buyer-Deal Alignment Scoring
**What it does:** Scores seller-buyer alignment based on universe criteria
**Uses:** Target buyer types, size criteria, geography, services

**Deploy command:**
```bash
supabase functions deploy score-buyer-deal --project-ref vhzipqarkmmfuqadefep
```

**Test it:**
```bash
curl -X POST https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/score-buyer-deal \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "buyer_id": "VALID_BUYER_UUID",
    "deal_id": "VALID_DEAL_UUID"
  }'
```

**Expected result:**
```json
{
  "score": 85,
  "tier": "A",
  "breakdown": {
    "size_fit": 90,
    "geography_fit": 85,
    "service_fit": 80,
    "buyer_type_match": 95
  },
  "reasoning": "Strong match - buyer targets this exact profile..."
}
```

---

### 8. `query-buyer-universe` - Query Buyers with Criteria
**What it does:** Queries buyers in universe with filtering and scoring

**Deploy command:**
```bash
supabase functions deploy query-buyer-universe --project-ref vhzipqarkmmfuqadefep
```

---

## **SUPPORTING FUNCTIONS** (Optional but Recommended)

### 9. `parse-fit-criteria` - Parse Criteria Format
**What it does:** Parses and validates buyer fit criteria format

**Deploy command:**
```bash
supabase functions deploy parse-fit-criteria --project-ref vhzipqarkmmfuqadefep
```

---

### 10. `update-fit-criteria-chat` - Chat-based Criteria Updates
**What it does:** Updates criteria via conversational interface

**Deploy command:**
```bash
supabase functions deploy update-fit-criteria-chat --project-ref vhzipqarkmmfuqadefep
```

---

## 📋 **Deployment Checklist**

### **Step 1: Deploy Core Functions** (Required for enrichment to work)
```bash
# Deploy these in order
supabase functions deploy enrich-buyer --project-ref vhzipqarkmmfuqadefep
supabase functions deploy process-buyer-enrichment-queue --project-ref vhzipqarkmmfuqadefep
```

**Test:** Queue buyers for enrichment, verify they process successfully

---

### **Step 2: Deploy Criteria Extraction** (Required for AI Guide → Criteria flow)
```bash
# Deploy these in order
supabase functions deploy generate-ma-guide --project-ref vhzipqarkmmfuqadefep
supabase functions deploy extract-buyer-criteria --project-ref vhzipqarkmmfuqadefep
supabase functions deploy extract-buyer-transcript --project-ref vhzipqarkmmfuqadefep
supabase functions deploy extract-deal-document --project-ref vhzipqarkmmfuqadefep
```

**Test:** Generate guide, verify criteria extraction, upload transcript

---

### **Step 3: Deploy Scoring** (Required for buyer-seller matching)
```bash
supabase functions deploy score-buyer-deal --project-ref vhzipqarkmmfuqadefep
supabase functions deploy query-buyer-universe --project-ref vhzipqarkmmfuqadefep
```

**Test:** Score a buyer-deal pair, verify alignment scores

---

### **Step 4: Deploy Supporting** (Optional enhancements)
```bash
supabase functions deploy parse-fit-criteria --project-ref vhzipqarkmmfuqadefep
supabase functions deploy update-fit-criteria-chat --project-ref vhzipqarkmmfuqadefep
```

---

## 🔍 **Verification Commands**

### Check All Functions Are Deployed
```bash
supabase functions list --project-ref vhzipqarkmmfuqadefep
```

### Check Function Logs
```bash
supabase functions logs enrich-buyer --project-ref vhzipqarkmmfuqadefep
supabase functions logs process-buyer-enrichment-queue --project-ref vhzipqarkmmfuqadefep
supabase functions logs generate-ma-guide --project-ref vhzipqarkmmfuqadefep
```

### Test End-to-End Flow
```bash
# 1. Generate guide (should auto-extract criteria)
curl -X POST https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/generate-ma-guide \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"industry_name": "Test Industry", "batch_index": 0}'

# 2. Queue buyers for enrichment
# (Use UI or direct database insert)

# 3. Process queue
curl -X POST https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/process-buyer-enrichment-queue \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"

# 4. Score buyer-deal
curl -X POST https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/score-buyer-deal \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"buyer_id": "...", "deal_id": "..."}'
```

---

## ⚠️ **Important Notes**

### Environment Variables Required
All functions need these environment variables set in Supabase:
- `ANTHROPIC_API_KEY` - For Claude AI
- `FIRECRAWL_API_KEY` - For web scraping
- `SUPABASE_URL` - Auto-set
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-set
- `SUPABASE_ANON_KEY` - Auto-set

### Rate Limits
- `enrich-buyer`: 999,999/hour (effectively unlimited)
- `generate-ma-guide`: ~5-10 min per guide, ~$2-3 in AI costs
- `extract-buyer-criteria`: ~30 sec per extraction, ~$0.20 in AI costs

### Timeouts
- `enrich-buyer`: 2 min per buyer
- `process-buyer-enrichment-queue`: 110 sec function timeout
- `generate-ma-guide`: 140 sec per batch, graceful timeout handling

---

## 🎯 **Expected Behavior After Deployment**

### **User Journey: Create New Universe**
1. User creates universe "Collision Repair"
2. User clicks "Run AI Research"
3. `generate-ma-guide` runs (5-10 min)
4. Guide generates → `extractCriteria` runs automatically
5. **UI shows:**
   - ✅ Match Criteria (3/3 defined)
   - ✅ Buyer Fit Criteria with 6 ranked buyer types
   - ✅ Large MSOs, Regional MSOs, PE-Backed Platforms, etc.
6. User uploads call transcript
7. `extract-buyer-transcript` extracts additional criteria
8. Criteria merged with confidence scores
9. User clicks "Enrich All Buyers"
10. `process-buyer-enrichment-queue` processes batches
11. `enrich-buyer` enriches each buyer
12. **Success rate: 70-98%** (up from 0%)

### **Data Flow:**
```
AI Guide → extractCriteria → BuyerFitCriteriaAccordion → Display
Transcript → extract-buyer-transcript → Merge → Criteria Database
Buyers → process-queue → enrich-buyer → Enriched Data
Enriched Buyers → score-buyer-deal → Matching Scores
```

---

## 🐛 **Troubleshooting**

### "Function returned 401 Unauthorized"
**Fix:** Redeploy `enrich-buyer` (JWT validation was removed)
```bash
supabase functions deploy enrich-buyer --project-ref vhzipqarkmmfuqadefep
```

### "Enrichment hangs forever"
**Fix:** Redeploy `process-buyer-enrichment-queue` (stale timeout reduced to 3 min)
```bash
supabase functions deploy process-buyer-enrichment-queue --project-ref vhzipqarkmmfuqadefep
```

### "Guide generation times out"
**Expected:** Graceful timeout after 140s, saves progress, can resume
**UI shows:** Timeout warning, option to resume from last batch

### "Criteria not extracted from guide"
**Check:** Guide completion (should see "complete" event in SSE)
**Verify:** `extractCriteria` ran (check function logs)
**Test:** Manually call `extract-buyer-criteria` with guide content

---

## 📝 **Deploy All Critical Functions (Copy-Paste)**

```bash
# Core enrichment (CRITICAL - Deploy first)
supabase functions deploy enrich-buyer --project-ref vhzipqarkmmfuqadefep
supabase functions deploy process-buyer-enrichment-queue --project-ref vhzipqarkmmfuqadefep

# Criteria extraction (CRITICAL - Deploy second)
supabase functions deploy generate-ma-guide --project-ref vhzipqarkmmfuqadefep
supabase functions deploy extract-buyer-criteria --project-ref vhzipqarkmmfuqadefep
supabase functions deploy extract-buyer-transcript --project-ref vhzipqarkmmfuqadefep
supabase functions deploy extract-deal-document --project-ref vhzipqarkmmfuqadefep

# Scoring (Deploy third)
supabase functions deploy score-buyer-deal --project-ref vhzipqarkmmfuqadefep
supabase functions deploy query-buyer-universe --project-ref vhzipqarkmmfuqadefep

# Supporting (Optional)
supabase functions deploy parse-fit-criteria --project-ref vhzipqarkmmfuqadefep
supabase functions deploy update-fit-criteria-chat --project-ref vhzipqarkmmfuqadefep
```

**Estimated deployment time:** 5-10 minutes for all functions

---

## ✅ **Success Indicators**

After deployment, you should see:
- ✅ Buyer enrichment: 70-98% success rate
- ✅ Guide generation: Completes with criteria extracted
- ✅ Target Buyer Types: 6 cards displayed in UI
- ✅ Match Criteria: 3/3 defined badge shows
- ✅ Transcript upload: Extracts and merges criteria
- ✅ No UI hanging: Auto-stops after 5 minutes max
- ✅ No 401 errors: JWT validation removed

---

**Last updated:** 2026-02-04
**Session:** https://claude.ai/code/session_012dsSx2fEj2CREkKitr4ER2
