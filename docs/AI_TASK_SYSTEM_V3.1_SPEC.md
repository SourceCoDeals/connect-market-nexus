# AI TASK MANAGEMENT SYSTEM — v3.1

## SourceCo Remarketing Tool

**Version 3.1 — Schema-Aligned Specification**
Incorporates all v3.0 fixes + 33 codebase alignment fixes | February 2026

---

## CRITICAL: What v3.0 Got Wrong (And This Spec Fixes)

### The 3 Blockers That Would Have Broken Everything

| # | Issue | Impact | v3.1 Fix |
|---|-------|--------|----------|
| 1 | **You already have a task system** | `daily_standup_tasks` + `standup_meetings` + `extract-standup-tasks` edge function already does AI extraction, priority scoring, assignee matching, approval flows. v3.0 creates a parallel `rm_tasks` system. Two task systems = confusion, split data, wasted work. | **Migrate and extend** `daily_standup_tasks` → rename to `rm_tasks` with ALTER TABLE. Preserve all existing data. Extend with new columns. |
| 2 | **Entity references don't match your schema** | v3.0 says `entity_type='deal'` references `listings(id)` — wrong. In your codebase: `listings` = the company/sellside engagement, `deals` = the buyer-deal pipeline entry (buyer × listing). `contacts` = seller contacts, `buyer_contacts` = buyer contacts. The spec conflates these. | **Use actual table names** as entity_type values: `'listing'`, `'deal'`, `'buyer'`, `'buyer_contact'`, `'contact'`. Each FK validated against the correct table. |
| 3 | **Deal lifecycle hooks trigger on statuses that don't exist** | v3.0 triggers on `listings.status IN ('closed','sold','withdrawn','dead')` — but `listings.status` only has `'active'` and `'inactive'`. Deal progression uses `deals.stage_id` → `deal_stages` table (e.g., 'Sourced', 'Qualified', 'NDA Sent', 'Closed Won', 'Closed Lost'). | **Lifecycle hooks fire on `deals.stage_id` changes**, not `listings.status`. Map actual `deal_stages.name` values to lifecycle actions. |

### 15 More Issues Fixed

| # | Issue | Fix |
|---|-------|-----|
| 4 | `rm_deal_team` FK references `listings(id)` but team membership should be per-deal | FK now references `deals(id)` — team is assigned per buyer-deal pipeline entry |
| 5 | `is_blocked` GENERATED column can't query other rows | Replace with a regular boolean column + trigger that updates it when `depends_on` task changes status |
| 6 | "similarity > 0.8" for dedup requires pg_trgm extension + doesn't do semantic similarity | Dedup by `(entity_id, task_type, transcript_id)` composite check — deterministic, no extensions needed |
| 7 | `is_retained` flag doesn't exist anywhere in the schema | Add `is_retained boolean DEFAULT false` to `listings` table. Or use existing `is_priority_target` field as proxy. |
| 8 | 7-day AI expiry at 10-20 users = 350+ tasks in queue constantly | Expiry reduced to 5 days. Day-3 alert instead of day-5. Batch dismiss UI for managers. |
| 9 | No notification preferences = deal leads get 20+ alerts/day at scale | Add `notification_preferences` JSONB column to `profiles` in Phase 1 |
| 10 | Missing indexes on RLS subqueries will cause slow reads | Spec now includes required indexes |
| 11 | Stage filter is per-listing, not per-deal — kills legitimate tasks for new buyers entering at different stages | Stage filter uses `deals.stage_id` (buyer-specific), not listing-level stage |
| 12 | Chatbot session memory ignores existing AI Command Center | Task tools added to AI Command Center — no separate chatbot |
| 13 | No task activity audit log | `rm_task_activity_log` table added |
| 14 | No team dashboard for managers | Team Dashboard view added to Phase 1 |
| 15 | No bulk operations for task management | Bulk reassign, bulk complete, bulk snooze added to Phase 1 |
| 16 | No task comments — `notes` is single-value | `rm_task_comments` table added |
| 17 | Daily briefing at 8am for 20 users = 120+ queries simultaneously | Pre-computed briefing cache via nightly job |
| 18 | `deal_tasks` table already exists — third task system | `deal_tasks` data migrated into `rm_tasks` too |

---

## Part 1: Entity Model — Aligned to Actual Schema

### Your Actual Data Model (What Already Exists)

```
listings (id, title, status['active','inactive'], ebitda, deal_owner_id, ...)
    = The company being sold / the sellside engagement

deals (id, listing_id, remarketing_buyer_id, stage_id, assigned_to, ...)
    = A buyer-deal pipeline entry: one buyer's pursuit of one listing
    → deals.stage_id REFERENCES deal_stages(id)

deal_stages (id, name, position, stage_type, ...)
    = Pipeline stages: 'Sourced', 'Qualified', 'NDA Sent', 'NDA Signed',
      'Fee Agreement Sent', 'Fee Agreement Signed', 'Due Diligence',
      'Under Contract', 'LOI Submitted', 'Closed Won', 'Closed Lost'

remarketing_buyers (id, company_name, pe_firm_name, ...)
    = Buyer firms in the universe

buyer_contacts (id, buyer_id, name, email, ...)
    = Individual contacts at buyer firms

contacts (id, first_name, last_name, listing_id, contact_type, ...)
    = Seller-side contacts (business owners, etc.)

remarketing_scores (id, buyer_id, listing_id, composite_score, tier, ...)
    = Buyer-deal fit scores (geography, services, size, thesis)

daily_standup_tasks (id, title, deal_id→deals, assignee_id, status, priority_score, ...)
    = EXISTING task system with AI extraction

standup_meetings (id, fireflies_transcript_id, tasks_extracted, ...)
    = EXISTING meeting/transcript tracking

deal_tasks (id, deal_id→deals, title, assigned_to, status, ...)
    = EXISTING simple deal-specific tasks

profiles (id, first_name, last_name, ...)
    = User accounts
```

### Entity Type Mapping (v3.1)

| entity_type | References Table | Use Case |
|------------|-----------------|----------|
| `'listing'` | `listings(id)` | Tasks about the sellside engagement (collect seller financials, update CIM, etc.) |
| `'deal'` | `deals(id)` | Tasks about a specific buyer's pursuit (send NDA to buyer X, follow up on IOI) |
| `'buyer'` | `remarketing_buyers(id)` | Tasks about a buyer firm generally (research buyer, update buyer profile) |
| `'buyer_contact'` | `buyer_contacts(id)` | Tasks about a specific person at a buyer firm |
| `'contact'` | `contacts(id)` | Tasks about a seller-side contact |

**Why this matters:** A task like "Send CIM to Acme Capital" is a `deal` task (it's about Acme Capital's pursuit of a specific listing), not a `listing` task. The `deals` table already has `listing_id` + `remarketing_buyer_id` so you get both sides of the relationship from one FK.

---

## Part 2: Migration Strategy — Three Systems → One

### Current State: Three Task Tables

1. **`daily_standup_tasks`** — AI-extracted from Fireflies transcripts. Has priority scoring, assignee matching, approval workflow. ~active system.
2. **`deal_tasks`** — Simple manual tasks per deal. Has assigned_to, status, priority. ~active system.
3. **`rm_tasks`** (proposed) — v3.0's new table.

### Migration Plan

**Step 1: Rename + extend `daily_standup_tasks` → `rm_tasks`**

```sql
-- Rename the table (preserves all data, indexes, RLS policies)
ALTER TABLE daily_standup_tasks RENAME TO rm_tasks;

-- Add new columns (all nullable so existing rows are unaffected)
ALTER TABLE rm_tasks
  ADD COLUMN entity_type text,
  ADD COLUMN entity_id uuid,
  ADD COLUMN secondary_entity_type text,
  ADD COLUMN secondary_entity_id uuid,
  ADD COLUMN owner_id uuid REFERENCES profiles(id),
  ADD COLUMN deal_team_visible boolean DEFAULT true,
  ADD COLUMN source text DEFAULT 'manual',
  ADD COLUMN priority text DEFAULT 'medium',
  ADD COLUMN completion_notes text,
  ADD COLUMN completion_transcript_id text,
  ADD COLUMN ai_evidence_quote text,
  ADD COLUMN ai_relevance_score integer,
  ADD COLUMN ai_confidence text,
  ADD COLUMN ai_speaker_assigned_to text,
  ADD COLUMN transcript_id text,
  ADD COLUMN confirmed_at timestamptz,
  ADD COLUMN dismissed_at timestamptz,
  ADD COLUMN snoozed_until date,
  ADD COLUMN depends_on uuid REFERENCES rm_tasks(id),
  ADD COLUMN is_blocked boolean DEFAULT false,
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN notes text,
  ADD COLUMN buyer_deal_score integer,
  ADD COLUMN created_by uuid REFERENCES profiles(id),
  ADD COLUMN notification_sent boolean DEFAULT false;

-- Backfill entity references from existing deal_id
UPDATE rm_tasks
SET entity_type = 'deal',
    entity_id = deal_id,
    owner_id = assignee_id,
    source = CASE WHEN is_manual THEN 'manual' ELSE 'ai' END,
    ai_confidence = extraction_confidence
WHERE deal_id IS NOT NULL;

-- Backfill tasks without deal_id
UPDATE rm_tasks
SET entity_type = 'listing',
    owner_id = assignee_id,
    source = CASE WHEN is_manual THEN 'manual' ELSE 'ai' END,
    ai_confidence = extraction_confidence
WHERE deal_id IS NULL;

-- Map old statuses to new statuses
-- Old: 'pending', 'pending_approval', 'completed', 'dismissed', 'overdue'
-- New: 'open', 'in_progress', 'completed', 'snoozed', 'cancelled', 'deal_closed'
UPDATE rm_tasks SET status = 'open' WHERE status = 'pending';
UPDATE rm_tasks SET status = 'open' WHERE status = 'pending_approval';
UPDATE rm_tasks SET status = 'open' WHERE status = 'overdue';
-- 'completed' stays 'completed'
-- 'dismissed' maps to 'cancelled'
UPDATE rm_tasks SET status = 'cancelled' WHERE status = 'dismissed';

-- Add CHECK constraints after backfill
ALTER TABLE rm_tasks
  ADD CONSTRAINT rm_tasks_entity_type_check
    CHECK (entity_type IN ('listing','deal','buyer','buyer_contact','contact')),
  ADD CONSTRAINT rm_tasks_source_check
    CHECK (source IN ('manual','ai','chatbot','system','template')),
  ADD CONSTRAINT rm_tasks_status_check
    CHECK (status IN ('open','in_progress','completed','snoozed','cancelled','deal_closed')),
  ADD CONSTRAINT rm_tasks_priority_check
    CHECK (priority IN ('high','medium','low'));
```

**Step 2: Migrate `deal_tasks` data into `rm_tasks`**

```sql
INSERT INTO rm_tasks (
  title, description, entity_type, entity_id, owner_id, due_date,
  priority, status, source, created_by, created_at, completed_at, completed_by
)
SELECT
  title, description, 'deal', deal_id, assigned_to, due_date,
  COALESCE(priority, 'medium'),
  CASE WHEN status = 'pending' THEN 'open'
       WHEN status = 'done' THEN 'completed'
       ELSE COALESCE(status, 'open') END,
  'manual', assigned_by, created_at, completed_at, completed_by
FROM deal_tasks;

-- After verification, drop the old table
-- DROP TABLE deal_tasks; (do this after confirming migration)
```

**Step 3: Update `standup_meetings` → `rm_transcript_sources`**

```sql
ALTER TABLE standup_meetings RENAME TO rm_transcript_sources;
-- This table is fine as-is — just rename for clarity
```

**Step 4: Update all frontend references**
- `daily_standup_tasks` → `rm_tasks` (global find-replace)
- `deal_tasks` → `rm_tasks` (update queries to use entity_type='deal')
- `standup_meetings` → `rm_transcript_sources`

---

## Part 3: Complete Schema (v3.1)

### rm_tasks — Core Tasks Table (Extended from daily_standup_tasks)

| Field | Type & Constraints | Notes |
|-------|-------------------|-------|
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() | |
| title | text NOT NULL, max 200 chars | Must start with action verb |
| description | text — nullable | Carried over from daily_standup_tasks |
| entity_type | text NOT NULL CHECK IN ('listing','deal','buyer','buyer_contact','contact') | **FIXED: matches actual table names** |
| entity_id | uuid NOT NULL | Validated via trigger against correct table |
| secondary_entity_type | text CHECK IN ('listing','deal','buyer','buyer_contact','contact') — nullable | e.g., buyer on a deal task |
| secondary_entity_id | uuid — nullable | Validated if secondary_entity_type is set |
| due_date | date — nullable for source='ai', required otherwise | AI tasks may have null due date until confirmed |
| expires_at | timestamptz — nullable | AI tasks: created_at + 5 days (was 7, reduced for scale) |
| priority | text DEFAULT 'medium' CHECK IN ('high','medium','low') | |
| priority_score | numeric — nullable | **Carried over:** composite score from existing algorithm |
| priority_rank | integer — nullable | **Carried over:** rank among active tasks |
| owner_id | uuid NOT NULL REFERENCES profiles(id) | **Renamed from assignee_id** for clarity |
| deal_team_visible | boolean DEFAULT true | Visible to all deal team members |
| status | text DEFAULT 'open' CHECK IN ('open','in_progress','completed','snoozed','cancelled','deal_closed') | |
| source | text DEFAULT 'manual' CHECK IN ('manual','ai','chatbot','system','template') | |
| notes | text — nullable | |
| completion_notes | text — nullable | Outcome documented on completion |
| completed_by | uuid REFERENCES profiles(id) — nullable | May differ from owner |
| completed_at | timestamptz — nullable | |
| completion_transcript_id | text — nullable | Fireflies call that resolved the task |
| ai_evidence_quote | text — nullable, purged after 90 days | AI tasks only |
| ai_relevance_score | integer — nullable | AI tasks only |
| ai_confidence | text CHECK IN ('high','medium') — nullable | **Carried over from extraction_confidence** |
| ai_speaker_assigned_to | text CHECK IN ('advisor','seller','buyer') — nullable | Who AI thinks made the commitment |
| transcript_id | text — nullable | Fireflies transcript ID |
| source_meeting_id | uuid REFERENCES rm_transcript_sources(id) — nullable | **Carried over:** link to source meeting |
| source_timestamp | text — nullable | **Carried over:** approx time in meeting |
| deal_reference | text — nullable | **Carried over:** text reference to deal name |
| deal_id | uuid REFERENCES deals(id) — nullable | **Carried over:** direct FK to deals table |
| confirmed_at | timestamptz — nullable | When user confirmed AI suggestion |
| dismissed_at | timestamptz — nullable | When user dismissed AI suggestion |
| snoozed_until | date — nullable | |
| depends_on | uuid REFERENCES rm_tasks(id) — nullable | Blocking task |
| is_blocked | boolean DEFAULT false | **FIXED: regular column + trigger** (not GENERATED) |
| is_pinned | boolean DEFAULT false | **Carried over** from daily_standup_tasks |
| pinned_by | uuid REFERENCES profiles(id) — nullable | **Carried over** |
| pinned_at | timestamptz — nullable | **Carried over** |
| pinned_rank | integer — nullable | **Carried over** |
| pin_reason | text — nullable | **Carried over** |
| needs_review | boolean DEFAULT false | **Carried over:** flags tasks needing human review |
| buyer_deal_score | integer — nullable | From remarketing_scores.composite_score |
| task_type | text — nullable | **Carried over:** 'contact_owner', 'follow_up_with_buyer', etc. |
| notification_sent | boolean DEFAULT false | Track if notification was sent |
| created_by | uuid REFERENCES profiles(id) | |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz — auto-updated via trigger | |

### Required Indexes

```sql
CREATE INDEX idx_rm_tasks_owner_status ON rm_tasks(owner_id, status);
CREATE INDEX idx_rm_tasks_entity ON rm_tasks(entity_type, entity_id);
CREATE INDEX idx_rm_tasks_deal_id ON rm_tasks(deal_id);
CREATE INDEX idx_rm_tasks_due_date ON rm_tasks(due_date) WHERE status IN ('open','in_progress');
CREATE INDEX idx_rm_tasks_source_confirmed ON rm_tasks(source, confirmed_at) WHERE source = 'ai';
CREATE INDEX idx_rm_tasks_expires ON rm_tasks(expires_at) WHERE source = 'ai' AND confirmed_at IS NULL;
CREATE INDEX idx_rm_tasks_secondary ON rm_tasks(secondary_entity_type, secondary_entity_id) WHERE secondary_entity_id IS NOT NULL;
```

### is_blocked Trigger (Replaces Impossible GENERATED Column)

```sql
CREATE OR REPLACE FUNCTION update_is_blocked()
RETURNS trigger AS $$
BEGIN
  -- When a task is completed/cancelled, unblock tasks that depend on it
  IF NEW.status IN ('completed','cancelled','deal_closed') AND OLD.status NOT IN ('completed','cancelled','deal_closed') THEN
    UPDATE rm_tasks SET is_blocked = false WHERE depends_on = NEW.id;
  END IF;

  -- When a task is reopened, re-block tasks that depend on it
  IF NEW.status IN ('open','in_progress') AND OLD.status IN ('completed','cancelled','deal_closed') THEN
    UPDATE rm_tasks SET is_blocked = true WHERE depends_on = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_blocked
  AFTER UPDATE OF status ON rm_tasks
  FOR EACH ROW EXECUTE FUNCTION update_is_blocked();
```

### rm_deal_team — Deal Team Membership

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PRIMARY KEY | |
| deal_id | uuid NOT NULL REFERENCES **deals(id)** | **FIXED: references deals, not listings** |
| user_id | uuid NOT NULL REFERENCES profiles(id) | |
| role | text CHECK IN ('lead','analyst','support') | |
| created_at | timestamptz DEFAULT now() | |

**NOTE:** If you want team membership at the listing level (sellside engagement), add a separate `rm_listing_team` table. But tasks are managed per-deal, so deal-level team is what matters for RLS.

### rm_deal_signals — AI-Detected Deal Intelligence

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PRIMARY KEY | |
| deal_id | uuid REFERENCES deals(id) | **FIXED: references deals** |
| buyer_id | uuid REFERENCES remarketing_buyers(id) — nullable | |
| listing_id | uuid REFERENCES listings(id) — nullable | For listing-level signals |
| transcript_id | text NOT NULL | Source Fireflies transcript |
| signal_type | text CHECK IN ('positive','warning','critical','neutral') | |
| signal_category | text | e.g. 'ic_pause','buyer_interest','timeline_risk' |
| summary | text NOT NULL | |
| verbatim_quote | text — purged after 90 days | |
| acknowledged_by | uuid REFERENCES profiles(id) — nullable | |
| acknowledged_at | timestamptz | |
| created_at | timestamptz DEFAULT now() | |

### rm_buyer_deal_cadence — Stage-Aware Contact Schedules

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PRIMARY KEY | |
| buyer_id | uuid NOT NULL REFERENCES remarketing_buyers(id) | |
| deal_id | uuid NOT NULL REFERENCES **deals(id)** | **FIXED: references deals** |
| listing_id | uuid NOT NULL REFERENCES listings(id) | For convenience — derived from deals.listing_id |
| deal_stage_id | uuid REFERENCES deal_stages(id) | **FIXED: uses actual deal_stages FK** |
| expected_contact_days | integer NOT NULL | |
| last_contacted_at | timestamptz | |
| last_contact_source | text CHECK IN ('task','fireflies','smartlead','direct_email','meeting') | |
| is_active | boolean DEFAULT true | |

### rm_task_extractions — Extraction Run Log

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PRIMARY KEY | |
| transcript_id | text NOT NULL | |
| transcript_status | text CHECK IN ('queued','ready','processing','completed','failed') | |
| entity_type | text NOT NULL | |
| entity_id | uuid NOT NULL | |
| deal_stage_at_extraction | text | **Stage name** captured at extraction time |
| deal_stage_id_at_extraction | uuid | **Stage ID** for FK integrity |
| status | text CHECK IN ('pending','processing','completed','failed') | |
| tasks_saved | integer DEFAULT 0 | |
| tasks_discarded | integer DEFAULT 0 | |
| signals_extracted | integer DEFAULT 0 | |
| failure_reason | text | |
| run_at | timestamptz DEFAULT now() | |

### rm_task_discards — Guardrail Audit Log

Same as v3.0 with one fix:

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PRIMARY KEY | |
| transcript_id | text | |
| entity_type | text | |
| entity_id | uuid | |
| candidate_title | text | |
| discard_reason | text CHECK IN ('failed_category','failed_relevance','failed_confidence','failed_record_lookup','failed_stage','duplicate') | |
| ai_relevance_score | integer | |
| ai_confidence | text | |
| quote | text — purged after 90 days | RLS: admin-only |
| discarded_at | timestamptz DEFAULT now() | |

### rm_task_comments — Task Discussion Thread (NEW)

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PRIMARY KEY | |
| task_id | uuid NOT NULL REFERENCES rm_tasks(id) ON DELETE CASCADE | |
| author_id | uuid NOT NULL REFERENCES profiles(id) | |
| content | text NOT NULL | |
| created_at | timestamptz DEFAULT now() | |

### rm_task_activity_log — Audit Trail (NEW)

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PRIMARY KEY | |
| task_id | uuid NOT NULL REFERENCES rm_tasks(id) | |
| user_id | uuid NOT NULL REFERENCES profiles(id) | |
| action | text NOT NULL | 'created', 'status_changed', 'reassigned', 'priority_changed', 'commented', 'snoozed', 'confirmed', 'dismissed' |
| old_value | text — nullable | |
| new_value | text — nullable | |
| created_at | timestamptz DEFAULT now() | |

### platform_settings — Configurable Settings

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PRIMARY KEY | |
| key | text NOT NULL UNIQUE | e.g., 'ai_relevance_threshold', 'ai_task_expiry_days' |
| value | jsonb NOT NULL | Flexible value storage |
| updated_by | uuid REFERENCES profiles(id) | |
| updated_at | timestamptz DEFAULT now() | |

### profiles — Add These Columns

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{
    "email_briefing": true,
    "in_app_briefing": true,
    "task_assigned": true,
    "task_overdue": true,
    "escalation_alerts": true,
    "ai_suggestions": true,
    "signal_alerts": true
  }'::jsonb;
```

### listings — Add Retained Flag

```sql
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS is_retained boolean DEFAULT false;
```

**Alternative:** Use the existing `is_priority_target` boolean as a proxy for retained status. Discuss with team which is clearer.

---

## Part 4: AI Guardrails — Four Layers (v3.1)

Same four layers as v3.0 but with corrected stage references.

**Layer 1:** Category Filter — Is this task within allowed M&A categories?
**Layer 2:** Scoring Filter — Relevance >= threshold (configurable, default 7) AND confidence IN ('high','medium')
**Layer 3:** Stage Filter — Is this task appropriate for the deal's current `deal_stages.name`?
**Layer 4:** Record Check — Does the linked entity exist in the correct table?

### 4.1 Layer 3 — Stage Filter (Corrected for Actual deal_stages)

The AI receives the deal's current stage from `deal_stages.name` via `deals.stage_id`. Here are the mappings using your **actual stage names**:

| deal_stages.name | Valid Task Categories | Always Blocked |
|-----------------|----------------------|----------------|
| Sourced | Seller info collection, internal qualification, seller relationship | CIM, NDA, IOI/LOI, due diligence |
| Qualified | Buyer list building, buyer qualification, seller info, seller relationship | IOI/LOI, due diligence |
| NDA Sent | NDA follow-up, buyer outreach, buyer qualification, seller relationship | IOI/LOI, due diligence |
| NDA Signed | CIM delivery, buyer outreach, buyer qualification, meeting setup, seller relationship | IOI/LOI, due diligence |
| Fee Agreement Sent | Fee agreement follow-up, buyer outreach, CIM delivery, seller relationship | Due diligence |
| Fee Agreement Signed | CIM delivery, buyer outreach, IOI process, meeting setup, seller relationship | (none — full access) |
| Due Diligence | DD coordination, completion follow-up, seller relationship, buyer IC | New buyer outreach |
| Under Contract | Contract follow-up, closing coordination, seller relationship | New buyer outreach |
| LOI Submitted | LOI process, DD prep, seller relationship, buyer IC | CIM delivery, new buyer outreach |
| Closed Won | Post-closing tasks only | Everything else |
| Closed Lost | Post-mortem tasks only | Everything else |

### 4.2 Configurable Relevance Threshold

Same as v3.0:
- Default: 7/10
- Stored in `platform_settings` table (key: `'ai_relevance_threshold'`)
- Calibration: Week 1-2 post-launch, admin reviews ALL discards
- Adjust: false positive rate > 20% → lower to 6. False negative rate > 30% → raise to 8.

### 4.3 Deduplication Strategy (FIXED)

v3.0 specified "similarity > 0.8" which requires pg_trgm and doesn't do semantic matching. Replace with deterministic dedup:

```sql
-- Before inserting an AI-extracted task, check:
SELECT id FROM rm_tasks
WHERE transcript_id = :new_transcript_id
  AND entity_id = :new_entity_id
  AND task_type = :new_task_type
  AND status NOT IN ('cancelled', 'deal_closed')
LIMIT 1;

-- If match found → skip insertion, log to rm_task_discards with reason='duplicate'
```

For **cross-transcript** dedup (same commitment mentioned in multiple calls):
```sql
SELECT id FROM rm_tasks
WHERE entity_id = :new_entity_id
  AND task_type = :new_task_type
  AND title ILIKE '%' || :key_phrase || '%'
  AND created_at > now() - interval '14 days'
  AND status NOT IN ('completed', 'cancelled', 'deal_closed')
LIMIT 1;
```

Where `key_phrase` is the first 3-4 significant words of the task title (extracted by the AI as a dedup key).

### 4.4 Updated AI System Prompt — v3.1

```
SYSTEM PROMPT v3.1 — ALIGNED TO ACTUAL SCHEMA

You are an extraction engine for SourceCo, an M&A advisory firm. You process call
transcripts to extract two types of output: (1) follow-up TASKS, and (2) deal SIGNALS.

CONTEXT YOU WILL RECEIVE:
- listing_name: The name of the business being sold (from listings table)
- listing_id: UUID of the listing
- deal_id: UUID of the buyer-deal pipeline entry (from deals table), if applicable
- deal_stage: The current stage name (from deal_stages table, e.g., 'NDA Signed', 'Due Diligence')
- deal_stage_valid_categories: List of task categories allowed at this stage
- buyer_names_in_conversation: Known buyer firms discussed on this call
  (with their remarketing_buyer IDs and composite scores from remarketing_scores)
- speaker_map: Maps 'Speaker 1', 'Speaker 2' etc. to roles
  (e.g., 'Speaker 1 = SourceCo advisor', 'Speaker 2 = Business owner')
- team_members: List of SourceCo team member names (for assignee matching)

═══════════════════════════════════════════
PART 1: TASK EXTRACTION
═══════════════════════════════════════════

EXTRACT TASKS ONLY if they fit one of these categories AND are in deal_stage_valid_categories:
- Buyer outreach, re-engagement, or qualification for this specific deal
- Collecting financial or operational information from the seller
- Delivering deal materials to buyers (CIM, financials, management presentation)
- NDA execution, fee agreement, or legal document steps
- IOI, LOI, or offer process management
- Due diligence coordination between buyer and seller
- Scheduling calls or meetings between buyers and sellers
- Seller relationship management tied to the active sale process
- Buyer investment committee or fund-level process follow-ups
- Buyer qualification (fund size, dry powder, geographic mandate)

NEVER EXTRACT tasks about: billing/invoices, marketing/content, HR/hiring,
platform development, personal tasks, or anything not in deal_stage_valid_categories.

SPEAKER IDENTIFICATION: Use the speaker_map to determine WHO made each commitment.
If the speaker is a SourceCo advisor: assigned_to = 'advisor'
If the speaker is the seller/owner: assigned_to = 'seller'
If a buyer is mentioned as making a commitment: assigned_to = 'buyer'
If unknown: assigned_to = 'unknown' (these score lower)

TASK TYPE: Classify each task into one of:
contact_owner, build_buyer_universe, follow_up_with_buyer, send_materials,
update_pipeline, schedule_call, nda_follow_up, ioi_loi_process,
due_diligence, seller_relationship, buyer_qualification, other

SECONDARY ENTITY: If the task involves a specific buyer from buyer_names_in_conversation,
include secondary_entity_name = that buyer's exact name as listed.

DEDUP KEY: For each task, include a dedup_key: the 3-4 most significant words that
uniquely identify this specific action (used to prevent duplicates across calls).

For each valid task return a JSON object:
{
  task_title: string (max 100 chars, action verb first),
  task_type: string (from list above),
  due_date_hint: ISO date if timeframe stated, else null,
  quote: verbatim sentence from transcript,
  assigned_to: 'advisor' | 'seller' | 'buyer' | 'unknown',
  assignee_name: string (name of specific person if identifiable, else null),
  secondary_entity_name: buyer name or null,
  other_deal_hint: deal name if about a different deal, else null,
  relevance_score: integer 1-10,
  confidence: 'high' | 'medium',
  dedup_key: string (3-4 word unique identifier)
}

═══════════════════════════════════════════
PART 2: SIGNAL EXTRACTION
═══════════════════════════════════════════

Separately identify DEAL SIGNALS — statements indicating deal risk, momentum, or sentiment.

Signal types:
- CRITICAL: buyer pausing investments, seller withdrawing, deal-threatening events
- WARNING: buyer hesitation, timeline slippage, seller concerns, competitor mentioned
- POSITIVE: buyer enthusiasm, accelerated timeline, IC approval, strong interest
- NEUTRAL: informational context

For each signal return:
{
  signal_type: 'critical' | 'warning' | 'positive' | 'neutral',
  signal_category: 'ic_pause' | 'seller_hesitation' | 'buyer_interest' |
    'timeline_risk' | 'competitor_activity' | 'fund_status' | 'other',
  summary: string (1-2 sentences),
  quote: verbatim sentence,
  buyer_name: string or null (if signal relates to a specific buyer)
}

Return a single JSON object: { tasks: [...], signals: [...] }
No preamble, no explanation, no markdown.
```

---

## Part 5: Deal Lifecycle Integration (FIXED)

Lifecycle hooks fire on **`deals.stage_id` changes**, not `listings.status` changes. This is because deals progress through stages while the listing itself stays `'active'` throughout the process.

### Trigger: On deals.stage_id Change

```sql
CREATE OR REPLACE FUNCTION handle_deal_stage_change()
RETURNS trigger AS $$
DECLARE
  new_stage_name text;
  old_stage_name text;
BEGIN
  SELECT name INTO new_stage_name FROM deal_stages WHERE id = NEW.stage_id;
  SELECT name INTO old_stage_name FROM deal_stages WHERE id = OLD.stage_id;

  -- Deal closed as won
  IF new_stage_name = 'Closed Won' THEN
    UPDATE rm_tasks
    SET status = 'deal_closed', updated_at = now()
    WHERE deal_id = NEW.id AND status IN ('open','in_progress');
    -- Also dismiss pending AI suggestions
    UPDATE rm_tasks
    SET dismissed_at = now(), updated_at = now()
    WHERE deal_id = NEW.id AND source = 'ai' AND confirmed_at IS NULL AND dismissed_at IS NULL;
  END IF;

  -- Deal closed as lost
  IF new_stage_name = 'Closed Lost' THEN
    UPDATE rm_tasks
    SET status = 'cancelled', updated_at = now()
    WHERE deal_id = NEW.id AND status IN ('open','in_progress');
    UPDATE rm_tasks
    SET dismissed_at = now(), updated_at = now()
    WHERE deal_id = NEW.id AND source = 'ai' AND confirmed_at IS NULL AND dismissed_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deal_stage_change
  AFTER UPDATE OF stage_id ON deals
  FOR EACH ROW
  WHEN (OLD.stage_id IS DISTINCT FROM NEW.stage_id)
  EXECUTE FUNCTION handle_deal_stage_change();
```

### Listing Deactivation (listings.status → 'inactive')

When a listing is deactivated, ALL deals on that listing should be affected:

```sql
CREATE OR REPLACE FUNCTION handle_listing_deactivation()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'inactive' AND OLD.status = 'active' THEN
    -- Snooze all open tasks on all deals for this listing
    UPDATE rm_tasks
    SET status = 'snoozed', snoozed_until = (now() + interval '30 days')::date, updated_at = now()
    WHERE deal_id IN (SELECT id FROM deals WHERE listing_id = NEW.id)
      AND status IN ('open','in_progress');

    -- Also affect tasks linked directly to the listing
    UPDATE rm_tasks
    SET status = 'snoozed', snoozed_until = (now() + interval '30 days')::date, updated_at = now()
    WHERE entity_type = 'listing' AND entity_id = NEW.id
      AND status IN ('open','in_progress');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_listing_deactivation
  AFTER UPDATE OF status ON listings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION handle_listing_deactivation();
```

### Daily Briefing Filter

The daily briefing excludes tasks where:
- `deals.stage_id` maps to 'Closed Won' or 'Closed Lost'
- `listings.status = 'inactive'`

```sql
-- Briefing query filter
WHERE rm_tasks.status IN ('open','in_progress')
  AND (rm_tasks.deal_id IS NULL
       OR deals.stage_id NOT IN (SELECT id FROM deal_stages WHERE name IN ('Closed Won','Closed Lost')))
```

---

## Part 6: Task Templates — Phase 1

Same concept as v3.0 but mapped to actual `deal_stages.name` values.

'Start Deal Process' button on listing detail pages creates template tasks.

| deal_stages.name | Template Tasks Auto-Created | Default Due |
|-----------------|---------------------------|-------------|
| Sourced | Conduct intake call with owner; Collect 3 years P&Ls; Collect EBITDA bridge; Qualify deal | 7 / 14 / 14 / 21 days |
| Qualified | Build initial buyer universe (50+); Score all buyers; Get seller approval on list | 14 / 21 / 28 days |
| NDA Sent | Send NDA to top 15 buyers; Track NDA returns; Follow up unsigned NDAs at 7d | 3 / ongoing / 7 days |
| NDA Signed | Deliver CIM to NDA-signed buyers; Follow up on CIM receipt; Set IOI deadline | 1 / 5 / 30 days |
| Fee Agreement Signed | Same as NDA Signed + fee-specific tasks | varies |
| LOI Submitted | Send LOI to seller; Seller feedback on LOI; Open data room; Assign DD coordinator | 3 / 7 / 3 / 1 days |

Templates create tasks with `source='template'`, assigned to `deals.assigned_to` (the deal owner) by default. Each task linked to the deal record via `deal_id`.

---

## Part 7: Task Aging & Escalation

Same tiers as v3.0 — no changes needed.

| Tier | Days Overdue | Visual | Notification | Escalation |
|------|-------------|--------|--------------|------------|
| At Risk | Due in 48h | Amber badge | Amber toast | None |
| Recent | 1-3 days | Red badge | Red banner | None |
| Aging | 4-7 days | Red italic | Daily email | Notify deal team lead |
| Critical | 8-14 days | Red bold highlighted | Daily email + in-app urgent | Notify lead + admin |
| Abandoned | 15+ days (retained deals only) | Red 'ABANDONED' label | Immediate email | Admin dashboard |

Low-priority tasks on non-retained listings: escalation notifications suppressed.

---

## Part 8: Buyer Scoring Integration

Your `remarketing_scores` table already has `composite_score`, `tier`, `buyer_id`, `listing_id`. This integrates directly.

When inserting an `rm_tasks` record with a buyer entity:

```sql
-- Fetch buyer's score for the relevant listing
SELECT composite_score
FROM remarketing_scores
WHERE buyer_id = :buyer_id
  AND listing_id = (SELECT listing_id FROM deals WHERE id = :deal_id)
  AND is_disqualified = false
ORDER BY scored_at DESC
LIMIT 1;

-- Store as buyer_deal_score on the task
```

Display in Task Inbox:
- 9-10 = green badge
- 7-8 = blue badge
- 5-6 = amber badge
- <5 = grey badge

Sort order: (1) overdue first, (2) buyer_deal_score DESC within same due date.

---

## Part 9: Smartlead Integration

Same as v3.0 but with corrected table references.

### rm-smartlead-contact-event webhook handler

- On `email_sent`: Update `rm_buyer_deal_cadence.last_contacted_at`, `last_contact_source='smartlead'`. Partial contact (resets cadence clock by 50%).
- On `email_replied`: Full update + create suggested task: 'Review [buyer] reply to [campaign]' linked to buyer record with `source='system'`, `priority='high'`.
- On `email_bounced`: Flag `buyer_contacts.email` as bad. Do NOT update `last_contacted_at`.

**Email-to-buyer mapping:** Match recipient email against `buyer_contacts.email` → get `buyer_contacts.buyer_id` → find `remarketing_buyers` record.

---

## Part 10: AI Command Center Integration (NOT a Separate Chatbot)

You already have the AI Command Center (`src/components/ai-command-center/`, `src/hooks/useAICommandCenter.ts`) with SSE streaming, tool execution, UI actions, and page context awareness. **Do not build a separate chatbot.**

### Add Task Tools to AI Command Center

Add these as tool definitions in the edge function that powers the AI Command Center:

```typescript
// New tools for task management
const taskTools = [
  {
    name: 'get_my_tasks',
    description: 'Get current user tasks, optionally filtered by status or entity',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open','in_progress','overdue','all'] },
        entity_type: { type: 'string' },
        entity_id: { type: 'string' },
        limit: { type: 'number', default: 10 }
      }
    }
  },
  {
    name: 'get_daily_briefing',
    description: 'Generate daily briefing for current user',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'create_task',
    description: 'Create a new task — ALWAYS confirm with user before saving',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        entity_type: { type: 'string' },
        entity_id: { type: 'string' },
        due_date: { type: 'string' },
        priority: { type: 'string', enum: ['high','medium','low'] },
        assignee_name: { type: 'string' }
      },
      required: ['title', 'entity_type', 'entity_id']
    }
  },
  {
    name: 'get_buyer_spotlight',
    description: 'Get buyers needing follow-up based on cadence',
    input_schema: {
      type: 'object',
      properties: {
        listing_id: { type: 'string' },
        limit: { type: 'number', default: 5 }
      }
    }
  },
  {
    name: 'search_tasks',
    description: 'Search tasks by keyword, deal, or buyer',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        entity_type: { type: 'string' },
        entity_id: { type: 'string' }
      }
    }
  }
];
```

### Session Context

The AI Command Center already has `PageContext` with `page`, `entity_id`, `entity_type`, `tab`. This serves as session context. When a user is on a deal page, the AI knows which deal they're looking at. No separate session memory table needed.

### Task Creation via AI Command Center (2-Step Confirmation)

The AI Command Center already has a `ConfirmationRequest` pattern (`pendingConfirmation` state). Use this for task creation:

1. User says: "Remind me to follow up with O2 in two weeks"
2. AI uses `create_task` tool → returns confirmation request
3. UI shows: "Creating: Follow up with O2 Investment Partners — due [date]. Linked to Buyer: O2 Investment Partners. Confirm?"
4. User confirms → task saved

---

## Part 11: Privacy & Data Retention

Same as v3.0 — no changes needed.

```sql
-- Nightly pg_cron job: purge quotes older than 90 days
UPDATE rm_tasks
SET ai_evidence_quote = '[Quote purged — 90-day retention policy]'
WHERE ai_evidence_quote IS NOT NULL
  AND created_at < now() - interval '90 days';

UPDATE rm_deal_signals
SET verbatim_quote = '[Quote purged — 90-day retention policy]'
WHERE verbatim_quote IS NOT NULL
  AND created_at < now() - interval '90 days';

DELETE FROM rm_task_discards
WHERE discarded_at < now() - interval '90 days';
```

### RLS Policies

```sql
-- rm_tasks: users see tasks they own OR tasks on deals where they're in rm_deal_team
CREATE POLICY rm_tasks_select ON rm_tasks FOR SELECT USING (
  owner_id = auth.uid()
  OR created_by = auth.uid()
  OR (deal_team_visible = true AND deal_id IN (
    SELECT deal_id FROM rm_deal_team WHERE user_id = auth.uid()
  ))
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin','owner'))
);

-- rm_task_discards: admin-only
CREATE POLICY rm_task_discards_select ON rm_task_discards FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin','owner'))
);

-- rm_deal_signals: deal team members only
CREATE POLICY rm_deal_signals_select ON rm_deal_signals FOR SELECT USING (
  deal_id IN (SELECT deal_id FROM rm_deal_team WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin','owner'))
);
```

---

## Part 12: Phased Build Plan — v3.1

### Phase 1: Manual Tasks + Templates + Team Foundation

| Component | Details |
|-----------|---------|
| **Migration** | Rename `daily_standup_tasks` → `rm_tasks`. Migrate `deal_tasks` data. Add new columns. |
| **rm_tasks full schema** | All columns from Section 3. Indexes. RLS. Triggers. |
| **rm_deal_team** | Table + RLS + UI for managing team on deal pages |
| **rm_task_comments** | Table + UI thread on task detail |
| **rm_task_activity_log** | Table + auto-logging trigger |
| **Tasks tab** | On Deal, Listing, Buyer, Contact pages |
| **Task Inbox** | Central inbox with My Tasks / Due Today / This Week / Overdue / Completed tabs |
| **Team Dashboard** | Manager view: tasks by team member, workload distribution |
| **Notification bar** | Overdue count, due today, assignments. With notification preferences. |
| **Snooze** | Presets + nightly wake job |
| **Templates** | 'Start Deal Process' button. Stage templates. |
| **Bulk operations** | Multi-select → reassign, complete, snooze |
| **Deal lifecycle triggers** | On `deals.stage_id` change + `listings.status` change |
| **platform_settings** | Table for configurable thresholds |
| **profiles extensions** | timezone, notification_preferences columns |
| **Email reminders** | 24hr before due date |

**Acceptance:** Team creates tasks on Day 1. Templates work. Inbox shows correct data. Notifications fire. Deal stage changes affect tasks.

### Phase 2: Daily Briefing + AI Command Center Task Tools

| Component | Details |
|-----------|---------|
| **Daily briefing edge function** | rm-generate-daily-briefing. Pre-computed cache via nightly job. |
| **Email briefing** | Plain text, mobile-readable. Sent by 8am per user timezone. |
| **AI Command Center tools** | get_my_tasks, get_daily_briefing, create_task, get_buyer_spotlight, search_tasks |
| **On-demand queries** | "What's on my plate?", "What tasks on [deal]?", "Which buyers need follow-up?" |
| **Task creation via chat** | 2-step confirmation using existing ConfirmationRequest pattern |
| **Retained deals first** | In all briefings and spotlights |

**Acceptance:** Team uses briefing daily. AI chat creates tasks correctly. Email arrives before 8:05am.

### Phase 3: AI Extraction + Signals + Integrations

| Component | Details |
|-----------|---------|
| **rm_task_extractions + rm_task_discards + rm_deal_signals** | Tables + RLS |
| **rm_buyer_deal_cadence** | Table + integration with buyer spotlight |
| **Extend extract-standup-tasks** | Rename to rm-extract-tasks. Add v3.1 prompt, 4 guardrail layers, signal extraction. |
| **Fireflies webhook** | Map participants → deals + buyers. Trigger extraction. |
| **AI Suggested view** | In Task Inbox. 5-day expiry + day-3 alert. |
| **Signal dashboard** | On Deal pages. Critical signals show red banner. |
| **Smartlead webhook** | rm-smartlead-contact-event. Update cadence. |
| **Buyer scoring on tasks** | Fetch from remarketing_scores.composite_score |
| **Dedup** | Deterministic (entity_id + task_type + transcript_id) |

**Acceptance:** AI extracts 2-5 valid tasks per transcript. Discard rate visible. Signals appear. Smartlead events update cadence.

### Phase 4: Polish + Scale

| Component | Details |
|-----------|---------|
| **Task aging tiers** | Visual treatment + escalation notifications |
| **Task dependencies** | Warning UI when depends_on task is still open |
| **Admin threshold calibration UI** | Adjust relevance threshold from settings page |
| **Analytics dashboard** | System health + adoption + outcome metrics |
| **Recurring tasks** | Optional: template for recurring follow-up patterns |
| **Slack notifications** | Optional: webhook to Slack channel for critical signals |

---

## Part 13: Build Prompts for Each Phase

### PHASE 1 PROMPT

```
Build a task management system for the SourceCo remarketing tool. Read every line before writing any code.

CRITICAL CONTEXT — EXISTING SYSTEMS:
The app already has these task tables that must be MIGRATED, not duplicated:
- daily_standup_tasks: AI-extracted tasks with priority scoring, assignee matching, approval workflow
- deal_tasks: Simple manual tasks per deal
- standup_meetings: Transcript/meeting tracking

STEP 1 — MIGRATION:
1. ALTER TABLE daily_standup_tasks RENAME TO rm_tasks
2. Add all new columns (see schema below) as nullable
3. Backfill entity_type, entity_id, owner_id, source from existing columns
4. Map old statuses: 'pending'→'open', 'pending_approval'→'open', 'dismissed'→'cancelled'
5. INSERT deal_tasks data into rm_tasks with entity_type='deal'
6. ALTER TABLE standup_meetings RENAME TO rm_transcript_sources
7. Update all frontend imports: daily_standup_tasks→rm_tasks, deal_tasks→rm_tasks

STEP 2 — NEW TABLES:
Create rm_deal_team, rm_task_comments, rm_task_activity_log, platform_settings
exactly as defined in the spec Section 3.

STEP 3 — ENTITY TYPES (MUST MATCH ACTUAL SCHEMA):
entity_type values: 'listing' (→listings), 'deal' (→deals), 'buyer' (→remarketing_buyers),
'buyer_contact' (→buyer_contacts), 'contact' (→contacts)
DO NOT use 'deal' to reference listings. The deals table is buyer-deal pipeline entries.

STEP 4 — RLS:
Users see tasks they own OR tasks on deals where they're in rm_deal_team.
Admins (user_roles.role IN ('admin','owner')) see all.

STEP 5 — INDEXES:
Create all indexes from spec Section 3.

STEP 6 — TRIGGERS:
- updated_at auto-update trigger
- is_blocked update trigger (when depends_on task status changes)
- Deal lifecycle: on deals.stage_id change (Closed Won → deal_closed, Closed Lost → cancelled)
- Listing lifecycle: on listings.status change (active→inactive → snooze tasks)
- Activity log: auto-insert on task create/update/delete

STEP 7 — UI:
- Tasks tab on Deal, Listing, Buyer, Contact pages
  Query: WHERE (entity_type=:type AND entity_id=:id) OR (secondary_entity_type=:type AND secondary_entity_id=:id)
  Sort: due_date ASC. Show aging badges, priority, owner, buyer_deal_score.
- Task creation modal: title, entity (pre-populated), secondary entity, due_date, priority, owner, notes
- Task Inbox: /tasks route with badge count. Tabs: My Tasks, Due Today, This Week, Overdue, Completed, Team (for managers)
- Notification bar: overdue count (red), due today (amber), assignment toasts
- Snooze: presets (Tomorrow, 1 Week, 2 Weeks, 1 Month, Custom). Nightly wake job.
- Templates: 'Start Deal Process' button on listing pages. Creates tasks per stage.
- Bulk operations: multi-select → reassign, complete, snooze
- Task comments: thread UI on task detail
- Notification preferences: in user profile settings

STEP 8 — profiles table:
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/New_York';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"email_briefing":true,"in_app_briefing":true,"task_assigned":true,"task_overdue":true,"escalation_alerts":true,"ai_suggestions":true,"signal_alerts":true}';

STEP 9 — listings table:
ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_retained boolean DEFAULT false;

STEP 10 — platform_settings:
Insert default: key='ai_relevance_threshold', value='{"threshold":7}'
```

### PHASE 2 PROMPT

```
Phase 1 must be stable before starting this.

DAILY BRIEFING — rm-generate-daily-briefing edge function:
Schedule: nightly pre-compute at 2am. Store results in rm_briefing_cache table.
At 8am per user timezone, send email from cache.

For each active team member, compute:
1. Overdue: rm_tasks WHERE owner_id=user AND due_date < today AND status IN ('open','in_progress')
   AND deal_id IS NULL OR deals.stage_id NOT IN (SELECT id FROM deal_stages WHERE name IN ('Closed Won','Closed Lost'))
2. Due today: rm_tasks WHERE due_date=today AND owner_id=user, sorted by priority then buyer_deal_score
3. Due this week: count + top 3
4. AI pending: rm_tasks WHERE source='ai' AND confirmed_at IS NULL AND dismissed_at IS NULL AND expires_at > now()
5. Retained listings: listings WHERE is_retained=true
6. Buyer spotlight: rm_buyer_deal_cadence WHERE is_active=true AND overdue based on expected_contact_days

Email format: plain text, bullet lists, links. Subject: 'SourceCo Tasks — [N] due today, [N] overdue | [Date]'

AI COMMAND CENTER TASK TOOLS:
The app already has an AI Command Center (src/components/ai-command-center/, src/hooks/useAICommandCenter.ts)
with SSE streaming, tool execution, UI actions, page context, and confirmations.
DO NOT build a separate chatbot. Add task tools to the existing AI Command Center edge function.

New tools: get_my_tasks, get_daily_briefing, create_task (with confirmation), get_buyer_spotlight, search_tasks.

Task creation uses the existing ConfirmationRequest pattern — always confirm before saving.
Page context (PageContext) provides session context — no separate session memory needed.
```

### PHASE 3 PROMPT

```
Phases 1 and 2 must be stable before starting.

NEW TABLES: rm_task_extractions, rm_task_discards, rm_deal_signals, rm_buyer_deal_cadence
as defined in spec Section 3.

EXTEND EXISTING EXTRACTION:
The app already has supabase/functions/extract-standup-tasks/index.ts with Fireflies integration,
AI extraction via Claude, priority scoring, and assignee matching.
RENAME this function to rm-extract-tasks. EXTEND it with:

1. v3.1 AI prompt (spec Section 4.4) — adds deal stage context, signal extraction, speaker ID,
   secondary entity extraction, task type classification, dedup keys
2. Four guardrail layers: category → scoring → stage → record check
3. Signal extraction: parse signals from AI response, INSERT into rm_deal_signals
4. Dedup: check (entity_id, task_type, transcript_id) before insert
5. Buyer scoring: fetch remarketing_scores.composite_score for buyer tasks
6. Log all discards to rm_task_discards with reason

FIREFLIES WEBHOOK — rm-fireflies-webhook:
Parse participant emails → match against listings.main_contact_email → link to listing.
Match against buyer_contacts.email → link to remarketing_buyers → find deals.
INSERT rm_task_extractions with transcript_status='queued'.
Invoke rm-extract-tasks asynchronously.

SMARTLEAD WEBHOOK — rm-smartlead-contact-event:
email_sent → update rm_buyer_deal_cadence (partial contact, 50% cadence reset)
email_replied → full update + create task source='system' priority='high'
email_bounced → flag buyer_contacts bad_email. No cadence update.

AI SUGGESTED VIEW in Task Inbox:
rm_tasks WHERE source='ai' AND confirmed_at IS NULL AND dismissed_at IS NULL AND expires_at > now()
Show evidence quote, buyer score, aging. Confirm requires due_date. 5-day expiry + day-3 alert.

DEAL SIGNALS DASHBOARD on Deal pages:
Signals tab. Sorted: critical first, then created_at desc. Unacknowledged critical = red banner.
```

### PHASE 4 PROMPT

```
Phases 1-3 must be stable before starting.

TASK AGING: Visual tiers (At Risk, Recent, Aging, Critical, Abandoned) with escalation
notifications per spec Section 7.

TASK DEPENDENCIES: Warning UI when attempting to work on a task whose depends_on is still open.
Soft blocker — user can override with confirmation.

ADMIN CALIBRATION UI: Settings page to adjust ai_relevance_threshold from platform_settings.
Show discard stats: false positive rate, false negative rate, recommended threshold.

ANALYTICS DASHBOARD: System health + adoption + outcome metrics per spec Section 14.

OPTIONAL: Recurring tasks, Slack webhook for critical signals.
```

---

## Part 14: Success Metrics — v3.1

Same as v3.0 with one addition:

| Tier | Metric | Target |
|------|--------|--------|
| System | Zero tasks without valid entity reference | 100% |
| System | Zero AI tasks about non-M&A topics | 100% |
| System | AI extraction success rate | 50-80% save rate |
| System | AI task expiry rate | <20% |
| **System** | **Migration data integrity — zero lost tasks from daily_standup_tasks or deal_tasks** | **100%** |
| Adoption | Team opens Task Inbox daily | >80%, >5 days/week |
| Adoption | AI Command Center briefing used daily | >60% |
| Adoption | Manual task creation per listing | >5 per active listing |
| Adoption | Overdue task rate | <15% |
| Outcomes | Avg days first contact → IOI | Establish baseline |
| Outcomes | Buyer re-engagement rate after spotlight | >30% respond in 7 days |
| Outcomes | Signal acknowledgement rate | >90% critical in 24h |
| Outcomes | Task-to-call conversion | >40% follow-ups → Fireflies call |

---

## Appendix A: Core Principles (Unchanged from v3.0)

| Principle | Rule |
|-----------|------|
| Record Association | Every task links to an existing Listing, Deal, Buyer, Buyer Contact, or Contact. Enforced at DB level. |
| M&A Scope Only | AI extracts only tasks that advance buyer-finding or deal-closing for a specific deal. |
| Deal Stage Awareness | AI extraction is stage-contextual via `deals.stage_id` → `deal_stages.name`. |
| Completion Evidence | Completed tasks have `completion_notes`. System nudges documentation. |
| No Silent Failures | Failed extractions logged + owner notified. |
| Retained Deals First | `listings.is_retained = true` surfaced first everywhere. |
| Data Minimisation | Verbatim quotes purged after 90 days. |

---

**END OF SPECIFICATION — VERSION 3.1**
**SourceCo — Confidential & Internal Use Only**
