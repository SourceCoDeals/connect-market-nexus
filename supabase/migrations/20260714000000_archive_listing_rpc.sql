-- ============================================================================
-- MIGRATION: archive_listing / restore_listing RPCs
-- ============================================================================
-- Fixes "Failed to archive deal" errors in the remarketing deal pages
-- (GP Partner Deals, SourceCo Deals, CapTarget Deals, Referral Partner Deals,
-- ReMarketing Deals). Multiple pages previously did a direct
--
--   supabase.from('listings').update({ remarketing_status: 'archived',
--                                       archive_reason: reason })
--
-- from the authenticated client. That path is sensitive to the combination
-- of RLS on `listings`, the `audit_listings_trigger` writing to `audit_logs`
-- (which has a `WITH CHECK (false)` INSERT policy), and at least one buggy
-- caller (usePartnerActions.handleBulkArchive) that set `status='archived'`
-- — an invalid value for the `listings.status` CHECK constraint — and a
-- non-existent `archived_at` column.
--
-- Consolidating every archive path onto a single SECURITY DEFINER RPC
-- gives us one place to enforce admin authorization, skip triggers that
-- would otherwise block the write, and write the correct columns
-- (`remarketing_status`, `archive_reason`, `updated_at`) every time.
--
-- The companion `restore_listing` RPC is provided so the Archived Deals
-- page can restore a listing through the same trusted path.
-- ============================================================================

-- ─── 1. archive_listing(p_listing_id, p_reason) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.archive_listing(
  p_listing_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can archive listings';
  END IF;

  UPDATE public.listings
  SET
    remarketing_status = 'archived',
    archive_reason = p_reason,
    updated_at = now()
  WHERE id = p_listing_id
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.archive_listing(uuid, text) IS
  'Archive a single listing by setting remarketing_status=''archived'' and '
  'archive_reason. Admin-only. SECURITY DEFINER so it bypasses any RLS on '
  'listings and reliably runs the audit trigger regardless of session role.';

GRANT EXECUTE ON FUNCTION public.archive_listing(uuid, text) TO authenticated;


-- ─── 2. archive_listings_bulk(p_listing_ids, p_reason) ──────────────────────
CREATE OR REPLACE FUNCTION public.archive_listings_bulk(
  p_listing_ids uuid[],
  p_reason text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can archive listings';
  END IF;

  IF p_listing_ids IS NULL OR array_length(p_listing_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.listings
  SET
    remarketing_status = 'archived',
    archive_reason = p_reason,
    updated_at = now()
  WHERE id = ANY(p_listing_ids)
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.archive_listings_bulk(uuid[], text) IS
  'Bulk-archive listings. Admin-only. Returns number of rows updated.';

GRANT EXECUTE ON FUNCTION public.archive_listings_bulk(uuid[], text) TO authenticated;


-- ─── 3. restore_listing(p_listing_id) ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.restore_listing(
  p_listing_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can restore listings';
  END IF;

  UPDATE public.listings
  SET
    remarketing_status = 'active',
    archive_reason = NULL,
    updated_at = now()
  WHERE id = p_listing_id
    AND remarketing_status = 'archived';

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.restore_listing(uuid) IS
  'Restore a previously archived listing (remarketing_status=''archived'') '
  'to active status and clear its archive_reason. Admin-only.';

GRANT EXECUTE ON FUNCTION public.restore_listing(uuid) TO authenticated;
