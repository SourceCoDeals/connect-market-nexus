-- Add admin-only internal fields and deal identifier to listings table
ALTER TABLE public.listings 
ADD COLUMN deal_identifier TEXT UNIQUE,
ADD COLUMN internal_company_name TEXT,
ADD COLUMN internal_primary_owner TEXT,
ADD COLUMN internal_salesforce_link TEXT,
ADD COLUMN internal_deal_memo_link TEXT,
ADD COLUMN internal_contact_info TEXT,
ADD COLUMN internal_notes TEXT;

-- Create index for deal_identifier for fast lookups
CREATE INDEX idx_listings_deal_identifier ON public.listings(deal_identifier);

-- Function to generate deal identifier
CREATE OR REPLACE FUNCTION generate_deal_identifier()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_year TEXT;
    next_sequence INTEGER;
    new_identifier TEXT;
BEGIN
    -- Get current year
    current_year := EXTRACT(year FROM NOW())::TEXT;
    
    -- Get next sequence number for this year
    SELECT COALESCE(MAX(
        CASE 
            WHEN deal_identifier ~ ('^SCO-' || current_year || '-[0-9]+$')
            THEN CAST(SUBSTRING(deal_identifier FROM '[0-9]+$') AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO next_sequence
    FROM public.listings;
    
    -- Format the identifier
    new_identifier := 'SCO-' || current_year || '-' || LPAD(next_sequence::TEXT, 3, '0');
    
    RETURN new_identifier;
END;
$$;

-- Auto-generate deal identifiers for existing listings
UPDATE public.listings 
SET deal_identifier = generate_deal_identifier()
WHERE deal_identifier IS NULL;

-- Create trigger to auto-generate deal identifier for new listings
CREATE OR REPLACE FUNCTION auto_generate_deal_identifier()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.deal_identifier IS NULL THEN
        NEW.deal_identifier := generate_deal_identifier();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_generate_deal_identifier
    BEFORE INSERT ON public.listings
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_deal_identifier();