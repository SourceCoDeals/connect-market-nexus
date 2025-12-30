-- Update the test user adambhaile00@gmail.com with referral and deal sourcing data
-- This user was created before the trigger fix, so these fields are NULL

UPDATE public.profiles 
SET 
    referral_source = 'linkedin', 
    referral_source_detail = 'Saw a post about deal sourcing', 
    deal_sourcing_methods = ARRAY['brokers', 'direct_outreach', 'proprietary_network']::text[], 
    target_acquisition_volume = '3_5',
    updated_at = now()
WHERE email = 'adambhaile00@gmail.com';