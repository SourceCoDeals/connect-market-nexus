
-- Migration: profiles_remarketing_buyer_fk
-- Adds remarketing_buyer_id to profiles for direct org link

-- 1. Add column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS remarketing_buyer_id UUID REFERENCES public.remarketing_buyers(id) ON DELETE SET NULL;

-- 2. Performance index
CREATE INDEX IF NOT EXISTS idx_profiles_remarketing_buyer
  ON public.profiles(remarketing_buyer_id)
  WHERE remarketing_buyer_id IS NOT NULL;

-- 3. Backfill: match via contacts table (profile_id → remarketing_buyer_id)
UPDATE public.profiles p
SET remarketing_buyer_id = c.remarketing_buyer_id
FROM public.contacts c
WHERE p.remarketing_buyer_id IS NULL
  AND c.profile_id = p.id
  AND c.contact_type = 'buyer'
  AND c.remarketing_buyer_id IS NOT NULL
  AND c.archived = false;
