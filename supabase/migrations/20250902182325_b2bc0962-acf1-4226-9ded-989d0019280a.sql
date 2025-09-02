-- Create connection request stages table for pipeline workflow
CREATE TABLE public.connection_request_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  automation_rules JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add stage tracking to connection_requests table
ALTER TABLE public.connection_requests 
ADD COLUMN pipeline_stage_id UUID REFERENCES public.connection_request_stages(id),
ADD COLUMN stage_entered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN buyer_priority_score INTEGER DEFAULT 0;

-- Create indexes for performance
CREATE INDEX idx_connection_requests_pipeline_stage ON public.connection_requests(pipeline_stage_id);
CREATE INDEX idx_connection_requests_stage_entered ON public.connection_requests(stage_entered_at);
CREATE INDEX idx_connection_requests_priority_score ON public.connection_requests(buyer_priority_score);

-- Insert default workflow stages
INSERT INTO public.connection_request_stages (name, position, color, description, automation_rules) VALUES
('Inquiry Received', 1, '#6b7280', 'Initial connection request received', '{"auto_assign": true}'),
('Documents Pending', 2, '#f59e0b', 'Waiting for NDA and Fee Agreement signatures', '{"check_documents": true}'),
('Qualified', 3, '#10b981', 'Documents complete, buyer qualified', '{"auto_promote": true}'),
('Initial Review', 4, '#3b82f6', 'Buyer reviewing initial information', '{}'),
('Meeting Scheduled', 5, '#8b5cf6', 'Call or meeting arranged', '{}'),
('Due Diligence', 6, '#06b6d4', 'Buyer conducting detailed review', '{}'),
('LOI Submitted', 7, '#f97316', 'Letter of Intent received', '{}'),
('Negotiation', 8, '#ef4444', 'Terms being negotiated', '{}'),
('Closed Won', 9, '#22c55e', 'Deal successfully closed', '{"final_stage": true}'),
('Closed Lost', 10, '#dc2626', 'Deal did not proceed', '{"final_stage": true, "require_reason": true}');

-- Set default stage for existing connection requests
UPDATE public.connection_requests 
SET pipeline_stage_id = (SELECT id FROM public.connection_request_stages WHERE name = 'Inquiry Received' LIMIT 1)
WHERE pipeline_stage_id IS NULL;

-- Create function to calculate buyer priority score
CREATE OR REPLACE FUNCTION public.calculate_buyer_priority_score(buyer_type_param TEXT)
RETURNS INTEGER
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

-- Create function to auto-assign stage based on document status
CREATE OR REPLACE FUNCTION public.auto_assign_connection_request_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_profile RECORD;
  new_stage_id UUID;
  documents_complete BOOLEAN;
BEGIN
  -- Get user profile to check document status
  SELECT nda_signed, fee_agreement_signed, buyer_type
  INTO user_profile
  FROM public.profiles 
  WHERE id = NEW.user_id;
  
  -- Calculate buyer priority score
  NEW.buyer_priority_score := public.calculate_buyer_priority_score(COALESCE(user_profile.buyer_type, ''));
  
  -- Check if documents are complete
  documents_complete := COALESCE(user_profile.nda_signed, false) AND COALESCE(user_profile.fee_agreement_signed, false);
  
  -- Auto-assign stage based on document status
  IF NEW.pipeline_stage_id IS NULL THEN
    IF documents_complete THEN
      -- Move to Qualified stage if documents are complete
      SELECT id INTO new_stage_id FROM public.connection_request_stages WHERE name = 'Qualified' LIMIT 1;
    ELSE
      -- Move to Documents Pending if documents missing
      SELECT id INTO new_stage_id FROM public.connection_request_stages WHERE name = 'Documents Pending' LIMIT 1;
    END IF;
    
    NEW.pipeline_stage_id := new_stage_id;
    NEW.stage_entered_at := now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-assignment
CREATE TRIGGER trigger_auto_assign_connection_request_stage
  BEFORE INSERT OR UPDATE ON public.connection_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_connection_request_stage();

-- Add RLS policies for connection_request_stages
ALTER TABLE public.connection_request_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage connection request stages"
ON public.connection_request_stages
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Approved users can view connection request stages"
ON public.connection_request_stages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND approval_status = 'approved' 
    AND email_verified = true
  )
);