-- Add 'not_a_fit' to the remarketing_status enum
-- This allows deals to be marked as "Not a Fit" and hidden from lead tracker views

ALTER TYPE remarketing_status ADD VALUE IF NOT EXISTS 'not_a_fit';

-- Add not_a_fit status to owner_seller_leads as well
-- Owner leads use a separate 'status' text column, so add it to the status options
COMMENT ON TYPE remarketing_status IS 'Remarketing pipeline status: active, archived, not_a_fit';
