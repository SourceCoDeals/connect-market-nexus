-- Create comprehensive deal pipeline management system

-- Create deal stages table for customizable pipeline stages
CREATE TABLE public.deal_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(position)
);

-- Create deals table linking prospects to listings with stage tracking
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.deal_stages(id) ON DELETE SET NULL,
  connection_request_id UUID REFERENCES public.connection_requests(id) ON DELETE SET NULL,
  inbound_lead_id UUID REFERENCES public.inbound_leads(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  value NUMERIC DEFAULT 0,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  probability INTEGER DEFAULT 50 CHECK (probability >= 0 AND probability <= 100),
  expected_close_date DATE,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  stage_entered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Deal source tracking
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'marketplace', 'webflow', 'import')),
  
  -- Contact information (consolidated from leads/requests)
  contact_name TEXT,
  contact_email TEXT,
  contact_company TEXT,
  contact_phone TEXT,
  contact_role TEXT,
  
  -- Status tracking
  nda_status TEXT DEFAULT 'not_sent' CHECK (nda_status IN ('not_sent', 'sent', 'signed', 'declined')),
  fee_agreement_status TEXT DEFAULT 'not_sent' CHECK (fee_agreement_status IN ('not_sent', 'sent', 'signed', 'declined')),
  followed_up BOOLEAN DEFAULT FALSE,
  followed_up_at TIMESTAMP WITH TIME ZONE,
  followed_up_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create deal tasks table for admin task assignment
CREATE TABLE public.deal_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE NOT NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create deal activities table for interaction logging
CREATE TABLE public.deal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE NOT NULL,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'stage_change', 'task_created', 'task_completed', 'note_added', 'email_sent', 
    'call_made', 'meeting_scheduled', 'document_shared', 'nda_sent', 'nda_signed',
    'fee_agreement_sent', 'fee_agreement_signed', 'follow_up'
  )),
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create default deal stages
INSERT INTO public.deal_stages (name, description, position, color, is_default) VALUES
('Sourced', 'Initial leads and inquiries', 1, '#6b7280', TRUE),
('Qualified', 'Qualified prospects with verified interest', 2, '#3b82f6', FALSE),
('NDA Sent', 'NDA sent to prospect', 3, '#f59e0b', FALSE),
('NDA Signed', 'NDA executed, can share detailed information', 4, '#10b981', FALSE),
('Fee Agreement Sent', 'Fee agreement sent to prospect', 5, '#8b5cf6', FALSE),
('Fee Agreement Signed', 'Fee agreement executed', 6, '#06b6d4', FALSE),
('Due Diligence', 'Active due diligence phase', 7, '#f97316', FALSE),
('LOI Submitted', 'Letter of intent submitted', 8, '#84cc16', FALSE),
('Under Contract', 'Purchase agreement signed', 9, '#22c55e', FALSE),
('Closed Won', 'Deal successfully closed', 10, '#16a34a', FALSE),
('Closed Lost', 'Deal lost or terminated', 11, '#dc2626', FALSE);

-- Enable RLS on all new tables
ALTER TABLE public.deal_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for deal_stages
CREATE POLICY "Admins can manage deal stages" ON public.deal_stages
  FOR ALL USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Approved users can view deal stages" ON public.deal_stages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND approval_status = 'approved' 
      AND email_verified = TRUE
    )
  );

-- RLS Policies for deals
CREATE POLICY "Admins can manage all deals" ON public.deals
  FOR ALL USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- RLS Policies for deal_tasks
CREATE POLICY "Admins can manage all deal tasks" ON public.deal_tasks
  FOR ALL USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- RLS Policies for deal_activities
CREATE POLICY "Admins can manage all deal activities" ON public.deal_activities
  FOR ALL USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Create function to update deal stage timestamps
CREATE OR REPLACE FUNCTION public.update_deal_stage_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Update stage_entered_at when stage changes
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    NEW.stage_entered_at = NOW();
    
    -- Log stage change activity
    INSERT INTO public.deal_activities (
      deal_id, admin_id, activity_type, title, description, metadata
    ) VALUES (
      NEW.id,
      auth.uid(),
      'stage_change',
      'Stage changed',
      CASE 
        WHEN OLD.stage_id IS NULL THEN 'Deal created'
        ELSE 'Moved to new stage'
      END,
      jsonb_build_object(
        'previous_stage_id', OLD.stage_id,
        'new_stage_id', NEW.stage_id,
        'changed_at', NOW()
      )
    );
  END IF;
  
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for deal stage updates
CREATE TRIGGER update_deal_stage_trigger
  BEFORE UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_deal_stage_timestamp();

-- Create function to automatically create deals from connection requests and leads
CREATE OR REPLACE FUNCTION public.create_deal_from_connection_request()
RETURNS TRIGGER AS $$
DECLARE
  default_stage_id UUID;
  deal_title TEXT;
  listing_title TEXT;
BEGIN
  -- Get default stage
  SELECT id INTO default_stage_id 
  FROM public.deal_stages 
  WHERE is_default = TRUE 
  ORDER BY position 
  LIMIT 1;
  
  -- Get listing title
  SELECT title INTO listing_title
  FROM public.listings
  WHERE id = NEW.listing_id;
  
  -- Create deal title
  deal_title := COALESCE(NEW.lead_name, 'Unknown') || ' - ' || COALESCE(listing_title, 'Unknown Listing');
  
  -- Create deal for new connection requests
  INSERT INTO public.deals (
    listing_id,
    stage_id,
    connection_request_id,
    title,
    description,
    source,
    contact_name,
    contact_email,
    contact_company,
    contact_phone,
    contact_role,
    metadata
  ) VALUES (
    NEW.listing_id,
    default_stage_id,
    NEW.id,
    deal_title,
    NEW.user_message,
    COALESCE(NEW.source, 'marketplace'),
    COALESCE(NEW.lead_name, (SELECT first_name || ' ' || last_name FROM public.profiles WHERE id = NEW.user_id)),
    COALESCE(NEW.lead_email, (SELECT email FROM public.profiles WHERE id = NEW.user_id)),
    NEW.lead_company,
    NEW.lead_phone,
    NEW.lead_role,
    jsonb_build_object(
      'auto_created', TRUE,
      'source_type', 'connection_request'
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-creating deals from connection requests
CREATE TRIGGER auto_create_deal_from_connection_request
  AFTER INSERT ON public.connection_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.create_deal_from_connection_request();

-- Create function to automatically create deals from converted inbound leads
CREATE OR REPLACE FUNCTION public.create_deal_from_inbound_lead()
RETURNS TRIGGER AS $$
DECLARE
  default_stage_id UUID;
  deal_title TEXT;
  listing_title TEXT;
BEGIN
  -- Only create deal when lead is converted
  IF OLD.status != 'converted' AND NEW.status = 'converted' THEN
    -- Get default stage
    SELECT id INTO default_stage_id 
    FROM public.deal_stages 
    WHERE is_default = TRUE 
    ORDER BY position 
    LIMIT 1;
    
    -- Get listing title
    SELECT title INTO listing_title
    FROM public.listings
    WHERE id = NEW.mapped_to_listing_id;
    
    -- Create deal title
    deal_title := COALESCE(NEW.name, 'Unknown') || ' - ' || COALESCE(listing_title, 'Unknown Listing');
    
    -- Create deal for converted lead
    INSERT INTO public.deals (
      listing_id,
      stage_id,
      inbound_lead_id,
      title,
      description,
      source,
      contact_name,
      contact_email,
      contact_company,
      contact_phone,
      contact_role,
      metadata
    ) VALUES (
      NEW.mapped_to_listing_id,
      default_stage_id,
      NEW.id,
      deal_title,
      NEW.message,
      COALESCE(NEW.source, 'webflow'),
      NEW.name,
      NEW.email,
      NEW.company_name,
      NEW.phone_number,
      NEW.role,
      jsonb_build_object(
        'auto_created', TRUE,
        'source_type', 'inbound_lead'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-creating deals from converted leads
CREATE TRIGGER auto_create_deal_from_inbound_lead
  AFTER UPDATE ON public.inbound_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.create_deal_from_inbound_lead();

-- Create updated_at triggers for new tables
CREATE TRIGGER update_deal_stages_updated_at
  BEFORE UPDATE ON public.deal_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deal_tasks_updated_at
  BEFORE UPDATE ON public.deal_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get deals with full details
CREATE OR REPLACE FUNCTION public.get_deals_with_details()
RETURNS TABLE(
  deal_id UUID,
  deal_title TEXT,
  deal_description TEXT,
  deal_value NUMERIC,
  deal_priority TEXT,
  deal_probability INTEGER,
  deal_expected_close_date DATE,
  deal_source TEXT,
  deal_created_at TIMESTAMP WITH TIME ZONE,
  deal_updated_at TIMESTAMP WITH TIME ZONE,
  deal_stage_entered_at TIMESTAMP WITH TIME ZONE,
  
  -- Stage information
  stage_id UUID,
  stage_name TEXT,
  stage_color TEXT,
  stage_position INTEGER,
  
  -- Listing information
  listing_id UUID,
  listing_title TEXT,
  listing_revenue NUMERIC,
  listing_ebitda NUMERIC,
  listing_location TEXT,
  
  -- Contact information
  contact_name TEXT,
  contact_email TEXT,
  contact_company TEXT,
  contact_phone TEXT,
  contact_role TEXT,
  
  -- Status information
  nda_status TEXT,
  fee_agreement_status TEXT,
  followed_up BOOLEAN,
  followed_up_at TIMESTAMP WITH TIME ZONE,
  
  -- Assignment information
  assigned_to UUID,
  assigned_admin_name TEXT,
  assigned_admin_email TEXT,
  
  -- Task counts
  total_tasks INTEGER,
  pending_tasks INTEGER,
  completed_tasks INTEGER,
  
  -- Activity count
  activity_count INTEGER
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    d.id as deal_id,
    d.title as deal_title,
    d.description as deal_description,
    d.value as deal_value,
    d.priority as deal_priority,
    d.probability as deal_probability,
    d.expected_close_date as deal_expected_close_date,
    d.source as deal_source,
    d.created_at as deal_created_at,
    d.updated_at as deal_updated_at,
    d.stage_entered_at as deal_stage_entered_at,
    
    -- Stage information
    ds.id as stage_id,
    ds.name as stage_name,
    ds.color as stage_color,
    ds.position as stage_position,
    
    -- Listing information
    l.id as listing_id,
    l.title as listing_title,
    l.revenue as listing_revenue,
    l.ebitda as listing_ebitda,
    l.location as listing_location,
    
    -- Contact information
    d.contact_name,
    d.contact_email,
    d.contact_company,
    d.contact_phone,
    d.contact_role,
    
    -- Status information
    d.nda_status,
    d.fee_agreement_status,
    d.followed_up,
    d.followed_up_at,
    
    -- Assignment information
    d.assigned_to,
    COALESCE(p.first_name || ' ' || p.last_name, p.email) as assigned_admin_name,
    p.email as assigned_admin_email,
    
    -- Task counts
    COALESCE(task_stats.total_tasks, 0) as total_tasks,
    COALESCE(task_stats.pending_tasks, 0) as pending_tasks,
    COALESCE(task_stats.completed_tasks, 0) as completed_tasks,
    
    -- Activity count
    COALESCE(activity_stats.activity_count, 0) as activity_count
    
  FROM public.deals d
  LEFT JOIN public.deal_stages ds ON d.stage_id = ds.id
  LEFT JOIN public.listings l ON d.listing_id = l.id
  LEFT JOIN public.profiles p ON d.assigned_to = p.id
  LEFT JOIN (
    SELECT 
      deal_id,
      COUNT(*) as total_tasks,
      SUM(CASE WHEN status IN ('pending', 'in_progress') THEN 1 ELSE 0 END) as pending_tasks,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks
    FROM public.deal_tasks
    GROUP BY deal_id
  ) task_stats ON d.id = task_stats.deal_id
  LEFT JOIN (
    SELECT 
      deal_id,
      COUNT(*) as activity_count
    FROM public.deal_activities
    GROUP BY deal_id
  ) activity_stats ON d.id = activity_stats.deal_id
  ORDER BY d.updated_at DESC;
$$;