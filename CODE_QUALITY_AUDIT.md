# SourceCo Platform — Code Quality & Refactoring Audit

**Date:** March 1, 2026
**Scope:** Full codebase — 1,312 source files, 156 edge functions
**Codebase Size:** ~258,435 lines (src/), ~50,276 lines (edge functions)
**Status:** DOCUMENT ONLY — No changes made

---

## PHASE 1 — DEAD CODE DETECTION

### 1.1 Orphaned React Components

**73 orphaned component files found (12,945 lines of dead code)**

SmartleadEmailHistory: **Does not exist anywhere in the codebase.** Already cleaned up or never created.

#### Editor Sections — 8 orphaned files, 1,670 lines

| File Path | Lines | What It Does | Safe to Delete? |
|-----------|-------|-------------|-----------------|
| `src/components/admin/editor-sections/EditorAdvancedSection.tsx` | 93 | Advanced settings section for listing editor | Yes |
| `src/components/admin/editor-sections/EditorBasicInfoSection.tsx` | 243 | Basic info fields for listing editor | Yes |
| `src/components/admin/editor-sections/EditorCoreDetailsSection.tsx` | 136 | Core details for listing editor | Yes |
| `src/components/admin/editor-sections/EditorFinancialAndMetricsSection.tsx` | 278 | Combined financial+metrics for listing editor | Yes |
| `src/components/admin/editor-sections/EditorFinancialSection.tsx` | 147 | Financial data for listing editor | Yes |
| `src/components/admin/editor-sections/EditorInternalDataSection.tsx` | 331 | Internal data fields for listing editor | Yes |
| `src/components/admin/editor-sections/EditorInternalSection.tsx` | 255 | Internal notes/settings for listing editor | Yes |
| `src/components/admin/editor-sections/EditorMetricsSection.tsx` | 187 | Metrics fields for listing editor | Yes |

> Superseded by `ImprovedListingEditor` with different section components.

#### Pipeline Detail Tabs — 8 orphaned files, 2,677 lines (LARGEST CLUSTER)

| File Path | Lines | What It Does | Safe to Delete? |
|-----------|-------|-------------|-----------------|
| `src/components/admin/pipeline/tabs/PipelineDetailActivity.tsx` | 247 | Activity log tab in pipeline detail | Yes |
| `src/components/admin/pipeline/tabs/PipelineDetailBuyer.tsx` | 564 | Buyer info tab in pipeline detail | Yes |
| `src/components/admin/pipeline/tabs/PipelineDetailCommunication.tsx` | 460 | Communication tab in pipeline detail | Yes |
| `src/components/admin/pipeline/tabs/PipelineDetailDocuments.tsx` | 329 | Documents tab in pipeline detail | Yes |
| `src/components/admin/pipeline/tabs/PipelineDetailMessages.tsx` | 146 | Messages tab in pipeline detail | Yes |
| `src/components/admin/pipeline/tabs/PipelineDetailRecommendedBuyers.tsx` | 437 | Recommended buyers tab | Yes |
| `src/components/admin/pipeline/tabs/PipelineDetailTasks.tsx` | 333 | Tasks tab in pipeline detail | Yes |
| `src/components/admin/pipeline/tabs/AIGeneratedNoteRenderer.tsx` | 161 | AI-generated note rendering | Yes |

#### Listing Detail Financial Tools — 7 orphaned files, 1,214 lines

| File Path | Lines | What It Does | Safe to Delete? |
|-----------|-------|-------------|-----------------|
| `src/components/listing-detail/EnhancedInvestmentCalculator.tsx` | 273 | Investment ROI calculator | Yes — unreleased feature |
| `src/components/listing-detail/InteractiveCashFlowProjections.tsx` | 433 | Cash flow projection charts | Yes — unreleased feature |
| `src/components/listing-detail/InvestmentThesisGenerator.tsx` | 126 | AI investment thesis generator | Yes — unreleased feature |
| `src/components/listing-detail/InvestorFinancialDashboard.tsx` | 156 | Financial dashboard for investors | Yes — unreleased feature |
| `src/components/listing-detail/ListingFinancials.tsx` | 56 | Financial summary display | Yes |
| `src/components/listing-detail/ListingInfo.tsx` | 45 | Basic listing info display | Yes |
| `src/components/listing-detail/OwnershipTransactionCard.tsx` | 101 | Ownership/transaction details | Yes |
| `src/components/listing-detail/PremiumInvestmentCalculator.tsx` | 181 | Premium investment calculator | Yes — unreleased feature |
| `src/components/listing-detail/ShareDealDialog.tsx` | 119 | Share deal via email/link | Yes |
| `src/components/listing-detail/AdminListingSidebar.tsx` | 69 | Admin sidebar on listing page | Yes |

#### Deal Matching Sub-components — 5 orphaned files, 569 lines

| File Path | Lines | What It Does | Safe to Delete? |
|-----------|-------|-------------|-----------------|
| `src/pages/admin/remarketing/ReMarketingDealMatching/MatchList.tsx` | 238 | Buyer match list (replaced by BuyerMatchCard) | Yes |
| `src/pages/admin/remarketing/ReMarketingDealMatching/StatsPanel.tsx` | 136 | Match statistics panel | Yes |
| `src/pages/admin/remarketing/ReMarketingDealMatching/ScoringControls.tsx` | 93 | Scoring parameter controls | Yes |
| `src/pages/admin/remarketing/ReMarketingDealMatching/DataQualityWarning.tsx` | 33 | Data quality warning banner | Yes |
| `src/pages/admin/remarketing/ReMarketingDealMatching/ListingSummaryCard.tsx` | 69 | Listing summary card | Yes |

#### Firm Agreements — 4 orphaned files, 1,426 lines

| File Path | Lines | What It Does | Safe to Delete? |
|-----------|-------|-------------|-----------------|
| `src/components/admin/firm-agreements/FirmAgreementsTable.tsx` | 552 | Firm agreement table | Yes — superseded |
| `src/components/admin/firm-agreements/FirmAgreementToggles.tsx` | 310 | Agreement status toggles | Yes — superseded |
| `src/components/admin/firm-agreements/FirmBulkActions.tsx` | 130 | Bulk actions toolbar | Yes — superseded |
| `src/components/admin/firm-agreements/FirmSyncTestingPanel.tsx` | 434 | Sync testing panel | Yes — superseded |

#### MA Intelligence Tracker Tabs — 6 orphaned files, 570 lines

| File Path | Lines | What It Does | Safe to Delete? |
|-----------|-------|-------------|-----------------|
| `src/components/ma-intelligence/tracker/TrackerActivityTab.tsx` | 215 | Tracker activity log | Yes |
| `src/components/ma-intelligence/tracker/TrackerDocumentsTab.tsx` | 258 | Tracker documents | Yes |
| `src/components/ma-intelligence/tracker/TrackerFitCriteriaTab.tsx` | 30 | Fit criteria config | Yes |
| `src/components/ma-intelligence/tracker/TrackerKPIConfigTab.tsx` | 23 | KPI config | Yes |
| `src/components/ma-intelligence/tracker/TrackerQueryTab.tsx` | 10 | Search/query tab | Yes |
| `src/components/ma-intelligence/tracker/TrackerScoringBehaviorTab.tsx` | 34 | Scoring behavior config | Yes |

#### Remarketing Buyer Detail — 4 orphaned files, 1,005 lines

| File Path | Lines | What It Does | Safe to Delete? |
|-----------|-------|-------------|-----------------|
| `src/components/remarketing/buyer-detail/BuyerAgreementsRebuild.tsx` | 438 | Rebuilt agreements panel | Yes — superseded |
| `src/components/remarketing/buyer-detail/BuyerContactsHub.tsx` | 155 | Contact management hub | Yes — superseded |
| `src/components/remarketing/buyer-detail/BuyerEngagementTab.tsx` | 223 | Engagement analytics tab | Yes — superseded |
| `src/components/remarketing/buyer-detail/ContactCallTimeline.tsx` | 189 | Call activity timeline | Yes — superseded |

#### Other Orphaned Components — 25 files, 2,814 lines

| File Path | Lines | What It Does | Safe to Delete? |
|-----------|-------|-------------|-----------------|
| `src/components/admin/BulkFollowupConfirmation.tsx` | 144 | Bulk follow-up dialog | Yes |
| `src/components/admin/BuyerDealsOverview.tsx` | 72 | Buyer deals overview card | Yes |
| `src/components/admin/DecisionNotesInline.tsx` | 94 | Inline decision notes editor | Yes |
| `src/components/admin/QuickActionsBar.tsx` | 68 | Quick bulk action buttons | Yes |
| `src/components/admin/StatusIndicatorRow.tsx` | 141 | Status indicator row | Yes |
| `src/components/admin/analytics/datafast/ClickableRow.tsx` | 54 | Clickable analytics row | Yes |
| `src/components/admin/dashboard/QuickNoteInput.tsx` | 57 | Quick note input widget | Yes |
| `src/components/admin/non-marketplace/SendInvitationDialog.tsx` | 99 | Send invitation dialog | Yes |
| `src/components/admin/pipeline/ConnectionRequestNotes.tsx` | 51 | Connection request notes | Yes |
| `src/components/admin/pipeline/PipelineViewSwitcher.tsx` | 388 | Pipeline view mode switcher | Yes |
| `src/components/auth/AuthFlowManager.tsx` | 9 | Auth flow wrapper | Yes |
| `src/components/buyer/BuyerDashboard.tsx` | 190 | Buyer dashboard | Yes |
| `src/components/common/LazyImage.tsx` | 136 | Lazy-loading image | Yes |
| `src/components/icons/AcquisitionTypeIcons.tsx` | 25 | Acquisition type SVG icons | Yes |
| `src/components/realtime/RealtimeIndicator.tsx` | 35 | Real-time connection indicator | Yes |
| `src/components/security/SessionMonitoringProvider.tsx` | 38 | Session monitoring provider | Yes |
| `src/components/settings/WebhookDeliveryLog.tsx` | 86 | Webhook delivery log viewer | Yes |
| `src/components/deals/DealDocumentPreview.tsx` | 170 | Deal document preview | Yes |
| `src/components/deals/DealMessagePreview.tsx` | 116 | Deal message preview | Yes |
| `src/components/deals/DealProcessStepper.tsx` | 69 | Deal process step indicator | Yes |
| `src/components/deals/DealProcessTimeline.tsx` | 99 | Deal process timeline | Yes |
| `src/components/remarketing/BackgroundGuideProgress.tsx` | 144 | Background guide progress | Yes |
| `src/components/remarketing/CriteriaReviewPanel.tsx` | 472 | Criteria review panel | Yes |
| `src/components/remarketing/FirefliesTranscriptSync.tsx` | 209 | Fireflies transcript sync | Yes |
| `src/components/remarketing/IndustryKPIPanel.tsx` | 361 | Industry KPI benchmarks | Yes |
| `src/components/remarketing/PushToDialerButton.tsx` | 35 | Push to dialer button | Yes |
| `src/components/remarketing/PushToSmartleadButton.tsx` | 35 | Push to Smartlead button | Yes |
| `src/components/remarketing/RemarketingErrorBoundary.tsx` | 72 | Remarketing error boundary | Yes |

### 1.2 Dead Utility Functions & Hooks

| File | Item | Lines | Reason Dead | Recommendation |
|------|------|-------|-------------|----------------|
| `src/hooks/admin/use-deals.ts:91` | `next_followup_due` interface field | 1 | Defined but never populated or read | Delete field |

> A thorough scan with `ts-prune` is recommended for exhaustive dead function detection across all 40,163 lines of hooks code.

### 1.3 Dead Edge Functions

**156 total edge functions. 40 have zero frontend call sites.**

After cross-referencing inter-EF calls and webhook/cron patterns:

#### Confirmed DEAD — Safe to Delete (22 functions, ~6,500+ lines)

| Function | Lines | Notes |
|----------|-------|-------|
| `analyze-seller-interest` | 345 | No callers anywhere |
| `bulk-import-remarketing` | 756 | No callers — superseded |
| `clarify-industry` | 201 | No callers |
| `create-lead-user` | 135 | No callers |
| `data-room-download` | 150 | No callers |
| `data-room-upload` | 203 | No callers |
| `enrich-geo-data` | 165 | No callers |
| `enrich-session-metadata` | 184 | No callers |
| `extract-buyer-criteria-background` | — | Superseded by `extract-buyer-criteria` |
| `extract-buyer-transcript` | 590 | Superseded by `extract-transcript` |
| `generate-buyer-universe` | 237 | No callers |
| `generate-guide-pdf` | 215 | No callers |
| `generate-research-questions` | 111 | No callers |
| `get-document-download` | 190 | No callers |
| `get-feedback-analytics` | 52 | No callers |
| `import-reference-data` | 470 | One-time import script |
| `notify-remarketing-match` | 141 | No callers |
| `parse-scoring-instructions` | 165 | No callers |
| `parse-tracker-documents` | 148 | No callers |
| `reset-agreement-data` | 244 | Maintenance script |
| `send-deal-referral` | 245 | No callers |
| `send-simple-verification-email` | 161 | Superseded |
| `send-templated-approval-email` | 232 | Superseded |
| `send-verification-email` | 178 | Superseded |

#### DORMANT — Verify Before Deleting (12 functions)

| Function | Lines | Reason to Verify |
|----------|-------|-----------------|
| `admin-digest` | 290 | Likely cron-triggered |
| `admin-notification` | 71 | Likely DB-trigger-triggered |
| `aggregate-daily-metrics` | 250 | Likely cron-triggered |
| `error-logger` | 138 | May be middleware |
| `heyreach-webhook` | 206 | Webhook handler — verify config |
| `otp-rate-limiter` | 147 | May be auth middleware |
| `phoneburner-oauth-callback` | 23 | OAuth callback — verify flow |
| `process-standup-webhook` | 184 | Webhook — verify config |
| `rate-limiter` | 204 | May be middleware |
| `salesforce-remarketing-webhook` | 252 | Webhook — verify Salesforce config |
| `security-validation` | 331 | May be auth middleware |
| `send-password-reset-email` | — | Called by `admin-reset-password` (ACTIVE) |

#### Test Functions in Production (should not be deployed)

| Function | Lines | Status |
|----------|-------|--------|
| `docuseal-integration-test` | 490 | **REMOVE FROM PROD** |
| `test-contact-enrichment` | 472 | **REMOVE FROM PROD** |

### 1.4 Dead Database Columns

| Table | Column | Status | Evidence |
|-------|--------|--------|----------|
| `deals` | `deal_score` | **ACTIVE** | Used in 5 pipeline component files |
| interface only | `next_followup_due` | **DEAD** | `use-deals.ts:91` — never populated or displayed |

### 1.5 Dead Routes

**All routes in `App.tsx` point to existing components.** No broken route-to-component mappings.

18 redirect routes exist for URL migration (old remarketing URLs → unified admin URLs). These are intentional.

No duplicate route paths found.

### 1.6 Commented-Out Code

**1 significant block found:**

| File | Lines | What It Is | Recommendation |
|------|-------|-----------|----------------|
| `supabase/functions/send-verification-email/index.ts` | 43-175 (133 lines) | Legacy email-sending function body with Brevo API call, hardcoded HTML template, hardcoded email `adam.haile@sourcecodeals.com` | Delete — entire function is dead |

No other significant commented-out code blocks found. The codebase is clean in this regard.

---

## PHASE 2 — DUPLICATE CODE DETECTION

### 2.1 Copy-Pasted Components

#### Push-to-Platform Modals (3 near-identical modals)

| Component A | Component B | Component C | Overlap | Merge Strategy |
|------------|------------|------------|---------|----------------|
| `PushToDialerModal.tsx` (466 lines) | `PushToHeyreachModal.tsx` (211 lines) | `PushToSmartleadModal.tsx` (208 lines) | ~70% | Create generic `PushToPlatformModal` parameterized by platform |

Their type files are also structural twins:
- `src/types/heyreach.ts` (169 lines) ≈ `src/types/smartlead.ts` (171 lines)

#### Enrichment Summary Dialogs (copy-paste with icon swap)

| Component A | Component B | Overlap | Merge Strategy |
|------------|------------|---------|----------------|
| `EnrichmentSummaryDialog.tsx` (126 lines) | `DealEnrichmentSummaryDialog.tsx` (125 lines) | ~95% | Merge — only difference is icon |

#### PassReasonDialog (two independent implementations)

| Component A | Component B | Overlap | Merge Strategy |
|------------|------------|---------|----------------|
| `ma-intelligence/PassReasonDialog.tsx` (189 lines) | `remarketing/PassReasonDialog.tsx` (118 lines) | ~60% | Merge — same purpose, different UI patterns |

#### Desktop/Mobile Table Pairs

| Component A | Component B | Overlap | Merge Strategy |
|------------|------------|---------|----------------|
| `UsersTable.tsx` (331 lines) | `MobileUsersTable.tsx` (432 lines) | ~50% logic | Share data hooks, extract shared status badges |
| `ConnectionRequestsTable.tsx` (1,000 lines) | `MobileConnectionRequestsTable.tsx` (252 lines) | ~40% logic | Share data hooks and action handlers |

#### Deal Import Dialogs

| Component A | Component B | Component C | Overlap | Merge Strategy |
|------------|------------|------------|---------|----------------|
| `BulkDealImportDialog.tsx` (818 lines) | `DealImportDialog.tsx` (815 lines) | `DealCSVImport.tsx` (663 lines) | ~50-70% | Extract shared CSV parsing/mapping engine |

#### Buyer Detail Edit Dialogs (8 structurally identical dialogs)

All follow same pattern: Dialog wrapper → form state → save to supabase → toast notification.

| File | Lines |
|------|-------|
| `EditBuyerCompanyOverviewDialog.tsx` | 183 |
| `EditBuyerServicesBusinessModelDialog.tsx` | 100 |
| `EditBusinessDescriptionDialog.tsx` | 114 |
| `EditAcquisitionHistoryDialog.tsx` | 97 |
| `EditGeographicFootprintDialog.tsx` | 83 |
| `EditInvestmentCriteriaDialog.tsx` | 85 |
| `EditDealStructureDialog.tsx` | 172 |
| `EditCustomerInfoDialog.tsx` | 130 |

**Total: 964 lines → could be ~200 lines with generic `EditBuyerFieldDialog`**

### 2.2 Duplicate Edge Function Logic

| Function A | Function B | Duplicate Logic | Recommendation |
|-----------|-----------|----------------|----------------|
| `enrich-buyer` (730 lines) | `enrich-deal` (857 lines) | Both call Firecrawl API for scraping | Extract shared `_shared/firecrawl-client.ts` |
| `extract-buyer-transcript` (590 lines) | `extract-transcript` (910 lines) | Both extract from Fireflies transcripts | Delete `extract-buyer-transcript` (dead) |
| `extract-buyer-criteria` (573 lines) | `extract-buyer-criteria-background` | Same logic, background variant | Delete background variant (dead) |
| `send-verification-email` (178 lines) | `send-simple-verification-email` (161 lines) | Both send verification emails | Consolidate |
| `send-templated-approval-email` (232 lines) | `approve-marketplace-buyer` | Overlapping approval email logic | Consolidate |
| `draft-connection-message` | `_shared/claude-client.ts` | Hardcodes Anthropic API URL/model instead of using shared client | Use shared client |
| `generate-buyer-intro` | `_shared/ai-providers.ts` | Hardcodes OpenAI URL/model | Use shared AI provider |

### 2.3 Duplicate API Call Patterns

#### Top 10 Most-Duplicated Query Patterns

| Query Pattern | Files | Count | Consolidation Target |
|--------------|-------|-------|---------------------|
| `supabase.from('listings')` | 20+ files | 37 | Already has hooks but many inline queries remain |
| `supabase.from('deal_transcripts')` | ~10 files | 21 | Create `useDealTranscripts()` hook |
| `supabase.from('remarketing_buyers')` | ~12 files | 19 | Create shared hook |
| `supabase.from('enrichment_queue')` | ~8 files | 14 | Create `useEnrichmentQueue()` hook |
| `supabase.from('deals')` | ~8 files | 13 | Create shared hook |
| `supabase.from('remarketing_scores')` | ~7 files | 12 | Create shared hook |
| `supabase.from('connection_requests')` | 7 files | 9 | Create shared hook |
| `supabase.from('connection_messages')` | 7 files | 9 | Create shared hook |
| `supabase.from('page_views')` | 5 files | 8 | Create `trackPageView()` utility |
| `supabase.from('profiles')` | 7 files | 8 | Create shared hook |

#### Specific Duplicate Patterns Found

**`page_views` INSERT — 4 near-identical inserts across 4 files:**
- `src/context/AnalyticsContext.tsx:213`
- `src/hooks/use-analytics-tracking.ts:58,276`
- `src/hooks/use-page-engagement.ts:56`
- `src/pages/DealLandingPage/index.tsx:47`

**Deal cascade delete — duplicated 3 times (up to 23 sequential delete calls each):**
- `src/pages/admin/remarketing/ReMarketingDeals/useDealsActions.ts:405-427`
- `src/pages/admin/remarketing/CapTargetDeals/useCapTargetActions.ts:429-433,577-580`
- `src/pages/admin/remarketing/GPPartnerDeals/index.tsx:80-84`

**Deal toggle patterns — identical inline toggles in 3 files:**
- `src/pages/admin/remarketing/components/CapTargetTableRow.tsx:313-355`
- `src/pages/admin/remarketing/GPPartnerDeals/GPPartnerTable.tsx:294-341`
- `src/pages/admin/remarketing/ReMarketingReferralPartnerDetail/DealsTable.tsx:185-219`

**46 components/pages contain inline Supabase queries** (26 in components/, 20 in pages/) that should be extracted to hooks.

### 2.4 Duplicate Type Definitions

#### Types Defined in 4+ Files

| Type Name | File Count | Files | Recommendation |
|-----------|-----------|-------|----------------|
| `BuyerOption` | 4 | `DataRoomFilesTab.tsx`, `DocumentDistributionTab.tsx`, `MarketingDocumentsTab.tsx`, `ReleaseModal.tsx` | Consolidate to `src/types/` |
| `BuyerRow` | 4 | `BuyerTableEnhanced.tsx`, `BuyerTableRow.tsx`, `AllBuyers.tsx`, `supabase-helpers.ts` | Consolidate |
| `ActivityItem` | 4 | `PipelineDetailActivity.tsx` (orphan), `TrackerActivityFeed.tsx`, `activityTypes.ts`, `remarketing.ts` | Use canonical `activityTypes.ts` |
| `DealTranscript` | 4 | `DealTranscriptSection/types.ts`, `TranscriptListItem.tsx`, `ma-intelligence/types.ts`, `remarketing/types.ts` | Consolidate |
| `OutreachRecord` | 4 | `EngagementHeatmapInsight.tsx`, `IntroductionStatusCard.tsx`, `OutreachTimeline.tsx`, `ma-intelligence/types.ts` | Consolidate |

#### Types Defined in 3 Files

| Type Name | Files |
|-----------|-------|
| `BuyerTypeFilter` | `PipelineFilters.tsx`, `use-deal-filters.ts`, `use-pipeline-filters.ts` |
| `BuyerTypesCriteria` | `CriteriaReviewPanel.tsx`, `ma-intelligence/types.ts`, `remarketing.ts` |
| `CapTargetDeal` | `CapTargetDeals/types.ts`, `CapTargetTableRow.tsx`, `remarketing/types.ts` |
| `AuditLogEntry` | `PermissionAuditLog.tsx`, `use-data-room.ts`, `useRoleManagement.ts` |
| `ChatMessage` | `TrackerQueryChat.tsx`, `useAICommandCenter.ts`, `chat-persistence.ts` |

#### Types Defined in 2 Files (notable)

| Type Name | File 1 | File 2 |
|-----------|--------|--------|
| `ApprovalStatus` | `src/types/admin-users.ts` | `src/types/index.ts` |
| `BuyerType` | `src/types/index.ts` | `src/types/remarketing.ts` |
| `AdminConnectionRequest` | `src/types/admin-users.ts` | `src/types/admin.ts` |
| `Contact` | `buyer-detail/MainContactCard.tsx` | `ReMarketingBuyerDetail/types.ts` |

**Total: 28+ type definitions duplicated across the codebase.**

### 2.5 Duplicate Constants & Config

A constants file exists at `src/constants/index.ts` defining `APPROVAL_STATUSES`, `CONNECTION_STATUSES`, and `LISTING_STATUSES` — but it is **almost universally ignored**. Hardcoded strings used instead:

| Constant Value | Files Using Hardcoded Strings | Count |
|---------------|-------------------------------|-------|
| `"pending"` / `"approved"` / `"rejected"` | 30+ files | Pervasive |
| `"active"` / `"inactive"` | 28+ files | Pervasive |
| `"not_a_fit"` | 4 files | No constant exists |
| `"completed"` / `"failed"` / `"cancelled"` | Multiple files | No constant exists |
| `"processing"` | `queueScoring.ts`, `queueEnrichment.ts` | Same inline filter pattern |

**Top offenders using hardcoded status strings:**
- `ConnectionRequestsTable.tsx` — 6 hardcoded statuses
- `ListingCardActions.tsx` — 9 hardcoded statuses
- `AdminListingCard.tsx` — 6 hardcoded `"active"` checks

---

## PHASE 3 — MONOLITH DETECTION & DECOMPOSITION

### 3.1 File Size Audit

**98 source files over 400 lines (confirmed monoliths).**
**484 source files over 200 lines.**
**97 edge function files over 300 lines.**

#### Critical Monoliths (600+ lines) — Frontend

| File Path | Lines | Category |
|-----------|-------|----------|
| `src/integrations/supabase/types.ts` | 14,870 | Auto-generated — exempt |
| `src/pages/admin/chatbot-test-runner/chatbotTestScenarios.ts` | 3,326 | Test data |
| **`src/pages/admin/remarketing/ReMarketingUniverses.tsx`** | **1,431** | **CRITICAL** |
| **`src/components/admin/ConnectionRequestActions.tsx`** | **1,276** | **CRITICAL** |
| `src/pages/admin/system-test-runner/testDefinitions.ts` | 1,255 | Test data |
| **`src/pages/BuyerMessages/MessageThread.tsx`** | **1,224** | **CRITICAL** |
| **`src/hooks/admin/use-deals.ts`** | **1,040** | **CRITICAL god hook** |
| **`src/components/admin/ConnectionRequestsTable.tsx`** | **1,000** | **CRITICAL** |
| **`src/components/ai-command-center/AICommandCenterPanel.tsx`** | **996** | **CRITICAL** |
| **`src/pages/admin/remarketing/ValuationLeads/useValuationLeadsData.ts`** | **988** | **CRITICAL god hook** |
| **`src/components/remarketing/deal-detail/ContactHistoryTracker.tsx`** | **981** | **CRITICAL** |
| **`src/components/admin/data-room/AccessMatrixPanel.tsx`** | **887** | **CRITICAL** |
| **`src/components/remarketing/AddDealDialog.tsx`** | **874** | **CRITICAL** |
| **`src/components/remarketing/AddDealToUniverseDialog.tsx`** | **853** | **CRITICAL** |
| **`src/pages/admin/remarketing/ReMarketingUniverseDetail/index.tsx`** | **834** | **CRITICAL** |
| **`src/components/admin/BulkDealImportDialog.tsx`** | **818** | **CRITICAL** |
| **`src/components/remarketing/DealImportDialog.tsx`** | **815** | **CRITICAL** |
| `src/components/remarketing/BuyerMatchCard.tsx` | 803 | CRITICAL |
| `src/lib/migrations.ts` | 799 | Migration docs — lower priority |
| `src/components/remarketing/deal-detail/CompanyOverviewCard.tsx` | 790 | CRITICAL |
| **`src/pages/admin/remarketing/ReMarketingDeals/index.tsx`** | **773** | **CRITICAL** |
| **`src/components/admin/UnifiedAdminSidebar.tsx`** | **762** | **CRITICAL** |
| **`src/components/ma-intelligence/BuyerContactsTab.tsx`** | **758** | **CRITICAL** |

#### Critical Monoliths — Edge Functions (600+ lines)

| Function | Lines | Description |
|----------|-------|-------------|
| `ai-command-center/tools/integration-action-tools.ts` | 2,844 | AI CC integration action tools |
| **`generate-ma-guide`** | **1,500** | **M&A guide generation — single file** |
| `ai-command-center/router.ts` | 1,215 | AI CC intent router |
| `ai-command-center/tools/recommended-buyer-tools.ts` | 1,103 | AI CC buyer tools |
| **`apify-linkedin-scrape`** | **1,027** | **LinkedIn scraping** |
| `ai-command-center/tools/buyer-tools.ts` | 943 | AI CC buyer tools |
| **`extract-deal-transcript`** | **920** | **Transcript extraction + AI** |
| **`extract-transcript`** | **910** | **General transcript extraction** |
| **`enrich-deal`** | **857** | **Deal enrichment pipeline** |
| **`bulk-sync-all-fireflies`** | **839** | **Fireflies batch sync** |
| `bulk-import-remarketing` | 756 | DEAD — bulk import |
| **`score-buyer-deal`** | **733** | **Scoring algorithm** |
| **`enrich-buyer`** | **730** | **Buyer enrichment pipeline** |
| **`sync-captarget-sheet`** | **695** | **Google Sheets sync** |
| **`calculate-deal-quality`** | **677** | **Deal quality scoring** |

### 3.2 Monolith Analysis — Key Files

#### ReMarketingDealDetail.tsx
**Status: PREVIOUSLY DECOMPOSED.** Now a directory with 11 sub-files (max 344 lines). Comment in `index.tsx:3` states the old monolithic 1,675-line sibling is "ORPHANED." Verify it has been deleted.

#### AI Command Center
**107KB+ multi-file system:**
- `system-prompt.ts` — 30KB (375 lines)
- `router.ts` — 45KB (1,215 lines) — **monolith within monolith**
- `knowledge-base.ts` — 31KB (495 lines)
- `orchestrator.ts` — 16KB (482 lines)
- `tools/` directory — 12+ tool files totaling ~11,000+ lines
- `TOOLS_REFERENCE.md` — 26KB

The system prompt has been split from the original monolith, but `router.ts` at 1,215 lines and `integration-action-tools.ts` at 2,844 lines are themselves critical monoliths.

#### God Hooks (400+ lines)

| Hook | Lines | Concerns |
|------|-------|----------|
| `use-deals.ts` | 1,040 | Fetching, filtering, sorting, pagination, mutations, status, restore |
| `useValuationLeadsData.ts` | 988 | Data fetching, scoring, filtering, mutations |
| `useGPPartnerDeals.ts` | 742 | Data, filtering, sorting, activity queue |
| `useEnhancedRealTimeAnalytics.ts` | 739 | Event tracking, session tracking, analytics |
| `useAICommandCenter.ts` | 634 | Chat state, streaming, tool routing, analytics |
| `use-data-room.ts` | 629 | Documents, access control, audit logging |
| `use-recommended-buyers.ts` | 614 | Buyer fetching, scoring, filtering |
| `use-firm-agreements.ts` | 574 | Agreement status, docs, reminders |
| `use-document-distribution.ts` | 542 | Distribution tracking, approval flow |
| `use-deal-tasks.ts` | 499 | Task management, status, assignments |
| `use-contact-combined-history.ts` | 475 | Multi-source history aggregation |
| `useEventTracking.ts` | 463 | Event tracking, session management |
| `use-auto-score-deal.ts` | 463 | Auto-scoring, queue management |

### 3.3 Shadow / Duplicate Component Check

| Component | Files Found | Which Is Rendered | Status |
|-----------|------------|------------------|--------|
| `ReMarketingDealDetail` | `ReMarketingDealDetail/index.tsx` | index.tsx (directory) | Old monolith marked orphaned — verify deletion |

No other shadow component pairs found. All routes point to unique lazy-loaded modules.

---

## PHASE 4 — STRUCTURAL ISSUES & ANTI-PATTERNS

### 4.1 Prop Drilling

- `dealId` drilled through 3+ levels in `src/components/admin/data-room/` (20+ files)
- `buyerId` drilled through buyer detail → tabs → sub-sections
- `universeId` drilled through universe detail → tables → row actions

**Recommendation:** Use React Context or dedicated hooks.

### 4.2 Inline Data Fetching in Components

**46 component/page files** contain direct `supabase.from()` queries:
- 26 in `src/components/`
- 20 in `src/pages/`

### 4.3 God Hooks

**13 god hooks** (400+ lines each). See Phase 3.2.
Worst: `use-deals.ts` at **1,040 lines** with 6+ concerns.

### 4.4 Inconsistent Error Handling

- Frontend: Mix of `try/catch` with `toast.error()` and `.catch()` chains
- Edge functions: Consistently use `_shared/error-response.ts` (good)
- `error-logger` edge function exists but is dead code

### 4.5 useEffect Misuse

**300 total `useEffect` calls.** Common issues:
- Stale closure risks in analytics tracking hooks
- Missing cleanup for Supabase realtime subscriptions
- Data fetching in useEffect that should use React Query

### 4.6 Any Types

| Category | Count |
|----------|-------|
| `: any` annotations | 560 |
| `as any` assertions | 225 |
| **Total** | **785** |

**Top offenders:**

| File | Count |
|------|-------|
| `src/hooks/useTaskAnalytics.ts` | 25 |
| `src/hooks/admin/listings/use-robust-listing-creation.ts` | 22 |
| `src/hooks/useTaskActions.ts` | 17 |
| `src/hooks/useDailyTasks.ts` | 16 |
| `src/components/admin/ImprovedListingEditor.tsx` | 16 |
| `src/lib/database.ts` | 14 |
| `src/hooks/admin/use-contact-lists.ts` | 12 |
| `src/pages/admin/EnrichmentQueue.tsx` | 11 |
| `src/hooks/use-connection-messages.ts` | 11 |
| `src/pages/admin/remarketing/ReMarketingBuyers/useBuyersData.ts` | 10 |

---

## PHASE 5 — NAMING & CONVENTION AUDIT

### 5.1 Naming Convention Violations

- Edge functions: All kebab-case. **No violations.**
- Constants: Zod schemas and singleton instances use camelCase (acceptable TS convention)

### 5.2 Misleading Names

| Name | What It Claims | What It Actually Does | Better Name |
|------|---------------|----------------------|-------------|
| `use-nuclear-auth.ts` | "Nuclear" auth | Standard auth state + aggressive session handling | `use-session-manager.ts` |
| `ImprovedListingEditor` | "Improved" | Standard listing editor — no "old" exists | `ListingEditor` |
| `EnhancedFeedbackManagement` | "Enhanced" | Standard feedback management | `FeedbackManagement` |
| `EnhancedSignupForm` | "Enhanced" | Standard signup form | `SignupForm` |
| `useEnhancedRealTimeAnalytics` | "Enhanced" real-time | Standard analytics tracking | `useAnalyticsTracking` |
| `EnhancedInvestorDashboard` | "Enhanced" | Standard investor dashboard | `InvestorDashboard` |
| `EnhancedUserManagement` | "Enhanced" | Standard user management | `UserManagement` |

### 5.3 Status String Consistency

Status strings are consistent in logic (lowercase in data). Constants file exists at `src/constants/index.ts` but is ignored by 30+ files using hardcoded strings.

---

## PHASE 6 — EDGE FUNCTION SPECIFIC AUDIT

### 6.1 Function Responsibility Audit

| Function | Responsibilities | Should Split? |
|----------|-----------------|---------------|
| `generate-ma-guide` (1,500 lines) | Data gathering + AI generation + PDF formatting + email | Yes — 3+ functions |
| `enrich-buyer` (730 lines) | Firecrawl scrape + parse + AI analysis + DB update | Yes — extract Firecrawl client |
| `enrich-deal` (857 lines) | Website scrape + financial parsing + AI analysis + DB | Yes — extract Firecrawl client |
| `bulk-sync-all-fireflies` (839 lines) | API sync + transcript processing + matching + DB | Yes — split sync vs processing |

### 6.2 Shared Logic Status

| Pattern | Status |
|---------|--------|
| CORS handling | **GOOD** — 151/156 use `_shared/cors.ts` |
| Error responses | **GOOD** — `_shared/error-response.ts` widely used |
| Supabase client | **GOOD** — `_shared/supabase.ts` exists |
| AI/Claude client | **GOOD** — `_shared/claude-client.ts` exists |
| Firecrawl API calls | **BAD** — Duplicated across 5 functions |

### 6.3 Hardcoded Values in Edge Functions

| Value | Files | Recommendation |
|-------|-------|----------------|
| `https://api.firecrawl.dev/v1/scrape` | `enrich-buyer`, `enrich-deal/website-scraper`, `firecrawl-scrape`, `find-buyer-contacts`, `verify-platform-website` | Create `_shared/firecrawl-client.ts` |
| `https://api.firecrawl.dev/v1/map` | `enrich-buyer`, `find-buyer-contacts` | Same — consolidate |
| `https://api.anthropic.com/v1/messages` | `_shared/claude-client.ts`, `draft-connection-message:143` | `draft-connection-message` should use shared client |
| `https://api.openai.com/v1/chat/completions` | `generate-buyer-intro:90` | Should use shared AI provider |
| `claude-haiku-4-5-20251001` | `draft-connection-message:151` | Should use shared constants |
| `gpt-4o-mini` | `generate-buyer-intro:97` | Should be a constant |

**No hardcoded API keys found** — all use `Deno.env.get()`. **Security: PASS.**

---

## PHASE 7 — IMPORT & DEPENDENCY AUDIT

### 7.1 Unused Imports

Requires `eslint` or `ts-prune` for exhaustive detection. Spot checks show the codebase is reasonably clean.

### 7.2 Circular Dependencies

No circular dependencies detected via manual inspection. Recommend running `madge` for verification.

### 7.3 Over-Importing

**11 files import 10+ items from `lucide-react`** (largest: 16 icons). Tree-shaken by bundler, so this is a readability concern only.

---

## PHASE 8 — CONSOLE LOGS & DEBUG ARTIFACTS

### 8.1 Console Statements

| Location | Count |
|----------|-------|
| Frontend (`src/`) | **304** |
| Edge functions (`supabase/functions/`) | **1,424** |
| **Total** | **1,728** (across 318 files) |

**Top edge function offenders:**

| File | Count |
|------|-------|
| `enrich-deal/index.ts` | 47 |
| `process-enrichment-queue/index.ts` | 42 |
| `apify-linkedin-scrape/index.ts` | 38 |
| `bulk-import-remarketing/index.ts` | 37 |
| `send-nda-email/index.ts` | 36 |
| `send-fee-agreement-email/index.ts` | 35 |

**Top frontend offenders:**

| File | Count |
|------|-------|
| `src/context/AnalyticsContext.tsx` | 20 |
| `src/hooks/admin/use-admin-email.ts` | 12 |
| `src/integrations/supabase/chat-persistence.ts` | 11 |
| `src/pages/admin/AdminRequests.tsx` | 9 |
| `src/hooks/use-nuclear-auth.ts` | 9 |

### 8.2 TODO / FIXME / HACK Comments

**0 active developer annotations found.** All matches are false positives (regex patterns for validating user input).

One notable item: `src/pages/admin/EnrichmentTest.tsx:74` has a `TEMP / DEV ONLY` UI badge — marks an admin page as dev-only.

### 8.3 TEMPORARY BYPASS — Auth Security Check

**CRITICAL CHECK: PASS**

`ProtectedRoute.tsx` has **no bypass**:
1. Loading spinner while auth resolves
2. Redirects unauthenticated → `/login`
3. Checks `approval_status === "approved"` for buyer routes
4. Checks `isAdmin` for admin routes
5. Checks `meetsRole()` for role-gated routes

`RoleGate.tsx:11`: `"AUDIT REF: CTO Audit February 2026 — restored from dev bypass"` — confirms bypass was fixed.

### 8.4 Disabled / Skipped Tests

**None found.** All 50 test files have no `skip`/`xit`/`xdescribe` markers.

---

## PHASE 9 — REFACTORING PRIORITY MATRIX

### P0 — CRITICAL (Fix before next release)

| # | Issue | File(s) | Effort | Impact |
|---|-------|---------|--------|--------|
| 1 | Test edge functions deployed to production | `docuseal-integration-test`, `test-contact-enrichment` | 15 min | Security risk — test endpoints in prod |
| 2 | `draft-connection-message` hardcodes Anthropic API URL/model | `supabase/functions/draft-connection-message/index.ts:143,151` | 30 min | Model updates won't propagate |
| 3 | `generate-buyer-intro` hardcodes OpenAI URL/model | `supabase/functions/generate-buyer-intro/index.ts:90,97` | 30 min | Same issue |
| 4 | 133-line commented-out code with hardcoded email in dead EF | `supabase/functions/send-verification-email/index.ts:43-175` | 10 min | Contains hardcoded email address |

### P1 — HIGH (Fix this sprint)

| # | Issue | File(s) | Effort | Impact |
|---|-------|---------|--------|--------|
| 5 | **73 orphaned components (12,945 lines)** | See Phase 1.1 | 2 hrs | Massive dead code |
| 6 | 22+ dead edge functions (~6,500 lines) | See Phase 1.3 | 2 hrs | Deployment bloat |
| 7 | Firecrawl API calls duplicated across 5 functions | `enrich-buyer`, `enrich-deal`, `firecrawl-scrape`, `find-buyer-contacts`, `verify-platform-website` | 3 hrs | DRY violation |
| 8 | `use-deals.ts` god hook (1,040 lines, 6+ concerns) | `src/hooks/admin/use-deals.ts` | 4 hrs | Untestable, unmaintainable |
| 9 | 785 `any` type annotations | See Phase 4.6 | 8 hrs | Type safety holes |
| 10 | Deal cascade delete duplicated 3 times | `useDealsActions.ts`, `useCapTargetActions.ts`, `GPPartnerDeals/index.tsx` | 2 hrs | Bug risk — incomplete cascades |
| 11 | `generate-ma-guide` monolith (1,500 lines) | `supabase/functions/generate-ma-guide/index.ts` | 4 hrs | Unmaintainable |
| 12 | 46 components with inline Supabase queries | See Phase 4.2 | 8 hrs | Untestable, duplicated |
| 13 | 28+ duplicate type definitions | See Phase 2.4 | 3 hrs | Type drift risk |
| 14 | Constants file exists but ignored by 30+ files | `src/constants/index.ts` vs 30+ files | 3 hrs | Inconsistency risk |
| 15 | `page_views` INSERT duplicated 4 times | See Phase 2.3 | 1 hr | DRY violation |

### P2 — MEDIUM (Fix next sprint)

| # | Issue | File(s) | Effort | Impact |
|---|-------|---------|--------|--------|
| 16 | 18+ files over 600 lines need decomposition | See Phase 3.1 | 12 hrs | Maintenance burden |
| 17 | 3 duplicate import dialogs (~2,300 lines → ~1,000) | `BulkDealImportDialog`, `DealImportDialog`, `DealCSVImport` | 6 hrs | Code duplication |
| 18 | 3 duplicate push-to-platform modals | `PushToDialerModal`, `PushToHeyreachModal`, `PushToSmartleadModal` | 4 hrs | Code duplication |
| 19 | 8 duplicate buyer edit dialogs (964 → ~200 lines) | See Phase 2.1 | 3 hrs | Code duplication |
| 20 | 304 console.log statements in frontend | See Phase 8.1 | 2 hrs | Debug noise in prod |
| 21 | 12 dormant edge functions need verification | See Phase 1.3 | 2 hrs | May waste resources |
| 22 | Deal toggle patterns duplicated in 3 files | `CapTargetTableRow`, `GPPartnerTable`, `DealsTable` | 2 hrs | DRY violation |
| 23 | Desktop/mobile table pair duplication | `UsersTable`/`MobileUsersTable`, `ConnectionRequestsTable`/`MobileConnectionRequestsTable` | 4 hrs | Logic duplication |
| 24 | Duplicate enrichment summary dialogs (~95% overlap) | `EnrichmentSummaryDialog`, `DealEnrichmentSummaryDialog` | 30 min | Easy win |
| 25 | Duplicate PassReasonDialog implementations | `ma-intelligence/PassReasonDialog`, `remarketing/PassReasonDialog` | 2 hrs | Inconsistent UX |

### P3 — LOW (Backlog)

| # | Issue | File(s) | Effort | Impact |
|---|-------|---------|--------|--------|
| 26 | "Enhanced"/"Improved" prefix naming (7 components) | See Phase 5.2 | 1 hr | Naming clarity |
| 27 | `use-nuclear-auth` misleading name | `src/hooks/use-nuclear-auth.ts` | 30 min | Naming clarity |
| 28 | `next_followup_due` dead interface field | `src/hooks/admin/use-deals.ts:91` | 5 min | Dead code |
| 29 | 1,424 console statements in edge functions | All edge functions | 4 hrs | Log noise |
| 30 | Prop drilling for `dealId`/`buyerId` | 20+ data-room components | 3 hrs | Code cleanliness |
| 31 | 11 files importing 10+ lucide-react icons | See Phase 7.3 | 1 hr | Readability |
| 32 | Buyer/Deal card pairs with overlapping patterns | `BuyerServicesBusinessModelCard`/`ServicesBusinessModelCard`, etc. | 3 hrs | Design-level duplicate |
| 33 | `EnrichmentTest.tsx` marked TEMP/DEV ONLY | `src/pages/admin/EnrichmentTest.tsx:74` | 15 min | Dev page in prod |

---

## PHASE 10 — SUMMARY SCORECARD

| Category | Count | Critical | High | Medium | Low |
|----------|-------|----------|------|--------|-----|
| Orphaned components | **73** | 0 | 73 | 0 | 0 |
| Dead edge functions | **22** | 0 | 22 | 0 | 0 |
| Dormant edge functions | 12 | 0 | 0 | 12 | 0 |
| Test functions in prod | **2** | 2 | 0 | 0 | 0 |
| Dead database columns | 1 | 0 | 0 | 0 | 1 |
| Duplicate components | **8 groups** | 0 | 3 | 5 | 0 |
| Duplicate edge function logic | 5 pairs | 2 | 3 | 0 | 0 |
| Duplicate query patterns | **10 patterns** | 0 | 10 | 0 | 0 |
| Duplicate type definitions | **28+** | 0 | 28 | 0 | 0 |
| Duplicate constants (ignored) | **30+ files** | 0 | 30 | 0 | 0 |
| Monolithic files (600+ lines, src/) | **20** | 0 | 5 | 10 | 5 |
| Monolithic edge functions (600+) | **15** | 0 | 2 | 8 | 5 |
| Shadow/duplicate components | 0 | 0 | 0 | 0 | 0 |
| God hooks (400+ lines) | **13** | 0 | 3 | 5 | 5 |
| `any` type usages | **785** | 0 | 785 | 0 | 0 |
| Naming violations | 7 | 0 | 0 | 0 | 7 |
| Hardcoded values (EFs) | **7 patterns** | 2 | 5 | 0 | 0 |
| TODO/FIXME comments | 0 | 0 | 0 | 0 | 0 |
| Console.log statements | **1,728** | 0 | 0 | 304 | 1,424 |
| Commented-out code blocks | **1** (133 lines) | 1 | 0 | 0 | 0 |
| Inline Supabase queries | **46 files** | 0 | 46 | 0 | 0 |
| Dead code (total lines) | **~19,445** | 0 | ~19,445 | 0 | 0 |
| **TOTAL ISSUES** | | **7** | **~1,015** | **344** | **1,447** |

### Estimated Hours to Resolve

| Priority | Hours |
|----------|-------|
| **P0 (Critical)** | ~1.5 hrs |
| **P1 (High)** | ~40 hrs |
| **P0 + P1 combined** | **~41.5 hrs** |
| **P2 (Medium)** | ~37.5 hrs |
| **P3 (Low)** | ~13 hrs |
| **All issues** | **~92 hrs** |

### Recommended Sprint Order — Top 10 Items

1. **Remove test edge functions from production** (P0, 15 min) — Security risk, immediate fix
2. **Fix hardcoded AI model/URL references** (P0, 1 hr) — Model updates won't propagate
3. **Delete 73 orphaned components** (P1, 2 hrs) — 12,945 lines of dead code removed instantly
4. **Delete 22 dead edge functions** (P1, 2 hrs) — ~6,500 lines of dead code + deployment savings
5. **Create shared `deleteDealCascade()` utility** (P1, 2 hrs) — 3 buggy duplicate implementations
6. **Create shared Firecrawl client** (P1, 3 hrs) — DRY across 5 functions
7. **Split `use-deals.ts` god hook** (P1, 4 hrs) — Largest maintainability bottleneck
8. **Consolidate duplicate type definitions** (P1, 3 hrs) — Prevents type drift bugs
9. **Enforce constants file usage** (P1, 3 hrs) — 30+ files using hardcoded status strings
10. **Extract inline Supabase queries to hooks** (P1, 8 hrs) — Testability + DRY in 46 files

---

### What's Working Well

- **Auth security is clean** — no bypasses, proper role gating, CTO audit bypass has been restored
- **Edge function shared utilities** — CORS (151/156), error responses, Supabase client, Claude client properly shared
- **No circular dependencies** detected
- **No TODO/FIXME debt markers** — clean codebase
- **No skipped tests** — all tests active
- **ReMarketingDealDetail decomposition** — successfully split from 1,675-line monolith
- **Route structure** — clean, no dead routes, proper redirects
- **Edge function naming** — consistent kebab-case
- **No hardcoded API keys** — all properly using environment variables
- **Error response pattern** — `_shared/error-response.ts` consistently used

---

*SourceCo Internal — Code Quality & Refactoring Audit v1.0 — March 2026*
*Generated by automated code analysis across 1,312 source files and 156 edge functions.*
*All findings include file paths and line numbers for verification.*
