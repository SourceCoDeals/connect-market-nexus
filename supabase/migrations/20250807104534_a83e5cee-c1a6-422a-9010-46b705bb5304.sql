-- Create table for personal listing notes
CREATE TABLE public.listing_personal_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  listing_id UUID NOT NULL,
  content TEXT,
  tags TEXT[] DEFAULT '{}',
  rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

-- Enable Row Level Security
ALTER TABLE public.listing_personal_notes ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can manage their own notes" 
ON public.listing_personal_notes 
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins can view all notes for analytics
CREATE POLICY "Admins can view all notes" 
ON public.listing_personal_notes 
FOR SELECT 
USING (is_admin(auth.uid()));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_listing_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_listing_personal_notes_updated_at
  BEFORE UPDATE ON public.listing_personal_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_listing_notes_updated_at();