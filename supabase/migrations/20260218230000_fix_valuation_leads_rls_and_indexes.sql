-- ============================================================
-- Fix valuation_leads RLS policy and add missing indexes
-- ============================================================

-- ─── 1. Replace broken RLS policy ───
-- Current policy checks profiles.role = 'admin' which is deprecated.
-- The source of truth is profiles.is_admin (synced from user_roles table).

DROP POLICY IF EXISTS "Admin full access to valuation_leads" ON valuation_leads;

CREATE POLICY "Admin full access to valuation_leads"
  ON valuation_leads
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- ─── 2. Add composite index for dedup trigger performance ───
-- The prevent_valuation_lead_duplicates() trigger queries by
-- LOWER(email) + calculator_type on every INSERT.
CREATE INDEX IF NOT EXISTS idx_valuation_leads_email_calctype
  ON valuation_leads (LOWER(email), calculator_type)
  WHERE excluded = false;

-- ─── 3. Fix malformed email (trailing double-quote) ───
UPDATE valuation_leads
SET email = REPLACE(email, '"', '')
WHERE email LIKE '%"%';
