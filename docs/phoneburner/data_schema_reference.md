# Phoneburner Integration - Data Schema & API Reference

## Complete Technical Data Specification

---

## Database Schema (PostgreSQL)

### Table: `contact_activities`

**Purpose:** Track every call attempt, connection, and outcome from Phoneburner

```sql
CREATE TABLE contact_activities (
    -- Primary Key
    id BIGSERIAL PRIMARY KEY,
    
    -- Foreign Keys
    contact_id BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    phoneburner_session_id BIGINT REFERENCES phoneburner_sessions(id) ON DELETE SET NULL,
    
    -- Activity Type & Source
    activity_type VARCHAR(50) NOT NULL,
        -- Values: 'call_attempt', 'call_connected', 'call_completed', 
        --         'disposition_set', 'callback_scheduled', 'voicemail_left',
        --         'email_sent', 'email_opened', 'meeting_scheduled'
    source_system VARCHAR(50) NOT NULL DEFAULT 'phoneburner',
        -- Values: 'phoneburner', 'sourceco_platform', 'manual_entry', 'email_automation'
    
    -- Call Lifecycle Timestamps
    call_started_at TIMESTAMP WITH TIME ZONE,
    call_connected_at TIMESTAMP WITH TIME ZONE,
    call_ended_at TIMESTAMP WITH TIME ZONE,
    
    -- Call Details
    call_duration_seconds INTEGER,
        -- Total call duration (ringing + talk time)
    talk_time_seconds INTEGER,
        -- Actual conversation time (connected to end)
    call_outcome VARCHAR(50),
        -- Values: 'connected', 'voicemail', 'no_answer', 'busy', 'failed', 'rejected'
    answered_by VARCHAR(50),
        -- Values: 'decision_maker', 'gatekeeper', 'voicemail', 'unknown'
    
    -- Disposition Information
    disposition_code VARCHAR(100),
        -- Phoneburner disposition code (e.g., 'INTERESTED', 'NOT_A_FIT')
    disposition_label VARCHAR(255),
        -- Human-readable disposition (e.g., 'Interested - Send Information')
    disposition_notes TEXT,
        -- Rep's notes from the call
    disposition_set_at TIMESTAMP WITH TIME ZONE,
        -- When disposition was set (may be after call ended)
    
    -- Callback Scheduling
    callback_scheduled_date TIMESTAMP WITH TIME ZONE,
    callback_completed_at TIMESTAMP WITH TIME ZONE,
    callback_outcome VARCHAR(50),
        -- Values: 'completed', 'rescheduled', 'missed', 'cancelled'
    
    -- Recording
    recording_url VARCHAR(500),
    recording_duration_seconds INTEGER,
    recording_transcription TEXT,
        -- Optional: If transcription service integrated
    
    -- User & Attribution
    user_name VARCHAR(255),
        -- Cached from users table for faster queries
    user_email VARCHAR(255),
    team_id BIGINT REFERENCES teams(id) ON DELETE SET NULL,
    
    -- External System Integration
    phoneburner_call_id VARCHAR(255),
        -- Phoneburner's unique call identifier
    phoneburner_contact_id VARCHAR(255),
        -- Phoneburner's contact ID
    phoneburner_event_id VARCHAR(255),
        -- Original webhook event ID (for deduplication)
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
        -- Soft delete for audit trail
    
    -- Indexes
    CONSTRAINT contact_activities_pkey PRIMARY KEY (id),
    CONSTRAINT fk_contact_activities_contact FOREIGN KEY (contact_id) 
        REFERENCES contacts(id) ON DELETE CASCADE,
    CONSTRAINT fk_contact_activities_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_contact_activities_contact_id ON contact_activities(contact_id);
CREATE INDEX idx_contact_activities_user_id ON contact_activities(user_id);
CREATE INDEX idx_contact_activities_type ON contact_activities(activity_type);
CREATE INDEX idx_contact_activities_created_at ON contact_activities(created_at DESC);
CREATE INDEX idx_contact_activities_call_started ON contact_activities(call_started_at DESC);
CREATE INDEX idx_contact_activities_disposition ON contact_activities(disposition_code) 
    WHERE disposition_code IS NOT NULL;
CREATE INDEX idx_contact_activities_pb_call_id ON contact_activities(phoneburner_call_id) 
    WHERE phoneburner_call_id IS NOT NULL;
CREATE INDEX idx_contact_activities_pb_event_id ON contact_activities(phoneburner_event_id);

-- Composite indexes for common queries
CREATE INDEX idx_contact_activities_contact_date 
    ON contact_activities(contact_id, call_started_at DESC);
CREATE INDEX idx_contact_activities_user_date 
    ON contact_activities(user_id, call_started_at DESC);
CREATE INDEX idx_contact_activities_team_date 
    ON contact_activities(team_id, call_started_at DESC);
```

---

### Table: `contacts` (Updates)

**Purpose:** Add call tracking and Phoneburner integration fields

```sql
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS
    -- Call Activity Tracking
    last_call_attempt_at TIMESTAMP WITH TIME ZONE,
        -- Last time we attempted to call (any outcome)
    last_call_connected_at TIMESTAMP WITH TIME ZONE,
        -- Last time call was answered (not voicemail)
    first_call_attempt_at TIMESTAMP WITH TIME ZONE,
        -- First ever call attempt (for lifecycle tracking)
    
    -- Call Statistics (Aggregates from contact_activities)
    total_call_attempts INTEGER DEFAULT 0,
    total_calls_connected INTEGER DEFAULT 0,
    total_calls_to_decision_maker INTEGER DEFAULT 0,
    total_calls_to_gatekeeper INTEGER DEFAULT 0,
    total_voicemails_left INTEGER DEFAULT 0,
    total_call_duration_seconds INTEGER DEFAULT 0,
    total_talk_time_seconds INTEGER DEFAULT 0,
    average_talk_time_seconds INTEGER,
        -- Calculated: total_talk_time / total_calls_connected
    
    -- Best Time to Call (Machine Learning / Analytics)
    best_call_day_of_week INTEGER,
        -- 1=Monday, 7=Sunday (based on historical connection rates)
    best_call_time_of_day TIME,
        -- HH:MM (based on historical connection rates)
    connection_rate_percentage DECIMAL(5,2),
        -- Calculated: (total_calls_connected / total_call_attempts) * 100
    
    -- Phoneburner Integration
    phoneburner_contact_id VARCHAR(255) UNIQUE,
        -- Phoneburner's ID for this contact
    phoneburner_last_sync_at TIMESTAMP WITH TIME ZONE,
        -- Last time we synced data with Phoneburner
    phoneburner_sync_status VARCHAR(50) DEFAULT 'synced',
        -- Values: 'synced', 'pending', 'failed', 'conflict'
    
    -- Contact Reachability
    phone_number_invalid BOOLEAN DEFAULT FALSE,
        -- Flagged if "Wrong Number" disposition received
    phone_number_invalid_reason VARCHAR(255),
        -- Reason: 'disconnected', 'wrong_person', 'business_closed'
    phone_verified_at TIMESTAMP WITH TIME ZONE,
        -- Last successful connection (proves number works)
    
    -- Suppression & Compliance
    do_not_call BOOLEAN DEFAULT FALSE,
        -- User explicitly requested no calls
    do_not_call_reason VARCHAR(255),
        -- Reason: 'user_requested', 'legal_requirement', 'internal_policy'
    do_not_call_set_at TIMESTAMP WITH TIME ZONE,
    do_not_call_set_by_user_id BIGINT REFERENCES users(id),
    
    -- Next Action Planning
    next_action_type VARCHAR(100),
        -- Values: 'call', 'email', 'send_materials', 'schedule_meeting'
    next_action_date DATE,
        -- When to take next action
    next_action_notes TEXT,
        -- Context for next action
    next_action_assigned_to_user_id BIGINT REFERENCES users(id),
    
    -- Last Disposition Context (Denormalized for quick access)
    last_disposition_code VARCHAR(100),
    last_disposition_label VARCHAR(255),
    last_disposition_date TIMESTAMP WITH TIME ZONE,
    last_disposition_notes TEXT,
    
    -- Gatekeeper Intelligence
    gatekeeper_name VARCHAR(255),
        -- Name of assistant/receptionist (if discovered)
    gatekeeper_phone_extension VARCHAR(50),
    gatekeeper_notes TEXT,
        -- Tips for getting past gatekeeper
    
    -- Engagement Scoring
    call_engagement_score INTEGER,
        -- 0-100 score based on: connection rate, talk time, positive dispositions
    last_engaged_call_at TIMESTAMP WITH TIME ZONE,
        -- Last call where we had meaningful conversation (>2 min, positive outcome)
    days_since_last_engaged_call INTEGER,
        -- Calculated field for remarketing rules
    
    -- Audit Fields (Updated by trigger on contact_activities changes)
    call_stats_last_calculated_at TIMESTAMP WITH TIME ZONE,
        -- When aggregates were last recalculated
    call_stats_stale BOOLEAN DEFAULT FALSE
        -- Flag if aggregates need recalculation (performance optimization)
;

-- Indexes
CREATE INDEX idx_contacts_last_call_attempt ON contacts(last_call_attempt_at DESC);
CREATE INDEX idx_contacts_last_call_connected ON contacts(last_call_connected_at DESC);
CREATE INDEX idx_contacts_next_action_date ON contacts(next_action_date) 
    WHERE next_action_date IS NOT NULL;
CREATE INDEX idx_contacts_phoneburner_id ON contacts(phoneburner_contact_id) 
    WHERE phoneburner_contact_id IS NOT NULL;
CREATE INDEX idx_contacts_do_not_call ON contacts(do_not_call) 
    WHERE do_not_call = TRUE;
CREATE INDEX idx_contacts_phone_invalid ON contacts(phone_number_invalid) 
    WHERE phone_number_invalid = TRUE;
CREATE INDEX idx_contacts_engagement_score ON contacts(call_engagement_score DESC);

-- Composite indexes for common queries
CREATE INDEX idx_contacts_call_stats 
    ON contacts(last_call_attempt_at, connection_rate_percentage) 
    WHERE do_not_call = FALSE AND phone_number_invalid = FALSE;
```

---

### Table: `phoneburner_sessions`

**Purpose:** Track dial sessions and campaign performance

```sql
CREATE TABLE phoneburner_sessions (
    -- Primary Key
    id BIGSERIAL PRIMARY KEY,
    
    -- Phoneburner Integration
    phoneburner_session_id VARCHAR(255) UNIQUE NOT NULL,
        -- Phoneburner's unique session identifier
    session_external_url VARCHAR(500),
        -- Direct link to session in Phoneburner UI
    
    -- Session Metadata
    session_name VARCHAR(255) NOT NULL,
        -- User-defined session name (e.g., "PE Buyers - Feb 2026")
    session_description TEXT,
    session_type VARCHAR(50),
        -- Values: 'buyer_outreach', 'seller_prospecting', 'callback_followup', 'reactivation'
    
    -- Session Configuration
    contact_type VARCHAR(50),
        -- Values: 'buyer', 'seller', 'mixed'
    target_industry VARCHAR(100),
        -- If focused on specific industry
    target_geography VARCHAR(100),
        -- If focused on specific region
    
    -- Contact Counts
    total_contacts_added INTEGER DEFAULT 0,
        -- Total contacts ever added to this session
    total_contacts_active INTEGER DEFAULT 0,
        -- Contacts not yet called or completed
    total_contacts_completed INTEGER DEFAULT 0,
        -- Contacts with final disposition set
    
    -- Call Activity Stats (Aggregated from contact_activities)
    total_dials INTEGER DEFAULT 0,
    total_connections INTEGER DEFAULT 0,
    total_decision_maker_conversations INTEGER DEFAULT 0,
    total_gatekeeper_conversations INTEGER DEFAULT 0,
    total_voicemails_left INTEGER DEFAULT 0,
    total_no_answers INTEGER DEFAULT 0,
    
    -- Time Tracking
    total_call_time_seconds INTEGER DEFAULT 0,
        -- Total time spent on calls (including ringing)
    total_talk_time_seconds INTEGER DEFAULT 0,
        -- Total actual conversation time
    average_talk_time_seconds INTEGER,
        -- Calculated: total_talk_time / total_connections
    
    -- Conversion Metrics
    total_qualified_leads INTEGER DEFAULT 0,
        -- Contacts with "Interested" or similar positive disposition
    total_meetings_scheduled INTEGER DEFAULT 0,
    total_disqualified INTEGER DEFAULT 0,
    total_callbacks_scheduled INTEGER DEFAULT 0,
    
    -- Performance Metrics
    connection_rate_percentage DECIMAL(5,2),
        -- (total_connections / total_dials) * 100
    qualification_rate_percentage DECIMAL(5,2),
        -- (total_qualified_leads / total_connections) * 100
    
    -- Session Lifecycle
    session_status VARCHAR(50) DEFAULT 'active',
        -- Values: 'active', 'paused', 'completed', 'archived'
    started_at TIMESTAMP WITH TIME ZONE,
        -- First dial made in this session
    last_activity_at TIMESTAMP WITH TIME ZONE,
        -- Most recent call/disposition
    completed_at TIMESTAMP WITH TIME ZONE,
        -- Session marked as complete
    
    -- Ownership & Permissions
    created_by_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    team_id BIGINT REFERENCES teams(id) ON DELETE SET NULL,
    is_shared BOOLEAN DEFAULT FALSE,
        -- If session is shared across team
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Indexes
    CONSTRAINT phoneburner_sessions_pkey PRIMARY KEY (id),
    CONSTRAINT fk_pb_sessions_created_by FOREIGN KEY (created_by_user_id) 
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT uq_pb_session_external_id UNIQUE (phoneburner_session_id)
);

-- Indexes
CREATE INDEX idx_pb_sessions_user_id ON phoneburner_sessions(created_by_user_id);
CREATE INDEX idx_pb_sessions_team_id ON phoneburner_sessions(team_id);
CREATE INDEX idx_pb_sessions_status ON phoneburner_sessions(session_status);
CREATE INDEX idx_pb_sessions_last_activity ON phoneburner_sessions(last_activity_at DESC);
CREATE INDEX idx_pb_sessions_type ON phoneburner_sessions(session_type);

-- Composite indexes
CREATE INDEX idx_pb_sessions_team_status_activity 
    ON phoneburner_sessions(team_id, session_status, last_activity_at DESC);
```

---

### Table: `phoneburner_webhooks_log`

**Purpose:** Audit trail for all webhook events received

```sql
CREATE TABLE phoneburner_webhooks_log (
    -- Primary Key
    id BIGSERIAL PRIMARY KEY,
    
    -- Event Identification
    event_id VARCHAR(255) UNIQUE,
        -- Phoneburner's unique event ID (for deduplication)
    event_type VARCHAR(100) NOT NULL,
        -- Values: 'call.started', 'call.connected', 'call.ended', 
        --         'disposition.set', 'callback.scheduled', 'contact.updated'
    
    -- Payload Storage
    payload JSONB NOT NULL,
        -- Full webhook payload as JSON (for debugging and replay)
    payload_size_bytes INTEGER,
        -- Size of payload (for monitoring)
    
    -- Extracted IDs (for quick lookups without parsing JSON)
    phoneburner_call_id VARCHAR(255),
    phoneburner_contact_id VARCHAR(255),
    sourceco_contact_id BIGINT,
        -- Extracted from payload.contact.custom_fields.sourceco_contact_id
    phoneburner_user_id VARCHAR(255),
    phoneburner_session_id VARCHAR(255),
    
    -- Processing Status
    processing_status VARCHAR(50) NOT NULL DEFAULT 'pending',
        -- Values: 'pending', 'processing', 'success', 'failed', 'skipped', 'duplicate'
    processing_error TEXT,
        -- Error message if processing failed
    processing_error_code VARCHAR(100),
        -- Structured error code for categorization
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    processing_duration_ms INTEGER,
        -- Milliseconds to process event
    
    -- Retry Management
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    last_retry_at TIMESTAMP WITH TIME ZONE,
    
    -- Security & Validation
    signature_header VARCHAR(500),
        -- X-Phoneburner-Signature header value
    signature_valid BOOLEAN,
        -- Result of HMAC validation
    ip_address INET,
        -- Source IP of webhook request
    user_agent VARCHAR(500),
        -- User-Agent header
    
    -- Related Records Created
    contact_activity_id BIGINT REFERENCES contact_activities(id) ON DELETE SET NULL,
        -- If this webhook created/updated a contact_activity record
    task_id BIGINT REFERENCES tasks(id) ON DELETE SET NULL,
        -- If this webhook created a task (e.g., for callback)
    
    -- Metadata
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        -- When webhook was received by our endpoint
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Partitioning hint (for large tables, partition by month)
    partition_date DATE GENERATED ALWAYS AS (DATE(received_at)) STORED,
    
    -- Indexes
    CONSTRAINT phoneburner_webhooks_log_pkey PRIMARY KEY (id),
    CONSTRAINT uq_webhook_event_id UNIQUE (event_id)
);

-- Indexes
CREATE INDEX idx_webhooks_event_type ON phoneburner_webhooks_log(event_type);
CREATE INDEX idx_webhooks_status ON phoneburner_webhooks_log(processing_status) 
    WHERE processing_status IN ('pending', 'failed');
CREATE INDEX idx_webhooks_received_at ON phoneburner_webhooks_log(received_at DESC);
CREATE INDEX idx_webhooks_pb_call_id ON phoneburner_webhooks_log(phoneburner_call_id) 
    WHERE phoneburner_call_id IS NOT NULL;
CREATE INDEX idx_webhooks_pb_contact_id ON phoneburner_webhooks_log(phoneburner_contact_id) 
    WHERE phoneburner_contact_id IS NOT NULL;
CREATE INDEX idx_webhooks_sc_contact_id ON phoneburner_webhooks_log(sourceco_contact_id) 
    WHERE sourceco_contact_id IS NOT NULL;
CREATE INDEX idx_webhooks_retry ON phoneburner_webhooks_log(next_retry_at) 
    WHERE processing_status = 'failed' AND retry_count < max_retries;

-- Composite indexes for monitoring queries
CREATE INDEX idx_webhooks_status_received 
    ON phoneburner_webhooks_log(processing_status, received_at DESC);
CREATE INDEX idx_webhooks_type_received 
    ON phoneburner_webhooks_log(event_type, received_at DESC);

-- Partial index for pending/failed events (hot data)
CREATE INDEX idx_webhooks_actionable 
    ON phoneburner_webhooks_log(received_at DESC, retry_count) 
    WHERE processing_status IN ('pending', 'failed');
```

---

### Table: `disposition_mappings`

**Purpose:** Configuration table for disposition code → SourceCo action mappings

```sql
CREATE TABLE disposition_mappings (
    -- Primary Key
    id SERIAL PRIMARY KEY,
    
    -- Phoneburner Disposition
    phoneburner_disposition_code VARCHAR(100) UNIQUE NOT NULL,
    phoneburner_disposition_label VARCHAR(255),
        -- Human-readable label from Phoneburner
    
    -- SourceCo Mapping
    sourceco_contact_status VARCHAR(100),
        -- Values: 'Qualified', 'Nurture', 'Disqualified', 'Suppressed', 'Invalid'
    sourceco_contact_stage VARCHAR(100),
        -- Values: 'Engaged', 'Follow-up', 'Meeting Set', 'Dead', 'Paused'
    
    -- Workflow Automation
    trigger_workflow BOOLEAN DEFAULT FALSE,
    workflow_name VARCHAR(255),
        -- Name of workflow to trigger (e.g., 'send_deal_memo', 'schedule_callback')
    workflow_config JSONB,
        -- Additional config for workflow (e.g., email template ID, delay settings)
    
    -- Task Creation
    create_task BOOLEAN DEFAULT FALSE,
    task_type VARCHAR(100),
        -- Values: 'call', 'email', 'meeting_prep', 'research'
    task_due_offset_days INTEGER,
        -- Days from disposition to task due date (e.g., 7 for "call back in a week")
    task_priority VARCHAR(50),
        -- Values: 'low', 'medium', 'high', 'urgent'
    
    -- Suppression Rules
    suppress_contact BOOLEAN DEFAULT FALSE,
    suppress_duration_days INTEGER,
        -- Days to suppress (e.g., 365 for "Not Interested")
    suppress_reason VARCHAR(255),
    
    -- Data Quality Flags
    mark_phone_invalid BOOLEAN DEFAULT FALSE,
    mark_do_not_call BOOLEAN DEFAULT FALSE,
    
    -- Next Action
    next_action_type VARCHAR(100),
    next_action_offset_days INTEGER,
        -- Days until next action (NULL = no automatic next action)
    
    -- Engagement Scoring Impact
    engagement_score_delta INTEGER DEFAULT 0,
        -- Change to contact's call_engagement_score (-50 to +50)
    
    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
        -- Internal notes about this mapping
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by_user_id BIGINT REFERENCES users(id),
    
    -- Indexes
    CONSTRAINT disposition_mappings_pkey PRIMARY KEY (id),
    CONSTRAINT uq_disposition_code UNIQUE (phoneburner_disposition_code)
);

-- Index for active mappings lookup
CREATE INDEX idx_disposition_mappings_active 
    ON disposition_mappings(phoneburner_disposition_code) 
    WHERE is_active = TRUE;

-- Sample Data
INSERT INTO disposition_mappings (
    phoneburner_disposition_code,
    phoneburner_disposition_label,
    sourceco_contact_status,
    sourceco_contact_stage,
    trigger_workflow,
    workflow_name,
    create_task,
    task_type,
    task_due_offset_days,
    engagement_score_delta
) VALUES
    ('INTERESTED', 'Interested - Send Information', 'Qualified', 'Engaged', TRUE, 'send_deal_memo', TRUE, 'email', 1, 25),
    ('MEETING_SET', 'Meeting Scheduled', 'Qualified', 'Meeting Set', TRUE, 'create_calendar_event', TRUE, 'meeting_prep', 0, 50),
    ('CALLBACK_30D', 'Callback in 30 Days', 'Nurture', 'Paused', FALSE, NULL, TRUE, 'call', 30, 0),
    ('NOT_INTERESTED', 'Not Interested', 'Disqualified', 'Dead', FALSE, NULL, FALSE, NULL, NULL, -25),
    ('NOT_A_FIT', 'Not a Fit - Wrong ICP', 'Disqualified', 'Dead', FALSE, NULL, FALSE, NULL, NULL, -25),
    ('WRONG_NUMBER', 'Wrong Number / Disconnected', 'Invalid', 'Dead', FALSE, NULL, FALSE, NULL, NULL, 0),
    ('DO_NOT_CALL', 'Do Not Call - Requested Removal', 'Suppressed', 'Dead', FALSE, NULL, FALSE, NULL, NULL, 0),
    ('LEFT_VOICEMAIL', 'Left Voicemail', 'Attempted', 'Outreach', FALSE, NULL, TRUE, 'call', 3, 5),
    ('SPOKE_TO_GATEKEEPER', 'Spoke to Gatekeeper', 'Attempted', 'Outreach', FALSE, NULL, TRUE, 'call', 2, 0),
    ('HOT_LEAD', 'Hot Lead - High Priority', 'Qualified', 'Engaged', TRUE, 'high_priority_alert', TRUE, 'call', 1, 40);

-- Update disposition mappings
UPDATE disposition_mappings 
SET mark_phone_invalid = TRUE 
WHERE phoneburner_disposition_code = 'WRONG_NUMBER';

UPDATE disposition_mappings 
SET mark_do_not_call = TRUE, suppress_contact = TRUE, suppress_duration_days = 9999 
WHERE phoneburner_disposition_code = 'DO_NOT_CALL';
```

---

## API Payloads

### SourceCo → Phoneburner: Push Contacts

**Endpoint:** `POST /v2/contacts/bulk`

**Request Headers:**
```
Authorization: Bearer {PHONEBURNER_API_KEY}
Content-Type: application/json
```

**Request Body:**
```json
{
  "dial_session_id": "pb_session_12345",
  "create_session_if_missing": true,
  "session_config": {
    "name": "PE Buyers - Feb 2026 Outreach",
    "description": "Lower middle market PE firms targeting business services",
    "auto_dial_enabled": true,
    "caller_id": "+1-555-0100"
  },
  "contacts": [
    {
      // Required Fields
      "first_name": "John",
      "last_name": "Smith",
      "phone": "+15550123",
      
      // Standard Fields (Optional but Recommended)
      "email": "jsmith@heritagecap.com",
      "company": "Heritage Capital Partners",
      "title": "Managing Partner",
      
      // Address Fields
      "address": "123 Main Street",
      "city": "Boston",
      "state": "MA",
      "zip": "02101",
      "country": "USA",
      
      // Custom Fields (SourceCo-specific data)
      "custom_fields": {
        // CRITICAL: Required for linking back to SourceCo
        "sourceco_contact_id": "sc_buyer_789",
        
        // Contact Classification
        "contact_type": "buyer",
        "buyer_type": "PE Firm - Lower Middle Market",
        "firm_type": "Independent Sponsor",
        
        // Firmographics
        "aum": "$500M",
        "fund_size": "$250M Fund III",
        "number_of_portfolio_companies": 12,
        "average_deal_size": "$10M - $25M",
        
        // Investment Criteria
        "target_ebitda_min": 2000000,
        "target_ebitda_max": 10000000,
        "target_sectors": "Business Services, Healthcare IT, Software",
        "target_geographies": "Northeast, Mid-Atlantic",
        
        // Deal Flow Context
        "active_deals_count": 3,
        "active_deal_ids": "deal_123,deal_456,deal_789",
        "last_deal_presented": "Collision Repair Platform - Dec 2025",
        "last_deal_outcome": "Passed - Too early stage",
        
        // Contact History
        "last_contact_date": "2026-01-15",
        "last_contact_method": "email",
        "last_contact_outcome": "Opened email, no response",
        "total_emails_sent": 8,
        "total_calls_attempted": 2,
        "total_deals_presented": 5,
        
        // Relationship Intelligence
        "relationship_strength": "warm",
        "relationship_notes": "Met at ACG conference 2024. Responsive to healthcare deals.",
        "referral_source": "Bill Johnson - Existing Client",
        
        // Call Context for Rep
        "call_talking_points": "New collision repair platform deal, $8M EBITDA, NC-based",
        "preferred_contact_time": "Morning 9-11 AM EST",
        "assistant_name": "Mary Johnson",
        "assistant_phone": "+1-555-0124",
        
        // Engagement Scoring
        "engagement_score": 75,
        "last_engaged_date": "2025-12-10",
        
        // SourceCo Internal
        "contact_owner_name": "Sarah Johnson",
        "contact_owner_email": "sarah@sourceco.com",
        "contact_source": "SourceCo Remarketing - Feb 2026 Campaign"
      }
    },
    {
      "first_name": "Emily",
      "last_name": "Chen",
      "phone": "+15550234",
      "email": "echen@summitpartners.com",
      "company": "Summit Partners",
      "title": "Vice President",
      "custom_fields": {
        "sourceco_contact_id": "sc_buyer_790",
        "contact_type": "buyer",
        "buyer_type": "PE Firm - Growth Equity",
        "aum": "$2.5B",
        "target_sectors": "SaaS, Fintech",
        "last_contact_date": "2025-11-20",
        "engagement_score": 60
      }
    }
    // ... more contacts
  ],
  "options": {
    "skip_duplicates": true,
    "update_existing": true,
    "duplicate_check_fields": ["phone", "email"]
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "dial_session_id": "pb_session_12345",
  "dial_session_url": "https://app.phoneburner.com/sessions/pb_session_12345",
  "contacts_processed": 100,
  "contacts_added": 88,
  "contacts_updated": 12,
  "contacts_failed": 0,
  "contacts_skipped_duplicates": 5,
  "processing_time_ms": 1250,
  "errors": []
}
```

**Response (Partial Failure):**
```json
{
  "success": true,
  "dial_session_id": "pb_session_12345",
  "contacts_processed": 100,
  "contacts_added": 85,
  "contacts_updated": 10,
  "contacts_failed": 5,
  "errors": [
    {
      "contact_index": 23,
      "field": "phone",
      "error": "Invalid phone number format",
      "value": "555-CALL-ME"
    },
    {
      "contact_index": 47,
      "field": "custom_fields.sourceco_contact_id",
      "error": "Missing required custom field",
      "value": null
    }
  ]
}
```

**Response (Complete Failure):**
```json
{
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "API rate limit exceeded. Retry after 60 seconds.",
  "retry_after_seconds": 60,
  "current_rate": 150,
  "rate_limit": 100
}
```

---

### Phoneburner → SourceCo: Webhook Events

**Webhook URL:** `POST https://sourceco.com/api/webhooks/phoneburner/events`

**Request Headers:**
```
Content-Type: application/json
X-Phoneburner-Signature: sha256={HMAC_SIGNATURE}
X-Phoneburner-Event-ID: evt_call_started_789
X-Phoneburner-Event-Type: call.started
```

---

#### Event 1: `call.started`

**Payload:**
```json
{
  "event": "call.started",
  "event_id": "evt_call_started_789",
  "timestamp": "2026-02-23T10:45:00.123Z",
  "api_version": "2.0",
  
  "contact": {
    "id": "pb_contact_456",
    "first_name": "John",
    "last_name": "Smith",
    "company": "Heritage Capital Partners",
    "phone": "+15550123",
    "email": "jsmith@heritagecap.com",
    "custom_fields": {
      "sourceco_contact_id": "sc_buyer_789",
      "buyer_type": "PE Firm",
      "aum": "$500M",
      "target_sectors": "Business Services, Healthcare IT"
    }
  },
  
  "call": {
    "id": "call_abc123",
    "direction": "outbound",
    "from_number": "+15550100",
    "to_number": "+15550123",
    "started_at": "2026-02-23T10:45:00.123Z"
  },
  
  "user": {
    "id": "pb_user_10",
    "name": "Sarah Johnson",
    "email": "sarah@sourceco.com",
    "team_id": "pb_team_5"
  },
  
  "dial_session": {
    "id": "pb_session_12345",
    "name": "PE Buyers - Feb 2026 Outreach"
  }
}
```

---

#### Event 2: `call.connected`

**Payload:**
```json
{
  "event": "call.connected",
  "event_id": "evt_call_connected_790",
  "timestamp": "2026-02-23T10:45:12.456Z",
  "api_version": "2.0",
  
  "contact_id": "pb_contact_456",
  "call_id": "call_abc123",
  
  "connection_details": {
    "connected_at": "2026-02-23T10:45:12.456Z",
    "ring_duration_seconds": 12,
    "answered_by": "decision_maker",
    "detection_method": "human_voice"
  },
  
  "custom_fields": {
    "sourceco_contact_id": "sc_buyer_789"
  }
}
```

**Possible `answered_by` values:**
- `decision_maker` - Person we intended to reach
- `gatekeeper` - Assistant, receptionist, or other intermediary
- `voicemail` - Voicemail system
- `answering_service` - Professional answering service
- `unknown` - Couldn't determine

---

#### Event 3: `call.ended`

**Payload:**
```json
{
  "event": "call.ended",
  "event_id": "evt_call_ended_791",
  "timestamp": "2026-02-23T10:48:54.789Z",
  "api_version": "2.0",
  
  "contact_id": "pb_contact_456",
  "call_id": "call_abc123",
  
  "call_summary": {
    "ended_at": "2026-02-23T10:48:54.789Z",
    "total_duration_seconds": 234,
    "ring_duration_seconds": 12,
    "talk_duration_seconds": 222,
    "hold_duration_seconds": 0,
    
    "outcome": "completed",
    "disconnect_reason": "normal_clearing",
    "disconnected_by": "caller"
  },
  
  "recording": {
    "available": true,
    "url": "https://phoneburner.com/api/v2/recordings/call_abc123.mp3",
    "duration_seconds": 222,
    "expires_at": "2027-02-23T10:48:54.789Z"
  },
  
  "custom_fields": {
    "sourceco_contact_id": "sc_buyer_789"
  }
}
```

**Possible `outcome` values:**
- `completed` - Normal call completion
- `no_answer` - Call rang but no one answered
- `busy` - Number was busy
- `failed` - Technical failure (network error, invalid number)
- `rejected` - Call was rejected by recipient
- `voicemail` - Went to voicemail (may still be in `completed` if left message)

---

#### Event 4: `disposition.set`

**Payload:**
```json
{
  "event": "disposition.set",
  "event_id": "evt_disposition_792",
  "timestamp": "2026-02-23T10:49:05.111Z",
  "api_version": "2.0",
  
  "contact_id": "pb_contact_456",
  "call_id": "call_abc123",
  
  "disposition": {
    "code": "INTERESTED",
    "label": "Interested - Send Information",
    "category": "positive",
    "notes": "Wants memo on current collision repair platform deal. Strong interest in auto aftermarket vertical. Mentioned they're actively looking for add-ons to existing portfolio company. Follow up Friday with specific deal details and financial summary.",
    "set_at": "2026-02-23T10:49:05.111Z"
  },
  
  "user": {
    "id": "pb_user_10",
    "name": "Sarah Johnson",
    "email": "sarah@sourceco.com"
  },
  
  "custom_fields": {
    "sourceco_contact_id": "sc_buyer_789"
  }
}
```

**Possible `category` values:**
- `positive` - Lead is qualified, interested, or progressing
- `neutral` - Inconclusive outcome, needs follow-up
- `negative` - Not interested, disqualified, or dead lead
- `administrative` - Wrong number, bad data, technical issue

---

#### Event 5: `callback.scheduled`

**Payload:**
```json
{
  "event": "callback.scheduled",
  "event_id": "evt_callback_793",
  "timestamp": "2026-02-23T10:49:05.222Z",
  "api_version": "2.0",
  
  "contact_id": "pb_contact_456",
  "call_id": "call_abc123",
  
  "callback": {
    "scheduled_for": "2026-03-25T14:00:00.000Z",
    "timezone": "America/New_York",
    "notes": "Call back after Q1 board meeting to discuss acquisition appetite for collision repair targets. John mentioned they're looking to deploy $50M in auto aftermarket this year.",
    "reminder_enabled": true,
    "reminder_minutes_before": 60,
    "auto_dial": false
  },
  
  "assigned_user": {
    "id": "pb_user_10",
    "name": "Sarah Johnson",
    "email": "sarah@sourceco.com"
  },
  
  "custom_fields": {
    "sourceco_contact_id": "sc_buyer_789"
  }
}
```

---

#### Event 6: `contact.updated`

**Payload:**
```json
{
  "event": "contact.updated",
  "event_id": "evt_contact_updated_794",
  "timestamp": "2026-02-23T11:05:00.333Z",
  "api_version": "2.0",
  
  "contact_id": "pb_contact_456",
  
  "changes": {
    "phone": {
      "old": "+15550123",
      "new": "+15559999"
    },
    "email": {
      "old": "jsmith@heritagecap.com",
      "new": "john.smith@heritagecap.com"
    },
    "title": {
      "old": "Managing Partner",
      "new": "Senior Managing Director"
    }
  },
  
  "updated_by": {
    "user_id": "pb_user_10",
    "name": "Sarah Johnson",
    "email": "sarah@sourceco.com"
  },
  
  "custom_fields": {
    "sourceco_contact_id": "sc_buyer_789"
  }
}
```

---

## Database Triggers & Stored Procedures

### Trigger: Update Contact Aggregates

**Purpose:** Automatically update contact call statistics when contact_activities change

```sql
-- Function to recalculate contact call statistics
CREATE OR REPLACE FUNCTION update_contact_call_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if it's a call-related activity
    IF NEW.activity_type IN ('call_attempt', 'call_connected', 'call_completed') THEN
        
        UPDATE contacts
        SET 
            -- Timestamps
            last_call_attempt_at = GREATEST(
                COALESCE(last_call_attempt_at, '1970-01-01'::timestamp),
                NEW.call_started_at
            ),
            last_call_connected_at = CASE 
                WHEN NEW.call_connected_at IS NOT NULL 
                THEN GREATEST(
                    COALESCE(last_call_connected_at, '1970-01-01'::timestamp),
                    NEW.call_connected_at
                )
                ELSE last_call_connected_at
            END,
            
            -- Counters (recalculate from contact_activities)
            total_call_attempts = (
                SELECT COUNT(*) 
                FROM contact_activities 
                WHERE contact_id = NEW.contact_id 
                    AND activity_type IN ('call_attempt', 'call_connected', 'call_completed')
            ),
            total_calls_connected = (
                SELECT COUNT(*) 
                FROM contact_activities 
                WHERE contact_id = NEW.contact_id 
                    AND call_connected_at IS NOT NULL
            ),
            total_call_duration_seconds = (
                SELECT COALESCE(SUM(call_duration_seconds), 0) 
                FROM contact_activities 
                WHERE contact_id = NEW.contact_id
            ),
            total_talk_time_seconds = (
                SELECT COALESCE(SUM(talk_time_seconds), 0) 
                FROM contact_activities 
                WHERE contact_id = NEW.contact_id 
                    AND talk_time_seconds IS NOT NULL
            ),
            
            -- Calculated fields
            connection_rate_percentage = CASE 
                WHEN (SELECT COUNT(*) FROM contact_activities WHERE contact_id = NEW.contact_id AND activity_type = 'call_attempt') > 0
                THEN (
                    (SELECT COUNT(*)::decimal FROM contact_activities WHERE contact_id = NEW.contact_id AND call_connected_at IS NOT NULL) /
                    (SELECT COUNT(*)::decimal FROM contact_activities WHERE contact_id = NEW.contact_id AND activity_type = 'call_attempt')
                ) * 100
                ELSE 0
            END,
            
            call_stats_last_calculated_at = NOW(),
            updated_at = NOW()
            
        WHERE id = NEW.contact_id;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_update_contact_call_stats ON contact_activities;
CREATE TRIGGER trg_update_contact_call_stats
    AFTER INSERT OR UPDATE ON contact_activities
    FOR EACH ROW
    EXECUTE FUNCTION update_contact_call_stats();
```

---

### Stored Procedure: Calculate Engagement Score

```sql
CREATE OR REPLACE FUNCTION calculate_contact_engagement_score(p_contact_id BIGINT)
RETURNS INTEGER AS $$
DECLARE
    v_score INTEGER := 50; -- Start at neutral 50
    v_connection_rate DECIMAL;
    v_avg_talk_time INTEGER;
    v_positive_dispositions INTEGER;
    v_negative_dispositions INTEGER;
    v_days_since_engaged INTEGER;
BEGIN
    -- Get contact statistics
    SELECT 
        connection_rate_percentage,
        total_talk_time_seconds / NULLIF(total_calls_connected, 0),
        (SELECT COUNT(*) FROM contact_activities 
         WHERE contact_id = p_contact_id 
            AND disposition_code IN ('INTERESTED', 'MEETING_SET', 'HOT_LEAD')),
        (SELECT COUNT(*) FROM contact_activities 
         WHERE contact_id = p_contact_id 
            AND disposition_code IN ('NOT_INTERESTED', 'NOT_A_FIT')),
        EXTRACT(DAY FROM (NOW() - last_engaged_call_at))
    INTO 
        v_connection_rate,
        v_avg_talk_time,
        v_positive_dispositions,
        v_negative_dispositions,
        v_days_since_engaged
    FROM contacts
    WHERE id = p_contact_id;
    
    -- Connection rate bonus (+/- 20 points)
    v_score := v_score + (v_connection_rate::INTEGER / 5);
    
    -- Talk time bonus (+/- 15 points)
    IF v_avg_talk_time > 180 THEN  -- >3 minutes
        v_score := v_score + 15;
    ELSIF v_avg_talk_time > 120 THEN  -- >2 minutes
        v_score := v_score + 10;
    ELSIF v_avg_talk_time > 60 THEN  -- >1 minute
        v_score := v_score + 5;
    END IF;
    
    -- Disposition bonus/penalty (+/- 30 points)
    v_score := v_score + (v_positive_dispositions * 10);
    v_score := v_score - (v_negative_dispositions * 15);
    
    -- Recency penalty (-20 points max)
    IF v_days_since_engaged > 180 THEN
        v_score := v_score - 20;
    ELSIF v_days_since_engaged > 90 THEN
        v_score := v_score - 10;
    ELSIF v_days_since_engaged > 30 THEN
        v_score := v_score - 5;
    END IF;
    
    -- Clamp to 0-100 range
    v_score := GREATEST(0, LEAST(100, v_score));
    
    -- Update contact
    UPDATE contacts 
    SET call_engagement_score = v_score,
        updated_at = NOW()
    WHERE id = p_contact_id;
    
    RETURN v_score;
END;
$$ LANGUAGE plpgsql;
```

---

## Sample Queries

### Query 1: Rep Performance Dashboard (Last 30 Days)

```sql
WITH rep_stats AS (
    SELECT 
        ca.user_id,
        ca.user_name,
        COUNT(*) FILTER (WHERE ca.activity_type = 'call_attempt') AS total_dials,
        COUNT(*) FILTER (WHERE ca.call_connected_at IS NOT NULL) AS total_connections,
        COUNT(DISTINCT ca.contact_id) AS unique_contacts_reached,
        SUM(ca.talk_time_seconds) FILTER (WHERE ca.talk_time_seconds IS NOT NULL) AS total_talk_time_seconds,
        AVG(ca.talk_time_seconds) FILTER (WHERE ca.talk_time_seconds IS NOT NULL) AS avg_talk_time_seconds,
        COUNT(*) FILTER (WHERE ca.disposition_code IN ('INTERESTED', 'MEETING_SET', 'HOT_LEAD')) AS qualified_leads,
        COUNT(*) FILTER (WHERE ca.disposition_code = 'MEETING_SET') AS meetings_scheduled
    FROM contact_activities ca
    WHERE ca.call_started_at >= NOW() - INTERVAL '30 days'
        AND ca.user_id IS NOT NULL
    GROUP BY ca.user_id, ca.user_name
)
SELECT 
    user_name AS "Rep Name",
    total_dials AS "Total Dials",
    total_connections AS "Connections",
    ROUND((total_connections::decimal / NULLIF(total_dials, 0)) * 100, 1) AS "Connection Rate %",
    ROUND(total_talk_time_seconds / 3600.0, 1) AS "Total Talk Time (Hours)",
    ROUND(avg_talk_time_seconds / 60.0, 1) AS "Avg Talk Time (Min)",
    qualified_leads AS "Qualified Leads",
    meetings_scheduled AS "Meetings Set",
    ROUND((qualified_leads::decimal / NULLIF(total_connections, 0)) * 100, 1) AS "Qualification Rate %"
FROM rep_stats
ORDER BY total_connections DESC;
```

---

### Query 2: Contacts Due for Follow-up Today

```sql
SELECT 
    c.id,
    c.first_name,
    c.last_name,
    c.company,
    c.phone,
    c.email,
    c.next_action_type,
    c.next_action_date,
    c.next_action_notes,
    c.last_disposition_label,
    c.last_call_attempt_at,
    u.name AS assigned_rep
FROM contacts c
LEFT JOIN users u ON c.next_action_assigned_to_user_id = u.id
WHERE c.next_action_date = CURRENT_DATE
    AND c.next_action_type = 'call'
    AND c.do_not_call = FALSE
    AND c.phone_number_invalid = FALSE
ORDER BY c.next_action_assigned_to_user_id, c.company;
```

---

### Query 3: Campaign Performance Comparison

```sql
SELECT 
    ps.session_name,
    ps.session_type,
    ps.total_contacts_added,
    ps.total_dials,
    ps.total_connections,
    ROUND((ps.total_connections::decimal / NULLIF(ps.total_dials, 0)) * 100, 1) AS connection_rate_pct,
    ps.total_qualified_leads,
    ROUND((ps.total_qualified_leads::decimal / NULLIF(ps.total_connections, 0)) * 100, 1) AS qualification_rate_pct,
    ps.total_meetings_scheduled,
    ROUND(ps.total_talk_time_seconds / 3600.0, 1) AS total_talk_hours,
    ps.last_activity_at
FROM phoneburner_sessions ps
WHERE ps.session_status = 'active'
    AND ps.started_at >= NOW() - INTERVAL '90 days'
ORDER BY ps.last_activity_at DESC;
```

---

### Query 4: Contact Timeline (All Activities)

```sql
SELECT 
    ca.created_at AS activity_date,
    CASE 
        WHEN ca.activity_type = 'call_attempt' THEN '📞 Call Attempt'
        WHEN ca.activity_type = 'call_connected' THEN '✅ Call Connected'
        WHEN ca.activity_type = 'call_completed' THEN '📞 Call Completed'
        WHEN ca.activity_type = 'disposition_set' THEN '📝 Disposition Set'
        ELSE ca.activity_type
    END AS activity_type,
    ca.call_outcome,
    ca.disposition_label,
    ca.call_duration_seconds,
    ca.talk_time_seconds,
    ca.user_name AS rep,
    SUBSTRING(ca.disposition_notes, 1, 100) AS notes_preview,
    ca.recording_url
FROM contact_activities ca
WHERE ca.contact_id = :contact_id
ORDER BY ca.created_at DESC
LIMIT 50;
```

---

This schema provides a robust foundation for tracking all calling activity, maintaining data integrity, and powering analytics across the SourceCo platform.
