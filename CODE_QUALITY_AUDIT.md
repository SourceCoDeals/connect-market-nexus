# SourceCo Platform — Code Quality & Refactoring Audit Report

**Date:** March 1, 2026
**Scope:** Full codebase — 1,301 source files (src/), 158 edge functions (supabase/functions/), ~279,280 lines of frontend code
**Mode:** Read-only diagnostic. No changes made.

---

## PHASE 1 — DEAD CODE DETECTION

### 1.1 Orphaned React Components

**SmartleadEmailHistory** — CONFIRMED DELETED. No file with this name exists anywhere in the codebase. Previously reported as orphaned; has been removed. ✅

**Confirmed orphaned components:**

| File Path | Lines | What It Does | Safe to Delete? |
|-----------|-------|-------------|----------------|
| `src/pages/admin/AdminUsers.tsx` | 366 | Superseded user management page (replaced by MarketplaceUsersPage + OwnerLeadsPage) | Risky — verify replacements cover all cases |
| `src/pages/admin/ma-intelligence/AllDeals.tsx` | 17 | Self-labeled DEPRECATED redirect stub | **Yes** |
| `src/pages/admin/ma-intelligence/DealDetail/` (index + 3 sub-files) | ~600 total | MA Intel deal detail, superseded by ReMarketingDealDetail | Likely yes — confirm no lingering deep-links |
| `src/components/auth/AuthFlowManager.tsx` | 9 | No-op passthrough (`return <>{children}</>`), zero imports | **Yes** |
| `src/components/admin/PipelineMetricsCard.tsx` | 9 | Returns null, imported but contributes nothing to render tree | **Yes** (+ 1-line cleanup in AdminRequests.tsx) |
| `src/components/admin/ListingForm.tsx` | 14 | Thin shim forwarding to ImprovedListingEditor | Conditionally — update consumer import |
| `src/components/admin/UserViewSwitcher.tsx` | 80 | Only used by orphaned AdminUsers.tsx | **Yes** if AdminUsers is deleted |
| `src/routes/admin-routes.tsx` | 373 | **ENTIRE FILE IS ORPHANED** — complete duplicate router definition that is never mounted. App.tsx defines all routes inline. | **Yes** |

### 1.2 Dead Utility Functions & Hooks

**28 dead hooks across 20+ files** and **10 dead library files** confirmed. The `src/hooks/index.ts` barrel file is never imported from outside `src/hooks/` — every hook exported exclusively through it is dead.

**Dead Hooks (entire files — safe to delete):**

| File | Function(s) | Reason Dead |
|------|------------|-------------|
| `src/hooks/use-revenue-optimization.ts` | `useRevenueOptimization` | Only in barrel; zero consumers |
| `src/hooks/use-predictive-user-intelligence.ts` | `usePredictiveUserIntelligence` | Only in barrel; zero consumers |
| `src/hooks/use-simple-marketplace-analytics.ts` | `useSimpleMarketplaceAnalytics`, `useAnalyticsHealthCheck` | Only in barrel |
| `src/hooks/use-smart-alerts.ts` | `useSmartAlerts` | Only in barrel |
| `src/hooks/use-enhanced-feedback.ts` | `useEnhancedFeedback` | Only in barrel |
| `src/hooks/use-role-access.ts` | `useRoleAccess` | Zero real consumers |
| `src/hooks/use-search-param-state.ts` | `useSearchParamState` | Zero consumers |
| `src/hooks/use-signup-analytics.ts` | `useSignupAnalytics` | Only in barrel |
| `src/hooks/useAutoEnrichment.ts` | `useAutoEnrichment` | Stub with `_config` param; never used |
| `src/hooks/useRealTimeAnalytics.ts` | `useRealTimeAnalytics` | Superseded by `useEnhancedRealTimeAnalytics` |
| `src/hooks/useTrafficAnalytics.ts` | `useTrafficAnalytics` | Only in barrel |
| `src/hooks/useEngagementAnalytics.ts` | `useEngagementAnalytics` | Only in barrel |
| `src/hooks/useSearchAnalytics.ts` | `useSearchAnalytics` | Only in barrel |
| `src/hooks/useGeographicAnalytics.ts` | `useGeographicAnalytics` | Only in barrel |
| `src/hooks/useHistoricalMetrics.ts` | `useHistoricalMetrics` | Only in barrel |
| `src/hooks/useBuyerIntentAnalytics.ts` | `useBuyerIntentAnalytics` | Only in barrel |
| `src/hooks/useCampaignAttribution.ts` | `useCampaignAttribution` | Only in barrel |
| `src/hooks/useExitAnalysis.ts` | `useExitAnalysis` | Only in barrel |
| `src/hooks/useUserJourneys.ts` | `useUserJourneys`, `useJourneyDetail` | Only in barrel |
| `src/hooks/useJourneyMilestones.ts` | `useJourneyMilestones` | Only in barrel |
| `src/hooks/useListingHealth.ts` | `useListingHealth` | Only in barrel |
| `src/hooks/useOptimisticUpdate.ts` | `useOptimisticUpdate` | Only in barrel |
| `src/hooks/useRetryQuery.ts` | `useRetryQuery`, `useResilientQuery` | Zero consumers |
| `src/hooks/useSecureForm.ts` | `useSecureForm` | Zero consumers |
| `src/hooks/useVirtualList.ts` | `useVirtualList` | Zero consumers |
| `src/hooks/useDebouncedValue.ts` | `useDebouncedValue`, `useDebouncedCallback` | Zero consumers |
| `src/hooks/use-mobile-gestures.tsx` | `useSwipeGesture`, `useLongPress`, `triggerHaptic`, `usePullToRefresh` | Entire file dead |
| `src/hooks/use-mobile-performance.tsx` | `useLazyComponent`, `usePerformanceMetrics`, `useOptimizedQuery`, `useNetworkAwareLoading`, `useMobileTableOptimization` | Entire file dead |

**Dead Library Files (entire files — safe to delete):**

| File | Key Exports | Reason Dead |
|------|------------|-------------|
| `src/lib/auth-cleanup.ts` | `cleanupAuthState` | Duplicate — `auth-helpers.ts` exports its own version |
| `src/lib/auth-guard.ts` | `requireAuth`, `requireAdmin`, `requireRole` + 6 more | Zero imports; route protection uses `ProtectedRoute.tsx` instead |
| `src/lib/data-sync.ts` | `isOnline`, `queueOfflineAction`, `flushOfflineQueue` + 3 more | Offline queue system never wired into the app |
| `src/lib/data-validation.ts` | `dealSchema`, `profileSchema`, `validateDeal` + 3 more | Zero imports; validation done inline via Zod per-component |
| `src/lib/database.ts` | `safeQuery`, `fetchRows`, `fetchById` + 6 more | App queries Supabase directly; this abstraction was never adopted |
| `src/lib/invariant.ts` | `invariant`, `softInvariant` | Zero imports |
| `src/lib/migrations.ts` | `MIGRATION_HISTORY`, `KEY_TABLES` + 3 more | Documentation stored as constants; zero imports |
| `src/lib/retry.ts` | `retryWithBackoff`, `retryPredicates` | Zero imports; hooks-layer `use-retry.ts` is used instead |
| `src/lib/rls-security-audit.ts` | `RLS_AUDIT_VERSION`, `RLS_AUDIT_STATUS` | Audit constants stored as code; zero imports |
| `src/lib/security-headers.ts` | `CSP_DIRECTIVES`, `buildCspString` + 4 more | Build-time concerns never called from React app |

**Dead interface field:**

| File | Field | Reason Dead |
|------|-------|-------------|
| `src/hooks/admin/use-deals.ts:91` | `next_followup_due` in DealRecord interface | Defined but never populated or read by any component |

### 1.3 Dead Edge Functions

**75 of 158 edge functions (47%) are never called from the frontend via `supabase.functions.invoke()`.**

Some of these may be called by webhooks, other edge functions, or database triggers. Each must be verified before deletion. Functions marked with ⚠️ are likely webhook-triggered and should be verified, not deleted blindly.

| Function Name | Called From Frontend | Status |
|--------------|---------------------|--------|
| `admin-digest` | No | Dead candidate |
| `admin-notification` | No | Dead candidate |
| `aggregate-daily-metrics` | No | Dead candidate (likely cron) |
| `ai-command-center` | No (called via different mechanism?) | **Verify** |
| `analyze-deal-notes` | No | Dead candidate |
| `analyze-seller-interest` | No | Dead candidate |
| `apify-google-reviews` | No | Dead candidate |
| `apify-linkedin-scrape` | No | Dead candidate |
| `approve-referral-submission` | No | Dead candidate |
| `auto-pair-all-fireflies` | No | Dead candidate |
| `bulk-import-remarketing` | No | Dead candidate |
| `bulk-sync-all-fireflies` | No | Dead candidate |
| `clarify-industry` | No | Dead candidate |
| `create-lead-user` | No | Dead candidate |
| `data-room-download` | No | Dead candidate |
| `data-room-upload` | No | Dead candidate |
| `docuseal-webhook-handler` | No | ⚠️ Webhook-triggered — Keep |
| `enrich-geo-data` | No | Dead candidate |
| `enrich-list-contacts` | No | Dead candidate |
| `enrich-session-metadata` | No | Dead candidate |
| `error-logger` | No | Dead candidate |
| `extract-buyer-criteria` | No | Dead candidate |
| `extract-buyer-criteria-background` | No | Dead candidate |
| `extract-buyer-transcript` | No | Dead candidate |
| `extract-deal-transcript` | No | Dead candidate |
| `find-contacts` | No | Dead candidate |
| `firecrawl-scrape` | No | Dead candidate |
| `generate-buyer-universe` | No | Dead candidate |
| `generate-guide-pdf` | No | Dead candidate |
| `generate-ma-guide-background` | No | Dead candidate |
| `generate-research-questions` | No | Dead candidate |
| `get-document-download` | No | Dead candidate |
| `get-feedback-analytics` | No | Dead candidate |
| `heyreach-campaigns` | No | Dead candidate (called via hook wrapper) |
| `heyreach-leads` | No | Dead candidate (called via hook wrapper) |
| `heyreach-webhook` | No | ⚠️ Webhook-triggered — Keep |
| `import-reference-data` | No | Dead candidate |
| `notify-buyer-new-message` | No | Dead candidate (likely DB trigger) |
| `notify-remarketing-match` | No | Dead candidate |
| `otp-rate-limiter` | No | Dead candidate |
| `parse-scoring-instructions` | No | Dead candidate |
| `parse-tracker-documents` | No | Dead candidate |
| `phoneburner-oauth-callback` | No | ⚠️ OAuth callback — Verify |
| `phoneburner-push-contacts` | No | Dead candidate |
| `phoneburner-webhook` | No | ⚠️ Webhook-triggered — Keep |
| `process-buyer-universe-queue` | No | Dead candidate |
| `process-ma-guide-queue` | No | Dead candidate |
| `process-standup-webhook` | No | ⚠️ Webhook-triggered — Keep |
| `publish-listing` | No (called via hook wrapper) | **Verify** — `use-publish-listing.ts` calls it |
| `rate-limiter` | No | Dead candidate (likely middleware) |
| `record-data-room-view` | No | Dead candidate |
| `record-link-open` | No | Dead candidate |
| `reset-agreement-data` | No | Dead candidate |
| `salesforce-remarketing-webhook` | No | ⚠️ Webhook-triggered — Keep |
| `score-buyer-deal` | No | Dead candidate |
| `score-industry-alignment` | No | Dead candidate |
| `security-validation` | No | Dead candidate |
| `send-deal-referral` | No | Dead candidate |
| `send-fee-agreement-reminder` | No | Dead candidate |
| `send-nda-reminder` | No | Dead candidate |
| `send-password-reset-email` | No | Dead candidate |
| `send-simple-verification-email` | No | Dead candidate |
| `send-templated-approval-email` | No | Dead candidate |
| `send-verification-email` | No | Dead candidate |
| `session-security` | No | Dead candidate |
| `smartlead-campaigns` | No | Dead candidate (called via hook wrapper) |
| `smartlead-webhook` | No | ⚠️ Webhook-triggered — Keep |
| `submit-referral-deal` | No | Dead candidate |
| `sync-missing-profiles` | No | Dead candidate |
| `sync-standup-meetings` | No | Dead candidate |
| `test-contact-enrichment` | No | Dead candidate (test function) |
| `track-engagement-signal` | No | Dead candidate |
| `user-journey-notifications` | No | Dead candidate |
| `verify-platform-website` | No | Dead candidate |

**Corrections:** `publish-listing`, `heyreach-campaigns`, `heyreach-leads`, `smartlead-campaigns` are called from frontend via hook wrappers. `clarify-industry`, `data-room-download`, `data-room-upload`, `ai-command-center`, and `generate-guide-pdf` are called via raw `fetch()` URLs (not `supabase.functions.invoke()`). These are all ACTIVE.

**Adjusted counts:**
- ~26 confirmed dead (safe to delete)
- ~6 likely cron/external-webhook-only (keep but document)
- ~35 need manual verification before deletion

### 1.4 Dead Database Columns

| Table | Column | Status | Evidence |
|-------|--------|--------|----------|
| deals (interface) | `deal_score` | **ACTIVE** | Used in 5+ pipeline components (PipelineKanbanCard, PipelineListView, PipelineDetailOverview) |
| deals (interface) | `next_followup_due` | **DEAD** | Defined in `use-deals.ts:91` interface only. Never populated, never read by any component |

> **Note:** Full dead-column analysis requires database schema introspection (not available in this frontend-only audit). Columns with `_old`, `_backup`, `_temp`, `_v2`, `_test` suffixes were not found referenced in frontend code — a DB schema dump is needed to identify these.

### 1.5 Dead Routes

All routes defined in `src/App.tsx` (lines 255–440) point to valid, existing components. No dead routes found.

Notable redirects (intentional, not dead):
- `/my-requests` → `/my-deals` (line 287)
- `/marketplace` → `/` (line 291)
- `/admin/remarketing/deals` → `/admin/deals` (line 390)

### 1.6 Commented-Out Code

Systematic scan needed. Manual sampling found commented code in several large files. A targeted `grep` for 5+ consecutive comment lines is recommended with proper tooling.

---

## PHASE 2 — DUPLICATE CODE DETECTION

### 2.1 Copy-Pasted Components

**20+ duplicate component filenames plus 6 additional near-identical component pairs.** This is the single largest code quality issue in the codebase.

**Duplicate filename pairs (same name, different directories):**

| Component A | Component B | Overlap | Merge Strategy |
|------------|------------|---------|---------------|
| `src/components/remarketing/AddDealDialog.tsx` (874 lines) | `src/pages/admin/remarketing/GPPartnerDeals/AddDealDialog.tsx` (144 lines) | High — same entity, different contexts | Keep remarketing version as authoritative; GP version is a lightweight variant — consider parameterizing |
| `src/components/remarketing/BuyerTableRow.tsx` (306 lines) | `src/pages/admin/remarketing/ReMarketingBuyers/BuyerTableRow.tsx` (296 lines) | ~95% — nearly identical buyer row rendering | **Critical merge target** — extract shared BuyerTableRow with context-specific props |
| `src/components/remarketing/DealCSVImport.tsx` (663 lines) | `src/components/ma-intelligence/DealCSVImport.tsx` (207 lines) | Moderate — same CSV import pattern, different data shapes | Extract shared CSV import infrastructure |
| `src/components/remarketing/StructuredCriteriaPanel.tsx` (540 lines) | `src/components/ma-intelligence/StructuredCriteriaPanel.tsx` (476 lines) | High — same criteria panel logic | **Critical merge target** — parameterize for context |
| `src/components/remarketing/ScoringBehaviorPanel.tsx` (169 lines) | `src/components/ma-intelligence/ScoringBehaviorPanel.tsx` (339 lines) | Moderate — same concept, different implementations | Consolidate into ma-intelligence version |
| `src/components/remarketing/IntelligenceBadge.tsx` (168 lines) | `src/components/ma-intelligence/IntelligenceBadge.tsx` (154 lines) | High — same badge rendering | Merge into shared component |
| `src/components/remarketing/PassReasonDialog.tsx` (118 lines) | `src/components/ma-intelligence/PassReasonDialog.tsx` (189 lines) | High — same pass-reason modal | Merge into shared component |
| `src/components/deals/DealActivityLog.tsx` (157 lines) | `src/components/remarketing/deal-detail/DealActivityLog.tsx` (314 lines) | Moderate — same activity log, remarketing version is richer | Keep remarketing version, delete deals version if unused |
| `src/components/deals/DealDetailHeader.tsx` (291 lines) | `src/pages/admin/ma-intelligence/DealDetail/DealDetailHeader.tsx` (173 lines) | Moderate — different header layouts for same entity | MA Intelligence DealDetail is orphaned — delete |
| `src/components/admin/ConnectionRequestDialog.tsx` (132 lines) | `src/components/connection/ConnectionRequestDialog.tsx` (222 lines) | High — same dialog | Merge — keep connection version |
| `src/components/admin/DuplicateWarningDialog.tsx` (129 lines) | `src/components/admin/CreateDealModal/DuplicateWarningDialog.tsx` (69 lines) | Moderate | Keep larger version |
| `src/components/ErrorBoundary.tsx` (186 lines) | `src/components/common/ErrorBoundary.tsx` (204 lines) | High — duplicate error boundary | Keep `ErrorBoundary.tsx` (imported by App.tsx); delete common/ version |
| `src/components/remarketing/BuyerCSVImport/ColumnMappingStep.tsx` (123 lines) | `src/components/remarketing/csv-import/ColumnMappingStep.tsx` (182 lines) | High — duplicate CSV mapping | Merge into csv-import version |
| `src/components/admin/data-room/DataRoomTab.tsx` (78 lines) | `src/pages/admin/remarketing/ReMarketingDealDetail/DataRoomTab.tsx` (132 lines) | Moderate | Verify usage; merge if possible |
| `src/pages/admin/remarketing/PEFirmDetail/ContactsTab.tsx` (146 lines) | `src/pages/admin/remarketing/ReMarketingBuyerDetail/ContactsTab.tsx` (115 lines) | Moderate — same tab, different entity contexts | Extract shared contacts tab with entity type prop |
| `src/pages/admin/remarketing/PEFirmDetail/AddContactDialog.tsx` (116 lines) | `src/pages/admin/remarketing/ReMarketingBuyerDetail/AddContactDialog.tsx` (110 lines) | High — structurally identical, only differs in prop naming | Merge — extract shared dialog |
| `src/pages/admin/remarketing/PEFirmDetail/IntelligenceTab.tsx` (154 lines) | `src/pages/admin/remarketing/ReMarketingBuyerDetail/IntelligenceTab.tsx` (132 lines) | High | Merge — extract shared tab |
| `src/components/remarketing/buyer-detail/KeyQuotesCard.tsx` (63 lines) | `src/components/remarketing/deal-detail/KeyQuotesCard.tsx` (259 lines) | Low — buyer version is read-only subset of deal version | Deal version extends buyer version with edit dialog |
| `src/components/ma-intelligence/tracker/AddBuyerDialog.tsx` (223 lines) | `src/pages/admin/remarketing/ReMarketingBuyers/AddBuyerDialog.tsx` (159 lines) | Moderate | Extract shared buyer creation dialog |

**Additional near-identical component pairs (different names, same structure):**

| Component A | Component B | Overlap | Merge Strategy |
|------------|------------|---------|---------------|
| `src/pages/admin/remarketing/components/DealsKPICards.tsx` | `src/pages/admin/remarketing/GPPartnerDeals/GPPartnerKPICards.tsx` | **~99%** — identical 4-card grid with same props, only component name and one bg color differ | Parameterize into single `KPICards` component |
| `src/components/admin/DualNDAToggle.tsx` | `src/components/admin/DualFeeAgreementToggle.tsx` | ~95% — only field names and accent color differ | Single `DualAgreementToggle` with `agreementType` prop |
| `src/components/admin/SimpleNDADialog.tsx` | `src/components/admin/SimpleFeeAgreementDialog.tsx` | ~95% — same dialog, different document type label | Single `SimpleAgreementDialog` |
| `src/components/remarketing/PushToHeyreachModal.tsx` (211 lines) | `src/components/remarketing/PushToSmartleadModal.tsx` (208 lines) | **~98%** — line-for-line identical, only service name and icon differ | Single `PushToOutreachModal` with service prop |
| `src/components/deal-alerts/CreateDealAlertDialog.tsx` | `src/components/deal-alerts/EditDealAlertDialog.tsx` | High — same form fields, same filter chip rendering | Extract shared `DealAlertForm` |
| `src/components/admin/analytics/HeroStatsSection.tsx` (internal StatCard) | `src/components/admin/analytics/StripeStatsSection.tsx` (internal StatCard) | High — both define local StatCard | Import from `src/components/ma-intelligence/StatCard.tsx` which already exists as a reusable version |

### 2.2 Duplicate Edge Function Logic

See Phase 6.2 for shared logic analysis. Key duplicates:

| Pattern | Functions | Action |
|---------|----------|--------|
| Supabase client initialization | 144 functions | Extract to `_shared/supabase-client.ts` |
| JWT/Auth verification | 67 functions | Extract to `_shared/auth.ts` |
| Firecrawl scraping | `enrich-buyer`, `enrich-deal`, `firecrawl-scrape` | Consolidate scraping logic |
| Fireflies API calls | `auto-pair-all-fireflies`, `bulk-sync-all-fireflies`, `sync-fireflies-transcripts`, `extract-standup-tasks` | Extract shared Fireflies client |
| DocuSeal API calls | `create-docuseal-submission`, `confirm-agreement-signed`, `auto-create-firm-on-approval`, `docuseal-integration-test` | Extract shared DocuSeal client |
| Email sending (Resend/Brevo) | 15+ `send-*` functions | Extract shared email sender utility |

### 2.3 Duplicate API Call Patterns

Top duplicated Supabase query patterns (confirmed via grep):

| Query Pattern | Estimated File Count | Consolidation Target |
|--------------|---------------------|---------------------|
| `supabase.from('remarketing_buyers').select(...)` | 15+ files | `useReMarketingBuyers()` hook |
| `supabase.from('buyer_deal_scores').select(...)` | 10+ files (BuyerActivitySection, DealMatchedBuyersTab, etc.) | `useBuyerDealScores()` hook |
| `supabase.from('deals').select(...)` (various) | 20+ files | Centralize in deal service |
| `supabase.from('connections').select(...)` | 8+ files | `useConnections()` hook |
| `supabase.functions.invoke(...)` patterns | 80+ call sites | Already uses hooks in some places; inconsistent |

### 2.4 Duplicate Type Definitions

| Type Name | Files Defined In | Differences | Fix |
|-----------|-----------------|-------------|-----|
| `DealTranscript` | 4 files: `DealTranscriptSection/types.ts`, `TranscriptListItem.tsx` (local), `lib/ma-intelligence/types.ts`, `pages/admin/remarketing/types.ts` | First 3 share 18 fields; `ma-intelligence` version has different shape (`deal_id`, `transcript_type`) | Canonical in `DealTranscriptSection/types.ts` |
| `BuyerRow` | 3+ files: `BuyerTableEnhanced.tsx`, `BuyerTableRow.tsx`, `AllBuyers.tsx`, `types/supabase-helpers.ts` | ~15 overlapping fields with slight variations | Use `TableRow<'buyers'>` from supabase-helpers |
| `OutreachRecord` | 4 files: `EngagementHeatmapInsight.tsx` (2 fields), `IntroductionStatusCard.tsx` (6 fields), `OutreachTimeline.tsx` (8 fields), `lib/ma-intelligence/types.ts` | Progressively larger supersets | Canonical in `lib/ma-intelligence/types.ts` |
| `EnrichmentProgress` | 5+ files: `TrackerBuyersTab.tsx`, `BuyerTableToolbar.tsx`, `useBuyerEnrichment.ts`, `useEnrichmentProgress.ts`, `lib/ma-intelligence/types.ts` | Completely different shapes across files | Consolidate into single definition |
| `SortDirection` | **10 files** — defined as `type SortDirection = "asc" \| "desc"` locally in every table component | Identical one-liner copied everywhere | Extract to shared types file |
| `StatCardProps` | 3 files: `HeroStatsSection.tsx`, `StripeStatsSection.tsx`, `ma-intelligence/StatCard.tsx` | Nearly identical | Import from `StatCard.tsx` |

> **Note:** The auto-generated `src/integrations/supabase/types.ts` (14,870 lines) serves as the canonical DB type source. Many components define local interfaces that partially overlap with these generated types.

### 2.5 Duplicate Constants & Status Strings

**`formatCurrency` — the most duplicated function in the codebase:**

Defined locally in **35 files** despite 3 canonical versions existing in `src/lib/`. Most are copy-pasted variants of the same million/thousand formatting logic. All 35 files should import from `src/lib/currency-utils.ts`.

**Other duplicated constants:**

| Constant | Files | Fix |
|----------|-------|-----|
| `US_STATES` array (50 states) | 3 files — `StructuredCriteriaPanel.tsx`, `CompanyOverviewCard.tsx`, `GeographicCoverageCard.tsx` | Canonical exists at `lib/ma-intelligence/normalizeGeography.ts` as `ALL_US_STATES` |
| `BUYER_TYPE_OPTIONS` / `BUYER_TYPES` | **7+ files** with conflicting key schemas (camelCase in Marketplace, snake_case in Remarketing) | Create single source of truth with adapter |
| `BUYER_TYPE_LABELS` | 3+ files with conflicting abbreviations | Consolidate |
| `DEFAULT_WEIGHTS` (scoring) | 3 files — `ScoringBehaviorPanel.tsx`, `TrackerScoringBehaviorTab.tsx`, `TrackerDetail.tsx` | Extract to shared scoring constants |
| `STATUS_OPTIONS` (owner leads) | 2 files — `OwnerLeadsFilters.tsx`, `OwnerLeadsTableContent.tsx` — same 7-value list | Extract to constants |

**Status string inconsistencies:**

| Concept | Variants Found | Canonical Value |
|---------|---------------|----------------|
| Pending | `'pending'` (236), `"pending"` (37), `'Pending'` (7), `"Pending"` (2) | `'pending'` |
| Approved | `'approved'` (168), `"approved"` (32), `'Approved'` (10), `"Approved"` (2), `'accepted'` (2) | `'approved'` |
| Active | `'active'` (157), `"active"` (46), `'Active'` (7), `"Active"` (6) | `'active'` |
| Rejected concept | `'rejected'` (46), `'passed'` (31), `'not_a_fit'` (20), `'declined'` (19) | Different meanings in different contexts — needs documented taxonomy |
| Completed | `'completed'` (82), `'complete'` (13), `'done'` (1) | `'completed'` |
| Failed | `'failed'` (82), `'fail'` (20), `'error'` (35) | `'failed'` |
| Draft | `'draft'` (1), `'DRAFT'` (HeyReach), `'DRAFTED'` (Smartlead) | Needs adapter layer per service |

**282+ total inconsistent status string usages.** These should be constants:
```typescript
// src/constants/statuses.ts
export const STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  ACTIVE: 'active',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;
```

---

## PHASE 3 — MONOLITH DETECTION & DECOMPOSITION PLAN

### 3.1 File Size Audit

| Threshold | Count |
|-----------|-------|
| Files over 200 lines | **487** (37% of codebase) |
| Files over 400 lines | **148** (confirmed monoliths) |
| Files over 600 lines | **43** (critical monoliths) |

### 3.2 Top Critical Monoliths (600+ lines, frontend)

| File Path | Lines | What It Contains | Decomposition Needed |
|-----------|-------|-----------------|---------------------|
| `src/integrations/supabase/types.ts` | 14,870 | Auto-generated DB types | No — generated file |
| `src/pages/admin/chatbot-test-runner/chatbotTestScenarios.ts` | 3,326 | Test scenario definitions | Low priority — test file |
| `src/pages/admin/remarketing/ReMarketingUniverses.tsx` | 1,431 | Universe management page | **YES** — extract table, filters, modals |
| `src/components/admin/ConnectionRequestActions.tsx` | 1,276 | Connection request action handlers | **YES** — extract into separate action components |
| `src/pages/admin/system-test-runner/testDefinitions.ts` | 1,255 | Test definitions | Low priority — test file |
| `src/pages/BuyerMessages/MessageThread.tsx` | 1,224 | Message thread UI | **YES** — extract message list, input, attachments |
| `src/hooks/admin/use-deals.ts` | 1,040 | Deal data hook — fetching, filtering, mutations, scoring | **YES — GOD HOOK** — split into `useDealQueries`, `useDealMutations`, `useDealFilters` |
| `src/components/admin/ConnectionRequestsTable.tsx` | 1,000 | Connection requests table | **YES** — extract row components, filters |
| `src/components/ai-command-center/AICommandCenterPanel.tsx` | 996 | AI chat panel UI | **YES** — extract message list, input, tool renders |
| `src/pages/admin/remarketing/ValuationLeads/useValuationLeadsData.ts` | 988 | Valuation leads data hook | **YES — GOD HOOK** |
| `src/components/remarketing/deal-detail/ContactHistoryTracker.tsx` | 981 | Contact history tracker | **YES** — extract timeline, filters, actions |
| `src/components/admin/data-room/AccessMatrixPanel.tsx` | 887 | Access matrix UI | **YES** — extract matrix grid, permission rows |
| `src/components/remarketing/AddDealDialog.tsx` | 874 | Add deal modal | **YES** — extract form sections, validation |
| `src/components/remarketing/AddDealToUniverseDialog.tsx` | 853 | Add deal to universe modal | **YES** — extract form, search, preview |
| `src/pages/admin/remarketing/ReMarketingUniverseDetail/index.tsx` | 834 | Universe detail page | **YES** — extract tabs, header, actions |
| `src/components/admin/BulkDealImportDialog.tsx` | 818 | Bulk import modal | **YES** — extract steps, mapping, preview |
| `src/components/remarketing/DealImportDialog.tsx` | 815 | Deal import modal | **YES** — duplicate of BulkDealImportDialog? |
| `src/components/remarketing/BuyerMatchCard.tsx` | 803 | Buyer match card | **YES** — extract score display, actions, details |
| `src/lib/migrations.ts` | 799 | DB migration logic | Review — may be legacy |
| `src/components/remarketing/deal-detail/CompanyOverviewCard.tsx` | 790 | Company overview | **YES** — extract info sections |
| `src/pages/admin/remarketing/ReMarketingDeals/index.tsx` | 773 | Deals list page | **YES** — extract table, filters, actions |
| `src/components/admin/UnifiedAdminSidebar.tsx` | 762 | Admin navigation sidebar | **YES** — extract nav sections, menu items |
| `src/components/ma-intelligence/BuyerContactsTab.tsx` | 758 | Buyer contacts tab | **YES** — extract contact list, search |
| `src/pages/admin/remarketing/GPPartnerDeals/useGPPartnerDeals.ts` | 742 | GP partner deals hook | **YES — GOD HOOK** |
| `src/hooks/useEnhancedRealTimeAnalytics.ts` | 739 | Real-time analytics hook | **YES — GOD HOOK** |
| `src/components/remarketing/UniverseDealsTable.tsx` | 732 | Universe deals table | **YES** — extract columns, row actions |
| `src/pages/MyRequests.tsx` | 728 | My requests page | **YES** — extract tabs, deal cards |
| `src/pages/admin/remarketing/CapTargetDeals/useCapTargetActions.ts` | 674 | CapTarget actions hook | **YES — GOD HOOK** |
| `src/components/remarketing/DealCSVImport.tsx` | 663 | CSV import | **YES** — extract steps |
| `src/pages/admin/remarketing/ReMarketingDashboard.tsx` | 657 | Dashboard page | **YES** — extract widgets, metrics |
| `src/App.tsx` | 656 | Root app with routes | **YES** — extract route config to separate file |
| `src/lib/financial-parser.ts` | 653 | Financial parsing logic | Review — may be appropriate size for complexity |
| `src/pages/PendingApproval.tsx` | 648 | Pending approval page | **YES** — unexpectedly large |
| `src/hooks/useAICommandCenter.ts` | 634 | AI command center hook | **YES — GOD HOOK** — manages chat state, API calls, tool handling |
| `src/hooks/admin/data-room/use-data-room.ts` | 629 | Data room hook | **YES — GOD HOOK** |
| `src/components/admin/StageManagementModal.tsx` | 627 | Stage management modal | **YES** — extract form, stage list |
| `src/pages/admin/DocumentTrackingPage.tsx` | 622 | Document tracking page | **YES** — extract table, filters |
| `src/pages/admin/remarketing/DailyTaskDashboard.tsx` | 619 | Daily task dashboard | **YES** — extract task cards, filters |

### 3.2.1 Edge Function Monoliths (300+ lines)

**60 edge functions exceed 300 lines.** Top 20:

| Function | Lines | What It Contains | Should Split? |
|----------|-------|-----------------|--------------|
| `generate-ma-guide` | 1,500 | M&A guide generation — AI prompting, PDF assembly, data gathering | **YES** — split into data-gather, AI-generate, PDF-format |
| `apify-linkedin-scrape` | 1,027 | LinkedIn scraping via Apify | Review — may be complex by nature |
| `extract-deal-transcript` | 920 | Transcript extraction and parsing | **YES** — split parsing from extraction |
| `extract-transcript` | 910 | Generic transcript extraction | Likely duplicate of above — verify |
| `enrich-deal` | 857 | Deal enrichment — scraping, parsing, AI analysis | **YES** — at least 3 concerns |
| `bulk-sync-all-fireflies` | 839 | Bulk Fireflies sync | **YES** — extract individual sync |
| `bulk-import-remarketing` | 756 | Bulk remarketing import | **YES** — extract parsing, validation |
| `score-buyer-deal` | 733 | Buyer-deal scoring | **YES** — extract dimension calculators |
| `enrich-buyer` | 730 | Buyer enrichment | **YES** — extract scraping, parsing, storage |
| `sync-captarget-sheet` | 695 | CapTarget sheet sync | Review |
| `calculate-deal-quality` | 677 | Deal quality calculation | **YES** — extract metrics |
| `map-csv-columns` | 646 | CSV column mapping | Review |
| `process-enrichment-queue` | 603 | Enrichment queue processing | **YES** — extract individual item processor |
| `extract-standup-tasks` | 595 | Standup task extraction | Review |
| `extract-buyer-transcript` | 590 | Buyer transcript extraction | Likely overlaps with `extract-transcript` |
| `extract-buyer-criteria` | 573 | Buyer criteria extraction | Review |
| `docuseal-webhook-handler` | 554 | DocuSeal webhook handling | **YES** — extract event handlers |
| `generate-lead-memo` | 552 | Lead memo generation | Review |
| `phoneburner-webhook` | 546 | PhoneBurner webhook | **YES** — extract event handlers |
| `auto-pair-all-fireflies` | 530 | Fireflies auto-pairing | Review |

### 3.3 Shadow / Duplicate Component Problem

| Component Name | Files Found | Which Is Rendered | Orphaned Files |
|---------------|------------|-------------------|----------------|
| `ReMarketingDealDetail` | `src/pages/admin/remarketing/ReMarketingDealDetail/index.tsx` (191 lines) + 10 sub-files | `index.tsx` via App.tsx:148 | **None — properly decomposed** ✅ |
| `ErrorBoundary` | `src/components/ErrorBoundary.tsx` (186 lines), `src/components/common/ErrorBoundary.tsx` (204 lines) | `src/components/ErrorBoundary.tsx` (imported in App.tsx:14) | `src/components/common/ErrorBoundary.tsx` — **ORPHANED** |
| `DealDetailHeader` | `src/components/deals/DealDetailHeader.tsx` (291 lines), `src/pages/admin/ma-intelligence/DealDetail/DealDetailHeader.tsx` (173 lines) | Verify both import chains | One may be orphaned |

**ReMarketingDealDetail Status:** The previously-reported "4-tab monolith" has been decomposed into: `index.tsx` (191 lines), `OverviewTab.tsx` (344 lines), `DealCallActivityTab.tsx` (192 lines), `DataRoomTab.tsx` (132 lines), `DealHeader.tsx`, `WebsiteActionsCard.tsx` (290 lines), `SalesforceInfoCard.tsx` (155 lines), `FinancialOverviewCard.tsx` (141 lines), `CapTargetInfoCard.tsx` (127 lines), `useDealDetail.ts` (255 lines), `helpers.ts` (59 lines). The old monolithic `ReMarketingDealDetail.tsx` (1,675 lines) has been deleted. This is a successful refactoring. ✅

**AI Command Center system prompt:** The 86-95KB system prompt has been compressed to ~15KB by extracting domain knowledge into `knowledge-base.ts` (495 lines, retrieved at runtime via `retrieve_knowledge` tool). The system prompt now lives at:
- `supabase/functions/ai-command-center/system-prompt.ts` (375 lines) — main orchestrator prompt
- `supabase/functions/ai-command-center/router.ts:1099` — separate `ROUTER_SYSTEM_PROMPT` for intent classification
- The frontend hook (`useAICommandCenter.ts`, 634 lines) contains NO system prompt — it only manages SSE streaming.

**Shadow router found:** `src/routes/admin-routes.tsx` (373 lines) is a complete, well-formed router that exports `AdminRoutes()` but is **imported by zero files**. It's entirely dead code — all routes are defined inline in `App.tsx`. Should be deleted to prevent accidental re-wiring.

---

## PHASE 4 — STRUCTURAL ISSUES & ANTI-PATTERNS

### 4.1 Prop Drilling

Prop drilling detection requires AST analysis for accuracy. Known patterns from code review:

- `buyerId` and `dealId` are passed through multiple component layers in both Marketplace and Remarketing contexts
- Admin layout passes user role/permissions through multiple levels

**Recommendation:** Introduce React Context for `currentDeal`, `currentBuyer`, `currentUniverse` to avoid prop drilling in detail pages.

### 4.2 Inline Data Fetching in Components

**45 component files contain direct Supabase queries** instead of using dedicated hooks. Key offenders:

| Component | What It Fetches Inline | Should Move To |
|-----------|----------------------|---------------|
| `src/pages/admin/ma-intelligence/Dashboard.tsx` | 6+ tables (`industry_trackers`, `remarketing_buyers`, `deals`, etc.) in `useEffect([], [])` | `useMAIntelligenceDashboard` hook with React Query |
| `src/pages/admin/ma-intelligence/Trackers.tsx` | `industry_trackers`, `remarketing_buyers`, `deals`, `buyer_transcripts` | `useTrackers` hook |
| `src/pages/admin/EnrichmentQueue.tsx` | 8+ tables in `fetchAll` callback with manual `setInterval(15s)` polling | `useEnrichmentQueueData` hook with `useQuery({ refetchInterval })` |
| `src/components/admin/EnhancedAnalyticsHealthDashboard.tsx` | 4 analytics tables in `useEffect([], [])` | `useAnalyticsHealth` hook |
| `src/components/remarketing/AIResearchSection/index.tsx` | `remarketing_buyer_universes`, `ma_guide_generations` — 6 separate queries | `useAIResearch` hook |
| `src/pages/admin/pipeline/views/PipelineKanbanView.tsx` | `supabase.auth.getUser()` in `useEffect([], [])` | Use existing `useAuth()` context |
| `src/pages/admin/message-center/ThreadView.tsx` | `supabase.auth.getUser()` in `useEffect([], [])` | Use existing `useAuth()` context |
| `src/components/remarketing/deal-detail/ContactHistoryTracker.tsx` (981 lines) | Multiple contact/activity tables | Extract to hook |
| `src/components/remarketing/BuyerMatchCard.tsx` (803 lines) | Scoring and outreach data | Extract to hook |
| `src/components/admin/ConnectionRequestActions.tsx` (1,276 lines) | Connection thread and document data | Extract to hook |
| `src/pages/admin/remarketing/ReMarketingUniverses.tsx` (1,431 lines) | Universe and enrichment data | Extract to hook |

### 4.3 God Hooks

**17 hooks exceed 100 lines.** The 13 worst:

| Hook Name | Line Count | Concerns | Split Into |
|-----------|-----------|----------|-----------|
| `src/hooks/admin/use-deals.ts` | 1,040 | 10+ exported hooks: queries, stage CRUD, mutations, soft delete, types | `useDealQueries`, `useDealStageMutations`, `useDealMutations`, `deal-types.ts` |
| `src/pages/admin/remarketing/ValuationLeads/useValuationLeadsData.ts` | 988 | Data fetching, mutations, filtering, scoring, enrichment, state | Split by concern |
| `src/pages/admin/remarketing/GPPartnerDeals/useGPPartnerDeals.ts` | 742 | GP partner data, actions, state | Split by concern |
| `src/hooks/useEnhancedRealTimeAnalytics.ts` | 739 | Active users, sessions, referrers, geography, engagement, funnels | `useActiveUsers`, `useSessionAnalytics`, `useEngagementAnalytics` |
| `src/pages/admin/remarketing/CapTargetDeals/useCapTargetActions.ts` | 674 | CapTarget deal actions, mutations, state | Split by action type |
| `src/hooks/useAICommandCenter.ts` | 634 | Session state, SSE streaming, DB persistence, conversation history, confirmation flow, UI dispatch (8 concerns) | `useConversationHistory`, `useAIStreaming`, `useAIConfirmation` |
| `src/hooks/admin/data-room/use-data-room.ts` | 629 | Documents, access matrix, approvals, lead memos, memo generation (9 concerns) | `useDataRoomDocuments`, `useDataRoomAccess`, `useLeadMemos` |
| `src/hooks/admin/use-recommended-buyers.ts` | 614 | Score-based fetch from 4 sources, outreach enrichment, transcript enrichment, formatting | `useRecommendedBuyerScores`, `useBuyerEnrichmentData` |
| `src/hooks/admin/use-firm-agreements.ts` | 574 | Agreements, members, fee/NDA updates, audit log, domain aliases | `useFirmAgreementData`, `useFirmAgreementMutations`, `useFirmDomainAliases` |
| `src/hooks/admin/use-document-distribution.ts` | 542 | Documents, tracked links, release log, approvals | `useDocumentDistribution`, `useTrackedLinks`, `useApprovalQueue` |
| `src/hooks/admin/use-deal-tasks.ts` | 499 | Task CRUD, checklist logic, reviewer management | `useDealTaskQueries`, `useDealTaskMutations`, `useTaskReviewers` |
| `src/hooks/use-contact-combined-history.ts` | 475 | Fetches from 6 tables by buyer ID AND duplicates same logic by email | `useContactHistoryByBuyerId`, `useContactHistoryByEmail`, shared `buildActivityEntry` util |
| `src/hooks/useUnifiedAnalytics/useEventTracking.ts` | 463 | 7 pure computation functions with no React — should not be a hook at all | Pure utility module `lib/analytics/computations.ts` |

### 4.4 Inconsistent Error Handling

Mixed patterns observed:
- Some components use `try/catch` with toast notifications
- Some use `.catch()` chains
- Some edge functions return structured `{ error: string }` objects
- Some return raw error messages
- Some silently fail

### 4.5 useEffect Misuse

**Empty `[]` dependency arrays calling data fetches (should be React Query):**

| File | Issue |
|------|-------|
| `pages/admin/ma-intelligence/Dashboard.tsx:31` | `useEffect(() => { loadDashboardData() }, [])` — 6+ supabase queries |
| `pages/admin/ma-intelligence/Trackers.tsx:44` | `useEffect(() => { loadTrackers() }, [])` — multi-table fetch |
| `components/admin/EnhancedAnalyticsHealthDashboard.tsx:199` | `useEffect(() => { checkAnalyticsHealth() }, [])` — 4 tables |
| `pages/admin/message-center/ThreadView.tsx:104` | `useEffect(() => { supabase.auth.getUser()... }, [])` — use `useAuth()` |
| `hooks/useBuyerEnrichmentProgress.ts:96` | `useEffect(() => { fetchStatus() }, [])` — should be `useQuery` |

**No dependency array at all (runs every render):**

| File | Issue |
|------|-------|
| `components/admin/AdminLayout.tsx:13` | `useEffect(() => { ... })` — missing dep array |
| `components/admin/ConnectionRequestActions.tsx:1112,1119` | Two `useEffect`s with no dep array |
| `components/admin/EnhancedFeedbackManagement.tsx:115,137` | Two `useEffect`s with no dep array |
| `components/remarketing/BuyerTableToolbar.tsx:104,137` | Two `useEffect`s with no dep array |
| `components/admin/analytics/realtime/MapboxGlobeMap.tsx:77,125,163,210` | Four `useEffect`s — some missing deps |

**Manual `setInterval` polling (should be React Query `refetchInterval`):**

| File | Issue |
|------|-------|
| `hooks/admin/use-auto-score-deal.ts:82` | `setInterval` polling supabase every 4s |
| `hooks/useBuyerEnrichmentProgress.ts:117` | `setInterval` (10s or 120s) calling supabase |
| `pages/admin/EnrichmentQueue.tsx:226` | `setInterval(fetchAll, 15000)` — manual polling |

### 4.6 Any Types

**844 instances of `any` type usage** across the codebase (excluding auto-generated types.ts).

**Top 10 worst files:**

| File | Count |
|------|-------|
| `hooks/useTaskAnalytics.ts` | 26 |
| `hooks/admin/listings/use-robust-listing-creation.ts` | 22 |
| `hooks/useTaskActions.ts` | 17 |
| `components/admin/ImprovedListingEditor.tsx` | 17 |
| `hooks/useDailyTasks.ts` | 16 |
| `lib/database.ts` | 15 (this file is dead code — see Phase 1.2) |
| `hooks/admin/use-contact-lists.ts` | 12 |
| `pages/admin/system-test-runner/testDefinitions.ts` | 11 |
| `pages/admin/EnrichmentQueue.tsx` | 11 |
| `hooks/useUnifiedAnalytics/index.ts` | 11 |

**Root cause:** Most `any` casts occur at Supabase table boundaries where TypeScript can't infer the row type (e.g., `supabase.from('team_member_aliases' as any)`). These represent untyped tables missing from the generated `supabase/types.ts`. Fix: run `supabase gen types` and add missing table types.

---

## PHASE 5 — NAMING & CONVENTION AUDIT

### 5.1 Inconsistent Naming Conventions

**File naming split personality in hooks:** The `src/hooks/admin/` subtree uses kebab-case (`use-deal-filters.ts`) while root `src/hooks/` uses camelCase (`useTaskAnalytics.ts`). **57 camelCase** vs **80+ kebab-case** hook files in the same tree.

**Non-hook files in hooks directory:**
- `src/hooks/admin.ts` — barrel re-export file
- `src/hooks/admin/listings/utils/storage-helpers.ts` — utility, not a hook
- `src/hooks/useUnifiedAnalytics/analyticsHelpers.ts` — utility
- `src/hooks/useUnifiedAnalytics/types.ts` — type definitions

**33 hook files scattered outside `src/hooks/`** (co-located with components/pages). Not wrong, but inconsistent with the majority in `src/hooks/`.

**One genuine naming violation:** `src/pages/auth/callback.tsx` — React component file in lowercase (should be `Callback.tsx`).

**Confusing near-duplicate hook pair:**
- `src/hooks/admin/use-deal-follow-up.ts` → exports `useUpdateFollowupStatus()` (single boolean field)
- `src/hooks/admin/use-deal-followup.ts` → exports `useUpdateDealFollowup()` (different: type + bulk updates)
- Filenames differ by one hyphen. Impossible to know which to use without opening both.

### 5.2 Misleading Names

| Name | What It Claims | What It Actually Does | Better Name |
|------|---------------|----------------------|-------------|
| `use-deals.ts` (1,040 lines) | "Deal data hook" | 10+ hooks for queries, mutations, stage CRUD, soft delete, types | Split into focused hooks |
| `useEnhancedRealTimeAnalytics` | "Enhanced real-time analytics" | Active users, sessions, referrers, geography, engagement, funnels (6 concerns) | Split concerns |
| `AICommandCenterPanel` (996 lines) | "Panel component" | Full chat application with tools, state, messages, history sidebar | `AIAssistantChat` |
| `extract-transcript` edge function | "Extracts transcript" | Extracts *structured data from* transcripts and updates both `listings` AND `remarketing_buyers` DB tables | `process-transcript-insights` (or delete — `extract-deal-transcript` and `extract-buyer-transcript` already exist) |
| `useListingIntelligence` hook | "Listing intelligence" | Exports TWO unrelated hooks: `useListingIntelligence` and `useListingJourneys` | Split into separate files |
| `useEventTracking.ts` (463 lines) | "Event tracking hook" | 7 pure computation functions with no React hooks | Move to `lib/analytics/computations.ts` — not a hook |
| `src/components/ui/use-toast.ts` | Looks like a UI component | Actually a re-export of `@/hooks/use-toast` | Misleading location |

### 5.3 Inconsistent Status Strings

**Full status taxonomy with all variants discovered:**

| Concept | Variants Found | Canonical Value | Files to Update |
|---------|---------------|----------------|----------------|
| Pending | `'pending'` (236), `"pending"` (37), `'Pending'` (7), `"Pending"` (2) | `'pending'` | ~46 files |
| Approved | `'approved'` (168), `"approved"` (32), `'Approved'` (10), `"Approved"` (2), `'accepted'` (2) | `'approved'` | ~46 files |
| Active | `'active'` (157), `"active"` (46), `'Active'` (7), `"Active"` (6) | `'active'` | ~59 files |
| Rejected | `'rejected'` (46), `'passed'` (31), `'not_a_fit'` (20), `'declined'` (19) | Context-dependent — needs taxonomy | ~116 files |
| Completed | `'completed'` (82), `'complete'` (13), `'done'` (1) | `'completed'` | ~14 files |
| Failed | `'failed'` (82), `'fail'` (20), `'error'` (35) | `'failed'` | ~55 files |
| Draft | `'draft'` (1), `'DRAFT'` (HeyReach), `'DRAFTED'` (Smartlead) | Needs adapter per service | ~3 files |
| Pending approval | `'pending'`, `'pending_approval'` (15) | Pick one | ~15 files |

**Total: 400+ inconsistent status string usages** that should be constants or enums.

> **Critical bug vector:** `score-buyer-deal/index.ts` treats `'passed'` and `'not_a_fit'` as interchangeable: `scores.filter(s => s.status === "passed" || s.status === "not_a_fit")`. This implies these are supposed to be the same concept but are stored differently depending on the source.

---

## PHASE 6 — EDGE FUNCTION SPECIFIC AUDIT

### 6.1 Function Responsibility Audit

Multiple edge functions violate single responsibility:

| Function | Responsibilities | Should Split Into |
|----------|-----------------|-------------------|
| `enrich-buyer` (730 lines) | Web scraping, data parsing, AI analysis, DB storage | `scrape-buyer-website`, `parse-buyer-data`, `store-buyer-enrichment` |
| `enrich-deal` (857 lines) | Web scraping, financial parsing, AI analysis, scoring | `scrape-deal-website`, `parse-deal-data`, `store-deal-enrichment` |
| `generate-ma-guide` (1,500 lines) | 13-phase SSE pipeline, quality validation, buyer profile extraction, criteria extraction, gap fill generation | At minimum: `gather-guide-data`, `generate-guide-content`, `format-guide-pdf` |
| `score-buyer-deal` (733 lines) | Data fetching, multi-dimension scoring, weight calculation | Extract dimension calculators |
| `extract-transcript` (910 lines) | Handles deal insights AND buyer insights via `entity_type` flag — updates both `listings` and `remarketing_buyers` | Delete — `extract-deal-transcript` and `extract-buyer-transcript` already exist as specific versions |
| `bulk-import-remarketing` (756 lines) | Three operations via internal router: `clear`, `validate`, `import` | Split into separate endpoints |
| `apify-linkedin-scrape` (1,027 lines) | LinkedIn scraping AND candidate scoring/matching with name similarity + location verification | Split scraping from scoring |
| `docuseal-webhook-handler` (554 lines) | Three webhook event types AND sends admin + buyer notifications | Split event handlers from notification dispatch |

**Largest file in the entire codebase:** `supabase/functions/ai-command-center/tools/integration-action-tools.ts` — **2,844 lines** — contains all PhoneBurner, Smartlead, DocuSeal, and data room integration action handlers in one file.

### 6.2 Shared Logic That Isn't Shared

The `_shared/` directory has well-designed utilities for CORS (`cors.ts`), auth (`auth.ts`), error responses (`error-response.ts`), and AI providers (`ai-providers.ts`). **Compliance is mixed:**

| Pattern | Functions That Repeat It | Shared Module | Compliance |
|---------|------------------------|--------------|------------|
| Supabase client initialization | **144 functions** | `_shared/supabase-client.ts` | 144 DON'T use it |
| JWT/Auth verification | **22 functions inline their own** | `_shared/auth.ts` (exports `requireAuth`, `requireAdmin`) | 22 DON'T use it |
| CORS headers | 2 functions define wildcard `*` CORS | `_shared/cors.ts` (has allowlist) | 2 bypass the allowlist |
| Error response formatting | Only 4 functions use shared helper | `_shared/error-response.ts` (exports `errorResponse()`) | ~150 DON'T use it |
| AI model constants | 2 functions define local `GEMINI_MODEL` | `_shared/ai-providers.ts` (exports `DEFAULT_GEMINI_MODEL`) | 2 DON'T use it |

**Auth inconsistency:** `_shared/auth.ts` calls `supabase.rpc("is_admin", { user_id: auth.userId })` but `reset-agreement-data` calls `supabase.rpc("is_admin", { uid: user.id })` — **different parameter names** that may cause failures.

**CORS bypass:** `notify-admin-document-question` and `reset-agreement-data` define `Access-Control-Allow-Origin: *` instead of using the shared CORS allowlist — potential security concern.

### 6.3 Hardcoded Values in Edge Functions

| Value | Files | Should Be |
|-------|-------|----------|
| `'https://api.firecrawl.dev/v1/scrape'` | `enrich-buyer`, `enrich-deal` | `FIRECRAWL_BASE_URL` env var |
| `'https://api.firecrawl.dev/v1/map'` | `enrich-buyer` | `FIRECRAWL_BASE_URL` env var |
| `'https://api.fireflies.ai/graphql'` | `auto-pair-all-fireflies`, `bulk-sync-all-fireflies`, `extract-standup-tasks` | `FIREFLIES_API_URL` env var |
| `'https://api.docuseal.com/submissions'` | `create-docuseal-submission`, `auto-create-firm-on-approval`, `ai-command-center` | `DOCUSEAL_BASE_URL` env var |
| `'https://api.anthropic.com/v1/messages'` | `draft-connection-message` | `ANTHROPIC_API_URL` env var |
| `'https://api.resend.com/emails'` | `enhanced-admin-notification` | `RESEND_API_URL` env var |
| `'https://api.brevo.com/v3/smtp/email'` | `enhanced-admin-notification` | `BREVO_API_URL` env var |
| `'https://api.apify.com/v2'` | `apify-linkedin-scrape` | `APIFY_BASE_URL` env var |
| Model: `'claude-haiku-4-5-20251001'` | `draft-connection-message` | `AI_MODEL_HAIKU` constant |
| Model: `'gemini-2.0-flash'` | `extract-buyer-criteria`, `extract-buyer-transcript`, `find-buyer-contacts`, `parse-tracker-documents`, `parse-transcript-file` | `AI_MODEL_GEMINI_FLASH` constant |
| Model: `'google/gemini-2.5-flash'` | `analyze-deal-notes` | `AI_MODEL_GEMINI_25_FLASH` constant |
| Model: `'google/gemini-2.5-flash-lite'` | `ai-command-center` | `AI_MODEL_GEMINI_LITE` constant |
| Model: `'gpt-4o-mini'` | `generate-buyer-intro` | `AI_MODEL_GPT4O_MINI` constant |

**No hardcoded API keys found.** ✅ (All appear to use environment variables via `Deno.env.get()`)

---

## PHASE 7 — IMPORT & DEPENDENCY AUDIT

### 7.1 Unused Imports

Requires ESLint or `ts-prune` for systematic detection. TypeScript compiler with `noUnusedLocals` would catch these. Not enumerable via grep alone.

### 7.2 Circular Dependencies

Requires `madge` or similar tool for detection. Not enumerable via grep alone.

### 7.3 Over-Importing

The auto-generated `src/integrations/supabase/types.ts` (14,870 lines) is imported across many files. This is expected for generated types but contributes to bundle size if not tree-shaken properly.

---

## PHASE 8 — CONSOLE LOGS & DEBUG ARTIFACTS

### 8.1 Console Statements

| Location | Count |
|----------|-------|
| Frontend (`src/`) | **304** |
| Edge Functions (`supabase/functions/`) | **1,424** |
| **Total** | **1,728** |

Edge functions having console statements is more acceptable (server-side logging), but 304 in frontend code should be cleaned up.

### 8.2 TODO / FIXME / HACK Comments

| File | Line | Comment | Priority |
|------|------|---------|----------|
| `src/pages/admin/EnrichmentTest.tsx` | 74 | `TEMP / DEV ONLY` — page badge marking it as dev-only | **P0** — dev-only component in production build |
| `src/lib/session-security.ts` | 1-11 | `// session-security.ts — STUBBED OUT` — entire file is a stub. Every security method (`validateSession`, `detectAnomalies`) returns hardcoded success | **P1** — delete file or document intent clearly |
| `src/hooks/marketplace/use-listings.ts` | 9-13 | `// N02 FIX:` — documents a past critical vulnerability (SELECT * exposing confidential data) | P2 — informational, keep as documentation |
| `src/main.tsx` | 15 | `// Seed database disabled — causes 401 errors on cold load without auth session` | P2 — informational |
| `src/lib/criteriaValidation.ts` | 64-65 | Contains `/XXX/gi` and `/TODO/gi` as validation regex patterns | False positive — these are validation rules |

**Auth bypass check:** No `TEMPORARY BYPASS` comment found in `ProtectedRoute` or any auth-related file. ✅ Authentication appears properly enforced.

**Session security stub warning:** `src/lib/session-security.ts` is entirely stubbed — `validateSession()` always returns `{ valid: true }` and `detectAnomalies()` always returns `{ risk_score: 0, recommendation: 'normal' }`. The header comment says real auth is handled by Supabase JWT, which is correct, but any code calling `SessionSecurity.validateSession()` gets a false sense of security. Imported by `use-session-monitoring.ts` and `SessionMonitoringProvider.tsx`.

### 8.3 Disabled / Skipped Tests

Only one test file found: `src/components/ErrorBoundary.test.tsx` (92 lines). No skipped tests detected in this file.

---

## PHASE 9 — REFACTORING PRIORITY MATRIX

### P0 — CRITICAL (Fix before next release)

| # | Issue | File(s) | Effort | Impact |
|---|-------|---------|--------|--------|
| 1 | Dev-only `EnrichmentTest` component in production build | `src/pages/admin/EnrichmentTest.tsx` | 1h | Security — exposes internal test tooling |
| 2 | CORS wildcard bypass in 2 edge functions (skipping allowlist) | `notify-admin-document-question`, `reset-agreement-data` | 1h | Security — bypasses CORS allowlist |
| 3 | 844 `any` type usages creating type safety holes | Across ~200 files | 16h | Reliability — hides potential runtime bugs |
| 4 | 26+ confirmed dead edge functions consuming deployment resources | `supabase/functions/` | 4h | Cost — unnecessary deployments, confusion |
| 5 | 28 dead hooks + 10 dead library files (unreachable via barrel) | `src/hooks/`, `src/lib/` | 2h | Confusion — devs may try to use/maintain dead code |

### P1 — HIGH (Fix this sprint)

| # | Issue | File(s) | Effort | Impact |
|---|-------|---------|--------|--------|
| 6 | 26 duplicate component pairs (20 same-name + 6 near-identical) | See Phase 2.1 table | 24h | Velocity — edits to wrong copy cause "nothing changed" bugs |
| 7 | 13 god hooks (411–1,040 lines each) | See Phase 4.3 table | 20h | Maintainability — impossible to understand or test |
| 8 | 400+ inconsistent status strings across codebase | ~100+ files | 6h | Bugs — case-sensitive comparisons silently fail; `'passed'` vs `'not_a_fit'` treated as same |
| 9 | `formatCurrency` copy-pasted in 35 files | See Phase 2.5 | 4h | Maintenance — 3 canonical versions exist, 32 local copies |
| 10 | 22 edge functions bypass shared auth (`_shared/auth.ts`) | See Phase 6.2 | 8h | Security/Maintenance — auth changes require 22 updates |
| 11 | 9 hardcoded AI model names + 8 hardcoded API URLs | See Phase 6.3 table | 4h | Operations — model/URL updates require hunting all hardcoded refs |
| 12 | Orphaned shadow components and files | `ErrorBoundary` (common/), `admin-routes.tsx`, `AdminUsers.tsx`, `AllDeals.tsx`, `AuthFlowManager.tsx`, `PipelineMetricsCard.tsx` | 2h | Confusion — developers may edit wrong file |
| 13 | Stubbed session-security.ts always returns `{valid: true}` | `src/lib/session-security.ts` | 1h | Misleading — code calling `validateSession()` gets false confidence |
| 14 | 45 components with inline Supabase queries | See Phase 4.2 | 16h | Testability — components can't be unit tested |

### P2 — MEDIUM (Fix next sprint)

| # | Issue | File(s) | Effort | Impact |
|---|-------|---------|--------|--------|
| 15 | 43 critical monolith files (600+ lines) in frontend | See Phase 3.2 table | 40h | Velocity — hard to understand, review, and modify |
| 16 | 60 edge functions over 300 lines (largest: 1,500) | See Phase 3.2.1 table | 30h | Maintainability — hard to understand and test |
| 17 | `integration-action-tools.ts` at 2,844 lines — largest file in codebase | `supabase/functions/ai-command-center/tools/` | 8h | Maintainability — extreme monolith |
| 18 | 304 console.log statements in frontend | Across `src/` | 4h | Performance & professionalism |
| 19 | 20+ useEffect misuses (missing deps, no deps, manual polling) | See Phase 4.5 tables | 8h | Bugs — stale closures, unnecessary re-renders |
| 20 | 6+ duplicate type definitions (`DealTranscript` 4x, `BuyerRow` 3x, `SortDirection` 10x) | See Phase 2.4 | 4h | Type drift — same concept typed differently |
| 21 | Duplicate Supabase query patterns across 20+ files | See Phase 2.3 | 8h | Consistency — data fetching should be centralized |
| 22 | `next_followup_due` dead interface field + dead barrel exports | `src/hooks/admin/use-deals.ts:91`, `hooks/index.ts`, `lib/index.ts` | 1h | Confusion |

### P3 — LOW (Backlog)

| # | Issue | File(s) | Effort | Impact |
|---|-------|---------|--------|--------|
| 23 | 1,424 console statements in edge functions | `supabase/functions/` | 8h | Log noise — replace with structured logging |
| 24 | Missing `noUnusedLocals` in tsconfig | `tsconfig.json` | 1h | Catch dead code at compile time |
| 25 | Hook file naming inconsistency (camelCase vs kebab-case) | `src/hooks/` | 4h | Convention — pick one and enforce |
| 26 | App.tsx route config should be extracted | `src/App.tsx` (656 lines) | 2h | Readability |
| 27 | `BUYER_TYPE` schema split (camelCase in Marketplace, snake_case in Remarketing) | 7+ files | 4h | Consistency — same concept, two schemas |
| 28 | Missing test coverage | Only 1 test file in entire project | 40h+ | Quality |

---

## PHASE 10 — SUMMARY SCORECARD

| Category | Count Found | Critical | High | Medium | Low |
|----------|------------|----------|------|--------|-----|
| Orphaned components | 7 files + 1 orphaned router (admin-routes.tsx) | 0 | 1 | 0 | 0 |
| Dead hooks & utility files | 28 hooks + 10 lib files | 1 | 0 | 0 | 0 |
| Dead edge functions | 26 confirmed + ~35 to verify | 1 | 0 | 0 | 0 |
| Dead database columns/fields | 1 confirmed (`next_followup_due`) | 0 | 0 | 1 | 0 |
| Duplicate components | 26 pairs (20 same-name + 6 near-identical) | 0 | 1 | 0 | 0 |
| Duplicate edge function logic | 144 (supabase init), 22 (inline auth), ~150 (error formatting) | 0 | 1 | 0 | 0 |
| Duplicate query patterns | 5+ major patterns, `formatCurrency` in 35 files | 0 | 1 | 1 | 0 |
| Duplicate types | `DealTranscript` 4x, `BuyerRow` 3x, `SortDirection` 10x, `EnrichmentProgress` 5x | 0 | 0 | 1 | 0 |
| Monolithic files (400+ lines) | 148 frontend + 60 edge functions + `integration-action-tools.ts` (2,844 lines) | 0 | 0 | 2 | 0 |
| Shadow/duplicate components | ErrorBoundary, admin-routes.tsx, MA DealDetail | 0 | 1 | 0 | 0 |
| God hooks | 13 (411-1,040 lines) | 0 | 1 | 0 | 0 |
| `any` type usages | 844 | 1 | 0 | 0 | 0 |
| Naming convention violations | Status strings: 400+ inconsistent, hook filename split | 0 | 1 | 0 | 1 |
| Hardcoded values (edge functions) | 17+ (9 models + 8 URLs) + CORS bypass (2) | 1 | 1 | 0 | 0 |
| TODO/FIXME/stubs | `TEMP / DEV ONLY` + stubbed session-security.ts | 1 | 1 | 0 | 0 |
| Console.log statements | 1,728 total (304 frontend + 1,424 edge) | 0 | 0 | 1 | 1 |
| useEffect misuse | 20+ instances (missing deps, no deps, manual polling) | 0 | 0 | 1 | 0 |
| Inline data fetching | 45 components with Supabase queries in component body | 0 | 1 | 0 | 0 |
| **TOTAL** | — | **5** | **10** | **7** | **2** |

### Effort Estimates

- **Estimated hours to resolve all P0 + P1 issues:** ~109 hours
- **Estimated hours to resolve all issues:** ~285 hours
- **Recommended sprint order (Top 10):**

1. **Fix CORS wildcard bypass + remove dev-only EnrichmentTest** (P0, 2h) — Immediate security fixes
2. **Delete 28 dead hooks + 10 dead library files** (P0, 2h) — Quick cleanup, reduces codebase by ~2,500 lines
3. **Delete 26 confirmed dead edge functions** (P0, 4h) — Reduces deployment size; verify webhook/cron functions first
4. **Create shared constants for status strings + `formatCurrency` consolidation** (P1, 6h) — Quick win that prevents comparison bugs; eliminates 35 copy-pasted functions
5. **Delete orphaned components** (P1, 2h) — Remove ErrorBoundary (common/), admin-routes.tsx, AuthFlowManager, PipelineMetricsCard, AllDeals.tsx
6. **Consolidate hardcoded model names & API URLs** (P1, 4h) — Quick win for operational safety
7. **Migrate 22 edge functions to shared auth** (P1, 8h) — Eliminates inline auth + fixes CORS bypass
8. **Merge top 5 duplicate component pairs** (P1, 12h) — PushToHeyreach/PushToSmartlead (98% identical), BuyerTableRow, DealsKPICards/GPPartnerKPICards (99% identical), StructuredCriteriaPanel, IntelligenceBadge
9. **Split `use-deals.ts` god hook** (P1, 4h) — Highest-impact hook decomposition (10+ exports, 1,040 lines)
10. **Begin `any` type remediation** (P0, ongoing) — Start with `useTaskAnalytics.ts` (26 instances), `use-robust-listing-creation.ts` (22); add ESLint `no-explicit-any` rule

---

*SourceCo Internal — Code Quality & Refactoring Audit v1.0 — March 2026*
*This audit is read-only. No changes were made. A separate execution prompt will handle fixes in priority order.*
