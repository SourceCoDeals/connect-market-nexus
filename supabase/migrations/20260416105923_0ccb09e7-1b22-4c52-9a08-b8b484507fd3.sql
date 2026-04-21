
-- Create invite_links table for admin-generated pre-approval tokens
CREATE TABLE public.invite_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  allowed_email_domain text,
  label text,
  created_by uuid REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  used_at timestamptz,
  used_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast token lookup
CREATE INDEX idx_invite_links_token ON public.invite_links (token);

-- Enable RLS
ALTER TABLE public.invite_links ENABLE ROW LEVEL SECURITY;

-- Admin/owner can read all invite links
CREATE POLICY "Admins can view invite links"
ON public.invite_links
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- Admin/owner can create invite links
CREATE POLICY "Admins can create invite links"
ON public.invite_links
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- Admin/owner can update invite links (e.g. revoke)
CREATE POLICY "Admins can update invite links"
ON public.invite_links
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));
