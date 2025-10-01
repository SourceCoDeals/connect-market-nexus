-- Fix deal_activities RLS policies to use direct profile check
-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage all deal activities" ON deal_activities;

-- Create new comprehensive policies that check profiles table directly
CREATE POLICY "Admins can view all deal activities"
  ON deal_activities
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert deal activities"
  ON deal_activities
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update deal activities"
  ON deal_activities
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete deal activities"
  ON deal_activities
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );