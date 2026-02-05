-- Make description and category nullable so deals can be created with just name + website
-- These fields will be populated by AI enrichment from the company website

ALTER TABLE public.listings 
  ALTER COLUMN description DROP NOT NULL;

ALTER TABLE public.listings 
  ALTER COLUMN category DROP NOT NULL;