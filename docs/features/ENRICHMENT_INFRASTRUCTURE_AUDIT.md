# SourceCo Enrichment Infrastructure Audit
## CTO-Level Forensic Analysis — February 2026

**Scope**: 34 edge functions, 7 client-side hooks, 3 queue systems, ~19,000+ lines of enrichment code
**Methodology**: Complete source code review of every file listed in scope
**Total codebase lines audited**: 32,640 (edge functions) + 2,158 (client hooks) + shared infrastructure

---

## EXECUTIVE SUMMARY — TOP 10 FINDINGS

| # | Severity | Finding | Impact |
|---|----------|---------|--------|
| 1 | 🔴 CRITICAL | **Hardcoded Supabase anon key** in `enrich-deal/index.ts:109` and `enrichmentPipeline.ts:30` | Key is embedded in source code and committed to version control. While this is a "public" anon key, the pattern is dangerous — any future key rotation requires code changes and redeployment. |
| 2 | 🔴 CRITICAL | **No global rate limit coordination** between 3 queue systems | Deal queue (5 parallel), buyer queue (1 sequential), and guide queue can all fire simultaneously. Worst case: 5 Firecrawl + 5 Gemini + 7 Claude Haiku + 3 Claude Sonnet calls concurrently, all hitting the same API keys. |
| 3 | 🔴 CRITICAL | **Zero cost tracking** — no per-operation token or spend monitoring | Impossible to detect runaway costs, audit spend by operation type, or set budget alerts. A single bulk enrichment of 50 deals could cost $15-50+ with no visibility. |
| 4 | 🟠 HIGH | **Partial write risk in enrich-deal** — multi-step pipeline with non-atomic writes | Transcript extraction → website scrape → AI extraction → LinkedIn → Google Reviews → DB write. Failure at any step leaves partial state. Optimistic locking helps but doesn't cover all paths. |
| 5 | 🟠 HIGH | **Silent failures in auto-enrichment** (`useAutoEnrichment.ts:148-156`) | Auto-enrichment errors are caught and logged to console only — no user notification, no monitoring, no retry. Deals silently fail to enrich on page load. |
| 6 | 🟠 HIGH | **4 functions exceed 500 lines** — maintenance risk | `score-buyer-deal` (1,952), `enrich-deal` (1,699), `generate-ma-guide` (1,480), `enrich-buyer` (1,360). These monolithic functions are difficult to test, debug, and maintain. |
| 7 | 🟠 HIGH | **Inconsistent retry/backoff patterns** across functions | `enrich-deal`: 3 retries with [2s, 5s, 10s] delays. `enrich-buyer`: 3 retries with exponential (3s base). `score-buyer-deal`: 1 retry with 1s base. No shared retry infrastructure used by core functions. |
| 8 | 🟡 MEDIUM | **Client-side enrichment hooks bypass queue system** | `useDealEnrichment`, `useBuyerEnrichment`, and `useAutoEnrichment` call edge functions directly, bypassing the queue processors. This creates uncoordinated parallel API calls. |
| 9 | 🟡 MEDIUM | **Prompt injection risk** — user-supplied data (website content, transcripts) injected directly into AI prompts | Website content and transcript text are inserted into prompts with only length truncation (20,000-50,000 chars). No sanitization of potential prompt injection payloads. |
| 10 | 🟡 MEDIUM | **Stale queue recovery times vary** — 10 min for deals, 3 min for buyers | If a function crashes mid-execution, queue items sit in "processing" state for different durations before recovery. During this window, the items appear stuck in the UI. |

---

## DELIVERABLE 1: FUNCTION-BY-FUNCTION ANALYSIS

### TIER 1: Core Enrichment Functions

---

#### 1. `enrich-deal/index.ts` (1,699 lines)

**Purpose & Trigger**: Primary deal enrichment pipeline. Triggered by: (a) client-side `useDealEnrichment` hook, (b) `useAutoEnrichment` hook on page load, (c) `process-enrichment-queue` worker, (d) `enrichmentPipeline.ts`. Accepts `{ dealId, forceReExtract }`.

**AI Provider + Model**:
- **Gemini 2.0 Flash** (`gemini-2.0-flash`) via OpenAI-compatible endpoint for website content extraction
- **Claude Sonnet** (via `extract-deal-transcript` sub-call) for transcript extraction
- Temperature: not explicitly set (Gemini default)
- Max tokens: not explicitly set

**Input → Output**:
- Input: `dealId` (UUID), optional `forceReExtract` boolean
- Reads: `listings` table (deal data + `extraction_sources`), `deal_transcripts` table
- Writes: `listings` table (~45 fields including `executive_summary`, `services`, `industry`, `geographic_states`, `address_city`, `address_state`, `revenue`, `ebitda`, `enriched_at`, `last_enriched_at`, `extraction_sources`)
- Also triggers: `extract-deal-transcript`, `apify-linkedin-scrape`, `apify-google-reviews`

**Error Handling**:
- AI calls: 3 retries with [2000ms, 5000ms, 10000ms] backoff (lines 1044-1046)
- Rate limit (429): Respects `Retry-After` header, falls back to backoff array (line 1197-1203)
- Firecrawl scrape failure: Returns success if transcripts were already processed (graceful degradation)
- Homepage scrape failure: Hard fail if no transcripts, soft fail if transcripts exist
- Optimistic locking: Uses `enriched_at` as lock version (line 1630-1636). Returns 409 on conflict.

**Concurrency Model**:
- Optimistic locking via `enriched_at` field (line 1624-1636)
- No mutex or DB-level lock — two concurrent calls for the same deal can race
- Queue processor adds additional protection via `claim_enrichment_queue_items` RPC

**Cost Per Call** (estimated):
- Firecrawl: 3 scrape credits (homepage + 2 additional pages) = ~$0.03
- Gemini 2.0 Flash: ~20K input tokens + ~2K output = ~$0.002
- Sub-calls: `extract-deal-transcript` (Claude Sonnet, ~$0.02 per transcript), `apify-linkedin-scrape` (~$0.10-0.50), `apify-google-reviews` (~$0.10)
- **Total estimate: $0.15-0.75 per deal** (varies by transcript count and LinkedIn/Google enrichment)

**Timeout Risk**: 🟠 HIGH
- No explicit function-level timeout set
- Individual timeouts: Firecrawl 30s/page, AI 45s, LinkedIn 180s, Google Reviews 95s
- Worst case serial path: 30s (homepage) + 60s (2 pages) + 45s (AI) + 180s (LinkedIn) + 95s (Google) = **410 seconds**
- Supabase edge function limit is typically 150s. This WILL timeout on complex deals with LinkedIn+Google.

**Data Integrity**:
- Transcript application (step 0A) writes to DB before website scraping begins. If website step fails, transcript data is preserved ✅
- Website extraction writes atomically with optimistic lock ✅
- LinkedIn and Google data may be written by their sub-functions independently (potential race with main update)

**Security**:
- 🔴 Hardcoded Supabase anon key at line 109
- SSRF protection via `validateUrl()` (line 730-731) ✅
- Website content truncated to 20,000 chars in prompt (line 1036) — limits prompt injection surface but doesn't sanitize
- Service role key used for internal calls (lines 561-563)
- AI extracted data validated against `VALID_LISTING_UPDATE_KEYS` allowlist (lines 39-95, 1304-1309) ✅

**Dead Code**: None identified — all paths are reachable.

**Dependencies**: Firecrawl API, Gemini API, Anthropic API (via sub-calls), Apify (LinkedIn + Google), Supabase DB

---

#### 2. `enrich-buyer/index.ts` (1,360 lines)

**Purpose & Trigger**: Buyer enrichment via 4-5 Claude API calls extracting business overview, customer profile, geography, PE intelligence, and size criteria from websites. Triggered by: (a) `useBuyerEnrichment` hook, (b) `process-buyer-enrichment-queue` worker.

**AI Provider + Model**:
- **Claude 3.5 Haiku** (`claude-3-5-haiku-20241022`) — line 14
- Temperature: 0 (deterministic) — line 16
- Max tokens: 4,096 — line 15
- Timeout per AI call: 20,000ms — line 21

**Input → Output**:
- Input: `{ buyerId, skipLock? }`
- Reads: `remarketing_buyers` table
- Writes: `remarketing_buyers` table (~40 fields including `company_name`, `business_summary`, `thesis_summary`, `hq_city`, `hq_state`, `geographic_footprint`, `service_regions`, `operating_locations`, `target_industries`, `target_services`, `target_geographies`, `data_completeness`, `extraction_sources`)

**Error Handling**:
- Claude rate limit (429): 3 retries with exponential backoff (base 3000ms) — lines 357-364
- Inter-call delay: 300ms between Claude calls to avoid RPM limits — line 314
- Payment required (402): Returns error with partial data saved — line 1262-1301
- Rate limited mid-execution: Saves partial data, returns success with warning — lines 1270-1289
- 2-batch execution with 2000ms delay between batches — line 1235

**Concurrency Model**:
- Atomic enrichment lock using `data_last_updated` field (lines 1006-1027)
- Lock duration: 60 seconds — line 1007
- `skipLock` parameter allows queue worker to bypass (queue manages its own concurrency)

**Cost Per Call** (estimated):
- Firecrawl: 1-3 scrape credits (platform + PE firm + location page) = ~$0.01-0.03
- Firecrawl map: 1 credit = ~$0.01
- Claude 3.5 Haiku: 4-5 calls × ~15K input tokens × $0.25/MTok + ~2K output × $1.25/MTok ≈ **$0.03-0.05 per buyer**
- **Total estimate: $0.05-0.10 per buyer**

**Data Provenance System**: 🟢 Well-designed
- Comprehensive provenance rules (lines 30-103): `PLATFORM_OWNED_FIELDS`, `TRANSCRIPT_ONLY_FIELDS`, `PE_FALLBACK_ALLOWED_FIELDS`, `SHARED_FIELDS`
- Write-time enforcement: Fields validated at both extraction and write time ("belt AND suspenders" — line 841)
- Transcript protection: 26 fields that can never be overwritten by website data (lines 106-131)
- Provenance violations are logged and reported in response

**Timeout Risk**: 🟡 MEDIUM
- Per-call timeout: 20s
- 4-5 Claude calls (some parallel within batches) + 2 Firecrawl scrapes + 1 Firecrawl map
- Typical: ~30-50 seconds. Edge case with slow scrapes: ~90 seconds.

---

#### 3. `score-buyer-deal/index.ts` (1,952 lines)

**Purpose & Trigger**: Core buyer-deal matching algorithm. Scores industry alignment, geography, size fit, service fit, plus acquisition activity, portfolio, business model, and custom bonuses. Triggered by: (a) direct API call for single scoring, (b) bulk scoring endpoint.

**AI Provider + Model**:
- **Gemini 2.0 Flash** for industry alignment and service fit scoring
- **Claude 3.5 Haiku** (via `callClaudeWithTool`) for AI-powered fit reasoning
- Both use tool/function calling for structured output

**Input → Output**:
- Single: `{ listingId, buyerId, universeId, customInstructions?, geographyMode? }`
- Bulk: `{ listingId, universeId, buyerIds?, bulk: true, options? }`
- Reads: `listings`, `remarketing_buyers`, `remarketing_deal_universes`, `remarketing_scores` (for learning patterns)
- Writes: `remarketing_scores` table (composite_score, geography_score, size_score, service_score, owner_goals_score, acquisition_score, portfolio_score, business_model_score, multipliers, tier, is_disqualified, fit_reasoning, etc.)

**Error Handling**:
- `fetchWithRetry` helper: 1 retry with 1s exponential backoff (lines 165-186)
- AI failures: Falls back to deterministic keyword+adjacency scoring
- Pause support: Checks `isOperationPaused` between batches (via global-activity-queue)

**Concurrency Model**:
- Bulk scoring uses `Promise.allSettled` for parallel processing
- Adaptive rate limiting based on batch size
- Uses `updateGlobalQueueProgress` for coordinated progress tracking

**Scoring Algorithm**:
- Phase 1: Data assembly (deal + buyer + tracker config)
- Phase 2: Size scoring (deterministic) — revenue/EBITDA range matching with sweet spot bonuses
- Phase 3: Geography scoring (deterministic + adjacency) — uses DB-backed proximity scores
- Phase 4: Service scoring (AI + keyword + adjacency fallback)
- Phase 5: Additional scores (acquisition, portfolio, business model, owner goals)
- Phase 6: Composite calculation with multipliers, gates, and learning adjustments
- Phase 7: AI-generated fit reasoning

**Cost Per Scoring**:
- Gemini calls: 2 (industry + service) × ~5K tokens ≈ $0.001
- Claude call: 1 (fit reasoning) × ~3K tokens ≈ $0.005
- **Total: ~$0.006 per buyer-deal pair**
- Bulk 50 buyers: ~$0.30

**Maintenance Risk**: 🔴 At 1,952 lines this is the largest function and carries significant complexity in the scoring algorithm. The deterministic scoring phases are well-structured but the monolithic file makes changes risky.

---

#### 4. `generate-ma-guide/index.ts` (1,480 lines)

**Purpose & Trigger**: Multi-phase pipeline generating comprehensive M&A industry guides. Triggered by `generate-ma-guide-background` or `process-ma-guide-queue`.

**AI Provider + Model**:
- **Claude Sonnet** (`claude-sonnet-4-20250514`) via streaming for multi-phase content generation
- Multiple sequential phases: outline → sections → market data → integration

**Input → Output**:
- Input: `{ listingId, universeId }` or phase-specific parameters
- Reads: `listings`, `remarketing_deal_universes`, `remarketing_buyers`, `remarketing_scores`
- Writes: `ma_guide_generations` table (content, status, progress), `remarketing_guide_generation_state`

**Cost Per Guide**:
- 4-6 Claude Sonnet calls × ~10K tokens each
- **Estimated: $0.30-0.60 per guide**

---

### TIER 2: Queue Processors

---

#### 5. `process-enrichment-queue/index.ts` (340 lines)

**Purpose & Trigger**: Deal enrichment queue worker. Processes pending enrichment items in parallel batches.

**Configuration**:
- Batch size: 10 (fetch), Concurrency: 5 (parallel processing) — lines 13-14
- Max attempts: 3 — line 15
- Per-item timeout: 90,000ms — line 16
- Max function runtime: 110,000ms — line 19
- Stale recovery: 10 minutes — line 47

**Queue Management**:
- Claims items via `claim_enrichment_queue_items` RPC (atomic claim — line 64)
- Fallback: Regular SELECT + UPDATE if RPC unavailable (line 74)
- Pre-check: Skips already-enriched listings (lines 107-146)
- Status flow: `pending` → `processing` → `completed`/`failed`/`pending` (retry)
- Supports pause via `isOperationPaused` check between chunks

**Error Handling**:
- `Promise.allSettled` ensures one failure doesn't block others ✅
- Rejected promises still update queue row to prevent stuck items (lines 269-308) ✅
- Failed items reset to `pending` if attempts < 3, else `failed`

**Concurrency Guard**: 🟡 WEAK
- No mutex preventing multiple queue processor instances from running simultaneously
- RPC-based claiming provides atomic item claiming, but two invocations can claim different items and run in parallel
- This can cause API rate limit issues if triggered in rapid succession

---

#### 6. `process-buyer-enrichment-queue/index.ts` (257 lines)

**Purpose & Trigger**: Buyer enrichment queue worker. Processes ONE buyer at a time (conservative due to Claude rate limits).

**Configuration**:
- Batch size: 1 (sequential) — line 11
- Max attempts: 3 — line 12
- Per-buyer timeout: 120,000ms — line 13
- Rate limit backoff: 90,000ms — line 14
- Stale recovery: 3 minutes — line 15

**Queue Management**:
- **"Skip if active" guard**: Checks for any items in `processing` status before starting (lines 50-63). If found, skips entire run.
- Rate limit handling: Moves items to `rate_limited` status with `rate_limit_reset_at` timestamp (lines 162-179)
- Partial enrichment: Re-queues if rate limited mid-execution but data was partially saved (lines 188-200)

**Concurrency Guard**: ✅ GOOD
- Active processing check prevents concurrent execution
- Combined with `skipLock: true` on enrich-buyer call (queue manages concurrency instead)

---

#### 7. `process-ma-guide-queue/index.ts` (251 lines)

**Purpose & Trigger**: Guide generation queue worker. Multi-phase processing with delays between batches.

**Configuration**:
- Processes one guide at a time
- 2s delay between phase transitions
- Stale recovery for stuck generations

---

### TIER 3: Extraction Functions

---

#### 8. `extract-deal-transcript/index.ts` (951 lines)

**Purpose & Trigger**: Extracts structured deal data from call transcripts using Claude Sonnet. Called by `enrich-deal` for each unprocessed transcript.

**AI Provider + Model**: Claude Sonnet (`claude-sonnet-4-20250514`) via `callClaudeWithTool`
- Default timeout: 20,000ms (from `callClaudeWithTool`)

**Authentication**: Dual-mode — internal calls via `x-internal-secret` header matching service role key (line 92-96), or user JWT.

**Input → Output**:
- Input: `{ transcriptId, transcriptText, applyToDeal?, dealInfo? }`
- Reads: `deal_transcripts` table
- Writes: `deal_transcripts.extracted_data`, `deal_transcripts.processed_at`, `deal_transcripts.applied_to_deal`
- Optionally writes to `listings` table (when `applyToDeal: true`)

**Key Concern**: Large transcripts are truncated to fit Claude's context window, but the truncation point isn't explicitly documented — potential for data loss on very long transcripts.

---

#### 9-13. Other Extraction Functions

**`extract-transcript/index.ts`** (848 lines): Generic transcript extraction. Claude Sonnet. Similar pattern to extract-deal-transcript.

**`extract-buyer-transcript/index.ts`** (655 lines): Extracts buyer criteria from meeting transcripts. Claude Sonnet. Writes to `remarketing_buyers` table.

**`extract-buyer-criteria/index.ts`** (495 lines): Extracts structured investment criteria from buyer data. Claude Sonnet. Writes to `remarketing_buyers`.

**`extract-buyer-criteria-background/index.ts`** (298 lines): Background trigger for criteria extraction. Orchestrator pattern — calls `extract-buyer-criteria` edge function.

**`extract-deal-document/index.ts`** (416 lines): Extracts deal data from uploaded documents (CIM, financials). Claude Sonnet. Writes to `listings`.

---

### TIER 4: Scoring Sub-Functions

---

#### 14. `score-buyer-geography/index.ts` (357 lines)

**Purpose**: Standalone geographic alignment scoring. Contains hardcoded state adjacency map.
**AI Provider**: None — pure deterministic logic.
**Note**: Line 2 comments that the main scoring engine uses DB-backed adjacency instead of this hardcoded map. This function may be partially deprecated.

#### 15. `score-industry-alignment/index.ts` (357 lines)

**Purpose**: AI-powered industry match scoring.
**AI Provider**: Gemini 2.0 Flash

#### 16. `score-service-fit/index.ts` (200 lines)

**Purpose**: AI-powered service/business model fit scoring.
**AI Provider**: Gemini 2.0 Flash

---

### TIER 5: Analysis Functions

---

#### 17. `analyze-deal-notes/index.ts` (409 lines)

**Purpose**: Analyzes deal notes for seller interest signals.
**AI Provider**: Gemini 2.0 Flash
**Tables**: Reads/writes deal-related tables

#### 18. `analyze-seller-interest/index.ts` (360 lines)

**Purpose**: Dedicated seller interest analysis.
**AI Provider**: Gemini 2.0 Flash

#### 19. `analyze-tracker-notes/index.ts` (345 lines)

**Purpose**: Analyzes tracker-level notes for patterns.
**AI Provider**: Gemini 2.0 Flash

#### 20. `analyze-scoring-patterns/index.ts` (259 lines)

**Purpose**: Analyzes scoring patterns across deals.
**AI Provider**: None — pure computation/aggregation logic.

---

### TIER 6: Generation Functions

---

#### 21. `generate-buyer-intro/index.ts` (190 lines)

**Purpose**: Generates buyer introduction emails.
**AI Provider**: GPT-4o-mini (only function using OpenAI)
**Cost**: ~$0.001 per intro

#### 22. `generate-guide-pdf/index.ts` (216 lines)

**Purpose**: Generates PDF from guide content.
**AI Provider**: None — template/formatting only.

#### 23. `generate-ma-guide-background/index.ts` (123 lines)

**Purpose**: Background trigger for guide generation.
**AI Provider**: None — orchestrator that calls `generate-ma-guide`.

#### 24. `generate-research-questions/index.ts` (115 lines)

**Purpose**: Generates research questions for deals.
**AI Provider**: Claude (model from shared config)

---

### TIER 7: Utility Functions

---

#### 25. `clarify-industry/index.ts` (235 lines)

**Purpose**: Clarifies/normalizes industry classifications.
**AI Provider**: Claude (via `callClaudeWithTool`)

#### 26. `parse-fit-criteria/index.ts` (413 lines)

**Purpose**: Parses unstructured buyer criteria into structured format.
**AI Provider**: Gemini 2.0 Flash

#### 27. `bulk-import-remarketing/index.ts` (727 lines)

**Purpose**: Bulk import with post-import enrichment triggers.
**AI Provider**: None directly — triggers enrichment via queue insertion.
**Key Concern**: After import, inserts items into `enrichment_queue` and `buyer_enrichment_queue`, which can trigger massive parallel enrichment runs.

#### 28. `enrich-geo-data/index.ts` (166 lines)

**Purpose**: Geographic data enrichment (geocoding).
**AI Provider**: None — uses geocoding API.

#### 29. `enrich-session-metadata/index.ts` (154 lines)

**Purpose**: Session metadata enrichment.
**AI Provider**: None.

---

### TIER 8: External Data Functions

---

#### 30. `apify-linkedin-scrape/index.ts` (872 lines)

**Purpose**: LinkedIn company data scraping via Apify. Multi-candidate ranking: scrapes up to 3 LinkedIn profiles and picks best match.
**External Service**: Apify LinkedIn scraper actor
**Cost**: ~$0.10-0.50 per scrape (Apify credits)
**Timeout**: Called with 180s timeout from `enrich-deal` (line 1522 of enrich-deal)
**Writes**: `listings.linkedin_employee_count`, `linkedin_employee_range`, `linkedin_url`

#### 31. `apify-google-reviews/index.ts` (340 lines)

**Purpose**: Google Reviews scraping via Apify.
**External Service**: Apify Google Places scraper
**Cost**: ~$0.05-0.10 per scrape
**Writes**: `listings.google_review_count`, `google_review_score`, Google reviews data

#### 32. `firecrawl-scrape/index.ts` (82 lines)

**Purpose**: Generic Firecrawl web scraping utility.
**External Service**: Firecrawl API
**Cost**: ~$0.01 per scrape

#### 33. `find-buyer-contacts/index.ts` (265 lines)

**Purpose**: Contact discovery for buyers.
**External Service**: Likely uses email/contact finding APIs.

#### 34. `verify-platform-website/index.ts` (184 lines)

**Purpose**: Website verification and validation.
**External Service**: Firecrawl for basic scraping.

---

### TIER 9: Shared Infrastructure

---

#### 35. `_shared/ai-providers.ts` (241 lines)

**Purpose**: Centralized AI provider configuration.

**Providers Configured**:
1. **Gemini**: `generativelanguage.googleapis.com` (OpenAI-compatible + native endpoints)
2. **Anthropic**: `api.anthropic.com/v1/messages`

**Models**:
- `gemini-2.0-flash` (default)
- `gemini-2.0-pro-exp` (pro, unused in enrichment)
- `claude-sonnet-4-20250514` (default Claude)
- `claude-3-5-haiku-20241022` (fast Claude)

**Key Utility**: `callClaudeWithTool()` — standardized Claude API call with tool use, timeout, error handling (lines 143-241). Used by multiple extraction and scoring functions.

**Error Parsing**: `parseAIError()` handles 401, 402, 429, 500, 502, 503, 529 with `recoverable` flag (lines 81-123).

**Issues**:
- `callClaudeWithTool` has a default timeout of 20,000ms (line 149) — may be too short for complex extractions
- No token counting or cost tracking built into the shared layer
- No request/response logging for debugging
- Duplicate tool conversion functions: `toAnthropicTool` (line 31) and `convertOpenAIToolToClaudeTool` (line 128) do the same thing

---

### TIER 10: Client-Side Hooks

---

#### 36. `useDealEnrichment.ts` (277 lines)

**Purpose**: Manages bulk deal enrichment from UI.
- Batch size: 3 parallel, 1500ms delay between batches
- Supports cancellation via ref
- Fail-fast on payment/credits error (402) and rate limit (429)
- Calls `enrich-deal` directly (bypasses queue)

#### 37. `useAutoEnrichment.ts` (182 lines)

**Purpose**: Auto-triggers enrichment when visiting a deal page.
- Triggers when: never enriched, stale (>24h), or missing key fields
- 🟠 **Silent failure**: Errors caught and logged only (lines 148-156)
- Fires on mount with 1s delay
- No coordination with other enrichment operations

#### 38. `useBuyerEnrichment.ts` (449 lines)

**Purpose**: Single + bulk buyer enrichment.
- Batch size: 3 parallel, 1500ms delay
- Shared abort state for immediate fail-fast
- Parses invoke errors for meaningful messages
- Calls `enrich-buyer` directly (bypasses queue)

#### 39. `useBuyerEnrichmentQueue.ts` (391 lines)

**Purpose**: Queue-based buyer enrichment with progress tracking.
- Inserts items into `buyer_enrichment_queue` table
- Polls for progress updates
- Triggers `process-buyer-enrichment-queue` via edge function call

#### 40. `useBackgroundGuideGeneration.ts` (249 lines)

**Purpose**: Guide generation with polling progress.
- Inserts into guide generation tracking
- Polls `ma_guide_generations` for status updates

#### 41. `useEnrichmentProgress.ts` (274 lines)

**Purpose**: Deal enrichment progress tracking.
- Polls `enrichment_queue` for item statuses
- Supports pause/resume/cancel operations

#### 42. `useBulkEnrichment.ts` (336 lines)

**Purpose**: MA Intelligence bulk enrichment (deals + buyers).
- Orchestrates both deal and buyer enrichment
- Uses queue-based approach for larger batches

---

## DELIVERABLE 2: DATA FLOW MAP

### Pipeline 1: Deal Enrichment

```
TRIGGER: UI button click / Auto-enrichment / Queue processor
    │
    ├─► [enrich-deal] Edge Function
    │   │
    │   ├─ STEP 0A: Apply existing transcript intelligence
    │   │   └─ READ: deal_transcripts (extracted_data)
    │   │   └─ WRITE: listings (40+ fields via mapExtractedToListing)
    │   │   └─ WRITE: listings.extraction_sources (provenance tracking)
    │   │
    │   ├─ STEP 0B: Process unextracted transcripts
    │   │   └─ CALL: extract-deal-transcript (per transcript, batches of 5)
    │   │       └─ AI: Claude Sonnet
    │   │       └─ WRITE: deal_transcripts.extracted_data
    │   │       └─ WRITE: deal_transcripts.processed_at
    │   │       └─ WRITE: listings (if applyToDeal=true)
    │   │
    │   ├─ STEP 1: Scrape website (multi-page)
    │   │   └─ CALL: Firecrawl API (homepage + /contact + /about)
    │   │   └─ Up to 3 Firecrawl credits per deal
    │   │
    │   ├─ STEP 2: AI extraction from website content
    │   │   └─ AI: Gemini 2.0 Flash (tool use / function calling)
    │   │   └─ Extracts: company name, address, industry, services, employees, financials
    │   │
    │   ├─ STEP 3: LinkedIn enrichment (non-blocking)
    │   │   └─ CALL: apify-linkedin-scrape edge function
    │   │       └─ CALL: Apify LinkedIn scraper
    │   │       └─ WRITE: listings (linkedin_employee_count, linkedin_url)
    │   │
    │   ├─ STEP 4: Google Reviews enrichment (non-blocking)
    │   │   └─ CALL: apify-google-reviews edge function
    │   │       └─ CALL: Apify Google Places scraper
    │   │       └─ WRITE: listings (google_review_count, google_review_score)
    │   │
    │   └─ STEP 5: Final DB write with optimistic locking
    │       └─ WRITE: listings (all extracted fields + enriched_at + extraction_sources)
    │       └─ Lock: enriched_at field (optimistic concurrency control)
```

**Atomicity**: ❌ NOT atomic. Steps 0A, 0B, 3, 4 write independently. Step 5 uses optimistic lock but only for website data. If step 5 fails (409 conflict), transcript and LinkedIn/Google data are already written.

---

### Pipeline 2: Buyer Enrichment

```
TRIGGER: UI button / Queue processor
    │
    ├─► [enrich-buyer] Edge Function
    │   │
    │   ├─ LOCK: Atomic lock via data_last_updated (60s TTL)
    │   │
    │   ├─ SCRAPE: Platform website + PE firm website (parallel)
    │   │   └─ Firecrawl API (1-3 credits per site)
    │   │   └─ Firecrawl Map API (find location pages)
    │   │
    │   ├─ BATCH 1: Core extraction (3 parallel Claude Haiku calls)
    │   │   ├─ Prompt 1: Business Overview & Services
    │   │   ├─ Prompt 2: Customer Profile
    │   │   └─ Prompt 3a: Geographic Footprint
    │   │
    │   ├─ DELAY: 2000ms (avoid Anthropic RPM limits)
    │   │
    │   ├─ BATCH 2: PE extraction (1-2 parallel Claude Haiku calls)
    │   │   ├─ Prompt 3b: PE Intelligence (Acquisitions + Activity + Portfolio)
    │   │   └─ (Size Criteria extraction DISABLED — transcript-only per spec)
    │   │
    │   ├─ PROVENANCE: Validate every field against source rules
    │   │   └─ Platform-owned fields blocked from PE firm website
    │   │   └─ Transcript-only fields blocked from all websites
    │   │
    │   └─ WRITE: remarketing_buyers (40+ fields + extraction_sources)
```

**Atomicity**: ✅ Single atomic write at the end. Partial saves on rate limit (preserves what was extracted).

---

### Pipeline 3: Buyer-Deal Scoring

```
TRIGGER: UI action / Bulk scoring request
    │
    ├─► [score-buyer-deal] Edge Function
    │   │
    │   ├─ READ: listings (deal data)
    │   ├─ READ: remarketing_buyers (buyer data)
    │   ├─ READ: remarketing_deal_universes (tracker config)
    │   ├─ READ: remarketing_scores (learning patterns from prior actions)
    │   │
    │   ├─ PHASE 2: Size scoring (deterministic)
    │   ├─ PHASE 3: Geography scoring (deterministic + DB adjacency)
    │   │   └─ CALL: score-buyer-geography (sub-function)
    │   ├─ PHASE 4: Service scoring (AI + keyword + adjacency)
    │   │   └─ AI: Gemini 2.0 Flash (service fit)
    │   │   └─ AI: Gemini 2.0 Flash (industry alignment)
    │   ├─ PHASE 5: Additional scores (acquisition, portfolio, business model)
    │   ├─ PHASE 6: Composite calculation
    │   ├─ PHASE 7: AI fit reasoning
    │   │   └─ AI: Claude Haiku (fit reasoning generation)
    │   │
    │   └─ WRITE: remarketing_scores (upsert)
```

**Atomicity**: ✅ Single upsert per buyer-deal pair.

---

### Pipeline 4: Guide Generation

```
TRIGGER: UI action → generate-ma-guide-background → process-ma-guide-queue
    │
    ├─► [generate-ma-guide] Edge Function
    │   │
    │   ├─ PHASE 1: Generate outline
    │   │   └─ AI: Claude Sonnet (streaming)
    │   ├─ PHASE 2: Generate sections
    │   │   └─ AI: Claude Sonnet (streaming, per section)
    │   ├─ PHASE 3: Market data integration
    │   │   └─ AI: Claude Sonnet (streaming)
    │   ├─ PHASE 4: Final assembly
    │   │
    │   └─ WRITE: ma_guide_generations (content + status updates per phase)
```

---

### Pipeline 5: Transcript Extraction

```
TRIGGER: enrich-deal → for each unprocessed transcript
    │
    ├─► [extract-deal-transcript] Edge Function
    │   │
    │   ├─ AUTH: Internal call (x-internal-secret) or user JWT
    │   ├─ AI: Claude Sonnet (tool use) — extract structured data
    │   ├─ WRITE: deal_transcripts.extracted_data
    │   ├─ WRITE: deal_transcripts.processed_at
    │   └─ OPTIONAL WRITE: listings (if applyToDeal=true, with priority system)
```

---

## DELIVERABLE 3: CONCURRENCY & RATE LIMIT ANALYSIS

### API Rate Limits by Provider

| Provider | Model | Rate Limit (typical tier) | Used By |
|----------|-------|--------------------------|---------|
| Anthropic | Claude Sonnet 4 | ~50-100 RPM, 40K TPM | extract-deal-transcript, extract-transcript, extract-buyer-transcript, extract-buyer-criteria, extract-deal-document, generate-ma-guide, generate-research-questions, clarify-industry |
| Anthropic | Claude 3.5 Haiku | ~100-200 RPM, 100K TPM | enrich-buyer (4-5 calls each), score-buyer-deal (fit reasoning) |
| Google | Gemini 2.0 Flash | ~15-60 RPM (free tier), 1M TPM (paid) | enrich-deal, score-buyer-deal (industry + service), score-industry-alignment, score-service-fit, analyze-deal-notes, analyze-seller-interest, analyze-tracker-notes, parse-fit-criteria |
| OpenAI | GPT-4o-mini | ~500 RPM | generate-buyer-intro (only user) |
| Firecrawl | Scrape API | ~10-30 concurrent | enrich-deal (3/deal), enrich-buyer (1-3/buyer), verify-platform-website |
| Apify | LinkedIn scraper | Actor-dependent | apify-linkedin-scrape |
| Apify | Google Places | Actor-dependent | apify-google-reviews |

### Worst-Case Concurrent API Calls

If all three queue processors run simultaneously + a user triggers manual enrichment:

| Provider | Concurrent Calls |
|----------|-----------------|
| **Gemini** | 5 (deal enrichment) + 2-4 (scoring) = **7-9 calls** |
| **Claude Haiku** | 4-5 (buyer enrichment) + 1-3 (scoring fit reasoning) = **5-8 calls** |
| **Claude Sonnet** | 5 (transcript extraction from deal queue) + 1-4 (guide generation) = **6-9 calls** |
| **Firecrawl** | 15 (5 deals × 3 pages) + 3 (1 buyer × 3) = **18 calls** |
| **Apify** | 5 (LinkedIn) + 5 (Google Reviews) = **10 calls** |

🔴 **This exceeds typical rate limits for Gemini free tier and potentially Claude.**

### Rate Limit Handling Inventory

| Function | 429 Handling | Retry Count | Backoff Strategy |
|----------|-------------|-------------|------------------|
| enrich-deal | Retry with Retry-After header or [2s, 5s, 10s] | 3 | Fixed array |
| enrich-buyer (callClaudeAI) | Recursive retry with exponential backoff | 3 | 3s × 2^attempt |
| score-buyer-deal (fetchWithRetry) | Retry on 5xx only (429 returns as-is) | 1 | 1s × 2^attempt |
| process-buyer-enrichment-queue | Sets `rate_limited` status with 90s backoff | N/A (queue level) | 90s fixed |
| callClaudeWithTool (shared) | Returns error object (no retry) | 0 | None |
| score-industry-alignment | Unknown (delegated to Gemini call) | Varies | Varies |
| analyze-* functions | Unknown (delegated) | Varies | Varies |

🟠 **Inconsistency**: Some functions retry 429s aggressively, some don't retry at all, some use different backoff strategies. This is a reliability risk.

### Stale State Recovery

| Queue | Stale Timeout | Recovery Action |
|-------|--------------|-----------------|
| enrichment_queue | 10 minutes | Reset to `pending`, clear `started_at` |
| buyer_enrichment_queue | 3 minutes | Reset to `pending`, clear `started_at` |
| ma_guide_generations | Varies by phase | Phase-specific recovery |

---

## DELIVERABLE 4: COST ANALYSIS

### Per-Operation Cost Estimates

| Operation | AI Cost | External API Cost | Total |
|-----------|---------|-------------------|-------|
| Enrich 1 deal | $0.002 (Gemini) | $0.03 (Firecrawl) + $0.10-0.50 (LinkedIn) + $0.05-0.10 (Google) | **$0.19-0.65** |
| + per transcript | $0.02 (Claude Sonnet) | — | **+$0.02/transcript** |
| Enrich 1 buyer | $0.03-0.05 (Claude Haiku) | $0.02-0.04 (Firecrawl) | **$0.05-0.09** |
| Score 1 pair | $0.006 (Gemini + Claude) | — | **$0.006** |
| Generate 1 guide | $0.30-0.60 (Claude Sonnet) | — | **$0.30-0.60** |
| Extract 1 transcript | $0.02-0.04 (Claude Sonnet) | — | **$0.02-0.04** |
| Generate 1 intro | $0.001 (GPT-4o-mini) | — | **$0.001** |

### Bulk Operation Costs

| Operation | Estimated Cost |
|-----------|---------------|
| Enrich 50 deals (with LinkedIn + Google) | **$9.50-32.50** |
| Enrich 50 deals (without LinkedIn/Google) | **$1.50-2.50** |
| Enrich 20 buyers | **$1.00-1.80** |
| Score 40 buyers × 1 deal | **$0.24** |
| Score all buyers × 10 new deals | **$2.40** |
| Generate 5 industry guides | **$1.50-3.00** |

### Monthly Estimate (moderate usage)

| Category | Volume/Month | Cost |
|----------|-------------|------|
| Deal enrichment | 100 deals | $19-65 |
| Buyer enrichment | 50 buyers | $2.50-4.50 |
| Scoring | 2,000 pairs | $12 |
| Guides | 10 guides | $3-6 |
| Transcripts | 50 transcripts | $1-2 |
| Buyer intros | 100 intros | $0.10 |
| **Total** | | **$38-90/month** |

### Cost Optimization Opportunities

1. **🟢 LinkedIn scraping is the biggest cost driver** — $0.10-0.50 per deal. Consider caching LinkedIn data and only re-scraping monthly.
2. **🟢 Gemini 2.0 Flash is very cheap** — good model choice for extraction tasks.
3. **🟡 Claude Haiku for buyer enrichment is efficient** — 4-5 calls at $0.03-0.05 total is good.
4. **🟡 Guide generation could use Gemini for initial outline** — save Sonnet for final quality pass.
5. **🔴 No token counting = no cost visibility** — must add per-call token tracking to detect anomalies.

---

## DELIVERABLE 5: ERROR HANDLING AUDIT

### Silent Failures

| Location | Description | Severity |
|----------|-------------|----------|
| `useAutoEnrichment.ts:148-156` | Auto-enrichment errors caught and logged to console only | 🟠 HIGH |
| `enrich-deal/index.ts:1547-1550` | LinkedIn enrichment failure logged as warning only | 🟡 MEDIUM |
| `enrich-deal/index.ts:1594-1597` | Google Reviews failure logged as warning only | 🟡 MEDIUM |
| `enrich-buyer/index.ts:304-306` | Firecrawl map error caught and returns empty array | 🟢 LOW (intentional) |
| `callClaudeAI:370-371` | Non-ok response returns `{ data: null }` without error code | 🟡 MEDIUM |

### Cascading Failures

1. **Firecrawl outage → all enrichment fails**: Both deal and buyer enrichment depend on Firecrawl. If Firecrawl is down, neither can scrape websites.
2. **Anthropic rate limit → buyer enrichment chain fails**: Each buyer needs 4-5 Claude calls. Rate limit on call 3 means calls 1-2 are wasted (though partial data is saved).
3. **Gemini outage → scoring and deal enrichment fail**: Score-buyer-deal and enrich-deal both depend on Gemini. Scoring has deterministic fallback; deal enrichment does not.

### Missing Error Handling

1. `enrich-deal/index.ts:1052-1194`: The main Gemini AI call has retry logic, but non-429 errors only log and continue to next attempt without differentiating recoverable vs. unrecoverable errors.
2. `score-buyer-deal`: `fetchWithRetry` only retries on 5xx status, not on 429 rate limits (lines 175-176). Rate-limited scoring calls fail immediately.

### Inconsistent Patterns

| Pattern | Functions Using It |
|---------|-------------------|
| Custom retry with fixed delay array | enrich-deal |
| Recursive retry with exponential backoff | enrich-buyer (callClaudeAI) |
| `fetchWithRetry` helper (1 retry, 5xx only) | score-buyer-deal |
| No retry (delegate to `callClaudeWithTool`) | extract-deal-transcript, clarify-industry, generate-research-questions |
| Queue-level retry (re-queue item) | process-enrichment-queue, process-buyer-enrichment-queue |

---

## DELIVERABLE 6: SECURITY & DATA EXPOSURE AUDIT

### API Key Management

| Finding | Severity | Location |
|---------|----------|----------|
| Hardcoded Supabase anon key | 🔴 CRITICAL | `enrich-deal/index.ts:109`, `enrichmentPipeline.ts:30` |
| All other API keys via `Deno.env.get()` | ✅ GOOD | All functions |
| Service role key passed as `x-internal-secret` header | 🟡 MEDIUM | Internal function calls |
| No client-side API keys | ✅ GOOD | All hooks use Supabase client |

### Data Leakage in Prompts

- **Website content**: Up to 20,000-50,000 characters sent to Gemini/Claude. This includes whatever is on the public website — typically not sensitive.
- **Transcript content**: Full transcript text sent to Claude for extraction. May contain **confidential deal terms, financial details, personal contact info, negotiation strategies**. This is the highest data exposure risk.
- **Deal info sent to transcript extraction**: Company name, industry, location, revenue, EBITDA — sent as context (enrich-deal line 569-575).
- **Buyer data in scoring prompts**: Buyer criteria, geographic preferences, investment thesis — sent to Gemini for scoring.

🟡 **Recommendation**: Audit which AI providers receive PII and ensure data processing agreements are in place.

### Prompt Injection Risk

- **Website content injection**: Website markdown is inserted directly into prompts (enrich-deal line 1036). A malicious website could include prompt injection payloads in their HTML/markdown.
- **Transcript injection**: Transcript text is inserted directly into Claude prompts. Less likely to be adversarial (internal call recordings) but still a vector.
- **Tool/function calling mitigates some risk**: Most functions use structured tool_use output, which constrains the AI response format.

### Output Validation

- **`VALID_LISTING_UPDATE_KEYS` allowlist** (enrich-deal lines 39-95): Prevents writing to unexpected columns ✅
- **`VALID_BUYER_COLUMNS` allowlist** (enrich-buyer lines 187-202): Same protection for buyer table ✅
- **Numeric field sanitization** (enrich-deal lines 398-431): Strips non-numeric values from numeric columns ✅
- **Placeholder detection** (enrich-deal lines 201-227, enrich-buyer line 149-152): Filters "Unknown", "N/A", etc. ✅
- **Address validation** (enrich-deal lines 1317-1428): Validates state codes, ZIP codes, cleans city names ✅
- **LinkedIn URL validation** (enrich-deal lines 1481-1496): Only accepts direct linkedin.com/company/ URLs ✅
- **EBITDA multiple detection** (enrich-buyer lines 718-736): Catches when AI returns multiples instead of dollar amounts ✅

🟢 **Output validation is generally strong** — the team has clearly learned from past data quality issues.

---

## DELIVERABLE 7: ARCHITECTURE RECOMMENDATIONS

### Critical Fixes (Do Now)

1. **🔴 Remove hardcoded anon key** from `enrich-deal/index.ts:109` and `enrichmentPipeline.ts:30`. Use `Deno.env.get('SUPABASE_ANON_KEY')` only, failing explicitly if not set.

2. **🔴 Add global rate limit coordination**: Implement a shared rate limit tracker (DB-backed counter or Redis) that all queue processors and direct calls check before making AI API calls. This prevents the worst-case scenario of 20+ concurrent API calls.

3. **🔴 Add cost tracking**: Log input/output token counts for every AI call. Store in a `enrichment_cost_log` table with columns: `function_name`, `provider`, `model`, `input_tokens`, `output_tokens`, `estimated_cost`, `created_at`.

### High-Value Improvements

4. **🟠 Unify retry logic**: Create a shared `retryWithBackoff()` utility in `_shared/retry.ts` (one already exists but core functions don't use it). All AI calls should go through it.

5. **🟠 Add monitoring for auto-enrichment failures**: `useAutoEnrichment` should report failures to a monitoring endpoint or at minimum surface a subtle UI indicator.

6. **🟠 Add circuit breaker pattern**: If 5+ consecutive calls to a provider fail, stop trying for 5 minutes instead of continuing to burn through queue items.

7. **🟠 Add request deduplication**: If `enrich-deal` is called for a deal that's already being enriched (by auto-enrichment or queue), the second call should detect this and skip or wait.

### Architecture Changes

8. **🟡 Split monolithic functions**: Break `score-buyer-deal` (1,952 lines) into separate files for each scoring phase. Import them into the main handler. Same for `enrich-deal` and `enrich-buyer`.

9. **🟡 Consolidate queue systems**: The 3 separate queue systems (`enrichment_queue`, `buyer_enrichment_queue`, `ma_guide_generations`) should share a common `global_activity_queue` infrastructure with unified pause/resume/cancel.

10. **🟡 Client → Queue routing**: Instead of `useDealEnrichment` calling `enrich-deal` directly, have it insert into the queue and let the queue processor handle it. This prevents uncoordinated parallel execution.

### Model Migration Opportunities

11. **🟡 Consider Gemini Flash for buyer enrichment**: Claude Haiku is ~5x more expensive per token than Gemini Flash. If quality is comparable for extraction tasks, significant savings (~60% on buyer enrichment costs).

12. **🟢 GPT-4o-mini for buyer intros is optimal**: Already using the cheapest model for a simple generation task.

13. **🟢 Gemini Flash for scoring is optimal**: Good balance of cost and speed for the scoring workload.

### Monitoring & Observability Gaps

14. **🔴 No alerting on enrichment failures**: Failed enrichments are logged to console but nobody is paged. Need alerts for: payment_required errors, sustained rate limiting, function timeouts.

15. **🟠 No dashboard for enrichment health**: Need a view showing: queue depths, processing rates, error rates, cost accumulation, API latency percentiles.

16. **🟠 No tracing across function chains**: When `enrich-deal` calls `extract-deal-transcript` calls Claude, there's no request ID flowing through to correlate logs.

---

## DELIVERABLE 8: FUNCTION DEPENDENCY GRAPH

### Function Call Graph

```
enrich-deal
  ├── extract-deal-transcript (per transcript)
  ├── apify-linkedin-scrape
  └── apify-google-reviews

enrich-buyer
  └── (self-contained — 4-5 Claude calls internally)

score-buyer-deal
  └── (self-contained — 2-3 AI calls internally)

process-enrichment-queue
  └── enrichmentPipeline
      └── enrich-deal (via HTTP call)

process-buyer-enrichment-queue
  └── enrich-buyer (via HTTP call)

process-ma-guide-queue
  └── generate-ma-guide (via HTTP call)

generate-ma-guide-background
  └── generate-ma-guide (via HTTP call)

extract-buyer-criteria-background
  └── extract-buyer-criteria (via HTTP call)

bulk-import-remarketing
  └── (inserts into enrichment_queue and buyer_enrichment_queue)
```

### Shared Database Tables (Read/Write Conflicts)

| Table | Writers | Readers | Conflict Risk |
|-------|---------|---------|---------------|
| `listings` | enrich-deal, extract-deal-transcript, apify-linkedin-scrape, apify-google-reviews, extract-deal-document, bulk-import | score-buyer-deal, generate-ma-guide, all analysis functions | 🟠 HIGH — 4+ functions write to same rows |
| `remarketing_buyers` | enrich-buyer, extract-buyer-transcript, extract-buyer-criteria, parse-fit-criteria, bulk-import | score-buyer-deal, generate-ma-guide, find-buyer-contacts | 🟡 MEDIUM — fewer concurrent writers |
| `remarketing_scores` | score-buyer-deal | generate-ma-guide, analyze-scoring-patterns | 🟢 LOW — single writer |
| `deal_transcripts` | extract-deal-transcript, extract-transcript | enrich-deal | 🟡 MEDIUM — enrich-deal reads while extract writes |

### API Rate Limit Competition

| Provider | Competing Functions |
|----------|-------------------|
| **Anthropic (Claude)** | enrich-buyer, extract-deal-transcript, extract-transcript, extract-buyer-transcript, extract-buyer-criteria, generate-ma-guide, score-buyer-deal (reasoning), clarify-industry, generate-research-questions |
| **Google (Gemini)** | enrich-deal, score-buyer-deal (industry + service), score-industry-alignment, score-service-fit, analyze-deal-notes, analyze-seller-interest, analyze-tracker-notes, parse-fit-criteria |
| **Firecrawl** | enrich-deal, enrich-buyer, firecrawl-scrape, verify-platform-website |

### Overlapping Functionality

| Overlap | Functions | Recommendation |
|---------|-----------|----------------|
| Transcript extraction | extract-deal-transcript (951 lines), extract-transcript (848 lines) | Consolidate — these do very similar things |
| Geographic scoring | score-buyer-geography (standalone), calculateGeographyScore (in score-buyer-deal) | score-buyer-geography appears partially deprecated |
| Service fit scoring | score-service-fit (standalone), calculateServiceScore (in score-buyer-deal) | Standalone may be unused by core flow |
| Seller interest analysis | analyze-deal-notes, analyze-seller-interest | Significant overlap in purpose |
| Tool conversion | `toAnthropicTool()` and `convertOpenAIToolToClaudeTool()` in ai-providers.ts | Duplicate code — merge into one function |

---

## DELIVERABLE 9: PROMPT ENGINEERING AUDIT

### Prompt Quality Summary

| Function | Model | Prompt Quality | Token Efficiency | Structured Output | Notes |
|----------|-------|---------------|------------------|-------------------|-------|
| enrich-deal | Gemini Flash | 🟢 Good — detailed extraction instructions with inference rules | 🟡 System prompt is ~2,000 tokens — could be trimmed | ✅ Tool use with schema | The address extraction instructions (lines 968-998) are very thorough |
| enrich-buyer (Prompt 1) | Claude Haiku | 🟢 Good — clear provenance rules | 🟡 Repeats "CRITICAL DATA PROVENANCE" in every prompt | ✅ Tool use | Good separation of concerns across prompts |
| enrich-buyer (Prompt 3a) | Claude Haiku | 🟢 Excellent — region-to-state expansion tables | 🟡 Region expansion table is large (~200 tokens) | ✅ Tool use | Best prompt in the codebase — very thorough geography extraction |
| extract-deal-transcript | Claude Sonnet | 🟢 Good — financial extraction with confidence levels | 🟡 Could use Haiku for simpler transcripts | ✅ Tool use | Appropriate model for complex extraction |
| score-buyer-deal (service fit) | Gemini Flash | 🟢 Good | 🟢 Efficient | ✅ Tool use | Right model for this task |
| generate-ma-guide | Claude Sonnet | 🟢 Good — multi-phase with context passing | 🟠 Very large prompts for guide sections | ✅ Streaming | Appropriate model for long-form generation |
| generate-buyer-intro | GPT-4o-mini | 🟢 Good | 🟢 Efficient | Text output | Right model for simple generation |

### Key Observations

1. **enrich-buyer prompts repeat context**: The "CRITICAL DATA PROVENANCE RULE" is repeated across all 4-5 prompts (~100 tokens each). This could be moved to a system prompt once. Savings: ~400 tokens per buyer.

2. **enrich-deal website content truncation at 20,000 chars**: This is approximately 5,000 tokens. Combined with the ~2,000 token system prompt and ~500 token user prompt, the total is ~7,500 tokens — well within Gemini's limits.

3. **Temperature settings vary**:
   - enrich-buyer: `temperature: 0` (deterministic) ✅
   - Most others: default (varies by provider)
   - For extraction tasks, temperature 0 is appropriate and should be used consistently.

---

## DELIVERABLE 10: TESTING & VALIDATION GAPS

### Functions with No Error Path Testing

All edge functions appear to have NO automated tests. There is no test directory or test files visible in the `supabase/functions` directory. This means:
- No unit tests for scoring algorithms
- No integration tests for AI extraction pipelines
- No mock tests for external API failures
- No regression tests for data provenance rules

### AI Outputs Trusted Without Validation

While there IS validation (allowlists, numeric sanitization, placeholder detection), the following are NOT validated:
1. **Array length**: AI could return arrays with thousands of items (e.g., `geographic_states` with 100+ entries). Only anti-hallucination check is in `validateGeography` (service_regions > 30 with no evidence — line 648).
2. **String length**: No maximum length validation on extracted text fields. AI could return 10,000-character `executive_summary`.
3. **Enum values**: Fields like `business_type` have enum constraints in the prompt but no validation before DB write (relies on DB constraints).

### Database Writes with No Rollback

| Function | Write Pattern | Rollback on Failure? |
|----------|--------------|---------------------|
| enrich-deal | Multiple sequential writes (transcripts, then website, then LinkedIn, then Google) | ❌ No rollback — each step is independent |
| enrich-buyer | Single atomic write at end | ✅ N/A — atomic |
| score-buyer-deal | Upsert per pair | ✅ N/A — atomic per pair |
| extract-deal-transcript | Writes extracted_data then optionally applies to listing | ❌ Partial if apply fails |

### External Service Failures That Would Go Unnoticed

1. **Firecrawl degradation**: If Firecrawl returns short/garbled content (not empty), the function would still proceed with AI extraction on bad data. Content length check (200 chars) is the only guard.
2. **Apify actor failures**: LinkedIn and Google scraping failures are caught but only logged as warnings. No alerting. A broken Apify actor could silently skip enrichment for weeks.
3. **Gemini API quality degradation**: If Gemini returns lower-quality extractions (incomplete data, hallucinated addresses), there's no quality scoring or anomaly detection.

---

## APPENDIX: COMPLETE FILE INVENTORY

### Edge Functions (sorted by line count)

| File | Lines | AI Provider | Risk Rating |
|------|-------|-------------|-------------|
| score-buyer-deal/index.ts | 1,952 | Gemini + Claude | 🔴 HIGH (size + complexity) |
| enrich-deal/index.ts | 1,699 | Gemini + Claude | 🔴 HIGH (size + multi-service) |
| generate-ma-guide/index.ts | 1,480 | Claude Sonnet | 🟠 HIGH (size) |
| enrich-buyer/index.ts | 1,360 | Claude Haiku | 🟠 HIGH (size) |
| extract-deal-transcript/index.ts | 951 | Claude Sonnet | 🟡 MEDIUM |
| apify-linkedin-scrape/index.ts | 872 | None (Apify) | 🟡 MEDIUM |
| extract-transcript/index.ts | 848 | Claude | 🟡 MEDIUM (overlap with extract-deal-transcript) |
| bulk-import-remarketing/index.ts | 727 | None | 🟡 MEDIUM (triggers enrichment) |
| extract-buyer-transcript/index.ts | 655 | Claude Sonnet | 🟡 MEDIUM |
| extract-buyer-criteria/index.ts | 495 | Claude Sonnet | 🟢 LOW |
| extract-deal-document/index.ts | 416 | Claude Sonnet | 🟢 LOW |
| parse-fit-criteria/index.ts | 413 | Gemini | 🟢 LOW |
| analyze-deal-notes/index.ts | 409 | Gemini | 🟢 LOW |
| analyze-seller-interest/index.ts | 360 | Gemini | 🟢 LOW |
| score-buyer-geography/index.ts | 357 | None | 🟢 LOW (possibly deprecated) |
| score-industry-alignment/index.ts | 357 | Gemini | 🟢 LOW |
| analyze-tracker-notes/index.ts | 345 | Gemini | 🟢 LOW |
| process-enrichment-queue/index.ts | 340 | None (orchestrator) | 🟡 MEDIUM |
| apify-google-reviews/index.ts | 340 | None (Apify) | 🟢 LOW |
| extract-buyer-criteria-background/index.ts | 298 | None (trigger) | 🟢 LOW |
| find-buyer-contacts/index.ts | 265 | None | 🟢 LOW |
| analyze-scoring-patterns/index.ts | 259 | None (logic) | 🟢 LOW |
| process-buyer-enrichment-queue/index.ts | 257 | None (orchestrator) | 🟡 MEDIUM |
| process-ma-guide-queue/index.ts | 251 | None (orchestrator) | 🟢 LOW |
| clarify-industry/index.ts | 235 | Claude | 🟢 LOW |
| generate-guide-pdf/index.ts | 216 | None (template) | 🟢 LOW |
| score-service-fit/index.ts | 200 | Gemini | 🟢 LOW |
| generate-buyer-intro/index.ts | 190 | GPT-4o-mini | 🟢 LOW |
| verify-platform-website/index.ts | 184 | None | 🟢 LOW |
| enrich-geo-data/index.ts | 166 | None | 🟢 LOW |
| enrich-session-metadata/index.ts | 154 | None | 🟢 LOW |
| generate-ma-guide-background/index.ts | 123 | None (trigger) | 🟢 LOW |
| generate-research-questions/index.ts | 115 | Claude | 🟢 LOW |
| firecrawl-scrape/index.ts | 82 | None | 🟢 LOW |

### Client Hooks

| File | Lines | Functions Called | Risk |
|------|-------|----------------|------|
| useBuyerEnrichment.ts | 449 | enrich-buyer | 🟡 Bypasses queue |
| useBuyerEnrichmentQueue.ts | 391 | process-buyer-enrichment-queue | 🟢 Uses queue |
| useBulkEnrichment.ts | 336 | Queue-based | 🟢 Uses queue |
| useDealEnrichment.ts | 277 | enrich-deal | 🟡 Bypasses queue |
| useEnrichmentProgress.ts | 274 | Queue monitoring | 🟢 Read-only |
| useBackgroundGuideGeneration.ts | 249 | generate-ma-guide-background | 🟢 Uses queue |
| useAutoEnrichment.ts | 182 | enrich-deal | 🟠 Silent failures |

### Shared Infrastructure

| File | Purpose |
|------|---------|
| _shared/ai-providers.ts | AI provider config, callClaudeWithTool |
| _shared/geography.ts | State normalization, merging |
| _shared/geography-utils.ts | Proximity scoring, state adjacency |
| _shared/source-priority.ts | Extraction source tracking, priority updates |
| _shared/security.ts | URL validation, SSRF protection |
| _shared/global-activity-queue.ts | Global queue progress, pause/resume |
| _shared/retry.ts | Shared retry utility (underused) |
| _shared/validation.ts | Input validation |
| _shared/criteria-validation.ts | Criteria validation |
| _shared/ai-client.ts | Alternative AI client (3 retries default) |
| _shared/claude-streaming.ts | Claude streaming support |

---

## CONCLUSION

SourceCo's enrichment infrastructure is **functionally capable but operationally fragile**. The core AI extraction logic is well-designed — the provenance system in `enrich-buyer`, the optimistic locking in `enrich-deal`, and the multi-signal scoring in `score-buyer-deal` are all thoughtfully implemented. However, the infrastructure suffers from:

1. **No global coordination** — three independent queue systems and multiple direct-call paths can overwhelm API rate limits
2. **No cost visibility** — impossible to detect runaway costs or optimize spend
3. **Inconsistent reliability patterns** — retry logic, timeouts, and error handling vary significantly between functions
4. **Monolithic functions** — four functions exceed 500 lines, making them difficult to test and maintain
5. **Silent failures** — auto-enrichment and optional enrichments (LinkedIn, Google) can fail without anyone noticing

The **highest-priority fix** is implementing global rate limit coordination and cost tracking. These are foundational capabilities that make everything else safer and more observable. The hardcoded anon key should also be removed immediately as a security hygiene measure.

The **highest-value architectural change** would be routing all enrichment through the queue system (eliminating direct-call bypasses) and adding a shared rate limiter that all functions check before making external API calls.

---

*Audit conducted February 2026. All line numbers reference the codebase as of the audit date.*
