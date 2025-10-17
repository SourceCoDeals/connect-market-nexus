-- Fix #1: Enable Realtime Updates for Firm Tables
-- This allows multi-admin collaboration with live updates

-- Add firm_agreements to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE firm_agreements;

-- Add firm_members to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE firm_members;

-- Enable replica identity for proper realtime tracking
ALTER TABLE firm_agreements REPLICA IDENTITY FULL;
ALTER TABLE firm_members REPLICA IDENTITY FULL;