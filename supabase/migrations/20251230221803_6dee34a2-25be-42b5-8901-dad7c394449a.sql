-- Clear the fake sample data for adambhaile00@gmail.com
-- This user signed up before the new fields were implemented, so these should be NULL

UPDATE public.profiles 
SET 
    referral_source = NULL, 
    referral_source_detail = NULL, 
    deal_sourcing_methods = NULL, 
    target_acquisition_volume = NULL,
    updated_at = now()
WHERE email = 'adambhaile00@gmail.com';