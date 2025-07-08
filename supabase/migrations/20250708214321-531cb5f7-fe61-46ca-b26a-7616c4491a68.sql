
-- Add foreign key relationship between saved_listings and profiles tables
ALTER TABLE saved_listings 
ADD CONSTRAINT saved_listings_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
