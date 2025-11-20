-- Enable RLS on deal_sourcing_requests table
ALTER TABLE public.deal_sourcing_requests ENABLE ROW LEVEL SECURITY;

-- Allow admins to view all deal sourcing requests
CREATE POLICY "Admins can view all deal sourcing requests"
ON public.deal_sourcing_requests
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Allow users to view their own deal sourcing requests
CREATE POLICY "Users can view their own deal sourcing requests"
ON public.deal_sourcing_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to insert their own deal sourcing requests
CREATE POLICY "Users can create deal sourcing requests"
ON public.deal_sourcing_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow admins to update any deal sourcing request
CREATE POLICY "Admins can update deal sourcing requests"
ON public.deal_sourcing_requests
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Allow admins to delete deal sourcing requests
CREATE POLICY "Admins can delete deal sourcing requests"
ON public.deal_sourcing_requests
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));