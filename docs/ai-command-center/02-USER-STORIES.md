# SourceCo AI Command Center - User Stories & Acceptance Criteria

**Version:** 1.1
**Date:** 2026-02-23

---

## Story Map Overview

```
Epic 1: Deal Pipeline Intelligence
  |-- US-001: Query Active Deals
  |-- US-002: Deal Activity Summary
  |-- US-003: Stalled Deal Detection
  |-- US-004: Pipeline Stage Overview

Epic 2: Follow-Up Management
  |-- US-005: Follow-Up Identification
  |-- US-006: Overdue Task Surfacing
  |-- US-007: Buyer Response Tracking

Epic 3: Buyer Intelligence
  |-- US-008: Cross-Source Buyer Search
  |-- US-009: Buyer-Deal Fit Analysis
  |-- US-010: Buyer Profile Deep Dive

Epic 4: Meeting Intelligence
  |-- US-011: Transcript Query
  |-- US-012: Meeting Summary
  |-- US-013: Action Item Extraction

Epic 7: Action Mode (Write-Back)              ← NEW
  |-- US-021: Create Task from Conversation
  |-- US-022: Log Deal Notes via Chat
  |-- US-023: Update Deal Stage via Chat
  |-- US-024: Grant Data Room Access via Chat

Epic 8: Content Generation                     ← NEW
  |-- US-025: Meeting Preparation Brief
  |-- US-026: Draft Outreach Emails
  |-- US-027: Generate Weekly Pipeline Report
  |-- US-028: End-of-Day / End-of-Week Recap

Epic 9: Proactive Operations                   ← NEW
  |-- US-029: Deal Health Alerts
  |-- US-030: Smart Lead-to-Buyer Match Alerts
  |-- US-031: Data Quality Monitoring
  |-- US-032: Buyer Conflict Detection

Epic 5: Proactive Intelligence
  |-- US-014: Daily Briefing
  |-- US-015: Stale Deal Alerts
  |-- US-016: New Lead Matching

Epic 6: Conversational UX
  |-- US-017: Persistent Chat Interface
  |-- US-018: Conversation History
  |-- US-019: Context-Aware Follow-Ups
  |-- US-020: Feedback System
```

---

## Epic 1: Deal Pipeline Intelligence

### US-001: Query Active Deals

**As a** deal manager,
**I want to** ask "What are my most active deals?" in natural language,
**So that** I can quickly prioritize my day without checking multiple pages.

**Priority:** P0
**Story Points:** 8

**Acceptance Criteria:**

1. **Given** I am an authenticated admin user,
   **When** I type "What are my most active deals?",
   **Then** the system returns deals assigned to me, ordered by recent activity count (deal_activities in last 7 days).

2. **Given** I am an admin with 12 active deals,
   **When** I ask about my active deals,
   **Then** the response includes: deal name, current stage, last activity date, and activity count for each deal.

3. **Given** I ask "What are the most active deals?" (without "my"),
   **When** the system processes the query,
   **Then** it returns all team deals ordered by activity, not just mine.

4. **Given** I ask a follow-up "Tell me more about the first one",
   **When** the system processes the follow-up,
   **Then** it correctly resolves "the first one" to the top deal from the previous response.

5. **Given** there are no active deals assigned to me,
   **When** I ask about my active deals,
   **Then** the response clearly states "You don't have any active deals currently" rather than returning empty results.

**Technical Notes:**
- Tool: `query_deals` with filters: `owner_id = current_user.id`, `status = 'active'`, ordered by activity count
- Activity scoring: count of `deal_activities` in last 7 days + weighted by activity type
- Must resolve "my" to current user's profile ID

---

### US-002: Deal Activity Summary

**As a** deal manager,
**I want to** ask "What happened on the Acme Corp deal this week?",
**So that** I can catch up on deal progress without reading through activity logs.

**Priority:** P0
**Story Points:** 5

**Acceptance Criteria:**

1. **Given** I reference a deal by company name,
   **When** the system processes the query,
   **Then** it resolves the name to the correct `listings.internal_company_name` or `listings.title` (fuzzy match).

2. **Given** the deal had 8 activities this week,
   **When** I ask what happened,
   **Then** the response summarizes activities grouped by type (stage changes, notes, comments, tasks, outreach) in chronological order.

3. **Given** there are call transcripts from this week,
   **When** I ask what happened,
   **Then** the response includes key insights from recent transcripts, including CEO detection and key quotes.

4. **Given** the deal name is ambiguous (multiple matches),
   **When** the system processes the query,
   **Then** it asks for clarification: "I found 2 deals matching 'Acme': Acme Corp (D-0042) and Acme Services (D-0087). Which one?"

5. **Given** no activity occurred this week,
   **When** I ask what happened,
   **Then** the response states "No activity recorded for [Deal] this week" and suggests checking the last activity date.

**Technical Notes:**
- Tools: `search_deals` (name resolution) + `get_deal_activities` (activity log) + `search_transcripts` (meeting data)
- Time parsing: "this week" = Monday of current week to now
- Fuzzy matching on `internal_company_name`, `title`, and `deal_identifier`

---

### US-003: Stalled Deal Detection

**As a** team lead,
**I want to** ask "Which deals are stalled?",
**So that** I can identify deals that need intervention.

**Priority:** P1
**Story Points:** 5

**Acceptance Criteria:**

1. **Given** deals exist with no activity in 14+ days,
   **When** I ask about stalled deals,
   **Then** the system returns deals ordered by days since last activity, with stage name and owner.

2. **Given** I ask "Which deals are stalled in due diligence?",
   **When** the system processes the query,
   **Then** it filters to only deals in the "Due Diligence" stage (fuzzy match on stage name).

3. **Given** I ask "Are any of my deals at risk?",
   **When** the system processes the query,
   **Then** it identifies deals with: no activity in 7+ days, overdue tasks, or negative sentiment in recent transcripts.

**Technical Notes:**
- Stalled threshold: configurable, default 14 days with no `deal_activities` entry
- "At risk" is a composite signal: inactivity + overdue tasks + stage duration exceeding average

---

### US-004: Pipeline Stage Overview

**As a** team lead,
**I want to** ask "Show me the pipeline" or "How many deals are in each stage?",
**So that** I get a quick pipeline health check.

**Priority:** P1
**Story Points:** 3

**Acceptance Criteria:**

1. **Given** deals exist across multiple stages,
   **When** I ask for a pipeline overview,
   **Then** the response shows deal count per stage in pipeline order, with total pipeline value (sum of listing revenue/ebitda).

2. **Given** I ask "How does this compare to last month?",
   **When** the system processes the follow-up,
   **Then** it shows month-over-month changes in deal count per stage.

---

## Epic 2: Follow-Up Management

### US-005: Follow-Up Identification

**As a** deal manager,
**I want to** ask "Who do I need to follow up with?",
**So that** I never miss a critical follow-up.

**Priority:** P0
**Story Points:** 8

**Acceptance Criteria:**

1. **Given** I have deals with pending follow-ups,
   **When** I ask who needs follow-up,
   **Then** the system returns a prioritized list combining:
   - Overdue deal tasks assigned to me
   - Buyers who received outreach 7+ days ago with no response
   - Deals with no activity in 7+ days where I'm the owner
   - Action items from recent meetings (Fireflies)

2. **Given** results come from multiple sources,
   **When** the response is generated,
   **Then** each item includes: contact name, company, reason for follow-up, days since last contact, and suggested action.

3. **Given** I ask "Who should I call today?",
   **When** the system processes the query,
   **Then** it prioritizes by urgency (overdue first, then aging, then routine) and limits to top 10.

4. **Given** a buyer responded to outreach yesterday,
   **When** I ask who needs follow-up,
   **Then** that buyer is NOT included (recent response removes them from follow-up list).

**Technical Notes:**
- Combines `deal_tasks` (assigned_to = me, status = pending, due_date <= today) + `outreach_records` (no response in 7+ days) + `deal_activities` (gap detection) + Fireflies action items
- Priority scoring: overdue tasks (10), no-response outreach 14+ days (8), no-response 7-14 days (5), inactive deals (3)

---

### US-006: Overdue Task Surfacing

**As a** deal manager,
**I want to** ask "What are my overdue tasks?",
**So that** I can address missed deadlines.

**Priority:** P0
**Story Points:** 3

**Acceptance Criteria:**

1. **Given** I have 5 overdue tasks across 3 deals,
   **When** I ask about overdue tasks,
   **Then** the response lists each task with: task title, deal name, due date, days overdue, grouped by deal.

2. **Given** I ask "What tasks are due this week?",
   **When** the system processes the query,
   **Then** it returns all tasks with due_date between now and end of week, both mine and unassigned.

---

### US-007: Buyer Response Tracking

**As a** business development manager,
**I want to** ask "Which buyers haven't responded to our outreach?",
**So that** I can escalate or change approach.

**Priority:** P1
**Story Points:** 5

**Acceptance Criteria:**

1. **Given** outreach was sent to 50 buyers for a deal,
   **When** I ask about non-responders,
   **Then** the response groups by time since outreach: 1-7 days (waiting), 7-14 days (follow-up needed), 14+ days (escalate).

2. **Given** I ask "Who responded positively to the Acme Corp outreach?",
   **When** the system processes the query,
   **Then** it returns buyers whose outreach status indicates positive response, with details of their reply.

---

## Epic 3: Buyer Intelligence

### US-008: Cross-Source Buyer Search

**As a** business development manager,
**I want to** ask "Do we have any deals in the lead sources that do HVAC in Florida?",
**So that** I can find relevant opportunities across all data sources.

**Priority:** P0
**Story Points:** 13

**Acceptance Criteria:**

1. **Given** HVAC-related entries exist across multiple sources,
   **When** I ask the query,
   **Then** the system searches across ALL sources: `remarketing_buyers`, `profiles`, `inbound_leads`, `valuation_leads`, `industry_trackers`, and `listings`.

2. **Given** results span 3 different data sources,
   **When** the response is generated,
   **Then** each result includes: company name, source system, relevance indicator, and key details (revenue, location, services).

3. **Given** I ask for "HVAC" but buyers are tagged as "heating and cooling" or "mechanical services",
   **When** the system processes the query,
   **Then** it performs semantic matching, not just exact keyword match (service taxonomy expansion).

4. **Given** 0 results in Florida specifically,
   **When** the system returns results,
   **Then** it suggests nearby states: "No HVAC deals in Florida, but I found 3 in Georgia and 2 in Alabama."

5. **Given** results are found,
   **When** I ask "Tell me more about the first one",
   **Then** the system provides full buyer/deal profile including scores, contacts, and recent activity.

**Technical Notes:**
- Multi-tool query: `search_buyers_by_criteria` + `search_leads` + `search_listings` + `search_trackers`
- Service matching: expand "HVAC" to include related terms via a service taxonomy
- Geographic matching: use state codes + geographic_footprint arrays + adjacency expansion

---

### US-009: Buyer-Deal Fit Analysis

**As an** analyst,
**I want to** ask "Why is Summit Capital a bad fit for this deal?",
**So that** I can understand scoring decisions and explain them to the team.

**Priority:** P0
**Story Points:** 5

**Acceptance Criteria:**

1. **Given** a buyer-deal score exists,
   **When** I ask about fit,
   **Then** the response includes: composite score, all dimension scores (geography, size, service), tier, fit_reasoning, and pass_reason if applicable.

2. **Given** the buyer has deal_breakers defined,
   **When** I ask about fit,
   **Then** the response explicitly cites applicable deal breakers.

3. **Given** the buyer has strategic_priorities defined,
   **When** I ask about fit,
   **Then** the response explains how the deal aligns or conflicts with those priorities.

4. **Given** transcript data exists for this buyer,
   **When** I ask about fit,
   **Then** the response references relevant quotes from buyer calls about their acquisition criteria.

---

### US-010: Buyer Profile Deep Dive

**As a** deal manager,
**I want to** ask "Tell me everything about Greenfield Partners",
**So that** I get a comprehensive buyer profile without visiting multiple pages.

**Priority:** P1
**Story Points:** 5

**Acceptance Criteria:**

1. **Given** the buyer exists in the system,
   **When** I ask for a comprehensive profile,
   **Then** the response includes: company overview, PE firm (if applicable), headquarters, geographic footprint, target criteria (revenue/EBITDA/services/geography), acquisition history, deal breakers, strategic priorities, data completeness, and primary contacts.

2. **Given** the buyer has been scored against active deals,
   **When** I ask for their profile,
   **Then** the response includes: top 5 deal matches with scores and tiers.

3. **Given** there are call transcripts involving this buyer,
   **When** I ask for their profile,
   **Then** the response includes: summary of recent call insights and key quotes.

4. **Given** outreach history exists,
   **When** I ask for their profile,
   **Then** the response includes: outreach timeline (dates, channels, responses).

---

## Epic 4: Meeting Intelligence

### US-011: Transcript Query

**As a** deal manager,
**I want to** ask "What did the CEO say about timing in the last call?",
**So that** I can recall specific meeting details without re-reading entire transcripts.

**Priority:** P0
**Story Points:** 8

**Acceptance Criteria:**

1. **Given** transcripts exist for the deal in context,
   **When** I ask about specific content,
   **Then** the system searches transcript text and extracted_insights for relevant content.

2. **Given** the CEO was detected in a transcript,
   **When** I ask about CEO statements,
   **Then** the response filters to transcripts where `ceo_detected = true` and quotes relevant CEO statements.

3. **Given** I ask about a topic (e.g., "pricing", "timeline"),
   **When** the system processes the query,
   **Then** it searches across all transcript key_quotes and extracted_insights for that topic.

4. **Given** no transcripts exist for the deal,
   **When** I ask about transcript content,
   **Then** the response explicitly states: "No call transcripts are available for this deal. Would you like me to check Fireflies for meeting recordings?"

5. **Given** Fireflies has a relevant meeting not yet synced to local transcripts,
   **When** I ask about meetings,
   **Then** the system can query Fireflies API directly as a fallback.

**Technical Notes:**
- Tools: `search_transcripts` (local) + `search_fireflies` (API fallback)
- Keyword extraction from user query for transcript search
- CEO detection uses `ceo_detected` boolean field

---

### US-012: Meeting Summary

**As a** deal manager,
**I want to** ask "Summarize my meeting with John from Summit Capital",
**So that** I get a quick recap without re-reading the full transcript.

**Priority:** P1
**Story Points:** 5

**Acceptance Criteria:**

1. **Given** a meeting transcript exists with the referenced participant,
   **When** I ask for a summary,
   **Then** the response includes: date, duration, participants, key topics discussed, decisions made, and action items.

2. **Given** multiple meetings match the query,
   **When** the system processes the request,
   **Then** it asks for clarification or summarizes the most recent by default with a note about other meetings.

---

### US-013: Action Item Extraction

**As a** deal manager,
**I want to** ask "What action items came out of my meetings this week?",
**So that** I can ensure nothing falls through the cracks.

**Priority:** P1
**Story Points:** 5

**Acceptance Criteria:**

1. **Given** Fireflies meetings occurred this week with action items,
   **When** I ask about action items,
   **Then** the response lists each action item with: meeting name, assigned to (if identifiable), due date (if mentioned), and status.

2. **Given** action items overlap with existing deal_tasks,
   **When** the response is generated,
   **Then** it cross-references and notes which action items already have corresponding tasks in the system.

---

## Epic 5: Proactive Intelligence

### US-014: Daily Briefing

**As a** deal manager,
**I want to** ask "Give me my morning briefing" or have it generated automatically,
**So that** I start my day knowing exactly what needs attention.

**Priority:** P1
**Story Points:** 8

**Acceptance Criteria:**

1. **Given** I ask for my briefing,
   **When** the system generates it,
   **Then** the response includes sections for:
   - **Pipeline Snapshot:** Active deal count, deals by stage, total pipeline value
   - **Today's Priorities:** Overdue tasks, deals needing follow-up, upcoming meetings
   - **New Activity:** Overnight changes (new connection requests, buyer responses, score changes)
   - **Stale Alerts:** Deals with no activity in 7+ days

2. **Given** it's Monday morning,
   **When** I ask for my briefing,
   **Then** it includes a weekend recap section with any activity that occurred over the weekend.

3. **Given** a new high-tier buyer match was found overnight,
   **When** the briefing is generated,
   **Then** it highlights the new match with score and key details.

---

### US-015: Stale Deal Alerts

**As a** team lead,
**I want** the system to proactively flag stale deals,
**So that** no deal falls through the cracks.

**Priority:** P2
**Story Points:** 5

**Acceptance Criteria:**

1. **Given** a deal has no `deal_activities` in 14+ days,
   **When** the alert check runs,
   **Then** it flags the deal with: name, owner, days since last activity, current stage.

2. **Given** I ask "Are there any stale deals?",
   **When** the system responds,
   **Then** it lists all deals exceeding the inactivity threshold, grouped by owner.

---

### US-016: New Lead Matching

**As a** business development manager,
**I want** the system to alert me when new leads match my active deal criteria,
**So that** I can act on opportunities immediately.

**Priority:** P2
**Story Points:** 5

**Acceptance Criteria:**

1. **Given** a new inbound lead arrives matching an active deal's industry and geography,
   **When** the match is detected,
   **Then** the system can surface it when asked: "Any new leads that match my deals?"

2. **Given** I ask about new leads,
   **When** the response is generated,
   **Then** each match includes: lead company, source, matching deal(s), and key match criteria.

---

## Epic 6: Conversational UX

### US-017: Persistent Chat Interface

**As an** admin user,
**I want** a chat panel accessible from every admin page,
**So that** I can ask questions without leaving my current workflow.

**Priority:** P0
**Story Points:** 8

**Acceptance Criteria:**

1. **Given** I am on any admin page,
   **When** I click the chat icon or press a keyboard shortcut (Cmd+K or Ctrl+K),
   **Then** a chat panel opens (sliding panel from right side).

2. **Given** the chat panel is open,
   **When** I navigate to a different admin page,
   **Then** the chat panel persists with the current conversation intact.

3. **Given** I am viewing a specific deal page,
   **When** I open the chat,
   **Then** the chat automatically has context about that deal (pre-populated context).

4. **Given** the chat is open on mobile-width screens,
   **When** it renders,
   **Then** it takes full width as an overlay with a close button.

---

### US-018: Conversation History

**As an** admin user,
**I want to** access my previous conversations,
**So that** I can reference past analyses.

**Priority:** P1
**Story Points:** 5

**Acceptance Criteria:**

1. **Given** I have 20 previous conversations,
   **When** I open the conversation history panel,
   **Then** I see conversations listed by date, title (auto-generated from first query), and context type.

2. **Given** I click on a previous conversation,
   **When** it loads,
   **Then** all previous messages are displayed and I can continue the conversation.

3. **Given** I want to search history,
   **When** I type in the search bar,
   **Then** it searches across all conversation messages for matching text.

---

### US-019: Context-Aware Follow-Ups

**As an** admin user,
**I want to** ask follow-up questions without repeating context,
**So that** conversations feel natural.

**Priority:** P0
**Story Points:** 5

**Acceptance Criteria:**

1. **Given** I asked "Who are the top buyers for ABC Plumbing?" and got a response,
   **When** I ask "What about the second one's acquisition history?",
   **Then** the system resolves "the second one" to the second buyer from the previous response.

2. **Given** I'm in a deal-specific context,
   **When** I ask "What's the score breakdown?",
   **Then** the system uses the current deal context without requiring me to specify which deal.

3. **Given** a conversation has 15 messages,
   **When** I ask a follow-up,
   **Then** the system retains enough context to understand references to earlier messages.

---

### US-020: Feedback System

**As an** admin user,
**I want to** rate responses and provide feedback,
**So that** the system improves over time.

**Priority:** P1
**Story Points:** 3

**Acceptance Criteria:**

1. **Given** I receive an AI response,
   **When** I hover over the message,
   **Then** I see thumbs up/thumbs down buttons.

2. **Given** I click thumbs down,
   **When** the feedback modal appears,
   **Then** I can select a reason (incorrect data, incomplete, unhelpful, hallucinated) and optionally add a comment.

3. **Given** feedback is submitted,
   **When** it is recorded,
   **Then** it stores: user_id, conversation_id, message_index, rating, feedback_type, comment, and timestamp.

---

---

## Epic 7: Action Mode (Write-Back) — NEW

### US-021: Create Task from Conversation (5 points)

**As a** deal manager, **I want to** say "remind me to send financials to Summit Capital by Friday" in the chat **so that** a task is created without leaving the conversation.

**Acceptance Criteria:**

1. **Given** I say "remind me to [X]" or "create a task to [X]",
   **When** the AI processes my request,
   **Then** it creates a task on the appropriate deal with the correct title, due date, and assignment.

2. **Given** I use natural language dates ("next Friday", "in 3 days", "end of month"),
   **When** the AI interprets the date,
   **Then** it resolves to the correct calendar date and shows the resolved date in the confirmation.

3. **Given** no deal is specified but I'm on a deal page or discussing a deal,
   **When** the AI creates the task,
   **Then** it links the task to the contextual deal and confirms: "Task created on **Acme Corp**: Send financials — due Feb 28."

4. **Given** the task is created,
   **When** I view the deal's task list,
   **Then** the task appears with `source: ai_command_center` in the activity log.

### US-022: Log Deal Notes via Chat (3 points)

**As a** deal manager, **I want to** say "note that the seller wants to close by Q2" **so that** the insight is logged to the deal without navigating away.

**Acceptance Criteria:**

1. **Given** I say "note that...", "remember that...", or "log that...",
   **When** the AI processes my request,
   **Then** it creates a note on the contextual or specified deal.

2. **Given** the note is created,
   **When** I view the deal notes,
   **Then** the note appears with attribution: "Added via AI Command Center by [my name]."

### US-023: Update Deal Stage via Chat (5 points)

**As a** deal manager, **I want to** say "move Acme Corp to Due Diligence" **so that** the stage is updated without navigating to the pipeline board.

**Acceptance Criteria:**

1. **Given** I request a stage change,
   **When** the AI prepares the action,
   **Then** it shows a confirmation: "Move **Acme Corp** from **LOI** → **Due Diligence**? [Confirm] [Cancel]"

2. **Given** I confirm the action,
   **When** the stage is updated,
   **Then** an activity is logged: "Stage changed to Due Diligence (via AI Command Center)."

3. **Given** I say "advance this deal" without specifying a stage,
   **When** the AI processes the request,
   **Then** it suggests the next logical stage based on the current stage.

### US-024: Grant Data Room Access via Chat (5 points)

**As a** deal manager, **I want to** say "give Summit Capital access to the Acme Corp teaser" **so that** document access is granted in one sentence.

**Acceptance Criteria:**

1. **Given** I request data room access for a buyer,
   **When** the AI prepares the action,
   **Then** it confirms: "Grant **Summit Capital** access to **teaser** for **Acme Corp**? [Confirm]"

2. **Given** I confirm,
   **When** access is granted,
   **Then** it leverages the existing `data-room-access` edge function and logs the action.

---

## Epic 8: Content Generation — NEW

### US-025: Meeting Preparation Brief (8 points)

**As a** deal manager, **I want to** say "prepare me for my meeting with Summit Capital about Acme Corp" **so that** I get a comprehensive brief in 10 seconds instead of 15 minutes of manual research.

**Acceptance Criteria:**

1. **Given** I request a meeting prep,
   **When** the AI generates the brief,
   **Then** it includes: deal status, buyer profile, composite score + breakdown, transcript highlights from previous calls, open tasks, outreach timeline, and suggested talking points.

2. **Given** all data sources are queried in parallel,
   **When** the response is streamed,
   **Then** the full brief is delivered in < 10 seconds.

3. **Given** there are overdue action items from previous meetings,
   **When** the brief is generated,
   **Then** overdue items are highlighted with a warning indicator.

4. **Given** the previous meeting transcript mentions buyer concerns,
   **When** talking points are generated,
   **Then** they specifically address those concerns with data from the deal.

### US-026: Draft Outreach Emails (8 points)

**As a** business development lead, **I want to** say "draft outreach to Tier A buyers for the Acme Corp deal" **so that** I get personalized email drafts I can review and send.

**Acceptance Criteria:**

1. **Given** I request outreach drafts,
   **When** the AI identifies matching buyers,
   **Then** each draft is personalized to the buyer's thesis, target geography, and revenue criteria.

2. **Given** a draft is generated,
   **When** I review it,
   **Then** I can approve, edit, or regenerate each draft individually.

3. **Given** the existing `draft-outreach-email` edge function,
   **When** the AI generates drafts,
   **Then** it leverages the existing function's personalization logic enhanced with deal-specific context.

### US-027: Generate Weekly Pipeline Report (5 points)

**As a** managing director, **I want to** say "weekly pipeline report" **so that** I get a formatted summary ready for the team meeting.

**Acceptance Criteria:**

1. **Given** I request a pipeline report,
   **When** the AI generates it,
   **Then** it includes: pipeline summary by stage (with week-over-week delta), deals that moved stages, attention items (stalled deals, overdue tasks, no-response buyers), team activity comparison, and key metrics.

2. **Given** the report is generated,
   **When** I want to share it,
   **Then** the report is formatted in clean markdown suitable for copy-paste into Slack or email.

### US-028: End-of-Day / End-of-Week Recap (5 points)

**As a** deal manager, **I want to** say "end of day recap" **so that** I can verify what I accomplished and plan for tomorrow.

**Acceptance Criteria:**

1. **Given** I request a recap,
   **When** the AI generates it,
   **Then** it includes: activities logged today, tasks completed vs. remaining, outreach sent and responses received, and tomorrow's priorities.

2. **Given** it's Friday,
   **When** I request a recap,
   **Then** it automatically generates a weekly recap with wins, carry-overs, and next-week preview.

---

## Epic 9: Proactive Operations — NEW

### US-029: Deal Health Alerts (8 points)

**As a** deal manager, **I want the** system to alert me when a deal shows warning signs **so that** I can intervene before it goes cold.

**Acceptance Criteria:**

1. **Given** a deal's stage duration exceeds 2x the average for that stage,
   **When** the system detects this,
   **Then** an alert appears in the chat panel with specific data and suggested actions.

2. **Given** a deal's weekly activity count drops by more than 50%,
   **When** the system detects the decline,
   **Then** it surfaces a velocity warning with comparison data.

3. **Given** a key buyer hasn't responded to outreach in > 2 weeks,
   **When** the system detects no response,
   **Then** it suggests escalation options (re-send, call, different contact).

### US-030: Smart Lead-to-Buyer Match Alerts (5 points)

**As a** business development lead, **I want the** system to alert me when new leads match active deal criteria or buyer profiles **so that** I don't miss acquisition opportunities.

**Acceptance Criteria:**

1. **Given** a new lead is imported into the system,
   **When** it matches criteria for active deals or remarketing buyers,
   **Then** a notification appears in the chat panel identifying the matches.

2. **Given** the alert fires,
   **When** I view it,
   **Then** it shows the estimated score and lets me take immediate action: "Score this lead" or "Draft outreach."

### US-031: Data Quality Monitoring (5 points)

**As an** operations manager, **I want to** ask "how's our data quality?" **so that** I can identify and fix data gaps that degrade scoring and matching accuracy.

**Acceptance Criteria:**

1. **Given** I ask about data quality,
   **When** the AI analyzes the database,
   **Then** it reports: buyer profile completeness distribution, deals missing key data, transcripts not synced from Fireflies, and stale enrichment data.

2. **Given** issues are identified,
   **When** the report is shown,
   **Then** each issue includes a suggested action: "Queue enrichment for 312 low-completeness buyers."

### US-032: Buyer Conflict Detection (5 points)

**As a** deal manager, **I want to** say "show buyer conflicts" **so that** I know which buyers are being pitched competing deals.

**Acceptance Criteria:**

1. **Given** I request buyer conflict analysis,
   **When** the AI cross-references buyers across active deals,
   **Then** it identifies buyers active on multiple deals with potential geographic or industry conflicts.

2. **Given** a conflict is detected,
   **When** it's displayed,
   **Then** it shows the specific overlap (same industry, same geography) and suggests strategy adjustments.

---

## Story Point Summary

| Epic | Stories | Total Points |
|------|---------|-------------|
| Deal Pipeline Intelligence | 4 | 21 |
| Follow-Up Management | 3 | 16 |
| Buyer Intelligence | 3 | 23 |
| Meeting Intelligence | 3 | 18 |
| Proactive Intelligence | 3 | 18 |
| Conversational UX | 4 | 21 |
| **Action Mode (Write-Back)** | **4** | **18** |
| **Content Generation** | **4** | **26** |
| **Proactive Operations** | **4** | **23** |
| **Total** | **32** | **184** |

## Priority Matrix

| Priority | Stories | Points |
|----------|---------|--------|
| P0 (Must Have) | US-001, 002, 005, 006, 008, 009, 011, 017, 019 | 68 |
| P1 (Should Have) | US-003, 004, 007, 010, 012, 013, 014, 018, 020, **021, 022, 025** | 55 |
| P2 (Nice to Have) | US-015, 016, **023, 024, 026, 027, 028** | 43 |
| P3 (Future) | **029, 030, 031, 032** | 23 |
