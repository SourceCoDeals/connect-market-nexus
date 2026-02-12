-- Add captarget_sheet_tab column to track which tab each deal came from
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS captarget_sheet_tab TEXT;

-- Index for filtering by tab
CREATE INDEX IF NOT EXISTS idx_listings_captarget_sheet_tab ON public.listings (captarget_sheet_tab) WHERE captarget_sheet_tab IS NOT NULL;
