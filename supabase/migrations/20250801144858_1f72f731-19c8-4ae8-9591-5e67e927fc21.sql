-- Create admin signature preferences table
CREATE TABLE public.admin_signature_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL,
  signature_html TEXT NOT NULL,
  signature_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(admin_id)
);

-- Enable RLS
ALTER TABLE public.admin_signature_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage their own signature preferences" 
ON public.admin_signature_preferences 
FOR ALL 
USING (is_admin(auth.uid()) AND auth.uid() = admin_id)
WITH CHECK (is_admin(auth.uid()) AND auth.uid() = admin_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_admin_signature_preferences_updated_at
BEFORE UPDATE ON public.admin_signature_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();