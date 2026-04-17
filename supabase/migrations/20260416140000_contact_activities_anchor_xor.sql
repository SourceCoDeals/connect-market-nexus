-- =============================================================================
-- contact_activities anchor XOR constraint
-- =============================================================================
-- smartlead_messages and heyreach_messages both enforce a CHECK constraint
-- that prevents a single row from carrying BOTH remarketing_buyer_id (buyer
-- anchor) and listing_id (seller anchor) — buyer outreach tracks at the firm,
-- seller outreach tracks at the deal, and mixing the two produces ambiguous
-- rollups downstream.
--
-- contact_activities has no such constraint, so a buggy webhook resolution
-- path could theoretically write a PhoneBurner call with both anchors set
-- and nothing would catch it. Prod currently has zero such rows (verified
-- before adding this constraint), so the CHECK applies cleanly.
--
-- The constraint allows either 0 or 1 of the two to be set — an unmatched
-- call legitimately has neither. Only the "both non-null" state is rejected.
-- =============================================================================

-- Pre-flight: confirm no existing rows violate. If any do, bail with a clear
-- error so the migration fails loudly instead of silently dropping the CHECK.
DO $$
DECLARE
  v_violations INTEGER;
BEGIN
  SELECT count(*) INTO v_violations
  FROM contact_activities
  WHERE remarketing_buyer_id IS NOT NULL AND listing_id IS NOT NULL;

  IF v_violations > 0 THEN
    RAISE EXCEPTION
      'Cannot add contact_activities_anchor_xor: % rows have both remarketing_buyer_id and listing_id set. '
      'Resolve them first (pick one side) before reapplying this migration.',
      v_violations;
  END IF;
END $$;

ALTER TABLE public.contact_activities
  DROP CONSTRAINT IF EXISTS contact_activities_anchor_xor;

ALTER TABLE public.contact_activities
  ADD CONSTRAINT contact_activities_anchor_xor
  CHECK (
    NOT (remarketing_buyer_id IS NOT NULL AND listing_id IS NOT NULL)
  );

COMMENT ON CONSTRAINT contact_activities_anchor_xor ON public.contact_activities IS
  'Buyer outreach anchors to remarketing_buyer_id; seller outreach anchors to '
  'listing_id. A single activity row may carry zero or one of the two, never '
  'both. Mirrors the XOR constraints on smartlead_messages and heyreach_messages.';
