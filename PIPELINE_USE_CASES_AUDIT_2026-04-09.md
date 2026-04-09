# Pipeline Use Cases Audit — 2026-04-09

Inventory of every "pipeline" concept in connect-market-nexus: what
pipelines exist, who uses them, how they interact, and where the wiring
is incomplete. Scope is deliberately descriptive; remediation is listed
but not prescribed.

## Summary

The codebase uses the word *pipeline* for five distinct things. Three are
user-facing workflows, one is a metadata enum that is almost unused, and
one is a back-end data-enrichment executor. The three user-facing
pipelines are largely independent: there is only one automatic sync
trigger between any pair of them, and one planned-but-unimplemented
handoff from portal to deal pipeline.

| # | Pipeline | Kind | Primary table(s) | Users |
|---|----------|------|------------------|-------|
| 1 | Deal Pipeline | Workflow (Kanban/List/Table) | `deal_pipeline`, `deal_stages`, `deals` | Admins |
| 2 | Buyer Introduction Pipeline | Workflow (Kanban) | `buyer_introductions`, `introduction_status_log` | Admins |
| 3 | Portal Deal Push Pipeline | Workflow (distribution + response) | `portal_deal_pushes`, `portal_deal_responses` | Admins + portal users |
| 4 | Listing Pipeline Status | Metadata enum | (enum only, `ListingPipelineStatus`) | System (mostly dormant) |
| 5 | Enrichment Pipeline | Back-end step executor | `supabase/functions/_shared/enrichment/pipeline.ts` | System (async) |

## 1. Deal Pipeline (admin-facing deal flow)

### What it is
The primary admin tool for moving individual deals through sales
stages. A deal has exactly one stage at a time. Stages are stored as
rows in `deal_stages` (ordered by `position`), and deals reference them
via `deals.stage_id` (denormalised) and `deal_pipeline.stage_id`.

### Code map
- `src/components/admin/pipeline/PipelineShell.tsx` — top-level page shell
- `src/components/admin/pipeline/PipelineWorkspace.tsx` — view switcher
- `src/components/admin/pipeline/views/PipelineKanbanView.tsx`
- `src/components/admin/pipeline/views/PipelineListView.tsx`
- `src/components/admin/pipeline/views/PipelineTableView.tsx`
- `src/components/admin/pipeline/PipelineDetailPanel.tsx` (+ `tabs/`)
- `src/components/admin/pipeline/PipelineFilterPanel.tsx`, `PipelineHeader.tsx`
- `src/hooks/admin/use-pipeline-core.ts` — `ViewMode = 'kanban' | 'list' | 'table'`, metrics
- `src/hooks/admin/use-pipeline-filters.ts`, `use-pipeline-views.ts`
- `src/pages/admin/AdminPipeline.tsx` — route entry
- `src/config/pipeline-features.ts` — feature flags (all currently `false`)

### Stages (current state)
Stage history is churny. Tracing the migrations in chronological
(filename) order:

1. `20250829*` — initial seeding of ~10 stages.
2. `20251002202941` — adds `NDA + Agreement Sent` and `Negotiation`,
   sets 12 positions 0–11 with ascending probabilities.
3. `20251112174742` — **hard-deletes** `Approved` and `Negotiation`.
4. `20251112180457` — renames `Initial Review` to `Follow-up`.
5. `20260223033733` — renames `New Inquiry` to `Approved`, reshuffles
   positions 0–9 (adds `Owner intro requested`), deactivates `Follow-up`
   and `NDA + Agreement Sent`.
6. `20260527000000_reactivate_pipeline_stages.sql` — despite the file
   name, this **deletes** `Follow-up` and `NDA + Agreement Sent` by
   UUID. The header comment openly contradicts the file name ("Remove
   the deactivated … stages permanently").

**Resulting active stages (as of the latest migration):**

| Pos | Name | Notes |
|----:|------|-------|
| 0 | Approved | Renamed from `New Inquiry` |
| 1 | Info Sent | |
| 2 | Owner intro requested | |
| 3 | Buyer/Seller Call | |
| 4 | Due Diligence | |
| 5 | LOI Submitted | |
| 6 | Closed Won | `stage_type = 'closed_won'` |
| 7 | Closed Lost | `stage_type = 'closed_lost'` |

Anyone reading the code today would reasonably assume from the stage
seeder at `supabase/migrations/20251002202941_...sql:6-26` that 12
stages exist. The later migrations that removed four of them are
scattered and one is literally misnamed. This is a concrete
documentation hazard — see *Findings* §1.

### Use cases
- **Manual advancement.** Admins drag-drop cards on the Kanban, change
  the stage via the list view, or edit the detail panel. There is no
  automated transition — e.g. signing an NDA does not move a deal out
  of `Approved`.
- **Terminal sync to buyer introductions.** When
  `deal_pipeline.stage_id` changes to a `closed_won` / `closed_lost`
  stage *and* the row has a non-null `buyer_introduction_id`, the
  trigger `sync_pipeline_close_to_introduction` (defined in
  `supabase/migrations/20260616000000_pipeline_introduction_fixes.sql:29-54`)
  updates the referenced buyer introduction to `deal_created` — but
  only if its current status is `fit_and_interested`. This is the only
  automatic link between any two pipelines.
- **Traceability.** `deal_pipeline.buyer_introduction_id` was added in
  `20260616000000_pipeline_introduction_fixes.sql:5-6` so deals created
  from a buyer intro carry a pointer back to the origin intro.

### Feature flags
`src/config/pipeline-features.ts` gates customisation features:

```
customViews: false
stageLibrary: false
stageCustomization: false   // add/remove stages
stageReordering: false
```

Disabled message: *"Admin disabled these features. To enable, contact
Adam."* — i.e. the UI is built but the functionality is switched off.

## 2. Buyer Introduction Pipeline (admin-facing buyer funnel)

### What it is
A per-listing Kanban board that tracks individual prospective buyers
from "haven't shown them the deal yet" to "interested / not a fit /
deal created". Parallel to the deal pipeline, not a subset of it.

### Code map
- `src/components/admin/deals/buyer-introductions/BuyerIntroductionPage.tsx`
- `src/components/admin/deals/buyer-introductions/kanban/KanbanBoard.tsx`
- `src/components/admin/deals/buyer-introductions/kanban/KanbanColumn.tsx`
- `src/components/admin/deals/buyer-introductions/kanban/BuyerKanbanCard.tsx`
- `src/components/admin/deals/buyer-introductions/kanban/KanbanEmptyState.tsx`
- `src/components/admin/deals/buyer-introductions/hooks/use-introduction-pipeline.ts`
- `src/components/admin/deals/buyer-introductions/hooks/use-approve-for-pipeline.ts`
- `src/hooks/use-buyer-introductions.ts` (data fetching)

### Schema
- `buyer_introductions` — main row (one per buyer per listing); columns
  include `introduction_status`, `introduction_date`, `passed_date`,
  `score_snapshot`, `remarketing_buyer_id`.
- `introduction_status_log` — audit log of status transitions.
- `introduction_activity` — **removed** in
  `20260616000000_pipeline_introduction_fixes.sql:8-10` ("replaced by
  `introduction_status_log`"). No code still references it.

### Statuses
From `src/types/status-enums.ts:45-60`:

```
need_to_show_deal → outreach_initiated → meeting_scheduled →
fit_and_interested → deal_created
                                    ↘ not_a_fit
```

Six values total. The Kanban column logic in
`use-introduction-pipeline.ts` collapses these into four columns
(to-introduce / introduced / interested / passed).

### Use cases
- Admin curates a set of buyers per listing and tracks outreach state.
- `use-approve-for-pipeline.ts` promotes an intro into the deal
  pipeline (creates a `deal_pipeline` row keyed back via
  `buyer_introduction_id`).
- Passive reverse sync: when that deal eventually closes, the intro is
  marked `deal_created` (see §1).

## 3. Portal Deal Push Pipeline (external buyer distribution)

### What it is
A distribution workflow for sharing deals with external buyer
organisations via the client portal. The admin pushes a deal to a
`portal_organization`; portal users in that org see it, react, and
their responses flow back.

### Schema
Defined primarily in
`supabase/migrations/20260617000000_client_portal_tables.sql`:

- `portal_organizations` — buyer-side org (status: `active | paused |
  archived`; preferences, notification frequency, auto-reminder config)
- `portal_deal_pushes` — one row per (listing, portal_org) push;
  carries `status`, `priority`, `deal_snapshot`
- `portal_deal_responses` — one row per portal user response
- `portal_notifications` — outbound notification queue
- `portal_activity_log` — audit log

### Enums
From `src/types/portal.ts`:

```
PortalDealPushStatus  = pending_review | viewed | interested | passed
                      | needs_info | under_nda | archived          (7)
PortalResponseType    = interested | pass | need_more_info          (3)
PortalActivityAction  = deal_pushed | deal_viewed | response_submitted
                      | document_downloaded | message_sent | login
                      | settings_changed | reminder_sent
                      | user_invited | user_deactivated
                      | portal_created | portal_archived
                      | converted_to_pipeline                      (13)
```

Note the three-value `PortalResponseType` — the migration
`20260624000000_portal_cleanup_unused_response_types.sql` exists
specifically to strip out response types that were defined but never
used.

### Code map
- `src/hooks/portal/use-portal-deals.ts` — `usePortalDealPushes`,
  `useMyPortalDeals`, `usePortalDealPush`
- `src/pages/admin/client-portals/ClientPortalDetail.tsx` — admin view
- `src/components/portal/*` — portal UI (badges, dialogs, modals)

### Use cases
- **Admin side**: create portal orgs, invite portal users, push deals,
  review responses, send reminders.
- **Portal user side**: receive notifications, view deal teasers,
  submit interest / pass / more-info responses.

## 4. Listing Pipeline Status (metadata enum, near-dead)

`src/types/status-enums.ts:9-24` defines `ListingPipelineStatus`:

```
lead | qualified | engaged | active | marketplace | closed
```

This is conceptually a sixth-stage coarse lifecycle for listings,
parallel to the deal stages above. It is not rendered by the Deal
Pipeline UI and is not wired into the buyer intro or portal
workflows. In the current codebase it surfaces mainly in remarketing
queries and enrichment state-tracking — i.e. as a filter/attribute, not
as a user-driven workflow. It is a latent concept worth either killing
or formalising (see *Findings* §4).

## 5. Enrichment Pipeline (back-end executor, not a workflow)

`supabase/functions/_shared/enrichment/pipeline.ts` is a generic
ordered step runner used by edge functions such as `enrich-deal` and
`enrich-buyer`. It has nothing to do with user-visible stage concepts.
Noting it here only to disambiguate the vocabulary.

## Cross-pipeline integration map

```
                  deal_pipeline ───(closed_won/lost)──▶ buyer_introductions
                        ▲                                       │
                        │  approve-for-pipeline (explicit)      │
                        └───────────────────────────────────────┘
                        ▲
                        │  converted_to_pipeline (planned, NOT IMPLEMENTED)
                        │
                  portal_deal_pushes ◀── portal_deal_responses
```

- **Intro → Deal**: `use-approve-for-pipeline.ts` creates a
  `deal_pipeline` row from an intro. Explicit, user-driven.
- **Deal close → Intro status**: automatic via
  `sync_pipeline_close_to_introduction` trigger.
- **Portal → Deal**: intended but not wired. See Findings §3.

## Findings

### 1. Stage history is documented by migration names that lie
`20260527000000_reactivate_pipeline_stages.sql` actually *deletes*
stages. `20260223033733` does several independent things (rename,
renumber, deactivate) in one file. A new engineer looking at
`20251002202941` would assume 12 active stages; the real number is 8.

**Recommendation**: add a one-file seed snapshot migration, or at
minimum a short `docs/deal-stages.md` pinned to the current list, and
rename the 20260527 file. (Any rename must be accompanied by a
`schema_migrations` fixup; call it out explicitly if this is done.)

### 2. `introduction_activity` is fully orphaned (resolved)
Dropped in `20260616000000_pipeline_introduction_fixes.sql:8-10`, no
live code references, no outstanding RLS or view dependencies. Nothing
to do; noted for completeness.

### 3. Portal → Deal conversion is typed but not implemented
`PortalActivityAction` in `src/types/portal.ts:50` includes
`'converted_to_pipeline'`, and `portal_activity_log.action` allows it
in the DB CHECK constraint. No code path emits this action, and there
is no UI or mutation to move an interested portal push into
`deal_pipeline`. Either:
- build the handoff (create a `deal_pipeline` row + intro row + log a
  `converted_to_pipeline` activity), or
- remove the dead enum value and migration CHECK entry.

Ambiguity if built: which deal stage should a converted push land in?
Portal push statuses (`pending_review`, `viewed`, `interested`, …) do
not map 1:1 onto deal stages (`Approved`, `Info Sent`, …). This is a
product decision, not a code one.

### 4. `ListingPipelineStatus` is a parallel workflow concept that no
workflow consumes
It is imported in remarketing and enrichment code but does not drive
any Kanban/list rendering or state transitions. Either formalise it
(give it a UI, transitions, audit log) or delete it and fold whatever
filter purposes remain into existing fields. Current state — a
typed-but-unwired enum — is a classic dead-code vector.

### 5. No dedicated audit log for deal stage changes
Compare with buyer introductions (`introduction_status_log`) and
portal (`portal_activity_log`). Deal stage changes leave side-effects
(task creation, triggers) but no first-class history row. This is
flagged in `TASK_WORKFLOW_COMPREHENSIVE_AUDIT_2026-04-07.md` as a
workflow-automation blocker; noting it again here because the same
gap shows up from the pipeline angle.

### 6. Stage names are hardcoded in downstream automations
`TASK_WORKFLOW_COMPREHENSIVE_AUDIT_2026-04-07.md` already documents
this. Adding here: because the stage list has churned four times in
seven months, any SQL that matches stages by literal name is fragile
by construction. `stage_type` (`active | closed_won | closed_lost`) is
the only stable coarse categorisation.

### 7. `PipelineKanbanView` vs buyer-intro `KanbanBoard` duplication
There are two independent Kanban implementations
(`src/components/admin/pipeline/views/PipelineKanbanView.tsx` and
`src/components/admin/deals/buyer-introductions/kanban/KanbanBoard.tsx`).
Different data sources, but the drag-drop/column layer could be a
shared component. Low priority — noting it only as a refactor target
once feature flags in `pipeline-features.ts` are enabled.

## What prior audits already cover

To avoid duplication with the existing audit set:

- `AUDIT_BUYER_SCORING_PIPELINE.md` — covers the buyer
  *recommendation scoring* system that feeds the Buyer Introduction
  Pipeline, not the pipeline itself. No overlap.
- `TASK_WORKFLOW_COMPREHENSIVE_AUDIT_2026-04-07.md` — covers task
  automation around deal stage transitions (no auto-advance, no
  entry-task spawning, hardcoded names). This audit reuses its Finding
  §5 and §6 by reference; the rest of this document is new.
- `PLATFORM_WORKFLOW_AUDIT_2026-03-22.md` — cross-feature workflow
  patterns. Does not enumerate the three pipelines or their
  integration points.

No prior document enumerated all three user-facing pipelines in one
place or called out the portal→deal gap.

## Key files referenced

Migrations
- `supabase/migrations/20250829140751_...sql` — initial deal_stages seed
- `supabase/migrations/20251002202941_...sql` — 12-stage reorg
- `supabase/migrations/20251112174742_...sql` — hard-delete `Approved`/`Negotiation`
- `supabase/migrations/20251112180457_...sql` — rename `Initial Review`→`Follow-up`
- `supabase/migrations/20260223033733_...sql` — rename/reorder/deactivate
- `supabase/migrations/20260327000000_buyer_introduction_tracking.sql` — intro schema
- `supabase/migrations/20260527000000_reactivate_pipeline_stages.sql` — (delete, misnamed)
- `supabase/migrations/20260616000000_pipeline_introduction_fixes.sql` — sync trigger
- `supabase/migrations/20260617000000_client_portal_tables.sql` — portal schema
- `supabase/migrations/20260624000000_portal_cleanup_unused_response_types.sql`

Types
- `src/types/status-enums.ts` — `ListingPipelineStatus`, `IntroductionStatus`
- `src/types/portal.ts` — all portal enums and row types
- `src/types/buyer-introductions.ts` — intro row types

Hooks
- `src/hooks/admin/use-pipeline-core.ts`
- `src/hooks/admin/use-pipeline-filters.ts`
- `src/hooks/admin/use-pipeline-views.ts`
- `src/hooks/portal/use-portal-deals.ts`
- `src/hooks/use-buyer-introductions.ts`
- `src/components/admin/deals/buyer-introductions/hooks/use-introduction-pipeline.ts`
- `src/components/admin/deals/buyer-introductions/hooks/use-approve-for-pipeline.ts`

Config
- `src/config/pipeline-features.ts`
