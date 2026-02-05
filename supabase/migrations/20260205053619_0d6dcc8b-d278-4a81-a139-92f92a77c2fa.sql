-- Add company overview and geographic location columns to remarketing_buyers
ALTER TABLE remarketing_buyers
ADD COLUMN IF NOT EXISTS founded_year INTEGER,
ADD COLUMN IF NOT EXISTS num_employees INTEGER,
ADD COLUMN IF NOT EXISTS employee_range TEXT,
ADD COLUMN IF NOT EXISTS number_of_locations INTEGER,
ADD COLUMN IF NOT EXISTS operating_locations TEXT[];

-- Add index on operating_locations for geographic queries
CREATE INDEX IF NOT EXISTS idx_remarketing_buyers_operating_locations 
ON remarketing_buyers USING GIN(operating_locations);