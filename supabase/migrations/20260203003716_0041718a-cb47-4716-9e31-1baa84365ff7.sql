-- Enable RLS on legacy tables that are missing it
-- These tables appear to be legacy/unused but still need protection

-- 1. buyers table (legacy - modern system uses remarketing_buyers)
ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view buyers" ON public.buyers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can manage buyers" ON public.buyers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- 2. buyer_contacts table (legacy)
ALTER TABLE public.buyer_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view buyer_contacts" ON public.buyer_contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can manage buyer_contacts" ON public.buyer_contacts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- 3. buyer_deal_scores table (legacy - modern system uses remarketing_scores)
ALTER TABLE public.buyer_deal_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view buyer_deal_scores" ON public.buyer_deal_scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can manage buyer_deal_scores" ON public.buyer_deal_scores
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- 4. call_intelligence table
ALTER TABLE public.call_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view call_intelligence" ON public.call_intelligence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can manage call_intelligence" ON public.call_intelligence
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );