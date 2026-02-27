# AI TASK MANAGEMENT SYSTEM — v3.1

## SourceCo Remarketing Tool

**Version 3.1 — Revised Specification**
**Incorporates all v3.0 audit fixes + 33 codebase-grounded corrections**
**February 2026 — DRAFT FOR DEVELOPMENT REVIEW**

---

## CRITICAL CHANGE: Unified Task System

v3.0 proposed a standalone `rm_tasks` system. But SourceCo **already has** a working task system:

- **`daily_standup_tasks`** table with AI extraction, priority scoring, approval workflows
- **`extract-standup-tasks`** edge function calling Claude for transcript analysis
- **`ai-command-center`** edge function with 15+ tool modules including task management
- **Task UI components** in `src/components/tasks/` (TaskCard, TaskList, DailyStandupView, etc.)

**v3.1 decision: EXTEND the existing system, don't replace it.**

We migrate `daily_standup_tasks` → `rm_tasks` with a migration script, preserve the existing UI components, and add the new v3.1 columns. The `extract-standup-tasks` edge function is upgraded in place. The `ai-command-center` gets new task tool modules instead of building a separate chatbot.

---

## Part 1: What Changed From v3.0

| # | Issue | Severity | Fix in v3.1 |
|---|-------|----------|-------------|
| 1 | Duplicate task system — rm_tasks ignores existing daily_standup_tasks | Critical | Migrate existing system; single unified table |
| 2 | Entity references wrong — 'deal' ambiguous (listings vs deals table) | Critical | Use `listings` for sellside, `deals` for buyer-deal pipeline, explicit FK targets |
| 3 | rm_deal_team FK references listings but team visibility needs deals join | Critical | FK to listings (sellside engagement); RLS joins through deals.listing_id |
| 4 | Deal lifecycle hooks reference statuses that don't exist | Critical | Use actual listing.status + deal_stages progression |
| 5 | is_blocked generated column can't query other rows | High | Replace with VIEW or application-level computed field |
| 6 | Semantic dedup via "similarity > 0.8" not feasible | High | Dedup by (entity_id, normalized_title_hash, transcript_id) |
| 7 | 7-day AI expiry creates graveyard at 10-20 users | High | Tiered expiry: 3 days for low relevance, 7 for medium, 14 for high |
| 8 | No notification preferences — alert fatigue at scale | High | Notification preferences table in Phase 1 |
| 9 | Missing indexes on RLS subqueries | High | Explicit index definitions in schema |
| 10 | Stage filter is per-deal not per-buyer-deal | High | Stage filter uses deal_stages.stage from the deals table |
| 11 | Chatbot ignores existing ai-command-center | High | Add task tools to ai-command-center, not a new chatbot |
| 12 | No task activity audit log | High | rm_task_activity table for change tracking |
| 13 | No team dashboards until Phase 4 | Medium | Move to Phase 2 — managers need visibility immediately |
| 14 | No task comments — notes is single-value | Medium | rm_task_comments table |
| 15 | No bulk operations for task reassignment | Medium | Bulk reassign/close API in Phase 2 |
| 16 | Daily briefing has no pre-computed cache | Medium | Materialized view refreshed at 7:30am |
| 17 | contacts table is seller contacts; buyer contacts are in buyer_contacts | Medium | Schema references corrected |
| 18 | No migration plan from daily_standup_tasks | Medium | Migration script defined |

---

## Part 2: Data Model — Complete Schema

### Naming Convention

Throughout this spec:
- **"listing"** = the sellside engagement (the company being sold). Table: `listings`
- **"deal"** = a buyer-deal pipeline entry (one buyer's pursuit of one listing). Table: `deals`
- **"buyer"** = a remarketing buyer firm. Table: `remarketing_buyers`
- **"contact"** = a seller-side contact. Table: `contacts`
- **"buyer_contact"** = a buyer-side contact person. Table: `buyer_contacts`

### rm_tasks — Core Tasks Table

This table **replaces** `daily_standup_tasks`. A migration script moves existing data.

```sql
CREATE TABLE rm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core fields
  title text NOT NULL CHECK (char_length(title) <= 200),
  description text,

  -- Entity linking — primary
  -- entity_type determines which table entity_id references:
  --   'listing' → listings(id)      -- sellside engagement
  --   'deal'    → deals(id)         -- buyer-deal pipeline entry
  --   'buyer'   → remarketing_buyers(id)
  --   'contact' → contacts(id)
  --   'buyer_contact' → buyer_contacts(id)
  entity_type text NOT NULL CHECK (entity_type IN ('listing','deal','buyer','contact','buyer_contact')),
  entity_id uuid NOT NULL,

  -- Entity linking — secondary (e.g., buyer on a listing task)
  secondary_entity_type text CHECK (secondary_entity_type IN ('listing','deal','buyer','contact','buyer_contact')),
  secondary_entity_id uuid,

  -- Scheduling
  due_date date, -- nullable for source='ai' only; required before confirming
  expires_at timestamptz, -- AI tasks: created_at + expiry window (see tiered expiry)
  snoozed_until date,

  -- Classification
  priority text DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  task_category text, -- e.g. 'buyer_outreach', 'nda_execution', 'cim_delivery', etc.
  source text DEFAULT 'manual' CHECK (source IN ('manual','ai','chatbot','system','template')),

  -- Ownership
  owner_id uuid NOT NULL REFERENCES profiles(id),
  deal_team_visible boolean DEFAULT true,

  -- Status
  status text DEFAULT 'open' CHECK (status IN (
    'open','in_progress','completed','snoozed','cancelled','listing_closed','expired'
  )),

  -- Completion
  completion_notes text,
  completed_by uuid REFERENCES profiles(id),
  completed_at timestamptz,
  completion_transcript_id text, -- Fireflies transcript that resolved this

  -- AI-specific fields (null for non-AI tasks)
  ai_evidence_quote text,        -- purged after 90 days
  ai_relevance_score integer CHECK (ai_relevance_score BETWEEN 1 AND 10),
  ai_confidence text CHECK (ai_confidence IN ('high','medium')),
  ai_speaker_assigned_to text CHECK (ai_speaker_assigned_to IN ('advisor','seller','buyer','unknown')),
  transcript_id text,            -- Fireflies transcript ID
  confirmed_at timestamptz,      -- when user confirmed AI suggestion
  dismissed_at timestamptz,      -- when user dismissed AI suggestion

  -- Dependencies (soft blocker — warning, not hard block)
  depends_on uuid REFERENCES rm_tasks(id),

  -- Buyer scoring (cached at creation for sort performance)
  buyer_deal_score integer,

  -- Migration reference
  legacy_standup_task_id uuid,   -- references old daily_standup_tasks.id during migration

  -- Audit
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- INDEXES for RLS and common queries
CREATE INDEX idx_rm_tasks_owner_status ON rm_tasks(owner_id, status);
CREATE INDEX idx_rm_tasks_entity ON rm_tasks(entity_type, entity_id);
CREATE INDEX idx_rm_tasks_secondary_entity ON rm_tasks(secondary_entity_type, secondary_entity_id)
  WHERE secondary_entity_type IS NOT NULL;
CREATE INDEX idx_rm_tasks_due_date ON rm_tasks(due_date) WHERE status IN ('open','in_progress');
CREATE INDEX idx_rm_tasks_source_ai ON rm_tasks(source, confirmed_at, dismissed_at, expires_at)
  WHERE source = 'ai';
CREATE INDEX idx_rm_tasks_transcript ON rm_tasks(transcript_id) WHERE transcript_id IS NOT NULL;
CREATE INDEX idx_rm_tasks_depends_on ON rm_tasks(depends_on) WHERE depends_on IS NOT NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_rm_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rm_tasks_updated_at
  BEFORE UPDATE ON rm_tasks
  FOR EACH ROW EXECUTE FUNCTION update_rm_tasks_updated_at();
```

**Why `entity_type` uses 'listing' not 'deal':**
In the SourceCo codebase, `listings` is the sellside engagement (the company being sold) and `deals` is a buyer-deal entry in the pipeline. Using 'deal' for both would be ambiguous. This spec uses the actual table names as entity types.

**Why `is_blocked` is not a generated column:**
PostgreSQL generated columns cannot reference other rows. The blocking status is computed at query time:

```sql
-- View for checking blocked status
CREATE VIEW rm_tasks_with_blocking AS
SELECT
  t.*,
  CASE
    WHEN t.depends_on IS NOT NULL
      AND dt.status NOT IN ('completed','cancelled','listing_closed','expired')
    THEN true
    ELSE false
  END AS is_blocked
FROM rm_tasks t
LEFT JOIN rm_tasks dt ON t.depends_on = dt.id;
```

### rm_deal_team — Deal Team Membership

```sql
CREATE TABLE rm_deal_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  role text NOT NULL CHECK (role IN ('lead','analyst','support')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(listing_id, user_id)
);

CREATE INDEX idx_rm_deal_team_user ON rm_deal_team(user_id);
CREATE INDEX idx_rm_deal_team_listing ON rm_deal_team(listing_id);
```

**Why FK to listings, not deals:**
Team membership is per sellside engagement (listing), not per buyer-deal. A listing has one team; that team manages all buyer-deals for that listing. RLS joins: `rm_tasks.entity_id → deals.listing_id → rm_deal_team.listing_id` for deal-type tasks, and `rm_tasks.entity_id → rm_deal_team.listing_id` for listing-type tasks.

### rm_deal_signals — AI-Detected Deal Intelligence

```sql
CREATE TABLE rm_deal_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id),
  deal_id uuid REFERENCES deals(id),          -- specific buyer-deal, if applicable
  buyer_id uuid REFERENCES remarketing_buyers(id),
  transcript_id text NOT NULL,
  signal_type text NOT NULL CHECK (signal_type IN ('positive','warning','critical','neutral')),
  signal_category text NOT NULL,
  -- Categories: 'ic_pause','seller_hesitation','buyer_interest','timeline_risk',
  -- 'competitor_activity','fund_status','pricing_concern','exclusivity_request','other'
  summary text NOT NULL,
  verbatim_quote text,                         -- purged after 90 days
  acknowledged_by uuid REFERENCES profiles(id),
  acknowledged_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_rm_deal_signals_listing ON rm_deal_signals(listing_id);
CREATE INDEX idx_rm_deal_signals_type ON rm_deal_signals(signal_type);
```

### rm_buyer_deal_cadence — Stage-Aware Contact Schedules

```sql
CREATE TABLE rm_buyer_deal_cadence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES remarketing_buyers(id),
  deal_id uuid NOT NULL REFERENCES deals(id),     -- the buyer-deal pipeline entry
  listing_id uuid NOT NULL REFERENCES listings(id), -- denormalized for query performance
  current_stage text NOT NULL,                     -- from deal_stages
  expected_contact_days integer NOT NULL,
  last_contacted_at timestamptz,
  last_contact_source text CHECK (last_contact_source IN (
    'task','fireflies','smartlead','smartlead_reply','direct_email','meeting'
  )),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(buyer_id, deal_id)
);

CREATE INDEX idx_rm_buyer_cadence_active ON rm_buyer_deal_cadence(is_active, last_contacted_at)
  WHERE is_active = true;
```

**Stage-aware cadence defaults** (replaces flat 14-day rule):

| Deal Stage (from deal_stages) | Expected Contact Days |
|---|----|
| New / Qualifying | 14 |
| NDA Sent / NDA Signed | 10 |
| CIM Sent | 7 |
| IOI / Management Presentation | 5 |
| LOI / Due Diligence | 3 |
| Closed / Dead | cadence deactivated (is_active=false) |

### rm_task_extractions — Extraction Run Log

```sql
CREATE TABLE rm_task_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id text NOT NULL,
  transcript_status text DEFAULT 'queued' CHECK (transcript_status IN (
    'queued','ready','processing','completed','failed'
  )),
  -- Primary entity this transcript was linked to
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  -- Context captured at extraction time
  deal_stage_at_extraction text,
  listing_id uuid REFERENCES listings(id),
  -- Results
  status text DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  tasks_saved integer DEFAULT 0,
  tasks_discarded integer DEFAULT 0,
  signals_extracted integer DEFAULT 0,
  failure_reason text,
  -- Dedup reference
  content_hash text, -- SHA-256 of transcript content to catch reprocessing
  run_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_rm_extractions_transcript ON rm_task_extractions(transcript_id);
```

### rm_task_discards — Guardrail Audit Log

```sql
CREATE TABLE rm_task_discards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id text,
  entity_type text,
  entity_id uuid,
  candidate_title text NOT NULL,
  discard_reason text NOT NULL CHECK (discard_reason IN (
    'failed_category','failed_relevance','failed_confidence',
    'failed_record_lookup','failed_stage','duplicate','auto_expired'
  )),
  ai_relevance_score integer,
  ai_confidence text,
  quote text, -- purged after 90 days; admin-only RLS
  discarded_at timestamptz DEFAULT now()
);
```

### rm_task_comments — Threaded Discussion (NEW in v3.1)

At 10-20 users, single-value `notes` won't cut it. People need to discuss tasks.

```sql
CREATE TABLE rm_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES rm_tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id),
  body text NOT NULL CHECK (char_length(body) <= 2000),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_rm_task_comments_task ON rm_task_comments(task_id);
```

### rm_task_activity — Audit Log (NEW in v3.1)

At 10-20 users you need to know who changed what. Every task state change is logged.

```sql
CREATE TABLE rm_task_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES rm_tasks(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES profiles(id),
  action text NOT NULL CHECK (action IN (
    'created','updated','status_changed','reassigned','commented',
    'confirmed','dismissed','snoozed','completed','cancelled',
    'dependency_added','dependency_removed','bulk_reassigned'
  )),
  old_value jsonb, -- e.g. {"status": "open", "owner_id": "..."}
  new_value jsonb, -- e.g. {"status": "completed", "owner_id": "..."}
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_rm_task_activity_task ON rm_task_activity(task_id);
CREATE INDEX idx_rm_task_activity_actor ON rm_task_activity(actor_id);
```

### rm_notification_preferences — Per-User Alert Controls (NEW in v3.1)

Without this, deal leads get 20+ alerts/day and turn off notifications entirely.

```sql
CREATE TABLE rm_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) UNIQUE,
  -- Briefing
  email_briefing_enabled boolean DEFAULT true,
  in_app_briefing_enabled boolean DEFAULT true,
  briefing_timezone text DEFAULT 'America/New_York',
  -- Task notifications
  task_assigned_notify boolean DEFAULT true,
  task_overdue_notify boolean DEFAULT true,
  task_comment_notify boolean DEFAULT true,
  -- Escalation
  escalation_notify boolean DEFAULT true, -- for deal leads: receive escalations
  -- AI suggestions
  ai_suggestion_notify boolean DEFAULT true,
  ai_suggestion_digest boolean DEFAULT false, -- true = batch into daily briefing only
  -- Signals
  critical_signal_notify boolean DEFAULT true,
  warning_signal_notify boolean DEFAULT false, -- off by default to reduce noise
  -- Channels
  slack_enabled boolean DEFAULT false,
  slack_user_id text,
  updated_at timestamptz DEFAULT now()
);
```

### platform_settings — System Configuration

```sql
-- Add to existing platform settings or create if not exists
CREATE TABLE IF NOT EXISTS rm_platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid REFERENCES profiles(id),
  updated_at timestamptz DEFAULT now()
);

-- Default settings
INSERT INTO rm_platform_settings (key, value) VALUES
  ('ai_relevance_threshold', '7'),
  ('ai_task_expiry_days_high', '14'),
  ('ai_task_expiry_days_medium', '7'),
  ('ai_task_expiry_days_low', '3'),
  ('data_retention_days', '90'),
  ('briefing_send_hour', '8'),
  ('max_ai_tasks_per_transcript', '10')
ON CONFLICT (key) DO NOTHING;
```

---

## Part 3: RLS Policies

```sql
-- rm_tasks: users see tasks they own OR tasks on listings/deals where they're on the team
ALTER TABLE rm_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY rm_tasks_select ON rm_tasks FOR SELECT USING (
  -- Owner can always see their tasks
  owner_id = auth.uid()
  OR
  -- Deal team members can see deal_team_visible tasks
  (deal_team_visible = true AND EXISTS (
    SELECT 1 FROM rm_deal_team dt
    WHERE dt.user_id = auth.uid()
    AND dt.listing_id = (
      CASE
        WHEN entity_type = 'listing' THEN entity_id
        WHEN entity_type = 'deal' THEN (SELECT listing_id FROM deals WHERE id = entity_id)
        WHEN entity_type = 'buyer' THEN (
          SELECT d.listing_id FROM deals d
          WHERE d.buyer_id = entity_id LIMIT 1
        )
        ELSE NULL
      END
    )
  ))
  OR
  -- Admins see everything (check profiles.role or equivalent)
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY rm_tasks_insert ON rm_tasks FOR INSERT WITH CHECK (
  created_by = auth.uid()
);

CREATE POLICY rm_tasks_update ON rm_tasks FOR UPDATE USING (
  owner_id = auth.uid()
  OR created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- rm_task_discards: admin-only read
ALTER TABLE rm_task_discards ENABLE ROW LEVEL SECURITY;

CREATE POLICY rm_task_discards_admin ON rm_task_discards FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- rm_deal_signals: deal team members only
ALTER TABLE rm_deal_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY rm_deal_signals_select ON rm_deal_signals FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM rm_deal_team dt
    WHERE dt.user_id = auth.uid()
    AND dt.listing_id = rm_deal_signals.listing_id
  )
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
```

**Note on RLS performance:** The subquery in the SELECT policy for rm_tasks can be expensive. The indexes on `rm_deal_team(user_id)` and `rm_deal_team(listing_id)` are critical. For the buyer→listing join, consider a denormalized `listing_id` column on rm_tasks (populated at insert time) to avoid the subquery chain.

**Recommended optimization — add listing_id to rm_tasks:**

```sql
-- Add denormalized listing_id for fast RLS
ALTER TABLE rm_tasks ADD COLUMN listing_id uuid REFERENCES listings(id);
CREATE INDEX idx_rm_tasks_listing ON rm_tasks(listing_id) WHERE listing_id IS NOT NULL;

-- Populate on insert via trigger or application code:
-- entity_type='listing' → listing_id = entity_id
-- entity_type='deal' → listing_id = deals.listing_id
-- entity_type='buyer' → listing_id from first active deal for that buyer
```

This makes the RLS policy a simple join:

```sql
CREATE POLICY rm_tasks_select_optimized ON rm_tasks FOR SELECT USING (
  owner_id = auth.uid()
  OR (deal_team_visible = true AND listing_id IN (
    SELECT listing_id FROM rm_deal_team WHERE user_id = auth.uid()
  ))
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
```

---

## Part 4: AI Guardrails — Four Layers (v3.1)

Same four layers as v3.0, with fixes:

### Layer 1: Category Filter
Unchanged from v3.0. Deal-context override still applies.

### Layer 2: Scoring Filter
Threshold is read from `rm_platform_settings` at extraction time, not hardcoded.
Default: 7/10. Calibration process unchanged from v3.0.

### Layer 3: Stage Filter — FIXED

**v3.0 bug:** The stage filter used "deal stage" generically. But in SourceCo, deal progression is tracked per buyer-deal in the `deals` table via `deal_stages`. A listing doesn't have a single "stage" — each buyer-deal has its own stage.

**v3.1 fix:** When extracting tasks from a transcript:
- Identify which buyer-deals are discussed (from participant matching)
- For each buyer-deal mentioned, use that deal's current stage from `deal_stages`
- Tasks are filtered against the stage of the **specific buyer-deal they relate to**
- If a task relates to the listing generally (seller tasks), use the most advanced stage among active deals

**Stage-to-valid-categories mapping** (same as v3.0 but using actual deal_stages values from the codebase):

| deal_stages Value | Valid Task Categories |
|---|---|
| new, qualifying | Seller info collection, seller relationship, internal qualification |
| nda_sent, nda_signed | NDA execution, buyer outreach, seller relationship, buyer qualification |
| cim_sent | CIM delivery, buyer outreach, seller relationship, buyer qualification, meeting setup |
| ioi, management_presentation | IOI process, management presentation, buyer IC follow-up, seller relationship |
| loi, due_diligence | LOI process, due diligence coordination, seller relationship |
| closed, dead | No new tasks extracted — deal is terminal |

**Note:** If your `deal_stages` values differ from the above, update this mapping to match. The key principle is: use the actual enum/text values from your deals table, not invented stage names.

### Layer 4: Record Check
Unchanged — confirm entity_id exists in the correct table.

### Deduplication — FIXED

**v3.0 bug:** "title similarity > 0.8" implies semantic similarity search, which requires pg_vector or similar — expensive and unreliable for short task titles.

**v3.1 fix:** Dedup by deterministic compound key:

```sql
-- Before inserting an AI task, check:
SELECT id FROM rm_tasks
WHERE transcript_id = $transcript_id
  AND entity_id = $entity_id
  AND entity_type = $entity_type
  AND md5(lower(trim(title))) = md5(lower(trim($candidate_title)));
```

For cross-transcript dedup (same commitment mentioned in multiple calls):

```sql
SELECT id FROM rm_tasks
WHERE entity_id = $entity_id
  AND entity_type = $entity_type
  AND task_category = $task_category
  AND status IN ('open','in_progress')
  AND created_at > now() - interval '14 days'
  AND md5(lower(trim(title))) = md5(lower(trim($candidate_title)));
```

If a match is found, skip the insert and log to `rm_task_discards` with reason `'duplicate'`.

---

## Part 5: AI System Prompt — v3.1

Key changes from v3.0:
- References actual SourceCo entity types (listing, deal, buyer)
- Speaker map instructions reference actual Fireflies metadata
- Task category output matches the stage filter categories
- Signal extraction includes deal_id context

```
SYSTEM PROMPT v3.1 — DO NOT MODIFY WITHOUT WRITTEN SIGN-OFF

You are an extraction engine for SourceCo, an M&A advisory firm. You process call
transcripts to extract two types of output: (1) follow-up TASKS, and (2) deal SIGNALS.

CONTEXT YOU WILL RECEIVE:
  listing_name: The name of the business being sold (the "listing" or sellside engagement)
  listing_id: The internal ID of this listing
  active_deals: Array of {deal_id, buyer_name, current_stage} — buyer-deals in the pipeline
  buyer_scores: Array of {buyer_name, score} — top 10 scored buyers for this listing
  stage_valid_categories: Object mapping each deal stage to its allowed task categories
  speaker_map: If available, maps speaker labels to roles
    (e.g. 'Speaker 1 = SourceCo advisor', 'Speaker 2 = Business owner')

═══════════════════════════════════════════
PART 1: TASK EXTRACTION
═══════════════════════════════════════════

EXTRACT TASKS ONLY if they meet ALL criteria:
  1. The task directly advances the buyer-finding or deal-closing process
  2. The task fits an allowed category for the relevant buyer-deal's current stage
  3. You have medium or high confidence the task was actually committed to

Task categories (use these exact strings in task_category):
  buyer_outreach, buyer_qualification, buyer_reengagement,
  seller_info_collection, seller_relationship,
  nda_execution, cim_delivery, meeting_setup,
  ioi_process, management_presentation, loi_process,
  due_diligence, internal_qualification, buyer_ic_followup,
  fee_agreement, scheduling, other_deal_process

NEVER EXTRACT tasks about: billing/invoices, marketing/content, HR/hiring,
platform development, personal tasks, or anything not advancing the M&A process.

DEAL-CONTEXT OVERRIDE: If a task touches a normally-blocked category but is clearly
in service of the active deal process (e.g., "get the QuickBooks login to pull financials
for the buyer"), it is ALLOWED. When in doubt, discard.

SPEAKER IDENTIFICATION: Use the speaker_map to determine WHO made each commitment.
  If the advisor says "I'll send that over": assigned_to = 'advisor'
  If the seller/owner says "I'll get you those numbers": assigned_to = 'seller'
  If a buyer is mentioned as making a commitment: assigned_to = 'buyer'
  If speaker is unknown or ambiguous: assigned_to = 'unknown'

ENTITY LINKING: For each task, determine which entity it primarily relates to:
  - If the task is about the listing/seller generally: entity_type = 'listing'
  - If the task is about a specific buyer-deal: entity_type = 'deal',
    and set deal_id from active_deals where buyer_name matches
  - If the task is about a buyer not yet in the pipeline: entity_type = 'buyer'

For each valid task return a JSON object:
  task_title: string, max 100 chars, starts with action verb
  task_category: one of the category strings above
  entity_type: 'listing' | 'deal' | 'buyer'
  deal_id: from active_deals if entity_type='deal', else null
  buyer_name: buyer firm name if task involves a specific buyer, else null
  due_date_hint: ISO date if timeframe stated in transcript, else null
  quote: verbatim sentence from transcript (1-2 sentences max)
  assigned_to: 'advisor' | 'seller' | 'buyer' | 'unknown'
  relevance_score: integer 1-10
  confidence: 'high' | 'medium'
  other_listing_hint: listing name if task is about a different listing, else null

═══════════════════════════════════════════
PART 2: SIGNAL EXTRACTION
═══════════════════════════════════════════

Separately identify DEAL SIGNALS — statements indicating deal risk,
momentum, or buyer sentiment, even if no action was stated.

Signal types:
  CRITICAL: buyer pausing investments, seller withdrawing, deal-threatening
  WARNING: buyer hesitation, timeline slippage, seller concerns, competitor
  POSITIVE: buyer enthusiasm, accelerated timeline, IC approval, strong interest
  NEUTRAL: informational context, no clear positive or negative valence

For each signal return a JSON object:
  signal_type: 'critical' | 'warning' | 'positive' | 'neutral'
  signal_category: 'ic_pause' | 'seller_hesitation' | 'buyer_interest' |
    'timeline_risk' | 'competitor_activity' | 'fund_status' |
    'pricing_concern' | 'exclusivity_request' | 'other'
  deal_id: from active_deals if signal relates to a specific buyer-deal, else null
  buyer_name: if signal relates to a specific buyer, else null
  summary: 1-2 sentence plain English description
  quote: verbatim sentence that triggered this signal

Return a single JSON object: { tasks: [...], signals: [...] }
No preamble, no explanation, no markdown.
```

---

## Part 6: Existing System Migration

### Migration from daily_standup_tasks → rm_tasks

```sql
-- Step 1: Create rm_tasks (schema above)

-- Step 2: Migrate existing data
INSERT INTO rm_tasks (
  title, entity_type, entity_id, due_date, priority, owner_id,
  status, source, notes, completion_notes, completed_at,
  ai_evidence_quote, ai_relevance_score, ai_confidence,
  transcript_id, confirmed_at, dismissed_at,
  created_by, created_at, legacy_standup_task_id
)
SELECT
  dst.title,
  -- Map existing entity references to new entity_type
  CASE
    WHEN dst.listing_id IS NOT NULL THEN 'listing'
    WHEN dst.deal_id IS NOT NULL THEN 'deal'
    WHEN dst.buyer_id IS NOT NULL THEN 'buyer'
    ELSE 'listing' -- fallback
  END,
  COALESCE(dst.listing_id, dst.deal_id, dst.buyer_id),
  dst.due_date,
  COALESCE(dst.priority, 'medium'),
  COALESCE(dst.assigned_to, dst.created_by),
  CASE
    WHEN dst.status = 'completed' THEN 'completed'
    WHEN dst.status = 'dismissed' THEN 'cancelled'
    WHEN dst.status = 'approved' THEN 'open'
    WHEN dst.status = 'pending' THEN 'open'
    ELSE 'open'
  END,
  CASE
    WHEN dst.source = 'ai' THEN 'ai'
    WHEN dst.source = 'manual' THEN 'manual'
    ELSE 'manual'
  END,
  dst.notes,
  dst.completion_notes,
  dst.completed_at,
  dst.ai_quote,
  dst.ai_relevance_score,
  dst.ai_confidence,
  dst.transcript_id,
  CASE WHEN dst.status = 'approved' THEN dst.updated_at ELSE NULL END,
  CASE WHEN dst.status = 'dismissed' THEN dst.updated_at ELSE NULL END,
  dst.created_by,
  dst.created_at,
  dst.id
FROM daily_standup_tasks dst;

-- Step 3: Update UI components to read from rm_tasks instead of daily_standup_tasks
-- Step 4: After confirming migration, rename daily_standup_tasks to daily_standup_tasks_archived
-- Step 5: DO NOT DROP the old table for 30 days
```

### Edge Function Migration: extract-standup-tasks → rm-extract-tasks

The existing `extract-standup-tasks` edge function is upgraded:
- Same Fireflies integration, same basic flow
- New v3.1 system prompt replaces the old prompt
- Four guardrail layers added post-extraction
- Signal extraction added
- Results go to `rm_tasks` + `rm_deal_signals` instead of `daily_standup_tasks`

### AI Command Center: Add Task Tools

Instead of building a new chatbot, add these tool modules to the existing `ai-command-center` edge function:

```typescript
// New tools to register in ai-command-center
const taskTools = [
  {
    name: 'get_my_tasks',
    description: 'Get current user tasks, optionally filtered by status, entity, or date range',
    parameters: { status: 'string?', entity_type: 'string?', entity_id: 'string?', date_range: 'string?' }
  },
  {
    name: 'get_daily_briefing',
    description: 'Generate the daily briefing for the current user',
    parameters: {}
  },
  {
    name: 'create_task',
    description: 'Create a new task linked to a record. Always confirm with user before saving.',
    parameters: { title: 'string', entity_type: 'string', entity_id: 'string', due_date: 'string?', priority: 'string?' }
  },
  {
    name: 'get_buyer_spotlight',
    description: 'Get buyers needing follow-up based on cadence',
    parameters: { listing_id: 'string?' }
  },
  {
    name: 'get_deal_signals',
    description: 'Get recent deal signals for a listing',
    parameters: { listing_id: 'string' }
  },
  {
    name: 'update_task_status',
    description: 'Update a task status. Requires task_id and new status.',
    parameters: { task_id: 'string', status: 'string', completion_notes: 'string?' }
  }
];
```

Session memory is added to the ai-command-center's context management — not a separate system.

---

## Part 7: Deal Lifecycle Integration — FIXED

### Actual Status Values

The SourceCo codebase uses:
- `listings.status`: typically 'active' / 'inactive' (check your actual values)
- Deal progression: tracked in `deals` table with stage values in `deal_stages`
- Individual deals can be marked as won/lost/dead

**v3.1 lifecycle hooks use the actual schema:**

```sql
-- Trigger on listings.status change
CREATE OR REPLACE FUNCTION handle_listing_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Listing deactivated (engagement ended)
  IF NEW.status = 'inactive' AND OLD.status = 'active' THEN
    UPDATE rm_tasks
    SET status = 'listing_closed',
        updated_at = now()
    WHERE listing_id = NEW.id
      AND status IN ('open','in_progress');

    -- Auto-dismiss pending AI suggestions
    UPDATE rm_tasks
    SET dismissed_at = now(),
        status = 'expired',
        updated_at = now()
    WHERE listing_id = NEW.id
      AND source = 'ai'
      AND confirmed_at IS NULL
      AND dismissed_at IS NULL;

    -- Deactivate buyer cadences
    UPDATE rm_buyer_deal_cadence
    SET is_active = false
    WHERE listing_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_listing_status_change
  AFTER UPDATE OF status ON listings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION handle_listing_status_change();
```

```sql
-- Trigger on individual deal stage changes (buyer-deal progression)
CREATE OR REPLACE FUNCTION handle_deal_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If deal is closed/won or dead/lost
  IF NEW.stage IN ('closed','dead','lost') THEN
    UPDATE rm_tasks
    SET status = CASE WHEN NEW.stage = 'closed' THEN 'completed' ELSE 'cancelled' END,
        updated_at = now()
    WHERE entity_type = 'deal'
      AND entity_id = NEW.id
      AND status IN ('open','in_progress');

    -- Deactivate cadence for this buyer-deal
    UPDATE rm_buyer_deal_cadence
    SET is_active = false
    WHERE deal_id = NEW.id;
  END IF;

  -- If deal stage advances, flag incompatible tasks
  -- (This is done at application level, not trigger, because it needs
  -- the stage-category mapping which shouldn't live in SQL)

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Adjust trigger target to match your actual deals table column name
CREATE TRIGGER trg_deal_stage_change
  AFTER UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION handle_deal_stage_change();
```

---

## Part 8: Task Templates — Phase 1

Unchanged from v3.0 in concept, but corrected for entity types:

- Templates create tasks with `source='template'`
- Tasks are linked to the **listing** (entity_type='listing', entity_id=listing.id)
- Owner defaults to the deal team lead from `rm_deal_team`
- Template tasks are fully editable after creation

The 'Start Deal Process' button appears on the Listing detail page. It opens a modal to select which stage template to apply.

| Stage | Template Tasks | Default Due |
|---|---|---|
| Intake & Qualification | Conduct intake call with owner; Collect 3 years P&Ls; Collect EBITDA bridge; Qualify for full engagement | 7 / 14 / 14 / 21 days |
| Build Buyer List | Build initial buyer universe (50+); Score all buyers; Get seller approval on buyer list | 14 / 21 / 28 days |
| NDA Phase | Send NDA to top 15 buyers; Track NDA returns; Follow up on unsigned NDAs | 3 / ongoing / 7 days |
| CIM Phase | Deliver CIM to NDA-signed buyers; Follow up on CIM receipt; Set first-round IOI deadline | 1 / 5 / 30 days |
| IOI & Presentations | Review all IOIs; Select buyers for presentations; Schedule presentations; Collect final IOIs | var / 5 / 14 / 30 days |
| LOI & Diligence | Send LOI to seller for review; Get seller feedback; Open data room; Assign DD coordinator | 3 / 7 / 3 / 1 days |

Dependencies are pre-populated where applicable (e.g., "Deliver CIM" depends on "Send NDA").

---

## Part 9: Task Aging & Escalation

Unchanged from v3.0, with one addition:

**Notification preferences are respected.** Escalation emails are only sent if the recipient has `escalation_notify=true` in `rm_notification_preferences`. If a deal lead has turned off escalation notifications, the escalation goes to the next admin up.

| Tier | Days Overdue | Visual | Notification | Escalation |
|---|---|---|---|---|
| At Risk | Due in 48h | Amber badge | Amber toast | None |
| Recent | 1–3 days | Red badge | Red banner | None |
| Aging | 4–7 days | Red badge, italic | Daily email to owner | Notify deal team lead |
| Critical | 8–14 days | Red badge, bold, highlighted | Daily email + urgent banner | Notify lead AND admin |
| Abandoned | 15+ days on retained listing | Red, 'ABANDONED' label | Immediate email | Admin dashboard view |

Low-priority tasks on non-retained listings: escalation suppressed (aging tiers still show visually).

---

## Part 10: AI Task Expiry — Tiered (FIXED)

**v3.0 bug:** Flat 7-day expiry creates a 350-task graveyard at 10 AI tasks/day × 20 users.

**v3.1 fix:** Tiered expiry based on AI confidence and relevance:

| AI Confidence | Relevance Score | Expiry Window | Day-N Alert |
|---|---|---|---|
| high | 9-10 | 14 days | Day 12 |
| high | 7-8 | 10 days | Day 8 |
| medium | 9-10 | 10 days | Day 8 |
| medium | 7-8 | 7 days | Day 5 |

Expiry windows are configurable via `rm_platform_settings`.

When a task expires:
1. Set `status='expired'`, `dismissed_at=now()`
2. Log to `rm_task_discards` with reason `'auto_expired'`
3. Do NOT notify the user for individual expiries — include in next daily briefing: "3 AI suggestions expired yesterday"

---

## Part 11: Smartlead Integration — FIXED

### Contact Quality (unchanged from v3.0)
- `email_sent` = partial contact (resets cadence clock by 50%)
- `email_replied` = full contact (fully resets cadence clock)
- `email_bounced` = no cadence update; flag bad email

### Webhook Handler: rm-smartlead-contact-event

```typescript
// Supabase edge function
export async function handleSmartleadEvent(payload: SmartleadWebhook) {
  const { event_type, recipient_email, campaign_name } = payload;

  // Map email to buyer
  const buyer = await supabase
    .from('remarketing_buyers')
    .select('id, name')
    .or(`email.eq.${recipient_email},contact_email.eq.${recipient_email}`)
    .single();

  // Also check buyer_contacts table
  if (!buyer) {
    const buyerContact = await supabase
      .from('buyer_contacts')
      .select('buyer_id, remarketing_buyers(id, name)')
      .eq('email', recipient_email)
      .single();
    // ... resolve buyer from contact
  }

  if (!buyer) {
    console.log(`Smartlead event for unknown email: ${recipient_email}`);
    return;
  }

  switch (event_type) {
    case 'email_sent':
      // Partial contact — update cadence with 50% reset
      await supabase
        .from('rm_buyer_deal_cadence')
        .update({
          last_contacted_at: new Date().toISOString(),
          last_contact_source: 'smartlead'
        })
        .eq('buyer_id', buyer.id)
        .eq('is_active', true);
      break;

    case 'email_replied':
      // Full contact + create suggested task
      await supabase
        .from('rm_buyer_deal_cadence')
        .update({
          last_contacted_at: new Date().toISOString(),
          last_contact_source: 'smartlead_reply'
        })
        .eq('buyer_id', buyer.id)
        .eq('is_active', true);

      // Create high-priority suggested task
      await supabase.from('rm_tasks').insert({
        title: `Review ${buyer.name} reply to ${campaign_name}`,
        entity_type: 'buyer',
        entity_id: buyer.id,
        priority: 'high',
        source: 'system',
        owner_id: await getDealLeadForBuyer(buyer.id),
        status: 'open',
        due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0] // tomorrow
      });
      break;

    case 'email_bounced':
      // Flag bad email, don't update cadence
      await supabase
        .from('buyer_contacts')
        .update({ bad_email: true })
        .eq('email', recipient_email);
      break;
  }
}
```

---

## Part 12: Privacy & Data Retention

Unchanged from v3.0 except table names corrected.

```sql
-- Nightly pg_cron job: purge verbatim quotes after 90 days
SELECT cron.schedule('purge-ai-quotes', '0 3 * * *', $$
  UPDATE rm_tasks
  SET ai_evidence_quote = '[Quote purged — 90-day retention policy]'
  WHERE ai_evidence_quote IS NOT NULL
    AND ai_evidence_quote != '[Quote purged — 90-day retention policy]'
    AND created_at < now() - interval '90 days';

  UPDATE rm_deal_signals
  SET verbatim_quote = '[Quote purged — 90-day retention policy]'
  WHERE verbatim_quote IS NOT NULL
    AND verbatim_quote != '[Quote purged — 90-day retention policy]'
    AND created_at < now() - interval '90 days';

  DELETE FROM rm_task_discards
  WHERE discarded_at < now() - interval '90 days';
$$);
```

---

## Part 13: Buyer Scoring Integration

Unchanged from v3.0. When inserting an `rm_tasks` row with a buyer entity:
1. Look up the buyer's composite score from the existing scoring system
2. Store as `buyer_deal_score` on the task
3. Display as badge in inbox: 9-10=green, 7-8=blue, 5-6=amber, <5=grey
4. Sort order: overdue first → buyer_deal_score desc within same due date

---

## Part 14: Daily Briefing — Materialized View (FIXED)

**v3.0 bug:** At 20 users, running 120+ queries at 8am will be slow and expensive.

**v3.1 fix:** Pre-compute briefing data into a materialized view refreshed at 7:30am.

```sql
CREATE MATERIALIZED VIEW mv_daily_briefing AS
SELECT
  t.owner_id,
  t.id as task_id,
  t.title,
  t.due_date,
  t.priority,
  t.status,
  t.source,
  t.entity_type,
  t.entity_id,
  t.listing_id,
  t.buyer_deal_score,
  t.ai_relevance_score,
  t.confirmed_at,
  t.dismissed_at,
  t.expires_at,
  l.name as listing_name,
  l.is_retained,
  CASE
    WHEN t.due_date < CURRENT_DATE THEN 'overdue'
    WHEN t.due_date = CURRENT_DATE THEN 'due_today'
    WHEN t.due_date <= CURRENT_DATE + 7 THEN 'due_this_week'
    ELSE 'upcoming'
  END as urgency_bucket,
  (CURRENT_DATE - t.due_date) as days_overdue
FROM rm_tasks t
LEFT JOIN listings l ON t.listing_id = l.id
WHERE t.status IN ('open','in_progress')
  AND (l.status IS NULL OR l.status = 'active');

CREATE INDEX idx_mv_briefing_owner ON mv_daily_briefing(owner_id, urgency_bucket);

-- Refresh at 7:30am daily
SELECT cron.schedule('refresh-briefing', '30 7 * * *', $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_briefing;
$$);
```

The 8am briefing function reads from this materialized view instead of running live queries.

---

## Part 15: Phased Build Plan — v3.1

### Phase 1: Manual Tasks + Templates + Team Foundation

**What to build:**
- `rm_tasks` table with full v3.1 schema
- Migration from `daily_standup_tasks`
- `rm_deal_team` table
- `rm_task_comments` table
- `rm_task_activity` table
- `rm_notification_preferences` table
- Tasks tab on Listing, Deal, Buyer pages (update existing task UI components)
- Central Task Inbox with views: My Tasks / Due Today / This Week / Overdue / Completed
- Notification bar with overdue/due-today banners
- Snooze functionality
- Deal lifecycle triggers (listing status + deal stage)
- Task templates + 'Start Deal Process' button on Listing pages
- Email reminders 24hr before due
- Nightly jobs: wake snoozed tasks, lifecycle hooks
- **Notification preferences UI** (new in v3.1)

**Acceptance criteria:**
- Team creates manual tasks linked to records on Day 1
- Template creates tasks in <5 seconds
- All tasks link to existing records (DB constraint enforced)
- Notification bar shows overdue count
- Existing daily_standup_tasks data accessible in new system
- Users can configure notification preferences

### Phase 2: Briefing + Team Dashboards + Chatbot Integration

**What to build:**
- Daily briefing materialized view + edge function
- Email briefing (mobile-readable plain text)
- On-demand briefing via ai-command-center (new task tools)
- Chatbot task creation with mandatory record confirmation (via ai-command-center tools)
- Session memory in ai-command-center
- **Team dashboard** (new in v3.1): listing-level view showing all team members' tasks, workload distribution, overdue breakdown
- **Bulk operations** (new in v3.1): bulk reassign, bulk close, bulk snooze
- Buyer spotlight query (from rm_buyer_deal_cadence, initially populated manually)

**Acceptance criteria:**
- Daily briefing sent by 8:05am per timezone
- Chatbot answers "what's on my plate today?" correctly
- Chatbot creates tasks only after user confirmation
- Deal team lead can see all team members' task status on dashboard
- Bulk reassign works for 50+ tasks

### Phase 3: AI Extraction + Signals + External Integrations

**What to build:**
- `rm_task_extractions`, `rm_task_discards`, `rm_deal_signals` tables
- Upgrade `extract-standup-tasks` → `rm-extract-tasks` with v3.1 prompt
- All 4 guardrail layers
- Fireflies webhook handler (upgrade existing)
- AI Suggested view in Task Inbox
- Tiered expiry + alert system
- Signal dashboard on Listing pages
- Buyer scoring on tasks
- Smartlead webhook + `rm_buyer_deal_cadence` auto-updates
- Dedup logic (deterministic, not semantic)
- `rm_platform_settings` table + admin threshold config

**Acceptance criteria:**
- AI extracts 2-5 valid tasks per transcript
- Discard rate visible in audit log
- Signals appear on listing pages
- Buyer scores show on tasks
- Smartlead events update last_contacted_at
- No duplicate tasks from same transcript
- Admin can adjust relevance threshold from UI

### Phase 4: Polish + Analytics

**What to build:**
- Task aging tiers with escalation (visual treatment exists from Phase 1; escalation notifications added here)
- Task dependency warnings in UI
- Multi-listing buyer call handling
- Admin calibration dashboard (false positive/negative tracking)
- Task analytics + deal outcome metrics
- Recurring tasks
- Slack notifications (if slack_enabled in preferences)

**Acceptance criteria:**
- Overdue escalation sends to deal lead after 7 days
- Dependencies show warning when blocking task is open
- Admin dashboard shows extraction quality metrics
- Deal velocity metric tracked and reported

---

## Part 16: Build Prompts for Development

### PHASE 1 PROMPT

```
Build a unified task management system for the SourceCo remarketing tool. This EXTENDS
the existing daily_standup_tasks system — do NOT create a parallel system.

Read every line before writing any code. This is production for an M&A advisory firm.

IMPORTANT CODEBASE CONTEXT:
- listings = sellside engagements (the company being sold)
- deals = buyer-deal pipeline entries (one buyer pursuing one listing)
- remarketing_buyers = buyer firms
- contacts = seller-side contacts
- buyer_contacts = buyer-side contacts
- The existing daily_standup_tasks table and extract-standup-tasks edge function
  will be migrated to the new system
- The existing ai-command-center edge function handles chatbot functionality
- Task UI components exist in src/components/tasks/

DATABASE — Create these tables:

rm_tasks: [use exact schema from Part 2 of v3.1 spec]
rm_deal_team: [use exact schema from Part 2]
rm_task_comments: [use exact schema from Part 2]
rm_task_activity: [use exact schema from Part 2]
rm_notification_preferences: [use exact schema from Part 2]

MIGRATION: Run the migration script from Part 6 to move daily_standup_tasks data
into rm_tasks. Keep the old table as daily_standup_tasks_archived for 30 days.

RLS: Use the optimized policy from Part 3 (with denormalized listing_id).

ENTITY TYPES: 'listing', 'deal', 'buyer', 'contact', 'buyer_contact'
  — these map to the actual SourceCo tables, NOT generic names.

TASKS TAB: Add/update Tasks tab on Listing, Deal, Buyer pages.
  Query rm_tasks WHERE (entity_type=[type] AND entity_id=[id])
    OR (secondary_entity_type=[type] AND secondary_entity_id=[id])
  ORDER BY due_date ASC NULLS LAST.

TASK INBOX: /tasks route with badge count.
  Tabs: My Tasks / Due Today / This Week / Overdue / Completed
  Retained listing tasks show RETAINED badge.
  Sort: due_date, then buyer_deal_score desc.
  Filters: entity_type, priority, date range, status, source.

NOTIFICATION BAR: Red=overdue, Amber=due today, Toast=assigned/reminder/snoozed.
  Notification bell with last 20 alerts.
  Respect rm_notification_preferences for each user.

SNOOZE: Tomorrow / 1 Week / 2 Weeks / 1 Month / Custom.

LIFECYCLE TRIGGERS: Use triggers from Part 7 — on listings.status change
  AND on deals stage change.

TEMPLATES: 'Start Deal Process' button on Listing pages.
  Templates from Part 8. source='template', owner=deal lead from rm_deal_team.

ACTIVITY LOG: Every status change, reassignment, and completion writes to rm_task_activity.

COMMENTS: rm_task_comments with threaded display on task detail view.
```

### PHASE 2 PROMPT

```
Phase 1 must be stable before starting.

DAILY BRIEFING: Create materialized view from Part 14.
  Edge function rm-generate-daily-briefing reads from mv_daily_briefing.
  Schedule: refresh view at 7:30am, send briefings at 8:00am per user timezone
    (from rm_notification_preferences.briefing_timezone).
  Email format: plain text, bullet lists, links. Subject line from spec.
  Respect email_briefing_enabled and in_app_briefing_enabled preferences.

AI COMMAND CENTER — ADD TASK TOOLS (do NOT build a separate chatbot):
  Register the tools from Part 6 in the existing ai-command-center edge function:
  get_my_tasks, get_daily_briefing, create_task, get_buyer_spotlight,
  get_deal_signals, update_task_status.

  Session memory: store active_listing_id, active_buyer_id in session context.
  Reset after 30min inactivity.

  Task creation is ALWAYS 2-step: propose → user confirms → save.

TEAM DASHBOARD: New view at /tasks/team (accessible to deal leads and admins).
  Shows: all team members, their task counts by status, overdue count,
  listing-level task breakdown.
  Filterable by listing, team member, date range.

BULK OPERATIONS:
  - Bulk reassign: select multiple tasks → assign to new owner
  - Bulk close: select multiple tasks → mark completed/cancelled
  - Bulk snooze: select multiple tasks → snooze to date
  All bulk ops write to rm_task_activity.
```

### PHASE 3 PROMPT

```
Phases 1 and 2 must be stable before starting.

NEW TABLES: rm_task_extractions, rm_task_discards, rm_deal_signals,
  rm_buyer_deal_cadence, rm_platform_settings — schemas from Part 2.

UPGRADE extract-standup-tasks → rm-extract-tasks:
  Use the EXACT v3.1 system prompt from Part 5.
  Context passed to AI: listing_name, listing_id, active_deals array,
    buyer_scores (top 10), stage_valid_categories mapping, speaker_map.

  Four guardrail layers (Part 4):
    Layer 1: Category filter
    Layer 2: Scoring filter (threshold from rm_platform_settings)
    Layer 3: Stage filter per buyer-deal
    Layer 4: Record existence check

  Dedup: deterministic md5 match (Part 4), NOT semantic similarity.
  Results: rm_tasks + rm_deal_signals.
  Logging: rm_task_extractions + rm_task_discards.

TIERED EXPIRY (Part 10):
  High confidence + high relevance: 14 days
  High confidence + medium relevance: 10 days
  Medium confidence: 7 days
  Configurable via rm_platform_settings.

AI SUGGESTED VIEW: Tab in Task Inbox showing unconfirmed AI tasks.
  Confirm (require due_date), Edit, Dismiss actions.

SIGNALS DASHBOARD: Tab on Listing detail page.
  Critical signals show red banner. Acknowledge button per signal.

FIREFLIES WEBHOOK: Upgrade existing handler.
  Match participants → listing + deals. Insert extraction record. Invoke async.

SMARTLEAD WEBHOOK: rm-smartlead-contact-event (Part 11).
  email_sent = partial cadence reset. email_replied = full reset + task.
  email_bounced = flag bad email.

BUYER SCORING: Fetch score on task insert. Display badge in inbox.
```

### PHASE 4 PROMPT

```
Phases 1-3 must be stable before starting.

AGING & ESCALATION (Part 9):
  Visual tiers in UI. Escalation notifications respect rm_notification_preferences.
  Admin dashboard: 'Attention Required' view for Abandoned tasks.

DEPENDENCIES (Section from v3.0, Part 8):
  UI warning when attempting to start/complete a task whose depends_on is still open.
  Soft block — user can override with confirmation.

ADMIN CALIBRATION:
  Dashboard showing: extraction success rate, discard reasons breakdown,
  false positive/negative tracking, threshold adjustment UI.

ANALYTICS:
  System health: record link integrity, AI topic accuracy, extraction rate, expiry rate.
  Adoption: inbox opens, briefing usage, manual task creation rate, overdue rate.
  Outcomes: days to IOI, buyer re-engagement rate, signal acknowledgement rate.

RECURRING TASKS: Optional recurrence on tasks (daily/weekly/monthly).
  On completion, auto-create next instance.

SLACK: If slack_enabled, send notifications via Slack webhook.
  Map slack_user_id from rm_notification_preferences.
```

---

## Part 17: Success Metrics — v3.1

Same as v3.0 with two additions:

| Tier | Metric | Target |
|---|---|---|
| Adoption | Team dashboard viewed by leads weekly | >80% of leads, >3 days/week |
| Adoption | Task comments per active task | >1 comment on tasks with >1 team member |

---

## Part 18: Core Principles (Unchanged)

1. **Record Association** — every task linked to an existing record (DB constraint)
2. **M&A Scope Only** — AI extracts only deal-advancing tasks
3. **Deal Stage Awareness** — per buyer-deal stage, not per listing
4. **Completion Evidence** — nudge for outcome documentation
5. **No Silent Failures** — log + notify on extraction failures
6. **Retained Listings First** — in all views and briefings
7. **Data Minimisation** — 90-day quote purge, RLS on sensitive tables

---

**END OF SPECIFICATION — VERSION 3.1**
**SourceCo — Confidential & Internal Use Only**
