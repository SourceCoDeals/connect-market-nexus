-- ============================================================================
-- FIRM AGREEMENTS EXTENSION - Part 6: Add to realtime publication
-- ============================================================================

DO $$
BEGIN
  -- Check and add firm_agreements to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'firm_agreements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.firm_agreements;
  END IF;
  
  -- Check and add firm_members to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'firm_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.firm_members;
  END IF;
END $$;