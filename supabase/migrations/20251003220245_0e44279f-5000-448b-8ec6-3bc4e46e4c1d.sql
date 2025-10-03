-- Create deal_comments table (idempotent)
CREATE TABLE IF NOT EXISTS public.deal_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL,
  admin_id UUID NOT NULL,
  comment_text TEXT NOT NULL,
  mentioned_admins UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign keys (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema='public' AND table_name='deal_comments' AND constraint_name='deal_comments_deal_id_fkey') THEN
    ALTER TABLE public.deal_comments
      ADD CONSTRAINT deal_comments_deal_id_fkey
      FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema='public' AND table_name='deal_comments' AND constraint_name='deal_comments_admin_id_fkey') THEN
    ALTER TABLE public.deal_comments
      ADD CONSTRAINT deal_comments_admin_id_fkey
      FOREIGN KEY (admin_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Copy data from deal_notes if exists and deal_comments is empty
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='deal_notes'
  ) AND NOT EXISTS (SELECT 1 FROM public.deal_comments) THEN
    INSERT INTO public.deal_comments (id, deal_id, admin_id, comment_text, created_at, updated_at)
    SELECT id, deal_id, admin_id, note_text, created_at, updated_at FROM public.deal_notes;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.deal_comments ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='deal_comments' AND policyname='Admins can view all deal comments'
  ) THEN
    DROP POLICY "Admins can view all deal comments" ON public.deal_comments;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='deal_comments' AND policyname='Admins can create deal comments'
  ) THEN
    DROP POLICY "Admins can create deal comments" ON public.deal_comments;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='deal_comments' AND policyname='Admins can update their own deal comments'
  ) THEN
    DROP POLICY "Admins can update their own deal comments" ON public.deal_comments;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='deal_comments' AND policyname='Admins can delete their own deal comments'
  ) THEN
    DROP POLICY "Admins can delete their own deal comments" ON public.deal_comments;
  END IF;
END $$;

CREATE POLICY "Admins can view all deal comments"
  ON public.deal_comments
  FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can create deal comments"
  ON public.deal_comments
  FOR INSERT
  WITH CHECK (is_admin(auth.uid()) AND auth.uid() = admin_id);

CREATE POLICY "Admins can update their own deal comments"
  ON public.deal_comments
  FOR UPDATE
  USING (is_admin(auth.uid()) AND auth.uid() = admin_id);

CREATE POLICY "Admins can delete their own deal comments"
  ON public.deal_comments
  FOR DELETE
  USING (is_admin(auth.uid()) AND auth.uid() = admin_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_deal_comments_updated_at ON public.deal_comments;
CREATE TRIGGER update_deal_comments_updated_at
  BEFORE UPDATE ON public.deal_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deal_comments_deal_id ON public.deal_comments(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_comments_created_at ON public.deal_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_comments_mentioned_admins ON public.deal_comments USING GIN(mentioned_admins);

-- Refresh PostgREST
NOTIFY pgrst, 'reload schema';