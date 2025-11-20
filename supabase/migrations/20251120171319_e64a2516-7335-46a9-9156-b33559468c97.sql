-- Drop the existing foreign key that references auth.users
ALTER TABLE deal_sourcing_requests
DROP CONSTRAINT deal_sourcing_requests_user_id_fkey;

-- Add new foreign key that references profiles table
ALTER TABLE deal_sourcing_requests
ADD CONSTRAINT deal_sourcing_requests_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES profiles(id)
ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_deal_sourcing_requests_user_id 
ON deal_sourcing_requests(user_id);

-- Add comment for documentation
COMMENT ON CONSTRAINT deal_sourcing_requests_user_id_fkey 
ON deal_sourcing_requests 
IS 'Links deal sourcing request to the user profile who created it';