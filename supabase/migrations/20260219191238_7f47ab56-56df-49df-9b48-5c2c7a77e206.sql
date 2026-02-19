
-- Step 1: Drop the existing FK pointing to 'deals'
ALTER TABLE public.deal_activities 
  DROP CONSTRAINT deal_activities_deal_id_fkey;

-- Step 2: Delete orphaned rows (deal_ids not in listings)
DELETE FROM public.deal_activities
WHERE deal_id NOT IN (SELECT id FROM public.listings);

-- Step 3: Add FK pointing to listings
ALTER TABLE public.deal_activities
  ADD CONSTRAINT deal_activities_deal_id_fkey
  FOREIGN KEY (deal_id) REFERENCES public.listings(id) ON DELETE CASCADE;
