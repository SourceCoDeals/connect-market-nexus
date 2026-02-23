
-- ========================================
-- Phoneburner Integration: Phase 1 Schema
-- ========================================

-- 1. Phoneburner Sessions table
CREATE TABLE public.phoneburner_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    phoneburner_session_id TEXT UNIQUE,
    session_name TEXT NOT NULL,
    session_description TEXT,
    session_type TEXT DEFAULT 'buyer_outreach',
    contact_type TEXT DEFAULT 'buyer',
    target_industry TEXT,
    target_geography TEXT,
    total_contacts_added INTEGER DEFAULT 0,
    total_contacts_active INTEGER DEFAULT 0,
    total_contacts_completed INTEGER DEFAULT 0,
    total_dials INTEGER DEFAULT 0,
    total_connections INTEGER DEFAULT 0,
    total_decision_maker_conversations INTEGER DEFAULT 0,
    total_voicemails_left INTEGER DEFAULT 0,
    total_no_answers INTEGER DEFAULT 0,
    total_call_time_seconds INTEGER DEFAULT 0,
    total_talk_time_seconds INTEGER DEFAULT 0,
    total_qualified_leads INTEGER DEFAULT 0,
    total_meetings_scheduled INTEGER DEFAULT 0,
    total_disqualified INTEGER DEFAULT 0,
    total_callbacks_scheduled INTEGER DEFAULT 0,
    connection_rate_percentage DECIMAL(5,2),
    qualification_rate_percentage DECIMAL(5,2),
    session_status TEXT DEFAULT 'active',
    started_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.phoneburner_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage phoneburner sessions"
ON public.phoneburner_sessions FOR ALL
USING (public.is_admin(auth.uid()));

CREATE INDEX idx_pb_sessions_status ON public.phoneburner_sessions(session_status);
CREATE INDEX idx_pb_sessions_last_activity ON public.phoneburner_sessions(last_activity_at DESC);
CREATE INDEX idx_pb_sessions_created_by ON public.phoneburner_sessions(created_by_user_id);

-- 2. Contact Activities table
CREATE TABLE public.contact_activities (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    remarketing_buyer_id UUID REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    phoneburner_session_id UUID REFERENCES public.phoneburner_sessions(id) ON DELETE SET NULL,
    activity_type TEXT NOT NULL,
    source_system TEXT NOT NULL DEFAULT 'phoneburner',
    call_started_at TIMESTAMPTZ,
    call_connected_at TIMESTAMPTZ,
    call_ended_at TIMESTAMPTZ,
    call_duration_seconds INTEGER,
    talk_time_seconds INTEGER,
    call_outcome TEXT,
    answered_by TEXT,
    disposition_code TEXT,
    disposition_label TEXT,
    disposition_notes TEXT,
    disposition_set_at TIMESTAMPTZ,
    callback_scheduled_date TIMESTAMPTZ,
    callback_completed_at TIMESTAMPTZ,
    callback_outcome TEXT,
    recording_url TEXT,
    recording_duration_seconds INTEGER,
    user_name TEXT,
    user_email TEXT,
    phoneburner_call_id TEXT,
    phoneburner_contact_id TEXT,
    phoneburner_event_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage contact activities"
ON public.contact_activities FOR ALL
USING (public.is_admin(auth.uid()));

CREATE INDEX idx_ca_contact_id ON public.contact_activities(contact_id);
CREATE INDEX idx_ca_buyer_id ON public.contact_activities(remarketing_buyer_id);
CREATE INDEX idx_ca_user_id ON public.contact_activities(user_id);
CREATE INDEX idx_ca_type ON public.contact_activities(activity_type);
CREATE INDEX idx_ca_created_at ON public.contact_activities(created_at DESC);
CREATE INDEX idx_ca_disposition ON public.contact_activities(disposition_code) WHERE disposition_code IS NOT NULL;
CREATE INDEX idx_ca_pb_call_id ON public.contact_activities(phoneburner_call_id) WHERE phoneburner_call_id IS NOT NULL;
CREATE INDEX idx_ca_pb_event_id ON public.contact_activities(phoneburner_event_id) WHERE phoneburner_event_id IS NOT NULL;
CREATE INDEX idx_ca_contact_date ON public.contact_activities(contact_id, call_started_at DESC);

-- 3. Phoneburner Webhooks Log table
CREATE TABLE public.phoneburner_webhooks_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id TEXT UNIQUE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    phoneburner_call_id TEXT,
    phoneburner_contact_id TEXT,
    sourceco_contact_id UUID,
    phoneburner_user_id TEXT,
    phoneburner_session_id TEXT,
    processing_status TEXT NOT NULL DEFAULT 'pending',
    processing_error TEXT,
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    processing_duration_ms INTEGER,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    signature_valid BOOLEAN,
    ip_address INET,
    contact_activity_id UUID REFERENCES public.contact_activities(id) ON DELETE SET NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.phoneburner_webhooks_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook logs"
ON public.phoneburner_webhooks_log FOR ALL
USING (public.is_admin(auth.uid()));

CREATE INDEX idx_wh_event_type ON public.phoneburner_webhooks_log(event_type);
CREATE INDEX idx_wh_status ON public.phoneburner_webhooks_log(processing_status) WHERE processing_status IN ('pending', 'failed');
CREATE INDEX idx_wh_received_at ON public.phoneburner_webhooks_log(received_at DESC);
CREATE INDEX idx_wh_pb_contact ON public.phoneburner_webhooks_log(phoneburner_contact_id) WHERE phoneburner_contact_id IS NOT NULL;

-- 4. Disposition Mappings table
CREATE TABLE public.disposition_mappings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    phoneburner_disposition_code TEXT UNIQUE NOT NULL,
    phoneburner_disposition_label TEXT,
    sourceco_contact_status TEXT,
    sourceco_contact_stage TEXT,
    trigger_workflow BOOLEAN DEFAULT FALSE,
    workflow_name TEXT,
    workflow_config JSONB,
    create_task BOOLEAN DEFAULT FALSE,
    task_type TEXT,
    task_due_offset_days INTEGER,
    task_priority TEXT DEFAULT 'medium',
    suppress_contact BOOLEAN DEFAULT FALSE,
    suppress_duration_days INTEGER,
    mark_phone_invalid BOOLEAN DEFAULT FALSE,
    mark_do_not_call BOOLEAN DEFAULT FALSE,
    next_action_type TEXT,
    next_action_offset_days INTEGER,
    engagement_score_delta INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.disposition_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage disposition mappings"
ON public.disposition_mappings FOR ALL
USING (public.is_admin(auth.uid()));

-- 5. Seed default disposition mappings
INSERT INTO public.disposition_mappings (phoneburner_disposition_code, phoneburner_disposition_label, sourceco_contact_status, sourceco_contact_stage, trigger_workflow, workflow_name, create_task, task_type, task_due_offset_days, engagement_score_delta) VALUES
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

-- Mark special flags
UPDATE public.disposition_mappings SET mark_phone_invalid = TRUE WHERE phoneburner_disposition_code = 'WRONG_NUMBER';
UPDATE public.disposition_mappings SET mark_do_not_call = TRUE, suppress_contact = TRUE, suppress_duration_days = 9999 WHERE phoneburner_disposition_code = 'DO_NOT_CALL';

-- 6. Add call tracking columns to contacts table
ALTER TABLE public.contacts
    ADD COLUMN IF NOT EXISTS last_call_attempt_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_call_connected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS total_call_attempts INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_calls_connected INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_call_duration_seconds INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS phoneburner_contact_id TEXT,
    ADD COLUMN IF NOT EXISTS phoneburner_last_sync_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS do_not_call BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS do_not_call_reason TEXT,
    ADD COLUMN IF NOT EXISTS phone_number_invalid BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS next_action_type TEXT,
    ADD COLUMN IF NOT EXISTS next_action_date DATE,
    ADD COLUMN IF NOT EXISTS next_action_notes TEXT,
    ADD COLUMN IF NOT EXISTS last_disposition_code TEXT,
    ADD COLUMN IF NOT EXISTS last_disposition_label TEXT,
    ADD COLUMN IF NOT EXISTS last_disposition_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_pb_id ON public.contacts(phoneburner_contact_id) WHERE phoneburner_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_last_call ON public.contacts(last_call_attempt_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_next_action ON public.contacts(next_action_date) WHERE next_action_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_dnc ON public.contacts(do_not_call) WHERE do_not_call = TRUE;

-- 7. Updated_at triggers
CREATE TRIGGER update_phoneburner_sessions_updated_at
    BEFORE UPDATE ON public.phoneburner_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contact_activities_updated_at
    BEFORE UPDATE ON public.contact_activities
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_webhooks_log_updated_at
    BEFORE UPDATE ON public.phoneburner_webhooks_log
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_disposition_mappings_updated_at
    BEFORE UPDATE ON public.disposition_mappings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
