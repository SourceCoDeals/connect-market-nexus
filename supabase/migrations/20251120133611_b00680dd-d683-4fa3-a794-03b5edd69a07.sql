-- Add status tracking and management fields to deal_sourcing_requests table
ALTER TABLE public.deal_sourcing_requests 
  ADD COLUMN status TEXT DEFAULT 'new',
  ADD COLUMN assigned_to UUID REFERENCES profiles(id),
  ADD COLUMN followed_up_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN admin_notes TEXT,
  ADD COLUMN converted_to_deal_id UUID REFERENCES deals(id);

-- Add indexes for performance
CREATE INDEX idx_deal_sourcing_status ON public.deal_sourcing_requests(status);
CREATE INDEX idx_deal_sourcing_created ON public.deal_sourcing_requests(created_at DESC);
CREATE INDEX idx_deal_sourcing_assigned ON public.deal_sourcing_requests(assigned_to);

-- Add comment documenting status values
COMMENT ON COLUMN public.deal_sourcing_requests.status IS 'Status of the request: new, reviewing, contacted, scheduled_call, converted_to_deal, archived';

-- Enable RLS (if not already enabled)
ALTER TABLE public.deal_sourcing_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view and manage all requests
CREATE POLICY "Admins can manage deal sourcing requests"
  ON public.deal_sourcing_requests
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Users can insert their own requests
CREATE POLICY "Users can create own deal sourcing requests"
  ON public.deal_sourcing_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own requests
CREATE POLICY "Users can view own deal sourcing requests"
  ON public.deal_sourcing_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);