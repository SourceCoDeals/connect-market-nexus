-- Create table to track when admins last viewed connection requests
CREATE TABLE IF NOT EXISTS public.admin_connection_requests_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(admin_id)
);

-- Enable RLS
ALTER TABLE public.admin_connection_requests_views ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage their own view records
CREATE POLICY "Admins can manage their own view records"
ON public.admin_connection_requests_views
FOR ALL
USING (admin_id = auth.uid())
WITH CHECK (admin_id = auth.uid());

-- Create table to track when admins last viewed users page
CREATE TABLE IF NOT EXISTS public.admin_users_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(admin_id)
);

-- Enable RLS
ALTER TABLE public.admin_users_views ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage their own view records
CREATE POLICY "Admins can manage their own view records"
ON public.admin_users_views
FOR ALL
USING (admin_id = auth.uid())
WITH CHECK (admin_id = auth.uid());