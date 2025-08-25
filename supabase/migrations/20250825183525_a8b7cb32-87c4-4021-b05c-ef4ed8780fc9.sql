-- Map incorrect numeric-encoded revenue ranges to labeled strings for a specific user
-- Verification query (for reference): select email, revenue_range_min, revenue_range_max from profiles where email='adambhaile00@gmail.com';

-- Update this user's revenue ranges to labeled values
UPDATE public.profiles
SET 
  revenue_range_min = '$5M - $10M',
  revenue_range_max = '$25M - $50M',
  updated_at = now()
WHERE email = 'adambhaile00@gmail.com';