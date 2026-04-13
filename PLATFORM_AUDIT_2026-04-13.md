# Full Platform Audit: Code Health, Data Integrity, and Architecture

**Date:** 2026-04-13
**Scope:** Entire codebase — 1,420 source files, 925 migrations, 342 edge function files, 102 npm packages

---

## Part 1: Dead Code

### 19 Deprecated Edge Function Stubs

Functions that return `{ message: 'deprecated' }` — created as stubs to prevent deploy failures but serve no purpose:

`analyze-scoring-patterns`, `backfill-daily-metrics`, `confirm-agreement-signed`, `create-pandadoc-document`, `enhanced-email-delivery`, `get-buyer-fee-embed`, `get-buyer-nda-embed`, `get-document-download`, `pandadoc-integration-test`, `pandadoc-webhook-handler`, `phoneburner-reprocess-logs`, `re-enrich-missing-addresses`, `recalculate-deal-weights`, `send-approval-email`, `send-fee-agreement-reminder`, `send-nda-reminder`, `send-password-reset-email`, `send-verification-email-with-apology`, `trigger-contact-discovery`

### 10 Orphaned Admin Test Pages (~5,575 lines)

Not referenced in App.tsx routes or imported anywhere:

| File                        | Lines |
| --------------------------- | ----- |
| PromptTestRunner.tsx        | 928   |
| EmailTestCentre.tsx         | 897   |
| BuyerRecommendationTest.tsx | 805   |
| ThirtyQuestionTest.tsx      | 567   |
| SmartleadTestPage.tsx       | 550   |
| BuyerClassificationTest.tsx | 541   |
| ListingPipelineTest.tsx     | 502   |
| TestRunTracker.tsx          | 480   |
| SystemTestRunner.tsx        | 303   |
| ContactLookupTestPanel.tsx  | 2     |

### 54 Orphaned Hooks (~17,000+ lines)

Custom hooks exported but never imported. Major groups:

**Analytics hooks (dead, ~4,000 lines):** useUnifiedAnalytics/\* (1,008 lines), useTrafficAnalytics, useEngagementAnalytics, useBuyerIntentAnalytics, useTaskAnalytics, useListingHealth, useRevenueOptimization, useSmartAlerts, useEnhancedFeedback, usePredictiveUserIntelligence, useHistoricalMetrics, useGeographicAnalytics, useSearchAnalytics, useExitAnalysis, useRealTimeAnalytics, useRealTimeGeolocation

**Admin hooks (dead, ~3,500 lines):** use-admin-notifications, use-associated-requests, use-categories, use-deal-comments, use-deal-filters, use-enhanced-user-export, use-fee-agreement, use-firm-agreement-mutations, use-firm-agreement-queries, use-nda, use-pandadoc, use-pipeline-filters, use-quick-dial, use-universal-search

**Integration hooks (dead, ~1,200 lines):** use-contact-heyreach-history, use-contact-smartlead-history, use-smartlead-campaigns, use-smartlead-categorization, use-smartlead-leads

### 77 Empty Database Tables (0 rows)

Schema tables created but never populated. Key examples: `deal_stages`, `deal_tasks`, `deal_comments`, `categories`, `daily_metrics`, `engagement_scores`, `registration_funnel`, `cron_job_logs`, `referral_submissions`

---

## Part 2: Data Integrity

### Duplicate Company Names in Listings

| Company               | Duplicates |
| --------------------- | ---------- |
| "-" (placeholder)     | 10         |
| (empty string)        | 6          |
| Orange Theory Fitness | 6          |
| Various others        | 2-3 each   |

### Soft-Deleted Record Accumulation

| Table         | Soft-deleted | Total | % Deleted |
| ------------- | ------------ | ----- | --------- |
| deal_pipeline | 491          | 518   | **94.8%** |
| buyers        | 1,008        | 2,280 | 44.2%     |
| listings      | 1,227        | 8,990 | 13.6%     |

**deal_pipeline is 95% soft-deleted** — this is either intentional (archival workflow) or a data issue.

### 1 Orphaned deal_pipeline Record

1 deal exists where the associated listing was deleted.

---

## Part 3: Architecture — Giant Components

### God Components (>1,000 lines)

| Component                     | Lines     | Issues                                              |
| ----------------------------- | --------- | --------------------------------------------------- |
| supabase/types.ts             | 15,069    | Generated — skip                                    |
| qaScenarios.ts                | 3,192     | Test data — acceptable                              |
| **DocumentTrackingPage.tsx**  | **1,432** | Fetching + logic + dialogs + tables all in one file |
| **RecommendedBuyersTab.tsx**  | **1,209** | Filtering + search + feedback + ranking + dialogs   |
| **ClientPortalDetail.tsx**    | **1,070** | 8 tabs + data hooks + mutations + modals            |
| **ContactMemberDrawer.tsx**   | **1,025** | 6 parallel queries + multi-entity rendering         |
| MemosTab.tsx                  | 1,020     | Heavy tab component                                 |
| CompanyOverviewCard.tsx       | 988       | 500 lines of US states data embedded                |
| deal-to-listing-anonymizer.ts | 987       | Utility — acceptable                                |

### 141 Large Components (300-500 lines)

Mid-tier complexity. Should be monitored and split when they grow.

### Pattern Inconsistencies

| Pattern         | Dominant                    | Minority                      | Action                           |
| --------------- | --------------------------- | ----------------------------- | -------------------------------- |
| Data fetching   | useQuery (80%, 1,080 calls) | useState+fetch (5%, 39 files) | Migrate minority                 |
| Toast           | sonner (158 files)          | useToast (3 files)            | Remove @radix-ui/react-toast dep |
| Forms           | Manual useState             | react-hook-form (4 imports)   | Standardize on react-hook-form   |
| Supabase access | supabase.from() (1,952)     | untypedFrom() + as any (85)   | Regenerate types                 |

---

## Part 4: Database Architecture

### CRITICAL: Security

**1 table without RLS:** `email_access_log` — publicly accessible audit data.

### CRITICAL: Schema Width

| Table               | Columns | Risk                          |
| ------------------- | ------- | ----------------------------- |
| **listings**        | **200** | Extreme — needs normalization |
| **profiles**        | **97**  | High                          |
| **buyers**          | **94**  | High                          |
| remarketing_buyers  | 85      | High                          |
| connection_requests | 65      | Moderate                      |

### HIGH: Missing Indexes (30 FK columns)

Key offenders: `connection_requests` (7 unindexed FKs), `alert_delivery_logs` (3), `buyer_learning_history` (2)

### Migration Sprawl

**924 migrations** from July 2025 to April 2026. Duplicate timestamps required manual renaming. No consolidation strategy.

### Edge Function Status

| Category                           | Count |
| ---------------------------------- | ----- |
| Active, called by cron or frontend | ~80   |
| Deprecated stubs                   | 19    |
| Total directories                  | ~120  |

---

## Part 5: Dependencies

### Security Vulnerabilities: 28 total

**CRITICAL (fix this week):**

- react-router-dom ≤6.30.2 — XSS via open redirects (17 high)
- dompurify 3.3.1 — 5 XSS vulnerabilities (used for HTML sanitization!)
- undici — HTTP parsing + memory exhaustion
- xlsx (SheetJS) — Prototype pollution, NO FIX available

**Moderate (fix this month):** 9 issues in babel, eslint, ajv, yaml

### Duplicate Purpose Packages

- `sonner` + `@radix-ui/react-toast` — both installed, only sonner used. Remove radix toast.

### Heavy Single-Feature Packages

- `@tiptap/*` (9 packages) — rich text editor, only used for deal memos
- `mapbox-gl` — map component, limited usage
- `recharts` — charts, analytics pages only

---

## Recommended Cleanup Plan

### Week 1: Security

1. `npm audit fix` for all auto-fixable vulnerabilities
2. Update dompurify to latest (XSS in HTML sanitizer is critical)
3. Update react-router-dom to ≥6.30.3
4. Add RLS to `email_access_log` table
5. Review xlsx usage — add file validation on upload

### Week 2: Dead Code Removal

1. Delete 19 deprecated edge function stubs
2. Delete or integrate 10 orphaned test pages (5,575 lines)
3. Delete confirmed orphaned analytics hooks (~4,000 lines)
4. Remove `@radix-ui/react-toast` from package.json

### Week 3: Data Cleanup

1. Clean "-" and empty string company names in listings (16 records)
2. Review and merge duplicate company listings
3. Investigate deal_pipeline 95% soft-delete rate
4. Clean the 1 orphaned deal_pipeline record
5. Add missing indexes on 30 FK columns (single migration)

### Sprint 2: Architecture

1. Refactor DocumentTrackingPage (1,432 → ~400 lines + 5 extracted files)
2. Refactor ClientPortalDetail (1,070 → ~500 lines + 3 extracted files)
3. Refactor RecommendedBuyersTab (1,209 → ~500 lines + 4 extracted files)
4. Extract US states/provinces data from CompanyOverviewCard (500 lines → constants file)

### Sprint 3: Standardization

1. Migrate 39 files from useState+fetch to useQuery
2. Regenerate Supabase types to reduce untypedFrom/as any usage
3. Document form handling patterns (react-hook-form standard)
4. Organize hooks folder by domain

### Defer / Leave Alone

- 77 empty database tables — document purpose but don't drop (some may be upcoming features)
- 141 medium-large components (300-500 lines) — monitor, split only when they grow
- Migration consolidation — too risky, leave as-is
- listings table 200 columns — massive refactor, defer until it causes real perf issues
