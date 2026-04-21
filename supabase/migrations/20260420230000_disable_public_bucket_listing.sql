-- ============================================================================
-- MIGRATION: Disable listing on 7 public storage buckets
-- ============================================================================
-- Supabase advisor flagged 7 buckets where `public = true` AND a broad
-- storage.objects SELECT policy of the shape `bucket_id = 'X'` exists.
-- That combo means anyone can hit
--   /storage/v1/object/list/public/<bucket>
-- and enumerate every key in the bucket — leaking file-name / size / count
-- information regardless of whether individual objects are later auth-gated.
--
-- Public URL access (/storage/v1/object/public/<bucket>/<key>) works via the
-- bucket's `public = true` flag and does NOT require a SELECT policy — so
-- dropping the broad SELECT policies is safe for consumers that use
-- getPublicUrl()-style access patterns. Pre-flight codebase grep confirmed
-- zero calls to `.storage.from(<bucket>).list(...)` across src/ and
-- supabase/functions/, so no in-tree consumer relies on enumeration either.
--
-- Each bucket's existing INSERT/UPDATE/DELETE policies are left untouched —
-- those are what admins use for management.
--
-- The 2 sensitive buckets (`message-attachments`, `universe-documents`) get
-- the same listing fix here, but their `public = true` + `getPublicUrl()`
-- consumer code means anyone with a link can still fetch them. Making them
-- fully private is tracked as a separate follow-up (#5) because it requires
-- consumer refactoring (signed URLs generated at render time instead of
-- public URLs embedded in persisted message bodies).
-- ============================================================================

-- ─── 1. agreement-templates ────────────────────────────────────────────────
-- The broad SELECT policy permits listing; direct URL fetches use the
-- bucket's public flag path and will keep working.
DROP POLICY IF EXISTS "Agreement templates are publicly accessible" ON storage.objects;


-- ─── 2. listing-images ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can view listing images" ON storage.objects;


-- ─── 3. listings ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public to select from listings bucket" ON storage.objects;


-- ─── 4. listings-images ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public read access to listing images" ON storage.objects;


-- ─── 5. message-attachments ────────────────────────────────────────────────
-- NOTE: Bucket stays public=true for now. Consumer code in
-- src/pages/BuyerMessages/{MessageThread,GeneralChatView}.tsx embeds
-- getPublicUrl() output directly into message bodies, so switching the
-- bucket to private would break all historical attachments until the
-- consumer is refactored. Tracked as follow-up #5 in _sync_scratch/.
DROP POLICY IF EXISTS "Anyone can read message attachments" ON storage.objects;


-- ─── 6. sales-demo-images ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public read sales-demo-images" ON storage.objects;


-- ─── 7. universe-documents ────────────────────────────────────────────────
-- Same caveat as message-attachments — sensitive bucket staying public
-- because AIResearchSection/useGuideUpload + DocumentUploadSection use
-- getPublicUrl() for downstream viewing. Listing is disabled here, but the
-- full private migration is follow-up #5.
DROP POLICY IF EXISTS "Public read access for universe documents" ON storage.objects;


-- ─── 8. Re-scope mis-assigned universe-documents service policy ───────────
-- The existing policy named "Service role can manage universe documents" was
-- defined with roles = {public} instead of {service_role} — meaning any
-- anonymous or authenticated caller could INSERT/UPDATE/DELETE/SELECT. The
-- advisor flagged it as a listing leak but the bigger issue is the broad
-- write access. Recreating with the correct role target.
DROP POLICY IF EXISTS "Service role can manage universe documents" ON storage.objects;
CREATE POLICY "Service role can manage universe documents" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'universe-documents'::text)
  WITH CHECK (bucket_id = 'universe-documents'::text);
