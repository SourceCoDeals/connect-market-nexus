-- Make location and revenue nullable so deals can be created with just name + website
-- These fields will be populated by AI enrichment from the company website

ALTER TABLE public.listings 
  ALTER COLUMN location DROP NOT NULL;

ALTER TABLE public.listings 
  ALTER COLUMN revenue DROP NOT NULL;

ALTER TABLE public.listings 
  ALTER COLUMN ebitda DROP NOT NULL;