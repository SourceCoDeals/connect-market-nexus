# AI TASK MANAGEMENT SYSTEM — v3.1

## SourceCo Remarketing Tool

**Version 3.1 — Corrected Specification Aligned to Actual Codebase**
**February 2026 — DRAFT FOR DEVELOPMENT REVIEW**

---

## Part Zero: Why v3.1 Exists

v3.0 was written without full knowledge of the existing codebase. v3.1 fixes **33 issues** identified in the code audit (see `docs/AI_TASK_SYSTEM_REVIEW.md`). The three most critical:

1. **A task system already exists.** The `daily_standup_tasks` table, `extract-standup-tasks` edge function, AI Command Center tools, and full UI (TaskCard, AddTaskDialog, DailyTaskDashboard, DailyTaskAnalytics) are already built. v3.1 **extends** this system — it does not create a parallel one.

2. **Entity references were wrong.** v3.0 said `entity_type='deal'` references `listings(id)`. In reality, `listings` = the company being sold (sellside engagement), `deals` = buyer-deal pipeline entries. A "deal task" could mean either. v3.1 uses the correct table references.

3. **Status values were invented.** v3.0 referenced listing statuses ('closed', 'withdrawn', 'dead', 'on_hold') that don't exist. Actual values: `active`, `inactive`, `pending`, `sold`. Deal progression uses `deal_stages` (Sourced → Closed Won/Lost), not status changes. v3.1 uses the real values.

---

## Part One: What We're Extending

### Existing Tables (DO NOT RECREATE)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `daily_standup_tasks` | Core task records | title, assignee_id, task_type, status (pending/completed/overdue), due_date, deal_id, priority_score, priority_rank, pinning fields, extraction_confidence, needs_review, is_manual |
| `standup_meetings` | Fireflies meeting metadata | fireflies_transcript_id, meeting_title, tasks_extracted, extraction_confidence_avg |
| `task_pin_log` | Audit log for pinning | task_id, pinned_by, rank changes |
| `team_member_aliases` | Speaker name → profile mapping | profile_id, alias |

### Existing Edge Functions (DO NOT RECREATE)

| Function | Purpose |
|----------|---------|
| `extract-standup-tasks` | AI extraction from Fireflies transcripts — already has Claude integration, speaker matching, priority scoring, deal matching |
| `ai-command-center` | 85+ tool orchestrator with SSE streaming — already has create_deal_task, complete_deal_task, get_deal_tasks, get_follow_up_queue, reassign_deal_task |

### Existing UI (DO NOT RECREATE)

| Component | Location |
|-----------|----------|
| `DailyTaskDashboard` | `src/pages/admin/remarketing/DailyTaskDashboard.tsx` — KPIs, task list, pending approval, filters |
| `DailyTaskAnalytics` | `src/pages/admin/remarketing/DailyTaskAnalytics.tsx` — team overview, scorecards, meeting quality |
| `TaskCard` | `src/components/daily-tasks/TaskCard.tsx` — completion, editing, reassign, pin |
| `AddTaskDialog` | `src/components/daily-tasks/AddTaskDialog.tsx` — manual task creation |
| `EditTaskDialog` | `src/components/daily-tasks/EditTaskDialog.tsx` |
| `ReassignDialog` | `src/components/daily-tasks/ReassignDialog.tsx` |
| `PinDialog` | `src/components/daily-tasks/PinDialog.tsx` |
| `AdminNotificationBell` | `src/components/admin/AdminNotificationBell.tsx` — task_assigned, task_completed notifications |

### Existing Hooks (DO NOT RECREATE)

| Hook | File |
|------|------|
| `useDailyTasks`, `useToggleTaskComplete`, `useApproveTask`, `useApproveAllTasks`, `useReassignTask`, `useEditTask`, `useAddManualTask`, `useDeleteTask`, `usePinTask`, `useTriggerExtraction` | `src/hooks/useDailyTasks.ts` |
| `useTaskAnalytics`, `useTeamScorecards`, `useMeetingQualityMetrics`, `useStandupMeetings`, `useTaskVolumeTrend` | `src/hooks/useTaskAnalytics.ts` |

---

## Part Two: Correct Entity Model

### The SourceCo Data Hierarchy

```
listings (sellside engagement — the company being sold)
  ├── deals (buyer-deal pipeline entry — one per buyer per listing)
  │     ├── deal_stages (progression: Sourced → Closed Won/Lost)
  │     └── remarketing_buyers (the buyer firm)
  │           └── contacts (buyer contacts, via contact_type='buyer')
  └── contacts (seller contacts, via contact_type='seller')
```

### Actual Deal Stages (from deal_stages table)

| Position | Stage Name | Stage Group (for task filtering) |
|----------|------------|----------------------------------|
| 1 | Sourced | Early |
| 2 | Qualified | Early |
| 3 | NDA Sent | NDA |
| 4 | NDA Signed | NDA |
| 5 | Fee Agreement Sent | Fee Agreement |
| 6 | Fee Agreement Signed | Fee Agreement |
| 7 | Due Diligence | Diligence |
| 8 | LOI Submitted | LOI |
| 9 | Under Contract | Closing |
| 10 | Closed Won | Terminal |
| 11 | Closed Lost | Terminal |

### Actual Listing Statuses

- `active` — listing is live
- `inactive` — listing paused or dormant
- `pending` — listing not yet active
- `sold` — listing completed

### Actual Remarketing Statuses (on listings)

- `active` — actively remarketing
- `archived` — archived
- `excluded` — excluded from remarketing
- `completed` — remarketing complete
- `not_a_fit` — not suitable for remarketing

### Task Entity Linking — Corrected

A task can be linked to:

| entity_type | References | Meaning |
|-------------|-----------|---------|
| `listing` | `listings(id)` | Sellside task — e.g. "Collect P&Ls from owner" |
| `deal` | `deals(id)` | Buyer-deal task — e.g. "Send CIM to Acme Partners" |
| `buyer` | `remarketing_buyers(id)` | Buyer-level task — e.g. "Research Acme's acquisition history" |
| `contact` | `contacts(id)` | Contact-level task — e.g. "Schedule call with John Smith" |

**v3.0 used `entity_type='deal'` referencing `listings(id)` — this was wrong.** v3.1 separates `listing` (sellside) from `deal` (buyer-deal pipeline entry). Every task that involves a specific buyer goes on the `deal` record, not the listing.

---

## Part Three: Schema Changes

### 3.1 — ALTER `daily_standup_tasks` (extend, don't recreate)

Add these columns to the existing table:

```sql
-- Entity linking (replaces text-only deal_reference)
ALTER TABLE daily_standup_tasks
  ADD COLUMN IF NOT EXISTS entity_type text DEFAULT 'deal'
    CHECK (entity_type IN ('listing','deal','buyer','contact')),
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS secondary_entity_type text
    CHECK (secondary_entity_type IN ('listing','deal','buyer','contact')),
  ADD COLUMN IF NOT EXISTS secondary_entity_id uuid;

-- For backwards compat: existing rows have deal_id set.
-- Backfill: UPDATE daily_standup_tasks SET entity_type='deal', entity_id=deal_id WHERE deal_id IS NOT NULL;

-- New status values
ALTER TABLE daily_standup_tasks
  DROP CONSTRAINT IF EXISTS daily_standup_tasks_status_check;
ALTER TABLE daily_standup_tasks
  ADD CONSTRAINT daily_standup_tasks_status_check
    CHECK (status IN ('pending','pending_approval','in_progress','completed','overdue','snoozed','cancelled','listing_closed'));

-- New source tracking
ALTER TABLE daily_standup_tasks
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual'
    CHECK (source IN ('manual','ai','chatbot','system','template'));
-- Backfill: UPDATE daily_standup_tasks SET source = CASE WHEN is_manual THEN 'manual' ELSE 'ai' END;

-- AI-specific fields
ALTER TABLE daily_standup_tasks
  ADD COLUMN IF NOT EXISTS ai_evidence_quote text,
  ADD COLUMN IF NOT EXISTS ai_relevance_score integer,
  ADD COLUMN IF NOT EXISTS ai_confidence text CHECK (ai_confidence IN ('high','medium')),
  ADD COLUMN IF NOT EXISTS ai_speaker_assigned_to text
    CHECK (ai_speaker_assigned_to IN ('advisor','seller','buyer','unknown')),
  ADD COLUMN IF NOT EXISTS transcript_id text,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Completion evidence
ALTER TABLE daily_standup_tasks
  ADD COLUMN IF NOT EXISTS completion_notes text,
  ADD COLUMN IF NOT EXISTS completion_transcript_id text;

-- Team visibility & dependencies
ALTER TABLE daily_standup_tasks
  ADD COLUMN IF NOT EXISTS deal_team_visible boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS depends_on uuid REFERENCES daily_standup_tasks(id),
  ADD COLUMN IF NOT EXISTS snoozed_until date,
  ADD COLUMN IF NOT EXISTS buyer_deal_score integer;

-- Priority (text) alongside existing numeric priority_score
ALTER TABLE daily_standup_tasks
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium'
    CHECK (priority IN ('high','medium','low'));

-- Created by (existing rows can default to assignee)
ALTER TABLE daily_standup_tasks
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_dst_entity ON daily_standup_tasks(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_dst_secondary_entity ON daily_standup_tasks(secondary_entity_type, secondary_entity_id);
CREATE INDEX IF NOT EXISTS idx_dst_status_due ON daily_standup_tasks(status, due_date);
CREATE INDEX IF NOT EXISTS idx_dst_assignee_status ON daily_standup_tasks(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_dst_source ON daily_standup_tasks(source);
CREATE INDEX IF NOT EXISTS idx_dst_expires ON daily_standup_tasks(expires_at) WHERE expires_at IS NOT NULL;
```

### 3.2 — NEW: `rm_deal_team` (Deal Team Membership)

```sql
CREATE TABLE rm_deal_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  role text NOT NULL CHECK (role IN ('lead','analyst','support'))
    DEFAULT 'analyst',
  created_at timestamptz DEFAULT now(),
  UNIQUE(listing_id, user_id)
);

-- RLS: team members can see their own memberships; admins see all
ALTER TABLE rm_deal_team ENABLE ROW LEVEL SECURITY;
```

**Note:** FK references `listings(id)` because team membership is per sellside engagement (the listing). All `deals` under that listing inherit the team. This is correct — the team works the listing, not individual buyer deals.

### 3.3 — NEW: `rm_deal_signals` (AI-Detected Intelligence)

```sql
CREATE TABLE rm_deal_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES listings(id),
  deal_id uuid REFERENCES deals(id),
  buyer_id uuid REFERENCES remarketing_buyers(id),
  transcript_id text NOT NULL,
  signal_type text NOT NULL CHECK (signal_type IN ('positive','warning','critical','neutral')),
  signal_category text NOT NULL,
  -- e.g. 'ic_pause','seller_hesitation','buyer_interest','timeline_risk','competitor_activity','fund_status','other'
  summary text NOT NULL,
  verbatim_quote text, -- purged after 90 days
  acknowledged_by uuid REFERENCES profiles(id),
  acknowledged_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signals_listing ON rm_deal_signals(listing_id);
CREATE INDEX IF NOT EXISTS idx_signals_deal ON rm_deal_signals(deal_id);
CREATE INDEX IF NOT EXISTS idx_signals_type ON rm_deal_signals(signal_type);

ALTER TABLE rm_deal_signals ENABLE ROW LEVEL SECURITY;
```

### 3.4 — NEW: `rm_buyer_deal_cadence` (Stage-Aware Contact Schedules)

```sql
CREATE TABLE rm_buyer_deal_cadence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES remarketing_buyers(id),
  deal_id uuid NOT NULL REFERENCES deals(id),
  deal_stage_name text NOT NULL, -- snapshot of stage when cadence was set
  expected_contact_days integer NOT NULL DEFAULT 14,
  last_contacted_at timestamptz,
  last_contact_source text CHECK (last_contact_source IN (
    'task','fireflies','smartlead','smartlead_reply','direct_email','meeting'
  )),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(buyer_id, deal_id)
);

CREATE INDEX IF NOT EXISTS idx_cadence_buyer ON rm_buyer_deal_cadence(buyer_id);
CREATE INDEX IF NOT EXISTS idx_cadence_deal ON rm_buyer_deal_cadence(deal_id);
CREATE INDEX IF NOT EXISTS idx_cadence_overdue ON rm_buyer_deal_cadence(last_contacted_at)
  WHERE is_active = true;
```

### 3.5 — NEW: `rm_task_extractions` (Extraction Run Log)

```sql
CREATE TABLE rm_task_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id text NOT NULL,
  transcript_status text DEFAULT 'queued'
    CHECK (transcript_status IN ('queued','ready','processing','completed','failed')),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  deal_stage_at_extraction text,
  status text DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed')),
  tasks_saved integer DEFAULT 0,
  tasks_discarded integer DEFAULT 0,
  signals_extracted integer DEFAULT 0,
  failure_reason text,
  run_at timestamptz DEFAULT now()
);
```

### 3.6 — NEW: `rm_task_discards` (Guardrail Audit Log)

```sql
CREATE TABLE rm_task_discards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id text,
  entity_type text,
  entity_id uuid,
  candidate_title text,
  discard_reason text CHECK (discard_reason IN (
    'failed_category','failed_relevance','failed_confidence',
    'failed_record_lookup','failed_stage','duplicate','auto_expired'
  )),
  ai_relevance_score integer,
  ai_confidence text,
  quote text, -- purged after 90 days
  discarded_at timestamptz DEFAULT now()
);

-- RLS: admin-only read access
ALTER TABLE rm_task_discards ENABLE ROW LEVEL SECURITY;
```

### 3.7 — NEW: `rm_task_activity_log` (Audit Trail)

**This was missing from v3.0.** At 10-20 users, you need to know who changed what.

```sql
CREATE TABLE rm_task_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES daily_standup_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  action text NOT NULL CHECK (action IN (
    'created','edited','reassigned','completed','reopened',
    'snoozed','cancelled','confirmed','dismissed','commented',
    'priority_changed','status_changed','dependency_added'
  )),
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_activity_task ON rm_task_activity_log(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_user ON rm_task_activity_log(user_id);
```

### 3.8 — NEW: `rm_task_comments` (Threaded Discussion)

**This was missing from v3.0.** Single-value `notes` doesn't scale with teams.

```sql
CREATE TABLE rm_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES daily_standup_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  body text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON rm_task_comments(task_id);

ALTER TABLE rm_task_comments ENABLE ROW LEVEL SECURITY;
```

### 3.9 — ALTER `listings` (Add Retained Flag)

```sql
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS is_retained boolean DEFAULT false;
```

### 3.10 — NEW: `platform_settings` (Configurable Thresholds)

```sql
CREATE TABLE platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid REFERENCES profiles(id),
  updated_at timestamptz DEFAULT now()
);

-- Seed defaults
INSERT INTO platform_settings (key, value) VALUES
  ('ai_relevance_threshold', '7'),
  ('ai_task_expiry_days', '7'),
  ('ai_task_expiry_warning_days', '5'),
  ('buyer_spotlight_default_cadence_days', '14')
ON CONFLICT (key) DO NOTHING;
```

### 3.11 — RLS Policies on `daily_standup_tasks` (Updated)

```sql
-- Users see tasks they own
CREATE POLICY "Users see own tasks"
  ON daily_standup_tasks FOR SELECT
  USING (assignee_id = auth.uid());

-- Users see tasks on listings where they are deal team members
CREATE POLICY "Deal team sees listing tasks"
  ON daily_standup_tasks FOR SELECT
  USING (
    deal_team_visible = true
    AND entity_type = 'listing'
    AND entity_id IN (
      SELECT listing_id FROM rm_deal_team WHERE user_id = auth.uid()
    )
  );

-- Users see tasks on deals under their listings
CREATE POLICY "Deal team sees deal tasks"
  ON daily_standup_tasks FOR SELECT
  USING (
    deal_team_visible = true
    AND entity_type = 'deal'
    AND entity_id IN (
      SELECT d.id FROM deals d
      JOIN rm_deal_team dt ON dt.listing_id = d.listing_id
      WHERE dt.user_id = auth.uid()
    )
  );

-- Admins see all
CREATE POLICY "Admins see all tasks"
  ON daily_standup_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('admin','owner')
    )
  );
```

**Performance note:** The deal team subquery in the deal tasks policy joins through `deals → rm_deal_team`. Add this index:

```sql
CREATE INDEX IF NOT EXISTS idx_deals_listing ON deals(listing_id);
```

---

## Part Four: AI Guardrails — Four Layers (Corrected)

Every AI-extracted task must pass all four layers. Same as v3.0 but with corrected stage names.

### Layer 1: Category Filter

Same as v3.0. **ALLOWED:** Tasks that directly advance the buyer-finding or deal-closing process. **BLOCKED:** Billing, marketing, HR, platform dev, personal tasks.

Deal-context override: if a task touches a normally-blocked category but clearly serves the active deal process, it is allowed.

### Layer 2: Scoring Filter

Relevance >= threshold (default 7, configurable via `platform_settings`) AND confidence IN ('high', 'medium').

### Layer 3: Stage Filter (Corrected for Actual Stages)

| Deal Stage | Valid Task Categories | Blocked at This Stage |
|-----------|----------------------|----------------------|
| **Sourced** | Seller info collection, seller relationship, internal qualification | CIM, NDA, fee agreement, IOI/LOI, due diligence |
| **Qualified** | Buyer universe building, buyer qualification, buyer outreach initiation, seller info collection | IOI/LOI, due diligence |
| **NDA Sent / NDA Signed** | NDA execution, buyer outreach/re-engagement, seller relationship, buyer qualification | IOI/LOI, due diligence |
| **Fee Agreement Sent / Fee Agreement Signed** | Fee agreement follow-up, CIM delivery, buyer outreach, meeting setup, buyer qualification | IOI/LOI, due diligence |
| **Due Diligence** | Due diligence coordination, buyer IC follow-up, seller relationship | NDA (done), CIM (done), initial outreach |
| **LOI Submitted** | LOI process, seller relationship, completion follow-up, due diligence prep | NDA, CIM, initial buyer outreach |
| **Under Contract** | Closing coordination, completion follow-up, seller relationship | NDA, CIM, IOI, new buyer outreach |
| **Closed Won / Closed Lost** | No new tasks extracted — terminal stage | Everything |

### Layer 4: Record Check

Confirm the linked entity_id exists in the correct table (`listings`, `deals`, `remarketing_buyers`, or `contacts`).

### Configurable Threshold Calibration

Same process as v3.0:
- Week 1-2 post-launch: admin reviews all discards daily
- Track false positive rate (good tasks discarded) and false negative rate (bad tasks surfaced)
- Adjust threshold in `platform_settings` — not hardcoded

---

## Part Five: Updated AI System Prompt — v3.1

Key changes from v3.0: uses actual deal stage names, references correct entity types, adds the existing task_type categories.

```
SYSTEM PROMPT v3.1 — DO NOT MODIFY WITHOUT WRITTEN SIGN-OFF

You are an extraction engine for SourceCo, an M&A advisory firm. You process call
transcripts to extract two types of output: (1) follow-up TASKS, and (2) deal SIGNALS.

CONTEXT YOU WILL RECEIVE:
  listing_name: The name of the business being sold
  deal_stage: The current stage of relevant buyer deals (from: Sourced, Qualified,
    NDA Sent, NDA Signed, Fee Agreement Sent, Fee Agreement Signed, Due Diligence,
    LOI Submitted, Under Contract, Closed Won, Closed Lost)
  deal_stage_valid_categories: List of task categories allowed at this stage
  buyer_names_in_conversation: Known buyer firms discussed on this call
  speaker_map: If available, maps 'Speaker 1', 'Speaker 2' etc. to roles
    (e.g. 'Speaker 1 = SourceCo advisor', 'Speaker 2 = Business owner')
  team_members: List of SourceCo team member names for assignee matching

═══════════════════════════════════════════
PART 1: TASK EXTRACTION
═══════════════════════════════════════════

EXTRACT TASKS ONLY if they fit one of these categories AND are in deal_stage_valid_categories:

  - contact_owner: Reach out to or follow up with a business owner about a deal
  - build_buyer_universe: Research and compile potential buyers for a deal
  - follow_up_with_buyer: Follow up on an existing buyer conversation
  - send_materials: Send teasers, CIMs, financials, or other deal documents to buyers
  - schedule_call: Arrange a call with an owner, buyer, or internal team
  - update_pipeline: Update CRM records, deal status, or notes
  - nda_execution: NDA or fee agreement document steps
  - ioi_loi_process: IOI, LOI, or offer process management
  - due_diligence: Due diligence coordination between buyer and seller
  - buyer_qualification: Buyer qualification (fund size, mandate, geographic fit)
  - seller_relationship: Seller relationship management tied to the active sale
  - buyer_ic_followup: Buyer investment committee or fund-level process follow-ups

NEVER EXTRACT tasks about: billing/invoices, marketing/content, HR/hiring,
platform development, personal tasks, or anything not in deal_stage_valid_categories.

SPEAKER IDENTIFICATION: Use the speaker_map to determine WHO made each commitment.
  If Speaker 1 = advisor says 'I'll send that over': assigned_to = 'advisor'
  If Speaker 2 = seller says 'I'll get you those numbers': assigned_to = 'seller'
  If a buyer name is mentioned as making a commitment: assigned_to = 'buyer'
  If speaker is unknown or ambiguous: assigned_to = 'unknown' (these score lower)

ASSIGNEE MATCHING: If a team member name from team_members is mentioned as responsible
for a task, include assignee_name = that name exactly as listed.

SECONDARY ENTITY: If the task clearly involves a specific buyer from
buyer_names_in_conversation, include secondary_entity_name = that buyer's name exactly
as listed. If the task involves a different listing than listing_name, note it in
other_listing_hint.

DEDUP: If the same commitment is discussed multiple times in the transcript, extract
it only once. Use the most specific version.

For each valid task return a JSON object:
  task_title: string, max 100 chars, action verb first
  task_type: one of the categories above
  due_date_hint: ISO date if timeframe stated, else null
  quote: verbatim sentence from transcript
  assigned_to: 'advisor' | 'seller' | 'buyer' | 'unknown'
  assignee_name: team member name from team_members, or null
  secondary_entity_name: buyer name from buyer_names_in_conversation or null
  other_listing_hint: listing name if task is about a different listing, else null
  relevance_score: integer 1-10 (only include if >= configured_threshold)
  confidence: 'high' | 'medium' (never include low-confidence tasks)

═══════════════════════════════════════════
PART 2: SIGNAL EXTRACTION
═══════════════════════════════════════════

After tasks, separately identify DEAL SIGNALS — statements that indicate deal risk,
deal momentum, or buyer sentiment, even if no action was stated.

Signal types to detect:
  CRITICAL: buyer pausing investments, seller withdrawing, deal-threatening events
  WARNING: buyer hesitation, timeline slippage, seller concerns, competitor mentioned
  POSITIVE: buyer enthusiasm, accelerated timeline, IC approval, strong interest
  NEUTRAL: informational context with no clear positive or negative valence

For each signal return a JSON object:
  signal_type: 'critical' | 'warning' | 'positive' | 'neutral'
  signal_category: 'ic_pause' | 'seller_hesitation' | 'buyer_interest' |
    'timeline_risk' | 'competitor_activity' | 'fund_status' | 'other'
  summary: 1-2 sentence plain English description of the signal
  quote: verbatim sentence that triggered this signal

Return a single JSON object: { tasks: [...], signals: [...] }
No preamble, no explanation, no markdown.
```

---

## Part Six: Deal Lifecycle Integration (Corrected)

### Listing Status Changes

Since actual listing statuses are `active`, `inactive`, `pending`, `sold`:

| Listing Status Change | What Happens to Open Tasks | What Happens to AI Suggestions |
|----------------------|---------------------------|-------------------------------|
| `active` → `sold` | All open tasks auto-set to `status='listing_closed'`. Owner notified. Completed tasks retained. | Auto-dismissed. Pending extractions cancelled. |
| `active` → `inactive` | All open tasks auto-snoozed (30 days default). Owner notified. | Remain in queue with 'listing inactive' warning. |
| Any → `active` | Snoozed tasks auto-restored to `pending`. | Normal processing resumes. |

### Deal Stage Changes (Terminal)

| Deal Stage Change | What Happens |
|-------------------|-------------|
| Any → `Closed Won` | Tasks on this specific deal (entity_type='deal', entity_id=deal.id) auto-completed with completion_notes='Deal closed won'. Listing-level tasks unaffected. |
| Any → `Closed Lost` | Tasks on this specific deal auto-cancelled. Listing-level tasks unaffected (other buyers may still be active). |

**Implementation:** Database trigger on `deals` table watching `stage_id` changes. Look up new stage name from `deal_stages`. If terminal, update tasks for that deal only.

### Stage Advance Warning

When a deal's stage advances, tasks linked to that deal that belong to categories incompatible with the new stage get a warning flag — not auto-cancelled. Owner decides.

---

## Part Seven: AI Command Center Integration (NOT a Separate Chatbot)

**v3.0 proposed building a separate chatbot. This is wrong.** The AI Command Center already exists with 85+ tools, SSE streaming, intent routing, and an orchestration loop. v3.1 adds task management tools to the existing system.

### New Tools to Add to AI Command Center

Add these to `supabase/functions/ai-command-center/tools/task-tools.ts`:

```typescript
// New tool definitions to register in tools/index.ts

// READ TOOLS (no confirmation required)
get_task_inbox         // My tasks, filtered by status/priority/entity/date range
get_daily_briefing     // Today's overdue + due today + due this week + AI pending + buyer spotlight
get_overdue_tasks      // All overdue tasks for user, with aging tier
get_buyer_spotlight    // Buyers overdue for contact, ranked by score + cadence
get_deal_signals       // Signals for a listing/deal, sorted by type
get_task_dependencies  // Show blocking chain for a task

// WRITE TOOLS (confirmation required)
create_task            // Create manual task with entity linking
snooze_task            // Set snoozed_until date
bulk_reassign_tasks    // Reassign all tasks from one user to another
confirm_ai_task        // Confirm AI-suggested task (requires due_date if null)
dismiss_ai_task        // Dismiss AI-suggested task
add_task_comment       // Add threaded comment to task
```

### New Router Categories

Add to `router.ts` bypass rules:

```
"what's on my plate" / "my tasks" / "task inbox" → TASK_INBOX (STANDARD)
"daily briefing" / "morning briefing" → DAILY_BRIEFING (STANDARD)  [already exists]
"what's overdue" → TASK_INBOX (QUICK)
"which buyers need follow-up" → BUYER_SPOTLIGHT (STANDARD)
"snooze task" / "reassign all tasks" → TASK_ACTION (STANDARD, confirmation required)
```

### Session Context (Extend Existing)

The AI Command Center already receives `page_context` with `entity_id`, `entity_type`, `page`, `tab`. Use this for task context resolution:

- If user says "What about the CIM?" while on a listing page → resolve to that listing's CIM tasks
- If user says "Show me buyer tasks" while on a deal page → tasks for that deal's buyer
- No separate session memory system needed — the existing `page_context` + `history` handles this

### Daily Briefing (via AI Command Center, not separate edge function)

The `get_daily_briefing` tool queries:
1. Overdue tasks for user, ordered by days overdue desc
2. Due today, ordered by priority desc then buyer_deal_score desc
3. Due this week count + top 3
4. AI tasks pending review (source='ai', confirmed_at IS NULL, dismissed_at IS NULL, expires_at > now())
5. Buyer spotlight: `rm_buyer_deal_cadence` where overdue, retained listings first, ranked by buyer_deal_score
6. Unacknowledged critical signals

**Email briefing:** A separate scheduled edge function `rm-send-daily-briefing-email` runs at 8am per user timezone. Calls the same queries, formats as plain text email. This is the one new edge function needed for briefing.

---

## Part Eight: Task Templates

Templates create tasks with `source='template'`, assigned to the listing's deal team lead (from `rm_deal_team` where `role='lead'`).

### "Start Deal Process" Button

On each Listing detail page, add a "Start Deal Process" button. Opens a modal to select which stage template to apply:

| Template Stage | Tasks Created | Default Due |
|---------------|---------------|-------------|
| **Intake & Qualification** | Conduct intake call with owner; Collect 3 years P&Ls; Collect EBITDA bridge; Qualify deal for full engagement | 7 / 14 / 14 / 21 days |
| **Build Buyer Universe** | Build initial buyer universe (50+ buyers); Score all buyers against deal; Get seller approval on buyer list | 14 / 21 / 28 days |
| **NDA Phase** | Send NDA to top 15 buyers; Track NDA returns; Follow up on unsigned NDAs at 7 days | 3 / ongoing / rolling |
| **CIM Phase** | Deliver CIM to all NDA-signed buyers; Follow up on CIM receipt; Set first round IOI deadline | 1 / 5 / 30 days |
| **IOI & Presentations** | Review all IOIs received; Select buyers for management presentations; Schedule presentations; Collect final IOIs | Relative to IOI deadline |
| **LOI & Diligence** | Send LOI to seller for review; Seller feedback on LOI; Open data room; Assign DD coordinator | 3 / 7 / 3 / 1 days |

Tasks are created with `entity_type='listing'`, `entity_id=listing.id`. Template tasks pre-populate `depends_on` where applicable (e.g. "Deliver CIM" depends on "NDA Signed" completion).

---

## Part Nine: Task Aging & Escalation (Corrected)

Same tiers as v3.0 but with notification preferences to prevent overload at scale.

| Tier | Days Overdue | Visual | Notification | Escalation |
|------|-------------|--------|-------------|------------|
| At Risk | Due in 48h | Amber badge | Toast reminder (if enabled) | None |
| Recent | 1-3 days | Red badge | In-app banner | None |
| Aging | 4-7 days | Red italic | Daily email (if enabled) | Notify deal team lead |
| Critical | 8-14 days | Red bold highlighted | Daily email + in-app urgent | Notify lead + admin |
| Abandoned | 15+ days (retained listings only) | Red 'ABANDONED' label | Immediate email | Admin dashboard |

### Notification Preferences (NEW — missing from v3.0)

Add to user profile settings:

| Setting | Default | Options |
|---------|---------|---------|
| `task_email_notifications` | `true` | on/off |
| `task_email_frequency` | `daily_digest` | `immediate` / `daily_digest` / `off` |
| `task_inapp_toasts` | `true` | on/off |
| `daily_briefing_channel` | `both` | `email` / `inapp` / `both` / `off` |
| `escalation_notifications` | `true` | on/off (for deal team leads) |

Low-priority tasks on non-retained listings skip the Abandoned tier — escalation suppressed.

---

## Part Ten: Smartlead & Fireflies Integration (Corrected)

### Fireflies Integration — Extend `extract-standup-tasks`

Don't build a new edge function. Extend the existing `extract-standup-tasks` to:

1. Accept the v3.1 system prompt (with deal stage context and signal extraction)
2. Run the four guardrail layers on extracted tasks
3. Save signals to `rm_deal_signals`
4. Log extraction runs to `rm_task_extractions`
5. Log discards to `rm_task_discards`

**Fireflies Webhook:** Add a new endpoint `rm-fireflies-webhook` that:
- Receives Fireflies `transcript_ready` webhook
- Matches participant emails to listings (via `listings.main_contact_email`) and deals
- Calls the extended `extract-standup-tasks` with the transcript ID and matched context

### Smartlead Integration

New edge function `rm-smartlead-contact-event`:
- On `email_sent`: Update `rm_buyer_deal_cadence.last_contacted_at`, source='smartlead'. **Partial contact** — resets clock by 50% of cadence period.
- On `email_replied`: Full contact update + create suggested task "Review [buyer] reply to [campaign]" with source='system', priority='high'.
- On `email_bounced`: Flag contact `bad_email=true`. Do NOT update last_contacted_at.

---

## Part Eleven: Buyer Scoring Integration

When inserting a task with `entity_type='deal'` or `entity_type='buyer'`:
1. Look up the buyer's composite score for the relevant listing from the existing scoring system
2. Store as `buyer_deal_score` on the task at creation time
3. Display as score badge in task inbox: 9-10 green, 7-8 blue, 5-6 amber, <5 grey
4. Sort order: overdue first, then buyer_deal_score desc within same due date

The AI extraction prompt receives top 10 buyer scores so it can weight high-fit buyer tasks higher.

---

## Part Twelve: Privacy & Data Retention

Same as v3.0, applied to the correct tables:

| Data | Table | Access | Retention |
|------|-------|--------|-----------|
| AI evidence quotes | `daily_standup_tasks.ai_evidence_quote` | Task owner + deal team (RLS) | Auto-nulled after 90 days |
| Discard quotes | `rm_task_discards.quote` | Admin-only (RLS) | Row deleted after 90 days |
| Signal quotes | `rm_deal_signals.verbatim_quote` | Deal team (RLS) | Auto-nulled after 90 days |
| Transcript IDs | Various | Same as parent row | Retained indefinitely |
| Completion notes | `daily_standup_tasks.completion_notes` | Task owner + deal team | Retained for listing lifetime + 3 years |

Implement via nightly `pg_cron` job:
```sql
-- Purge AI evidence quotes older than 90 days
UPDATE daily_standup_tasks
  SET ai_evidence_quote = '[Quote purged — 90-day retention policy]'
  WHERE ai_evidence_quote IS NOT NULL
    AND created_at < now() - interval '90 days';

-- Purge signal quotes
UPDATE rm_deal_signals
  SET verbatim_quote = '[Quote purged — 90-day retention policy]'
  WHERE verbatim_quote IS NOT NULL
    AND created_at < now() - interval '90 days';

-- Delete old discard rows
DELETE FROM rm_task_discards
  WHERE discarded_at < now() - interval '90 days';
```

---

## Part Thirteen: Task Dependencies

Same as v3.0 — soft warnings, not hard blocks. The `depends_on` field on `daily_standup_tasks` references another task. If the blocking task is not completed, the UI shows a warning:

| Dependent Task | Blocking Task | Warning |
|---------------|---------------|---------|
| Send CIM to buyer | NDA countersigned by buyer | 'NDA not yet confirmed for this buyer — are you sure?' |
| Schedule management presentation | CIM delivered and confirmed | 'CIM not confirmed delivered — are you sure?' |
| Follow up on IOI | IOI deadline set | 'IOI deadline not yet set for this buyer' |
| Open data room | LOI signed | 'LOI not yet executed — are you sure?' |

User can override any warning with a confirmation click. Template tasks pre-populate dependencies.

**Note on `is_blocked` generated column from v3.0:** This cannot work as a `GENERATED ALWAYS AS` column because PostgreSQL generated columns cannot reference other rows. Instead, compute `is_blocked` in the application layer:

```sql
-- Query to check if a task is blocked
SELECT t.id, t.depends_on,
  CASE WHEN t.depends_on IS NOT NULL
    AND dep.status NOT IN ('completed','listing_closed')
    THEN true ELSE false
  END as is_blocked
FROM daily_standup_tasks t
LEFT JOIN daily_standup_tasks dep ON dep.id = t.depends_on;
```

---

## Part Fourteen: Scaling Considerations (2-3 → 10-20 People)

These items were missing from v3.0 and are critical for the growth plan.

### Team Dashboard (Add in Phase 2)

Managers need a "who's doing what" view from day one of scaling:
- Grid view: team members as columns, task counts by status
- Workload balancing: visual indicator when someone has >15 open tasks
- Reassignment: drag-and-drop or bulk reassign between team members

### Bulk Operations

- "Reassign all [person]'s tasks to [person]" — via AI Command Center tool
- "Snooze all tasks on [listing]" — when listing goes on hold
- Multi-select in task inbox for batch status changes

### Daily Briefing Performance

At 20 users with 8am briefing, the email function runs 20 queries simultaneously. Pre-compute a materialized view refreshed at 7:45am:

```sql
CREATE MATERIALIZED VIEW mv_daily_briefing AS
SELECT
  t.assignee_id,
  count(*) FILTER (WHERE t.due_date < CURRENT_DATE AND t.status IN ('pending','in_progress')) as overdue_count,
  count(*) FILTER (WHERE t.due_date = CURRENT_DATE) as due_today_count,
  count(*) FILTER (WHERE t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7) as due_this_week_count,
  count(*) FILTER (WHERE t.source = 'ai' AND t.confirmed_at IS NULL AND t.dismissed_at IS NULL) as ai_pending_count
FROM daily_standup_tasks t
WHERE t.status NOT IN ('completed','cancelled','listing_closed')
GROUP BY t.assignee_id;
```

Refresh nightly at 7:45am via pg_cron. Individual briefing queries use the materialized view for counts and only hit the main table for the top N detail items.

---

## Part Fifteen: Phased Build Plan — v3.1

### Phase 1: Extend Existing System + Templates

**Duration: 2-3 weeks**

| Item | Description |
|------|-------------|
| Schema migration | Run ALTER TABLE statements from Section 3.1. Create new tables from 3.2-3.10. |
| Backfill entity fields | Populate entity_type/entity_id from existing deal_id. |
| Register routes | Add DailyTaskDashboard and DailyTaskAnalytics to admin-routes.tsx (currently missing). |
| Entity-linked task tabs | Add Tasks tab to Listing, Deal, and Buyer detail pages. Query by entity_type + entity_id. |
| Task creation with entities | Update AddTaskDialog to support entity_type selection, secondary entity search. |
| rm_deal_team | Create table, add team management UI on Listing pages. |
| Task templates | "Start Deal Process" button on Listing pages. Stage template modal. |
| Snooze | Add snooze presets to TaskCard menu. Nightly job to wake snoozed tasks. |
| Notification preferences | Add settings to user profile. Wire into existing notification system. |
| Completion evidence | Add completion_notes field to task completion flow. Nudge but don't require. |
| Task comments | Add rm_task_comments table and comment thread UI on task detail. |
| Task activity log | Log all task mutations to rm_task_activity_log. |
| Deal lifecycle hooks | Database triggers on listings.status and deals.stage_id changes. |
| is_retained flag | Add to listings, surface in task inbox sort. |

**Acceptance Criteria:**
- Team creates manual tasks linked to correct entities on Day 1
- Template tasks created in <5 seconds per stage
- Routes accessible in admin navigation
- Deal lifecycle triggers fire correctly on status/stage changes
- Task comments work for threaded discussion

### Phase 2: Daily Briefing + Team Dashboard

**Duration: 1-2 weeks**

| Item | Description |
|------|-------------|
| AI Command Center task tools | Add get_task_inbox, get_daily_briefing, get_overdue_tasks, get_buyer_spotlight tools. |
| On-demand briefing | "What's on my plate?" in AI Command Center returns formatted briefing. |
| Email briefing | New edge function rm-send-daily-briefing-email. 8am per timezone. Plain text, mobile-readable. |
| Materialized view | Create mv_daily_briefing for performance. pg_cron refresh at 7:45am. |
| Team dashboard | Manager view: team workload grid, task counts by person, bulk reassign. |
| Buyer spotlight | rm_buyer_deal_cadence queries. Retained listings first, ranked by score. |

**Acceptance Criteria:**
- Team uses AI Command Center briefing as daily starting point
- Email briefing received before 8:05am
- Managers can see and rebalance team workload

### Phase 3: AI Extraction Enhancement + Signals

**Duration: 2-3 weeks**

| Item | Description |
|------|-------------|
| Extend extract-standup-tasks | v3.1 system prompt, four guardrail layers, signal extraction. |
| rm_task_extractions + rm_task_discards | Extraction logging and discard audit. |
| rm_deal_signals | Signal storage and display on Listing/Deal pages. |
| Fireflies webhook | rm-fireflies-webhook endpoint for automatic transcript processing. |
| AI Suggested view | Tasks with source='ai', confirm/dismiss/edit flow. Due date required before confirm. |
| 7-day expiry | Nightly job: expire unreviewed AI tasks. Day-5 warning alert. |
| Buyer scoring on tasks | Fetch and store buyer_deal_score at task creation. Display in inbox. |
| Smartlead webhook | rm-smartlead-contact-event for cadence updates. |

**Acceptance Criteria:**
- AI extracts 2-5 valid tasks per transcript with correct entity linking
- Discard audit log visible to admins
- Signals appear on listing/deal pages with acknowledge flow
- Buyer scores visible on tasks, sort order correct
- Smartlead events update last_contacted_at

### Phase 4: Aging, Dependencies & Analytics

**Duration: 1-2 weeks**

| Item | Description |
|------|-------------|
| Task aging tiers | Visual treatment + escalation notifications per tier. |
| Task dependencies | depends_on field, blocking warnings in UI, template auto-population. |
| Admin threshold calibration | UI to adjust ai_relevance_threshold in platform_settings. |
| Cross-transcript dedup | Dedup by (entity_id, task_type, transcript_id) — not semantic similarity. |
| Task analytics + outcome metrics | Deal velocity, re-engagement rate, signal acknowledgement rate. |
| Recurring tasks | Optional: recurring task templates for ongoing process items. |

**Acceptance Criteria:**
- Overdue escalation notifications working
- Duplicate tasks eliminated across transcript reprocessing
- Admin can adjust threshold from UI
- Outcome metrics dashboard functional

---

## Part Sixteen: Success Metrics — v3.1

| Tier | Metric | Target | Measurement |
|------|--------|--------|-------------|
| **System** | Tasks with valid entity link | 100% | DB constraint + daily check |
| **System** | AI extraction success rate | 50-80% save rate | rm_task_extractions |
| **System** | AI task expiry rate | <20% | rm_task_discards where reason='auto_expired' |
| **System** | Zero AI tasks about non-M&A topics | 100% | Weekly review of rm_task_discards |
| **Adoption** | Team opens task inbox daily | >80%, >5 days/week | Session analytics |
| **Adoption** | Daily briefing usage | >60% via any channel | AI Command Center logs + email opens |
| **Adoption** | Manual tasks per listing | >5 per active listing | daily_standup_tasks GROUP BY entity_id |
| **Adoption** | Overdue task rate | <15% | Open overdue / total open |
| **Outcomes** | Buyer re-engagement after spotlight | >30% respond in 7 days | Completed follow-up + Fireflies call |
| **Outcomes** | Critical signal acknowledgement | >90% within 24h | rm_deal_signals |
| **Outcomes** | Task-to-call conversion | >40% | Completed buyer tasks + transcript within 14d |
| **Outcomes** | Deal velocity improvement | Establish baseline, then improve | Stage transition timestamps |

---

## Part Seventeen: Core Principles (Unchanged from v3.0)

| Principle | Rule |
|-----------|------|
| Record Association | Every task linked to an existing Listing, Deal, Buyer, or Contact. DB enforced. |
| M&A Scope Only | AI extracts only deal-advancing tasks for specific listings in SourceCo. |
| Deal Stage Awareness | AI extraction is stage-contextual. Inappropriate tasks discarded before user sees them. |
| Completion Evidence | System nudges users to document outcomes, not just completions. |
| No Silent Failures | AI extraction failures logged and record owner notified. |
| Retained Listings First | Retained engagements surfaced first in all views. |
| Data Minimisation | Verbatim quotes auto-purged after 90 days. |

---

## Appendix A: Deduplication Strategy (Corrected)

v3.0 proposed "semantic similarity > 0.8" which requires vector embeddings and doesn't work with `pg_trgm`. v3.1 uses a practical approach:

**Within same transcript:** The AI prompt instructs dedup at extraction time — same commitment discussed twice = extract once.

**Across transcripts:** Dedup by composite key:
```sql
SELECT id FROM daily_standup_tasks
WHERE entity_id = $entity_id
  AND task_type = $task_type
  AND transcript_id = $transcript_id
  AND status NOT IN ('completed','cancelled','listing_closed');
```

If a match exists for the same entity + task type + transcript, skip. For cross-transcript dedup (same commitment mentioned in two calls), dedup by:
```sql
SELECT id FROM daily_standup_tasks
WHERE entity_id = $entity_id
  AND task_type = $task_type
  AND title ILIKE '%' || $key_phrase || '%'
  AND created_at > now() - interval '7 days'
  AND status NOT IN ('completed','cancelled','listing_closed');
```

This catches "Follow up with Acme Partners" appearing in Monday and Wednesday calls. Not perfect, but avoids the complexity and cost of vector embeddings.

---

## Appendix B: Migration from Existing System

The existing `daily_standup_tasks` system continues working throughout migration. No data loss, no downtime.

**Step 1:** Run ALTER TABLE migrations. All new columns are nullable or have defaults. Existing rows unaffected.

**Step 2:** Backfill entity fields:
```sql
UPDATE daily_standup_tasks
SET entity_type = 'deal', entity_id = deal_id
WHERE deal_id IS NOT NULL AND entity_id IS NULL;

UPDATE daily_standup_tasks
SET source = CASE WHEN is_manual THEN 'manual' ELSE 'ai' END
WHERE source IS NULL;
```

**Step 3:** Register routes in admin-routes.tsx. Existing pages become accessible.

**Step 4:** Deploy updated UI components. New fields appear alongside existing ones.

**Step 5:** Deploy updated extract-standup-tasks. New extractions use v3.1 prompt and guardrails. Old extractions are unaffected.

---

**END OF SPECIFICATION — VERSION 3.1**

*SourceCo — Confidential & Internal Use Only*
