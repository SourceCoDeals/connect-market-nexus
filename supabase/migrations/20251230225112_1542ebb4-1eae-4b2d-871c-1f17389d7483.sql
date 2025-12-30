-- Remove duplicate triggers on auth.users
-- Keep only one trigger for handle_new_user and one for sync_user_verification_status

-- Drop duplicate handle_new_user trigger (keep on_auth_user_created)
DROP TRIGGER IF EXISTS on_auth_user_created_profiles ON auth.users;

-- Drop duplicate sync_user_verification_status trigger (keep on_auth_user_updated)
DROP TRIGGER IF EXISTS sync_user_verification_status ON auth.users;