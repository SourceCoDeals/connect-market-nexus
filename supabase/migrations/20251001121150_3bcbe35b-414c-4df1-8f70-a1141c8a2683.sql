-- Phase 1: Update Pipeline Stages to match requirements (Fixed)
-- This migration updates existing stages and adds the new "Buyer/Seller Call" stage

-- First, update existing stage names
UPDATE deal_stages 
SET 
  name = 'Approved',
  updated_at = NOW()
WHERE name = 'Qualified';

UPDATE deal_stages 
SET 
  name = 'Info Sent',
  updated_at = NOW()
WHERE name = 'Information Sent';

-- Deactivate stages we don't need (preserving data, not deleting)
-- Set their positions to high numbers to avoid conflicts
UPDATE deal_stages 
SET 
  is_active = false,
  position = 100 + position,
  updated_at = NOW()
WHERE name IN ('Under Contract', 'Closed Won');

-- Temporarily set all active stage positions to high numbers to avoid conflicts
UPDATE deal_stages
SET position = 1000 + position
WHERE is_active = true;

-- Insert the new "Buyer/Seller Call" stage
INSERT INTO deal_stages (name, description, position, color, is_active, is_default)
VALUES (
  'Buyer/Seller Call',
  'Scheduled or completed call between buyer and seller',
  1004, -- Temporary high position
  '#8b5cf6', -- Purple color to distinguish from other stages
  true,
  false
)
ON CONFLICT DO NOTHING;

-- Now reassign correct positions for all active stages
-- Final order: New Inquiry(0), Initial Review(1), Approved(2), Info Sent(3), Buyer/Seller Call(4), Due Diligence(5), LOI Submitted(6)

UPDATE deal_stages SET position = 0, updated_at = NOW() WHERE name = 'New Inquiry' AND is_active = true;
UPDATE deal_stages SET position = 1, updated_at = NOW() WHERE name = 'Initial Review' AND is_active = true;
UPDATE deal_stages SET position = 2, updated_at = NOW() WHERE name = 'Approved' AND is_active = true;
UPDATE deal_stages SET position = 3, updated_at = NOW() WHERE name = 'Info Sent' AND is_active = true;
UPDATE deal_stages SET position = 4, updated_at = NOW() WHERE name = 'Buyer/Seller Call' AND is_active = true;
UPDATE deal_stages SET position = 5, updated_at = NOW() WHERE name = 'Due Diligence' AND is_active = true;
UPDATE deal_stages SET position = 6, updated_at = NOW() WHERE name = 'LOI Submitted' AND is_active = true;