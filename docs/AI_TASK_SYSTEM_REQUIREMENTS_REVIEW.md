# AI Task Management System v3.0 — Technical Review

**Reviewer**: Claude (AI Code Review)
**Date**: 2026-02-27
**Document Under Review**: AI Task Management System v3.0 — Complete Specification
**Status**: DRAFT — Feedback for development team

---

## Executive Summary

The v3.0 spec is ambitious and well-structured. It correctly identifies real problems in the existing standup-based task system and proposes meaningful solutions. However, after reviewing the actual codebase — including the existing `daily_standup_tasks` schema, the `extract-standup-tasks` edge function, the Smartlead webhook handler, and the full remarketing module — I've identified **critical integration gaps, schema conflicts, scaling risks, and missing migration strategy** that need to be resolved before development begins.

This review is organized into three sections:
1. **Critical Issues** — Must fix before any code is written
2. **Significant Concerns** — Will cause problems during build or shortly after launch
3. **Suggestions for Improvement** — Optimizations and ideas to maximize team efficiency

---

## SECTION 1: CRITICAL ISSUES

### 1.1 No Migration Path From Existing System

**Severity: BLOCKER**

The spec introduces `rm_tasks` as a brand new table but doesn't acknowledge that a fully functional task system already exists: `daily_standup_tasks` with 4 migrations, a complete UI (TaskCard, AddTaskDialog, EditTaskDialog, ReassignDialog, PinDialog, MeetingQualityPanel), hooks (useDailyTasks, useToggleTaskComplete, useApproveTask, etc.), and an AI extraction pipeline.

**What's missing:**
- No data migration plan from `daily_standup_tasks` → `rm_tasks`
- No plan for transitioning the existing approval workflow (pending_approval → pending → completed/overdue) to the new status set (open → in_progress → completed → snoozed → cancelled → deal_closed)
- No mention of what happens to `standup_meetings`, `team_member_aliases`, `task_pin_log` tables
- The existing `DailyTaskDashboard.tsx`, `DailyTaskAnalytics.tsx`, and all 7+ component files need a rewrite plan
- The existing `useDailyTasks.ts` hook with 10+ mutations needs a migration path

**Recommendation:** Add a "Migration Strategy" section that explicitly addresses:
- Whether `rm_tasks` replaces or coexists with `daily_standup_tasks`
- Data migration SQL for historical tasks
- Feature parity checklist (the existing system has features like pinning, approval workflow, and meeting quality metrics that aren't in the v3 spec)
- UI migration plan — phase-by-phase component replacement
- Rollback plan if the new system has issues

### 1.2 Schema References Wrong Tables

**Severity: CRITICAL**

The spec has `rm_tasks.entity_id` referencing Deals, Buyers, and Contacts, but the existing database uses different table names than what the spec implies:

| Spec Assumes | Actual Table Name | Issue |
|---|---|---|
| "deals" | `deals` (pipeline) or `listings` (the actual business) | Tasks about a *deal* could mean either. The `deals` table tracks buyer-deal pipeline records. The `listings` table is the actual business being sold. Which one does `entity_type='deal'` reference? |
| "buyers" | `remarketing_buyers` (external buyers) or `profiles` (marketplace buyers via `connection_requests`) | Two completely different buyer systems exist. The spec only seems to target `remarketing_buyers` but doesn't say so explicitly. |
| "contacts" | `remarketing_buyer_contacts` | This is correct but should be explicit. |

The existing `daily_standup_tasks` table links to `deals(id)` via `deal_id` — and `deals` is a join table between `listings` and buyers in the pipeline. The v3 spec's `entity_type='deal'` + `entity_id` pattern is ambiguous.

**Recommendation:**
- Explicitly define which table each `entity_type` maps to
- Consider `entity_type IN ('listing', 'deal', 'remarketing_buyer', 'contact')` to remove ambiguity
- Add a validation function/trigger that checks `entity_id` against the correct table based on `entity_type` (the spec mentions this but doesn't provide implementation detail)
- Document how tasks relate to the existing `deal_tasks` table (yes — there's *already* a `deal_tasks` table in the schema for pipeline deal tasks)

### 1.3 `listings` Table Has No Deal Lifecycle Statuses

**Severity: CRITICAL**

The spec's Deal Lifecycle Integration (Section 5) assumes deal statuses like 'closed', 'sold', 'withdrawn', 'dead', 'on_hold', 'paused'. But the actual `listings` table has:

```
status CHECK IN ('active', 'inactive', 'pending', 'sold')
```

And the `deals` table (pipeline) has:
```
status: 'active', 'won', 'lost', 'stalled'
```

Neither table has 'withdrawn', 'dead', 'on_hold', or 'paused'. The spec's lifecycle hooks would fire on statuses that don't exist.

**Recommendation:**
- Map the lifecycle hooks to *actual* status values:
  - `listings.status = 'sold'` → close tasks on all deals for that listing
  - `deals.status = 'won'` → close tasks on that specific deal
  - `deals.status = 'lost'` → cancel tasks on that specific deal
  - `deals.status = 'stalled'` → snooze tasks on that deal
- If new statuses are needed, add them as a separate migration with an ALTER TABLE
- Clarify whether lifecycle hooks trigger on the `listings` table, the `deals` table, or both

### 1.4 `is_retained` Field Doesn't Exist

**Severity: HIGH**

The spec references `is_retained` on deals/listings in multiple places (daily briefing, inbox sort order, escalation rules, buyer spotlight). This field does not exist in the database. The word "retained" appears in CSV seed data and in the fee agreement component, but there's no `is_retained` boolean column on `listings` or `deals`.

**Recommendation:**
- Add `is_retained boolean DEFAULT false` to the `listings` table (or `deals` table, depending on where it makes business sense)
- Define what "retained" means operationally — is it a listing-level property (the engagement type) or a deal-level property?
- Backfill existing retained engagements
- Add this as a Phase 1 prerequisite migration

### 1.5 `rm_deal_team` Conflicts With Existing Auth Model

**Severity: HIGH**

The spec introduces `rm_deal_team` with roles (lead/analyst/support), but the existing system uses `user_roles` with roles (owner/admin/moderator/viewer) for all access control. Every RLS policy in the system — including the existing daily standup tasks — checks `user_roles`.

Introducing a parallel permission system creates:
- Two sources of truth for "who can see this task"
- RLS policies that need to check *both* `user_roles` AND `rm_deal_team`
- Confusion about whether a "moderator" in `user_roles` is the same as an "analyst" in `rm_deal_team`
- A maintenance burden as the team grows from 3 to 20 people

**Recommendation:**
- Either extend `user_roles` with deal-level scoping, OR commit to `rm_deal_team` as the primary task permission system — but document how they interact
- Define a clear hierarchy: does an `admin` in `user_roles` automatically have `lead` access on all deals in `rm_deal_team`?
- Add `rm_deal_team` seed data migration for existing team members
- Consider whether you actually need per-deal roles at 3-5 people. This adds overhead that may not pay off until 10+ people. At your current team size, every team member likely touches every deal.

---

## SECTION 2: SIGNIFICANT CONCERNS

### 2.1 Existing Features Not Preserved

The existing task system has several features that are absent from the v3 spec:

| Existing Feature | v3 Status |
|---|---|
| **Task pinning** (leadership can pin tasks to specific priority rank positions) | Not mentioned — replaced by buyer_deal_score sort? |
| **Approval workflow** (pending_approval → approved by leadership) | Not mentioned — AI tasks have confirm/dismiss but manual tasks don't need approval? |
| **Meeting quality metrics** (extraction confidence, assignee match rate) | Partially covered by rm_task_extractions |
| **Priority scoring algorithm** (40% deal value + 35% stage + 15% task type + 10% overdue) | Replaced by buyer_deal_score? The scoring formula isn't defined in v3. |
| **Task analytics dashboard** (team scorecards, completion trends, volume trends) | Mentioned in success metrics but no UI spec |

**Recommendation:** Explicitly call out which existing features are kept, which are replaced, and which are deprecated. Don't let working features silently disappear.

### 2.2 Dual-Purpose Fireflies Integration Creates Routing Complexity

The existing system uses Fireflies for **daily standups** (tagged with `<ds>`) via `process-standup-webhook`. The v3 spec adds a second Fireflies handler (`rm-fireflies-webhook`) for **deal call transcripts**.

This means:
- The same Fireflies account sends webhooks for both standup meetings and deal calls
- You need routing logic: is this a standup or a deal call?
- The spec doesn't address how to differentiate — the `<ds>` tag convention only identifies standups; everything else is ambiguous
- If a standup discussion includes deal-specific commitments (which it almost certainly will), those tasks currently go into `daily_standup_tasks` via the standup extractor, but the v3 AI extractor would also want to process them

**Recommendation:**
- Define a clear routing decision tree for Fireflies webhooks:
  1. If title contains `<ds>` → standup pipeline (existing)
  2. If participants match a deal's contacts → deal call pipeline (v3)
  3. Otherwise → log and ignore
- Address the overlap: what happens when a standup discusses Deal X? Does the standup extractor create a `daily_standup_tasks` row AND the deal extractor creates an `rm_tasks` row for the same commitment?
- Consider unifying: make the standup extractor also write to `rm_tasks` and retire `daily_standup_tasks` entirely

### 2.3 Smartlead Webhook Already Exists — Spec Doesn't Build on It

The existing `smartlead-webhook` edge function already handles EMAIL_REPLIED, BOUNCED, UNSUBSCRIBED, OPENED, CLICKED, INTERESTED, NOT_INTERESTED events. It updates `smartlead_campaign_leads` and logs to `smartlead_webhook_events`.

The v3 spec proposes a new `rm-smartlead-contact-event` handler that does different things (update `rm_buyer_deal_cadence`, create suggested tasks on reply). But it doesn't reference the existing handler.

**Recommendation:**
- Extend the existing `smartlead-webhook` handler rather than creating a new one
- After the existing handler updates `smartlead_campaign_leads`, add a second step that maps the lead email to `remarketing_buyers` and updates `rm_buyer_deal_cadence`
- This avoids having two webhook endpoints for the same Smartlead events

### 2.4 AI Prompt Receives Too Much Context — Token Cost and Latency Risk

The v3 prompt is significantly larger than the existing extraction prompt. It now includes:
- Deal stage + valid categories whitelist
- Speaker map
- Buyer names in conversation
- Top 10 buyer scores
- Signal extraction instructions (an entirely new output type)
- Secondary entity extraction

Combined with a full Fireflies transcript (which can be 10,000+ words for a 30-minute call), this will:
- Increase Claude API cost significantly (input tokens are the major cost driver)
- Increase latency (more tokens = longer inference time)
- Potentially hit token limits on long calls

**Recommendation:**
- Estimate token costs: a 30-min transcript is ~5,000 words ≈ 7,500 tokens. The v3 system prompt is ~800 words ≈ 1,200 tokens. Context data adds ~500 tokens. Total input: ~9,200 tokens per call. At Claude Sonnet pricing, that's ~$0.03 per extraction. At 10 calls/day = $9/month. At 50 calls/day = $45/month. Manageable, but track it.
- Consider summarizing transcripts before sending to Claude (Fireflies provides summaries)
- For very long calls (60+ min), truncate or chunk the transcript
- Add a `token_usage` field to `rm_task_extractions` to track actual costs

### 2.5 Semantic Dedup (Issue J) Is Under-Specified

Cross-transcript semantic similarity dedup is mentioned as a v3 fix, but the implementation is vague: "title similarity > 0.8". This raises questions:

- What similarity metric? Levenshtein distance? Cosine similarity with embeddings? pg_trgm?
- Supabase doesn't have vector similarity search unless you enable `pgvector`
- String similarity (pg_trgm) would miss semantically similar but differently worded tasks ("Call John about the NDA" vs "Follow up with John on NDA status")
- Running similarity checks against all existing tasks for the same entity on every extraction is an O(n) query per task

**Recommendation for Phase 3 (ship without it) and Phase 4 (implement properly):**
- Phase 3: Use simple exact-match dedup: `WHERE transcript_id = [current] AND title = [proposed]` — this catches reprocessing duplicates
- Phase 4: Enable `pgvector`, generate embeddings for task titles, use cosine similarity with a tuned threshold
- Alternative for Phase 4: Send the last 10 tasks for this entity to Claude as context and let it dedup ("Here are existing tasks — do NOT create duplicates")

### 2.6 `is_blocked` as a Generated Column Won't Work as Written

The spec defines:
```
is_blocked boolean GENERATED ALWAYS AS (depends_on IS NOT NULL AND ... ) STORED
```

The `...` implies checking whether the blocking task is still open. PostgreSQL generated columns cannot reference other rows — they can only use values from the current row. You'd need a trigger or a view to compute this.

**Recommendation:**
- Option A: Use a database trigger on `rm_tasks` status changes — when a task is completed, find all tasks where `depends_on = completed_task.id` and set `is_blocked = false`
- Option B: Compute `is_blocked` at query time with a subquery or JOIN (simpler, no stale data risk, but slightly slower reads)
- Option C: Drop `is_blocked` entirely — the UI can check `depends_on` + the blocking task's status in a single query with a self-join. This is the simplest approach.

### 2.7 90-Day Auto-Purge Needs pg_cron or External Scheduler

The spec references "nightly pg_cron job" for quote purging, snoozed task waking, and AI task expiry. But:
- pg_cron is a PostgreSQL extension that must be explicitly enabled in Supabase (it's available but not enabled by default on all plans)
- The existing system's `mark_overdue_standup_tasks()` function exists but there's no evidence it's actually scheduled — it appears to be called ad-hoc or at query time
- The spec defines at least 5 scheduled jobs but doesn't specify a scheduling strategy

**Recommendation:**
- Confirm pg_cron is enabled on your Supabase plan
- Alternatively, use Supabase's built-in cron via `supabase/config.toml` or create scheduled edge functions
- Document all scheduled jobs in one place:
  1. Wake snoozed tasks (daily, 6am)
  2. Expire unreviewed AI tasks (daily, midnight)
  3. Mark overdue tasks (daily, 6am)
  4. Purge 90-day quotes (weekly, Sunday 3am)
  5. Send daily briefing (daily, per-user timezone — this is the hardest one)
- The per-user-timezone briefing requires a scheduling strategy of its own — you can't just run one cron job at 8am. Consider: run at 7:55am UTC, 8:55am UTC, etc., covering each timezone band.

### 2.8 The `buyer_deal_score` on `rm_tasks` Will Go Stale

Storing `buyer_deal_score` directly on the task at creation time means it becomes a snapshot. If the buyer's score changes (new data, rescoring), the task still shows the old score.

**Recommendation:**
- Don't store score on the task — join to `remarketing_scores` at query time
- The existing `remarketing_scores` table already has `composite_score` and `tier` for every buyer-listing pair
- This keeps scores fresh and avoids a sync problem
- If you need sort performance, create a database view that joins tasks with scores

---

## SECTION 3: SUGGESTIONS FOR IMPROVEMENT

### 3.1 Unify the Two Task Systems — Don't Build a Parallel One

The biggest architectural decision is whether to have two task systems (`daily_standup_tasks` + `rm_tasks`) or one. I strongly recommend **one unified system**.

**Why:**
- At 3-5 people, nobody wants to check two task dashboards
- Standups will inevitably discuss deal-specific tasks that should live in `rm_tasks`
- The standup extractor already links tasks to deals and assigns to team members
- Maintaining two separate AI extraction pipelines, two UIs, two notification systems doubles the dev cost

**How:**
- Build `rm_tasks` as the single task table with all v3 features
- Add `source='standup'` to the source enum
- Migrate the standup extraction pipeline to write to `rm_tasks` instead of `daily_standup_tasks`
- Keep `standup_meetings` as the transcript metadata table
- Retire `daily_standup_tasks` after migration
- The existing standup-specific features (pinning, approval) become features of `rm_tasks`

### 3.2 Add a `task_categories` Reference Table Instead of Free-Text

The v3 spec uses free-text for task categories (in the AI prompt and stage filter), but the existing system uses a strict enum (`task_type`). Neither approach is ideal for a growing team:

- Free-text makes reporting unreliable
- A code-level enum requires a deployment to add a category

**Recommendation:** Create an `rm_task_categories` table:
```sql
CREATE TABLE rm_task_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  applicable_stages text[] NOT NULL, -- which deal stages this category applies to
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0
);
```
- Pre-seed with the categories from the v3 stage filter table
- The AI prompt dynamically pulls valid categories per stage from this table
- Admins can add/modify categories without code changes
- The stage filter becomes a database lookup, not a hardcoded mapping

### 3.3 Scale Concerns: 3 → 20 People

The spec mentions scaling from 3 to 20 people in 3-4 months. Here's what will break:

| Feature | At 3 People | At 20 People |
|---|---|---|
| Daily briefing | One cron job, everyone sees everything | Need team-scoped briefings, otherwise it's information overload |
| Task Inbox | Everyone sees "All Tasks" | Need manager views, team filters, deal-based grouping |
| Approval workflow | One person approves everything | Need delegated approval (deal leads approve their deals' tasks) |
| Notification volume | ~10 notifications/day | ~50-100/day — notification fatigue becomes real |
| AI extraction | 2-5 calls/day | 20-50 calls/day — need queue management, cost monitoring |

**Recommendations for scaling:**
- Add a `team_id` concept early (even if there's only one team now)
- Build the notification system with digest/batching from the start (don't send 50 individual emails — send one summary)
- Add notification preferences per user: which event types, which deals, email vs. in-app
- The `rm_deal_team` table is the right foundation — but add it in Phase 1, not as an afterthought
- Consider a "My Deals" view that shows only deals where the user is on the deal team, with all their tasks grouped by deal

### 3.4 The Chatbot Session Memory Spec Is Too Vague

Section 10 describes chatbot session memory but doesn't address:
- Where is session state stored? (Supabase table? In-memory? Browser localStorage?)
- The existing AI Command Center already has conversation persistence — does the chatbot build on that or is it separate?
- The 30-minute timeout should be server-side, not client-side (otherwise refreshing the page loses context)
- The existing `ai-command-center` edge function already has tool-calling with deal/buyer context — extending it is far less work than building a new chatbot

**Recommendation:** Extend the existing AI Command Center rather than building a new chatbot. Add task-specific tools:
- `get_my_tasks()` — fetches current user's tasks
- `create_task()` — creates a task with confirmation flow
- `get_deal_tasks()` — fetches tasks for a deal
- `get_overdue_tasks()` — fetches overdue tasks
- `get_buyer_spotlight()` — runs the buyer follow-up query

This approach gets you chatbot task management with much less new code.

### 3.5 Missing: Notification Architecture

The spec mentions notifications in multiple places (toast, amber/red banners, email, escalation) but doesn't define the notification system architecture. The existing system has `send-task-notification-email` for individual task assignments via Brevo, but nothing for:
- In-app notification storage (what powers the "notification bell with last 20 alerts"?)
- Notification preferences per user
- Digest vs. individual notifications
- The persistent banner component (this needs to query on every page load)

**Recommendation:** Add an `rm_notifications` table:
```sql
CREATE TABLE rm_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  type text NOT NULL, -- 'task_assigned', 'task_overdue', 'ai_suggestion', 'escalation', etc.
  title text NOT NULL,
  body text,
  entity_type text,
  entity_id uuid,
  is_read boolean DEFAULT false,
  is_email_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```
- All notification sources write to this table
- The notification bell reads from it
- The email sender reads unread + is_email_sent=false
- The persistent banner is a real-time Supabase subscription on this table

### 3.6 Phase 1 Is Too Large

Phase 1 includes: full rm_tasks schema, Tasks tab on 3 entity pages, Central Task Inbox with 5 tabs, notification bar, snooze with presets, rm_deal_team table, task templates with stage-based creation, email reminders, nightly jobs for snoozed tasks and deal lifecycle hooks.

That's at least 4-6 weeks of work for a small team. The risk is that Phase 1 takes so long that the team loses momentum before reaching the AI extraction in Phase 3.

**Recommendation:** Split Phase 1 into 1A and 1B:

**Phase 1A (Week 1-2): Core Task System**
- `rm_tasks` table (simplified — drop secondary_entity, depends_on, and expires_at for now)
- `rm_deal_team` table (seed with current team)
- Tasks tab on Deal pages only (highest value, smallest scope)
- Basic Task Inbox: My Tasks / Overdue / Completed
- Add Task modal
- Migrate existing `daily_standup_tasks` data

**Phase 1B (Week 3-4): Polish & Templates**
- Tasks tab on Buyer and Contact pages
- Task Inbox additional views (Due Today, This Week, filters)
- Notification bar
- Snooze
- Task templates + "Start Deal Process"
- Email reminders
- Deal lifecycle hooks

### 3.7 Success Metrics Need Baselines Before Development

The spec defines targets like "<15% overdue rate" and ">80% inbox opens daily" but there's no current baseline. Before building the new system, instrument the existing one:
- What's the current overdue rate on `daily_standup_tasks`?
- How many team members open the DailyTaskDashboard daily?
- What's the current AI extraction success rate?

**Recommendation:** Run a 1-week measurement sprint on the existing system to establish baselines. Then the v3 targets become "improve X metric by Y%" instead of arbitrary numbers.

### 3.8 Consider a Simpler Priority Model

The spec has multiple overlapping priority signals:
- `priority` field (high/medium/low)
- `buyer_deal_score` (1-10 composite score)
- Overdue aging tier (at risk → recent → aging → critical → abandoned)
- Retained deal flag
- Deal stage
- Task source (AI vs manual vs template)

For a team of 3-5 people, this creates analysis paralysis. "Which task should I do first?" should have one clear answer, not six competing signals.

**Recommendation:** Define a single computed `effective_priority` score (0-100) that combines all signals with explicit weights:
```
effective_priority =
  (is_retained ? 20 : 0) +
  (overdue_days > 0 ? min(overdue_days * 3, 30) : 0) +
  (priority == 'high' ? 20 : priority == 'medium' ? 10 : 0) +
  (buyer_deal_score / 10 * 15) +
  (deal_stage_weight * 15)
```
Sort the inbox by `effective_priority DESC`. One number, one sort order. The team always works top-down.

### 3.9 AI Extraction Should Run on Standups Too

The v3 spec's AI extraction pipeline is more sophisticated than the existing standup extractor (it has guardrails, stage awareness, signal detection, and speaker identification). But it only targets deal calls.

Your standups are where most task commitments happen. The standup extractor currently has:
- No guardrails (every extracted task is saved)
- No stage awareness
- No signal detection
- No secondary entity support

**Recommendation:** Once v3's AI extraction is stable (Phase 3), upgrade the standup extraction to use the same pipeline. The standup webhook should route transcripts through `rm-extract-tasks-from-transcript` with a multi-deal mode — standups discuss multiple deals, so the extractor needs to handle that.

### 3.10 Missing: Task Comments / Activity Log

As the team grows, tasks need discussion. "Why was this snoozed?" "I talked to the buyer and they said X." Currently there's no place for this conversation except `notes` (a single text field) and `completion_notes`.

**Recommendation:** Add `rm_task_comments`:
```sql
CREATE TABLE rm_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES rm_tasks(id),
  user_id uuid NOT NULL REFERENCES profiles(id),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```
This becomes critical at 10+ people. Add it to Phase 1B or Phase 2.

### 3.11 The `other_deal_hint` Field Is a Loose End

The AI prompt asks for `other_deal_hint` when a task is about a different deal, and the spec says to "log for admin review." But there's no table, UI, or workflow for this. It's a dead-end instruction that the AI will produce output for but nobody will act on.

**Recommendation:** Either:
- Remove `other_deal_hint` from the prompt and keep it simple (tasks are always linked to the call's primary deal)
- Or build the workflow: create a `rm_task_review_queue` view that surfaces tasks with `other_deal_hint IS NOT NULL` and lets an admin reassign them to the correct deal

### 3.12 Contact Cadence "50% Clock Reset" Is Confusing

Section 9 says: "email_sent resets the clock by 50% of cadence." This means if the cadence is 14 days and you send a cold email on day 10, the next contact deadline is... day 10 + 7 = day 17? Or day 0 + 14 * 0.5 = day 7? The math isn't clear, and the implementation will be bug-prone.

**Recommendation:** Simplify to two contact types:
- **Active contact** (call, meeting, reply, direct email): full clock reset
- **Passive contact** (cold email sent, email opened): extends deadline by X days (e.g., +5 days) but doesn't fully reset

This is easier to implement, explain to the team, and debug.

---

## SECTION 4: Integration With Existing Daily Standup System

The spec should explicitly address how the new system relates to what's already built:

### What to Keep
- `standup_meetings` table — still needed for standup transcript metadata
- `team_member_aliases` table — still needed for speaker-to-profile mapping
- `process-standup-webhook` edge function — still needed for standup routing
- Analytics dashboard — the team scorecards and completion trends are valuable

### What to Migrate
- `daily_standup_tasks` → `rm_tasks` (add `source='standup'`)
- `extract-standup-tasks` → extend to use v3 guardrails and write to `rm_tasks`
- `DailyTaskDashboard.tsx` → Replace with new Task Inbox UI
- `useDailyTasks.ts` → Replace with new hooks for `rm_tasks`

### What to Retire
- `task_pin_log` → Replace with notification/activity log
- The approval workflow → Replace with AI confirm/dismiss (or keep as an optional feature on `rm_tasks`)

### Proposed Unified Status Flow
```
standup extraction → pending_approval (if approval enabled) → open → in_progress → completed
AI extraction → ai_suggested (unconfirmed) → open (confirmed) → in_progress → completed
manual creation → open → in_progress → completed
template creation → open → in_progress → completed
```

---

## SECTION 5: Recommended Priority Order

Given the team size and growth timeline, here's what I'd build and when:

### Month 1: Foundation (Phase 1A + Migration)
1. `rm_tasks` table (core fields only — skip secondary entity, depends_on, expires_at)
2. `rm_deal_team` table (seed with current team)
3. Migrate `daily_standup_tasks` data to `rm_tasks`
4. Update standup extractor to write to `rm_tasks`
5. Basic Task Inbox (My Tasks, Overdue, All Tasks)
6. Add Task modal with deal/buyer/contact linking

### Month 2: Polish + Briefing (Phase 1B + Phase 2)
7. Task templates + "Start Deal Process"
8. Tasks tab on Deal, Buyer, Contact pages
9. Notification bar (overdue count, due today)
10. Snooze functionality
11. Daily briefing edge function + email
12. Extend AI Command Center with task tools (chatbot)

### Month 3: AI Extraction (Phase 3)
13. Fireflies deal call webhook routing
14. `rm-extract-tasks-from-transcript` with v3 guardrails
15. `rm_deal_signals` table + signals dashboard
16. AI Suggested view with confirm/dismiss
17. Smartlead → buyer cadence integration
18. Buyer scoring on tasks (via JOIN, not stored)

### Month 4: Scale Features (Phase 4)
19. Task aging tiers + escalation
20. Task dependencies (soft warnings)
21. Semantic dedup with pgvector
22. Admin threshold calibration UI
23. Deal outcome metrics
24. Per-deal role-based visibility (when team > 10)

---

## SECTION 6: Quick Wins the Spec Doesn't Mention

These are high-value, low-effort additions based on what's already in the codebase:

1. **Keyboard shortcuts in Task Inbox** — The team will live in this page. `j/k` to navigate, `c` to complete, `s` to snooze, `n` to create new.

2. **Supabase Realtime subscriptions on `rm_tasks`** — When someone completes a task or a new AI suggestion appears, the inbox updates live without page refresh. Supabase already supports this.

3. **Link tasks to existing `deal_activities`** — Every task status change should write to the deal's activity log. This gives a unified timeline on the deal page.

4. **"What happened?" prompt on task completion** — Instead of making `completion_notes` optional, show a 1-line input that appears when you click "Complete." Default placeholder: "What was the outcome?" Most people will write 5 words. Those 5 words are invaluable 3 months later.

5. **Weekly digest email** — In addition to the daily briefing, a Friday summary: tasks completed this week, tasks carried over, deals that advanced stages, signals detected. This is a morale booster and gives leadership visibility without micromanaging.

---

## Summary of Recommendations

| # | Recommendation | Priority | Effort |
|---|---|---|---|
| 1 | Add migration plan from `daily_standup_tasks` to `rm_tasks` | BLOCKER | Medium |
| 2 | Fix entity_type references to match actual table names | CRITICAL | Low |
| 3 | Map deal lifecycle hooks to actual status values | CRITICAL | Low |
| 4 | Add `is_retained` column to listings or deals | HIGH | Low |
| 5 | Document `rm_deal_team` ↔ `user_roles` interaction | HIGH | Low |
| 6 | Unify standup + deal task systems into one | HIGH | Medium |
| 7 | Extend existing Smartlead webhook instead of creating new one | MEDIUM | Low |
| 8 | Split Phase 1 into 1A and 1B | MEDIUM | None |
| 9 | Use JOINs for buyer_deal_score instead of storing on task | MEDIUM | Low |
| 10 | Fix `is_blocked` generated column — use trigger or query-time | MEDIUM | Low |
| 11 | Add `rm_notifications` table for notification architecture | MEDIUM | Medium |
| 12 | Add `rm_task_comments` for team discussion | MEDIUM | Low |
| 13 | Define single `effective_priority` score | LOW | Low |
| 14 | Establish baselines before development | LOW | Low |
| 15 | Extend AI Command Center for chatbot features | LOW | Medium |
