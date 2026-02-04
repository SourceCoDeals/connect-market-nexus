-- Enable RLS on tables
ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_deal_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracker_activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access to buyers
CREATE POLICY "Users can manage buyers" ON public.buyers 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow authenticated users full access to buyer_deal_scores
CREATE POLICY "Users can manage buyer_deal_scores" ON public.buyer_deal_scores 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow authenticated users full access to buyer_contacts
CREATE POLICY "Users can manage buyer_contacts" ON public.buyer_contacts 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow authenticated users to view tracker_activity_logs
CREATE POLICY "Users can view tracker_activity_logs" ON public.tracker_activity_logs 
FOR SELECT TO authenticated USING (true);