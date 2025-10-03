-- Create deal_notes table for admin collaboration
CREATE TABLE IF NOT EXISTS public.deal_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL,
  note_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deal_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all deal notes"
  ON public.deal_notes
  FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can create deal notes"
  ON public.deal_notes
  FOR INSERT
  WITH CHECK (is_admin(auth.uid()) AND auth.uid() = admin_id);

CREATE POLICY "Admins can update their own deal notes"
  ON public.deal_notes
  FOR UPDATE
  USING (is_admin(auth.uid()) AND auth.uid() = admin_id);

CREATE POLICY "Admins can delete their own deal notes"
  ON public.deal_notes
  FOR DELETE
  USING (is_admin(auth.uid()) AND auth.uid() = admin_id);

-- Create trigger for updated_at
CREATE TRIGGER update_deal_notes_updated_at
  BEFORE UPDATE ON public.deal_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_deal_notes_deal_id ON public.deal_notes(deal_id);
CREATE INDEX idx_deal_notes_created_at ON public.deal_notes(created_at DESC);