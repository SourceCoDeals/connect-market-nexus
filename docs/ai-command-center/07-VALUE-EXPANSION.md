# SourceCo AI Command Center - Value Expansion & Business Impact Guide

**Version:** 1.0
**Date:** 2026-02-23

---

## 0. Executive Summary

The v1 AI Command Center is a **read-only intelligence layer** — it answers questions about data. This document defines how to expand it into a **full operational co-pilot** that doesn't just tell the team what's happening, but helps them **take action, automate workflows, and make better decisions faster**.

The expansion is organized into 5 capability tiers, each building on the previous:

```
TIER 1: INTELLIGENCE (v1 — current spec)
  "What are my active deals?"
  → Answers questions about data across all systems

TIER 2: ACTIONS (v1.5)
  "Create a task to follow up with Summit Capital next Tuesday"
  → Writes data back: creates tasks, logs notes, updates stages

TIER 3: GENERATION (v2)
  "Draft an outreach email for Tier A buyers on the Acme Corp deal"
  → Generates content: emails, memos, meeting prep briefs, reports

TIER 4: ORCHESTRATION (v2.5)
  "Move Acme Corp to Due Diligence, notify the buyer, and schedule a data room review"
  → Multi-step workflows: chains actions across systems

TIER 5: PROACTIVE INTELLIGENCE (v3)
  [Unprompted]: "Deal D-0042 has been in LOI for 32 days (avg is 18).
  Summit Capital hasn't responded in 14 days. Suggested action: escalate."
  → Monitors the business and surfaces insights before you ask
```

**Projected Business Impact:**

| Capability | Time Saved per User/Day | Business Value |
|-----------|------------------------|---------------|
| Intelligence (v1) | 30-45 min | Faster decisions, fewer pages visited |
| Actions (v1.5) | 15-20 min | Fewer context switches, tasks created in conversation |
| Generation (v2) | 30-60 min | Outreach at scale, meeting prep in 10 seconds |
| Orchestration (v2.5) | 20-30 min | Complex workflows via one sentence |
| Proactive (v3) | 15-30 min | Nothing falls through the cracks |
| **Total** | **~2-3 hours/day** | **Team can handle 2x deal volume without headcount** |

---

## 1. TIER 2: Action Mode (Write-Back Capabilities)

### 1.1 The Problem

The v1 Command Center can tell you "You have 3 overdue tasks" — but you still have to navigate to the task page to mark them done, create new ones, or reassign them. Every answer that requires action creates a context switch.

### 1.2 Action Tools Catalog

These actions leverage **existing edge functions** already built in the platform. The AI Command Center becomes a natural language interface to capabilities that already exist.

#### Task Management Actions

```typescript
// Tool: create_deal_task
{
  name: "create_deal_task",
  description: "Create a new task on a deal. Use when user says 'remind me to...', 'create a task to...', 'I need to...'",
  input_schema: {
    type: "object",
    properties: {
      deal_id: { type: "string" },
      deal_name: { type: "string", description: "For fuzzy matching if deal_id not provided" },
      title: { type: "string" },
      description: { type: "string" },
      assigned_to: { type: "string", description: "UUID or 'CURRENT_USER' or team member name" },
      due_date: { type: "string", description: "ISO date. AI should interpret 'next Tuesday', 'in 3 days', etc." },
      priority: { type: "string", enum: ["high", "medium", "low"] }
    },
    required: ["title"]
  },
  confirmation_required: false  // Low-risk, easily reversible
}

// Tool: complete_deal_task
{
  name: "complete_deal_task",
  description: "Mark a task as completed.",
  input_schema: {
    type: "object",
    properties: {
      task_id: { type: "string" },
      task_title: { type: "string", description: "For fuzzy matching" }
    }
  },
  confirmation_required: false
}

// Tool: reassign_deal_task
{
  name: "reassign_deal_task",
  description: "Reassign a task to a different team member.",
  input_schema: {
    type: "object",
    properties: {
      task_id: { type: "string" },
      new_assignee: { type: "string", description: "Name or UUID" }
    }
  },
  confirmation_required: true  // Affects another person
}
```

#### Deal Activity & Notes Actions

```typescript
// Tool: add_deal_note
{
  name: "add_deal_note",
  description: "Add a note to a deal. Use when user says 'note that...', 'remember that...', 'log that...'",
  input_schema: {
    type: "object",
    properties: {
      deal_id: { type: "string" },
      deal_name: { type: "string" },
      content: { type: "string", description: "The note content. AI should format from natural language." },
      is_internal: { type: "boolean", default: true }
    }
  },
  confirmation_required: false
}

// Tool: log_deal_activity
{
  name: "log_deal_activity",
  description: "Log an activity on a deal (call made, email sent, meeting held).",
  input_schema: {
    type: "object",
    properties: {
      deal_id: { type: "string" },
      activity_type: { type: "string", enum: ["call", "email", "meeting", "note", "stage_change", "other"] },
      description: { type: "string" }
    }
  },
  confirmation_required: false
}
```

#### Deal Stage Management

```typescript
// Tool: update_deal_stage
{
  name: "update_deal_stage",
  description: "Move a deal to a different pipeline stage. Use when user says 'move X to LOI', 'advance this deal', etc.",
  input_schema: {
    type: "object",
    properties: {
      deal_id: { type: "string" },
      deal_name: { type: "string" },
      new_stage: { type: "string", description: "Stage name: Lead, NDA, LOI, Due Diligence, Closed, etc." },
      reason: { type: "string", description: "Why the stage is changing (logged as activity)" }
    }
  },
  confirmation_required: true  // Significant state change, confirm before executing
}
```

#### Data Room Access Actions

```typescript
// Tool: grant_data_room_access
{
  name: "grant_data_room_access",
  description: "Grant a buyer access to deal documents (teaser, memo, data room). Leverages existing data-room-access edge function.",
  input_schema: {
    type: "object",
    properties: {
      deal_id: { type: "string" },
      buyer_id: { type: "string" },
      buyer_name: { type: "string" },
      access_level: { type: "string", enum: ["teaser", "memo", "full_data_room"], description: "teaser = can_view_teaser, memo = +can_view_full_memo, full_data_room = all access" }
    }
  },
  confirmation_required: true  // Sharing sensitive documents
}
```

#### Deal Conversion Actions

```typescript
// Tool: convert_to_pipeline_deal
{
  name: "convert_to_pipeline_deal",
  description: "Convert a remarketing buyer match into an active pipeline deal. Leverages existing convert-to-pipeline-deal edge function. Auto-creates firm agreements.",
  input_schema: {
    type: "object",
    properties: {
      listing_id: { type: "string" },
      buyer_id: { type: "string" },
      stage_name: { type: "string", default: "Lead" }
    }
  },
  confirmation_required: true  // Creates multiple records
}
```

### 1.3 Confirmation UX Pattern

Actions that modify shared state require user confirmation before execution:

```
User: "Move Acme Corp to Due Diligence"

AI: I'll move **Acme Corp** (D-0042) from **LOI** → **Due Diligence**.
    This will:
    - Update the deal stage
    - Log a stage change activity
    - Notify the deal team

    **Confirm?** [Yes, proceed] [Cancel]

User: Yes

AI: Done. Acme Corp is now in Due Diligence.
    → "Create data room review tasks for this deal"
    → "Grant buyer access to the data room"
    → "Show Due Diligence checklist"
```

### 1.4 Natural Language → Action Mapping

```
"Remind me to call Summit Capital on Thursday"
  → create_deal_task(title: "Call Summit Capital", due_date: "2026-02-26", assigned_to: CURRENT_USER)

"Note that the seller wants to close by Q2"
  → add_deal_note(content: "Seller timeline: wants to close by end of Q2 2026")

"Mark the LOI review task as done"
  → complete_deal_task(task_title: "LOI review")

"Give Greenfield Advisors access to the teaser"
  → grant_data_room_access(buyer_name: "Greenfield Advisors", access_level: "teaser")

"Move this deal forward"
  → [context: currently in NDA stage] update_deal_stage(new_stage: "LOI", reason: "User advanced from NDA")
```

### 1.5 Safety Rules for Actions

1. **Read before write:** Always fetch current state before modifying. Don't assume.
2. **Confirm destructive actions:** Stage changes, access grants, deal conversions require explicit "yes."
3. **Never bulk-modify without listing:** "Complete all my overdue tasks" → list them first, then confirm.
4. **Audit trail:** Every AI-initiated action is logged with `source: "ai_command_center"` in the activity record.
5. **Rollback guidance:** After every action, mention how to undo: "You can revert this from the deal detail page."
6. **Rate limit actions:** Max 10 write actions per conversation to prevent runaway modifications.

---

## 2. TIER 3: Content Generation

### 2.1 Meeting Preparation Briefs

**The highest-value single feature for the team.** Before any buyer meeting, the AI assembles everything the user needs to know in 10 seconds instead of 15 minutes of clicking around.

```
User: "Prepare me for my meeting with Summit Capital about Acme Corp"

AI: **Meeting Prep: Summit Capital × Acme Corp (D-0042)**

**Deal Status:** LOI stage, active since Jan 15. 12 activities in last 30 days.

**Buyer Profile:**
- Summit Capital Partners — PE firm, $50-200M fund size
- Focus: Home services in Southeast US
- Composite score: **82 (Tier A)**
  - Geography: 95 | Size: 78 | Service: 85 | Goals: 70

**Key History:**
- 3 calls logged (last: Feb 18 — CEO participated)
- NDA signed Feb 1, LOI submitted Feb 10
- Data room: teaser + memo accessed, full data room pending

**From Last Call (Feb 18):**
- CEO expressed interest in "closing before Q2 earnings"
- Concerns about customer concentration (top 3 = 40% revenue)
- Action item: Send updated financials by Feb 22 ⚠️ OVERDUE

**Open Tasks:**
- ⚠️ Send updated financials — due Feb 22, OVERDUE
- Schedule management meeting — due Feb 28

**Suggested Talking Points:**
1. Address customer concentration concern with diversification data
2. Confirm Q2 timeline is still viable
3. Discuss data room access for due diligence

→ "Show full transcript from Feb 18 call"
→ "What other deals is Summit Capital involved in?"
→ "Draft a follow-up email after this meeting"
```

**Implementation:** New tool `generate_meeting_prep` that orchestrates:
1. `get_deal_details` (full mode)
2. `get_buyer_profile` (full mode)
3. `get_score_breakdown`
4. `search_transcripts` (for this buyer + deal)
5. `get_deal_tasks` (assigned to user, for this deal)
6. `get_outreach_status` (for this buyer + deal)

All fired in parallel, synthesized by Opus into a structured brief.

### 2.2 Outreach Email Drafting

Leverages existing `draft-outreach-email` edge function but adds AI intelligence from deal context, buyer profile, and transcript history.

```
User: "Draft outreach emails for the top 5 Tier A buyers on the Acme Corp deal"

AI: I found 5 Tier A buyers for Acme Corp. Here are personalized drafts:

**1. Summit Capital Partners** (Score: 82)
Subject: Acme Corp — Home Services Acquisition Opportunity in Florida

Hi David,

I wanted to share a compelling opportunity that aligns closely with Summit Capital's
home services acquisition strategy in the Southeast. Acme Corp is a leading HVAC and
plumbing provider in Central Florida with $8.2M in revenue and strong EBITDA margins...

[Personalized based on buyer's target_services, geographic_footprint, and revenue range]

**2. Greenfield Advisors** (Score: 79)
Subject: ...

[Confirm to send] [Edit first] [Draft all 5 as email templates]
```

### 2.3 Deal Memo Generation

Extends existing `generate-lead-memo` function with conversational interface:

```
User: "Generate a teaser memo for the new landscaping deal in Texas"

AI: I'll generate a teaser memo for **Green Lawn Services** (D-0156).
    Pulling deal data, financials, and market context...

    [Streaming memo generation with progress indicators]

    Memo generated (3 pages). Key sections:
    - Executive Summary
    - Company Overview
    - Financial Highlights ($4.2M revenue, 22% EBITDA)
    - Growth Opportunities
    - Transaction Overview

    → "Review and edit the memo"
    → "Generate the full CIM next"
    → "Send teaser to Tier A buyers"
```

### 2.4 Weekly Pipeline Reports

Auto-generated reports for leadership team meetings:

```
User: "Generate this week's pipeline report"

AI: **SourceCo Weekly Pipeline Report — Week of Feb 17, 2026**

**Pipeline Summary:**
- Active deals: 47 (+3 from last week)
- New deals this week: 5
- Deals closed: 1 (Beta Services — $6.8M)
- Deals lost: 1 (Delta Corp — buyer withdrew)

**Stage Movement:**
- Lead → NDA: 4 deals
- NDA → LOI: 2 deals
- LOI → Due Diligence: 1 deal
- Due Diligence → Closed: 1 deal

**Attention Required:**
- ⚠️ 3 deals stalled > 14 days (Gamma Corp, Epsilon LLC, Zeta Partners)
- ⚠️ 12 overdue tasks across team
- ⚠️ 8 buyers with no response > 7 days

**Team Activity:**
| Team Member | Active Deals | Activities | Tasks Completed | Overdue |
|-------------|-------------|------------|----------------|---------|
| Sarah       | 12          | 34         | 8              | 2       |
| Mike        | 10          | 28         | 6              | 4       |
| Alex        | 8           | 22         | 10             | 1       |
| Chris       | 15          | 41         | 12             | 3       |

→ "Show details on stalled deals"
→ "Export as PDF"
→ "Compare to last week"
```

### 2.5 Buyer Outreach Sequences

```
User: "Create a 3-touch outreach sequence for PE firms targeting HVAC in the Southeast"

AI: I found 23 PE firms matching this criteria. Here's a 3-touch sequence:

**Touch 1 (Day 0): Introduction Email**
Subject: [Deal Name] — [Industry] Acquisition Opportunity in [Region]
Body: [Personalized intro based on buyer's thesis + deal highlights]

**Touch 2 (Day 5): Follow-up with Data Point**
Subject: Re: [Deal Name] — Key Financial Highlight
Body: [Reference specific metric that aligns with buyer's criteria]

**Touch 3 (Day 12): Final Touch with Social Proof**
Subject: [Deal Name] — Multiple Parties in Diligence
Body: [Urgency messaging + offer to schedule a call]

Apply to all 23 buyers? [Preview first 3] [Customize] [Send sequence]
```

---

## 3. TIER 4: Workflow Orchestration

### 3.1 Multi-Step Workflows

The AI chains multiple actions together from a single natural language instruction:

```
User: "Advance Acme Corp to Due Diligence — give Summit Capital full data room access,
       create tasks for the DD checklist, and notify the team"

AI: I'll execute this workflow for **Acme Corp** (D-0042):

    1. ✅ Move deal stage: LOI → Due Diligence
    2. ✅ Grant Summit Capital full data room access
    3. ✅ Create 5 Due Diligence tasks:
       - Financial model review (assigned: Alex, due: Mar 5)
       - Legal review of contracts (assigned: Sarah, due: Mar 7)
       - Customer reference calls (assigned: Mike, due: Mar 10)
       - Management team interview (assigned: Chris, due: Mar 12)
       - Environmental assessment (assigned: Alex, due: Mar 14)
    4. ✅ Notify deal team: Sarah, Mike, Alex, Chris
    5. ✅ Log activity: "Deal advanced to Due Diligence — Summit Capital"

    All actions completed.
    → "Send Summit Capital a welcome-to-DD email"
    → "Show the DD task dashboard"
```

### 3.2 Pre-Built Workflow Templates

Common multi-step workflows available as one-liners:

| Command | Steps Executed |
|---------|---------------|
| "Start DD for [deal] with [buyer]" | Update stage → Grant access → Create DD tasks → Notify team |
| "Close deal [name]" | Update stage → Log win → Update pipeline metrics → Send congrats to team |
| "Onboard new buyer [name]" | Create buyer profile → Run scoring → Identify matching deals → Queue outreach |
| "Prepare for next week" | Generate briefings → Flag overdue tasks → Identify stale deals → Suggest priorities |
| "End of day recap" | Summarize today's activities → Flag incomplete tasks → Preview tomorrow's calendar |

### 3.3 Workflow Safety

- Each step in a workflow is displayed before execution
- User can approve/reject individual steps
- Failed steps don't block subsequent independent steps
- All steps are logged with a workflow_id for audit trail
- Workflows can be paused and resumed

---

## 4. TIER 5: Proactive Intelligence

### 4.1 Deal Health Monitoring

The system continuously monitors deal health signals and surfaces issues before they become problems:

```
DEAL HEALTH SIGNALS:
- Stage duration vs. average (deal in LOI for 32 days when avg is 18)
- Activity velocity declining (went from 8 activities/week to 2)
- Buyer response time increasing (last 3 responses took 5+ days vs. usual 1-2)
- Task completion rate dropping (40% of tasks overdue)
- Key stakeholder disengagement (CEO hasn't been in a meeting in 3 weeks)
```

```
[Proactive notification in chat]:

AI: ⚠️ **Deal Health Alert: Gamma Corp (D-0103)**

   This deal has been in **NDA stage for 28 days** (average: 12 days).
   - No buyer activity in 14 days
   - 2 overdue tasks (NDA follow-up, financial package delivery)
   - Last outreach to Riverside PE was 18 days ago (no response)

   **Suggested actions:**
   → "Send a follow-up to Riverside PE"
   → "Reassign this deal to a more active team member"
   → "Move to stalled and focus on other deals"
```

### 4.2 Smart Match Alerts

When new data enters the system, the AI proactively identifies matches:

```
[New lead imported]:

AI: 🔔 **New Lead Match: ServiceMaster Plus (HVAC, Florida, $6M revenue)**

   This new lead matches criteria for 3 active deals:
   1. **Acme Corp** (D-0042) — Same industry, adjacent geography (score: est. 75)
   2. **Beta Services** (D-0087) — Similar revenue, overlapping services (score: est. 68)

   And matches buying criteria for 8 remarketing buyers:
   - Summit Capital (Tier A match)
   - Greenfield Advisors (Tier B match)

   → "Score this lead against all active deals"
   → "Draft outreach to matched buyers"
   → "Show full lead details"
```

### 4.3 Daily Briefing (Enhanced)

The morning briefing goes beyond pipeline status to include actionable intelligence:

```
User: "Morning briefing"

AI: **Good morning, Sarah. Here's your Tuesday briefing (Feb 24, 2026):**

**🔥 Urgent (Act Today):**
- ⚠️ Send updated financials to Summit Capital — **2 days overdue**
- ⚠️ Gamma Corp has been stalled 28 days — decide: push forward or deprioritize?
- 📞 You have a 2pm call with Greenfield Advisors about Beta Services

**📊 Pipeline Snapshot:**
- 12 active deals (up 1 from Friday)
- 3 deals moved stages last week
- Pipeline value: $142M (weighted: $47M)

**📬 Buyer Activity Overnight:**
- Riverside PE opened the Acme Corp teaser (3rd view)
- 2 new connection requests on marketplace
- Summit Capital responded to your Feb 20 email ✉️ (new!)

**📋 Today's Tasks (5):**
1. Send financials to Summit Capital (OVERDUE)
2. Review Beta Services data room documents
3. Score new leads from yesterday's import (4 leads)
4. Call prep for Greenfield Advisors 2pm
5. Weekly team pipeline meeting at 4pm

**💡 AI Insights:**
- Riverside PE's 3 teaser views suggest strong interest — consider sending the full memo
- Your close rate this quarter is 18% (up from 12% last quarter)
- 2 deals have been in the same stage for > 2x the average — consider escalating

→ "Prepare me for the Greenfield call"
→ "Draft the Summit Capital financials email"
→ "Show me the Riverside PE profile"
```

### 4.4 End-of-Week Summary

```
User: "End of week recap"

AI: **Your Week in Review (Feb 17-21, 2026):**

**Wins:**
- ✅ Closed Beta Services ($6.8M) — congrats! 🎉
- ✅ Advanced Acme Corp to LOI
- ✅ Completed 14 of 18 tasks (78% completion)

**Needs Attention:**
- Gamma Corp — stalled, no buyer engagement in 14 days
- 4 tasks carried over to next week
- 3 buyers with no response to outreach

**Key Metrics:**
- Activities logged: 34 (above team avg of 28)
- Outreach sent: 12, Responses: 5 (42% response rate)
- Meetings held: 6

**Next Week Preview:**
- 3 scheduled buyer calls
- 2 data room reviews due
- Q1 pipeline report due Friday

→ "Plan my priorities for next week"
→ "Show team comparison for this week"
```

---

## 5. TIER BONUS: Data Quality & Operational Intelligence

### 5.1 Data Quality Monitor

The AI proactively identifies data quality issues that degrade platform effectiveness:

```
User: "How's our data quality looking?"

AI: **Data Quality Dashboard:**

**Buyer Profiles:**
- 2,847 total remarketing buyers
- Average data completeness: 64%
- 312 buyers (11%) below 30% completeness — **these won't score accurately**
- 145 buyers missing geographic data
- 89 buyers with no contact information

**Deal Records:**
- 47 active deals
- 5 deals missing primary owner assignment
- 3 deals with no activities in 30+ days (likely abandoned)
- 12 deals with 0 buyer scores (not scored yet)

**Transcripts:**
- 203 calls in Fireflies not synced to local database
- 45 transcripts missing CEO detection analysis
- 12 transcripts with no extracted insights

**Suggested Actions:**
→ "Queue enrichment for the 312 low-completeness buyers"
→ "Sync missing Fireflies transcripts"
→ "Assign owners to the 5 unowned deals"
```

### 5.2 Competitive & Portfolio Intelligence

```
User: "Show me buyer conflicts — which buyers are we pitching multiple deals to?"

AI: **Buyer Overlap Analysis:**

**Summit Capital Partners** is active on 4 deals:
- Acme Corp (D-0042) — LOI stage, score: 82
- Beta Services (D-0087) — Closed Won ✅
- Gamma Corp (D-0103) — NDA stage, score: 71
- Delta Corp (D-0134) — Lead stage, score: 65

⚠️ **Potential conflict:** Acme Corp and Gamma Corp are both HVAC in Florida.
Summit Capital may not pursue both simultaneously.

**Greenfield Advisors** is active on 3 deals:
- Acme Corp (D-0042) — Due Diligence, score: 79
- Epsilon LLC (D-0121) — LOI stage, score: 74

No conflicts detected — different industries and geographies.

→ "Show full buyer activity across all deals"
→ "Which buyers are most spread thin?"
```

---

## 6. Implementation Priority Matrix

### 6.1 Business Value vs. Engineering Effort

```
                        HIGH BUSINESS VALUE
                              |
    Meeting Prep         **** | ****  Daily Briefing (Enhanced)
    Briefs                    |       Proactive Alerts
                              |
    Outreach Drafting    ***  | ***   Deal Health Monitoring
    Pipeline Reports          |       Smart Match Alerts
                              |
  ────────────────────────────+──────────────────────────────
                              |
    Task Creation        **   | **    Workflow Orchestration
    Note Logging              |       Buyer Conflict Analysis
    Stage Updates             |
                              |
    Data Room Access     *    | *     Data Quality Monitor
    Deal Conversion           |       End-of-Week Summary
                              |
   LOW EFFORT                 |                    HIGH EFFORT
```

### 6.2 Recommended Implementation Order

| Priority | Capability | Why First | Existing Infrastructure | New Effort |
|----------|-----------|-----------|----------------------|-----------|
| **P0** | Task creation & completion | Immediate value, natural extension of follow-up queries | `deal_tasks` table, standard CRUD | Low — simple insert/update |
| **P0** | Add deal notes | Users want to log insights during conversation | `deal_notes` table, existing patterns | Low — simple insert |
| **P0** | Meeting prep briefs | **Highest single-feature value** — saves 15 min per meeting | All read tools already exist | Low — orchestration + Opus prompt |
| **P1** | Outreach email drafting | Leverages existing `draft-outreach-email` function | `draft-outreach-email` edge function, buyer data | Medium — personalization logic |
| **P1** | Deal stage updates | Completes the action story | `deals` table, `deal_stages`, activity logging | Low — update + activity log |
| **P1** | Enhanced daily briefing | Transforms morning workflow | All read tools + proactive analysis | Medium — new Opus briefing prompt |
| **P1** | Weekly pipeline reports | Leadership needs this | Pipeline data, team data | Medium — report generation prompt |
| **P2** | Data room access grants | Frequently requested | `data-room-access` edge function | Low — wraps existing function |
| **P2** | Deal health monitoring | Proactive value | Activity data, stage duration analytics | Medium — scoring algorithm + cron |
| **P2** | Smart match alerts | Prevents missed opportunities | Scoring engine, lead import triggers | Medium — event-driven architecture |
| **P3** | Workflow orchestration | Compound actions | All action tools | High — workflow engine, rollback |
| **P3** | Data quality monitoring | Operational excellence | All data tables | Medium — analysis queries |
| **P3** | Buyer conflict analysis | Strategic intelligence | Deals + buyers cross-reference | Low — query + analysis |

### 6.3 Phased Rollout

```
PHASE 1.5 (Weeks 5-6, parallel with Phase 2):
  → Task creation/completion/reassignment
  → Deal note logging
  → Meeting prep briefs
  → Activity logging from chat

PHASE 2.5 (Weeks 11-12, parallel with Phase 3):
  → Outreach email drafting
  → Deal stage updates with confirmation
  → Enhanced daily briefing
  → Weekly pipeline report generation

PHASE 3.5 (Weeks 15-16):
  → Data room access management
  → Deal health monitoring + alerts
  → Smart match notifications
  → Buyer conflict analysis

PHASE 4 (Weeks 17-20):
  → Multi-step workflow orchestration
  → Data quality monitoring
  → End-of-day/week recaps
  → Full proactive intelligence suite
```

---

## 7. New User Stories (Action-Oriented)

### US-21: Create Task from Conversation
**As a** deal manager, **I want to** say "remind me to send financials to Summit Capital by Friday" in the chat **so that** a task is created without leaving the conversation.

**Acceptance Criteria:**
- Natural language date interpretation ("next Friday", "in 3 days", "end of month")
- Task linked to correct deal (inferred from context or specified)
- Assigned to current user by default
- Confirmation shown: "Task created: Send financials to Summit Capital — due Feb 28"

### US-22: Meeting Preparation Brief
**As a** deal manager, **I want to** say "prepare me for my 2pm call with Greenfield Advisors" **so that** I get a comprehensive brief in 10 seconds instead of 15 minutes of page-hopping.

**Acceptance Criteria:**
- Pulls deal status, buyer profile, score breakdown, transcript history, open tasks, outreach timeline
- All data fetched in parallel (< 8s total)
- Structured in scannable format with bold headers
- Highlights overdue items and action items from previous calls
- Suggests talking points based on buyer concerns from transcripts

### US-23: Draft Outreach Email
**As a** business development lead, **I want to** say "draft outreach to Tier A buyers for the new HVAC deal" **so that** I get personalized email drafts I can review and send.

**Acceptance Criteria:**
- Identifies Tier A buyers from scoring engine
- Each draft personalized to buyer's thesis, geography, and target criteria
- References specific deal metrics that align with buyer's profile
- User can edit, approve, or regenerate each draft
- Option to queue as outreach sequence

### US-24: Move Deal Forward with Actions
**As a** deal manager, **I want to** say "move Acme Corp to Due Diligence and set up the DD tasks" **so that** the stage change and task creation happen in one step.

**Acceptance Criteria:**
- Confirms action before executing (shows what will change)
- Updates deal stage
- Creates standard DD task checklist (configurable template)
- Logs activity with reason
- Notifies deal team

### US-25: Generate Weekly Pipeline Report
**As a** managing director, **I want to** say "weekly pipeline report" **so that** I get a formatted summary ready for the team meeting.

**Acceptance Criteria:**
- Pipeline summary by stage with week-over-week comparison
- Deals that moved stages
- Attention items (stalled deals, overdue tasks, no-response buyers)
- Team activity comparison
- Key metrics (close rate, average stage duration, response rates)

### US-26: Proactive Deal Health Alert
**As a** deal manager, **I want the** system to alert me when a deal is showing warning signs **so that** I can intervene before it goes cold.

**Acceptance Criteria:**
- Triggers when: stage duration > 2x average, activity velocity drops > 50%, buyer response time increases > 3x
- Alert appears in chat panel as a notification
- Includes specific data driving the alert
- Suggests concrete actions (not generic "check on it")
- User can dismiss or snooze alerts

### US-27: End-of-Day Recap
**As a** deal manager, **I want to** say "end of day recap" **so that** I can verify what I accomplished and know what carries to tomorrow.

**Acceptance Criteria:**
- Activities logged today
- Tasks completed vs. remaining
- Outreach sent and responses received
- Tomorrow's priorities and scheduled calls
- Any new items that appeared during the day (new leads, buyer responses)

---

## 8. Technical Considerations for Action Mode

### 8.1 Confirmation Framework

```typescript
interface ActionConfirmation {
  action_type: string;
  description: string;         // Human-readable description of what will happen
  affected_entities: string[];  // Deal names, buyer names, etc.
  reversible: boolean;
  risk_level: 'low' | 'medium' | 'high';
  requires_confirmation: boolean;
}

// Low risk (no confirmation): create task, add note, log activity
// Medium risk (confirm): update stage, reassign task, grant access
// High risk (confirm + warning): bulk operations, deal conversion, delete
```

### 8.2 Action Audit Trail

```sql
-- Extend ai_command_center_usage table
ALTER TABLE ai_command_center_usage ADD COLUMN actions_taken JSONB;
-- Actions format: [{ type: "create_task", entity: "deal_tasks", entity_id: "uuid", details: {...} }]

-- Or create dedicated action log
CREATE TABLE ai_command_center_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_id UUID REFERENCES ai_command_center_usage(id),
  user_id UUID REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id UUID,
  action_details JSONB,
  confirmation_required BOOLEAN,
  confirmed_at TIMESTAMPTZ,
  rolled_back BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 8.3 Action Rate Limiting

```typescript
const ACTION_LIMITS = {
  per_conversation: 10,    // Max 10 write actions per conversation
  per_hour: 50,            // Max 50 write actions per hour per user
  per_day: 200,            // Max 200 write actions per day per user
  bulk_threshold: 5,       // Actions affecting 5+ entities require extra confirmation
};
```

---

## 9. Success Metrics (Expanded)

| Metric | v1 (Intelligence) | v1.5 (Actions) | v2 (Generation) | v3 (Proactive) |
|--------|-------------------|----------------|-----------------|---------------|
| Time saved/user/day | 30-45 min | 45-65 min | 75-120 min | 90-150 min |
| Queries/user/day | 10-15 | 15-25 | 20-30 | 25-40 |
| Tasks created via chat | 0 | 5-10/user/day | 5-10/user/day | 5-10/user/day |
| Outreach emails drafted | 0 | 0 | 5-15/user/day | 5-15/user/day |
| Context switches saved | 5-10 | 10-15 | 15-25 | 20-30 |
| Deals with health alerts | 0 | 0 | 0 | 100% monitored |
| Meeting prep time | 15 min manual | 15 min manual | 10 seconds | 10 seconds |
| Stale deal detection | Manual review | Manual review | Manual review | Automatic alerts |

---

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-23 | AI/CTO | Initial expansion guide |
