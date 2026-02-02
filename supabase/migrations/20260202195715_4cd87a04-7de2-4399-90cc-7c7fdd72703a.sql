-- Add is_production flag to user_sessions for database-level filtering
ALTER TABLE public.user_sessions 
ADD COLUMN IF NOT EXISTS is_production boolean DEFAULT true;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_production ON public.user_sessions(is_production) WHERE is_production = true;

-- Update existing sessions: mark dev/preview traffic as non-production
UPDATE public.user_sessions 
SET is_production = false 
WHERE (
  referrer ILIKE '%lovable.dev%' 
  OR referrer ILIKE '%lovableproject.com%' 
  OR referrer ILIKE '%preview--%'
  OR referrer ILIKE '%localhost%'
  OR referrer ILIKE '%127.0.0.1%'
);