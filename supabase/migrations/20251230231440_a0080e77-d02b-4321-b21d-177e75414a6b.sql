-- Backfill referral source fields for adambhaile00@gmail.com from auth.users metadata
UPDATE public.profiles p
SET 
  referral_source = NULLIF(au.raw_user_meta_data->>'referral_source', ''),
  referral_source_detail = NULLIF(au.raw_user_meta_data->>'referral_source_detail', ''),
  target_acquisition_volume = NULLIF(au.raw_user_meta_data->>'target_acquisition_volume', ''),
  deal_sourcing_methods = ARRAY(
    SELECT jsonb_array_elements_text(
      COALESCE(au.raw_user_meta_data->'deal_sourcing_methods', '[]'::jsonb)
    )
  )
FROM auth.users au
WHERE p.id = au.id
  AND p.email = 'adambhaile00@gmail.com'
  AND p.referral_source IS NULL;