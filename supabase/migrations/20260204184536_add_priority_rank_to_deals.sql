-- Add priority_rank column to deals table for persistent deal ranking
-- This allows users to manually rank deals (1st, 2nd, 3rd priority) via drag-and-drop
-- The rank stays with the deal regardless of table sorting

ALTER TABLE public.deals
ADD COLUMN IF NOT EXISTS priority_rank INTEGER;

-- Create index for efficient sorting by rank
CREATE INDEX IF NOT EXISTS idx_deals_priority_rank ON public.deals(priority_rank);

-- Auto-assign sequential ranks to existing deals (ordered by created_at)
WITH ranked_deals AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (ORDER BY created_at ASC) as new_rank
  FROM public.deals
  WHERE priority_rank IS NULL
)
UPDATE public.deals
SET priority_rank = ranked_deals.new_rank
FROM ranked_deals
WHERE deals.id = ranked_deals.id;

-- Comment for documentation
COMMENT ON COLUMN public.deals.priority_rank IS 'Manual priority ranking (1=highest priority). Users can drag-and-drop to reorder. Rank persists regardless of table sorting.';
