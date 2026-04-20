-- Backfill ideal_target_description from buyers.thesis_summary
UPDATE public.profiles p
SET ideal_target_description = b.thesis_summary,
    updated_at = now()
FROM public.buyers b
WHERE p.remarketing_buyer_id = b.id
  AND b.thesis_summary IS NOT NULL
  AND b.thesis_summary != ''
  AND (p.ideal_target_description IS NULL OR p.ideal_target_description = '');

-- Backfill target_locations from buyers.target_geographies (text[] -> jsonb)
UPDATE public.profiles p
SET target_locations = to_jsonb(b.target_geographies),
    updated_at = now()
FROM public.buyers b
WHERE p.remarketing_buyer_id = b.id
  AND b.target_geographies IS NOT NULL
  AND array_length(b.target_geographies, 1) > 0
  AND (p.target_locations IS NULL OR p.target_locations = '[]'::jsonb OR p.target_locations = 'null'::jsonb);