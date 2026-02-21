# Chatbot Data Access & Context Integrity Audit Report
**Date:** 2026-02-07
**Auditor:** CTO-level Systems Analysis
**Scope:** AI Chatbot Data Access, Context Assembly, and Response Grounding
**Status:** 🚨 CRITICAL GAPS IDENTIFIED

---

## Executive Summary

This audit examined the AI chatbot's access to buyer data, seller/deal data, and transcripts across all chat endpoints. **The chatbot has comprehensive access to deal and buyer metadata but ZERO access to transcript data**, creating a critical blind spot for contextual queries.

### Key Findings
- ✅ **Buyer Data Access:** Comprehensive (with minor field exclusions)
- ✅ **Deal/Seller Data Access:** Full access with scoring outputs
- 🚨 **Transcript Access:** **COMPLETE FAILURE** - No transcript queries exist
- ⚠️ **Context Assembly:** Partial data truncation issues
- ✅ **Entity Resolution:** Deterministic and correct
- ✅ **Permissions:** Service role bypasses RLS correctly
- ❌ **Tool/Function Calling:** Not implemented in chat endpoints
- ⚠️ **Response Grounding:** No explicit data validation guardrails

---

## PHASE 1: Data Surface Analysis

### 1.1 Buyer Data Access

**Tables Queried:**
- ✅ `remarketing_buyers` (primary table)
- ✅ `buyer_contacts` (limited to top 2 per buyer, 200 total)

**Fields INCLUDED in Context:**
```typescript
✅ Core: id, company_name, company_website, buyer_type
✅ PE Details: pe_firm_name, hq_city, hq_state
✅ Thesis: thesis_summary
✅ Criteria: target_geographies, target_services, target_revenue_min/max, target_ebitda_min/max
✅ Footprint: geographic_footprint (array)
✅ History: total_acquisitions, last_acquisition_date, acquisition_appetite
✅ Quality: data_completeness
✅ Assignment: universe_id
```

**Fields EXCLUDED from chat-buyer-query:**
```typescript
❌ business_summary (detailed description)
❌ recent_acquisitions (JSON array)
❌ portfolio_companies (JSON array)
❌ target_industries
❌ deal_breakers ⚠️ CRITICAL for explaining poor fits
❌ strategic_priorities
❌ alignment_score / alignment_reasoning
❌ acquisition_timeline
❌ confidence_level / thesis_confidence
❌ extraction_sources (enrichment tracking)
```

**Field Truncation Issues:**
- ⚠️ `business_summary` truncated to 150-200 chars in `chat-remarketing`
- ⚠️ `thesis_summary` sent in full but can be 1000+ chars

**File:** `/home/user/connect-market-nexus/supabase/functions/chat-buyer-query/index.ts:157-168`

---

### 1.2 Seller/Deal Data Access

**Tables Queried:**
- ✅ `listings` (primary table via `.select('*')`)
- ✅ `remarketing_scores` (all match scores for the deal)

**Fields INCLUDED in Context:**
```typescript
✅ Core: id, title, company_name, codename
✅ Location: headquarters, location, geography, geographic_states
✅ Financials: revenue, ebitda, asking_price, location_count, employees
✅ Business: industry, category, business_model, services, service_offerings
✅ Strategy: owner_goals, key_risks
✅ Status: is_active, is_priority_target, status
✅ Enrichment: enriched_at, enrichment_refresh_due_at
✅ Scoring: deal_total_score, ideal_buyer
✅ Quotes: key_quotes (array)
```

**Scoring Data INCLUDED:**
```typescript
✅ composite_score, geography_score, size_score, service_score, owner_goals_score
✅ tier (A/B/C/D)
✅ fit_reasoning
✅ status (pending/approved/passed/hidden)
✅ pass_reason, pass_category
```

**Geographic Enrichment:**
- ✅ Adjacent states (~100 miles, 1-hop) computed dynamically
- ✅ Nearby states (~250 miles, 2-hop) computed dynamically
- ✅ Regional groupings (Northeast, Southeast, etc.)
- ✅ Buyer proximity flags: `inDealState`, `hasAdjacentPresence`, `hasNearbyPresence`

**File:** `/home/user/connect-market-nexus/supabase/functions/chat-buyer-query/index.ts:150-174`

---

### 1.3 Transcript Data Access 🚨 CRITICAL GAP

**Transcript Tables Available:**
1. ✅ `call_transcripts` (listing_id, buyer_id, transcript_text, extracted_insights, key_quotes)
2. ✅ `buyer_transcripts` (buyer_id, transcript_text, extracted_data)
3. ✅ `deal_transcripts` (listing_id, transcript_text, extracted_data)

**Transcript Queries in Chat Endpoints:**
```bash
❌ chat-buyer-query: ZERO transcript queries
❌ chat-remarketing: ZERO transcript queries
❌ query-buyer-universe: ZERO transcript queries
❌ update-fit-criteria-chat: ZERO transcript queries
```

**What the Chatbot CANNOT Access:**
```typescript
❌ Transcript text (full or chunked)
❌ Extracted insights (8-prompt architecture outputs)
❌ Key quotes from calls
❌ CEO detection signals (ceo_detected boolean)
❌ Participant information
❌ Call metadata (date, duration, type, source)
❌ Fireflies integration data
❌ Transcript processing status
```

**Impact:**
- 🚨 User asks: *"What does the transcript say about timing?"* → **Chatbot hallucinates or says "I don't have access"**
- 🚨 User asks: *"Did the CEO participate in the call?"* → **Cannot answer**
- 🚨 User asks: *"What were the owner's key concerns?"* → **No verbatim quotes available**
- 🚨 Transcripts marked as **priority: 100** in schema but **not used**

**Possible Indirect Access:**
- ⚠️ `key_quotes` field on `listings` table (uncertain if populated from transcripts)
- ⚠️ Enrichment fields may contain transcript-derived data but no explicit linkage

**Files Examined:**
- `/home/user/connect-market-nexus/supabase/functions/chat-buyer-query/index.ts`
- `/home/user/connect-market-nexus/supabase/functions/chat-remarketing/index.ts`

---

## PHASE 2: Entity Resolution Audit

### 2.1 Context Scoping Mechanisms

**Deal Page Chat (`DealBuyerChat`):**
```typescript
// Component receives listingId as prop
<DealBuyerChat listingId={deal.id} />

// Passes to API
POST /functions/v1/chat-buyer-query
Body: { listingId: "uuid", query: "...", messages: [...] }

// Backend validates
if (!listingId) {
  return error('Listing ID is required');
}
```
✅ **Deterministic:** Single deal ID passed from route params
✅ **No ambiguity:** Component scoped to specific deal
**File:** `/home/user/connect-market-nexus/src/components/remarketing/DealBuyerChat.tsx:154`

**Universal Chat (`ReMarketingChat`):**
```typescript
// Context types
type ChatContext =
  | { type: "deal", dealId: string, dealName?: string }
  | { type: "deals", totalDeals?: number }
  | { type: "buyers", totalBuyers?: number }
  | { type: "universe", universeId: string, universeName?: string };

// Component receives context as prop
<ReMarketingChat context={{ type: "deal", dealId: deal.id }} />

// Conditionally adds IDs to API request
if (context.type === "deal") {
  requestBody.listingId = context.dealId;
} else if (context.type === "universe") {
  requestBody.universeId = context.universeId;
}
```
✅ **Deterministic:** Context type and IDs passed explicitly
✅ **Type-safe:** TypeScript enforces correct context shape
**File:** `/home/user/connect-market-nexus/src/components/remarketing/ReMarketingChat.tsx:20-24, 208-212`

### 2.2 Entity Resolution Validation

**Test Case: "Why does this deal have no matches?"**
- ✅ `listingId` extracted from request: `chat-buyer-query/index.ts:129`
- ✅ Validation enforced: `if (!listingId) return error`
- ✅ Deal data fetched: `supabase.from('listings').select('*').eq('id', listingId).single()`
- ✅ Scores fetched: `supabase.from('remarketing_scores').select('*').eq('listing_id', listingId)`
- ✅ Context assembly includes deal name in prompt

**Test Case: "Why is this buyer a bad fit?"**
- ✅ Buyer IDs resolved from `remarketing_scores` table
- ✅ Pass reasons included: `passReason`, `passCategory`
- ✅ Chatbot instructed to mention pass reasons in system prompt

**Test Case: Switching context mid-conversation**
- ⚠️ **Not supported:** Each chat session is scoped to a single context
- ⚠️ No multi-entity conversation handling
- ⚠️ User must start new chat for different deal/buyer

**Conclusion:** ✅ Entity resolution is deterministic and correct for single-entity contexts

---

## PHASE 3: Data Access & Permissions

### 3.1 Authentication & Authorization

**Service Role Usage:**
```typescript
// All chat endpoints use service role
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);
```
✅ **Bypasses RLS policies** - Full database access
✅ **Correct for chatbot use case** - Needs cross-user data
**File:** `chat-buyer-query/index.ts:118`, `chat-remarketing/index.ts:20`

**Client Authentication:**
```typescript
// UI passes user access token
Authorization: `Bearer ${sessionData.session.access_token}`
```
✅ User authentication verified before API call
⚠️ **Security issue:** Anon API key hardcoded in UI
**File:** `ReMarketingChat.tsx:221`, `DealBuyerChat.tsx:151`

### 3.2 RLS Policy Analysis

**Transcript Tables:**
```sql
-- call_transcripts: Admin-only access
CREATE POLICY "Admin full access" ON call_transcripts
  USING (is_admin(auth.uid()));

-- Service role bypasses RLS
-- ✅ Edge functions COULD access transcripts
-- ❌ But they DON'T query them
```

**Buyer/Deal Tables:**
```sql
-- remarketing_buyers: Admin-only
CREATE POLICY "Admin can view buyers" ON remarketing_buyers
  FOR SELECT USING (is_admin(auth.uid()));

-- remarketing_scores: Admin-only
CREATE POLICY "Admin can view scores" ON remarketing_scores
  FOR SELECT USING (is_admin(auth.uid()));
```

**Conclusion:** ✅ Permissions are not blocking chatbot access. Service role can access all tables. **Transcripts are not queried by design choice, not permission failure.**

---

## PHASE 4: Context Assembly & Prompt Injection

### 4.1 Context Assembly Logic

**chat-buyer-query System Prompt Structure:**
```
You are an expert M&A analyst...

DEAL CONTEXT:
- Company: ${company_name}
- Location: ${headquarters}
- Revenue: ${revenue}
- EBITDA: ${ebitda}
[... 15 deal fields ...]

GEOGRAPHIC CONTEXT:
- Deal is in: ${dealStates}
- Adjacent states (~100 miles): ${adjacentStates}
- Nearby states (~250 miles): ${nearbyStates}

BUYER UNIVERSE (${count} buyers):
${JSON.stringify(buyerSummaries.slice(0, 100), null, 2)}

[... 15 instruction bullets ...]
```
**File:** `chat-buyer-query/index.ts:283-339`

**Context Size Limits:**
- ⚠️ **100 buyers maximum** in prompt (top 100 by score)
- ⚠️ **10 messages** conversation history retained
- ⚠️ **No token counting** - May hit model limits with large contexts
- ⚠️ **No caching** - Full context rebuilt on every request

**Context Freshness:**
- ✅ Data fetched on every request (no stale cache)
- ✅ Scores computed in real-time
- ✅ Geographic proximity calculated dynamically
- ❌ No timestamp tracking of when data was last enriched

### 4.2 Transcript Context Assembly ❌ NOT IMPLEMENTED

**Expected Implementation:**
```typescript
// ❌ MISSING: Transcript queries
const transcripts = await supabase
  .from('call_transcripts')
  .select('transcript_text, extracted_insights, key_quotes, ceo_detected')
  .eq('listing_id', listingId)
  .order('created_at', { ascending: false })
  .limit(3);

// ❌ MISSING: Transcript context in system prompt
RECENT CALL TRANSCRIPTS:
${transcripts.map(t => `
  Key Quotes: ${t.key_quotes}
  CEO Detected: ${t.ceo_detected}
  Insights: ${JSON.stringify(t.extracted_insights, null, 2)}
`).join('\n')}
```

**What Should Be Added:**
1. ✅ Query `call_transcripts` for deal-specific calls
2. ✅ Query `deal_transcripts` for general transcripts
3. ✅ Include `extracted_insights` JSONB (financials, services, geography, owner_goals, buyer_criteria, deal_structure)
4. ✅ Include `key_quotes` array
5. ✅ Include `ceo_detected` boolean
6. ✅ Add transcript context to system prompt
7. ✅ Instruct chatbot to reference transcripts when answering
8. ✅ Add fallback message when no transcripts available

---

## PHASE 5: Tool Usage Enforcement

### 5.1 Tool/Function Calling Analysis

**Current State:**
```typescript
// ❌ NO tool/function calling in chat endpoints
// chat-buyer-query: Pure text generation
// chat-remarketing: Pure text generation
// query-buyer-universe: JSON response only (not tools)
```

**Observed Elsewhere:**
```typescript
// ✅ Tool calling used in score-buyer-deal
const tools = [{
  name: "score_buyer_deal",
  description: "Score a buyer's fit for a deal",
  input_schema: { ... }
}];
```
**File:** `score-buyer-deal/index.ts:1084-1089`

**Implications:**
- ❌ **No tool-first policy** - Chatbot answers from memory/context only
- ❌ **No data validation** - Cannot verify claims against database
- ❌ **No dynamic queries** - Cannot search for buyers matching criteria
- ❌ **No transcript access** - Even if implemented, no tool to query it

**Recommendation:**
Implement tool/function calling for:
1. ✅ `search_buyers(criteria)` - Dynamic buyer search
2. ✅ `get_transcript_quotes(deal_id, keywords)` - Transcript search
3. ✅ `get_score_breakdown(buyer_id, deal_id)` - Detailed scoring
4. ✅ `get_contact_info(buyer_id)` - Retrieve full contact list
5. ✅ `get_acquisition_history(buyer_id, limit)` - Recent deals

---

## PHASE 6: Response Validation & Guardrails

### 6.1 Fact-Grounding Rules

**Current System Prompt Instructions:**
```
1. Be specific - name actual buyers that match the criteria
2. Explain WHY each buyer matches (cite scores, location, history)
3. For score-based questions, reference actual composite/category scores
4. Prioritize PENDING buyers unless specifically asked about approved/passed
5. Always mention if a buyer has been APPROVED, PASSED, or REMOVED
6. For passed buyers, mention why (passReason/passCategory)
```

**Grounding Strengths:**
- ✅ Instructs to cite scores and data
- ✅ Requires specific buyer names (not generic advice)
- ✅ Includes pass reasons in context

**Grounding Weaknesses:**
- ❌ No explicit "if data missing, say so" rule
- ❌ No confidence calibration guidance
- ❌ No prohibition on hallucinating transcript content
- ❌ No instruction to report data quality issues

**Missing Guardrails:**
```typescript
// ❌ NOT PRESENT: Data availability checks
if (transcript not loaded) → "I don't have transcript data for this deal"
if (buyer geo missing) → "This buyer's geographic footprint is not fully mapped"
if (scoring inputs incomplete) → "Score may be partial due to missing data"
```

### 6.2 Confidence Calibration

**Problematic Patterns Observed in Prompts:**
- ⚠️ "You are an expert M&A analyst" - May induce overconfidence
- ⚠️ No caveats for partial data
- ⚠️ No uncertainty language guidance

**Recommended Additions:**
```
When data is incomplete or missing:
- Use phrases like "Based on available data..." or "With the information I have..."
- Explicitly state what data is missing: "I don't have transcript data for this deal"
- Avoid definitive statements when data quality is low
- Flag enrichment gaps: "This buyer's data completeness is 45%"
```

---

## PHASE 7: Traceability & Debug Mode

### 7.1 Current Observability

**Client-Side Logging:**
```typescript
// ❌ NO debug mode
// ❌ NO trace logging
// ❌ NO entity context visibility
```

**Server-Side Logging:**
```typescript
// ⚠️ Minimal logging
console.log(`Processing chat query for listing ${listingId}`);
console.error('Error in chat handler:', error);
```

**Missing Capabilities:**
- ❌ Cannot see which buyers were loaded into context
- ❌ Cannot see what scores were computed
- ❌ Cannot see which data queries succeeded/failed
- ❌ Cannot see context size or token usage
- ❌ Cannot see which fields were excluded

### 7.2 Recommended Trace Mode

**Proposed Debug Output:**
```typescript
// Enable with ?debug=true query param
{
  "entities_in_scope": {
    "deal_id": "uuid",
    "deal_name": "Acme Corp",
    "buyer_count": 127,
    "buyers_in_context": 100
  },
  "data_sources_queried": [
    { "table": "listings", "rows": 1, "duration_ms": 45 },
    { "table": "remarketing_buyers", "rows": 127, "duration_ms": 203 },
    { "table": "remarketing_scores", "rows": 127, "duration_ms": 156 },
    { "table": "buyer_contacts", "rows": 200, "duration_ms": 89 }
  ],
  "missing_fields": ["deal_breakers", "strategic_priorities"],
  "context_stats": {
    "total_chars": 145203,
    "estimated_tokens": 36301,
    "message_history_count": 7
  },
  "timestamp": "2026-02-07T18:30:00Z"
}
```

---

## PHASE 8: Regression & Drift Analysis

### 8.1 Breaking Change Scenarios

**Schema Migrations That Could Break Chatbot:**
1. ✅ Rename `remarketing_buyers` → Would break `.from('remarketing_buyers')`
2. ✅ Remove `thesis_summary` column → Context assembly would fail
3. ✅ Change `geographic_footprint` from array to JSONB → Proximity logic breaks
4. ✅ Rename `listings` → Deal queries fail
5. ✅ Change `remarketing_scores.composite_score` type → Sorting breaks

**Current Protection:**
- ❌ No automated tests for chatbot data access
- ❌ No schema change detection for chatbot dependencies
- ❌ No CI checks to validate chatbot queries

### 8.2 Recent Changes That May Have Affected Chatbot

**Migration Analysis:**
```bash
# Transcripts added recently (2026-01-22 to 2026-02-03)
20260122194512_91c47998-1a29-45fc-a9f1-c9c348d0b2c1.sql - buyer_transcripts
20260122202458_38c68539-47dc-48ee-92ea-608d9df27683.sql - deal_transcripts
20260203_call_transcripts.sql - call_transcripts

# ❌ Chatbot NOT updated to use transcripts
# ❌ No corresponding changes in chat-buyer-query or chat-remarketing
```

**Drift Detected:**
- 🚨 **Transcripts added to schema but not to chatbot context**
- 🚨 **8-prompt enrichment architecture outputs NOT accessible to chatbot**
- 🚨 **Priority: 100 data source ignored**

---

## FINAL AUDIT DELIVERABLES

### 1. What Data the Chatbot CAN Currently Access

✅ **Buyer Data (Partial):**
- Core profile (name, type, PE firm, headquarters)
- Investment thesis summary
- Target criteria (geography, services, size ranges)
- Geographic footprint
- Acquisition history (total count, last date, appetite)
- Data completeness score
- Universe assignment

✅ **Deal/Seller Data (Comprehensive):**
- Company details (name, codename, headquarters)
- Geographic states and regional groupings
- Financials (revenue, EBITDA, asking price)
- Business details (industry, services, business model)
- Owner context (owner goals, key risks)
- Enrichment status and timestamps
- Deal quality score and ideal buyer profile

✅ **Match/Scoring Data (Comprehensive):**
- Composite scores and breakdowns (geography, size, service, owner goals)
- Tier classifications (A/B/C/D)
- Fit reasoning
- Action status (pending/approved/passed/hidden)
- Pass reasons and categories

✅ **Proximity Analysis (Real-time):**
- Adjacent states (~100 miles)
- Nearby states (~250 miles)
- Regional groupings
- Buyer presence flags

✅ **Contact Information (Limited):**
- Top 2 contacts per buyer
- 200 contacts maximum
- Name, title, email

---

### 2. What Data the Chatbot CANNOT Access

❌ **Transcript Data (CRITICAL GAP):**
- Call transcripts (`call_transcripts`)
- Deal transcripts (`deal_transcripts`)
- Buyer transcripts (`buyer_transcripts`)
- Extracted insights (8-prompt architecture outputs)
- Key quotes from calls
- CEO detection signals
- Participant information
- Call metadata

❌ **Buyer Strategic Details:**
- `deal_breakers` - Why certain deals don't match
- `strategic_priorities` - Current strategic focus
- `target_industries` - Industry preferences
- `recent_acquisitions` - Full acquisition details
- `portfolio_companies` - Portfolio company list
- `acquisition_timeline` - Timing preferences
- `confidence_level` / `thesis_confidence` - Data quality signals

❌ **Enrichment Metadata:**
- `extraction_sources` - Where data came from
- Enrichment timestamps for individual fields
- Historical data snapshots
- Data provenance tracking

❌ **Full Business Context:**
- `business_summary` (truncated to 150-200 chars in chat-remarketing)
- Full portfolio descriptions
- Detailed competitive intelligence

---

### 3. Context Assembly Gaps

1. **🚨 No Transcript Context**
   - Zero transcript data in any chat endpoint
   - Cannot answer questions about call content
   - Cannot reference CEO engagement
   - Cannot cite verbatim quotes

2. **⚠️ Truncated Business Summaries**
   - `business_summary` reduced to 150-200 chars
   - Loses nuanced context

3. **⚠️ Missing Deal Breakers**
   - Cannot explain why buyers were rejected beyond pass reasons
   - Deal breaker criteria not included

4. **⚠️ Limited Buyer Count**
   - Only 100 buyers in prompt (top scored)
   - Remaining buyers unavailable for comparison

5. **⚠️ No Historical Data**
   - No enrichment change tracking
   - Cannot show how scores evolved

---

### 4. Permission/RLS Failures

✅ **NO permission failures detected**
- Service role has full access to all tables
- RLS policies correctly bypassed
- Transcripts ARE accessible via service role
- **Gaps are design choices, not permission issues**

---

### 5. Transcript Access Gaps (Detailed)

**Table: call_transcripts**
- ❌ Not queried in `chat-buyer-query`
- ❌ Not queried in `chat-remarketing`
- ✅ Accessible via service role (permission OK)
- ❌ Not included in context assembly

**Table: deal_transcripts**
- ❌ Not queried in any chat endpoint
- ✅ Accessible via service role
- ❌ Not referenced in system prompts

**Table: buyer_transcripts**
- ❌ Not queried in any chat endpoint
- ✅ Accessible via service role
- ❌ Not used for buyer enrichment context

**Impact Examples:**

| User Query | Current Behavior | Expected Behavior |
|------------|------------------|-------------------|
| "What did the CEO say about timing?" | Hallucination or "I don't have access" | Quote transcript: "CEO mentioned Q2 timeline" |
| "Was there a CEO on the call?" | Cannot answer | "Yes, CEO detected in transcript from 2026-01-15" |
| "What are the owner's key concerns?" | Generic answer from owner_goals field | Verbatim quotes from transcript |
| "Did they mention competitors?" | No context | Reference transcript insights |

---

### 6. Concrete Fixes Required

#### **FIX 1: Add Transcript Access to chat-buyer-query** 🚨 HIGHEST PRIORITY

**Location:** `/home/user/connect-market-nexus/supabase/functions/chat-buyer-query/index.ts`

**Changes Required:**

1. **Add transcript queries (after line 174):**
```typescript
// Query call transcripts for this deal
const { data: callTranscripts } = await supabase
  .from('call_transcripts')
  .select('id, transcript_text, extracted_insights, key_quotes, ceo_detected, created_at, call_type')
  .eq('listing_id', listingId)
  .order('created_at', { ascending: false })
  .limit(5);

// Query general deal transcripts
const { data: dealTranscripts } = await supabase
  .from('deal_transcripts')
  .select('id, transcript_text, extracted_data, created_at, source')
  .eq('listing_id', listingId)
  .order('created_at', { ascending: false })
  .limit(3);
```

2. **Add transcript context to system prompt (after line 325):**
```typescript
## TRANSCRIPT DATA

${callTranscripts && callTranscripts.length > 0 ? `
### Call Transcripts (${callTranscripts.length} recent calls):
${callTranscripts.map((t, idx) => `
**Call ${idx + 1}** (${new Date(t.created_at).toLocaleDateString()}):
- Type: ${t.call_type || 'Unknown'}
- CEO Detected: ${t.ceo_detected ? 'Yes' : 'No'}
- Key Quotes: ${JSON.stringify(t.key_quotes, null, 2)}
- Extracted Insights: ${JSON.stringify(t.extracted_insights, null, 2)}
`).join('\n')}
` : 'No call transcripts available for this deal.'}

${dealTranscripts && dealTranscripts.length > 0 ? `
### Deal Transcripts (${dealTranscripts.length} transcripts):
${dealTranscripts.map((t, idx) => `
**Transcript ${idx + 1}** (${new Date(t.created_at).toLocaleDateString()}):
- Source: ${t.source || 'Unknown'}
- Extracted Data: ${JSON.stringify(t.extracted_data, null, 2)}
`).join('\n')}
` : 'No deal transcripts available.'}

**IMPORTANT:** When answering questions about call content, owner statements, or CEO engagement:
- Reference specific quotes from transcripts above
- Cite the call date and type
- If no transcript data available, explicitly say "I don't have transcript data for this question"
- Never invent or hallucinate transcript content
```

3. **Update instruction bullets (line 337):**
```typescript
14. When referencing transcript content, cite the call date
15. If asked about transcripts but none available, explicitly state this
16. Never hallucinate transcript quotes - only use actual key_quotes data
```

**Estimated Impact:** Adds 50-150 lines to context (5-15k tokens)

---

#### **FIX 2: Add Transcript Access to chat-remarketing** 🚨 HIGH PRIORITY

**Location:** `/home/user/connect-market-nexus/supabase/functions/chat-remarketing/index.ts`

**Changes Required:**

1. **Add to `buildDealContext()` function (after line 168):**
```typescript
// Fetch transcripts for this deal
const { data: transcripts } = await supabase
  .from('call_transcripts')
  .select('key_quotes, ceo_detected, extracted_insights, created_at')
  .eq('listing_id', listingId)
  .order('created_at', { ascending: false })
  .limit(3);

const transcriptContext = transcripts && transcripts.length > 0
  ? `\n\nRECENT CALL TRANSCRIPTS:\n${transcripts.map(t => `
- CEO Detected: ${t.ceo_detected}
- Key Quotes: ${JSON.stringify(t.key_quotes)}
- Insights: ${JSON.stringify(t.extracted_insights)}
`).join('\n')}`
  : '\n\n(No transcripts available for this deal)';
```

2. **Include in system prompt (line 190):**
```typescript
${transcriptContext}
```

---

#### **FIX 3: Add Deal Breakers to Buyer Context** ⚠️ MEDIUM PRIORITY

**Location:** `/home/user/connect-market-nexus/supabase/functions/chat-buyer-query/index.ts`

**Changes Required:**

1. **Update buyer SELECT (line 160):**
```typescript
supabase.from('remarketing_buyers').select(`
  id, company_name, company_website, buyer_type, thesis_summary,
  target_geographies, target_services, target_revenue_min, target_revenue_max,
  target_ebitda_min, target_ebitda_max, geographic_footprint,
  data_completeness, pe_firm_name, hq_city, hq_state,
  total_acquisitions, last_acquisition_date, acquisition_appetite,
  universe_id, deal_breakers, strategic_priorities, target_industries
`)
```

2. **Include in buyer summaries (line 247):**
```typescript
dealBreakers: buyer.deal_breakers,
strategicPriorities: buyer.strategic_priorities,
targetIndustries: buyer.target_industries,
```

---

#### **FIX 4: Implement Tool/Function Calling** ⚠️ MEDIUM PRIORITY

**Location:** Create new file `/home/user/connect-market-nexus/supabase/functions/_shared/chat-tools.ts`

**Tool Definitions:**
```typescript
export const chatTools = [
  {
    name: "search_transcripts",
    description: "Search call transcripts for specific keywords or topics",
    input_schema: {
      type: "object",
      properties: {
        deal_id: { type: "string" },
        keywords: { type: "array", items: { type: "string" } },
        ceo_only: { type: "boolean" }
      },
      required: ["deal_id"]
    }
  },
  {
    name: "get_buyer_details",
    description: "Retrieve detailed buyer information including deal breakers",
    input_schema: {
      type: "object",
      properties: {
        buyer_id: { type: "string" }
      },
      required: ["buyer_id"]
    }
  }
];
```

**Update chat-buyer-query to use tools (line 357):**
```typescript
const response = await callGeminiAI(
  conversationMessages,
  {
    streamingCallback,
    tools: chatTools  // Enable tool calling
  }
);
```

---

#### **FIX 5: Add Data Availability Guardrails** ⚠️ MEDIUM PRIORITY

**Location:** `/home/user/connect-market-nexus/supabase/functions/chat-buyer-query/index.ts`

**Add to system prompt (line 340):**
```typescript
## DATA AVAILABILITY RULES (CRITICAL):
- If asked about transcripts and none are loaded: "I don't have transcript data for this deal yet"
- If buyer data completeness < 50%: Mention "This buyer's profile is partially complete (${data_completeness}%)"
- If geographic_footprint is empty: "This buyer's geographic footprint has not been fully mapped"
- If asked about data you don't have: Explicitly say "That information is not available in my current context"
- Never guess or hallucinate missing data
- Use phrases like "Based on available data..." when data quality is uncertain
```

---

#### **FIX 6: Remove Hardcoded API Keys** 🚨 SECURITY ISSUE

**Location:**
- `/home/user/connect-market-nexus/src/components/remarketing/ReMarketingChat.tsx:221`
- `/home/user/connect-market-nexus/src/components/remarketing/DealBuyerChat.tsx:151`

**Changes Required:**
```typescript
// ❌ REMOVE:
apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoemlwcWFya21tZnVxYWRlZmVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTcxMTMsImV4cCI6MjA2MjE5MzExM30.M653TuQcthJx8vZW4jPkUTdB67D_Dm48ItLcu_XBh2g",

// ✅ REPLACE WITH:
apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
```

---

### 7. Before vs After Examples

#### **Example 1: Transcript Query**

**User:** "What did the CEO say about the timeline for this deal?"

**BEFORE (Current):**
```
I don't have access to specific call transcripts or quotes. Based on the deal information,
I can see that the owner goals include [generic response from owner_goals field].
For detailed timeline information, I'd recommend reviewing the call notes directly.
```
❌ Deflects to manual review
❌ Cannot cite actual quotes
❌ No CEO detection

**AFTER (With Fix 1):**
```
Based on the most recent call transcript from January 15, 2026, the CEO was present
and stated: "We're targeting a Q2 close, ideally by end of May."

The extracted insights also show:
- Timeline: Q2 2026 preferred
- CEO engagement: High (participated in 45-minute call)
- Key concern: "Want to ensure smooth transition for employees"

This aligns with the owner_goals field which mentions "employee retention during transition."
```
✅ Cites specific transcript
✅ References CEO detection
✅ Provides verbatim quote
✅ Cross-references with deal data

---

#### **Example 2: Buyer Fit Question**

**User:** "Why isn't Acme Capital a good fit for this deal?"

**BEFORE (Current):**
```
Acme Capital has been marked as PASSED with the reason: "Geography mismatch."

Looking at the scores:
- Composite: 42
- Geography: 15 (very low)
- Service: 78

The low geography score indicates their footprint doesn't align with this deal's location.
```
⚠️ Partial answer
❌ No deal breaker context
❌ No strategic priority info

**AFTER (With Fix 3):**
```
Acme Capital has been marked as PASSED with the reason: "Geography mismatch."

Looking at the scores and deal breakers:
- Composite: 42
- Geography: 15 (very low)
- Service: 78 (good alignment)

**Why the geography mismatch?**
- Deal location: Texas
- Acme's footprint: Primarily Northeast (NY, NJ, PA, MA)
- **Deal breaker:** Acme explicitly excludes "deals outside Northeast corridor"

**Strategic priorities:**
Acme is currently focused on "healthcare consolidation in established markets" and
this deal's industry (manufacturing) and location (Texas) don't align with their
current thesis.

While the service overlap is strong (78), the geographic exclusion and strategic
focus make this a definitive pass.
```
✅ Comprehensive answer
✅ Cites deal breakers
✅ References strategic priorities
✅ Explains why service score doesn't overcome geography issue

---

### 8. Monitoring & Guardrails Added

#### **New Logging (to be implemented):**
```typescript
// Context assembly logging
console.log('Chat context assembled:', {
  deal_id: listingId,
  buyer_count: buyersResult.data.length,
  buyers_in_context: buyerSummaries.slice(0, 100).length,
  transcript_count: callTranscripts?.length || 0,
  deal_transcript_count: dealTranscripts?.length || 0,
  context_size_estimate: JSON.stringify(conversationMessages).length,
  timestamp: new Date().toISOString()
});

// Data quality warnings
if (buyersResult.data.some(b => b.data_completeness < 50)) {
  console.warn('Low data completeness detected for some buyers');
}

if (!callTranscripts || callTranscripts.length === 0) {
  console.warn(`No transcripts available for deal ${listingId}`);
}
```

#### **New Guardrails in System Prompt:**
```typescript
## RESPONSE QUALITY GUARDRAILS:
1. NEVER answer questions about transcripts if no transcript data is loaded
2. ALWAYS cite data sources when making claims (scores, quotes, etc.)
3. If data completeness < 50%, mention this limitation
4. Use "Based on available data..." when context is incomplete
5. Explicitly state "I don't have [type] data" rather than deflecting
6. Never hallucinate buyer criteria, owner statements, or transcript content
7. If asked to compare 10+ buyers but only 100 in context, note this limitation
```

---

## CRITICAL NEXT STEPS (Priority Order)

1. **🚨 IMMEDIATE:** Implement transcript access in `chat-buyer-query` (FIX 1)
2. **🚨 IMMEDIATE:** Implement transcript access in `chat-remarketing` (FIX 2)
3. **🚨 IMMEDIATE:** Remove hardcoded API keys (FIX 6)
4. **⚠️ THIS WEEK:** Add deal breakers to buyer context (FIX 3)
5. **⚠️ THIS WEEK:** Add data availability guardrails (FIX 5)
6. **📋 NEXT SPRINT:** Implement tool/function calling (FIX 4)
7. **📋 NEXT SPRINT:** Add debug/trace mode (PHASE 7)
8. **📋 BACKLOG:** Create automated tests for chatbot data access
9. **📋 BACKLOG:** Implement conversation persistence

---

## CONCLUSION

The chatbot has solid access to buyer and deal metadata but **completely lacks transcript access**, which is the highest-priority data source (priority: 100). This creates a critical blind spot for contextual queries about owner statements, CEO engagement, and verbatim quotes.

**Key Takeaways:**
- ✅ Entity resolution works correctly
- ✅ Permissions are not blocking access
- 🚨 **Transcripts are the #1 missing data source**
- ⚠️ Deal breakers and strategic priorities should be added
- ⚠️ Tool/function calling would improve accuracy
- ⚠️ Hardcoded API keys are a security risk

**Audit Status:** 🚨 CRITICAL GAPS IDENTIFIED - IMMEDIATE ACTION REQUIRED

---

**Report Generated:** 2026-02-07
**Reviewed By:** CTO-level Systems Audit
**Next Review:** After implementing FIX 1-6
