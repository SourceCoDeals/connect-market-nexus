# SourceCo ↔ Phoneburner Integration Requirements
## Comprehensive Technical & Business Specification

**Document Version:** 1.0  
**Date:** February 23, 2026  
**Owner:** Tomos, SourceCo CEO  
**Status:** Requirements Definition

---

## Executive Summary

This integration connects SourceCo's M&A marketplace platform with Phoneburner's power dialer to enable:
1. **Bidirectional list management** - Push buyer/seller lists from SourceCo → Phoneburner
2. **Real-time call tracking** - Capture all calling activity back into SourceCo remarketing system
3. **Disposition intelligence** - Track contact attempts, outcomes, and next-action dates
4. **Team performance analytics** - Monitor rep activity, talk time, and conversion metrics

**Primary Goal:** Create institutional memory of every buyer/seller interaction to power intelligent remarketing sequences and prevent contact fatigue.

---

## Business Context

### Current State Pain Points
- Reps manually export lists from SourceCo and upload to Phoneburner
- No automated tracking of call outcomes in remarketing database
- Call dispositions live only in Phoneburner, not accessible for segmentation
- No way to prevent calling contacts who were reached yesterday
- Rep activity metrics scattered across systems

### Target State Vision
- One-click "Push to Dialer" from any SourceCo list view
- Automatic remarketing updates on every call (attempt, connection, outcome)
- Disposition-based workflow triggers (callback scheduled → auto-sequence)
- Unified contact timeline showing emails, calls, and platform activity
- Rep scorecards combining dialer metrics with deal close rates

---

## User Stories

### 1. List Management & Deployment

**US-001: Push Buyer List to Dialer**
> **As a** SourceCo BD rep  
> **I want to** push a filtered buyer list directly to Phoneburner  
> **So that** I can immediately start calling without manual CSV exports

**Acceptance Criteria:**
- ✓ "Push to Phoneburner" button visible on Buyers table view
- ✓ Rep selects target Phoneburner dial session (or creates new)
- ✓ System maps SourceCo contact fields → Phoneburner required fields
- ✓ List appears in Phoneburner within 60 seconds
- ✓ SourceCo logs the list push with contact count, session ID, timestamp

**Business Value:** Eliminates 10-15 min/day of manual list prep per rep × 8 reps = 1+ hour/day saved

---

**US-002: Push Seller List to Dialer**
> **As a** SourceCo deal originator  
> **I want to** push target acquisition lists to Phoneburner  
> **So that** I can systematically contact business owners about exit opportunities

**Acceptance Criteria:**
- ✓ Works from Sellers table, deal-specific contact lists, or custom segments
- ✓ Includes deal context fields (industry, EBITDA range, geography)
- ✓ Prevents duplicate adds if contact already in active Phoneburner session
- ✓ Option to add to existing session vs. create new campaign

---

**US-003: Smart List Filtering Pre-Push**
> **As a** team lead  
> **I want** the system to exclude recently contacted people  
> **So that** reps don't call the same buyer 3 times in one week

**Acceptance Criteria:**
- ✓ Pre-push validation checks last contact date in remarketing DB
- ✓ Excludes contacts reached in last 7 days (configurable threshold)
- ✓ Shows excluded count with reason ("23 contacts excluded - reached in last 5 days")
- ✓ Override option for urgent outreach

**Business Value:** Prevents contact fatigue, maintains professional reputation with PE firms

---

### 2. Call Activity Tracking

**US-004: Capture Every Dial Attempt**
> **As** the remarketing system  
> **I need to** log every call attempt via Phoneburner webhook  
> **So that** contact cadence logic can prevent over-dialing

**Acceptance Criteria:**
- ✓ Webhook fires on every dial (regardless of outcome)
- ✓ Captures: contact ID, rep ID, timestamp, outcome (no answer, busy, voicemail, connected)
- ✓ Creates activity record in remarketing `contact_activities` table
- ✓ Updates contact `last_contact_attempt` timestamp

---

**US-005: Track Conversation Outcomes**
> **As a** BD manager  
> **I want to** see which calls resulted in conversations vs. voicemails  
> **So that** I can measure rep connection rates and coach accordingly

**Acceptance Criteria:**
- ✓ Webhook distinguishes: no answer, busy, left voicemail, spoke to gatekeeper, spoke to decision-maker
- ✓ Talk time captured for connected calls
- ✓ Data flows to rep performance dashboard
- ✓ Aggregates by day/week/month for trending

**Business Value:** Enables data-driven coaching on call technique, timing, and messaging

---

**US-006: Capture Call Dispositions**
> **As a** BD rep  
> **I want** my Phoneburner dispositions to automatically update SourceCo contact status  
> **So that** I don't have to log outcomes in two systems

**Acceptance Criteria:**
- ✓ Rep selects disposition in Phoneburner (e.g., "Interested - Send Info", "Not a Fit", "Callback in 30 days")
- ✓ Webhook sends disposition code + notes to SourceCo
- ✓ SourceCo maps disposition → contact stage/status
- ✓ Notes append to contact timeline with rep name + timestamp

**Mapping Example:**
```
Phoneburner Disposition → SourceCo Action
"Interested - Send Info" → Status: Qualified, Trigger: Send intro email
"Callback in 30 days"    → Status: Nurture, Schedule: Remarket on [date]
"Not a Fit"              → Status: Disqualified, Reason: [notes]
"Wrong Number"           → Flag: Invalid, Suppress from future lists
```

---

**US-007: Schedule Callbacks**
> **As a** BD rep  
> **I want** scheduled callbacks to create tasks in SourceCo  
> **So that** I get reminded to follow up at the right time

**Acceptance Criteria:**
- ✓ "Callback scheduled" disposition includes target date/time
- ✓ SourceCo creates task assigned to rep
- ✓ Task appears in rep's daily agenda on scheduled date
- ✓ Optional: Auto-adds contact to Phoneburner session on callback date

---

### 3. Data Integrity & Sync

**US-008: Handle Contact Updates**
> **As** the system  
> **I need to** sync contact data changes bidirectionally  
> **So that** phone numbers, emails, and names stay current in both systems

**Acceptance Criteria:**
- ✓ If rep updates phone number in Phoneburner, webhook updates SourceCo record
- ✓ If contact updates email in SourceCo, API pushes to Phoneburner
- ✓ Conflict resolution: Most recent update wins (timestamp comparison)
- ✓ Audit log tracks all field changes with source system

---

**US-009: Prevent Duplicate Contacts**
> **As** the platform  
> **I want to** deduplicate contacts before pushing to Phoneburner  
> **So that** the same buyer doesn't appear in the dial session twice

**Acceptance Criteria:**
- ✓ Pre-push check matches on: phone number (primary), email, name + company
- ✓ If duplicate found in target session, skip or update existing record
- ✓ User notified: "12 duplicates merged, 88 new contacts added"

---

### 4. Reporting & Analytics

**US-010: Unified Contact Timeline**
> **As a** BD rep  
> **I want to** see all call history on the contact detail page  
> **So that** I know what was discussed before I dial again

**Acceptance Criteria:**
- ✓ Contact timeline shows: Date, Activity Type (Call), Outcome, Duration, Rep, Notes
- ✓ Sortable by date (most recent first)
- ✓ Filterable by activity type
- ✓ Links to Phoneburner call recording if available

**Example Timeline:**
```
[2026-02-23 10:45 AM] 📞 Call - Connected (3:42) - Tomos
  "Interested in NC-based auto body targets. Sending memo on current deal."
  
[2026-02-20 2:15 PM]  📞 Call - Voicemail (0:00) - Sarah
  "Left VM about collision repair platform deal"
  
[2026-02-18 9:30 AM]  📧 Email - Opened - System
  "Weekly deal digest - 3 new opportunities"
```

---

**US-011: Rep Performance Dashboard**
> **As a** BD manager  
> **I want to** see rep calling activity alongside email/platform metrics  
> **So that** I can identify coaching opportunities and top performers

**Metrics to Track:**
- Dials made (by day/week/month)
- Connection rate (% of dials that reach a person)
- Average talk time
- Dispositions breakdown (qualified vs. disqualified vs. nurture)
- Callbacks scheduled
- Deals sourced from calls (attribution)

---

**US-012: Campaign Performance Analysis**
> **As a** team lead  
> **I want to** compare effectiveness of buyer vs. seller calling campaigns  
> **So that** I can allocate rep time to highest-ROI activities

**Acceptance Criteria:**
- ✓ Campaign-level metrics: Total dials, connections, talk time, outcomes
- ✓ Segment by: Contact type (buyer/seller), list source, industry, geography
- ✓ Time-to-conversion tracking (first call → deal closed)
- ✓ ROI calculation (revenue attributed / rep hours invested)

---

## Functional Requirements

### F-001: List Push API Integration

**Direction:** SourceCo → Phoneburner  
**Trigger:** User clicks "Push to Phoneburner" button  
**API Endpoint:** `POST /v2/contacts/bulk` or `POST /v2/dial_sessions/{session_id}/contacts`

**Request Payload:**
```json
{
  "dial_session_id": "pb_session_12345",
  "contacts": [
    {
      "first_name": "John",
      "last_name": "Smith",
      "company": "Heritage Capital Partners",
      "phone": "+1-555-0123",
      "email": "jsmith@heritagecap.com",
      "custom_fields": {
        "sourceco_contact_id": "sc_buyer_789",
        "buyer_type": "PE Firm - Lower Middle Market",
        "aum": "$500M",
        "target_sectors": "Business Services, Healthcare",
        "last_contact_date": "2026-01-15",
        "contact_source": "SourceCo Remarketing"
      }
    }
  ],
  "session_name": "PE Buyers - Feb 2026 Outreach",
  "callback_url": "https://sourceco.com/api/webhooks/phoneburner"
}
```

**Response Handling:**
```json
{
  "success": true,
  "session_id": "pb_session_12345",
  "contacts_added": 88,
  "contacts_updated": 12,
  "contacts_failed": 0,
  "errors": []
}
```

**Error Cases:**
- Invalid phone number format → Skip contact, log warning
- Duplicate in session → Update existing record
- Session not found → Create new session automatically
- Rate limit exceeded → Queue for retry with exponential backoff

---

### F-002: Webhook Event Ingestion

**Direction:** Phoneburner → SourceCo  
**Trigger:** Call events occur in Phoneburner  
**Webhook URL:** `https://sourceco.com/api/webhooks/phoneburner/events`

**Webhook Authentication:**
- Phoneburner signs requests with HMAC-SHA256
- SourceCo validates signature using shared secret
- Reject unsigned or invalid signature requests

**Event Types to Subscribe:**

#### 1. Call Started
```json
{
  "event": "call.started",
  "timestamp": "2026-02-23T10:45:00Z",
  "contact": {
    "id": "pb_contact_456",
    "phone": "+1-555-0123",
    "custom_fields": {
      "sourceco_contact_id": "sc_buyer_789"
    }
  },
  "user": {
    "id": "pb_user_10",
    "name": "Sarah Johnson",
    "email": "sarah@sourceco.com"
  },
  "dial_session": {
    "id": "pb_session_12345",
    "name": "PE Buyers - Feb 2026"
  }
}
```

**SourceCo Action:**
- Create activity record: `type: call_attempt`, `status: dialing`
- Update contact: `last_contact_attempt: [timestamp]`

---

#### 2. Call Connected
```json
{
  "event": "call.connected",
  "timestamp": "2026-02-23T10:45:12Z",
  "contact_id": "pb_contact_456",
  "duration": 0,
  "answered_by": "decision_maker", // or "gatekeeper", "voicemail"
  "sourceco_contact_id": "sc_buyer_789"
}
```

**SourceCo Action:**
- Update activity: `status: connected`, `connected_at: [timestamp]`
- Increment contact: `total_calls_connected: +1`

---

#### 3. Call Ended
```json
{
  "event": "call.ended",
  "timestamp": "2026-02-23T10:48:54Z",
  "contact_id": "pb_contact_456",
  "duration": 222, // seconds
  "outcome": "completed",
  "recording_url": "https://phoneburner.com/recordings/abc123",
  "sourceco_contact_id": "sc_buyer_789"
}
```

**SourceCo Action:**
- Update activity: `status: completed`, `duration: 222`, `ended_at: [timestamp]`
- Update contact: `last_call_date: [date]`, `total_call_duration: +222`

---

#### 4. Disposition Set
```json
{
  "event": "disposition.set",
  "timestamp": "2026-02-23T10:49:05Z",
  "contact_id": "pb_contact_456",
  "disposition": {
    "code": "INTERESTED_SEND_INFO",
    "label": "Interested - Send Information",
    "notes": "Wants memo on current collision repair deal. Follow up Friday.",
    "callback_date": null
  },
  "user_id": "pb_user_10",
  "sourceco_contact_id": "sc_buyer_789"
}
```

**SourceCo Action:**
- Update activity: `disposition: INTERESTED_SEND_INFO`, `notes: [text]`
- Update contact: `status: Qualified`, `stage: Engaged`
- Trigger workflow: Send deal memo email
- Create task: "Follow up with John Smith - Friday"

---

#### 5. Callback Scheduled
```json
{
  "event": "callback.scheduled",
  "timestamp": "2026-02-23T10:49:05Z",
  "contact_id": "pb_contact_456",
  "callback_date": "2026-03-25T14:00:00Z",
  "callback_notes": "Call back after Q1 board meeting",
  "assigned_user_id": "pb_user_10",
  "sourceco_contact_id": "sc_buyer_789"
}
```

**SourceCo Action:**
- Create task: Assigned to Sarah, Due: 2026-03-25 2:00 PM
- Update contact: `next_action_date: 2026-03-25`, `next_action: Call - Post Board Meeting`
- Schedule: Auto-add to Phoneburner session on 2026-03-25 (optional)

---

#### 6. Contact Updated
```json
{
  "event": "contact.updated",
  "timestamp": "2026-02-23T11:05:00Z",
  "contact_id": "pb_contact_456",
  "changes": {
    "phone": {
      "old": "+1-555-0123",
      "new": "+1-555-9999"
    },
    "email": {
      "old": "jsmith@heritagecap.com",
      "new": "john.smith@heritagecap.com"
    }
  },
  "updated_by": "pb_user_10",
  "sourceco_contact_id": "sc_buyer_789"
}
```

**SourceCo Action:**
- Update contact fields: `phone`, `email`
- Log change history: User, timestamp, old/new values
- Flag for review if email domain changed (potential company change)

---

### F-003: Disposition Mapping Engine

**Purpose:** Translate Phoneburner dispositions → SourceCo contact states + workflow triggers

**Mapping Table:**

| Phoneburner Disposition | SourceCo Status | Stage | Next Action | Workflow Trigger |
|-------------------------|-----------------|-------|-------------|------------------|
| Interested - Send Info | Qualified | Engaged | Send Materials | Email: Deal memo |
| Request Callback | Nurture | Follow-up | Call on [date] | Task: Callback |
| Not Interested | Disqualified | Dead | None | Suppress: 365 days |
| Wrong Number | Invalid | Dead | None | Flag: Bad data |
| Left Voicemail | Attempted | Outreach | Call again in 3 days | Schedule: Retry |
| Spoke to Gatekeeper | Attempted | Outreach | Call back, ask for DM | Note: Gatekeeper name |
| Do Not Call | Suppressed | Dead | None | Global suppress |
| Meeting Scheduled | Qualified | Meeting Set | Prep materials | Calendar: Create event |
| Bad Timing - Follow Up [X] | Nurture | Paused | Remarket on [date] | Schedule: Future campaign |

**Implementation:**
```python
# Pseudo-code
def process_disposition(disposition_code, contact_id, notes, callback_date):
    mapping = DISPOSITION_MAPPINGS[disposition_code]
    
    # Update contact
    update_contact(
        contact_id,
        status=mapping.status,
        stage=mapping.stage,
        next_action=mapping.next_action,
        next_action_date=callback_date or calculate_next_action_date(mapping)
    )
    
    # Trigger workflows
    if mapping.workflow_trigger:
        trigger_workflow(mapping.workflow_trigger, contact_id)
    
    # Create tasks
    if mapping.creates_task:
        create_task(
            assigned_to=get_contact_owner(contact_id),
            due_date=callback_date,
            title=f"{mapping.next_action} - {get_contact_name(contact_id)}",
            notes=notes
        )
    
    # Log activity
    log_activity(
        contact_id=contact_id,
        type='disposition_set',
        disposition=disposition_code,
        notes=notes,
        timestamp=now()
    )
```

---

### F-004: Smart List Filtering

**Pre-Push Validation Rules:**

1. **Recently Contacted Exclusion**
   - Exclude contacts with `last_call_date` within last 7 days
   - Configurable threshold per list type (buyers: 7 days, sellers: 14 days)
   - Override option: "Include all contacts (urgent campaign)"

2. **Suppression List Check**
   - Exclude contacts with `do_not_call: true`
   - Exclude contacts with `status: Suppressed`
   - Exclude invalid phone numbers (flagged as wrong number)

3. **Active Campaign Deduplication**
   - Check if contact already in any active Phoneburner session
   - If yes: Option to skip or update existing record

4. **Data Completeness Validation**
   - Require: First name, last name, phone number
   - Warn if missing: Company, email (allow push but flag)
   - Auto-format phone numbers to E.164 standard

**User Feedback:**
```
✓ 88 contacts ready to push
⚠ 12 contacts excluded - called in last 5 days
⚠ 3 contacts missing email (will push without)
✗ 2 contacts suppressed (Do Not Call)

Total to push: 88 contacts
```

---

### F-005: Bidirectional Sync Manager

**Challenge:** Prevent sync loops and data conflicts when both systems can update contacts

**Solution: Last-Write-Wins with Audit Trail**

**Sync Fields:**
- **Master in SourceCo:** Contact owner, deal assignments, internal notes, tags
- **Master in Phoneburner:** Call history, dispositions, recordings
- **Shared (bidirectional):** Phone, email, company, name, address

**Conflict Resolution:**
```python
def sync_contact_update(source_system, contact_id, field, old_value, new_value, timestamp):
    current_record = get_contact(contact_id)
    last_update = get_field_last_update(contact_id, field)
    
    # If this update is newer than our last update, apply it
    if timestamp > last_update.timestamp:
        update_field(contact_id, field, new_value)
        log_sync_event(
            contact_id=contact_id,
            field=field,
            old_value=old_value,
            new_value=new_value,
            source=source_system,
            timestamp=timestamp
        )
    else:
        # Stale update, ignore
        log_warning(f"Ignoring stale update for {contact_id}.{field}")
```

**Sync Frequency:**
- **Real-time:** Webhooks for call events, dispositions, critical field updates
- **Batch (every 15 min):** Non-critical field updates, bulk contact imports
- **Daily:** Full reconciliation to catch missed webhooks

---

## Data Architecture

### Database Schema Updates

#### New Table: `contact_activities`
```sql
CREATE TABLE contact_activities (
    id BIGSERIAL PRIMARY KEY,
    contact_id BIGINT NOT NULL REFERENCES contacts(id),
    activity_type VARCHAR(50) NOT NULL, -- 'call_attempt', 'call_connected', 'email_sent', etc.
    
    -- Call-specific fields
    call_started_at TIMESTAMP,
    call_connected_at TIMESTAMP,
    call_ended_at TIMESTAMP,
    call_duration_seconds INT,
    call_outcome VARCHAR(50), -- 'connected', 'voicemail', 'no_answer', 'busy'
    answered_by VARCHAR(50), -- 'decision_maker', 'gatekeeper', 'voicemail'
    
    -- Disposition
    disposition_code VARCHAR(100),
    disposition_label VARCHAR(255),
    disposition_notes TEXT,
    
    -- User & source
    user_id BIGINT REFERENCES users(id),
    user_name VARCHAR(255),
    source_system VARCHAR(50), -- 'phoneburner', 'sourceco_platform', 'email_tool'
    external_id VARCHAR(255), -- Phoneburner call ID
    
    -- Recording
    recording_url VARCHAR(500),
    recording_duration_seconds INT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_contact_activities_contact_id (contact_id),
    INDEX idx_contact_activities_type (activity_type),
    INDEX idx_contact_activities_user_id (user_id),
    INDEX idx_contact_activities_created_at (created_at),
    INDEX idx_contact_activities_external_id (external_id)
);
```

---

#### Updated Table: `contacts`
```sql
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS
    -- Call tracking
    last_call_attempt_at TIMESTAMP,
    last_call_connected_at TIMESTAMP,
    total_call_attempts INT DEFAULT 0,
    total_calls_connected INT DEFAULT 0,
    total_call_duration_seconds INT DEFAULT 0,
    
    -- Phoneburner integration
    phoneburner_contact_id VARCHAR(255),
    phoneburner_last_sync_at TIMESTAMP,
    
    -- Suppression
    do_not_call BOOLEAN DEFAULT FALSE,
    do_not_call_reason VARCHAR(255),
    phone_number_invalid BOOLEAN DEFAULT FALSE,
    
    -- Next action
    next_action_type VARCHAR(100), -- 'call', 'email', 'meeting'
    next_action_date DATE,
    next_action_notes TEXT;

CREATE INDEX idx_contacts_last_call_attempt ON contacts(last_call_attempt_at);
CREATE INDEX idx_contacts_next_action_date ON contacts(next_action_date);
CREATE INDEX idx_contacts_phoneburner_id ON contacts(phoneburner_contact_id);
```

---

#### New Table: `phoneburner_sessions`
```sql
CREATE TABLE phoneburner_sessions (
    id BIGSERIAL PRIMARY KEY,
    phoneburner_session_id VARCHAR(255) UNIQUE NOT NULL,
    session_name VARCHAR(255),
    session_type VARCHAR(50), -- 'buyer_outreach', 'seller_prospecting', 'callback_followup'
    
    -- Stats
    total_contacts INT DEFAULT 0,
    total_dials INT DEFAULT 0,
    total_connections INT DEFAULT 0,
    total_talk_time_seconds INT DEFAULT 0,
    
    -- Ownership
    created_by_user_id BIGINT REFERENCES users(id),
    team_id BIGINT REFERENCES teams(id),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    last_activity_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    INDEX idx_pb_sessions_user_id (created_by_user_id),
    INDEX idx_pb_sessions_team_id (team_id)
);
```

---

#### New Table: `phoneburner_webhooks_log`
```sql
CREATE TABLE phoneburner_webhooks_log (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    event_id VARCHAR(255) UNIQUE,
    payload JSONB NOT NULL,
    
    -- Processing
    processed_at TIMESTAMP,
    processing_status VARCHAR(50), -- 'pending', 'success', 'failed', 'skipped'
    processing_error TEXT,
    retry_count INT DEFAULT 0,
    
    -- Metadata
    received_at TIMESTAMP DEFAULT NOW(),
    signature_valid BOOLEAN,
    
    INDEX idx_webhooks_event_type (event_type),
    INDEX idx_webhooks_status (processing_status),
    INDEX idx_webhooks_received_at (received_at)
);
```

---

### Data Mapping: SourceCo ↔ Phoneburner

#### Contact Fields
| SourceCo Field | Phoneburner Field | Direction | Notes |
|----------------|-------------------|-----------|-------|
| `first_name` | `first_name` | Bidirectional | Required |
| `last_name` | `last_name` | Bidirectional | Required |
| `company` | `company` | Bidirectional | - |
| `phone` | `phone` | Bidirectional | Auto-format to E.164 |
| `email` | `email` | Bidirectional | - |
| `title` | `title` | Bidirectional | - |
| `address_line1` | `address` | Bidirectional | - |
| `city` | `city` | Bidirectional | - |
| `state` | `state` | Bidirectional | - |
| `zip` | `zip` | Bidirectional | - |
| `id` | `custom_fields.sourceco_contact_id` | SourceCo → PB | Critical for linking |
| `contact_type` | `custom_fields.contact_type` | SourceCo → PB | 'buyer' or 'seller' |
| `buyer_type` | `custom_fields.buyer_type` | SourceCo → PB | PE firm, strategic, etc. |
| `target_industries` | `custom_fields.target_sectors` | SourceCo → PB | For context during call |
| `aum` | `custom_fields.aum` | SourceCo → PB | Buyer qualification |
| `ebitda_range` | `custom_fields.ebitda_range` | SourceCo → PB | Seller qualification |
| `deal_ids` | `custom_fields.active_deals` | SourceCo → PB | Comma-separated |
| `last_contact_date` | `custom_fields.last_contact` | SourceCo → PB | For rep context |

---

#### Activity/Event Mapping
| Phoneburner Event | SourceCo Activity Type | Additional Data Captured |
|-------------------|------------------------|--------------------------|
| `call.started` | `call_attempt` | Dial start time, session ID |
| `call.connected` | `call_connected` | Answer type (DM/gatekeeper/VM) |
| `call.ended` | `call_completed` | Duration, recording URL |
| `disposition.set` | `disposition_set` | Code, label, notes, callback date |
| `callback.scheduled` | `callback_scheduled` | Target date, assigned user |
| `contact.updated` | `contact_updated` | Changed fields, updated by |

---

## Technical Implementation Plan

### Phase 1: Core Integration (Week 1-2)

**Milestone 1.1: List Push API**
- [ ] Build UI: "Push to Phoneburner" button on contact tables
- [ ] Implement list selection/filtering modal
- [ ] Create API client for Phoneburner `/v2/contacts/bulk` endpoint
- [ ] Map SourceCo contact schema → Phoneburner schema
- [ ] Handle response: Success counts, error logging
- [ ] Test with 10-contact test list

**Milestone 1.2: Webhook Receiver**
- [ ] Set up webhook endpoint: `/api/webhooks/phoneburner/events`
- [ ] Implement HMAC-SHA256 signature validation
- [ ] Create webhook event queue (for async processing)
- [ ] Build event dispatcher (routes events to handlers)
- [ ] Add `phoneburner_webhooks_log` table for audit trail

**Milestone 1.3: Database Schema**
- [ ] Add `contact_activities` table
- [ ] Update `contacts` table with call tracking fields
- [ ] Create `phoneburner_sessions` table
- [ ] Create `phoneburner_webhooks_log` table
- [ ] Run migrations on staging environment

---

### Phase 2: Event Processing (Week 3-4)

**Milestone 2.1: Call Tracking**
- [ ] Handler: `call.started` → Create activity record
- [ ] Handler: `call.connected` → Update activity, increment counters
- [ ] Handler: `call.ended` → Finalize activity, record duration
- [ ] Update contact: `last_call_attempt_at`, `last_call_connected_at`
- [ ] Test: Make test calls in Phoneburner, verify data flows

**Milestone 2.2: Disposition Processing**
- [ ] Handler: `disposition.set` → Update activity, contact status
- [ ] Build disposition mapping configuration (JSON or DB table)
- [ ] Implement mapping engine: Disposition → Status/Stage/Workflows
- [ ] Test all disposition codes with sample data

**Milestone 2.3: Callback Management**
- [ ] Handler: `callback.scheduled` → Create task in SourceCo
- [ ] Update contact: `next_action_date`, `next_action_type`
- [ ] Build task UI for reps to see upcoming callbacks
- [ ] Optional: Auto-add to Phoneburner session on callback date

---

### Phase 3: Smart Features (Week 5-6)

**Milestone 3.1: Contact Filtering**
- [ ] Pre-push validation: Recently contacted check
- [ ] Pre-push validation: Suppression list check
- [ ] Pre-push validation: Active session deduplication
- [ ] Pre-push validation: Data completeness check
- [ ] UI: Show validation results before push

**Milestone 3.2: Bidirectional Sync**
- [ ] Handler: `contact.updated` → Update SourceCo contact fields
- [ ] Implement conflict resolution (last-write-wins)
- [ ] Build daily reconciliation job (full contact sync)
- [ ] Add sync status indicator on contact detail page

**Milestone 3.3: Contact Timeline**
- [ ] Build unified timeline view on contact detail page
- [ ] Show call activities with duration, outcome, notes
- [ ] Link to Phoneburner call recordings
- [ ] Filter timeline by activity type (calls, emails, tasks)

---

### Phase 4: Analytics & Reporting (Week 7-8)

**Milestone 4.1: Rep Performance Dashboard**
- [ ] Build metrics calculation: Dials, connections, talk time
- [ ] Create dashboard UI: Rep scorecards, leaderboards
- [ ] Add filters: Date range, team, contact type
- [ ] Test with 30 days of call data

**Milestone 4.2: Campaign Analytics**
- [ ] Session-level metrics: Total dials, connection rate, outcomes
- [ ] Segment analysis: Buyer vs. seller, industry, geography
- [ ] ROI tracking: Calls → meetings → deals closed
- [ ] Export to CSV for deeper analysis

**Milestone 4.3: Workflow Automation**
- [ ] Trigger: "Interested" disposition → Send deal memo email
- [ ] Trigger: "Callback in X days" → Create task + email reminder
- [ ] Trigger: "Not a Fit" → Suppress for 365 days
- [ ] Trigger: "Meeting Scheduled" → Create calendar event, notify team

---

### Phase 5: Testing & Launch (Week 9-10)

**Milestone 5.1: Integration Testing**
- [ ] End-to-end test: Push list → Make calls → Verify data sync
- [ ] Test error handling: API failures, webhook retries, bad data
- [ ] Load test: Push 500+ contact list
- [ ] Security test: Webhook signature validation, API key rotation

**Milestone 5.2: User Acceptance Testing**
- [ ] Train 2 reps on new workflow
- [ ] Observe real calling sessions, collect feedback
- [ ] Iterate on UI/UX based on feedback
- [ ] Document any edge cases or bugs

**Milestone 5.3: Production Launch**
- [ ] Deploy to production environment
- [ ] Enable for pilot team (4 reps)
- [ ] Monitor webhook processing, API call success rates
- [ ] Daily check-ins with pilot users for first week
- [ ] Roll out to full team after successful pilot

---

## Webhook Configuration in Phoneburner

**Steps to Set Up:**

1. **Log in to Phoneburner admin panel**
2. **Navigate to:** Settings → Integrations → Webhooks
3. **Add new webhook:**
   - **URL:** `https://sourceco.com/api/webhooks/phoneburner/events`
   - **Secret:** Generate strong secret, store in SourceCo environment variables
   - **Events to subscribe:**
     - ✓ call.started
     - ✓ call.connected
     - ✓ call.ended
     - ✓ disposition.set
     - ✓ callback.scheduled
     - ✓ contact.updated
4. **Test webhook:** Phoneburner sends test event, verify receipt in SourceCo logs
5. **Monitor:** Check webhook delivery logs daily for first week

---

## API Authentication & Security

### Phoneburner API Key Management
- **Storage:** Environment variable `PHONEBURNER_API_KEY`, encrypted at rest
- **Rotation:** Rotate key every 90 days, log in security calendar
- **Scope:** Limit API key to minimum required permissions (contacts, dial sessions)
- **Monitoring:** Alert if API returns 401/403 errors (key compromised or expired)

### Webhook Signature Validation
```python
import hmac
import hashlib

def validate_phoneburner_webhook(request):
    signature = request.headers.get('X-Phoneburner-Signature')
    secret = os.environ.get('PHONEBURNER_WEBHOOK_SECRET')
    
    # Compute expected signature
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        request.body,
        hashlib.sha256
    ).hexdigest()
    
    # Constant-time comparison to prevent timing attacks
    return hmac.compare_digest(signature, expected_signature)
```

### Rate Limiting
- **Phoneburner API:** Respect rate limits (check docs, likely 100-500 req/min)
- **Webhook processing:** Queue events, process async to avoid blocking
- **Retry logic:** Exponential backoff on failures (1s, 2s, 4s, 8s, 16s, then alert)

---

## Monitoring & Alerting

### Key Metrics to Track
1. **API Health:**
   - Phoneburner API call success rate (target: >99%)
   - Average API response time (target: <500ms)
   - Failed pushes requiring retry (target: <1%)

2. **Webhook Processing:**
   - Webhook receipt-to-processing latency (target: <10s)
   - Webhook processing success rate (target: >99.5%)
   - Unprocessed webhook backlog (alert if >100 pending)

3. **Data Quality:**
   - % of contacts pushed with valid phone numbers (target: >95%)
   - % of webhooks with missing `sourceco_contact_id` (alert if >1%)
   - Daily reconciliation discrepancies (alert if >10 contacts)

4. **Business Metrics:**
   - Daily dials per rep (track trend)
   - Connection rate by rep (flag if <20%)
   - Average talk time per call (flag if <90 seconds)

### Alerting Rules
- **Critical:** Webhook endpoint down for >5 minutes
- **Critical:** API key rejected (401 error)
- **High:** Webhook processing failing for >50 events
- **Medium:** Daily reconciliation finds >10 discrepancies
- **Low:** Connection rate drops >10% week-over-week

---

## User Training & Documentation

### Rep Training (1 hour session)

**Module 1: Pushing Lists to Phoneburner (15 min)**
- How to filter contacts in SourceCo
- "Push to Phoneburner" button walkthrough
- Selecting/creating dial sessions
- Understanding validation warnings

**Module 2: Calling in Phoneburner (15 min)**
- Logging into Phoneburner
- Starting a dial session
- Using dispositions correctly (critical for data quality)
- Scheduling callbacks

**Module 3: Viewing Call History (15 min)**
- Contact timeline in SourceCo
- Reviewing call notes before follow-up
- Listening to call recordings
- Understanding contact status changes

**Module 4: Best Practices (15 min)**
- When to use which disposition
- How to write actionable call notes
- Avoiding duplicate/spam calls
- Escalation: What to do if webhook fails

### Admin Documentation
- Webhook troubleshooting guide
- API error code reference
- Disposition mapping configuration
- Daily reconciliation runbook

---

## Risk Mitigation

### Risk 1: Webhook Delivery Failures
**Impact:** Call data not synced, leads to duplicate calls or lost follow-ups  
**Probability:** Medium  
**Mitigation:**
- Daily reconciliation job to catch missed webhooks
- Webhook retry logic with exponential backoff
- Manual data sync tool for emergency recovery

### Risk 2: API Rate Limiting
**Impact:** List pushes fail during high-volume periods  
**Probability:** Low-Medium  
**Mitigation:**
- Implement request queuing with rate limit awareness
- Batch large list pushes (500 contacts/batch with delays)
- Monitor API usage, alert if approaching limits

### Risk 3: Disposition Mapping Errors
**Impact:** Wrong contact status, missed workflow triggers  
**Probability:** Medium (especially if Phoneburner changes disposition codes)  
**Mitigation:**
- Log all unmapped dispositions for manual review
- Weekly audit: Check for new/unknown disposition codes
- Version control disposition mapping config, require approval for changes

### Risk 4: Contact Deduplication Failures
**Impact:** Same buyer called multiple times in one day  
**Probability:** Low  
**Mitigation:**
- Pre-push validation against last contact date
- Phoneburner session-level deduplication
- Rep training: Check contact timeline before manual adds

### Risk 5: Data Privacy / Do Not Call Violations
**Impact:** Legal/reputation risk from calling suppressed contacts  
**Probability:** Low (if controls work)  
**Mitigation:**
- Hard block on pushing contacts with `do_not_call: true`
- Automated suppression list updates from dispositions
- Monthly audit: Verify no suppressed contacts in active sessions

---

## Success Metrics (90-Day Goals)

### Operational Efficiency
- [ ] **List push time:** Reduced from 10 min → <1 min per rep per day
- [ ] **Data entry time:** Reduced from 5 min/call → 0 min (auto-sync dispositions)
- [ ] **Call prep time:** Reduced from 3 min → 30 sec (contact timeline visibility)

**Total time savings:** ~15 min/rep/day × 8 reps = 2 hours/day = 40 hours/month

### Rep Performance
- [ ] **Dials per rep per day:** Increase from baseline to +20%
- [ ] **Connection rate:** Establish baseline, track improvement
- [ ] **Callback completion rate:** >80% of scheduled callbacks completed on time

### Data Quality
- [ ] **Contact accuracy:** >95% of pushed contacts have valid phone numbers
- [ ] **Disposition coverage:** >90% of calls have disposition set
- [ ] **Sync success rate:** >99.5% of webhooks processed successfully

### Business Impact
- [ ] **Meetings booked from calls:** Track attribution (call → meeting → deal)
- [ ] **Time-to-contact:** Reduce lag from deal sourced → first buyer contact
- [ ] **Buyer engagement score:** Combine call frequency + email opens + platform visits

---

## Appendix A: Phoneburner API Reference

### Key Endpoints

**1. Bulk Contact Import**
```
POST /v2/contacts/bulk
Authorization: Bearer {api_key}
Content-Type: application/json

Body: {
  "contacts": [ /* array of contact objects */ ],
  "dial_session_id": "optional_session_id"
}
```

**2. Create Dial Session**
```
POST /v2/dial_sessions
Authorization: Bearer {api_key}

Body: {
  "name": "Session Name",
  "description": "Optional description"
}
```

**3. Get Contact**
```
GET /v2/contacts/{contact_id}
Authorization: Bearer {api_key}
```

**4. Update Contact**
```
PATCH /v2/contacts/{contact_id}
Authorization: Bearer {api_key}

Body: {
  "phone": "+1-555-9999",
  "custom_fields": { /* updated fields */ }
}
```

---

## Appendix B: Sample Disposition Codes

Based on typical Phoneburner setups, customize for SourceCo needs:

**Positive Outcomes:**
- `INTERESTED` - Interested, send information
- `MEETING_SET` - Meeting/demo scheduled
- `HOT_LEAD` - Very interested, prioritize follow-up
- `REFERRAL_PROVIDED` - Gave referral to another contact

**Neutral Outcomes:**
- `LEFT_VOICEMAIL` - Left voicemail message
- `GATEKEEPER` - Spoke to assistant/gatekeeper
- `CALLBACK_REQUESTED` - Asked to call back at specific time
- `NOT_NOW` - Interested but bad timing (call back in X months)

**Negative Outcomes:**
- `NOT_INTERESTED` - Not interested in service
- `NOT_A_FIT` - Doesn't match ICP (wrong size, industry, etc.)
- `ALREADY_WORKING_WITH_COMPETITOR` - Using another M&A advisor
- `DO_NOT_CALL` - Requested removal from call list

**Administrative:**
- `WRONG_NUMBER` - Number disconnected or wrong person
- `BAD_DATA` - Contact info completely incorrect
- `LANGUAGE_BARRIER` - Unable to communicate effectively
- `DECEASED` - Contact is deceased

---

## Appendix C: Webhook Event Examples

### Full Call Lifecycle Example

**Event 1: Call Started**
```json
POST /api/webhooks/phoneburner/events
X-Phoneburner-Signature: abc123...

{
  "event": "call.started",
  "event_id": "evt_call_started_789",
  "timestamp": "2026-02-23T10:45:00Z",
  "contact": {
    "id": "pb_contact_456",
    "first_name": "John",
    "last_name": "Smith",
    "company": "Heritage Capital",
    "phone": "+15550123",
    "email": "jsmith@heritagecap.com",
    "custom_fields": {
      "sourceco_contact_id": "sc_buyer_789",
      "buyer_type": "PE Firm",
      "aum": "$500M"
    }
  },
  "user": {
    "id": "pb_user_10",
    "name": "Sarah Johnson",
    "email": "sarah@sourceco.com"
  },
  "dial_session": {
    "id": "pb_session_12345",
    "name": "PE Buyers - Feb 2026 Outreach"
  }
}
```

**Event 2: Call Connected**
```json
{
  "event": "call.connected",
  "event_id": "evt_call_connected_790",
  "timestamp": "2026-02-23T10:45:12Z",
  "contact_id": "pb_contact_456",
  "call_id": "call_123",
  "answered_by": "decision_maker",
  "sourceco_contact_id": "sc_buyer_789"
}
```

**Event 3: Call Ended**
```json
{
  "event": "call.ended",
  "event_id": "evt_call_ended_791",
  "timestamp": "2026-02-23T10:48:54Z",
  "contact_id": "pb_contact_456",
  "call_id": "call_123",
  "duration": 222,
  "outcome": "completed",
  "recording_url": "https://phoneburner.com/recordings/call_123.mp3",
  "recording_duration": 218,
  "sourceco_contact_id": "sc_buyer_789"
}
```

**Event 4: Disposition Set**
```json
{
  "event": "disposition.set",
  "event_id": "evt_disposition_792",
  "timestamp": "2026-02-23T10:49:05Z",
  "contact_id": "pb_contact_456",
  "call_id": "call_123",
  "disposition": {
    "code": "INTERESTED",
    "label": "Interested - Send Information",
    "notes": "Wants memo on current collision repair platform deal. Strong interest in auto aftermarket. Follow up Friday with deal specifics.",
    "callback_date": null
  },
  "user": {
    "id": "pb_user_10",
    "name": "Sarah Johnson"
  },
  "sourceco_contact_id": "sc_buyer_789"
}
```

---

## Next Steps

1. **Review & Approve Requirements** (You)
   - Validate business logic and user stories
   - Approve disposition mappings
   - Confirm success metrics

2. **Technical Architecture Review** (Engineering Team)
   - Database schema review
   - API integration approach
   - Webhook processing architecture

3. **Estimate & Prioritize** (Product + Engineering)
   - Break into sprints (10-week timeline estimated)
   - Identify any dependencies or blockers
   - Assign engineering resources

4. **Kickoff** (Week 1)
   - Set up Phoneburner sandbox account for testing
   - Generate API keys and webhook secrets
   - Create project in SourceCo task management

---

**Document prepared by:** Claude (AI Assistant)  
**For:** Tomos, SourceCo CEO  
**Purpose:** Phoneburner integration planning  
**Status:** Draft for review

---

*This document covers end-to-end integration requirements, from business use cases to technical implementation. Adjust timelines, priorities, and scope based on team capacity and strategic priorities.*
