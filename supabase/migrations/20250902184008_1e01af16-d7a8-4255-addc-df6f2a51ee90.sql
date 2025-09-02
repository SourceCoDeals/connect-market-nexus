-- Create connection request stages for workflow
CREATE TABLE public.connection_request_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  automation_rules JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.connection_request_stages ENABLE ROW LEVEL SECURITY;

-- Policies for connection request stages
CREATE POLICY "Approved users can view connection request stages" 
ON public.connection_request_stages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND approval_status = 'approved' 
    AND email_verified = true
  )
);

CREATE POLICY "Admins can manage connection request stages" 
ON public.connection_request_stages 
FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Add new fields to connection_requests table
ALTER TABLE public.connection_requests 
ADD COLUMN pipeline_stage_id UUID REFERENCES public.connection_request_stages(id),
ADD COLUMN buyer_priority_score INTEGER DEFAULT 0,
ADD COLUMN stage_entered_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Insert default workflow stages
INSERT INTO public.connection_request_stages (name, description, position, color, is_default) VALUES
('New Lead', 'Newly received connection requests', 1, '#ef4444', true),
('Initial Review', 'Under initial review by admin', 2, '#f97316', false),
('Buyer Verification', 'Verifying buyer credentials and capacity', 3, '#eab308', false),
('NDA Process', 'Sending and managing NDA signatures', 4, '#06b6d4', false),
('Fee Agreement', 'Processing fee agreement signatures', 5, '#8b5cf6', false),
('Information Package', 'Preparing and sharing deal information', 6, '#3b82f6', false),
('Due Diligence', 'Buyer conducting due diligence', 7, '#0ea5e9', false),
('Negotiations', 'Active negotiations in progress', 8, '#10b981', false),
('Closing', 'Final closing activities', 9, '#059669', false),
('Complete', 'Successfully closed transaction', 10, '#22c55e', false);

-- Set default stage for existing requests
UPDATE public.connection_requests 
SET pipeline_stage_id = (
  SELECT id FROM public.connection_request_stages 
  WHERE is_default = true 
  LIMIT 1
)
WHERE pipeline_stage_id IS NULL;

-- Create buyer priority calculation function
CREATE OR REPLACE FUNCTION public.calculate_buyer_priority_score(buyer_type_param text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN CASE 
    WHEN LOWER(buyer_type_param) LIKE '%pe%' OR LOWER(buyer_type_param) LIKE '%private equity%' THEN 5
    WHEN LOWER(buyer_type_param) LIKE '%corporate%' OR LOWER(buyer_type_param) LIKE '%strategic%' THEN 4
    WHEN LOWER(buyer_type_param) LIKE '%independent sponsor%' OR LOWER(buyer_type_param) LIKE '%family office%' THEN 3
    WHEN LOWER(buyer_type_param) LIKE '%search fund%' THEN 2
    WHEN LOWER(buyer_type_param) LIKE '%individual%' THEN 1
    ELSE 0
  END;
END;
$$;

-- Create trigger to auto-calculate buyer priority scores
CREATE OR REPLACE FUNCTION public.update_buyer_priority_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  buyer_type_value text;
BEGIN
  -- Get buyer type from the user's profile
  SELECT p.buyer_type INTO buyer_type_value
  FROM public.profiles p
  WHERE p.id = NEW.user_id;
  
  -- Calculate and update priority score
  NEW.buyer_priority_score := public.calculate_buyer_priority_score(COALESCE(buyer_type_value, ''));
  
  RETURN NEW;
END;
$$;

-- Create trigger for new/updated connection requests
CREATE TRIGGER update_connection_request_buyer_priority
  BEFORE INSERT OR UPDATE ON public.connection_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_buyer_priority_score();

-- Update existing connection requests with priority scores
UPDATE public.connection_requests 
SET buyer_priority_score = public.calculate_buyer_priority_score(
  COALESCE((
    SELECT p.buyer_type 
    FROM public.profiles p 
    WHERE p.id = connection_requests.user_id
  ), '')
);

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_connection_request_stages_updated_at
  BEFORE UPDATE ON public.connection_request_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();