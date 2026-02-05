-- Mark any listing that has remarketing scores as an internal/research deal so it never appears in the public marketplace
UPDATE public.listings l
SET is_internal_deal = true,
    updated_at = now()
WHERE coalesce(l.is_internal_deal, false) = false
  AND l.deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.remarketing_scores rs
    WHERE rs.listing_id = l.id
  );