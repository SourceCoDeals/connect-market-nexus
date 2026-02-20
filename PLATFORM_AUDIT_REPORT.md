# SourceCo Platform Audit Report

**Date:** 2026-02-20
**Auditor:** CTO-Level Technical & Business Alignment Audit
**Platform:** SourceCo Connect — M&A Marketplace & Deal Intelligence Platform
**Scope:** Full-stack audit of ~240K LoC frontend, 107 edge functions, 117 tables, 548 migrations

---

## Executive Summary

SourceCo has built a substantial M&A intelligence platform with strong domain-specific features: AI-powered enrichment, buyer-deal scoring, transcript intelligence, and a dual-sided marketplace. The engineering work is ambitious and the domain logic is well-modeled.

However, the platform has accumulated significant architectural debt that affects security, performance, data integrity, and operational efficiency. The most critical issues are:

1. **Marketplace data exposure** — `SELECT *` queries return all 170 listing columns (including confidential company names, contacts, and internal notes) to marketplace buyers. RLS is row-level only and does not filter `is_internal_deal`.
2. **93 of 107 edge functions use wildcard CORS** (`Access-Control-Allow-Origin: *`) instead of the shared origin-restricted module.
3. **Inverted naming convention** (`listings` = deals, `deals` = pipeline entries) creates persistent confusion and has already caused broken pages.
4. **No retry logic in 22 of 24 email functions** — transient failures cause permanent email loss.
5. **Bulk delete performs 27 sequential DB calls per deal** — deleting 10 deals = 270 round trips.

The platform needs a focused simplification effort before scaling further. The foundations are sound but the layering of features has outpaced the guardrails.

---

## Section 1: DATA INTEGRITY AUDIT

**Status: NEEDS WORK**

### What Works Well
- Domain normalization via `normalize_domain()` RPC provides consistent deduplication anchor
- `idx_listings_unique_website` enforces unique normalized domain on listings
- Source priority system (`_shared/source-priority.ts`) prevents lower-priority sources from overwriting higher-priority data
- `pushed_to_all_deals` flag properly gates lead source intake flow (CapTarget, GP Partners, Valuation)

### Issues Found

| Severity | Issue | Location | Description |
|----------|-------|----------|-------------|
| **CRITICAL** | `website` field is nullable | `src/integrations/supabase/types.ts` — listings.Row | The primary deal anchor (`website`) allows NULL. Deals without websites can't be enriched, deduplicated, or properly scored. |
| **HIGH** | `listings` has 170+ columns | `src/integrations/supabase/types.ts` | Table has grown to ~170 fields with mixed concerns: anonymous marketplace data, real company data, enrichment data, scoring metadata, transcript extractions, geographic data, and admin notes — all in one row. |
| **HIGH** | Buyer domain uniqueness is per-universe only | `remarketing_buyers` table | The unique index on `normalized_domain` is scoped per `universe_id`. The same buyer company (same domain) can exist in 5 different universes with different data, creating inconsistency when the same buyer is scored against deals across universes. |
| **MEDIUM** | `deal_source` values inconsistent | Multiple locations | Deal sources include: `captarget`, `gp_partners`, `valuation_calculator`, `valuation_lead`, `marketplace`, `manual`, but some are checked inconsistently (e.g., `gp_partners` vs `gp-partners` with different casing/delimiter). |
| **MEDIUM** | No FK integrity enforcement on soft-deleted records | `20260203_soft_deletes_consistency.sql` | Soft-delete (`deleted_at`) doesn't cascade to related tables. Orphaned `remarketing_scores`, `deals`, and `remarketing_universe_deals` can reference deleted listings. |
| **LOW** | Enrichment queue stuck items | `enrichment_queue` table | Items with `attempts >= 3` and status `failed` accumulate. No automatic cleanup or alerting. |

### Recommended Fixes
1. **Make `website` NOT NULL** with a migration that backfills from `internal_company_name` or enrichment data. Add a CHECK constraint.
2. **Create a `listing_views` pattern** — split the 170-column monolith into logical groups via Postgres views or a normalized schema (company_core, financials, enrichment_metadata, marketplace_display).
3. **Implement global buyer deduplication** — `dedupe-buyers` function exists but only operates within universes. Add cross-universe canonical buyer records.
4. **Add soft-delete cascade triggers** — when a listing is soft-deleted, cascade `deleted_at` to scores, universe links, and pipeline entries.

### Business Impact
- NULL websites prevent enrichment for those deals, reducing data quality for matching
- Per-universe buyer duplication means a PE firm could receive conflicting scores for the same deal depending on which universe context is used
- Orphaned records inflate dashboard counts and create stale matches

---

## Section 2: ENRICHMENT PIPELINE AUDIT

**Status: NEEDS WORK**

### What Works Well
- **5-step pipeline is well-designed**: Transcripts → Notes → Website scrape → AI extraction → External enrichment (LinkedIn/Google)
- **Source priority enforcement** (`source-priority.ts:144-189`): Transcript (100) > Notes (80) > Website (60) > CSV (40) > Manual (20) prevents lower-quality data from overwriting higher
- **Financial field blocking** (`enrich-deal/index.ts:514`): Strips financial data extracted from websites, preventing hallucinated revenue/EBITDA from polluting deal records
- **SSRF protection** (`_shared/security.ts:174-206`): Comprehensive RFC 1918 and cloud metadata endpoint blocking
- **Optimistic locking** (`enrich-deal/index.ts:721-725`): Prevents lost updates from concurrent enrichments
- **Provenance tracking** (`extraction_sources`): Per-field source type tracking enables data lineage audit
- **Cost tracking** (`_shared/cost-tracker.ts`): Logs token usage and estimated costs per AI call

### Issues Found

| Severity | Issue | Location | Description |
|----------|-------|----------|-------------|
| **HIGH** | Financial data leaks into prose fields | `enrich-deal/index.ts:514` | `stripFinancialFields()` only blocks top-level fields (revenue, ebitda). AI can include financial figures in `executive_summary`, `key_quotes`, or `services` text without detection. |
| **HIGH** | Concurrent enrichment lost updates | `process-enrichment-queue/index.ts:352-361` | If two queue workers process the same listing simultaneously, only one DB write persists. No atomic merge or conflict resolution beyond optimistic lock check. |
| **HIGH** | Circuit breaker too aggressive | `process-enrichment-queue/index.ts:247-268` | Trips after 3 consecutive failures regardless of cause (network blip vs. actual rate limit). All items in the batch are abandoned. |
| **HIGH** | Self-continuation lacks max invocation limit | `process-enrichment-queue/index.ts:482-517` | Queue continuation is fire-and-forget with no maximum retry count. If items consistently fail, the function can loop indefinitely, accumulating costs. |
| **MEDIUM** | Company name hallucination risk | `enrich-deal/deal-extraction.ts` | Despite strict prompting, AI can return generic names like "Facility Management Company" instead of the real business name. No fallback validation against website domain or other signals. |
| **MEDIUM** | Address inference from area codes | `enrich-deal/deal-extraction.ts:159` | AI infers city from phone area codes, which is unreliable for ported/VoIP numbers. |
| **MEDIUM** | Location page discovery is fire-and-forget | `enrich-buyer/index.ts:333-360` | Background `firecrawlMap` promise for location discovery can fail silently without affecting the response — location data may be silently missing. |
| **LOW** | Placeholder detection gaps | `deal-extraction.ts:556-566` | Regex catches "Not discussed on this call" but misses variations like "Ownership structure: Not disclosed" when field name is prepended. |

### AI Provider Configuration
- **Primary model**: `gemini-2.0-flash` (default) — `_shared/ai-providers.ts:21`
- **Alternatives**: `gemini-2.5-flash`, `gemini-2.0-pro-exp`
- **Retry strategy**: 3 retries with exponential backoff (2s base, 60s max), respects Retry-After headers
- **Timeout**: Does NOT retry on timeout (immediately re-throws) — `ai-providers.ts:151-152`
- **Pricing**: Flash at $0.10/$0.40 per M input/output tokens; Pro at $1.25/$5.00

### Rate Limiting
- **Provider limits** (`_shared/rate-limiter.ts:19-23`): Gemini 10 concurrent/10s cooldown, Firecrawl 5/10s, Apify 3/30s
- **DB-backed coordination**: Cooldown state shared across edge function invocations
- **Non-blocking**: Returns `ok=true` if DB check fails (fail-open) — `rate-limiter.ts:78-80`
- **Thundering herd risk**: Multiple functions waking at cooldown expiry can collide despite jitter

### Recommended Fixes
1. **Add prose field financial scanning** — post-extraction regex to detect and flag/strip dollar amounts and financial terminology in executive_summary and key_quotes
2. **Add max continuation limit** — cap self-continuation invocations at 5-10, with alerting when hit
3. **Tune circuit breaker** — distinguish rate limit errors (429) from other failures; only trip on rate limits, retry other errors
4. **Add timeout retry** — at least 1 retry on AI timeout before giving up

### Business Impact
- Financial data hallucination in summaries could mislead buyers during due diligence
- Queue stalls from aggressive circuit breaker delay enrichment for the entire pipeline
- Lost updates mean some deals show stale/incomplete data after enrichment

---

## Section 3: SCORING ALGORITHM AUDIT

**Status: NEEDS WORK**

### What Works Well
- **Multi-dimensional scoring**: 5 dimensions covering industry, size, geography, service fit, and owner goals
- **AI-enhanced scoring**: Uses Gemini for service fit and owner goals dimensions that can't be captured by numeric rules alone
- **Fallback functions**: When AI is unavailable, deterministic heuristic scoring provides reasonable estimates
- **Score persistence**: Scores saved to `remarketing_scores` table with `score_snapshots` for history tracking
- **Configurable weights**: `SCORING_CONFIG` object makes all parameters tunable without code changes

### Issues Found

| Severity | Issue | Location | Description |
|----------|-------|----------|-------------|
| **HIGH** | Deprecated field references still in code | `score-buyer-deal/index.ts:1548` | `revenue_sweet_spot` and `ebitda_sweet_spot` still referenced as fallbacks in `buyerHasSizeData` check. `key_quotes` referenced in data_completeness at line 1429 but field is DROPPED per migration `20260221000000_unified_buyer_system.sql`. Code handles nulls gracefully but creates dead-code confusion. |
| **HIGH** | AI non-determinism (3 AI calls per score) | `score-buyer-deal/index.ts` | Service fit, owner goals, and thesis alignment all use Gemini. Running the same buyer-deal pair twice can produce different scores. No averaging, consensus, or seed parameter. |
| **HIGH** | Data quality bonus disabled but code remains | `score-buyer-deal/index.ts:1313` | `DATA_QUALITY_BONUS_MAX: 10` defined in config but bonus calculation is DISABLED. Dead code path that could confuse future developers. |
| **MEDIUM** | 2,156-line monolith | `score-buyer-deal/index.ts` | All scoring logic in a single file — difficult to test individual dimensions, modify weights, or add new scoring criteria. |
| **MEDIUM** | Score staleness — no invalidation triggers | `remarketing_scores` table | No automatic re-scoring when deal or buyer data changes. Scores can be stale if enrichment updates financials after scoring. |
| **MEDIUM** | Weight redistribution is invisible | `score-buyer-deal/index.ts:1543-1601` | When buyer lacks data for a dimension, weight silently redistributes to other dimensions. No UI indicator showing redistribution occurred or which dimensions absorbed extra weight. |
| **LOW** | Scoring weights history not actively used | `scoring_weights_history` table | Populated during universe config changes, but scoring reads weights directly from `remarketing_buyer_universes` table — history is audit-only. |

### Architecture (Detailed from code audit)

**SCORING_CONFIG** (`score-buyer-deal/index.ts:126-179`) — all tunable parameters:
```
Tier Bands:        A ≥ 80, B ≥ 65, C ≥ 50, D ≥ 35, F < 35 or disqualified
Size Tolerances:   ±10% exact, ±20% near, 70-90% slight below, >150% max = disqualify
Size Multipliers:  exact=1.0, near=0.95, slight_below=0.7, heavy=0.3, above_max=0.7
Service Mult:      score<20→0.4, <40→0.6, <60→0.8, <80→0.9, ≥80→1.0, zero=DISQUALIFY
Bonuses:           thesis_max=20pts, custom_max=25pts, data_quality=DISABLED
Learning:          penalty -5 to +25 range (from buyer_learning_history)
Bulk Config:       batch=5, delay=300-600ms based on buyer count
```

**5 Scoring Dimensions:**

| Dimension | Type | Weight | Description |
|-----------|------|--------|-------------|
| 1. Size Scoring | Deterministic | ~30% | Revenue/EBITDA range overlap with buyer's `target_revenue_min/max`, `target_ebitda_min/max`. Sweet spot = midpoint. Returns both score (0-100) AND multiplier (0.0-1.0 gate). |
| 2. Geography | Deterministic + Adjacency | ~20% | Checks 6 data sources in priority order: `target_geographies` → `geographic_footprint` → `operating_locations` → `service_regions` → `customer_geographic_reach` → `hq_state`. Modes: critical (floor=0), preferred (floor=30), minimal (floor=50). |
| 3. Service Fit | **AI (Gemini)** + keyword fallback | ~25% | Primary: Gemini evaluates service compatibility. Fallback: keyword + adjacency matching (80%+ overlap→90, 50-79%→75, 25-49%→55). Primary focus bonus: +10 for primary match. |
| 4. Owner Goals | **AI (Gemini)** + norms fallback | ~15% | Primary: Gemini evaluates transition/cultural alignment. Fallback: buyer-type norms (PE base=55, platform varies by goal type). Special penalty: "no pe" with pe_firm buyer → -25. |
| 5. Thesis Alignment | **AI (Gemini)** + pattern fallback | Bonus 0-20pts | Primary: Gemini tool_call scores 0-20. Fallback: pattern matching (roll-up=3pts, platform=3pts, recurring_revenue=2pts, etc.). |

**Weight Redistribution** (`score-buyer-deal/index.ts:1543-1601`):
When buyer lacks data for a dimension, weight is pooled and redistributed proportionally to dimensions WITH data. This happens silently — no UI visibility when weights rebalance.

**Composite Assembly** (`score-buyer-deal/index.ts:1603-1772`):
```
weightedBase = Σ(dimension_score × dimension_weight) / effective_weight_sum
gatedScore = weightedBase × size_multiplier × service_multiplier
finalScore = clamp(0, 100, gatedScore + thesis_bonus + custom_bonus - learning_penalty)
```

**3 AI calls per single score** (service + owner_goals + thesis) running via `Promise.all()`. Each has 10s timeout, 3 retries with 2s exponential backoff. Best-case latency: ~30s per buyer-deal pair.

**Score Persistence:**
- Active scores → `remarketing_scores` (upserted, unique on listing_id + buyer_id + universe_id)
- Audit trail → `score_snapshots` (immutable, version 'v5', fire-and-forget insert)

### Deal Quality vs Buyer-Deal Scoring
- `calculate-deal-quality/index.ts` (468 lines) scores deals independently: revenue tier (0-75), EBITDA (0-15), industry multiplier, market score, LinkedIn employee count as proxy when financials missing
- `score-buyer-deal/index.ts` (2,156 lines) scores the **buyer-deal match** across 5 dimensions
- These are **complementary**, not redundant — quality indicates deal readiness, scoring indicates buyer fit
- Deal quality has its own self-continuation for batch processing (offset-based, 200 per batch)

### Recommended Fixes
1. **Remove deprecated field dependencies** — update scoring to use current schema fields before dropping the old columns
2. **Add deterministic mode** — for scoring audit/comparison, add a zero-temperature or seed parameter to AI calls for reproducible results
3. **Implement score invalidation** — trigger re-scoring when deal financials or buyer criteria change
4. **Decompose the monolith** — extract each scoring dimension into its own module with independent tests

### Business Impact
- Deprecated field references will cause scoring failures when schema cleanup happens
- Non-deterministic scores reduce trust — same buyer-deal pair can show different match quality on different runs
- Stale scores mean deal flow recommendations may not reflect current deal/buyer state

---

## Section 4: MARKETPLACE & BUYER EXPERIENCE AUDIT

**Status: CRITICAL**

### What Works Well
- `use-listings.ts:39-41`: Properly filters `status = 'active'`, `deleted_at IS NULL`, `is_internal_deal = false`
- `useListing()` (single listing): Also enforces `is_internal_deal = false` — `use-listings.ts:215`
- `publish-listing/index.ts:93-101`: Proper admin auth + `is_admin` RPC check before publish
- `publish-listing/index.ts:163-174`: Quality validation (title, description, category, location, revenue, EBITDA, image) before marketplace listing
- `publish-listing/index.ts:139-161`: Prevents publishing deals linked to remarketing systems
- Lazy loading via `lazyWithRetry` with stale chunk recovery — `App.tsx:30-43`
- Buyer type visibility filtering via `visible_to_buyer_types` column

### Issues Found

| Severity | Issue | Location | Description |
|----------|-------|----------|-------------|
| **CRITICAL** | `SELECT *` returns all 170 columns to marketplace buyers | `use-listings.ts:34` | Query uses `.select('*, hero_description')` which returns ALL columns including `internal_company_name`, `website`, `main_contact_name`, `main_contact_email`, `main_contact_phone`, `internal_notes`, and `address_*` fields. RLS is row-level only — it cannot filter columns. A buyer with browser DevTools can see all confidential data. |
| **CRITICAL** | RLS does not enforce `is_internal_deal` | `20251006114111` migration | The active RLS policy only checks `status = 'active'`, `deleted_at IS NULL`, and `buyer_type` matching. It does NOT check `is_internal_deal = false`. An authenticated buyer can query internal/remarketing deals directly via Supabase client. |
| **HIGH** | `publish-listing/index.ts` uses wildcard CORS | `publish-listing/index.ts:3-5` | `Access-Control-Allow-Origin: *` instead of the shared `_shared/cors.ts` module. Any website can call this admin-only endpoint. |
| **HIGH** | Connection request flow has no NDA gate for data access | `connection_requests` table flow | The request flow (request → admin review → approve) does not programmatically enforce NDA signing before granting access to real deal information. The protection is manual/process-based. |
| **MEDIUM** | No analytics on listing views for non-admin | `ListingDetail.tsx` | Listing analytics tracking may leak internal identifiers in browser network logs |
| **LOW** | Deal alert matching RPC (`match_deal_alerts_with_listing`) usage is minimal | Alert system | Limited evidence of active deal alert delivery in production |

### Recommended Fixes
1. **IMMEDIATE: Replace `SELECT *` with explicit column list** — create a `MARKETPLACE_SAFE_COLUMNS` constant that excludes all internal fields (`internal_company_name`, `website`, `main_contact_*`, `internal_notes`, `address_*`, etc.). Use it in `use-listings.ts` and `useListing()`.
2. **IMMEDIATE: Add `is_internal_deal = false` to RLS policy** — amend the "Approved users can view active listings based on buyer type" policy to include `AND is_internal_deal = false` in the non-admin branch.
3. **Create a `marketplace_listings` view** — a Postgres view that only exposes safe columns and filters `is_internal_deal = false`. Marketplace queries use the view; admin queries use the table directly.
4. **Enforce NDA programmatically** — add `nda_signed_at` timestamp check before releasing real deal info in connection request approval flow.

### Business Impact
- **DEAL-BREAKING**: If a sophisticated buyer opens browser DevTools, they can see the real company name, website, contact info, and internal notes for ANY marketplace listing. This undermines SourceCo's entire value proposition as an anonymous marketplace intermediary.
- Internal deals visible to marketplace buyers could expose confidential client information before engagement.
- Without programmatic NDA enforcement, there's a process-level gap where real info could be shared before legal protection is in place.

---

## Section 5: PIPELINE & DEAL MANAGEMENT AUDIT

**Status: NEEDS WORK**

### What Works Well
- `use-deals.ts` properly uses `get_deals_with_details` RPC that joins `deals` + `listings` + `remarketing_buyers` — providing a unified view
- `convert-to-pipeline-deal/index.ts` properly links `listing_id`, `remarketing_buyer_id`, and `stage_id` when creating pipeline entries
- Deal stages are configurable via `deal_stages` table with `automation_rules` support
- Comprehensive deal tracking: tasks, comments, notes, contacts, and activity logging

### Issues Found

| Severity | Issue | Location | Description |
|----------|-------|----------|-------------|
| **HIGH** | AllDeals.tsx queries `deals` table directly with fallback field mappings | `AllDeals.tsx:99-121` | Line 99 queries `supabase.from("deals").select("*")`. Lines 105-121 map fields with fallback chains: `deal_name` tries `contact_name → deal_name → 'Unknown Deal'`, `tracker_id` tries `listing_id → tracker_id → ''`. Should use `get_deals_with_details()` RPC instead. |
| **HIGH** | Inverted naming causes persistent confusion | Codebase-wide | `listings` = the actual deal/company. `deals` = pipeline entries (buyer pursuing a deal). This naming inversion has caused bugs in MA Intelligence pages and makes the codebase confusing for new developers. |
| **HIGH** | `get_deals_with_details` RPC schema instability | 6+ migrations | 30+ migration updates to this RPC across 6 months (20250903, 20250930, 20251001 x2, 20251003). Indicates fundamentally unstable schema. Latest adds `buyer_connection_count`. |
| **MEDIUM** | MA Intelligence deals route redirects | `App.tsx:268-269` | `/admin/ma-intelligence/deals` redirects to `/admin/deals` — effectively disabling the MA Intelligence deal list. The route acknowledges AllDeals.tsx is broken. |
| **MEDIUM** | `deal_comments` uses `as any` cast | `use-deal-comments.ts:22,65,114` | Table cast as `'deal_comments' as any` indicating TypeScript type generation issue. Types not properly exported from `supabase/types.ts`. |
| **MEDIUM** | `deal_notes` deprecated but not cleaned up | Migration `20251003220245` | Data migrated to `deal_comments` in migration lines 32-40. Old table still exists. |
| **LOW** | Pipeline kanban performance | `use-pipeline-core.ts` | Loading all pipeline deals at once for kanban view may become slow with 500+ active deals. |

### Architecture Clarification
```
listings (THE DEAL — the business being sold)
  ├── 170 columns: company data, financials, enrichment, marketplace display
  ├── 28 tables reference it via FK
  └── One record per company domain

deals (PIPELINE ENTRIES — a buyer pursuing a deal)
  ├── 43 columns: stage, probability, NDA/fee status, assignment
  ├── deals.listing_id → listings.id (many-to-one)
  ├── deals.remarketing_buyer_id → remarketing_buyers.id (which buyer)
  └── deals.stage_id → deal_stages.id (pipeline stage)
```

### Recommended Fixes
1. **Rename tables** (long-term) — consider renaming `listings` → `companies` or `deals_master`, and `deals` → `pipeline_entries` or `deal_pursuits`. This is high-effort but eliminates the #1 source of confusion.
2. **Short-term: Add aliases/types** — create clear TypeScript type aliases: `type Company = Database['public']['Tables']['listings']['Row']` and `type PipelineEntry = Database['public']['Tables']['deals']['Row']`
3. **Fix or remove MA Intelligence AllDeals** — either rewrite to query via the `get_deals_with_details` RPC (like the working remarketing pages) or remove the route entirely since it redirects anyway.
4. **Integrate task notifications** — connect `deal_tasks` to the email notification system for assignment and due date alerts.

### Business Impact
- Broken MA Intelligence pages mean the team has duplicate, non-functional UI that wastes time
- Naming confusion slows onboarding and increases bug risk for every developer touching deal-related code
- Incomplete task integration means deal follow-ups depend on manual tracking outside the platform

---

## Section 6: TRANSCRIPT INTELLIGENCE AUDIT

**Status: NEEDS WORK**

### What Works Well
- **Fireflies integration** (`sync-fireflies-transcripts/index.ts`): Smart deduplication via `fireflies_transcript_id` check before insert (line 157-162). On-demand content fetching pattern reduces storage.
- **Two-phase transcript processing** (`enrich-deal/transcript-processor.ts`): Phase 0A applies existing extracted data; Phase 0B processes new transcripts via AI. Well-structured separation.
- **Dual extraction**: Separate buyer (`extract-buyer-transcript/index.ts`, 668 lines) and deal (`extract-deal-transcript/index.ts`, 789 lines) extractors with domain-specific prompts
- **Source priority enforcement**: Transcript data has priority 100 (highest), ensuring it always overwrites enrichment data from lower-priority sources
- **Numeric field sanitization** (`extract-deal-transcript/index.ts:690-710`): Validates all numeric fields (revenue, ebitda, employees, locations) before DB write
- **`convert-to-pipeline-deal/index.ts`**: Bridge from remarketing to pipeline works correctly — creates `deals` entry with proper `listing_id`, `remarketing_buyer_id`, `stage_id` linking (lines 229-246). Also auto-creates `firm_agreements` and `firm_members` entries.
- **Deal stages** (`use-deals.ts:240-253`): Well-defined schema with `is_active` and `stage_type` filtering

### Issues Found

| Severity | Issue | Location | Description |
|----------|-------|----------|-------------|
| **HIGH** | Transcript re-extraction idempotency | `enrich-deal/index.ts:224-238` | `forceReExtract=true` clears all `extracted_data` then re-processes all transcripts. If prompts have changed since original extraction, re-extraction may produce different results, introducing inconsistency. |
| **HIGH** | Massive AI prompt maintenance burden | `extract-deal-transcript/index.ts:100-399` | 300+ lines of prompt engineering covering 9 extraction sections. `extract-buyer-transcript/index.ts:77-336` has 7,000+ characters of prompts. Changes require careful regression testing across all extraction fields. |
| **MEDIUM** | No transcript deduplication across participants | `sync-fireflies-transcripts/index.ts` | Dedup exists per `fireflies_transcript_id` (line 157-162) but not across participants. Same meeting recorded by multiple attendees may create separate transcripts with conflicting extractions. |
| **MEDIUM** | AI extraction hallucination in buyer criteria | `extract-buyer-transcript/index.ts` | Buyer acquisition criteria (target revenue, EBITDA ranges, geographic preferences) extracted from conversational transcripts may be imprecise or hallucinated from casual mentions vs. firm criteria. Confidence scores exist but thresholds aren't enforced. |
| **LOW** | Processing status tracking incomplete | `deal_transcripts`/`buyer_transcripts` | `processed_at` exists but no "extraction_version" field to track which prompt version was used. Re-extraction uses current prompts without version tracking. |

### Recommended Fixes
1. **Add extraction versioning** — store a prompt hash or version number with each extraction result so re-extraction can be triggered only when prompts change
2. **Extract prompts to shared config** — move the 300+ line prompt templates from inline code to `_shared/extraction-prompts.ts` for centralized maintenance
3. **Add confidence thresholds** — extract buyer criteria with confidence scores; only apply to buyer profile when confidence exceeds threshold
4. **Add cross-participant dedup** — match by meeting date range + participant overlap before creating separate transcript records

### Business Impact
- Transcript data is the highest-fidelity intelligence source and SourceCo's competitive moat. Errors in extraction directly affect buyer-deal matching accuracy.
- Prompt maintenance burden increases risk of regression when modifying extraction logic
- Duplicate transcripts across participants waste AI processing costs and can produce conflicting data

---

## Section 7: EMAIL & NOTIFICATION AUDIT

**Status: NEEDS WORK**

### What Works Well
- **Brevo integration** (`_shared/brevo-sender.ts:42-99`): Clean shared utility with error handling
- **`enhanced-admin-notification`**: Only function with proper retry logic (3 retries) and dual-provider failover (Resend → Brevo)
- **Delivery tracking**: `email_delivery_logs` table used by `send-data-recovery-email` and `send-feedback-email`
- **Graceful degradation**: `send-feedback-notification` and `send-task-notification-email` fail open when Brevo key is missing
- **Deduplication**: `send-owner-intro-notification` has 5-minute dedup window — `send-owner-intro-notification/index.ts:43-62`

### Issues Found

| Severity | Issue | Location | Description |
|----------|-------|----------|-------------|
| **HIGH** | 22 of 24 email functions have NO retry logic | All `send-*` functions except `enhanced-admin-notification` | A single transient Brevo API failure causes permanent email loss. No retry, no dead-letter queue, no alerting. |
| **HIGH** | Inconsistent delivery tracking | Multiple tables | Some functions log to `email_delivery_logs`, others to `alert_delivery_logs`, `nda_logs`, or `deal_referrals`. No unified delivery monitoring. |
| **HIGH** | Hardcoded email recipients | `send-owner-inquiry-notification/index.ts:134`, `enhanced-admin-notification/index.ts:84,127` | `ahaile14@gmail.com` and `admin@yourdomain.com` hardcoded. Environment variable or config table lookup needed. |
| **MEDIUM** | `admin-notification` is a dead proxy | `admin-notification/index.ts:4-13` | Marked deprecated, proxies to `enhanced-admin-notification`. Adds unnecessary function invocation overhead. |
| **MEDIUM** | `send-verification-email` is disabled (returns 410) | `send-verification-email/index.ts:17-35` | Function exists but returns HTTP 410 Gone. Should be removed entirely. |
| **MEDIUM** | `send-email-notification` and `send-notification-email` are deprecated thin wrappers | Both functions | Consolidation markers present but functions still deployed. |
| **LOW** | `notify-remarketing-match` sends NO email | `notify-remarketing-match/index.ts:75-96` | Despite the "notify" name, only creates `admin_notifications` database records. No email delivery. |

### Email Functions Inventory (24 total)
- **Active and properly functioning (15)**: send-approval-email, send-connection-notification, send-contact-response, send-data-recovery-email, send-deal-alert, send-deal-referral, send-fee-agreement-email, send-feedback-email, send-feedback-notification, send-nda-email, send-owner-inquiry-notification, send-owner-intro-notification, send-password-reset-email, send-task-notification-email, send-user-notification
- **Active with retry (1)**: enhanced-admin-notification
- **Deprecated/dead (5)**: admin-notification (proxy), send-email-notification, send-notification-email, send-verification-email (disabled), send-simple-verification-email
- **Notification-only, no email (1)**: notify-remarketing-match
- **Active notification functions (2)**: send-verification-success-email (Resend provider), notify-deal-owner-change, notify-deal-reassignment, notify-new-deal-owner

### Recommended Fixes
1. **Add shared retry wrapper** — create `_shared/email-retry.ts` with exponential backoff (3 retries, 2s/4s/8s). Wrap all `sendViaBervo()` calls.
2. **Unify delivery tracking** — standardize all email functions to log to `email_delivery_logs` with consistent schema.
3. **Externalize recipient configuration** — move hardcoded emails to environment variables or a `system_config` table.
4. **Remove dead functions** — delete `admin-notification`, `send-verification-email`, `send-email-notification`, `send-notification-email`.

### Business Impact
- Lost emails mean buyers don't receive NDA documents, connection approvals, or deal alerts — directly impacting deal velocity
- No unified delivery monitoring means email failures go undetected until a client complains
- Hardcoded recipients will break when team members change

---

## Section 8: SECURITY AUDIT

**Status: CRITICAL**

### What Works Well
- **SSRF protection** (`_shared/security.ts:174-206`): Comprehensive blocking of RFC 1918, cloud metadata, internal domains, non-standard ports, embedded credentials
- **Input validation** (`_shared/security.ts:291-316`): UUID validation, string sanitization, array sanitization utilities
- **Rate limiting** (`_shared/security.ts:52-127`): 500 calls/hour per user per AI operation type, plus global budget
- **Admin auth pattern**: Most admin-facing edge functions check JWT → verify user → `is_admin` RPC
- **CORS module** (`_shared/cors.ts`): Well-designed origin allowlist with Lovable preview domain support
- **Session security**: `session-security/index.ts` and `session-heartbeat/index.ts` provide session tracking
- **OTP rate limiting**: Dedicated `otp-rate-limiter` function for auth endpoint protection
- **Latest RLS fix** (`20260220200000`): Removed the overly-permissive `listings_select_policy` that bypassed buyer-type checks

### Issues Found

| Severity | Issue | Location | Description |
|----------|-------|----------|-------------|
| **CRITICAL** | 93 of 107 edge functions use wildcard CORS | Grep across `supabase/functions/*/index.ts` | `Access-Control-Allow-Origin: *` allows any website to make authenticated requests to these endpoints. The well-designed `_shared/cors.ts` module exists but is almost universally ignored. |
| **CRITICAL** | Marketplace data exposure via SELECT * | `src/hooks/marketplace/use-listings.ts:34` | See Section 4. All 170 listing columns returned to authenticated buyers, including confidential business data. |
| **CRITICAL** | RLS missing `is_internal_deal` check | `20251006114111` migration | Non-admin users can query internal/remarketing deals by bypassing the frontend and calling Supabase directly. The RLS policy doesn't filter on `is_internal_deal`. |
| **HIGH** | Rate limiting fails open on DB error | `_shared/security.ts:76-77` | If the `user_activity` table query fails, rate limiting is bypassed entirely (`allowed: true`). Under DB pressure, this removes all AI cost protection. |
| **HIGH** | `publish-listing/index.ts` leaks full listing in response | `publish-listing/index.ts:203-205` | After publishing, returns the entire listing object (including internal fields) in the HTTP response. Admin-only endpoint but still unnecessary exposure. |
| **MEDIUM** | CORS allowlist includes localhost | `_shared/cors.ts:17-18` | `http://localhost:5173` and `http://localhost:3000` in production CORS allowlist. Should be dev-only. |
| **MEDIUM** | No CSRF protection | Edge functions | POST endpoints rely solely on JWT auth. No CSRF tokens or SameSite cookie attributes for additional protection. |
| **MEDIUM** | `esbuild.drop` strips ALL console calls | `vite.config.ts:34` | `drop: ['console', 'debugger']` removes `console.error` and `console.warn` in production, eliminating client-side error reporting. Should only drop `console.log`. |
| **LOW** | Some edge functions may lack admin auth | Various | Need per-function audit to verify — functions like `track-session`, `track-engagement-signal`, and `error-logger` appropriately skip admin auth, but others should be verified. |

### Recommended Fixes
1. **IMMEDIATE: Migrate all 93 edge functions to shared CORS** — find/replace the hardcoded `corsHeaders` with `import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts'`. This is a mechanical change.
2. **IMMEDIATE: Add `is_internal_deal = false` to listings RLS** — one-line migration.
3. **IMMEDIATE: Replace `SELECT *` with explicit columns** — in all marketplace-facing queries.
4. **Remove localhost from production CORS** — use `CORS_ALLOWED_ORIGINS` env var to set dev origins only in development.
5. **Change esbuild.drop to only strip console.log** — preserve error/warn reporting.
6. **Add fail-closed rate limiting option** — at minimum, log when rate limiting fails open so it can be monitored.

### Business Impact
- Wildcard CORS means any malicious website can make API calls on behalf of an authenticated user if they visit it while logged into SourceCo
- Data exposure through SELECT * undermines the anonymous marketplace model and could expose SourceCo to liability
- Fail-open rate limiting means a Supabase DB outage removes all AI cost protection simultaneously

---

## Section 9: DEAD CODE & UNUSED SYSTEMS AUDIT

**Status: NEEDS WORK**

### What Works Well
- Good use of `lazyWithRetry` for code splitting at the route level — `App.tsx:30-43`
- MA Intelligence and Remarketing serve different functions (analytics/tracking vs. deal/buyer management)

### Issues Found

| Severity | Issue | Location | Description |
|----------|-------|----------|-------------|
| **MEDIUM** | `TestingSuite.tsx` is an orphaned file | `src/pages/TestingSuite.tsx` | 250-line test page with no route in App.tsx. Dead code. |
| **MEDIUM** | `EnrichmentTest.tsx` is routed in production | `App.tsx:78,243` | Dev/test page at `/admin/settings/enrichment-test` that uses real API credits and can modify production data. Should have a confirmation gate or be restricted to dev. |
| **MEDIUM** | 3 deprecated email functions still deployed | `admin-notification`, `send-email-notification`, `send-notification-email` | Proxy/wrapper functions that add latency and maintenance burden. |
| **MEDIUM** | `send-verification-email` returns 410 | `send-verification-email/index.ts:17-35` | Disabled function deployed in production. Should be removed. |
| **MEDIUM** | MA Intelligence AllDeals.tsx and DealDetail.tsx are broken | `src/pages/admin/ma-intelligence/AllDeals.tsx`, `DealDetail.tsx` | AllDeals reads from wrong table. Deal route redirects to remarketing. Effectively dead UI. |
| **LOW** | Potentially unused analytics tables | Types-only references | `chat_analytics`, `chat_recommendations`, `engagement_scores`, `registration_funnel`, `page_views`, `search_analytics` — referenced in types but need verification of active runtime queries. |
| **LOW** | 50+ root-level markdown files | Project root | `BUYER_ENRICHMENT_AUDIT.md`, `CHATBOT_DATA_ACCESS_AUDIT_REPORT.md`, `CSV_BULK_IMPORT_COMPREHENSIVE_FIX.md`, etc. — operational documentation mixed with codebase. Should be in a `docs/` directory or wiki. |

### Recommended Fixes
1. **Delete `TestingSuite.tsx`** — no references, no route.
2. **Gate `EnrichmentTest.tsx`** — add confirmation dialogs before any destructive operation, or restrict to a dev environment flag.
3. **Remove deprecated email functions** — `admin-notification`, `send-email-notification`, `send-notification-email`, `send-verification-email`.
4. **Remove or fix MA Intelligence deal pages** — since routes already redirect, remove the broken components.
5. **Audit analytics tables** — determine which are actively queried at runtime; drop unused tables.
6. **Move docs to `docs/`** — clean root directory.

### Business Impact
- Deployed test pages could accidentally trigger expensive enrichment operations on production data
- Dead UI creates confusion for admin users who stumble on non-functioning pages
- Unused deployed functions consume cold-start resources and create maintenance overhead

---

## Section 10: PERFORMANCE & RELIABILITY AUDIT

**Status: CRITICAL**

### What Works Well
- Route-level code splitting via `React.lazy` — `App.tsx:46-110`
- `lazyWithRetry` automatically handles stale chunk failures — `App.tsx:30-43`
- Recharts manually chunked in Vite config — `vite.config.ts:27`
- Realtime subscriptions properly cleaned up in most components
- `refetchOnWindowFocus: false` prevents unnecessary re-fetches — `App.tsx:122`

### Issues Found

| Severity | Issue | Location | Description |
|----------|-------|----------|-------------|
| **CRITICAL** | Bulk delete: 27 sequential DB calls per deal | `ReMarketingDeals.tsx:749-771` | `handleConfirmSingleDelete` makes 27 individual `await supabase.from().delete()` calls sequentially. Bulk delete (line 876) runs this in a loop: **27 × N deals** sequential round trips. 10 deals = 270 DB calls = potential multi-minute operation. |
| **CRITICAL** | Enrichment queue continuation can loop infinitely | `process-enrichment-queue/index.ts:482-517` | No maximum continuation count. If items consistently fail, the function self-invokes indefinitely, accumulating Supabase function execution costs. |
| **HIGH** | 4 separate queries per ReMarketingDeals page load | `ReMarketingDeals.tsx:164-398` | Loads ALL listings (paginated in 1000-row batches), then separately fetches universe mappings (5000 limit), score stats (10000 limit), and pipeline counts (5000 limit). All client-side joined. |
| **HIGH** | Client-side pagination only | `ReMarketingDeals.tsx:644-649` | Fetches ALL deals from DB (1000-row batches until exhausted), then paginates client-side at 50 per page. With 5000+ deals, this loads all data upfront. |
| **HIGH** | Missing code splitting for heavy libraries | `package.json`, `vite.config.ts:25-29` | Tiptap (14 packages, ~250KB) and Mapbox GL (~500KB+) are NOT dynamically imported or chunked. Only Recharts is manually chunked. Initial bundle includes 1MB+ of feature-specific code. |
| **HIGH** | TanStack Query staleTime too low | `App.tsx:123` | `staleTime: 5 * 60 * 1000` (5 minutes) for global default. Stable data like listings, universes, and buyer profiles should use 15-30 minutes. Causes excessive re-fetching. |
| **MEDIUM** | Realtime subscription leak risk | `ReMarketingUniverseDetail.tsx:224-265` | Subscription depends on `refetchBuyers` in useEffect deps, which can change identity on query state changes, causing resubscribe/leak cycles. |
| **MEDIUM** | Global activity queue over-polling | `useGlobalActivityQueue.ts:34-49` | Every DB change to `global_activity_queue` triggers full table refetch via realtime subscription. During enrichment (1-2 updates/sec), this creates excessive query load. |
| **MEDIUM** | Scoring queue 120s timeout with 20s buffer | `process-scoring-queue/index.ts:9,125` | Per-item timeout of 120s within a 140s function limit. Only 20s for cleanup/DB writes if scoring takes near-max time. |
| **MEDIUM** | `ReMarketingUniverseDetail.tsx` is 1,588 lines | `ReMarketingUniverseDetail.tsx` | Monolith component with 12+ useState, multiple tabs, dialogs, tables, enrichment UI. No code splitting within the component. |
| **LOW** | Query waterfall in universe detail | `ReMarketingUniverseDetail.tsx:175-221` | Buyer transcripts query waits for buyers query to complete before starting. Could be parallelized. |

### Recommended Fixes
1. **IMMEDIATE: Replace cascade delete with stored procedure** — create a Postgres function `delete_listing_cascade(listing_id UUID)` that performs all 27 deletes in a single transaction server-side. Call it once from the frontend.
2. **IMMEDIATE: Add max continuation limit** — cap at 5-10 iterations with alerting.
3. **Add server-side pagination** — use Supabase `.range()` with proper offset/limit for ReMarketingDeals. Don't fetch all data upfront.
4. **Add dynamic imports for Tiptap/Mapbox** — `React.lazy(() => import('./RichTextEditor'))` and `React.lazy(() => import('./MapView'))`.
5. **Increase staleTime** — 15 minutes for listings/buyers, 30 minutes for static config data.
6. **Use realtime payload data** — in `useGlobalActivityQueue`, use the subscription payload directly instead of triggering a full refetch.
7. **Split ReMarketingUniverseDetail** — extract tab content into separate lazy-loaded components.

### Business Impact
- Bulk delete operation can hang the admin UI for minutes, blocking the user
- Infinite enrichment loops waste AI/Supabase credits without producing value
- Loading all deals upfront means page load time scales linearly with deal count — at 5000 deals, initial load could exceed 10 seconds
- 1MB+ initial bundle increases time-to-interactive for all users

---

## Prioritized Action Plan: Top 15 Fixes

Ordered by (business impact × implementation effort efficiency):

| Priority | Action | Severity | Effort | Sections | Description |
|----------|--------|----------|--------|----------|-------------|
| **1** | Replace `SELECT *` with explicit safe columns in marketplace queries | CRITICAL | Low | 4, 8 | Prevents confidential company data exposure to marketplace buyers. Change `use-listings.ts:34` and `useListing()` to select only marketplace-safe columns. |
| **2** | Add `is_internal_deal = false` to listings RLS policy | CRITICAL | Low | 4, 8 | One-line migration. Prevents authenticated users from querying internal deals directly. |
| **3** | Migrate all 93 edge functions to shared CORS | CRITICAL | Medium | 8 | Mechanical find/replace. Eliminates wildcard CORS that allows cross-origin attacks. |
| **4** | Create `delete_listing_cascade()` stored procedure | CRITICAL | Medium | 10 | Single DB function replaces 27 sequential round trips. Eliminates bulk delete performance issue. |
| **5** | Add max continuation limit to enrichment queue | HIGH | Low | 2, 10 | One-line change. Prevents infinite loop cost accumulation. |
| **6** | Add shared email retry wrapper | HIGH | Medium | 7 | Create `_shared/email-retry.ts`, wrap all 15 active email functions. Prevents permanent email loss. |
| **7** | Remove deprecated field references from scoring | HIGH | Medium | 3 | Update `score-buyer-deal/index.ts` to use current schema fields before column drops break scoring. |
| **8** | Add server-side pagination to ReMarketingDeals | HIGH | Medium | 10 | Replace client-side pagination with Supabase `.range()`. Prevents linear page load degradation. |
| **9** | Create `marketplace_listings` Postgres view | HIGH | Medium | 4, 8 | View exposes only safe columns, enforces `is_internal_deal = false`. Defense-in-depth. |
| **10** | Dynamic import Tiptap and Mapbox GL | HIGH | Low | 10 | Add React.lazy wrappers. Reduces initial bundle by ~750KB. |
| **11** | Increase TanStack Query staleTime | MEDIUM | Low | 10 | Change default from 5 to 15 minutes. Reduce stale refetching. |
| **12** | Externalize hardcoded email recipients | MEDIUM | Low | 7 | Move `ahaile14@gmail.com` and `admin@yourdomain.com` to env vars. |
| **13** | Remove dead code | MEDIUM | Low | 9 | Delete `TestingSuite.tsx`, 4 deprecated email functions, fix/remove broken MA Intelligence pages. |
| **14** | Unify email delivery tracking | MEDIUM | Medium | 7 | Standardize all email functions to log to `email_delivery_logs`. Enable delivery monitoring dashboard. |
| **15** | Make `website` NOT NULL on listings | MEDIUM | Medium | 1 | Backfill existing NULL records, add constraint. Ensures all deals can be enriched and deduplicated. |

---

## Architecture Recommendations for Scale

### Short-term (Foundation Simplification)
1. **Column-level access control** — create Postgres views per role (`marketplace_listing_view`, `admin_listing_view`) instead of relying on application-level filtering
2. **Stored procedures for complex operations** — cascade delete, bulk enrichment triggers, score invalidation
3. **Shared CORS migration** — single PR touching all 93 functions
4. **Email consolidation** — reduce 24 functions to ~10 by merging overlapping senders

### Medium-term (Operational Efficiency)
1. **Table rename or alias** — address the `listings`/`deals` naming inversion
2. **Decompose monolith components** — ReMarketingUniverseDetail (1,588 lines), score-buyer-deal (2,156 lines)
3. **Server-side pagination everywhere** — eliminate client-side-only pagination patterns
4. **Score invalidation triggers** — automatic re-scoring when deal/buyer data changes
5. **Unified notification system** — single `send-notification` function with templates, replacing 15+ individual senders

### Long-term (Scale Readiness)
1. **Normalized schema** — split the 170-column `listings` table into logical sub-tables (company_core, financials, enrichment_metadata, marketplace_display)
2. **Event-driven architecture** — replace direct function calls with a message queue for enrichment, scoring, and notification
3. **Cross-universe buyer canonical records** — single source of truth per buyer company across all universes
4. **Automated testing** — the platform has zero automated tests. Add integration tests for critical paths (enrichment, scoring, marketplace access control)
5. **Monitoring & alerting** — centralized error tracking, enrichment failure alerts, email delivery monitoring, cost budget alerts

---

## Summary Scorecard

| Section | Status | Critical Issues | High Issues | Medium Issues |
|---------|--------|----------------|-------------|---------------|
| 1. Data Integrity | NEEDS WORK | 1 | 2 | 2 |
| 2. Enrichment Pipeline | NEEDS WORK | 0 | 4 | 3 |
| 3. Scoring Algorithm | NEEDS WORK | 0 | 2 | 2 |
| 4. Marketplace & Buyer | **CRITICAL** | 2 | 2 | 1 |
| 5. Pipeline & Deal Mgmt | NEEDS WORK | 0 | 2 | 2 |
| 6. Transcript Intelligence | NEEDS WORK | 0 | 1 | 2 |
| 7. Email & Notification | NEEDS WORK | 0 | 3 | 3 |
| 8. Security | **CRITICAL** | 3 | 2 | 3 |
| 9. Dead Code | NEEDS WORK | 0 | 0 | 5 |
| 10. Performance | **CRITICAL** | 2 | 4 | 4 |
| **TOTALS** | | **8** | **22** | **27** |

**Overall Platform Status: NEEDS IMMEDIATE ATTENTION**

The platform's business logic is strong and the domain modeling is thoughtful. The critical issues are all in the infrastructure layer (access control, CORS, performance) rather than the business logic layer. The top 5 fixes from the action plan address all CRITICAL issues and can be implemented within a focused sprint. After that, the platform will have a solid foundation for the scale-up the business requires.

---

*Report generated from code audit of commit on branch `claude/sourceco-platform-audit-da4o4`*
*Session: https://claude.ai/code/session_01E1coCFYWcb9ycnSUvDvJxT*
