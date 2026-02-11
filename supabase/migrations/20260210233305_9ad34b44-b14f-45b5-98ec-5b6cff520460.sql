
-- Prevent duplicate buyers within the same universe by name
CREATE UNIQUE INDEX IF NOT EXISTS idx_remarketing_buyers_unique_name 
ON remarketing_buyers (universe_id, lower(trim(company_name)), lower(trim(COALESCE(pe_firm_name, ''))))
WHERE archived = false;

-- Prevent duplicate buyers within the same universe by website domain
CREATE UNIQUE INDEX IF NOT EXISTS idx_remarketing_buyers_unique_website
ON remarketing_buyers (universe_id, lower(trim(company_website)))
WHERE archived = false AND company_website IS NOT NULL AND company_website != '';
