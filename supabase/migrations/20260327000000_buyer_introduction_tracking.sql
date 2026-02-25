-- Migration: 20260327000000_buyer_introduction_tracking.sql
-- Tracks buyer introduction status: not yet introduced vs introduced & passed

-- 1. Buyer Introductions Table
CREATE TABLE IF NOT EXISTS buyer_introductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  buyer_name text NOT NULL,
  buyer_firm_name text NOT NULL,
  buyer_email text,
  buyer_phone text,
  buyer_linkedin_url text,
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  company_id text,
  introduction_status text NOT NULL DEFAULT 'not_introduced' CHECK (
    introduction_status IN ('not_introduced', 'introduction_scheduled', 'introduced', 'passed', 'rejected')
  ),
  targeting_reason text,
  expected_deal_size_low numeric(15,2),
  expected_deal_size_high numeric(15,2),
  internal_champion text,
  internal_champion_email text,
  introduction_scheduled_date date,
  introduction_date date,
  introduced_by text,
  introduced_by_email text,
  introduction_method text,
  introduction_notes text,
  passed_date date,
  passed_reason text,
  passed_notes text,
  buyer_feedback text,
  next_step text,
  expected_next_step_date date,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

-- 2. Introduction Audit Log
CREATE TABLE IF NOT EXISTS introduction_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_introduction_id uuid NOT NULL REFERENCES buyer_introductions(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  reason text,
  changed_by uuid NOT NULL REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Introduction Activity Log
CREATE TABLE IF NOT EXISTS introduction_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_introduction_id uuid NOT NULL REFERENCES buyer_introductions(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (
    activity_type IN ('email_sent', 'call_made', 'meeting_scheduled', 'feedback_received', 'status_update', 'note_added')
  ),
  activity_date timestamptz NOT NULL DEFAULT now(),
  description text,
  actor text,
  metadata jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_buyer_introductions_listing ON buyer_introductions(listing_id);
CREATE INDEX IF NOT EXISTS idx_buyer_introductions_status ON buyer_introductions(introduction_status);
CREATE INDEX IF NOT EXISTS idx_buyer_introductions_created ON buyer_introductions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_buyer_introductions_contact ON buyer_introductions(contact_id);
CREATE INDEX IF NOT EXISTS idx_buyer_introductions_created_by ON buyer_introductions(created_by);
CREATE INDEX IF NOT EXISTS idx_introduction_status_log_buyer ON introduction_status_log(buyer_introduction_id);
CREATE INDEX IF NOT EXISTS idx_introduction_activity_buyer ON introduction_activity(buyer_introduction_id);
CREATE INDEX IF NOT EXISTS idx_introduction_activity_date ON introduction_activity(activity_date DESC);

-- RLS (Row Level Security)
ALTER TABLE buyer_introductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE introduction_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE introduction_activity ENABLE ROW LEVEL SECURITY;

-- Policies: Admins can do everything, regular users can view their own
DROP POLICY IF EXISTS buyer_introductions_admin_all ON buyer_introductions;
CREATE POLICY buyer_introductions_admin_all ON buyer_introductions
  FOR ALL
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS buyer_introductions_creator_select ON buyer_introductions;
CREATE POLICY buyer_introductions_creator_select ON buyer_introductions
  FOR SELECT
  USING (auth.uid() = created_by);

DROP POLICY IF EXISTS introduction_status_log_admin_all ON introduction_status_log;
CREATE POLICY introduction_status_log_admin_all ON introduction_status_log
  FOR ALL
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS introduction_activity_admin_all ON introduction_activity;
CREATE POLICY introduction_activity_admin_all ON introduction_activity
  FOR ALL
  USING (is_admin(auth.uid()));

-- Views
CREATE OR REPLACE VIEW not_yet_introduced_buyers AS
SELECT
  bi.id, bi.buyer_name, bi.buyer_firm_name,
  bi.buyer_email, bi.buyer_phone, bi.buyer_linkedin_url,
  bi.company_name, bi.targeting_reason,
  bi.expected_deal_size_low, bi.expected_deal_size_high,
  bi.internal_champion, bi.created_at, bi.listing_id,
  COALESCE((SELECT COUNT(*) FROM introduction_activity WHERE buyer_introduction_id = bi.id), 0) as activity_count,
  COALESCE((SELECT MAX(activity_date) FROM introduction_activity WHERE buyer_introduction_id = bi.id), bi.created_at) as last_activity
FROM buyer_introductions bi
WHERE bi.introduction_status = 'not_introduced'
  AND bi.archived_at IS NULL
ORDER BY bi.created_at DESC;

CREATE OR REPLACE VIEW introduced_and_passed_buyers AS
SELECT
  bi.id, bi.buyer_name, bi.buyer_firm_name,
  bi.company_name, bi.introduction_date, bi.introduced_by,
  bi.passed_date, bi.passed_reason, bi.buyer_feedback,
  bi.next_step, bi.expected_next_step_date, bi.listing_id,
  CASE
    WHEN bi.introduction_status = 'introduced' THEN 'Awaiting Outcome'
    WHEN bi.introduction_status = 'passed' THEN 'Moving Forward'
    WHEN bi.introduction_status = 'rejected' THEN 'Not Interested'
  END as stage,
  (CURRENT_DATE - bi.introduction_date) as days_since_introduction
FROM buyer_introductions bi
WHERE bi.introduction_status IN ('introduced', 'passed', 'rejected')
  AND bi.archived_at IS NULL
ORDER BY
  CASE WHEN bi.introduction_status = 'passed' THEN 0 ELSE 1 END,
  bi.passed_date DESC NULLS LAST;

CREATE OR REPLACE VIEW buyer_introduction_summary AS
SELECT
  l.id as listing_id,
  l.title as company_name,
  COUNT(CASE WHEN bi.introduction_status = 'not_introduced' THEN 1 END) as pending_introductions,
  COUNT(CASE WHEN bi.introduction_status = 'introduced' THEN 1 END) as introduced_awaiting_outcome,
  COUNT(CASE WHEN bi.introduction_status = 'passed' THEN 1 END) as passed_buyers,
  COUNT(CASE WHEN bi.introduction_status = 'rejected' THEN 1 END) as rejected_buyers,
  COUNT(*) as total_tracked_buyers
FROM listings l
LEFT JOIN buyer_introductions bi ON l.id = bi.listing_id
WHERE l.deleted_at IS NULL
GROUP BY l.id, l.title
ORDER BY l.title;
