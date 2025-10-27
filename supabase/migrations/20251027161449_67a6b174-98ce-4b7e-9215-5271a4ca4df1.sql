-- Ensure utility function exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add updated_at column to firm_members if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'firm_members' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.firm_members
      ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

    -- Create trigger to auto-update updated_at on changes
    CREATE TRIGGER trg_firm_members_updated_at
    BEFORE UPDATE ON public.firm_members
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;