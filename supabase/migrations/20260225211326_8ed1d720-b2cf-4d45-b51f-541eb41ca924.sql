-- Fix: Replace the ALL policy with separate SELECT and INSERT/UPDATE/DELETE policies
-- The current ALL policy lacks WITH CHECK, causing inserts to fail

DROP POLICY IF EXISTS "Admins can manage contact lists" ON contact_lists;

CREATE POLICY "Admins can read contact lists"
  ON contact_lists FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert contact lists"
  ON contact_lists FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update contact lists"
  ON contact_lists FOR UPDATE
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete contact lists"
  ON contact_lists FOR DELETE
  USING (is_admin(auth.uid()));

-- Also check contact_list_members
DROP POLICY IF EXISTS "Admins can manage contact list members" ON contact_list_members;

CREATE POLICY "Admins can read contact list members"
  ON contact_list_members FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert contact list members"
  ON contact_list_members FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update contact list members"
  ON contact_list_members FOR UPDATE
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete contact list members"
  ON contact_list_members FOR DELETE
  USING (is_admin(auth.uid()));