-- ============================================================================
-- MIGRATION: Widen contacts_contact_type_check to include 'portal_user'
-- ============================================================================
-- This was originally part of 20260625000004_extend_contacts_schema but was
-- deferred during the 2026-04-20 sync column backfill until we could verify
-- no existing rows violate the widened CHECK.
--
-- Pre-flight:
--   SELECT contact_type, COUNT(*) FROM public.contacts
--   WHERE contact_type NOT IN ('buyer','seller','advisor','internal','portal_user')
--   GROUP BY 1;
-- returned zero rows (2026-04-20).
-- ============================================================================

ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_contact_type_check;

ALTER TABLE public.contacts ADD CONSTRAINT contacts_contact_type_check
  CHECK (contact_type IN ('buyer', 'seller', 'advisor', 'internal', 'portal_user'));
