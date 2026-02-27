# AI Task Management System v3.0 — Expert Review

**Reviewer**: Claude Code (automated codebase-aware review)
**Date**: 2026-02-27
**Scope**: Spec correctness vs. actual codebase, architectural issues, scaling concerns (2-3 → 10-20 users), potential bugs, and prioritization feedback

---

## Executive Summary

The spec is remarkably thorough for a v3.0 draft — the audit-driven approach has caught real issues. However, after reviewing it against the actual codebase, I've identified **8 critical mismatches**, **11 high-severity issues**, and **14 medium/low improvements** that will cause real problems if the spec goes to development as-is.

The biggest risks are: (1) the spec builds a parallel task system while an existing one (`daily_standup_tasks`) already exists and is actively used, (2) several foreign key references point to tables/columns that don't exist, (3) the scaling model from 2-3 → 10-20 users isn't addressed in the permission model, and (4) the phased plan underestimates the integration complexity with your existing AI command center and chatbot.

---

## SECTION 1: Critical Mismatches With Your Actual Codebase

### C1. You already have a task system — the spec ignores it entirely

**Severity**: CRITICAL
**What exists**: Your database already has `daily_standup_tasks` (migration `20260330000000`) with:
- AI extraction from Fireflies transcripts (`extract-standup-tasks` edge function)
- Priority scoring (deal value 40%, deal stage 35%, task type 15%, overdue bonus 10%)
- Team member alias matching for speaker identification
- Approval workflow (`pending_approval` → `pending` → `completed`/`overdue`)
- Pin/rank system for manual priority overrides
- `standup_meetings` table tracking extraction runs
- `task_pin_log` audit table

**The problem**: The spec creates an entirely new `rm_tasks` table with overlapping but different schema, different status values, and different extraction logic. This means:
- Two parallel task systems in production
- Users confused about which task list to use
- AI extraction happening in two different edge functions with different prompts
- No migration path for existing tasks

**Recommendation**: The spec must address this head-on. Either:
- (a) **Migrate**: Evolve `daily_standup_tasks` into `rm_tasks`, write a migration script, deprecate the old system
- (b) **Separate concerns**: Keep standup tasks for daily standups, `rm_tasks` for deal-level M&A tasks — but then clearly define the boundary and how they interact in the UI
- (c) **Replace**: Replace the old system entirely, but include a data migration plan

I recommend option (a) since the existing system already does 60% of what `rm_tasks` needs.

### C2. `entity_type='contact'` references don't match your schema

**Severity**: CRITICAL
**The spec says**: `entity_type CHECK IN ('deal','buyer','contact')` where `entity_id` is validated against the "correct table."

**Your actual schema**:
- `listings` = deals (not a table called `deals` for listings — the `deals` table is the buyer-deal pipeline junction)
- `remarketing_buyers` = buyers
- `contacts` = contacts (this one matches)

**The problems**:
1. The spec says `entity_type='deal'` and `entity_id` references `listings(id)` — but your actual deal pipeline uses the `deals` table (which joins `listings` and `remarketing_buyers`). A "deal" in your system is a `deals` row, not a `listings` row. But the listing is the sellside entity. The spec conflates these.
2. `contacts` in your schema has `listing_id` (seller contacts) — these aren't buyer contacts. Buyer contacts are in `buyer_contacts` table. The spec's `entity_type='contact'` doesn't specify which contact type.
3. The deal lifecycle hooks trigger on `listings.status` changes — but your `listings` table uses `remarketing_status` ('active', 'not_a_fit') and `status` ('active', 'inactive'). Neither has 'closed', 'sold', 'withdrawn', 'dead', 'on_hold'. Your deals pipeline has `deal_stages` with stages like 'Sourced', 'Qualified', 'NDA Sent', etc. — stage transitions, not status changes.

**Recommendation**: Redefine entity types to match what actually exists:
```
entity_type CHECK IN ('listing', 'deal', 'buyer', 'buyer_contact', 'contact')
```
And clarify: a "deal task" links to which table? The `listings` table (the sellside company) or the `deals` table (a specific buyer-deal pipeline entry)? Most M&A tasks are about a specific buyer-deal relationship, not just the listing.

### C3. `rm_deal_team` references `listings(id)` but your deals live in `deals` table

**Severity**: CRITICAL
**The spec says**: `deal_id uuid REFERENCES listings(id)`

**Your actual system**: The `deals` table is the buyer-deal pipeline. `listings` is the company being sold. A deal team would logically be assigned to a `listing` (the sellside engagement), not to a `deals` row (a single buyer-deal pair). But the spec then uses `rm_deal_team` to control task visibility on deal-specific tasks.

**The problem**: If deal_team is per-listing, and tasks are per-deal (buyer-listing pair), the RLS logic doesn't work as written. A deal team member on Listing A should see tasks about Buyer X's deal on Listing A — but the FK chain is broken.

**Recommendation**: Clarify whether `rm_deal_team` is:
- Per-listing (the SourceCo team working the sellside engagement) — most likely correct
- Per-deal (per buyer-deal pipeline entry) — too granular, creates admin overhead

If per-listing, the RLS policy needs to join through `deals.listing_id` to check team membership.

### C4. The deal lifecycle hooks assume status values that don't exist

**Severity**: CRITICAL
**The spec says**: Trigger on `listings.status` changing to 'closed', 'sold', 'withdrawn', 'dead', 'on_hold'.

**Your actual `listings.status`**: Only 'active' and 'inactive' exist in your codebase. The `remarketing_status` field has 'active' and 'not_a_fit'.

**Your actual deal stages**: `deal_stages` table with named stages ('Sourced', 'Qualified', 'NDA Sent', 'NDA Signed', 'Fee Agreement Sent', 'Fee Agreement Signed', 'Due Diligence', 'LOI Submitted', 'Under Contract', 'Closed Won', 'Closed Lost'). These are stages, not statuses — they're tracked via `deals.stage_id` FK.

**Recommendation**: The lifecycle hooks should trigger on:
1. `deals.stage_id` changing to a stage where `stage_type = 'won'` or `stage_type = 'lost'`
2. A new `listing_engagement_status` field on `listings` if you want to track engagement lifecycle separately from marketplace status

### C5. No `profiles.timezone` field exists

**Severity**: HIGH
**The spec says**: "Schedule: 8:00am per user timezone (store timezone in profiles table)"

**Your actual `profiles` table**: Has `first_name`, `last_name`, `onboarding_completed`, `deleted_at` — no `timezone` field.

**Recommendation**: Add `timezone text DEFAULT 'America/New_York'` to `profiles` migration. Also add `email_briefing_enabled boolean DEFAULT true` and `app_briefing_enabled boolean DEFAULT true` per Section 11.

### C6. `is_retained` field doesn't exist anywhere

**Severity**: HIGH
**The spec says**: "is_retained flag surfaces retained deals first" — used throughout for briefing, inbox sorting, escalation logic.

**Your actual schema**: No `is_retained` field on `listings`, `deals`, or any other table. There's `is_priority_target` on `listings` which is conceptually similar.

**Recommendation**: Either:
- Add `is_retained boolean DEFAULT false` to `listings`
- Or map to the existing `is_priority_target` field and document the equivalence

### C7. `platform_settings` table doesn't exist

**Severity**: HIGH
**The spec says**: "Threshold is stored in a platform_settings table"

**Your actual schema**: No `platform_settings` table exists.

**Recommendation**: Create a simple key-value settings table:
```sql
CREATE TABLE platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid REFERENCES profiles(id),
  updated_at timestamptz DEFAULT now()
);
```

### C8. The AI prompt specifies `claude-sonnet-4-20250514` — outdated

**Severity**: HIGH
**The spec says**: "Send transcript + context to claude-sonnet-4-20250514"

**Your codebase**: Already uses a `claude-client.ts` shared module with `CLAUDE_MODELS` constants. The model should reference this, not hardcode a specific version.

**Recommendation**: Use `CLAUDE_MODELS.sonnet` from your existing `claude-client.ts` to stay current. Also consider cost — Haiku may be sufficient for structured extraction and would be ~10x cheaper per transcript.

---

## SECTION 2: High-Severity Design Issues

### H1. The `is_blocked` generated column won't work as written

**The spec says**: `is_blocked boolean GENERATED ALWAYS AS (depends_on IS NOT NULL AND ... ) STORED`

**The problem**: A generated column can only reference columns in the same row. It cannot query whether the blocking task (a different row) is still open. You'd need `SELECT status FROM rm_tasks WHERE id = depends_on` which is not valid in a generated column expression.

**Fix**: Either:
- Use a trigger that updates `is_blocked` whenever a task's status changes (checking all tasks that depend on it)
- Or compute `is_blocked` at query time with a subquery/view
- Or just check it in the application layer (simplest, recommended)

### H2. Semantic similarity dedup (Issue J) is specified but not implementable as written

**The spec says**: "Cross-transcript dedup using semantic similarity" and "title similarity > 0.8"

**The problem**: PostgreSQL doesn't have built-in semantic similarity. `pg_trgm` gives string similarity (which is what `similarity()` uses), not semantic similarity. "Follow up with Acme" and "Check in with Acme Corp about next steps" are semantically identical but have low string similarity.

**Recommendation**: For Phase 3, use `pg_trgm` similarity as a basic dedup (threshold ~0.6, not 0.8 for trigram). For Phase 4, if you want true semantic dedup, you'd need embeddings — which is overkill for this use case. A simpler approach: dedup by `(entity_id, task_type, transcript_id)` — same entity, same task type, same transcript = duplicate.

### H3. The 7-day AI task expiry creates a bad UX at scale

**The problem**: With 10-20 users, you might have 5-10 transcripts/day producing 2-5 tasks each = 10-50 new AI tasks daily. With a 7-day window, you'll have 70-350 pending AI tasks at any time. The "AI Suggested" view becomes unusable.

**Recommendation**:
- Expiry should be per-user, not global — each user sees only their AI suggestions
- Add a "batch actions" UI: approve all / dismiss all for a given transcript
- Consider auto-assigning AI tasks to the deal team lead rather than showing them in a global queue
- The day-5 alert should go to the deal team lead, not the record owner, since AI tasks aren't assigned yet

### H4. The notification system will overwhelm users at 10-20 people

**The spec defines**: Persistent red/amber banners, toast notifications (8s), daily email, escalation emails, day-5 alerts, assignment alerts, 24hr reminders, snoozed task wake alerts.

**At scale**: A deal lead managing 5 retained deals with 10 buyers each could get 20+ notifications daily. Notification fatigue will kill adoption faster than missing features.

**Recommendation**: Add a notification preferences system (Phase 1, not Phase 4):
- Critical only / All notifications / Custom
- Batch digest option (get one summary instead of individual alerts)
- Quiet hours setting
- Per-deal notification muting

### H5. RLS policies will be slow at scale without proper indexes

**The spec says**: "Users see tasks they own OR tasks on deals where they are in rm_deal_team"

**The problem**: The RLS policy requires a subquery into `rm_deal_team` on every task read. Without indexes, this is O(n*m) where n=tasks and m=team memberships.

**Recommendation**: Add these indexes to the Phase 1 migration:
```sql
CREATE INDEX idx_rm_tasks_owner ON rm_tasks(owner_id);
CREATE INDEX idx_rm_tasks_entity ON rm_tasks(entity_type, entity_id);
CREATE INDEX idx_rm_tasks_status ON rm_tasks(status) WHERE status IN ('open', 'in_progress');
CREATE INDEX idx_rm_tasks_due_date ON rm_tasks(due_date) WHERE status IN ('open', 'in_progress');
CREATE INDEX idx_rm_deal_team_deal ON rm_deal_team(deal_id);
CREATE INDEX idx_rm_deal_team_user ON rm_deal_team(user_id);
CREATE UNIQUE INDEX idx_rm_deal_team_unique ON rm_deal_team(deal_id, user_id);
```

### H6. The stage filter whitelist is too rigid for real M&A work

**The spec says**: NDA tasks are "always blocked" at IOI/LOI stage because "NDA already done."

**Real world**: Buyers enter deals at different stages. A new buyer might need an NDA even when other buyers are at LOI stage. The stage filter applies to the deal globally, not per-buyer.

**Recommendation**: The stage filter should be per buyer-deal relationship, not per deal. Since your `deals` table already tracks individual buyer-deal pipeline entries with their own `stage_id`, the AI should receive the specific `deals.stage_id` for each buyer mentioned, not the overall listing stage.

### H7. Task templates assume a single linear deal process

**The spec's templates**: Create tasks like "Send NDA to top 15 buyers" — but this assumes all buyers are at the same stage simultaneously.

**Your actual model**: Each buyer has their own `deals` pipeline entry at their own stage. Buyer A might be at NDA while Buyer B is at CIM.

**Recommendation**: Templates should create per-buyer task sets triggered when a specific buyer-deal moves to a new stage, not bulk tasks per listing. Example: when a deal moves to "NDA Sent" stage → auto-create "Track NDA return for [buyer]" and "Follow up on unsigned NDA at 7 days for [buyer]".

### H8. The chatbot session memory spec conflicts with your existing AI command center

**Your codebase**: You already have a sophisticated `ai-command-center` edge function with:
- An orchestrator (`orchestrator.ts`)
- 15+ tool modules (buyer tools, deal tools, transcript tools, smartlead tools, etc.)
- A router with intent classification
- Chat persistence (`chat-persistence.ts`)
- Existing session analytics

**The spec**: Describes a simpler chatbot that maintains `active_deal_id` context — ignoring all the existing infrastructure.

**Recommendation**: The task system's chatbot features should be tools added to the existing AI command center, not a separate chatbot. Add:
- `task-tools.ts` — task creation, task queries, briefing generation
- Extend the existing `deal-tools.ts` with task-aware queries
- Use the existing chat persistence for session memory

### H9. Smartlead "50% cadence reset" for email_sent is complex and probably wrong

**The spec says**: "email_sent resets clock by 50% of cadence" — meaning if cadence is 14 days and you send a cold email, the clock resets to 7 days remaining.

**The problems**:
1. This creates weird math: if you send 3 cold emails, is the cadence reset to 12.25% remaining?
2. Your existing `smartlead-webhook` handler doesn't touch `last_contacted_at` on buyer records at all — it only updates `smartlead_campaign_leads`
3. The mapping from Smartlead lead email → `remarketing_buyers` record doesn't exist yet (Smartlead tracks lead emails, your buyer table tracks company-level records)

**Recommendation**: Simplify to binary: sent = partial contact (resets clock to 50% once, not compounding), replied = full contact. The email-to-buyer mapping needs its own design — you'll need to join `smartlead_campaign_leads.email` → `buyer_contacts.email` → `buyer_contacts.buyer_id` → `remarketing_buyers.id`.

### H10. The 90-day quote purge will break task context

**The spec says**: Auto-null `ai_evidence_quote` after 90 days.

**The problem**: When someone reviews a task 3 months later (common in M&A — deals take 6-12 months), the evidence that justified the task is gone. They just see a task with no context.

**Recommendation**: Instead of purging, anonymize: replace company names and personal names with generic labels ("[Company A]", "[Person 1]") using a simple regex replacement. This preserves context while reducing PII exposure. The purge should be a fallback for quotes that can't be anonymized.

### H11. No audit trail for task status changes

**The spec tracks**: completion notes, completed_by, confirmed_at, dismissed_at — but nothing for intermediate status changes.

**At scale with 10-20 users**: You need to know who changed a task from open → in_progress, who snoozed it, who reassigned it. Without this, task accountability breaks down.

**Recommendation**: Add an `rm_task_activity` table:
```sql
CREATE TABLE rm_task_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES rm_tasks(id),
  action text NOT NULL, -- 'created', 'status_changed', 'reassigned', 'snoozed', 'priority_changed'
  old_value text,
  new_value text,
  performed_by uuid REFERENCES profiles(id),
  performed_at timestamptz DEFAULT now()
);
```
This is essential for the 10-20 person scale you're targeting.

---

## SECTION 3: Medium/Low Improvements

### M1. Missing unique constraint on `rm_deal_team(deal_id, user_id)`
The spec doesn't prevent the same user from being added to a deal team twice with different roles. Add `UNIQUE(deal_id, user_id)`.

### M2. `buyer_deal_score` stored on task is a snapshot that goes stale
Scores change as buyers are evaluated. A task created when a buyer scored 4 might be irrelevant by the time the buyer scores 9. Consider fetching the score at display time rather than storing it.

### M3. The `depends_on` field only supports single dependencies
Real M&A: "Open data room" might depend on both "LOI signed" AND "Due diligence coordinator assigned." Consider a junction table `rm_task_dependencies` if you want multiple dependencies, or accept single dependency as a v1 limitation and document it.

### M4. No recurring tasks in Phases 1-3
Many M&A tasks are recurring: "Weekly seller check-in", "Bi-weekly buyer status update." Recurring tasks appear in Phase 4 but the schema doesn't support them. Add `recurrence_rule text` (iCal RRULE format) to the schema now even if the UI comes later.

### M5. The daily briefing edge function will be expensive
Running 20 complex queries (overdue, due today, this week, AI pending, retained deals, buyer spotlight) per user at 8am means 120+ queries for 20 users simultaneously. Consider pre-computing the briefing data into a `rm_daily_briefing_cache` table via a single batch job, then formatting per user.

### M6. The spec doesn't address task comments/discussion
With 10-20 people, tasks need discussion: "I called them, they said X." The `notes` field is single-value. Consider an `rm_task_comments` table for threaded discussion.

### M7. No bulk operations defined for task management
At scale, users need: "Mark all NDA follow-ups as completed", "Reassign all of Tom's tasks to Sarah" (when someone goes on vacation). The spec only defines individual task operations.

### M8. The Phase 1 prompt is 200+ lines — too large for a single prompt
AI code generation works best with focused, scoped prompts. Break the Phase 1 prompt into sub-prompts:
1. Database schema + RLS
2. Tasks tab on record pages
3. Task inbox + notification bar
4. Templates + deal lifecycle hooks

### M9. Email briefing timing across timezones
"8:00am per user timezone" with a cron job means you need 24+ separate scheduled runs (one per timezone). Supabase cron (`pg_cron`) doesn't support per-row timezone scheduling. You'll need a single job that queries users by timezone bracket and processes them in batches.

### M10. The `ai_speaker_assigned_to` enum is too limited
`CHECK IN ('advisor','seller','buyer')` — but with 10-20 users, you might have multiple advisors. "Advisor" doesn't tell you which one. Consider storing the actual matched `profile_id` or the speaker name for later resolution.

### M11. Fireflies webhook doesn't include deal context
The spec says the Fireflies webhook handler matches participant emails to deals. But Fireflies webhook payloads typically only include `transcript_id` and basic metadata — not participant emails. You'll need to call the Fireflies API to get participant details after receiving the webhook.

### M12. No error retry strategy for AI extraction
The spec says "If not ready: retry in 5min" but doesn't define max retries, backoff strategy, or dead letter handling. Define: max 3 retries, exponential backoff (5min, 15min, 45min), then mark as failed and notify admin.

### M13. The `rm_buyer_deal_cadence` table creates a maintenance burden
A new row per buyer-deal-stage combination means the table grows fast. With 100 buyers across 10 deals at 7 stages each = 7,000 rows. Consider making cadence a computed view based on deal stage + buyer status rather than a manually maintained table.

### M14. Success metrics need a baseline measurement plan
The spec defines targets (">80% of team opens inbox daily") but doesn't define how to measure the baseline. Add a 2-week baseline measurement period before setting targets, and use the existing session analytics you already have.

---

## SECTION 4: Scaling Recommendations (2-3 → 10-20 Users)

### S1. Role-based access needs more granularity
Your current `user_roles` has: owner, admin, moderator, viewer. The spec adds `rm_deal_team` with: lead, analyst, support. But these two systems don't connect. A "moderator" in `user_roles` might be a "support" on one deal and "lead" on another.

**Recommendation**: Map the relationship clearly:
- `user_roles` = platform-level access (who can access admin features)
- `rm_deal_team` = deal-level access (who can see/manage tasks on a specific deal)
- Document which platform roles can do what with tasks (e.g., can a "viewer" create tasks?)

### S2. Add team dashboards for managers
At 10-20 people, a manager needs: "What is everyone working on today?", "Who's overloaded?", "Which deals have no active tasks?" The spec focuses on individual task views. Add a team dashboard view in Phase 2 (not Phase 4).

### S3. Task assignment notifications need @-mention support
At scale, "task assigned" notifications aren't enough. People need to tag each other in task notes: "@Sarah can you check this buyer's IC timeline?" This drives collaboration without creating new tasks for everything.

### S4. Plan for onboarding new team members
When user #11 joins, they need: existing deal team assignments, task inbox training, notification preferences set up. Consider a "new team member" setup wizard that assigns them to relevant deals and configures their preferences.

---

## SECTION 5: What's Actually Good (Don't Change These)

1. **The four-layer guardrail system** — this is well-designed. Category → Score → Stage → Record is the right order and the right set of filters.
2. **Configurable relevance threshold with calibration process** — the week 1-2 review plan is realistic and the adjustment criteria are sensible.
3. **Deal signals as separate from tasks** — this is a smart architectural choice. Not everything from a transcript is a task.
4. **Dependencies as warnings, not hard blocks** — correct for M&A where process isn't always linear.
5. **The completion evidence pattern** — nudging users to document outcomes, not just check boxes.
6. **Phased approach** — the phases are correctly ordered. Manual first, then briefing, then AI, then enhancements.
7. **The discard audit log** — being able to review what AI threw away is critical for calibration.

---

## SECTION 6: Recommended Priority Reordering

Given the scaling goal (2-3 → 10-20 users in 3-4 months), I'd adjust the phasing:

### Phase 1 (Weeks 1-3): Foundation
- Resolve the `daily_standup_tasks` vs `rm_tasks` question FIRST
- Schema creation with correct entity references (see C2-C4)
- Task CRUD on deal/buyer/contact pages
- Task inbox with basic views
- `rm_deal_team` with correct FK relationships
- Activity log (`rm_task_activity`) — essential for multi-user
- Basic notification bar (overdue count only, not full escalation)

### Phase 1.5 (Week 4): Team Features — NEW
- Team dashboard (who's doing what)
- Bulk operations (reassign, bulk complete)
- Task comments
- Notification preferences
- Templates (moved here from being bundled in Phase 1 — templates are a nice-to-have, not a blocker)

### Phase 2 (Weeks 5-6): Briefing
- Daily briefing (but use pre-computed cache, not live queries)
- Add task tools to existing AI command center
- Email briefing

### Phase 3 (Weeks 7-9): AI Extraction
- As specified, but using existing `claude-client.ts` infrastructure
- Fireflies webhook → extraction pipeline
- Deal signals
- Smartlead contact event integration (requires email-to-buyer mapping work)

### Phase 4 (Weeks 10-12): Polish
- Aging/escalation tiers
- Dependency warnings
- Cross-transcript dedup
- Admin calibration UI
- Analytics

---

## Appendix: Quick Reference — Spec Line Items That Need Fixing

| Spec Reference | Issue | Fix Needed |
|---|---|---|
| Section 3, `rm_tasks.entity_id` | References wrong tables | Map to `listings`, `deals`, `remarketing_buyers`, `contacts`, `buyer_contacts` |
| Section 3, `rm_deal_team.deal_id` | FK to `listings` but semantically means deal engagement | Clarify: is this per-listing or per-deal? |
| Section 3, `is_blocked` generated column | Cannot query other rows | Use trigger or application-layer check |
| Section 4.4, model reference | Hardcoded `claude-sonnet-4-20250514` | Use `CLAUDE_MODELS.sonnet` from `claude-client.ts` |
| Section 5, lifecycle hooks | Trigger on nonexistent status values | Trigger on `deals.stage_id` changes to won/lost stages |
| Section 6, templates | Assume single linear process | Redesign for per-buyer-deal stage transitions |
| Section 9, Smartlead | No email→buyer mapping exists | Build join through `buyer_contacts.email` |
| Section 11, timezone | `profiles.timezone` doesn't exist | Add column in migration |
| Section 13, Phase 1 | Doesn't address existing `daily_standup_tasks` | Add migration/consolidation plan |
| Section 14, prompts | 200+ line monolithic prompts | Break into focused sub-prompts |

---

*This review is based on analysis of the actual codebase as of 2026-02-27, including all Supabase migrations, edge functions, type definitions, and application code.*
